package de.vereinsmanager.core.backup

import de.vereinsmanager.core.files.Dateinamen
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.math.BigDecimal
import java.security.DigestInputStream
import java.security.MessageDigest
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.Base64

/*
 * Jahresarchiv (Runde 2, R4c) – Gegenstück zu src/services/jahresarchiv.ts der Desktop-Fassung, Format in
 * BACKUP_FORMAT.md Abschnitt 9.
 *
 * Die Dateien eines abgeschlossenen Jahres (Belege, Rechnungs- und Spenden-PDFs, Fotos ausgemusterter Gegenstände)
 * wandern in eine eigene ZIP-Datei. Die Einträge bleiben vollständig im Bestand; an ihnen steht nur ein Vermerk, wo
 * die Datei liegt. Beide Fassungen lesen die Archive der anderen.
 *
 * Unterschied zum Desktop: Dort liegen die Dateien als Data-URL im Eintrag, hier meist als Datei im [FileStore]
 * (`fileId`, `photoFileId`); am Handy aufgenommene Inventarfotos stehen als Data-URL in `photoUrl`. Beides wird gelesen.
 * Archive werden als Datenstrom geschrieben und gelesen; im Speicher liegt immer nur archiv.json.
 */

class ArchivFehler(message: String) : Exception(message)

