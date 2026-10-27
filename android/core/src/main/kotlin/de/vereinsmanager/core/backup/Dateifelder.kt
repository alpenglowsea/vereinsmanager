package de.vereinsmanager.core.backup

import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.security.MessageDigest
import java.util.Base64

/**
 * Die Stellen in den Daten, an denen eine Datei hängt (Format 1.3.0, siehe BACKUP_FORMAT.md Abschnitt „Sicherungspaket“).
 *
 * Es gibt drei Schreibweisen derselben Angabe:
 *  - **alt** (Format 1.2.3): der Inhalt steht als Data-URL („data:…;base64,…“) im Eintrag.
 *  - **Speicher** (in der App): `fileId` verweist auf eine Datei im [FileStore].
 *  - **Paket** (in `sicherung.json` des ZIP): der Pfad der Datei im ZIP steht im Eintrag.
 */
internal enum class Art(
    val bereich: String,
    /** Liegt die Angabe in einem Unterobjekt des Eintrags (bei Buchungen: der Beleg)? */
    val unterobjekt: String?,
    val speicherFeld: String,
    val paketFeld: String,
    val altFeld: String,
) {
    DOKUMENT("documents", null, "fileId", "file", "dataUrl"),
    BELEG("transactions", "receipt", "fileId", "file", "dataUrl"),
    FOTO("members", null, "avatarFileId", "avatarFile", "avatarUrl"),
    GERAET("inventory", null, "photoFileId", "photoFile", "photoUrl"),
}

internal fun JsonObject.text(k: String): String? = (this[k] as? JsonPrimitive)?.contentOrNull

/**
 * Wendet [f] auf jedes Objekt an, an dem eine Datei hängen kann (bei Belegen: auf das Unterobjekt `receipt`),
 * und gibt die geänderten Daten zurück. [f] bekommt zusätzlich den ganzen Eintrag, z. B. für Dateinamen.
 * Reihenfolge: Dokumente, Buchungen, Mitglieder, Inventar (wichtig für die Pfadvergabe).
 */
internal fun umschreiben(
    data: Map<String, JsonElement>,
    f: (Art, JsonObject, JsonObject) -> JsonObject,
): Map<String, JsonElement> {
    val neu = LinkedHashMap<String, JsonElement>(data)
    for (art in Art.values()) {
        val liste = data[art.bereich] as? kotlinx.serialization.json.JsonArray ?: continue
        neu[art.bereich] = kotlinx.serialization.json.JsonArray(
            liste.map { e ->
                val rekord = e as? JsonObject ?: return@map e
                if (art.unterobjekt == null) {
                    f(art, rekord, rekord)
                } else {
                    val ziel = rekord[art.unterobjekt] as? JsonObject ?: return@map e
                    val geaendert = f(art, ziel, rekord)
                    JsonObject(LinkedHashMap<String, JsonElement>(rekord).also { it[art.unterobjekt] = geaendert })
                }
            },
        )
    }
    return neu
}

/** Erkennt den Dateityp an den ersten Bytes. */
object Dateityp {
    fun erkennen(kopf: ByteArray): String? {
        fun ab(vararg b: Int) = kopf.size >= b.size && b.indices.all { kopf[it] == b[it].toByte() }
        return when {
            ab('%'.code, 'P'.code, 'D'.code, 'F'.code) -> "pdf"
            ab(0xFF, 0xD8, 0xFF) -> "jpg"
            ab(0x89, 'P'.code, 'N'.code, 'G'.code) -> "png"
            ab('G'.code, 'I'.code, 'F'.code, '8'.code) -> "gif"
            kopf.size >= 12 && ab('R'.code, 'I'.code, 'F'.code, 'F'.code) &&
                String(kopf, 8, 4, Charsets.US_ASCII) == "WEBP" -> "webp"
            else -> null
        }
    }

    private val MIME = mapOf(
        "application/pdf" to "pdf", "image/jpeg" to "jpg", "image/jpg" to "jpg", "image/png" to "png",
        "image/gif" to "gif", "image/webp" to "webp", "text/plain" to "txt", "text/csv" to "csv",
        "application/msword" to "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" to "docx",
        "application/vnd.ms-excel" to "xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" to "xlsx",
    )

    fun endungZu(mime: String): String? = MIME[mime.substringBefore(';').trim().lowercase()]

    /** Umkehrung für die Endungen pdf, jpg, png, gif, webp. */
    fun mimeZu(endung: String): String? = when (endung) {
        "pdf" -> "application/pdf"; "jpg" -> "image/jpeg"; "png" -> "image/png"; "gif" -> "image/gif"; "webp" -> "image/webp"
        else -> null
    }
}

/** Zerlegt eine Base64-Data-URL; null, wenn sie anders aufgebaut ist (dann bleibt sie unverändert im Eintrag). */
internal fun dataUrlLesen(url: String): ByteArray? {
    if (!url.startsWith("data:")) return null
    val komma = url.indexOf(',')
    if (komma < 0) return null
    val kopf = url.substring(5, komma)
    if (!kopf.split(';').any { it.equals("base64", ignoreCase = true) }) return null
    return try {
        Base64.getMimeDecoder().decode(url.substring(komma + 1))
    } catch (e: IllegalArgumentException) {
        null
    }
}

