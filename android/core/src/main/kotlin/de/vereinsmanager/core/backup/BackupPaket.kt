package de.vereinsmanager.core.backup

import de.vereinsmanager.core.files.Dateinamen
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import net.lingala.zip4j.exception.ZipException
import net.lingala.zip4j.io.inputstream.ZipInputStream
import net.lingala.zip4j.io.outputstream.ZipOutputStream
import net.lingala.zip4j.model.ZipParameters
import net.lingala.zip4j.model.enums.AesKeyStrength
import net.lingala.zip4j.model.enums.AesVersion
import net.lingala.zip4j.model.enums.CompressionLevel
import net.lingala.zip4j.model.enums.CompressionMethod
import net.lingala.zip4j.model.enums.EncryptionMethod
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.time.ZonedDateTime

/** Das Paket ist passwortgeschützt und es fehlt das Passwort ([fehlt] = true) oder es ist falsch. */
class BackupPasswortException(val fehlt: Boolean) :
    Exception(if (fehlt) "Das Paket ist durch ein Passwort geschützt." else "Falsches Passwort oder beschädigtes Paket.")

class PaketBericht(
    /** Anzahl der Dateien im Paket (ohne sicherung.json). */
    val dateien: Int,
    /** Dateien, auf die ein Eintrag verweist, die es aber nicht (mehr) gab. Diese Verweise wurden weggelassen. */
    val fehlend: List<String>,
)

class PaketGelesen(val sicherung: BackupFile, val angelegt: List<String>, val fehlend: List<String>)

/**
 * Das Sicherungspaket (Format 1.3.0): eine ZIP-Datei mit `sicherung.json` als erstem Eintrag und den Dateien
 * (Belege, Dokumente, Fotos) in lesbaren Ordnern. Wahlweise mit AES-256-Passwort (WinZip-AES, Standard).
 *
 * ```
 * sicherung.json
 * dokumente/<Ordner>/<Unterordner>/<Datei>
 * dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-01 Sportshop BE-2026-010.pdf
 * mitglieder-fotos/<Nr> <Nachname> <Vorname>.jpg
 * inventar-fotos/<Name>.jpg
 * ```
 * Maßgeblich für die Zuordnung sind die Pfade in `sicherung.json` (Felder `file`, `avatarFile`, `photoFile`);
 * die Namen sind für Menschen gedacht. Passwort: nach ZIP-Standard sind Dateinamen nicht verschlüsselt, der Inhalt aller Einträge schon.
 */
object BackupPaket {
    const val VERSION = "1.3.0"
    const val JSON_NAME = "sicherung.json"
    private const val MAX_JSON = 64L * 1024 * 1024

    /** Erkennt ein ZIP an den ersten vier Bytes („PK“ 03 04). */
    fun istPaket(kopf: ByteArray): Boolean =
        kopf.size >= 4 && kopf[0] == 'P'.code.toByte() && kopf[1] == 'K'.code.toByte() && kopf[2] == 3.toByte() && kopf[3] == 4.toByte()

    /** Ist der erste Eintrag des Pakets verschlüsselt? Nur sinnvoll, wenn [istPaket] wahr ist; braucht die ersten acht Bytes. */
    fun istVerschluesselt(kopf: ByteArray): Boolean = istPaket(kopf) && kopf.size >= 8 && (kopf[6].toInt() and 1) == 1

    fun neueKennung(files: FileStore): String {
        while (true) {
            val id = "f-" + Zeit.zufall(12)
            if (files.size(id) == null) return id
        }
    }

    // ---------------------------------------------------------------- Schreiben

    private const val OHNE_ORDNER = "(ohne Ordner)"
    private const val BELEG_ORDNER = "Buchhaltungsbelege & Finanzen"

    /** Ordnerpfade aus den Ordner-Datensätzen; doppelte Namen unter demselben Elternordner werden unterschieden. */
    internal class OrdnerPfade(ordner: List<JsonObject>) {
        private val nachId = ordner.associateBy { it.text("id") ?: "" }
        private val fertig = HashMap<String, String>()
        private val inArbeit = HashSet<String>()
        private val vergeben = HashMap<String, MutableSet<String>>()

        init { nachId.keys.forEach { pfad(it) } }

        fun pfad(id: String?): String? {
            if (id.isNullOrEmpty()) return null
            fertig[id]?.let { return it }
            val o = nachId[id] ?: return null
            if (!inArbeit.add(id)) return null // Kreis (A in B in A): der Ordner wird zum obersten
            val eltern = pfad(o.text("parentId")) // unbekannter oder fehlender Elternordner = oberste Ebene
            inArbeit.remove(id)
            val namen = vergeben.getOrPut(eltern ?: "") { mutableSetOf() }
            val name = Dateinamen.eindeutig(Dateinamen.bereinigen(o.text("name") ?: "Ordner", mitEndung = false), namen, mitEndung = false)
            namen.add(name)
            return (if (eltern == null) name else "$eltern/$name").also { fertig[id] = it }
        }
    }

