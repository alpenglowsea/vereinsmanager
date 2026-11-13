package de.vereinsmanager.android

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import de.vereinsmanager.android.data.SqliteDocumentStore
import de.vereinsmanager.core.calendar.Austausch
import de.vereinsmanager.core.calendar.ImportBericht
import de.vereinsmanager.core.calendar.Kalender
import de.vereinsmanager.core.calendar.Termin
import de.vereinsmanager.core.calendar.TerminForm
import de.vereinsmanager.core.calendar.TerminLesung
import de.vereinsmanager.core.calendar.Terminart
import de.vereinsmanager.core.contacts.Kontakt
import de.vereinsmanager.core.contacts.KontaktForm
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.inventory.Artikel
import de.vereinsmanager.core.inventory.ArtikelForm
import de.vereinsmanager.core.inventory.Inventar
import de.vereinsmanager.core.inventory.LoeschErgebnis
import de.vereinsmanager.core.inventory.SammelAenderung
import de.vereinsmanager.core.backup.BackupCrypto
import de.vereinsmanager.core.backup.BackupExporter
import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.Einlagerung
import de.vereinsmanager.core.backup.PaketImport
import de.vereinsmanager.core.backup.Dateiverwaltung
import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.meeting.Sitzung
import de.vereinsmanager.core.meeting.SitzungForm
import de.vereinsmanager.core.meeting.Sitzungen
import de.vereinsmanager.core.meeting.SitzungsLayout
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.documents.LoeschBericht
import de.vereinsmanager.core.documents.Ordner
import de.vereinsmanager.core.documents.OrdnerForm
import de.vereinsmanager.core.documents.StandardOrdner
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
import de.vereinsmanager.core.finance.BuchungSammel
import de.vereinsmanager.core.finance.BuchungSammelStore
import de.vereinsmanager.core.finance.SammelBericht
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.donation.DonationExport
import de.vereinsmanager.core.donation.DonationReceipt
import de.vereinsmanager.core.donation.SpendeErgebnis
import de.vereinsmanager.core.donation.SpendeForm
import de.vereinsmanager.core.donation.SpendeOptionen
import de.vereinsmanager.core.donation.Spenden
import de.vereinsmanager.core.donation.SpendenPdf
import de.vereinsmanager.core.donation.SpendenZip
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.invoice.Absender
import de.vereinsmanager.core.invoice.BezahltAngaben
import de.vereinsmanager.core.invoice.Rechnung
import de.vereinsmanager.core.invoice.toRechnung
import de.vereinsmanager.core.invoice.RechnungErgebnis
import de.vereinsmanager.core.invoice.RechnungForm
import de.vereinsmanager.core.invoice.RechnungOptionen
import de.vereinsmanager.core.invoice.Rechnungen
import de.vereinsmanager.core.invoice.RechnungsExport
import de.vereinsmanager.core.invoice.RechnungsLayout
import de.vereinsmanager.core.invoice.RechnungsPdf
import de.vereinsmanager.core.invoice.Vorlage
import de.vereinsmanager.core.invoice.Vorlagen
import de.vereinsmanager.core.donation.Unterschriften
import de.vereinsmanager.android.export.PdfWriter
import de.vereinsmanager.core.antrag.Antrag
import de.vereinsmanager.core.antrag.AntragEinstellungen
import de.vereinsmanager.core.antrag.AntragEinstellungenStore
import de.vereinsmanager.core.antrag.AntragLayout
import de.vereinsmanager.core.antrag.Aufnahme
import de.vereinsmanager.core.antrag.AufnahmeErgebnis
import de.vereinsmanager.core.sepa.Beitragslauf
import de.vereinsmanager.core.sepa.Lauf
import de.vereinsmanager.core.sepa.LaufErgebnis
import de.vereinsmanager.core.sepa.LaufParameter
import de.vereinsmanager.core.sepa.SepaItem
import de.vereinsmanager.core.sepa.Verbucht
import de.vereinsmanager.core.settings.Glaeubiger
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.finance.KontoForm
import de.vereinsmanager.core.finance.KontoStore
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

    var dokumente by mutableStateOf<List<Dokument>>(emptyList())
        private set
    var ordner by mutableStateOf<List<Ordner>>(emptyList())
        private set

    var laeufe by mutableStateOf<List<Lauf>>(emptyList())
        private set
    var spenden by mutableStateOf<List<DonationReceipt>>(emptyList())
        private set
    var unterschrift by mutableStateOf<Unterschrift?>(null)
        private set
    var rechnungen by mutableStateOf<List<Rechnung>>(emptyList())
    var kontakte by mutableStateOf<List<Kontakt>>(emptyList())
    /** Inventar und, je Gegenstand, wie viele Stück gerade an Mitglieder ausgegeben sind. */
    var termine by mutableStateOf<List<Termin>>(emptyList())
    var sitzungen by mutableStateOf<List<Sitzung>>(emptyList())
    var terminarten by mutableStateOf<List<Terminart>>(emptyList())
    var inventar by mutableStateOf<List<Artikel>>(emptyList())
    var inventarAusgegeben by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var vorlage by mutableStateOf(Vorlage())
        private set
    var vereinsdaten by mutableStateOf(VereinsForm())
        private set
    /** Was für einen Lastschrifteinzug in den Einstellungen noch fehlt (null: alles da). */
    var lastschriftFehlt by mutableStateOf<String?>(null)
        private set
    var glaeubiger by mutableStateOf<Glaeubiger?>(null)
        private set

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
        dokumente = Dokumente.dokumente(store)
        ordner = Dokumente.ordner(store)
        laeufe = Beitragslauf.laeufe(store)
        spenden = Spenden.alle(store)
        unterschrift = Unterschriften.lesen(store)
        rechnungen = Rechnungen.alle(store)
        kontakte = Kontakte.alle(store)
        termine = Kalender.alle(store)
        sitzungen = Sitzungen.alle(store)
        terminarten = Kalender.arten(store)
        inventar = Inventar.alle(store)
        inventarAusgegeben = Inventar.ausgegeben(store)
        vorlage = Vorlagen.lesen(store)
        vereinsdaten = Vereinsdaten.lesen(store.get("settings", "main"))
        lastschriftFehlt = Vereinsdaten.fehlt(store.get("settings", "main"))
        glaeubiger = Vereinsdaten.glaeubiger(store.get("settings", "main"))
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
                // Hat die Sicherung eine Ordnerstruktur mitgebracht, gilt sie; die Standard-Ordner kommen dann nicht noch einmal dazu.
                if (store.all("folders").isNotEmpty()) prefs.edit().putBoolean("standardOrdner", true).apply()
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

    /** Sammelbearbeitung: ändert die gewählten Buchungen (nur gesetzte Felder). */
    fun buchungenSammel(ids: List<String>, edit: BuchungSammel, done: (SammelBericht?, String?) -> Unit) =
        hintergrund({ BuchungSammelStore.anwenden(store, ids, edit) }, done)

    /** Löscht die gewählten Buchungen samt Belegen. */
    fun buchungenLoeschen(ids: List<String>, done: (Int?, String?) -> Unit) =
        hintergrund({ Belege.buchungenLoeschen(store, dateien, ids) }, done)

    // ---- Belege ----

    /** Bereits aufgenommene Seiten eines Belegs (Fotos im Zwischenspeicher), bis sie angehängt oder verworfen werden. */
    class FotoEntwurf(val datei: File) {
        /** Drehung und Ausschnitt, die der Anwender eingestellt hat. */
        var edit by mutableStateOf(SeitenEdit())
    }

    val fotoSeiten = mutableStateListOf<FotoEntwurf>()

    /** Nummer der Seite, die gerade zugeschnitten wird (null: keine). */
    var fotoBearbeiten by mutableStateOf<Int?>(null)

    /** Alle Seiten als Graustufen speichern (kleinere Datei). */
    var fotoGrau by mutableStateOf(false)
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
        if (ok && f.length() > 0) {
            fotoSeiten.add(FotoEntwurf(f))
            fotoBearbeiten = fotoSeiten.lastIndex // gleich zum Drehen und Zuschneiden öffnen
        } else {
            f.delete()
        }
    }

    fun fotosVerwerfen() {
        fotoSeiten.toList().forEach { it.datei.delete() }
        fotoSeiten.clear()
        fotoBearbeiten = null
        fotoBuchungId = null
    }

    fun fotoEntfernen(index: Int) {
        if (index !in fotoSeiten.indices) return
        fotoSeiten.removeAt(index).datei.delete()
        fotoBearbeiten = null
        if (fotoSeiten.isEmpty()) fotoBuchungId = null
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
            FotoPdf.erzeugen(listOf(BildZuPdf.seite(oeffnen = { appContext.contentResolver.openInputStream(uri)!! })))
        }
    }, done)

    /** Alle aufgenommenen Seiten zu einer PDF (eine Seite je Foto). */
    fun belegAusFotos(buchungId: String, done: (BelegErgebnis?, String?) -> Unit) {
        val seiten = fotoSeiten.toList().map { it.datei to it.edit }
        val grau = fotoGrau
        belegAnhaengen(buchungId, {
            FotoPdf.erzeugen(seiten.map { s -> BildZuPdf.seite({ FileInputStream(s.first) }, s.second, grau) })
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

    // ---- Einstellungen und Beitragslauf ----

    fun vereinSpeichern(form: VereinsForm, done: (String?) -> Unit) =
        hintergrund({ Vereinsdaten.speichern(store, form) }) { _, f -> done(f) }

    /** Erzeugt die SEPA-Datei und legt den Lauf in der Historie ab. */
    fun laufErzeugen(p: LaufParameter, posten: List<SepaItem>, done: (LaufErgebnis?, String?) -> Unit) {
        val g = glaeubiger
        if (g == null) { done(null, lastschriftFehlt ?: "Die Vereinsdaten sind unvollständig."); return }
        hintergrund({ Beitragslauf.erzeugen(store, p, posten, g) }, done)
    }

    /** Bucht den Lauf als Einnahmen auf das Konto (Konto 40000, ideeller Bereich). */
    fun laufVerbuchen(id: String, kontoId: String, done: (Verbucht?, String?) -> Unit) =
        hintergrund({ Beitragslauf.verbuchen(store, id, kontoId) }, done)

    /** Posten des Laufs, deren Mandat noch auf Erstlastschrift (FRST) steht. */
    fun erstlastschriften(l: Lauf): List<SepaItem> = Beitragslauf.erstlastschriften(store, l)

    fun aufFolgelastschrift(memberIds: List<String>, done: (Int?, String?) -> Unit) =
        hintergrund({ Beitragslauf.aufFolgelastschrift(store, memberIds) }, done)

    fun laufLoeschen(id: String, done: (String?) -> Unit) =
        hintergrund({ Beitragslauf.loeschen(store, id) }) { _, f -> done(f) }

    // ---- Spenden (Zuwendungsbestätigungen) ----

    /** Zeichnet eine Bestätigung als PDF; wird auch beim Ablegen im Dokumentenarchiv benutzt. */
    private val spendenPdf: SpendenPdf = { r, st -> java.io.ByteArrayOutputStream().also { PdfWriter.zuwendung(r, st, it, Unterschriften.lesen(store)) }.toByteArray() }

    fun spendeNeu(): SpendeForm = Spenden.neu(store)
    fun spendeFormular(r: DonationReceipt): SpendeForm = Spenden.von(r, Spenden.steuerangaben(store))
    fun spendePruefen(f: SpendeForm): String? = Spenden.pruefen(store, f)
    fun spendeBuchungBetroffen(f: SpendeForm): Boolean = Spenden.buchungBetroffen(store, f)
    fun spendeFehlendeAngaben(): List<String> = de.vereinsmanager.core.donation.DonationService.fehlendeSteuerangaben(Spenden.steuerangaben(store))

    fun spendeSpeichern(f: SpendeForm, opt: SpendeOptionen, done: (SpendeErgebnis?, String?) -> Unit) =
        hintergrund({ Spenden.speichern(store, dateien, f, opt, spendenPdf) }, done)

    fun unterschriftSpeichern(u: Unterschrift?, done: (String?) -> Unit) =
        hintergrund({ Unterschriften.speichern(store, u) }) { _, f -> done(f) }

    fun spendeLoeschen(id: String, buchungMit: Boolean, done: (String?) -> Unit) =
        hintergrund({ Spenden.loeschen(store, dateien, id, buchungMit) }) { _, f -> done(f) }

    /** Schreibt das PDF einer Bestätigung (frisch aus den gespeicherten Angaben gezeichnet). */
    fun spendePdfSchreiben(r: DonationReceipt, out: java.io.OutputStream) = PdfWriter.zuwendung(r, Spenden.steuerangaben(store), out, unterschrift)

    /** Schreibt eine ZIP-Datei mit den PDFs aller genannten Bestätigungen. */
    fun spendenZipSchreiben(liste: List<DonationReceipt>, out: java.io.OutputStream) {
        val st = Spenden.steuerangaben(store)
        val namen = DonationExport.pdfDateinamen(liste)
        val daten = liste.map { r -> java.io.ByteArrayOutputStream().also { PdfWriter.zuwendung(r, st, it, unterschrift) }.toByteArray() }
        out.write(SpendenZip.bauen(namen, daten))
    }

    // ---- Kontakte ----

    fun kontaktNeu(): KontaktForm = Kontakte.neu(store)
    fun kontaktFormular(k: Kontakt): KontaktForm = Kontakte.von(k)
    fun kontaktPruefen(f: KontaktForm): Map<String, String> = Kontakte.pruefen(store, f)
    fun kontaktSpeichern(f: KontaktForm, done: (Kontakt?, String?) -> Unit) = hintergrund({ Kontakte.speichern(store, f) }, done)
    fun kontaktLoeschen(id: String, done: (String?) -> Unit) = hintergrund({ Kontakte.loeschen(store, id) }) { _, e -> done(e) }
    fun kontakteLoeschen(ids: List<String>, done: (String?) -> Unit) = hintergrund({ Kontakte.sammelLoeschen(store, ids) }) { _, e -> done(e) }

    // ---- Kalender ----

    fun terminNeu(tag: java.time.LocalDate): TerminForm = Kalender.neu(tag, terminarten.firstOrNull { it.id == "cat-general" }?.id ?: terminarten.firstOrNull()?.id ?: "cat-general")
    fun terminFormular(t: Termin): TerminForm = TerminForm.von(t)
    fun terminPruefen(f: TerminForm): Map<String, String> = Kalender.pruefen(f)
    fun terminSpeichern(f: TerminForm, done: (Termin?, String?) -> Unit) = hintergrund({ Termin.from(Kalender.speichern(store, f)) }, done)
    fun terminLoeschen(id: String, done: (String?) -> Unit) = hintergrund({ Kalender.loeschen(store, id) }) { _, e -> done(e) }
    fun terminStatus(terminId: String, memberId: String, status: String, done: (String?) -> Unit) =
        hintergrund({ Kalender.teilnehmerStatus(store, terminId, memberId, status) }) { _, e -> done(e) }
    fun terminartSpeichern(id: String?, name: String, farbe: Int, beschreibung: String, done: (String?) -> Unit) =
        hintergrund({ Kalender.artSpeichern(store, id, name, farbe, beschreibung) }) { _, e -> done(e) }
    fun terminartNutzung(id: String): Int = Kalender.artNutzung(store, id)
    /** [done] bekommt die Zahl der Termine, die zu "Allgemeiner Termin" gewechselt sind, oder einen Fehlertext. */
    fun terminartLoeschen(id: String, done: (Int?, String?) -> Unit) = hintergrund({ Kalender.artLoeschen(store, id) }, done)
    /** Der Vereinsname aus den Einstellungen, leer wenn dort nichts steht (für Grußzeilen; [vereinsname] fällt auf "Verein" zurück). */
    fun vereinsnameOderLeer(): String = clubName.trim()

    // ---- Sitzungen ----

    enum class SitzungsPdf { EINLADUNG, PROTOKOLL, AUSZUG }

    fun sitzungNeu(art: String): SitzungForm = Sitzungen.neu(art, java.time.LocalDate.now())
    fun sitzungFormular(s: Sitzung): SitzungForm = SitzungForm.von(s)
    fun sitzungPruefen(f: SitzungForm): Map<String, String> = Sitzungen.pruefen(f)
    fun sitzungSpeichern(f: SitzungForm, done: (Sitzung?, String?) -> Unit) = hintergrund({ Sitzungen.speichern(store, f) }, done)
    fun sitzungLoeschen(id: String, done: (String?) -> Unit) = hintergrund({ Sitzungen.loeschen(store, id) }) { _, e -> done(e) }
    fun sitzungUnterschreiben(id: String, rolle: String, u: Unterschrift, done: (String?) -> Unit) =
        hintergrund({ Sitzungen.unterschreiben(store, id, rolle, u, unterschriftAlsPng(u)) }) { _, e -> done(e) }
    fun sitzungEntsperren(id: String, done: (String?) -> Unit) = hintergrund({ Sitzungen.unterschriftenEntfernen(store, id) }) { _, e -> done(e) }
    fun sitzungImArchiv(s: Sitzung): Boolean = Sitzungen.imArchiv(store, s)
    fun sitzungArchivieren(id: String, done: (Dokument?, String?) -> Unit) = hintergrund({
        val s = Sitzungen.sitzung(store, id) ?: throw IllegalStateException("Die Sitzung gibt es nicht mehr.")
        Sitzungen.archivieren(store, dateien, id, sitzungPdfBytes(s, SitzungsPdf.PROTOKOLL, true))
    }, done)

    /** Die Unterschrift als PNG-Data-URL (weißer Grund, schwarze Linien), damit auch der Desktop sie anzeigen kann. */
    private fun unterschriftAlsPng(u: Unterschrift): String {
        val b = 600
        val h = (b / u.seitenverhaeltnis).toInt().coerceIn(100, 1200)
        val bmp = android.graphics.Bitmap.createBitmap(b, h, android.graphics.Bitmap.Config.ARGB_8888)
        try {
            val c = android.graphics.Canvas(bmp)
            c.drawColor(android.graphics.Color.WHITE)
            val pinsel = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.BLACK; style = android.graphics.Paint.Style.STROKE; strokeWidth = 4f
                strokeCap = android.graphics.Paint.Cap.ROUND; strokeJoin = android.graphics.Paint.Join.ROUND
            }
            for (st in u.striche) {
                if (st.size < 2) continue
                val weg = android.graphics.Path()
                st.forEachIndexed { i, (x, y) -> if (i == 0) weg.moveTo((x * b).toFloat(), (y * h).toFloat()) else weg.lineTo((x * b).toFloat(), (y * h).toFloat()) }
                c.drawPath(weg, pinsel)
            }
            val out = ByteArrayOutputStream()
            bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
            return "data:image/png;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
        } finally { bmp.recycle() }
    }

    /** Einladung, Protokoll oder Registerauszug als PDF (mit dem gemeinsamen Briefpapier der Einstellungen, falls hinterlegt). Nicht im Hauptstrang aufrufen. */
    fun sitzungPdfBytes(s: Sitzung, art: SitzungsPdf, mitUnterschriften: Boolean): ByteArray {
        val v0 = Vorlagen.lesen(store)
        val verein = Vereinsdaten.lesen(store)
        val bp = v0.hatBriefpapier; val oben = v0.randOben.toDouble()
        val seiten = when (art) {
            SitzungsPdf.EINLADUNG -> SitzungsLayout.einladung(s, verein, PdfWriter.mass, bp, oben)
            SitzungsPdf.PROTOKOLL -> SitzungsLayout.protokoll(s, verein, PdfWriter.mass, mitUnterschriften, bp, oben)
            SitzungsPdf.AUSZUG -> SitzungsLayout.auszug(s, verein, PdfWriter.mass, mitUnterschriften, bp, oben)
        }
        val bild = briefpapierBild(v0)
        return try { ByteArrayOutputStream().also { PdfWriter.rechnung(seiten, bild, it) }.toByteArray() } finally { bild?.recycle() }
    }

    fun sitzungDateiname(s: Sitzung, art: SitzungsPdf): String =
        Sitzungen.dateiname(when (art) { SitzungsPdf.EINLADUNG -> "Einladung"; SitzungsPdf.PROTOKOLL -> "Protokoll"; SitzungsPdf.AUSZUG -> "Registerauszug" }, s)

    /** Schreibt das PDF einer Sitzung. Nicht im Hauptstrang aufrufen. */
    fun sitzungPdfSchreiben(id: String, art: SitzungsPdf, mitUnterschriften: Boolean, out: java.io.OutputStream) {
        val s = Sitzungen.sitzung(store, id) ?: throw IllegalStateException("Die Sitzung gibt es nicht mehr.")
        out.write(sitzungPdfBytes(s, art, mitUnterschriften))
    }

    /** Legt das PDF im Zwischenspeicher ab (Ordner „dokumente“, der für das Weitergeben freigegeben ist); [done] bekommt die Datei. */
    fun sitzungPdfDatei(id: String, art: SitzungsPdf, mitUnterschriften: Boolean, done: (File?, String?) -> Unit) = hintergrund({
        val s = Sitzungen.sitzung(store, id) ?: throw IllegalStateException("Die Sitzung gibt es nicht mehr.")
        val ordner = File(appContext.cacheDir, "dokumente").also { it.mkdirs() }
        File(ordner, sitzungDateiname(s, art)).also { it.writeBytes(sitzungPdfBytes(s, art, mitUnterschriften)) }
    }, done)

    /** Liest eine iCal-, CSV- oder Excel-Datei mit Terminen; [done] bekommt die gelesenen Termine (noch nicht gespeichert) oder einen Fehlertext. */
    fun kalenderDateiLesen(uri: Uri, done: (TerminLesung?, String?) -> Unit) = hintergrund({
        val bytes = liesBegrenzt(uri)
        val text = bytes.toString(Charsets.UTF_8)
        if (text.contains("BEGIN:VCALENDAR", ignoreCase = true)) Austausch.icsLesen(text, terminarten)
        else Austausch.csvLesen(de.vereinsmanager.core.importe.Tabellen.ausDatei(bytes).first, terminarten)
    }, done)

    fun kalenderImportieren(lesung: TerminLesung, done: (ImportBericht?, String?) -> Unit) = hintergrund({ Austausch.importieren(store, lesung) }, done)

    // ---- Inventar ----

    fun artikelNeu(): ArtikelForm = Inventar.neu(inventar)
    fun artikelFormular(a: Artikel): ArtikelForm = ArtikelForm.von(a)
    fun artikelPruefen(f: ArtikelForm): Map<String, String> = Inventar.pruefen(f, inventar)
    fun artikelSpeichern(f: ArtikelForm, done: (Artikel?, String?) -> Unit) = hintergrund({ Artikel.from(Inventar.speichern(store, f)) }, done)
    fun artikelGeprueft(id: String, done: (String?) -> Unit) = hintergrund({ Inventar.geprueft(store, id) }) { _, e -> done(e) }
    fun artikelLoeschen(ids: List<String>, done: (LoeschErgebnis?, String?) -> Unit) = hintergrund({ Inventar.loeschen(store, ids) }, done)
    fun artikelSammel(ids: List<String>, a: SammelAenderung, done: (Int?, String?) -> Unit) = hintergrund({ Inventar.sammelAendern(store, ids, a) }, done)

    private var artikelFotoDatei: File? = null

    /** Ziel für die Kamera-App beim Foto eines Gegenstands (eigene Datei im Zwischenspeicher, wird nach dem Umwandeln gelöscht). */
    fun artikelFotoZiel(): Uri {
        val f = File(cacheOrdner("fotos"), "gegenstand-${System.currentTimeMillis()}.jpg")
        artikelFotoDatei = f
        return FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", f)
    }

    /** Nach der Kamera: Foto verkleinern und als Data-URL liefern ([done] bekommt sie oder einen Fehlertext). */
    fun artikelFotoAufgenommen(ok: Boolean, done: (String?, String?) -> Unit) {
        val f = artikelFotoDatei
        artikelFotoDatei = null
        if (f == null) return
        if (!ok || f.length() == 0L) { f.delete(); return }
        artikelFotoUmwandeln({ f.inputStream() }, done) { f.delete() }
    }

    /** Foto aus der Galerie. */
    fun artikelFotoGewaehlt(uri: Uri, done: (String?, String?) -> Unit) =
        artikelFotoUmwandeln({ appContext.contentResolver.openInputStream(uri)!! }, done) { }

    private fun artikelFotoUmwandeln(oeffnen: () -> java.io.InputStream, done: (String?, String?) -> Unit, aufraeumen: () -> Unit) {
        busy = true
        thread {
            var r: String? = null
            var f: String? = null
            try { r = ArtikelFoto.zuDataUrl(oeffnen) } catch (e: Exception) { f = "Das Foto lässt sich nicht übernehmen: ${e.message ?: e::class.simpleName}" }
            aufraeumen()
            post { busy = false; done(r, f) }
        }
    }

    // ---- Rechnungen ----

    /** Das Briefpapier (Data-URL) als Bild; null, wenn keines hinterlegt oder nicht lesbar. */
    private fun briefpapierBild(v: Vorlage): android.graphics.Bitmap? {
        if (!v.hatBriefpapier) return null
        return try {
            val b64 = v.briefpapier.substringAfter("base64,", "")
            val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e: Exception) { null }
    }

    private fun rechnungsPdfBytes(r: Rechnung, a: Absender, v: Vorlage): ByteArray {
        val seiten = RechnungsLayout.bauen(r, a, v, PdfWriter.mass)
        val bild = briefpapierBild(v)
        return try {
            java.io.ByteArrayOutputStream().also { PdfWriter.rechnung(seiten, bild, it) }.toByteArray()
        } finally { bild?.recycle() }
    }

    private val rechnungsPdf: RechnungsPdf = { r, a, v -> rechnungsPdfBytes(r, a, v) }

    fun rechnungNeu(): RechnungForm = Rechnungen.neu(store)
    fun rechnungFormular(r: Rechnung): RechnungForm = Rechnungen.von(r)
    fun rechnungPruefen(f: RechnungForm): String? = Rechnungen.pruefen(store, f)
    fun rechnungBuchungBetroffen(f: RechnungForm): Boolean = Rechnungen.buchungBetroffen(store, f)
    fun rechnungKontakte(): List<Pair<String, String>> = Rechnungen.kontakte(store)
    fun rechnungKontakt(id: String) = store.get("contacts", id)

    fun rechnungSpeichern(f: RechnungForm, opt: RechnungOptionen, done: (RechnungErgebnis?, String?) -> Unit) =
        hintergrund({ Rechnungen.speichern(store, dateien, f, opt, rechnungsPdf) }, done)

    fun rechnungBezahlen(id: String, a: BezahltAngaben, done: (String?) -> Unit) =
        hintergrund({ Rechnungen.bezahlen(store, id, a) }) { _, f -> done(f) }

    fun rechnungZuruecksetzen(id: String, buchungMit: Boolean, done: (String?) -> Unit) =
        hintergrund({ Rechnungen.zuruecksetzen(store, dateien, id, buchungMit) }) { _, f -> done(f) }

    fun rechnungStornieren(id: String, done: (String?) -> Unit) =
        hintergrund({ Rechnungen.stornieren(store, id) }) { _, f -> done(f) }

    fun rechnungLoeschen(id: String, buchungMit: Boolean, done: (String?) -> Unit) =
        hintergrund({ Rechnungen.loeschen(store, dateien, id, buchungMit) }) { _, f -> done(f) }

    /** Schreibt das PDF einer Rechnung frisch aus den gespeicherten Angaben. */
    fun rechnungPdfSchreiben(r: Rechnung, out: java.io.OutputStream) {
        out.write(rechnungsPdfBytes(r, Absender.lesen(store.get("settings", "main")), vorlage))
    }

    /**
     * Das PDF eines Eintrags zum Ansehen: das im Dokumentenarchiv abgelegte, sonst frisch aus den Angaben erzeugt (im Zwischenspeicher,
     * nichts wird abgelegt). [art] "rechnung" oder "spende"; weitere Arten kommen hier dazu. Nicht im Hauptstrang aufrufen.
     */
    fun vorschauDatei(art: String, id: String): BelegDatei? {
        val doc = when (art) {
            "rechnung" -> store.get("invoices", id)?.toRechnung()?.dokumentId
            "spende" -> Spenden.alle(store).firstOrNull { it.id == id }?.documentId
            else -> null
        }
        if (doc != null) dokumentDatei(doc)?.let { return it }
        val bytes: ByteArray
        val name: String
        when (art) {
            "rechnung" -> {
                val r = store.get("invoices", id)?.toRechnung() ?: return null
                bytes = rechnungsPdfBytes(r, Absender.lesen(store.get("settings", "main")), Vorlagen.lesen(store))
                name = RechnungsExport.pdfDateiname(r)
            }
            "spende" -> {
                val r = Spenden.alle(store).firstOrNull { it.id == id } ?: return null
                bytes = java.io.ByteArrayOutputStream().also { PdfWriter.zuwendung(r, Spenden.steuerangaben(store), it, Unterschriften.lesen(store)) }.toByteArray()
                name = DonationExport.pdfDateinamen(listOf(r)).first()
            }
            else -> return null
        }
        val ordner = cacheOrdner("vorschau")
        val ziel = File(ordner, "$art-$id.pdf")
        ziel.writeBytes(bytes)
        ordner.listFiles()?.filter { it != ziel }?.forEach { it.delete() }
        return BelegDatei(ziel, "application/pdf", name)
    }

    fun vorlageSpeichern(v: Vorlage, done: (String?) -> Unit) =
        hintergrund({ Vorlagen.speichern(store, v) }) { _, f -> done(f) }

    /** Beispiel-PDF mit dem (noch nicht gespeicherten) Entwurf der Vorlage. */
    fun vorlagePdfSchreiben(v: Vorlage, out: java.io.OutputStream) {
        out.write(rechnungsPdfBytes(RechnungsExport.beispiel(vorlage = v), Absender.lesen(store.get("settings", "main")), v))
    }

    /**
     * Liest ein gewähltes Bild als Briefpapier: verkleinert auf höchstens 1240 x 1754 Punkte (A4 bei 150 dpi), legt es auf weißen
     * Grund und gibt es als JPEG-Data-URL zurück. [done] bekommt die Data-URL oder den Fehlertext.
     */
    /** Die erste Seite einer PDF als JPEG-Data-URL (A4, 150 dpi), damit auch ein PDF-Briefbogen als Briefpapier dient. */
    private fun pdfAlsBriefpapier(uri: Uri): String {
        val tmp = File(appContext.cacheDir, "briefpapier.pdf")
        try {
            tmp.writeBytes(liesBegrenzt(uri))
            val b = android.os.ParcelFileDescriptor.open(tmp, android.os.ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                android.graphics.pdf.PdfRenderer(pfd).use { r ->
                    r.openPage(0).use { seite ->
                        val bild = android.graphics.Bitmap.createBitmap(1240, 1754, android.graphics.Bitmap.Config.ARGB_8888)
                        bild.eraseColor(android.graphics.Color.WHITE)
                        seite.render(bild, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                        bild
                    }
                }
            }
            val bytes = java.io.ByteArrayOutputStream().also { b.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, it) }.toByteArray()
            b.recycle()
            return "data:image/jpeg;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        } catch (e: Exception) {
            throw IllegalArgumentException("Die PDF konnte nicht gelesen werden.")
        } finally { tmp.delete() }
    }

    /** Briefpapier aus einem Bild (PNG/JPEG) oder einer PDF (erste Seite). Gilt für Rechnungen und Anträge. */
    fun briefpapierLaden(uri: Uri, done: (String?, String?) -> Unit) = hintergrund({
        val cr = appContext.contentResolver
        if (cr.getType(uri) == "application/pdf") return@hintergrund pdfAlsBriefpapier(uri)
        val grenzen = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        cr.openInputStream(uri)!!.use { android.graphics.BitmapFactory.decodeStream(it, null, grenzen) }
        if (grenzen.outWidth <= 0 || grenzen.outHeight <= 0) throw IllegalArgumentException("Das ist kein Bild, das gelesen werden kann (PNG oder JPEG).")
        var probe = 1
        while (grenzen.outWidth / (probe * 2) >= 1240 && grenzen.outHeight / (probe * 2) >= 1754) probe *= 2
        val opt = android.graphics.BitmapFactory.Options().apply { inSampleSize = probe }
        val roh = cr.openInputStream(uri)!!.use { android.graphics.BitmapFactory.decodeStream(it, null, opt) }
            ?: throw IllegalArgumentException("Das Bild konnte nicht gelesen werden.")
        val faktor = minOf(1.0, 1240.0 / roh.width, 1754.0 / roh.height)
        val b = android.graphics.Bitmap.createBitmap(maxOf(1, (roh.width * faktor).toInt()), maxOf(1, (roh.height * faktor).toInt()), android.graphics.Bitmap.Config.ARGB_8888)
        val c = android.graphics.Canvas(b)
        c.drawColor(android.graphics.Color.WHITE)
        c.drawBitmap(roh, null, android.graphics.Rect(0, 0, b.width, b.height), android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG))
        val bytes = java.io.ByteArrayOutputStream().also { b.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, it) }.toByteArray()
        if (roh !== b) roh.recycle(); b.recycle()
        "data:image/jpeg;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
    }, done)

    // ---- Konten ----

    fun kontoSpeichern(form: KontoForm, done: (String?) -> Unit) =
        hintergrund({ KontoStore.speichern(store, form) }) { _, f -> done(f) }

    /** Löscht das Konto; hängen Buchungen daran, gehen sie vorher auf [ziel] über. */
    fun kontoLoeschen(id: String, ziel: String?, done: (String?) -> Unit) =
        hintergrund({ KontoStore.loeschen(store, id, ziel) }) { _, f -> done(f) }

    fun kontoSchieben(id: String, schritt: Int) {
        if (KontoStore.schieben(store, id, schritt)) reload()
    }

    // ---- Dokumente ----

    private val prefs get() = appContext.getSharedPreferences("vereinsmanager", Context.MODE_PRIVATE)

    /** Legt beim ersten Öffnen der Dokumente die Standard-Ordner an (dieselben wie am Desktop); danach nie wieder von selbst. */
    fun standardOrdnerSicherstellen() {
        if (prefs.getBoolean("standardOrdner", false)) return
        thread {
            try {
                StandardOrdner.anlegenFehlende(store)
                prefs.edit().putBoolean("standardOrdner", true).apply()
                post { reload() }
            } catch (e: Exception) { /* beim nächsten Öffnen noch einmal */ }
        }
    }

    /** Eine gewählte, noch nicht abgelegte Datei samt Name und Typ. */
    class DokEntwurf(val bytes: ByteArray, val name: String, val mime: String)

    var dokEntwurf by mutableStateOf<DokEntwurf?>(null)

    private fun anzeigeName(uri: Uri): String? = try {
        appContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    } catch (e: Exception) { null }

    // ---- Mitgliedsanträge (am Gerät ausgefüllt) ----

    /** Der ausgefüllte, unterschriebene Antrag, der auf die Prüfung durch den Verein wartet. Nur im Arbeitsspeicher. */
    var antragWartet by mutableStateOf<Antrag?>(null)

    fun antragEinstellungen(): AntragEinstellungen = AntragEinstellungenStore.lesen(store)

    fun antragEinstellungenSpeichern(e: AntragEinstellungen, done: (String?) -> Unit) {
        val f = AntragEinstellungenStore.pruefen(e)
        if (f.isNotEmpty()) { done(f.values.first()); return }
        hintergrund({ AntragEinstellungenStore.speichern(store, e) }) { _, fehler -> done(fehler) }
    }

    /** Baut das PDF zu einem Antrag; a == null ergibt das leere Formular zum Ausdrucken. */
    private fun antragPdfBytes(a: Antrag?, nummer: String): ByteArray {
        val v0 = Vorlagen.lesen(store)
        val seiten = AntragLayout.bauen(
            a, Vereinsdaten.lesen(store), AntragEinstellungenStore.lesen(store), nummer, java.time.LocalDate.now(), PdfWriter.mass,
            briefpapier = v0.hatBriefpapier, randOben = v0.randOben.toDouble(),
        )
        val bild = briefpapierBild(v0)
        return try {
            ByteArrayOutputStream().also { PdfWriter.rechnung(seiten, bild, it) }.toByteArray()
        } finally { bild?.recycle() }
    }

    /** Schreibt das leere Antragsformular (mit dem Briefpapier der Einstellungen, falls vorhanden). Nicht im Hauptstrang aufrufen. */
    fun antragLeerSchreiben(out: java.io.OutputStream) {
        out.write(antragPdfBytes(null, ""))
    }

    /** Nimmt den wartenden Antrag als Mitglied auf (Mitglied und PDF zusammen oder gar nicht). [done] bekommt das Ergebnis oder den Fehlertext. */
    fun antragAufnehmen(a: Antrag, nummer: String, done: (AufnahmeErgebnis?, String?) -> Unit) {
        hintergrund({
            val e = AntragEinstellungenStore.lesen(store)
            val pdf = antragPdfBytes(a, nummer)
            Aufnahme.aufnehmen(
                store, dateien, a, nummer, e.beitrag(a.mitgliedsart), pdf,
                departments.ifEmpty { listOf("Hauptverein") }, java.time.LocalDate.now(),
            )
        }) { r, fehler -> if (r != null) antragWartet = null; done(r, fehler) }
    }

    private fun <T> hintergrund(arbeit: () -> T, done: (T?, String?) -> Unit) {
        busy = true
        thread {
            var r: T? = null
            var f: String? = null
            try { r = arbeit() } catch (e: Exception) { f = e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(r, f) }
        }
    }

    /** Liest eine gewählte Datei (beliebiger Typ, höchstens 25 MB) in den Entwurf; [done] bekommt null oder den Fehlertext. */
    fun dokumentDateiWaehlen(uri: Uri, done: (String?) -> Unit) {
        busy = true
        thread {
            var entwurf: DokEntwurf? = null
            var fehler: String? = null
            try {
                val bytes = liesBegrenzt(uri)
                if (bytes.isEmpty()) throw BelegException("Die Datei ist leer.")
                if (bytes.size > DokumentStore.MAX_GROESSE) {
                    throw BelegException("Die Datei ist zu groß (${bytes.size / 1024 / 1024} MB). Erlaubt sind höchstens ${DokumentStore.MAX_GROESSE / 1024 / 1024} MB.")
                }
                val mime = appContext.contentResolver.getType(uri)?.takeIf { it.isNotBlank() }
                    ?: Dateityp.erkennen(bytes.copyOf(minOf(bytes.size, 16)))?.let { Dateityp.mimeZu(it) }
                    ?: "application/octet-stream"
                entwurf = DokEntwurf(bytes, anzeigeName(uri) ?: "Dokument", mime)
            } catch (e: Exception) {
                fehler = e.message ?: e::class.simpleName
            }
            post { if (entwurf != null) dokEntwurf = entwurf; busy = false; done(fehler) }
        }
    }

    /** Macht aus den aufgenommenen Fotoseiten eine PDF und legt sie als Entwurf bereit. */
    fun dokumentAusFotos(done: (String?) -> Unit) {
        val seiten = fotoSeiten.toList().map { it.datei to it.edit }
        val grau = fotoGrau
        busy = true
        thread {
            var entwurf: DokEntwurf? = null
            var fehler: String? = null
            try {
                val bytes = FotoPdf.erzeugen(seiten.map { s -> BildZuPdf.seite({ FileInputStream(s.first) }, s.second, grau) })
                entwurf = DokEntwurf(bytes, "Scan " + SimpleDateFormat("yyyy-MM-dd HH.mm", Locale.ROOT).format(Date()) + ".pdf", "application/pdf")
            } catch (e: Exception) {
                fehler = e.message ?: e::class.simpleName
            }
            post {
                busy = false
                if (entwurf != null) { dokEntwurf = entwurf; fotosVerwerfen() }
                done(fehler)
            }
        }
    }

    fun dokumentSpeichern(form: DokumentForm, done: (String?) -> Unit) {
        val e = dokEntwurf
        if (e == null) { done("Keine Datei gewählt."); return }
        hintergrund({ DokumentStore.neu(store, dateien, e.bytes, e.name, e.mime, form) }) { r, f ->
            if (r != null) dokEntwurf = null
            done(f)
        }
    }

    fun dokumentAendern(form: DokumentForm, done: (String?) -> Unit) =
        hintergrund({ DokumentStore.aendern(store, form) }) { _, f -> done(f) }

    fun dokumenteVerschieben(ids: List<String>, ordnerId: String?, kategorie: String?, done: (Int?, String?) -> Unit) =
        hintergrund({ DokumentStore.verschieben(store, ids, ordnerId, kategorie) }, done)

    fun dokumenteLoeschen(ids: List<String>, done: (LoeschBericht?, String?) -> Unit) =
        hintergrund({ DokumentStore.loeschen(store, dateien, ids) }, done)

    fun ordnerSpeichern(form: OrdnerForm, done: (String?) -> Unit) =
        hintergrund({ DokumentStore.ordnerSpeichern(store, form) }) { _, f -> done(f) }

    fun ordnerLoeschen(id: String, done: (String?) -> Unit) =
        hintergrund({ DokumentStore.ordnerLoeschen(store, id) }) { _, f -> done(f) }

    /** Die Datei eines Dokuments im Zwischenspeicher (zum Anzeigen oder Weitergeben). Nicht im Hauptstrang aufrufen. */
    fun dokumentDatei(docId: String): BelegDatei? {
        val d = store.get("documents", docId)?.let { Dokument.from(it) } ?: return null
        val id = d.dateiId ?: return null
        val kopf = dateien.open(id)?.use { s -> ByteArray(16).let { k -> k.copyOf(maxOf(s.read(k), 0)) } } ?: return null
        val endung = d.dateiName.substringAfterLast('.', "").lowercase().filter { it.isLetterOrDigit() }.take(8)
            .ifEmpty { Dateityp.erkennen(kopf) ?: "bin" }
        val ordnerCache = cacheOrdner("dokumente")
        val ziel = File(ordnerCache, "$id.$endung")
        if (!ziel.isFile || ziel.length() != dateien.size(id)) {
            dateien.open(id)?.use { i -> ziel.outputStream().use { o -> i.copyTo(o) } } ?: return null
        }
        ordnerCache.listFiles()?.filter { it != ziel }?.forEach { it.delete() }
        val mime = d.dateiTyp.takeIf { it.isNotBlank() }
            ?: Dateityp.erkennen(kopf)?.let { Dateityp.mimeZu(it) }
            ?: java.net.URLConnection.guessContentTypeFromName(d.dateiName)
            ?: "application/octet-stream"
        return BelegDatei(ziel, mime, d.dateiName)
    }

    /** Schreibt die Datei des Dokuments in die gewählte Zieldatei („Speichern unter …"). */
    fun dokumentSpeichernUnter(docId: String, uri: Uri, done: (String) -> Unit) {
        val fileId = store.get("documents", docId)?.let { Dokument.from(it).dateiId }
        if (fileId == null) { done("Das Dokument hat keine Datei."); return }
        exportiere(uri, { out -> (dateien.open(fileId) ?: throw IllegalStateException("Die Datei fehlt.")).use { it.copyTo(out) } }, "Datei gespeichert.", done)
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
                // Gelöschte Dokumente lassen ihre Dateien zurück; die räumen wir hier weg.
                if (docs == DocumentChoice.DELETE) Dateiverwaltung.aufraeumen(store, dateien)
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
        try { MemberMaterial.speichern(store, memberId, form); stand += 1; inventarAusgegeben = Inventar.ausgegeben(store); null } catch (e: Exception) { e.message ?: e::class.simpleName }

    fun ausgabeUmschalten(id: String): String? =
        try { MemberMaterial.umschalten(store, id); stand += 1; inventarAusgegeben = Inventar.ausgegeben(store); null } catch (e: Exception) { e.message ?: e::class.simpleName }

    fun ausgabeEntfernen(id: String): String? =
        try { MemberMaterial.entfernen(store, id); stand += 1; inventarAusgegeben = Inventar.ausgegeben(store); null } catch (e: Exception) { e.message ?: e::class.simpleName }

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

    // ---- Importe (Buchungen, Kontakte) ----

    /** Liest eine Excel- oder CSV-Datei als Tabelle; zweiter Wert: Hinweis für die Anzeige (leer, wenn keiner nötig ist). */
    fun loadTabelle(uri: Uri): Pair<CsvTable, String> {
        val bytes = appContext.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
        return de.vereinsmanager.core.importe.Tabellen.ausDatei(bytes)
    }

    /** Eingefügter Text (aus Excel/Google Sheets: Tabulator-getrennt, aus CSV: Semikolon oder Komma). */
    fun tabelleAusText(text: String): CsvTable = MemberCsv.parse(text)

    /** Schreibt Text (UTF-8 mit Kennzeichen, damit Excel Umlaute richtig liest), z. B. eine Muster-Vorlage. */
    fun writeText(uri: Uri, text: String): String = try {
        appContext.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(("\uFEFF" + text).toByteArray(Charsets.UTF_8)) }
        "Muster-Vorlage gespeichert."
    } catch (e: Exception) { "Fehler: ${e.message ?: e::class.simpleName}" }

    fun importBuchungen(
        zeilen: List<de.vereinsmanager.core.importe.BuchungsZeile>, quelle: de.vereinsmanager.core.importe.ImportQuelle,
        done: (de.vereinsmanager.core.importe.BuchungImportBericht?, String?) -> Unit,
    ) {
        busy = true
        thread {
            var bericht: de.vereinsmanager.core.importe.BuchungImportBericht? = null
            val fehler = try { bericht = de.vereinsmanager.core.importe.BuchungImport.importieren(store, zeilen, quelle); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(bericht, fehler) }
        }
    }

    fun importKontakte(
        zeilen: List<de.vereinsmanager.core.importe.KontaktZeile>,
        done: (de.vereinsmanager.core.importe.KontaktImportBericht?, String?) -> Unit,
    ) {
        busy = true
        thread {
            var bericht: de.vereinsmanager.core.importe.KontaktImportBericht? = null
            val fehler = try { bericht = de.vereinsmanager.core.importe.KontaktImport.importieren(store, zeilen); null } catch (e: Exception) { e.message ?: e::class.simpleName }
            post { reload(); busy = false; done(bericht, fehler) }
        }
    }

    fun suggestedFileName(paket: Boolean): String {
        val club = clubName.ifEmpty { "Verein" }.replace(Regex("[^A-Za-z0-9äöüÄÖÜß_-]+"), "_")
        return "VereinsManager_Sicherung_${club}_${SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())}.${if (paket) "zip" else "json"}"
    }
}
