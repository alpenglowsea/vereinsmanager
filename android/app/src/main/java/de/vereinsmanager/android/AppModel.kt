package de.vereinsmanager.android

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import de.vereinsmanager.android.data.SqliteDocumentStore
import de.vereinsmanager.core.backup.BackupCrypto
import de.vereinsmanager.core.backup.BackupExporter
import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.Einlagerung
import de.vereinsmanager.core.backup.PaketImport
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.files.DirFileStore
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.members.BulkEdit
import de.vereinsmanager.core.members.CsvImportReport
import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.DuplicateStrategy
import de.vereinsmanager.core.members.ImportRow
import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.AusgabeForm
import de.vereinsmanager.core.backup.Dateityp
import de.vereinsmanager.core.files.FotoPdf
import de.vereinsmanager.core.finance.BelegErgebnis
import de.vereinsmanager.core.finance.BelegException
import de.vereinsmanager.core.finance.Belege
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.BuchungStore
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.members.Gegenstand
import de.vereinsmanager.core.members.MemberCsv
import de.vereinsmanager.core.members.MemberHistory
import de.vereinsmanager.core.members.MemberMaterial
import de.vereinsmanager.core.members.VerlaufEintrag
import de.vereinsmanager.core.members.BulkReport
import de.vereinsmanager.core.members.DeleteReport
import de.vereinsmanager.core.members.DocumentChoice
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberForm
import de.vereinsmanager.core.members.MemberRules
import de.vereinsmanager.core.members.MemberStore
import de.vereinsmanager.core.members.MaterialChoice
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.FileInputStream
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/** Der Zustand der App: Speicher, geladene Mitglieder und Meldungen. */
private val BEREICHE = mapOf(
    "members" to "Mitglieder", "transactions" to "Buchungen", "accounts" to "Konten", "auditLogs" to "Protokoll",
    "inventory" to "Inventar", "memberInventory" to "Materialausgaben", "sepaRuns" to "SEPA-Läufe",
    "documents" to "Dokumente", "folders" to "Ordner", "donations" to "Spenden", "contacts" to "Kontakte",
    "invoices" to "Rechnungen", "meetings" to "Sitzungen", "calendarEvents" to "Termine",
    "calendarCategories" to "Kalenderkategorien",
)

/** Was für eine Sicherungsdatei vorliegt (aus den ersten Bytes erkannt). */
enum class Eingabe(val geschuetzt: Boolean) {
    PAKET(false), PAKET_GESCHUETZT(true), JSON(false), JSON_GESCHUETZT(true)
}

class AppModel(private val appContext: Context) {
    val store = SqliteDocumentStore(appContext)

    /** Inhalte von Belegen, Dokumenten und Fotos; liegen einzeln im App-Ordner "dateien". */
    val dateien: FileStore = DirFileStore(File(appContext.filesDir, "dateien"))
    private val main = Handler(Looper.getMainLooper())

    var members by mutableStateOf<List<Member>>(emptyList())
        private set
    var departments by mutableStateOf<List<String>>(emptyList())
        private set
    var konten by mutableStateOf<List<Konto>>(emptyList())
        private set
    var buchungen by mutableStateOf<List<Buchung>>(emptyList())
        private set
    var clubName by mutableStateOf("")

    /** Anzahl und Größe der abgelegten Dateien (Belege, Dokumente, Fotos), fertig formatiert. */
    var dateiText by mutableStateOf("")
        private set
    var message by mutableStateOf("")

    /** Zählt jede neue Meldung, damit auch zweimal derselbe Text wieder als Fenster erscheint. */
    var meldungNr by mutableStateOf(0)
    var busy by mutableStateOf(false)
        private set

    /** Reihenfolge der Mitglieder, wie die Liste sie gerade zeigt (für das seitliche Blättern in der Detailansicht). */
    var ansicht by mutableStateOf<List<String>>(emptyList())

    /** Zählt hoch, sobald sich Material oder Historie geändert haben können; Ansichten lesen daraufhin neu. */
    var stand by mutableStateOf(0)
        private set

    init { reload() }

    private fun post(block: () -> Unit) { main.post(block) }