class AuslagerungsErgebnis(val daten: Map<String, JsonElement>, val angelegt: List<String>)

/** Verlagert Data-URLs aus einer Sicherung im alten Format (1.2.3) in den Dateispeicher. */
object Auslagerung {
    /**
     * Schreibt jede Data-URL der bekannten Stellen als Datei in [files] und ersetzt sie durch `fileId`.
     * Gleicher Inhalt (SHA-256) wird nur einmal abgelegt: die Desktop-Fassung hält denselben Beleg oft doppelt
     * (an der Buchung und als Dokument). Bei einem Fehler werden die angelegten Dateien wieder gelöscht.
     */
    fun auslagern(data: Map<String, JsonElement>, files: FileStore, neueId: () -> String): AuslagerungsErgebnis {
        val angelegt = mutableListOf<String>()
        val nachHash = HashMap<String, String>()
        try {
            val neu = umschreiben(data) { art, ziel, _ ->
                val url = ziel.text(art.altFeld)
                val bytes = if (url.isNullOrEmpty()) null else dataUrlLesen(url)
                if (bytes == null) {
                    ziel
                } else {
                    val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
                    val id = nachHash.getOrPut(hash) {
                        neueId().also { files.putBytes(it, bytes); angelegt.add(it) }
                    }
                    val m = LinkedHashMap<String, JsonElement>(ziel)
                    m.remove(art.altFeld)
                    m[art.speicherFeld] = JsonPrimitive(id)
                    JsonObject(m)
                }
            }
            return AuslagerungsErgebnis(neu, angelegt)
        } catch (e: Throwable) {
            angelegt.forEach { files.delete(it) }
            throw e
        }
    }
}

/** Gegenstück zur [Auslagerung]: holt die Dateien als Data-URL zurück in die Einträge (für die JSON-Sicherung des Formats 1.2.3). */
object Einlagerung {
    /** Summe der Größen aller Dateien, auf die die Daten verweisen; null-Größen (fehlende Dateien) zählen 0. */
    fun gesamtgroesse(data: Map<String, JsonElement>, files: FileStore): Long {
        var summe = 0L
        umschreiben(data) { art, ziel, _ -> ziel.text(art.speicherFeld)?.let { summe += files.size(it) ?: 0L }; ziel }
        return summe
    }

    /**
     * Ersetzt jede `fileId` durch `dataUrl` (bei Fotos `avatarUrl`/`photoUrl`). Der Medientyp stammt aus dem Eintrag
     * (`fileType`, `type`), sonst aus den ersten Bytes, sonst „application/octet-stream“. Fehlende Dateien: Verweis entfällt.
     * Der ganze Inhalt landet im Speicher; vorher mit [gesamtgroesse] prüfen.
     */
    fun einlagern(data: Map<String, JsonElement>, files: FileStore): Map<String, JsonElement> =
        umschreiben(data) { art, ziel, rekord ->
            val id = ziel.text(art.speicherFeld)
            if (id.isNullOrEmpty()) {
                ziel
            } else {
                val m = LinkedHashMap<String, JsonElement>(ziel)
                m.remove(art.speicherFeld)
                val bytes = files.open(id)?.use { it.readBytes() }
                if (bytes != null) {
                    val mime = (if (art == Art.DOKUMENT) rekord.text("fileType") else if (art == Art.BELEG) ziel.text("type") else null)
                        ?.takeIf { it.contains('/') }
                        ?: Dateityp.erkennen(bytes.copyOf(minOf(bytes.size, 16)))?.let { Dateityp.mimeZu(it) }
                        ?: "application/octet-stream"
                    m[art.altFeld] = JsonPrimitive("data:$mime;base64," + Base64.getEncoder().encodeToString(bytes))
                }
                JsonObject(m)
            }
        }
}

/** Pflege des Dateispeichers: welche Dateien gehören noch zu einem Eintrag? */
object Dateiverwaltung {
    fun referenziert(store: DocumentStore): Set<String> {
        val ids = HashSet<String>()
        for (art in Art.values()) {
            for (rekord in store.all(art.bereich)) {
                val ziel = if (art.unterobjekt == null) rekord else rekord[art.unterobjekt] as? JsonObject ?: continue
                ziel.text(art.speicherFeld)?.takeIf { it.isNotEmpty() }?.let(ids::add)
            }
        }
        return ids
    }

    /**
     * Löscht alle Dateien, auf die kein Eintrag mehr verweist, und gibt ihre Kennungen zurück.
     * Nicht aufrufen, während Dateien eingelesen werden, deren Einträge noch nicht gespeichert sind.
     */
    fun aufraeumen(store: DocumentStore, files: FileStore): List<String> {
        val benutzt = referenziert(store)
        val weg = files.ids().filter { it !in benutzt }
        weg.forEach { files.delete(it) }
        return weg
    }
}
