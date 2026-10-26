package de.vereinsmanager.android

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.vereinsmanager.android.data.SqliteDocumentStore
import de.vereinsmanager.core.backup.BackupCrypto
import de.vereinsmanager.core.backup.BackupExporter
import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.members.BulkEdit
import de.vereinsmanager.core.members.CsvImportReport
import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.DuplicateStrategy
import de.vereinsmanager.core.members.ImportRow
import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.AusgabeForm
import de.vereinsmanager.core.finance.Buchung
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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.io.File
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

class AppModel(private val appContext: Context) {
    val store = SqliteDocumentStore(appContext)
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
        private set
    var message by mutableStateOf("")
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
        val settings = store.get("settings", "main")
        clubName = (settings?.get("clubName") as? JsonPrimitive)?.contentOrNull ?: ""
        departments = (settings?.get("departments") as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()
    }

    fun isEncrypted(uri: Uri): Boolean = BackupFile.isEncrypted(readText(uri))

    private fun readText(uri: Uri): String =
        appContext.contentResolver.openInputStream(uri)!!.use { it.readBytes() }.toString(Charsets.UTF_8)

    /** Legt vor dem Einspielen eine Kopie des bisherigen Bestands im geschützten App-Ordner ab (die letzten drei bleiben). */
    private fun sicherheitskopie(): String? {
        if (store.count("members") + store.count("transactions") + store.count("settings") == 0) return null
        return try {
            val dir = File(appContext.filesDir, "sicherheitskopien").apply { mkdirs() }
            val stamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.ROOT).format(Date())
            val f = File(dir, "vor_import_$stamp.json")
            f.writeText(BackupExporter.export(store).toJsonText(), Charsets.UTF_8)
            dir.listFiles()?.sortedBy { it.name }?.dropLast(3)?.forEach { it.delete() }
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
                val raw = readText(uri)
                val plain = if (BackupFile.isEncrypted(raw)) BackupCrypto.decrypt(raw, password) else raw
                val file = BackupFile.parse(plain)
                val kopie = sicherheitskopie()
                val report = BackupImporter.import(file, store, mode)
                val art = if (mode == ImportMode.REPLACE) "ersetzt" else "ergänzt"
                buildString {
                    append("Bestand $art. ")
                    append(report.inFile.entries.filter { it.value > 0 }.joinToString(", ") { "${BEREICHE[it.key] ?: it.key}: ${it.value}" })
                    append(if (kopie != null) "\nSicherheitskopie des vorherigen Bestands: $kopie" else "\nKeine Sicherheitskopie nötig (Bestand war leer) oder sie ließ sich nicht anlegen.")
                    if (!report.ok) append("\nNICHT alles gespeichert: " + report.failed.joinToString("; "))
                }
            } catch (e: Exception) {
                "Fehler: ${e.message ?: e::class.simpleName}"
            }
            post { reload(); message = text; busy = false }
        }
    }

    fun exportBackup(uri: Uri, password: String) {
        busy = true
        message = "Sicherung wird geschrieben …"
        thread {
            val text = try {
                val plain = BackupExporter.export(store).toJsonText()
                val out = if (password.isNotEmpty()) BackupCrypto.encrypt(plain, password) else plain
                appContext.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(out.toByteArray(Charsets.UTF_8)) }
                "Sicherung geschrieben (${if (password.isNotEmpty()) "verschlüsselt" else "unverschlüsselt"})."
            } catch (e: Exception) {
                "Fehler: ${e.message ?: e::class.simpleName}"
            }
            post { message = text; busy = false }
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

    fun suggestedFileName(): String {
        val club = clubName.ifEmpty { "Verein" }.replace(Regex("[^A-Za-z0-9äöüÄÖÜß_-]+"), "_")
        return "VereinsManager_Sicherung_${club}_${SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())}.json"
    }
}