    /** Vergibt die Pfade im ZIP; dieselbe Datei (Kennung) bekommt immer denselben Pfad. */
    internal class Ablage {
        val pfadVonId = LinkedHashMap<String, String>()
        private val namen = HashMap<String, MutableSet<String>>()
        fun pfad(id: String, wo: () -> Pair<String, String>): String = pfadVonId.getOrPut(id) {
            val (verz, name) = wo()
            val belegt = namen.getOrPut(verz.lowercase()) { mutableSetOf() }
            val n = Dateinamen.eindeutig(name, belegt)
            belegt.add(n)
            "$verz/$n"
        }
    }

    private fun hatEndung(name: String): Boolean {
        val i = name.lastIndexOf('.')
        return i > 0 && name.length - i in 2..6 && name.substring(i + 1).all { it.isLetterOrDigit() }
    }

    private fun kopf(files: FileStore, id: String): ByteArray =
        files.open(id)?.use { s -> val b = ByteArray(16); val n = s.read(b).coerceAtLeast(0); b.copyOf(n) } ?: ByteArray(0)

    private fun mitEndung(name: String, mime: String?, files: FileStore, id: String, standard: String? = null): String {
        if (hatEndung(name)) return name
        val e = (mime?.let { Dateityp.endungZu(it) }) ?: Dateityp.erkennen(kopf(files, id)) ?: standard
        return if (e == null) name else "$name.$e"
    }

    internal fun verzeichnisUndName(art: Art, ziel: JsonObject, rekord: JsonObject, ordner: OrdnerPfade, files: FileStore, id: String): Pair<String, String> =
        when (art) {
            Art.DOKUMENT -> {
                val verz = "dokumente/" + (ordner.pfad(rekord.text("folderId")) ?: OHNE_ORDNER)
                val roh = rekord.text("fileName")?.takeIf { it.isNotBlank() } ?: rekord.text("title")?.takeIf { it.isNotBlank() } ?: "Dokument"
                verz to Dateinamen.bereinigen(mitEndung(roh.trim(), rekord.text("fileType"), files, id))
            }
            Art.BELEG -> {
                val datum = rekord.text("date")?.trim().orEmpty()
                val jahr = datum.take(4).takeIf { it.length == 4 && it.all(Char::isDigit) }
                val verz = "dokumente/$BELEG_ORDNER/" + Dateinamen.bereinigen(if (jahr != null) "Belege $jahr" else "Belege (ohne Datum)", mitEndung = false)
                val aus = listOf(datum, rekord.text("partner").orEmpty(), rekord.text("documentNumber").orEmpty())
                    .map { it.trim() }.filter { it.isNotEmpty() }.joinToString(" ")
                val ursprung = ziel.text("name")?.trim().orEmpty()
                val roh = aus.ifEmpty { ursprung.ifEmpty { "Beleg" } }
                val endung = if (hatEndung(ursprung)) ursprung.substring(ursprung.lastIndexOf('.')) else ""
                verz to Dateinamen.bereinigen(mitEndung(roh + endung, ziel.text("type"), files, id))
            }
            Art.FOTO -> {
                val roh = listOf(rekord.text("memberNumber"), rekord.text("lastName"), rekord.text("firstName"))
                    .mapNotNull { it?.trim()?.takeIf(String::isNotEmpty) }.joinToString(" ").ifEmpty { "Foto" }
                "mitglieder-fotos" to Dateinamen.bereinigen(mitEndung(roh, null, files, id, standard = "jpg"))
            }
            Art.GERAET -> {
                val roh = rekord.text("name")?.trim()?.takeIf { it.isNotEmpty() } ?: "Foto"
                "inventar-fotos" to Dateinamen.bereinigen(mitEndung(roh, null, files, id, standard = "jpg"))
            }
        }