    /** Liest Mitglieder und Vereinsdaten neu aus dem Speicher. */
    fun reload() {
        stand += 1
        members = store.all("members").map { Member.from(it) }
        konten = Finance.konten(store)
        buchungen = Finance.buchungen(store)
        dateiText = dateiInfo()
        val settings = store.get("settings", "main")
        clubName = (settings?.get("clubName") as? JsonPrimitive)?.contentOrNull ?: ""
        departments = (settings?.get("departments") as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()
    }

    /** Erkennt Paket (ZIP) und JSON-Sicherung und ob ein Passwort nötig ist. */
    fun eingabeArt(uri: Uri): Eingabe {
        appContext.contentResolver.openInputStream(uri)!!.use { s ->
            val kopf = ByteArray(8)
            var n = 0
            while (n < kopf.size) {
                val r = s.read(kopf, n, kopf.size - n)
                if (r < 0) break
                n += r
            }
            val k = kopf.copyOf(n)
            if (BackupPaket.istPaket(k)) return if (BackupPaket.istVerschluesselt(k)) Eingabe.PAKET_GESCHUETZT else Eingabe.PAKET
        }
        return if (BackupFile.isEncrypted(readText(uri))) Eingabe.JSON_GESCHUETZT else Eingabe.JSON
    }

    private fun dateiInfo(): String {
        val ids = dateien.ids()
        val bytes = ids.sumOf { dateien.size(it) ?: 0L }
        val mb = String.format(Locale.GERMANY, "%.1f", bytes / 1024.0 / 1024.0)
        return "${ids.size} Dateien, $mb MB"
    }

    private fun readText(uri: Uri): String =
        appContext.contentResolver.openInputStream(uri)!!.use { it.readBytes() }.toString(Charsets.UTF_8)

    /**
     * Legt vor dem Einspielen eine Kopie des bisherigen Bestands samt Dateien als Paket (ZIP, ohne Passwort) im geschützten
     * App-Ordner ab. Es bleiben die letzten zwei (die Dateien können groß sein).
     */
    private fun sicherheitskopie(): String? {
        if (store.count("members") + store.count("transactions") + store.count("settings") == 0) return null
        return try {
            val dir = File(appContext.filesDir, "sicherheitskopien").apply { mkdirs() }
            val stamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.ROOT).format(Date())
            val f = File(dir, "vor_import_$stamp.zip")
            BackupPaket.schreiben(store, dateien, BufferedOutputStream(FileOutputStream(f), 64 * 1024))
            dir.listFiles()?.sortedBy { it.name }?.dropLast(2)?.forEach { it.delete() }
            f.name
        } catch (e: Exception) {
            null
        }
    }

    fun importBackup(uri: Uri, password: String, mode: ImportMode) {
        busy = true
        message = "Sicherung wird eingespielt …"
        thread {
            val text = try {
                var kopie: String? = null
                val vorher: () -> Unit = { kopie = sicherheitskopie() }
                val art = eingabeArt(uri)
                val bericht = when (art) {
                    Eingabe.PAKET, Eingabe.PAKET_GESCHUETZT ->
                        appContext.contentResolver.openInputStream(uri)!!.use { s ->
                            PaketImport.paket(
                                s, if (art.geschuetzt) password.toCharArray() else null, store, dateien, mode,
                                vorEinspielen = vorher,
                            )
                        }
                    else -> {
                        val raw = readText(uri)
                        val plain = if (art.geschuetzt) BackupCrypto.decrypt(raw, password) else raw
                        PaketImport.alt(BackupFile.parse(plain), store, dateien, mode, vorEinspielen = vorher)
                    }
                }
                val report = bericht.import
                val was = if (mode == ImportMode.REPLACE) "ersetzt" else "ergänzt"
                buildString {
                    append("Bestand $was. ")
                    append(report.inFile.entries.filter { it.value > 0 }.joinToString(", ") { "${BEREICHE[it.key] ?: it.key}: ${it.value}" })
                    append("\nDateien danach: ${dateiInfo()}")
                    if (bericht.fehlend.isNotEmpty()) append("\nIm Paket fehlten ${bericht.fehlend.size} genannte Dateien.")
                    append(if (kopie != null) "\nSicherheitskopie des vorherigen Bestands: $kopie" else "\nKeine Sicherheitskopie nötig (Bestand war leer) oder sie ließ sich nicht anlegen.")
                    if (!report.ok) append("\nNICHT alles gespeichert: " + report.failed.joinToString("; "))
                }
            } catch (e: Exception) {
                "Fehler: ${e.message ?: e::class.simpleName}"
            }
            post { reload(); message = text; meldungNr += 1; busy = false }
        }
    }

    /** Größte Dateimenge, die noch als JSON-Sicherung (Dateien als Text im Speicher) ausgegeben wird; mein Messwert für den ganzen Text lag bei etwa 10 MB. */
    private val jsonGrenze = 7L * 1024 * 1024