/** Vermerk an einem Eintrag, dessen Datei im Jahresarchiv liegt (Felder wie am Desktop). */
data class ArchivVermerk(
    val jahr: Int,
    val kennung: String,
    /** Vorgeschlagener Name der Archivdatei (nur zur Anzeige; die Datei darf umbenannt werden). */
    val datei: String,
    val pfad: String,
    val sha256: String,
    val groesse: Long,
    val typ: String,
    val archiviertAm: String,
) {
    fun json(): JsonObject = JsonObject(
        linkedMapOf(
            "jahr" to JsonPrimitive(jahr), "kennung" to JsonPrimitive(kennung), "datei" to JsonPrimitive(datei),
            "pfad" to JsonPrimitive(pfad), "sha256" to JsonPrimitive(sha256), "groesse" to JsonPrimitive(groesse),
            "typ" to JsonPrimitive(typ), "archiviertAm" to JsonPrimitive(archiviertAm),
        ),
    )

    /** „Im Jahresarchiv 2024 (VereinsManager_Archiv_….zip)“ */
    val text get() = "Im Jahresarchiv $jahr ($datei)"

    companion object {
        /** Liest einen Vermerk; null, wenn keiner da ist oder Pflichtangaben fehlen. */
        fun aus(e: JsonElement?): ArchivVermerk? {
            val o = e as? JsonObject ?: return null
            fun t(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
            val jahr = (o["jahr"] as? JsonPrimitive)?.intOrNull ?: t("jahr")?.toIntOrNull() ?: return null
            val kennung = t("kennung")?.takeIf { it.isNotEmpty() } ?: return null
            val pfad = t("pfad")?.takeIf { it.isNotEmpty() } ?: return null
            val sha = t("sha256")?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
            return ArchivVermerk(
                jahr, kennung, t("datei").orEmpty(), pfad, sha, (o["groesse"] as? JsonPrimitive)?.longOrNull ?: 0L,
                t("typ").orEmpty(), t("archiviertAm").orEmpty(),
            )
        }
    }
}

enum class ArchivArt(val wert: String, val name1: String, val bezeichnung: String, val jahre: Int?, val grundlage: String) {
    BELEG("beleg", "Beleg", "Buchungsbelege", 8, "§ 147 Abs. 3 AO (seit 2025: 8 Jahre)"),
    RECHNUNG("rechnung", "Rechnung", "Ausgestellte Rechnungen", 8, "§ 147 Abs. 3 AO, § 14b UStG (seit 2025: 8 Jahre)"),
    SPENDE(
        "spende", "Zuwendungsbestätigung", "Doppel der Zuwendungsbestätigungen", 10,
        "§ 50 Abs. 7 EStDV (keine eigene Frist genannt; vorsichtshalber 10 Jahre)",
    ),
    INVENTARFOTO("inventarfoto", "Inventarfoto", "Fotos ausgemusterter Gegenstände", null, "keine gesetzliche Aufbewahrungspflicht"),
    ;

    companion object {
        fun von(w: String?): ArchivArt? = values().firstOrNull { it.wert == w }
    }
}

data class Aufbewahrung(val art: ArchivArt, val jahre: Int?, val bis: String?) {
    val bezeichnung get() = art.bezeichnung
    val grundlage get() = art.grundlage
}

/** Wo eine Datei im Bestand liegt: als Datei im Dateispeicher oder als Data-URL im Eintrag. */
sealed class Quelle {
    data class Datei(val id: String) : Quelle()
    data class Inline(val dataUrl: String) : Quelle()

    internal val schluessel get() = when (this) { is Datei -> "f:$id"; is Inline -> "i:" + dataUrl.hashCode() + ":" + dataUrl.length }
}

/** Eine Datei im Bestand, die in ein Jahresarchiv gehört. [bereich]: "transactions", "documents" oder "inventory". */
data class ArchivKandidat(
    val art: ArchivArt, val bereich: String, val id: String, val jahr: Int, val datum: String,
    val belegnummer: String?, val betrag: BigDecimal?, val bezeichnung: String, val typ: String, val groesse: Long,
    val quelle: Quelle,
)

data class ArchivJahr(val jahr: Int, val dateien: Int, val groesse: Long, val erlaubt: Boolean, val grund: String?)

data class ArchivPlan(
    val jahr: Int, val kandidaten: List<ArchivKandidat>,
    /** Anzahl und Größe verschiedener Dateien (ein Beleg an Buchung und Dokument zählt einmal, er liegt hier auch nur einmal). */
    val dateien: Int, val groesse: Long,
    /** Verschiedene Dateien je Art */
    val jeArt: Map<ArchivArt, Int>,
    val aufbewahrung: List<Aufbewahrung>,
)

data class ArchivDatei(val pfad: String, val sha256: String, val groesse: Long, val typ: String)

data class ArchivEintrag(
    val art: ArchivArt, val bereich: String, val id: String, val pfad: String, val datum: String,
    val belegnummer: String?, val betrag: BigDecimal?, val bezeichnung: String,
)

/** Inhalt von archiv.json */
data class ArchivKopf(
    val kennung: String, val verein: String, val jahr: Int, val erstelltAm: String, val version: String,
    val aufbewahrung: List<Aufbewahrung>, val dateien: List<ArchivDatei>, val eintraege: List<ArchivEintrag>,
)

data class ArchivPruefung(val ok: Boolean, val geprueft: Int, val fehler: List<String>)

data class ArchivErgebnis(
    /** Geänderte Einträge (Buchungen, Dokumente, Gegenstände) */
    val geaendert: Int,
    /** Einträge, die übergangen wurden, mit Grund */
    val uebersprungen: List<String>,
)

object Jahresarchiv {
    const val JSON_NAME = "archiv.json"
    const val CSV_NAME = "Inhaltsverzeichnis.csv"
    const val FORMAT = "VereinsManager-Jahresarchiv"
    const val VERSION = "1.0.0"
    private const val MAX_JSON = 32L * 1024 * 1024

    const val GRUND_VORJAHR =
        "Für das Vorjahr laufen meist noch Jahresabschluss, Einnahmen-Überschuss-Rechnung, Kassenprüfung und Steuererklärung. Dafür werden die Belege noch gebraucht."
    const val GRUND_LAUFEND = "Das laufende Jahr ist noch nicht abgeschlossen."

    private val json = Json { prettyPrint = true }

    // ---------------------------------------------------------------- Hilfen

    private fun JsonObject.t(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull

    private fun jahrVon(datum: String?): Int? {
        val d = datum?.trim() ?: return null
        if (d.length < 10 || d[4] != '-' || d[7] != '-') return null
        if (!d.take(4).all(Char::isDigit) || !d.substring(5, 7).all(Char::isDigit) || !d.substring(8, 10).all(Char::isDigit)) return null
        return d.take(4).toInt()
    }

    /** Betrag nur, wenn er als Zahl im Eintrag steht (wie am Desktop). */
    private fun zahl(e: JsonElement?): BigDecimal? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull && !it.isString }?.content?.toBigDecimalOrNull()

    /** Base64-Teil einer Data-URL mit Inhalt; sonst null. */
    private fun base64Teil(url: String?): String? {
        if (url == null || !url.startsWith("data:")) return null
        val komma = url.indexOf(',')
        if (komma < 0) return null
        if (url.substring(5, komma).split(';').none { it.equals("base64", ignoreCase = true) }) return null
        val b64 = url.substring(komma + 1).filterNot(Char::isWhitespace)
        return b64.ifEmpty { null }
    }

    private fun mimeVon(url: String): String = url.substring(5, url.indexOf(',')).split(';').first().ifEmpty { "application/octet-stream" }

    private fun inlineBytes(url: String): ByteArray? = base64Teil(url)?.let {
        try { Base64.getDecoder().decode(it) } catch (e: IllegalArgumentException) { null }
    }

    private fun quelleVon(files: FileStore, fileId: String?, dataUrl: String?): Quelle? {
        if (!fileId.isNullOrEmpty() && files.size(fileId) != null) return Quelle.Datei(fileId)
        if (base64Teil(dataUrl) != null) return Quelle.Inline(dataUrl!!)
        return null
    }

    private fun groesse(files: FileStore, q: Quelle): Long = when (q) {
        is Quelle.Datei -> files.size(q.id) ?: 0L
        is Quelle.Inline -> inlineBytes(q.dataUrl)?.size?.toLong() ?: 0L
    }

    private fun oeffnen(files: FileStore, q: Quelle): InputStream? = when (q) {
        is Quelle.Datei -> files.open(q.id)
        is Quelle.Inline -> inlineBytes(q.dataUrl)?.let { ByteArrayInputStream(it) }
    }

    private fun hex(b: ByteArray) = b.joinToString("") { "%02x".format(it) }

    /** SHA-256 und Größe einer Datei, als Datenstrom gelesen. */
    private fun pruefsumme(s: InputStream): Pair<String, Long> {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(64 * 1024)
        var n = 0L
        while (true) {
            val r = s.read(buf)
            if (r < 0) break
            md.update(buf, 0, r)
            n += r
        }
        return hex(md.digest()) to n
    }

    private fun typVon(files: FileStore, q: Quelle, angabe: String?): String {
        angabe?.takeIf { it.contains('/') }?.let { return it }
        if (q is Quelle.Inline) return mimeVon(q.dataUrl)
        val kopf = oeffnen(files, q)?.use { s -> ByteArray(16).let { k -> k.copyOf(maxOf(s.read(k), 0)) } } ?: ByteArray(0)
        return Dateityp.erkennen(kopf)?.let { Dateityp.mimeZu(it) } ?: "application/octet-stream"
    }

    // ---------------------------------------------------------------- Fristen

    fun aufbewahrung(art: ArchivArt, jahr: Int) = Aufbewahrung(art, art.jahre, art.jahre?.let { "${jahr + it}-12-31" })

    fun aufbewahrenBis(liste: List<Aufbewahrung>): String? = liste.mapNotNull { it.bis }.maxOrNull()

    // ---------------------------------------------------------------- Was gehört ins Archiv?

    /** Alle Dateien des Bestands, die in ein Jahresarchiv gehören (alle Jahre); Reihenfolge Buchungen, Dokumente, Inventar. */
    fun kandidaten(store: DocumentStore, files: FileStore): List<ArchivKandidat> {
        val aus = ArrayList<ArchivKandidat>()
        val buchungen = store.all("transactions").associateBy { it.t("id").orEmpty() }
        val rechnungen = store.all("invoices").associateBy { it.t("id").orEmpty() }
        val spenden = store.all("donations").associateBy { it.t("id").orEmpty() }
        val rechnungZuDok = store.all("invoices").filter { !it.t("documentId").isNullOrEmpty() }.associateBy { it.t("documentId")!! }
        val spendeZuDok = store.all("donations").filter { !it.t("documentId").isNullOrEmpty() }.associateBy { it.t("documentId")!! }

        // Belege an Buchungen
        for (t in buchungen.values) {
            val r = t["receipt"] as? JsonObject ?: continue
            if (r["archiv"] is JsonObject) continue
            val q = quelleVon(files, r.t("fileId"), r.t("dataUrl")) ?: continue
            val jahr = jahrVon(t.t("date")) ?: continue
            aus += ArchivKandidat(
                ArchivArt.BELEG, "transactions", t.t("id").orEmpty(), jahr, t.t("date")!!.take(10),
                t.t("documentNumber")?.takeIf { it.isNotEmpty() }, zahl(t["amount"]),
                listOfNotNull(t.t("partner"), t.t("bookingText")).filter { it.isNotEmpty() }.joinToString(" – ").ifEmpty { "Beleg" },
                typVon(files, q, r.t("type")), groesse(files, q), q,
            )
        }

        // Dokumente: Belege, Rechnungs- und Spenden-PDFs
        for (d in store.all("documents")) {
            if (d["archiv"] is JsonObject) continue
            val q = quelleVon(files, d.t("fileId"), d.t("dataUrl")) ?: continue
            val id = d.t("id").orEmpty()
            val rechnung = rechnungZuDok[id] ?: if (id.startsWith("doc-inv-")) rechnungen[id.removePrefix("doc-inv-")] else null
            val spende = spendeZuDok[id] ?: if (id.startsWith("doc-don-")) spenden[id.removePrefix("doc-don-")] else null
            val buchungsId = d.t("transactionId")?.takeIf { it.isNotEmpty() } ?: if (id.startsWith("doc-receipt-")) id.removePrefix("doc-receipt-") else ""
            val buchung = if (buchungsId.isNotEmpty()) buchungen[buchungsId] else null
            val istBeleg = (d["isReceipt"] as? JsonPrimitive)?.contentOrNull == "true" || d.t("category") == "belege"

            data class K(val art: ArchivArt, val datum: String?, val nummer: String?, val betrag: BigDecimal?, val bez: String)
            val k = when {
                rechnung != null -> K(ArchivArt.RECHNUNG, rechnung.t("date"), rechnung.t("invoiceNumber"), zahl(rechnung["totalAmount"]), "Rechnung an ${rechnung.t("recipientName").orEmpty()}")
                spende != null -> K(ArchivArt.SPENDE, spende.t("date"), spende.t("receiptNumber"), zahl(spende["amount"]), "Zuwendungsbestätigung für ${spende.t("donorName").orEmpty()}")
                istBeleg && buchung != null -> K(ArchivArt.BELEG, buchung.t("date"), buchung.t("documentNumber"), zahl(buchung["amount"]), d.t("title")?.ifEmpty { null } ?: "Beleg")
                istBeleg -> K(ArchivArt.BELEG, d.t("date"), d.t("transactionDocNumber"), null, d.t("title")?.ifEmpty { null } ?: "Beleg")
                else -> null
            } ?: continue
            val jahr = jahrVon(k.datum) ?: continue
            aus += ArchivKandidat(
                k.art, "documents", id, jahr, k.datum!!.take(10), k.nummer?.takeIf { it.isNotEmpty() }, k.betrag, k.bez,
                typVon(files, q, d.t("fileType")), groesse(files, q), q,
            )
        }

        // Fotos ausgemusterter Gegenstände
        for (a in store.all("inventory")) {
            if (a.t("condition") != "discarded" || a["photoArchiv"] is JsonObject) continue
            val q = quelleVon(files, a.t("photoFileId"), a.t("photoUrl")) ?: continue
            val datum = a.t("retiredAt")?.takeIf { it.isNotEmpty() } ?: a.t("updatedAt").orEmpty().take(10)
            val jahr = jahrVon(datum) ?: continue
            aus += ArchivKandidat(
                ArchivArt.INVENTARFOTO, "inventory", a.t("id").orEmpty(), jahr, datum.take(10), a.t("itemNumber")?.takeIf { it.isNotEmpty() },
                null, "Foto: ${a.t("name").orEmpty()}", typVon(files, q, null), groesse(files, q), q,
            )
        }
        return aus
    }

    /** Das jüngste Jahr, das archiviert werden darf: das Vorvorjahr. */
    fun juengstesJahr(heute: LocalDate): Int = heute.year - 2

    /** Jahre mit archivierbaren Dateien, neueste zuerst. */
    fun jahre(store: DocumentStore, files: FileStore, heute: LocalDate): List<ArchivJahr> {
        val grenze = juengstesJahr(heute)
        return kandidaten(store, files).groupBy { it.jahr }.map { (jahr, liste) ->
            val eindeutig = liste.distinctBy { it.quelle.schluessel }
            ArchivJahr(
                jahr, eindeutig.size, eindeutig.sumOf { it.groesse }, jahr <= grenze,
                when { jahr <= grenze -> null; jahr == grenze + 1 -> GRUND_VORJAHR; else -> GRUND_LAUFEND },
            )
        }.sortedByDescending { it.jahr }
    }

    fun plan(store: DocumentStore, files: FileStore, jahr: Int): ArchivPlan {
        val k = kandidaten(store, files).filter { it.jahr == jahr }
        val eindeutig = k.distinctBy { it.quelle.schluessel }
        val arten = ArchivArt.values().filter { a -> k.any { it.art == a } }
        return ArchivPlan(
            jahr, k, eindeutig.size, eindeutig.sumOf { it.groesse },
            arten.associateWith { a -> k.filter { it.art == a }.distinctBy { it.quelle.schluessel }.size },
            arten.map { aufbewahrung(it, jahr) },
        )
    }

    /** Vorgeschlagener Dateiname: VereinsManager_Archiv_<Verein>_<Jahr>.zip (gleiche Regel wie am Desktop). */
    fun dateiname(verein: String, jahr: Int): String {
        val name = verein.trim().ifEmpty { "Verein" }.replace(Regex("\\s+"), "_").take(60)
        return Dateinamen.bereinigen("VereinsManager_Archiv_${name}_$jahr.zip", 120)
    }

    // ---------------------------------------------------------------- archiv.json und Inhaltsverzeichnis

    private fun betragJson(b: BigDecimal): JsonPrimitive = JsonPrimitive(b.stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it })

    internal fun kopfJson(k: ArchivKopf): JsonObject = JsonObject(
        linkedMapOf(
            "format" to JsonPrimitive(FORMAT), "version" to JsonPrimitive(k.version), "kennung" to JsonPrimitive(k.kennung),
            "verein" to JsonPrimitive(k.verein), "jahr" to JsonPrimitive(k.jahr), "erstelltAm" to JsonPrimitive(k.erstelltAm),
            "aufbewahrung" to JsonArray(
                k.aufbewahrung.map { a ->
                    JsonObject(
                        linkedMapOf(
                            "art" to JsonPrimitive(a.art.wert), "bezeichnung" to JsonPrimitive(a.bezeichnung),
                            "jahre" to (a.jahre?.let { JsonPrimitive(it) } ?: JsonNull), "bis" to (a.bis?.let { JsonPrimitive(it) } ?: JsonNull),
                            "grundlage" to JsonPrimitive(a.grundlage),
                        ),
                    )
                },
            ),
            "dateien" to JsonArray(
                k.dateien.map { d ->
                    JsonObject(linkedMapOf("pfad" to JsonPrimitive(d.pfad), "sha256" to JsonPrimitive(d.sha256), "groesse" to JsonPrimitive(d.groesse), "typ" to JsonPrimitive(d.typ)))
                },
            ),
            "eintraege" to JsonArray(
                k.eintraege.map { e ->
                    val m = linkedMapOf<String, JsonElement>(
                        "art" to JsonPrimitive(e.art.wert), "bereich" to JsonPrimitive(e.bereich), "id" to JsonPrimitive(e.id),
                        "pfad" to JsonPrimitive(e.pfad), "datum" to JsonPrimitive(e.datum),
                    )
                    e.belegnummer?.let { m["belegnummer"] = JsonPrimitive(it) }
                    e.betrag?.let { m["betrag"] = betragJson(it) }
                    m["bezeichnung"] = JsonPrimitive(e.bezeichnung)
                    JsonObject(m)
                },
            ),
        ),
    )

    /** Liest archiv.json; wirft [ArchivFehler], wenn es kein (lesbares) Jahresarchiv ist. */
    internal fun kopfAus(text: String): ArchivKopf {
        val o = try { Json.parseToJsonElement(text) as? JsonObject } catch (e: Exception) { null }
            ?: throw ArchivFehler("archiv.json im Archiv ist keine gültige JSON-Datei.")
        val kennung = o.t("kennung")
        val jahr = (o["jahr"] as? JsonPrimitive)?.intOrNull
        val dateien = o["dateien"] as? JsonArray
        val eintraege = o["eintraege"] as? JsonArray
        if (o.t("format") != FORMAT || kennung.isNullOrEmpty() || jahr == null || dateien == null || eintraege == null) {
            throw ArchivFehler("Das ist kein Jahresarchiv des VereinsManagers.")
        }
        val version = o.t("version").orEmpty()
        if (!version.startsWith("1.")) throw ArchivFehler("Das Archiv hat das Format $version; diese Version der App liest Format 1.x.")
        fun JsonElement.obj() = this as? JsonObject
        return ArchivKopf(
            kennung, o.t("verein").orEmpty(), jahr, o.t("erstelltAm").orEmpty(), version,
            (o["aufbewahrung"] as? JsonArray).orEmpty().mapNotNull { it.obj() }.mapNotNull { a ->
                ArchivArt.von(a.t("art"))?.let { Aufbewahrung(it, (a["jahre"] as? JsonPrimitive)?.intOrNull, a.t("bis")) }
            },
            dateien.mapNotNull { it.obj() }.mapNotNull { d ->
                val pfad = d.t("pfad") ?: return@mapNotNull null
                ArchivDatei(pfad, d.t("sha256").orEmpty().lowercase(), (d["groesse"] as? JsonPrimitive)?.longOrNull ?: -1L, d.t("typ").orEmpty())
            },
            eintraege.mapNotNull { it.obj() }.mapNotNull { e ->
                val art = ArchivArt.von(e.t("art")) ?: return@mapNotNull null
                ArchivEintrag(
                    art, e.t("bereich").orEmpty(), e.t("id").orEmpty(), e.t("pfad").orEmpty(), e.t("datum").orEmpty(),
                    e.t("belegnummer"), zahl(e["betrag"]), e.t("bezeichnung").orEmpty(),
                )
            },
        )
    }

    private fun csvFeld(v: String) = if (v.any { it == ';' || it == '"' || it == '\n' || it == '\r' }) "\"" + v.replace("\"", "\"\"") + "\"" else v
    private fun deDatum(d: String) = if (jahrVon(d) != null) "${d.substring(8, 10)}.${d.substring(5, 7)}.${d.take(4)}" else d
    private fun deBetrag(b: BigDecimal?) = b?.setScale(2, java.math.RoundingMode.HALF_UP)?.toPlainString()?.replace('.', ',') ?: ""

    /** Inhaltsverzeichnis für Menschen (UTF-8 mit BOM, „;“, CRLF). Ein Beleg an Buchung und Dokument steht einmal. */
    fun inhaltsverzeichnis(k: ArchivKopf): String {
        val sha = k.dateien.associate { it.pfad to it.sha256 }
        val gesehen = HashSet<String>()
        val zeilen = ArrayList<List<String>>()
        // Buchungen zuerst, damit beim Beleg Betrag und Belegnummer der Buchung stehen
        for (e in k.eintraege.sortedBy { if (it.bereich == "transactions") 0 else 1 }) {
            if (!gesehen.add("${e.art.wert}|${e.pfad}")) continue
            zeilen += listOf(e.art.name1, deDatum(e.datum), e.belegnummer.orEmpty(), deBetrag(e.betrag), e.bezeichnung, e.pfad, sha[e.pfad].orEmpty())
        }
        zeilen.sortBy { it[5] }
        val kopf = listOf("Art", "Datum", "Belegnummer", "Betrag (EUR)", "Bezeichnung", "Datei im Archiv", "SHA-256")
        return "\uFEFF" + (listOf(kopf) + zeilen).joinToString("\r\n") { z -> z.joinToString(";") { csvFeld(it) } } + "\r\n"
    }

    // ---------------------------------------------------------------- Archiv schreiben

    /** Dateispeicher-Sicht für die Pfadvergabe: auch Data-URLs erscheinen als Datei (nur Lesen). */
    private class Sicht(private val files: FileStore, private val quellen: Map<String, Quelle>) : FileStore {
        override fun put(id: String, input: InputStream): Long = throw UnsupportedOperationException()
        override fun open(id: String): InputStream? = quellen[id]?.let { oeffnen(files, it) }
        override fun size(id: String): Long? = quellen[id]?.let { groesse(files, it) }
        override fun delete(id: String) = throw UnsupportedOperationException()
        override fun ids(): List<String> = quellen.keys.toList()
        override fun clear() = throw UnsupportedOperationException()
    }

    /**
     * Schreibt das Jahresarchiv [jahr] in [out] und schließt [out]. Aufbau und Dateinamen wie im Sicherungspaket;
     * vorne archiv.json und Inhaltsverzeichnis.csv. Gleicher Inhalt steht nur einmal im Archiv.
     * Mit [passwort] ist jeder Eintrag AES-256-verschlüsselt (die Dateinamen nicht – so ist das ZIP-Format).
     * Am Bestand ändert sich nichts; das macht erst [anwenden], nachdem das gespeicherte Archiv geprüft wurde.
     */
    fun erstellen(
        store: DocumentStore, files: FileStore, jahr: Int, verein: String, kennung: String, out: OutputStream,
        passwort: CharArray? = null, now: ZonedDateTime = ZonedDateTime.now(),
    ): ArchivKopf {
        val plan = plan(store, files, jahr)
        if (plan.kandidaten.isEmpty()) { out.close(); throw ArchivFehler("Für $jahr gibt es keine Dateien zum Archivieren.") }

        // Erster Durchgang: Prüfsumme jeder verschiedenen Datei (als Datenstrom)
        val shaVon = LinkedHashMap<String, Pair<String, Long>>() // Quelle.schluessel -> (sha, groesse)
        for (k in plan.kandidaten.distinctBy { it.quelle.schluessel }) {
            shaVon[k.quelle.schluessel] = (oeffnen(files, k.quelle) ?: throw ArchivFehler("Die Datei zu „${k.bezeichnung}“ fehlt im Speicher.")).use { pruefsumme(it) }
        }

        // Pfade nach den Regeln des Sicherungspakets; dieselbe Datei (gleiche Prüfsumme) bekommt denselben Pfad.
        // Reihenfolge wie im Paket: erst Dokumente, dann Belege an Buchungen, dann Inventar.
        val ordner = BackupPaket.OrdnerPfade(store.all("folders"))
        val ablage = BackupPaket.Ablage()
        val quelleZuSha = HashMap<String, Quelle>() // sha -> erste Quelle
        val sicht = Sicht(files, plan.kandidaten.associate { "q-" + shaVon[it.quelle.schluessel]!!.first to it.quelle })
        val pfadVon = HashMap<String, String>() // "bereich|id" -> pfad
        val reihe = listOf("documents" to Art.DOKUMENT, "transactions" to Art.BELEG, "inventory" to Art.GERAET)
        for ((bereich, art) in reihe) {
            for (k in plan.kandidaten.filter { it.bereich == bereich }) {
                val rekord = store.get(bereich, k.id) ?: continue
                val ziel = if (art == Art.BELEG) rekord["receipt"] as? JsonObject ?: continue else rekord
                val sha = shaVon[k.quelle.schluessel]!!.first
                quelleZuSha.getOrPut(sha) { k.quelle }
                val sid = "q-$sha"
                pfadVon["$bereich|${k.id}"] = ablage.pfad(sid) { BackupPaket.verzeichnisUndName(art, ziel, rekord, ordner, sicht, sid) }
            }
        }

        val typVon = HashMap<String, String>()
        val eintraege = plan.kandidaten.map { k ->
            val pfad = pfadVon["${k.bereich}|${k.id}"] ?: throw ArchivFehler("Die Datei zu „${k.bezeichnung}“ ließ sich nicht ins Archiv übernehmen.")
            typVon.putIfAbsent(pfad, k.typ)
            ArchivEintrag(k.art, k.bereich, k.id, pfad, k.datum, k.belegnummer, k.betrag, k.bezeichnung)
        }
        val dateien = ablage.pfadVonId.map { (sid, pfad) ->
            val sha = sid.removePrefix("q-")
            val q = quelleZuSha[sha]!!
            ArchivDatei(pfad, sha, shaVon[q.schluessel]!!.second, typVon[pfad] ?: "application/octet-stream")
        }
        val kopf = ArchivKopf(kennung, verein, jahr, Zeit.stempel(now), VERSION, plan.aufbewahrung, dateien, eintraege)

        val zeit = now.toInstant().toEpochMilli()
        BackupPaket.zipAusgabe(out, passwort).use { z ->
            fun eintrag(name: String, schreiben: (OutputStream) -> Unit) {
                z.putNextEntry(BackupPaket.zipParameter(name, zeit, passwort != null))
                schreiben(z)
                z.closeEntry()
            }
            eintrag(JSON_NAME) { it.write(json.encodeToString(JsonObject.serializer(), kopfJson(kopf)).toByteArray(Charsets.UTF_8)) }
            eintrag(CSV_NAME) { it.write(inhaltsverzeichnis(kopf).toByteArray(Charsets.UTF_8)) }
            for ((sid, pfad) in ablage.pfadVonId) {
                val q = quelleZuSha[sid.removePrefix("q-")]!!
                eintrag(pfad) { o -> (oeffnen(files, q) ?: throw ArchivFehler("Die Datei $pfad ist verschwunden.")).use { it.copyTo(o, 64 * 1024) } }
            }
        }
        return kopf
    }

    // ---------------------------------------------------------------- Archiv lesen

    private fun leseJson(s: InputStream): String {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        var n = 0L
        while (true) {
            val r = s.read(buf)
            if (r < 0) break
            n += r
            if (n > MAX_JSON) throw ArchivFehler("archiv.json im Archiv ist unplausibel groß.")
            out.write(buf, 0, r)
        }
        return String(out.toByteArray(), Charsets.UTF_8)
    }

    /** Geht alle Einträge des ZIP durch; Passwort- und Formatfehler kommen als [BackupPasswortException] bzw. [BackupFormatException]. */
    private fun <T> durchgehen(input: InputStream, passwort: CharArray?, f: (name: String, s: InputStream) -> Boolean, fertig: () -> T): T {
        try {
            val z = BackupPaket.zipEingabe(input, passwort)
            while (true) {
                val h = z.nextEntry ?: break
                if (h.isDirectory) continue
                if (!f(h.fileName, z)) break
            }
            return fertig()
        } catch (e: ArchivFehler) {
            throw e
        } catch (e: Throwable) {
            throw BackupPaket.uebersetzen(e, passwort == null)
        }
    }

    /** Liest archiv.json. Wirft [ArchivFehler] (kein Jahresarchiv), [BackupPasswortException] oder [BackupFormatException]. */
    fun kopfLesen(input: InputStream, passwort: CharArray?): ArchivKopf {
        var kopf: ArchivKopf? = null
        return durchgehen(input, passwort, { name, s ->
            if (name == JSON_NAME) { kopf = kopfAus(leseJson(s)); false } else true
        }) { kopf ?: throw ArchivFehler("Das ist kein Jahresarchiv des VereinsManagers (archiv.json fehlt).") }
    }

    /** Liest jede Datei des Archivs und vergleicht Größe und Prüfsumme mit archiv.json. */
    fun pruefen(input: InputStream, passwort: CharArray?): Pair<ArchivKopf, ArchivPruefung> {
        var kopf: ArchivKopf? = null
        val gefunden = HashMap<String, Pair<String, Long>>()
        return durchgehen(input, passwort, { name, s ->
            if (name == JSON_NAME) kopf = kopfAus(leseJson(s)) else gefunden[name] = pruefsumme(s)
            true
        }) {
            val k = kopf ?: throw ArchivFehler("Das ist kein Jahresarchiv des VereinsManagers (archiv.json fehlt).")
            val fehler = ArrayList<String>()
            var ok = 0
            for (d in k.dateien) {
                val g = gefunden[d.pfad]
                when {
                    g == null -> fehler += "${d.pfad}: fehlt im Archiv."
                    g.first != d.sha256 || g.second != d.groesse -> fehler += "${d.pfad}: Inhalt stimmt nicht mit der Prüfsumme überein."
                    else -> ok++
                }
            }
            val bekannt = k.dateien.map { it.pfad }.toSet()
            for (e in k.eintraege) if (e.pfad !in bekannt) fehler += "${e.bezeichnung}: Datei ${e.pfad} ist im Inhaltsverzeichnis nicht aufgeführt."
            k to ArchivPruefung(fehler.isEmpty(), ok, fehler)
        }
    }

    /**
     * Schreibt eine einzelne Datei aus dem Archiv nach [ziel] (z. B. zum Ansehen eines Belegs) und gibt die Größe zurück.
     * Prüft, dass es das richtige Archiv ist und die Datei unverändert. Bei einem Fehler ist [ziel] unbrauchbar.
     */
    fun dateiLesen(input: InputStream, passwort: CharArray?, v: ArchivVermerk, ziel: OutputStream): Long {
        var kopf: ArchivKopf? = null
        var ergebnis: Pair<String, Long>? = null
        durchgehen(input, passwort, { name, s ->
            if (name == JSON_NAME) {
                kopf = kopfAus(leseJson(s))
                if (kopf!!.kennung != v.kennung) {
                    throw ArchivFehler("Das ist nicht das passende Archiv. Gesucht: ${v.datei} (Jahr ${v.jahr}), gewählt: Archiv ${kopf!!.jahr} von „${kopf!!.verein}“.")
                }
            } else if (name == v.pfad && ergebnis == null) {
                val md = MessageDigest.getInstance("SHA-256")
                val n = DigestInputStream(s, md).copyTo(ziel, 64 * 1024)
                ergebnis = hex(md.digest()) to n
            }
            kopf == null || ergebnis == null
        }) { Unit }
        if (kopf == null) throw ArchivFehler("Das ist kein Jahresarchiv des VereinsManagers (archiv.json fehlt).")
        val e = ergebnis ?: throw ArchivFehler("Die Datei „${v.pfad}“ fehlt im Archiv.")
        if (e.first != v.sha256) throw ArchivFehler("Die Datei „${v.pfad}“ im Archiv ist verändert oder beschädigt.")
        return e.second
    }

    // ---------------------------------------------------------------- Bestand ändern

    /** Hat der Eintrag einen Vermerk? (`archiv` an Dokument und Beleg, `photoArchiv` am Gegenstand) */
    fun vermerk(bereich: String, rekord: JsonObject?): ArchivVermerk? = when (bereich) {
        "transactions" -> ArchivVermerk.aus((rekord?.get("receipt") as? JsonObject)?.get("archiv"))
        "documents" -> ArchivVermerk.aus(rekord?.get("archiv"))
        "inventory" -> ArchivVermerk.aus(rekord?.get("photoArchiv"))
        else -> null
    }

    private fun aktuelleQuelle(files: FileStore, bereich: String, r: JsonObject): Quelle? = when (bereich) {
        "transactions" -> (r["receipt"] as? JsonObject)?.let { quelleVon(files, it.t("fileId"), it.t("dataUrl")) }
        "documents" -> quelleVon(files, r.t("fileId"), r.t("dataUrl"))
        "inventory" -> quelleVon(files, r.t("photoFileId"), r.t("photoUrl"))
        else -> null
    }

    /**
     * Nimmt die archivierten Dateien aus dem Bestand und setzt die Vermerke. Nur aufrufen, nachdem das gespeicherte
     * Archiv mit [pruefen] gelesen und geprüft wurde. Entfernt wird eine Datei nur, wenn sie im Bestand noch genau die
     * im Archiv ist (gleiche Prüfsumme); wurde sie inzwischen ersetzt, bleibt sie und wird gemeldet. Dateien im
     * Dateispeicher, auf die danach niemand mehr verweist, werden gelöscht.
     */
    fun anwenden(store: DocumentStore, files: FileStore, kopf: ArchivKopf, now: ZonedDateTime = ZonedDateTime.now()): ArchivErgebnis {
        val dateien = kopf.dateien.associateBy { it.pfad }
        val dateiname = dateiname(kopf.verein, kopf.jahr)
        val stempel = Zeit.stempel(now)
        val uebersprungen = ArrayList<String>()
        val frei = HashSet<String>()
        var n = 0
        val shaCache = HashMap<String, String?>()
        fun shaVon(q: Quelle): String? = shaCache.getOrPut(q.schluessel) { oeffnen(files, q)?.use { pruefsumme(it).first } }

        store.transaction {
            for (e in kopf.eintraege) {
                val d = dateien[e.pfad]
                if (d == null) { uebersprungen += "${e.bezeichnung}: Datei fehlt im Inhaltsverzeichnis."; continue }
                val was = when (e.bereich) { "transactions" -> "Beleg"; "documents" -> "Dokument"; "inventory" -> "Foto"; else -> null }
                if (was == null) { uebersprungen += "${e.bezeichnung}: unbekannter Bereich „${e.bereich}“."; continue }
                val r = store.get(e.bereich, e.id)
                if (r == null || (e.bereich == "transactions" && r["receipt"] !is JsonObject)) {
                    uebersprungen += "${e.bezeichnung}: ${if (e.bereich == "transactions") "Buchung oder Beleg" else if (e.bereich == "documents") "Dokument" else "Gegenstand"} nicht mehr vorhanden."
                    continue
                }
                if (vermerk(e.bereich, r) != null) { uebersprungen += "${e.bezeichnung}: schon archiviert."; continue }
                val q = aktuelleQuelle(files, e.bereich, r)
                if (q == null || shaVon(q) != d.sha256) {
                    uebersprungen += "${e.bezeichnung}: $was wurde inzwischen geändert, bleibt im Bestand."
                    continue
                }
                val v = ArchivVermerk(kopf.jahr, kopf.kennung, dateiname, e.pfad, d.sha256, d.groesse, d.typ, stempel).json()
                if (q is Quelle.Datei) frei += q.id
                val m = LinkedHashMap<String, JsonElement>(r)
                when (e.bereich) {
                    "transactions" -> {
                        val b = LinkedHashMap<String, JsonElement>(r["receipt"] as JsonObject)
                        b.remove("fileId"); b["dataUrl"] = JsonPrimitive(""); b["archiv"] = v
                        m["receipt"] = JsonObject(b)
                    }
                    "documents" -> { m.remove("fileId"); m["dataUrl"] = JsonPrimitive(""); m["archiv"] = v }
                    else -> { m.remove("photoFileId"); m.remove("photoUrl"); m["photoArchiv"] = v }
                }
                m["updatedAt"] = JsonPrimitive(stempel)
                store.put(e.bereich, e.id, JsonObject(m))
                n++
            }
        }
        val benutzt = Dateiverwaltung.referenziert(store)
        frei.filter { it !in benutzt }.forEach { files.delete(it) }
        return ArchivErgebnis(n, uebersprungen)
    }

    /** Wie viele Einträge zeigen auf das Archiv mit [kennung]? */
    fun verweise(store: DocumentStore, kennung: String): Int =
        listOf("transactions", "documents", "inventory").sumOf { b -> store.all(b).count { vermerk(b, it)?.kennung == kennung } }

    /**
     * Holt alle Dateien eines Archivs zurück in den Bestand (z. B. für eine Betriebsprüfung). Betroffen sind nur
     * Einträge, deren Vermerk auf genau dieses Archiv zeigt; jede Datei wird beim Lesen gegen ihre Prüfsumme geprüft.
     * Inventarfotos kommen als Datei zurück (`photoFileId`), wie Fotos aus einer Sicherung.
     */
    fun zurueckholen(
        store: DocumentStore, files: FileStore, input: InputStream, passwort: CharArray?,
        now: ZonedDateTime = ZonedDateTime.now(), neueId: () -> String = { BackupPaket.neueKennung(files) },
    ): Pair<ArchivKopf, ArchivErgebnis> {
        // Alle Vermerke im Bestand (jeder Kennung); welche zählen, steht erst fest, wenn archiv.json gelesen ist.
        data class Ziel(val bereich: String, val id: String, val v: ArchivVermerk)
        val ziele = listOf("transactions", "documents", "inventory").flatMap { b ->
            store.all(b).mapNotNull { r -> vermerk(b, r)?.let { Ziel(b, r.t("id").orEmpty(), it) } }
        }
        val gesucht = ziele.map { it.v.pfad to it.v.sha256 }.toSet()
        val angelegt = HashMap<Pair<String, String>, String>() // (pfad, sha) -> neue Datei
        val falsch = HashSet<String>()
        var kopf: ArchivKopf? = null
        try {
            durchgehen(input, passwort, { name, s ->
                if (name == JSON_NAME) {
                    kopf = kopfAus(leseJson(s))
                } else if (gesucht.any { it.first == name }) {
                    val id = neueId()
                    val md = MessageDigest.getInstance("SHA-256")
                    files.put(id, DigestInputStream(s, md))
                    val sha = hex(md.digest())
                    if ((name to sha) in gesucht && (name to sha) !in angelegt) angelegt[name to sha] = id
                    else { files.delete(id); falsch += name }
                }
                true
            }) { Unit }
            val k = kopf ?: throw ArchivFehler("Das ist kein Jahresarchiv des VereinsManagers (archiv.json fehlt).")
            val stempel = Zeit.stempel(now)
            val uebersprungen = ArrayList<String>()
            var n = 0
            store.transaction {
                for (z in ziele.filter { it.v.kennung == k.kennung }) {
                    val datei = angelegt[z.v.pfad to z.v.sha256]
                    if (datei == null) {
                        uebersprungen += "${z.v.pfad}: " + if (z.v.pfad in falsch) "im Archiv verändert oder beschädigt." else "fehlt im Archiv."
                        continue
                    }
                    val r = store.get(z.bereich, z.id) ?: continue
                    val m = LinkedHashMap<String, JsonElement>(r)
                    when (z.bereich) {
                        "transactions" -> {
                            val b = LinkedHashMap<String, JsonElement>(r["receipt"] as JsonObject)
                            b.remove("archiv"); b.remove("dataUrl"); b["fileId"] = JsonPrimitive(datei)
                            m["receipt"] = JsonObject(b)
                        }
                        "documents" -> { m.remove("archiv"); m.remove("dataUrl"); m["fileId"] = JsonPrimitive(datei) }
                        else -> { m.remove("photoArchiv"); m.remove("photoUrl"); m["photoFileId"] = JsonPrimitive(datei) }
                    }
                    m["updatedAt"] = JsonPrimitive(stempel)
                    store.put(z.bereich, z.id, JsonObject(m))
                    n++
                }
            }
            // Gelesene Dateien, die kein Eintrag braucht (anderes Archiv, übergangen), wieder entfernen
            val benutzt = Dateiverwaltung.referenziert(store)
            angelegt.values.filter { it !in benutzt }.forEach { files.delete(it) }
            return k to ArchivErgebnis(n, uebersprungen)
        } catch (e: Throwable) {
            val benutzt = Dateiverwaltung.referenziert(store)
            angelegt.values.filter { it !in benutzt }.forEach { files.delete(it) }
            throw e
        }
    }
}