    /**
     * Schreibt den ganzen Bestand als Paket in [out] und schließt [out]. Die Dateien kommen als Datenstrom
     * aus [files]; im Speicher liegt nur `sicherung.json`. Mit [passwort] wird jeder Eintrag mit AES-256 verschlüsselt.
     * Bricht das Schreiben ab, ist die Ausgabe unbrauchbar und muss vom Aufrufer verworfen werden.
     */
    fun schreiben(
        store: DocumentStore, files: FileStore, out: OutputStream,
        passwort: CharArray? = null, now: ZonedDateTime = ZonedDateTime.now(),
    ): PaketBericht {
        val roh = BackupExporter.export(store, now)
        val ordner = OrdnerPfade(roh.list("folders") ?: emptyList())
        val ablage = Ablage()
        val fehlend = mutableListOf<String>()
        val daten = umschreiben(roh.data) { art, ziel, rekord ->
            val id = ziel.text(art.speicherFeld)
            if (id.isNullOrEmpty()) {
                ziel
            } else {
                val m = LinkedHashMap<String, JsonElement>(ziel)
                m.remove(art.speicherFeld)
                if (files.size(id) == null) {
                    fehlend.add("${art.bereich}/${rekord.text("id") ?: "?"}")
                } else {
                    m[art.paketFeld] = JsonPrimitive(ablage.pfad(id) { verzeichnisUndName(art, ziel, rekord, ordner, files, id) })
                }
                JsonObject(m)
            }
        }
        val json = BackupFile(roh.app, VERSION, roh.exportedAt, daten).toJsonText().toByteArray(Charsets.UTF_8)

        val zeit = now.toInstant().toEpochMilli()
        fun parameter(name: String) = zipParameter(name, zeit, passwort != null)
        val zos = zipAusgabe(out, passwort)
        zos.use {
            it.putNextEntry(parameter(JSON_NAME))
            it.write(json)
            it.closeEntry()
            for ((id, pfad) in ablage.pfadVonId) {
                it.putNextEntry(parameter(pfad))
                (files.open(id) ?: throw java.io.IOException("Datei $id verschwunden")).use { s -> s.copyTo(it, 64 * 1024) }
                it.closeEntry()
            }
        }
        return PaketBericht(ablage.pfadVonId.size, fehlend)
    }

    /** Einstellungen eines ZIP-Eintrags: Deflate, mit Passwort AES-256 (WinZip AE-2). Auch für das Jahresarchiv. */
    internal fun zipParameter(name: String, zeit: Long, verschluesseln: Boolean) = ZipParameters().also { p ->
        p.setFileNameInZip(name)
        p.setCompressionMethod(CompressionMethod.DEFLATE)
        p.setCompressionLevel(CompressionLevel.FAST)
        p.setLastModifiedFileTime(zeit)
        if (verschluesseln) {
            p.setEncryptFiles(true)
            p.setEncryptionMethod(EncryptionMethod.AES)
            p.setAesKeyStrength(AesKeyStrength.KEY_STRENGTH_256)
            p.setAesVersion(AesVersion.TWO)
        }
    }

    internal fun zipAusgabe(out: OutputStream, passwort: CharArray?): ZipOutputStream =
        if (passwort != null) ZipOutputStream(out, passwort, Charsets.UTF_8) else ZipOutputStream(out, Charsets.UTF_8)

    internal fun zipEingabe(input: InputStream, passwort: CharArray?): ZipInputStream =
        if (passwort != null) ZipInputStream(input, passwort, Charsets.UTF_8) else ZipInputStream(input, Charsets.UTF_8)

    // ---------------------------------------------------------------- Lesen