    private fun leereDateiLoeschen(uri: Uri) {
        try { DocumentsContract.deleteDocument(appContext.contentResolver, uri) } catch (e: Exception) { /* nicht schlimm */ }
    }

    /** [paket] = true: ZIP mit Belegen und Fotos; false: JSON im alten Format 1.2.3 (Dateien als Text darin). */
    fun exportBackup(uri: Uri, password: String, paket: Boolean) {
        busy = true
        message = "Sicherung wird geschrieben …"
        thread {
            val text = try {
                if (paket) {
                    val out = BufferedOutputStream(appContext.contentResolver.openOutputStream(uri, "wt")!!, 64 * 1024)
                    val bericht = try {
                        BackupPaket.schreiben(store, dateien, out, if (password.isNotEmpty()) password.toCharArray() else null)
                    } catch (e: Exception) {
                        leereDateiLoeschen(uri)
                        throw e
                    }
                    buildString {
                        append("Paket geschrieben (${bericht.dateien} Dateien, ${if (password.isNotEmpty()) "mit Passwort" else "ohne Passwort"}).")
                        if (bericht.fehlend.isNotEmpty()) append("\nFür ${bericht.fehlend.size} Einträge fehlte die Datei; der Verweis wurde weggelassen.")
                    }
                } else {
                    val roh = BackupExporter.export(store)
                    val groesse = Einlagerung.gesamtgroesse(roh.data, dateien)
                    if (groesse > jsonGrenze) {
                        leereDateiLoeschen(uri)
                        throw IllegalStateException("Die Dateien sind für eine JSON-Sicherung zu groß (${groesse / 1024 / 1024} MB). Bitte das Paket (ZIP) verwenden.")
                    }
                    val plain = BackupFile(roh.app, roh.version, roh.exportedAt, Einlagerung.einlagern(roh.data, dateien)).toJsonText()
                    val out = if (password.isNotEmpty()) BackupCrypto.encrypt(plain, password) else plain
                    appContext.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(out.toByteArray(Charsets.UTF_8)) }
                    "JSON-Sicherung geschrieben (${if (password.isNotEmpty()) "verschlüsselt" else "unverschlüsselt"})."
                }
            } catch (e: Exception) {
                "Fehler: ${e.message ?: e::class.simpleName}"
            }
            post { message = text; meldungNr += 1; busy = false }
        }
    }

    // ---- Mitglieder bearbeiten ----

    fun naechsteNummer(): String = MemberRules.naechsteNummer(members.map { it.number })

    /** Speichert im Hintergrund; danach meldet [done] auf dem Hauptfaden null (Erfolg) oder den Fehlertext. */
    fun saveMember(form: MemberForm, done: (String?) -> Unit) {
        busy = true
        thread {
            val fehler = try { MemberStore.speichern(store, form); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(fehler) }
        }
    }

    // ---- Buchungen bearbeiten ----

    /** Neues Formular mit der nächsten freien Belegnummer des laufenden Jahres. */
    fun neueBuchung(): BuchungForm {
        val heute = java.time.LocalDate.now()
        return BuchungRegeln.neu(
            id = "tx-${System.currentTimeMillis()}", datum = heute.toString(),
            belegNummer = BuchungRegeln.naechsteBelegNummer(buchungen.map { it.belegNummer }, heute.year),
            kontoId = konten.firstOrNull()?.id ?: "",
        )
    }

    fun saveBuchung(form: BuchungForm, done: (String?) -> Unit) {
        busy = true
        thread {
            val fehler = try { BuchungStore.speichern(store, form); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(fehler) }
        }
    }

    fun deleteBuchung(id: String, done: (String?) -> Unit) {
        busy = true
        thread {
            val fehler = try { Belege.buchungLoeschen(store, dateien, id); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(fehler) }
        }
    }

    // ---- Belege ----

    /** Bereits aufgenommene Seiten eines Belegs (Fotos im Zwischenspeicher), bis sie angehängt oder verworfen werden. */
    val fotoSeiten = mutableStateListOf<File>()
    private var aktuellesFoto: File? = null

    /** Zu welcher Buchung die aufgenommenen Seiten gehören (damit sie nicht an einer anderen landen). */
    var fotoBuchungId by mutableStateOf<String?>(null)

    private fun cacheOrdner(name: String): File = File(appContext.cacheDir, name).apply { mkdirs() }

    /** Ziel für die Kamera-App; die Datei gehört der App, die Kamera bekommt nur für diese eine Datei Schreibrecht. */
    fun neuesFotoZiel(buchungId: String): Uri {
        fotoBuchungId = buchungId
        val f = File(cacheOrdner("fotos"), "seite-${System.currentTimeMillis()}.jpg")
        aktuellesFoto = f
        return FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", f)
    }

    fun fotoAufgenommen(ok: Boolean) {
        val f = aktuellesFoto
        aktuellesFoto = null
        if (f == null) return
        if (ok && f.length() > 0) fotoSeiten.add(f) else f.delete()
    }

    fun fotosVerwerfen() {
        fotoSeiten.toList().forEach { it.delete() }
        fotoSeiten.clear()
        fotoBuchungId = null
    }

    /** Größte Datei, die zum Umwandeln gelesen wird (ein Foto ist oft größer als die fertige PDF). */
    private val maxEinlesen = 40L * 1024 * 1024

    private fun liesBegrenzt(uri: Uri): ByteArray {
        appContext.contentResolver.openInputStream(uri)!!.use { s ->
            val out = ByteArrayOutputStream()
            val puffer = ByteArray(64 * 1024)
            var summe = 0L
            while (true) {
                val n = s.read(puffer)
                if (n < 0) break
                summe += n
                if (summe > maxEinlesen) throw BelegException("Die Datei ist zu groß.")
                out.write(puffer, 0, n)
            }
            return out.toByteArray()
        }
    }

    private fun belegAnhaengen(buchungId: String, erzeugen: () -> ByteArray, done: (BelegErgebnis?, String?) -> Unit) {
        busy = true
        thread {
            var ergebnis: BelegErgebnis? = null
            var fehler: String? = null
            try {
                ergebnis = Belege.anhaengen(store, dateien, buchungId, erzeugen())
            } catch (e: Exception) {
                fehler = e.message ?: e::class.simpleName
            }
            post {
                reload()
                busy = false
                if (fehler == null) fotosVerwerfen()
                done(ergebnis, fehler)
            }
        }
    }

    /** Eine gewählte Datei: eine PDF kommt unverändert in den Speicher, ein Bild wird zuerst zur PDF. */
    fun belegAusDatei(buchungId: String, uri: Uri, done: (BelegErgebnis?, String?) -> Unit) = belegAnhaengen(buchungId, {
        val bytes = liesBegrenzt(uri)
        if (Dateityp.erkennen(bytes.copyOf(minOf(bytes.size, 16))) == "pdf") {
            bytes
        } else {
            FotoPdf.erzeugen(listOf(BildZuPdf.seite { appContext.contentResolver.openInputStream(uri)!! }))
        }
    }, done)

    /** Alle aufgenommenen Seiten zu einer PDF (eine Seite je Foto). */
    fun belegAusFotos(buchungId: String, done: (BelegErgebnis?, String?) -> Unit) {
        val seiten = fotoSeiten.toList()
        belegAnhaengen(buchungId, {
            FotoPdf.erzeugen(seiten.map { f -> BildZuPdf.seite { FileInputStream(f) } })
        }, done)
    }

    fun belegEntfernen(buchungId: String, done: (String?) -> Unit) {
        busy = true
        thread {
            val fehler = try { Belege.entfernen(store, dateien, buchungId); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(fehler) }
        }
    }

    /** Der Beleg als Datei im Zwischenspeicher (zum Anzeigen oder Weitergeben). */
    class BelegDatei(val datei: File, val mime: String, val name: String)

    /** Nicht im Hauptstrang aufrufen: kopiert die Datei. */
    fun belegDatei(buchungId: String): BelegDatei? {
        val b = store.get("transactions", buchungId) ?: return null
        val id = Belege.dateiId(b) ?: return null
        val name = ((b["receipt"] as? JsonObject)?.get("name") as? JsonPrimitive)?.contentOrNull ?: "Beleg"
        val kopf = dateien.open(id)?.use { s -> ByteArray(16).let { k -> k.copyOf(maxOf(s.read(k), 0)) } } ?: return null
        val endung = Dateityp.erkennen(kopf) ?: "bin"
        val ordner = cacheOrdner("belege")
        val ziel = File(ordner, "$id.$endung")
        if (!ziel.isFile || ziel.length() != dateien.size(id)) {
            dateien.open(id)?.use { i -> ziel.outputStream().use { o -> i.copyTo(o) } } ?: return null
        }
        ordner.listFiles()?.filter { it != ziel }?.forEach { it.delete() }
        return BelegDatei(ziel, Dateityp.mimeZu(endung) ?: "application/octet-stream", name)
    }

    fun dependencies(ids: List<String>): Pair<Int, Int> {
        var m = 0
        var d = 0
        for (id in ids) { val x = MemberStore.abhaengigkeiten(store, id); m += x.first; d += x.second }
        return m to d
    }

    fun deleteMembers(ids: List<String>, docs: DocumentChoice, material: MaterialChoice, done: (DeleteReport?, String?) -> Unit) {
        busy = true
        thread {
            var report: DeleteReport? = null
            val fehler = try {
                report = if (ids.size == 1) MemberStore.loeschen(store, ids[0], docs, material)
                else MemberStore.sammelLoeschen(store, ids, docs, material)
                null
            } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(report, fehler) }
        }
    }

    fun bulkEdit(ids: List<String>, edit: BulkEdit, done: (BulkReport?, String?) -> Unit) {
        busy = true
        thread {
            var report: BulkReport? = null
            val fehler = try { report = MemberStore.sammelAendern(store, ids, edit); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(report, fehler) }
        }
    }

    // ---- Export ----

    fun vereinsname(): String = clubName.ifEmpty { "Verein" }

    /** Schreibt im Hintergrund in die gewählte Datei; [done] bekommt die Meldung auf dem Hauptfaden. */
    fun exportiere(uri: Uri, schreiben: (java.io.OutputStream) -> Unit, erfolg: String, done: (String) -> Unit) {
        busy = true
        thread {
            val text = try {
                appContext.contentResolver.openOutputStream(uri, "wt")!!.use { schreiben(it) }
                erfolg
            } catch (e: Exception) {
                "Fehler beim Exportieren: ${e.message ?: e::class.simpleName}"
            }
            post { busy = false; done(text) }
        }
    }

    fun alleAusgaben(): List<Ausgabe> = MemberMaterial.alle(store)

    // ---- Material und Historie ----

    fun gegenstaende(): List<Gegenstand> = MemberMaterial.gegenstaende(store)
    fun ausgaben(memberId: String): List<Ausgabe> = MemberMaterial.ausgaben(store, memberId)
    fun historie(memberId: String): List<VerlaufEintrag> = MemberHistory.fuer(store, memberId)

    /** Speichert eine Ausgabe; gibt null bei Erfolg zurück, sonst den Fehlertext. */
    fun speichereAusgabe(memberId: String, form: AusgabeForm): String? =
        try { MemberMaterial.speichern(store, memberId, form); stand += 1; null } catch (e: Exception) { e.message ?: e::class.simpleName }

    fun ausgabeUmschalten(id: String): String? =
        try { MemberMaterial.umschalten(store, id); stand += 1; null } catch (e: Exception) { e.message ?: e::class.simpleName }

    fun ausgabeEntfernen(id: String): String? =
        try { MemberMaterial.entfernen(store, id); stand += 1; null } catch (e: Exception) { e.message ?: e::class.simpleName }

    // ---- CSV-Import ----

    /** Liest die Datei; zweiter Wert: true, wenn sie nicht UTF-8 war und als Windows-1252 gelesen wurde. */
    fun loadCsv(uri: Uri): Pair<CsvTable, Boolean> {
        val bytes = appContext.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
        val (text, fallback) = MemberCsv.decode(bytes)
        return MemberCsv.parse(text) to fallback
    }

    fun writeCsvTemplate(uri: Uri): String = try {
        val text = MemberCsv.vorlage(departments)
        appContext.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(text.toByteArray(Charsets.UTF_8)) }
        "Muster-Vorlage gespeichert."
    } catch (e: Exception) { "Fehler: ${e.message ?: e::class.simpleName}" }

    fun importCsv(rows: List<ImportRow>, strategy: DuplicateStrategy, done: (CsvImportReport?, String?) -> Unit) {
        busy = true
        thread {
            var report: CsvImportReport? = null
            val fehler = try { report = MemberCsv.importieren(store, rows, strategy); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(report, fehler) }
        }
    }

    fun suggestedFileName(paket: Boolean): String {
        val club = clubName.ifEmpty { "Verein" }.replace(Regex("[^A-Za-z0-9äöüÄÖÜß_-]+"), "_")
        return "VereinsManager_Sicherung_${club}_${SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())}.${if (paket) "zip" else "json"}"
    }
}