    private fun leseBegrenzt(s: InputStream): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        var summe = 0L
        while (true) {
            val n = s.read(buf)
            if (n < 0) break
            summe += n
            if (summe > MAX_JSON) throw BackupFormatException("$JSON_NAME im Paket ist unplausibel groß.")
            out.write(buf, 0, n)
        }
        return out.toByteArray()
    }

    /**
     * Liest ein Paket in einem Durchgang: erst `sicherung.json` (muss der erste Eintrag sein), dann die Dateien, die
     * sie nennt; diese kommen unter neuen Kennungen in [files]. Die Einträge in der Rückgabe tragen `fileId`.
     * Bei jedem Fehler werden die bis dahin angelegten Dateien wieder gelöscht. Bei Passwortschutz muss [passwort] stimmen;
     * Manipulationen am verschlüsselten Inhalt fallen beim Lesen des jeweiligen Eintrags auf.
     */
    fun lesen(input: InputStream, passwort: CharArray?, files: FileStore, neueId: () -> String = { neueKennung(files) }): PaketGelesen {
        val angelegt = mutableListOf<String>()
        try {
            val zis = zipEingabe(input, passwort)
            val erster = zis.nextEntry ?: throw BackupFormatException("Das Paket ist leer.")
            if (erster.fileName != JSON_NAME) {
                throw BackupFormatException("Das ist kein VereinsManager-Paket ($JSON_NAME fehlt an erster Stelle).")
            }
            val sicherung = BackupFile.parse(String(leseBegrenzt(zis), Charsets.UTF_8))

            val erwartet = HashSet<String>()
            umschreiben(sicherung.data) { art, ziel, _ -> ziel.text(art.paketFeld)?.let(erwartet::add); ziel }

            val pfadZuId = HashMap<String, String>()
            while (true) {
                val h = zis.nextEntry ?: break
                if (h.isDirectory) continue
                val name = h.fileName
                if (name in erwartet && name !in pfadZuId) {
                    val id = neueId()
                    files.put(id, zis)
                    angelegt.add(id)
                    pfadZuId[name] = id
                }
            }

            val fehlend = mutableListOf<String>()
            val daten = umschreiben(sicherung.data) { art, ziel, _ ->
                val pfad = ziel.text(art.paketFeld)
                if (pfad == null) {
                    ziel
                } else {
                    val m = LinkedHashMap<String, JsonElement>(ziel)
                    m.remove(art.paketFeld)
                    val id = pfadZuId[pfad]
                    if (id != null) m[art.speicherFeld] = JsonPrimitive(id) else fehlend.add(pfad)
                    JsonObject(m)
                }
            }
            return PaketGelesen(BackupFile(sicherung.app, sicherung.version, sicherung.exportedAt, daten), angelegt, fehlend)
        } catch (e: Throwable) {
            angelegt.forEach { files.delete(it) }
            throw uebersetzen(e, passwort == null)
        }
    }

    internal fun uebersetzen(e: Throwable, ohnePasswort: Boolean): Throwable = when {
        e is ZipException && e.type == ZipException.Type.WRONG_PASSWORD -> BackupPasswortException(fehlt = ohnePasswort)
        e is ZipException && e.type == ZipException.Type.CHECKSUM_MISMATCH -> BackupFormatException("Das Paket ist beschädigt (Prüfsumme stimmt nicht).")
        e is ZipException -> if (e.message?.contains("verification", ignoreCase = true) == true || e.message?.contains("password", ignoreCase = true) == true)
            BackupPasswortException(fehlt = ohnePasswort) else BackupFormatException("Das Paket ist beschädigt oder keine ZIP-Datei: ${e.message}")
        e is java.io.IOException && e.message?.contains("verification failed", ignoreCase = true) == true ->
            BackupFormatException("Das Paket ist beschädigt oder wurde verändert (Prüfung der Verschlüsselung fehlgeschlagen).")
        e is EOFException -> BackupFormatException("Das Paket ist unvollständig.")
        else -> e
    }
}

class PaketImportBericht(val import: ImportReport, val fehlend: List<String>, val entfernteDateien: Int)

/** Einspielen mit Dateien: erst die Dateien in den Dateispeicher, dann die Einträge, zuletzt verwaiste Dateien aufräumen. */
object PaketImport {
    fun paket(
        input: InputStream, passwort: CharArray?, store: DocumentStore, files: FileStore, mode: ImportMode,
        neueId: () -> String = { BackupPaket.neueKennung(files) },
        vorEinspielen: () -> Unit = {},
    ): PaketImportBericht {
        val gelesen = BackupPaket.lesen(input, passwort, files, neueId)
        return abschliessen(gelesen.sicherung, gelesen.fehlend, store, files, mode, vorEinspielen, gelesen.angelegt)
    }

    /** Eine Sicherung im alten Format (JSON, Dateien als Data-URL) einspielen; die Dateien werden dabei ausgelagert. */
    fun alt(
        sicherung: BackupFile, store: DocumentStore, files: FileStore, mode: ImportMode,
        neueId: () -> String = { BackupPaket.neueKennung(files) },
        vorEinspielen: () -> Unit = {},
    ): PaketImportBericht {
        val aus = Auslagerung.auslagern(sicherung.data, files, neueId)
        return abschliessen(BackupFile(sicherung.app, sicherung.version, sicherung.exportedAt, aus.daten), emptyList(), store, files, mode, vorEinspielen, aus.angelegt)
    }

    /**
     * [vorEinspielen] läuft, nachdem die Datei erfolgreich gelesen wurde und bevor am Bestand etwas geändert wird
     * (z. B. für die Sicherheitskopie). Wirft es, bleibt der Bestand unverändert und die neu abgelegten Dateien werden entfernt.
     */
    private fun abschliessen(
        datei: BackupFile, fehlend: List<String>, store: DocumentStore, files: FileStore, mode: ImportMode,
        vorEinspielen: () -> Unit, neuAngelegt: List<String>,
    ): PaketImportBericht {
        val bericht = try {
            vorEinspielen()
            BackupImporter.import(datei, store, mode)
        } catch (e: Throwable) {
            Dateiverwaltung.aufraeumen(store, files) // eingelesene Dateien ohne Eintrag wieder entfernen
            throw e
        }
        val weg = Dateiverwaltung.aufraeumen(store, files)
        return PaketImportBericht(bericht, fehlend, weg.size)
    }
}
