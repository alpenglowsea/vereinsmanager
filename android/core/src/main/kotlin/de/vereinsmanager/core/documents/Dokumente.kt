package de.vereinsmanager.core.documents

import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.Dateiverwaltung
import de.vereinsmanager.core.backup.text
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import java.time.LocalDate
import java.time.ZonedDateTime

/** Die sieben Kategorien der Dokumente (wie am Desktop). */
object Kategorie {
    val ALLE: List<String> = listOf("belege", "vertraege", "satzung", "protokolle", "mitglieder", "bescheide", "sonstiges")
    private val TITEL = mapOf(
        "belege" to "Buchhaltungsbelege", "vertraege" to "Verträge & Vereinbarungen", "satzung" to "Satzung & Ordnungen",
        "protokolle" to "Protokolle & Versammlungen", "mitglieder" to "Mitglieder & Anträge", "bescheide" to "Finanzamt & Bescheide",
        "sonstiges" to "Sonstige Dokumente",
    )
    fun titel(id: String): String = TITEL[id] ?: id
}

data class Ordner(val id: String, val name: String, val parentId: String?, val kategorie: String, val farbe: String, val beschreibung: String) {
    companion object {
        fun from(o: JsonObject) = Ordner(
            id = o.text("id").orEmpty(), name = o.text("name").orEmpty(),
            parentId = o.text("parentId")?.takeIf { it.isNotEmpty() },
            kategorie = o.text("category").orEmpty(), farbe = o.text("color").orEmpty(), beschreibung = o.text("description").orEmpty(),
        )
    }
}

data class Dokument(
    val id: String, val titel: String, val dateiName: String, val dateiTyp: String, val groesse: Long, val dateiId: String?,
    val kategorie: String, val ordnerId: String?, val datum: String, val tags: List<String>, val notiz: String,
    val buchungId: String, val buchungNummer: String, val mitgliedId: String, val mitgliedName: String,
    val istBeleg: Boolean, val hochgeladen: String,
    /** Datei liegt im Jahresarchiv (R4c); dann ist [dateiId] null. */
    val archiv: de.vereinsmanager.core.backup.ArchivVermerk? = null,
) {
    companion object {
        fun from(o: JsonObject) = Dokument(
            id = o.text("id").orEmpty(), titel = o.text("title").orEmpty(), dateiName = o.text("fileName").orEmpty(),
            dateiTyp = o.text("fileType").orEmpty(), groesse = (o["fileSize"] as? JsonPrimitive)?.longOrNull ?: 0L,
            dateiId = o.text("fileId")?.takeIf { it.isNotEmpty() },
            kategorie = o.text("category").orEmpty().ifEmpty { "sonstiges" },
            ordnerId = o.text("folderId")?.takeIf { it.isNotEmpty() }, datum = o.text("date").orEmpty(),
            tags = (o["tags"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList(),
            notiz = o.text("notes").orEmpty(), buchungId = o.text("transactionId").orEmpty(),
            buchungNummer = o.text("transactionDocNumber").orEmpty(), mitgliedId = o.text("memberId").orEmpty(),
            mitgliedName = o.text("memberName").orEmpty(),
            istBeleg = (o["isReceipt"] as? JsonPrimitive)?.booleanOrNull ?: false, hochgeladen = o.text("uploadDate").orEmpty(),
            archiv = de.vereinsmanager.core.backup.ArchivVermerk.aus(o["archiv"]),
        )
    }
}

enum class DateiFormat(val titel: String) { ALLE("Alle Formate"), PDF("PDF"), BILDER("Bilder"), OFFICE("Office"), TEXT("Text") }

enum class DokSortierung(val titel: String) {
    DATUM_NEU("Datum, neueste zuerst"), DATUM_ALT("Datum, älteste zuerst"), TITEL("Titel A–Z"), GROESSE("Größe, größte zuerst")
}

data class DokFilter(
    val text: String = "", val format: DateiFormat = DateiFormat.ALLE, val jahr: String? = null,
    val sortierung: DokSortierung = DokSortierung.DATUM_NEU,
) {
    /** Suche oder Filter gesetzt (die Sortierung zählt nicht). */
    val aktiv get() = text.isNotBlank() || format != DateiFormat.ALLE || jahr != null
}

object Dokumente {
    const val DOKUMENTE = "documents"
    const val ORDNER = "folders"
    private const val BUCHUNGEN = "transactions"

    fun dokumente(store: DocumentStore): List<Dokument> = store.all(DOKUMENTE).map(Dokument::from)
    fun ordner(store: DocumentStore): List<Ordner> = store.all(ORDNER).map(Ordner::from)

    private val NAME = Comparator<Ordner> { a, b -> a.name.compareTo(b.name, ignoreCase = true) }

    /** Die Ordner direkt unter [elternId] (null: oberste Ebene), nach Namen sortiert. Ordner mit unbekanntem Eltern-Ordner zählen als oberste. */
    fun unterordner(alle: List<Ordner>, elternId: String?): List<Ordner> {
        val ids = alle.map { it.id }.toSet()
        return alle.filter { o -> if (elternId == null) o.parentId == null || o.parentId !in ids else o.parentId == elternId }.sortedWith(NAME)
    }

    /** Der Ordner selbst und alles darunter. */
    fun nachfahren(alle: List<Ordner>, id: String): Set<String> {
        val menge = HashSet<String>()
        menge.add(id)
        var neu = true
        while (neu) {
            neu = false
            for (o in alle) if (o.parentId != null && o.parentId in menge && menge.add(o.id)) neu = true
        }
        return menge
    }

    /** Vom obersten Ordner bis zu [id]; bei einem Kreis oder fehlendem Ordner endet die Liste dort. */
    fun pfad(alle: List<Ordner>, id: String?): List<Ordner> {
        val aus = ArrayList<Ordner>()
        var aktuell = id
        val gesehen = HashSet<String>()
        while (aktuell != null && gesehen.add(aktuell)) {
            val o = alle.firstOrNull { it.id == aktuell } ?: break
            aus.add(0, o)
            aktuell = o.parentId
        }
        return aus
    }

    fun pfadText(alle: List<Ordner>, id: String?): String = pfad(alle, id).joinToString(" › ") { it.name }

    /** Dokumente in [id] und allen Unterordnern. */
    fun anzahl(dokumente: List<Dokument>, alle: List<Ordner>, id: String): Int {
        val ids = nachfahren(alle, id)
        return dokumente.count { it.ordnerId != null && it.ordnerId in ids }
    }

    /** Die Dokumente genau in diesem Ordner (null: ohne Ordner oder mit unbekanntem Ordner). */
    fun direkt(dokumente: List<Dokument>, alle: List<Ordner>, ordnerId: String?): List<Dokument> {
        val ids = alle.map { it.id }.toSet()
        return dokumente.filter { d -> if (ordnerId == null) d.ordnerId == null || d.ordnerId !in ids else d.ordnerId == ordnerId }
    }

    fun jahre(dokumente: List<Dokument>): List<String> =
        dokumente.mapNotNull { it.datum.take(4).takeIf { j -> j.length == 4 && j.all(Char::isDigit) } }.toSet().sortedDescending()

    private val BILD = Regex("""\.(png|jpe?g|webp|gif|svg)$""")
    private val OFFICE = Regex("""\.(docx?|xlsx?|pptx?|odt|ods)$""")
    private val TEXT = Regex("""\.(txt|csv|log|md)$""")

    private fun passt(d: Dokument, f: DateiFormat): Boolean {
        val typ = d.dateiTyp.lowercase()
        val name = d.dateiName.lowercase()
        return when (f) {
            DateiFormat.ALLE -> true
            DateiFormat.PDF -> typ.contains("pdf") || name.endsWith(".pdf")
            DateiFormat.BILDER -> typ.startsWith("image/") || BILD.containsMatchIn(name)
            DateiFormat.OFFICE -> OFFICE.containsMatchIn(name) || typ.contains("officedocument") || typ.contains("excel") || typ.contains("msword")
            DateiFormat.TEXT -> typ.contains("text") || typ.contains("csv") || TEXT.containsMatchIn(name)
        }
    }

    /**
     * Die Dokumente für Suche und Filter, in [ordnerId] und allen Unterordnern (null: überall). Die Suche prüft Titel, Dateiname,
     * Notiz, Schlagworte, Mitglied und Belegnummer.
     */
    fun suchen(dokumente: List<Dokument>, alle: List<Ordner>, ordnerId: String?, f: DokFilter): List<Dokument> {
        val ids = ordnerId?.let { nachfahren(alle, it) }
        val q = f.text.trim().lowercase()
        val treffer = dokumente.filter { d ->
            (ids == null || (d.ordnerId != null && d.ordnerId in ids)) &&
                passt(d, f.format) &&
                (f.jahr == null || d.datum.startsWith(f.jahr)) &&
                (q.isEmpty() || listOf(d.titel, d.dateiName, d.notiz, d.mitgliedName, d.buchungNummer).any { it.lowercase().contains(q) } ||
                    d.tags.any { it.lowercase().contains(q) })
        }
        return when (f.sortierung) {
            DokSortierung.DATUM_NEU -> treffer.sortedByDescending { it.datum }
            DokSortierung.DATUM_ALT -> treffer.sortedBy { it.datum }
            DokSortierung.TITEL -> treffer.sortedWith { a, b -> a.titel.compareTo(b.titel, ignoreCase = true) }
            DokSortierung.GROESSE -> treffer.sortedByDescending { it.groesse }
        }
    }
}

class DokumentException(message: String) : Exception(message)

/** Angaben, die der Anwender zu einem Dokument macht. Die Datei selbst kommt getrennt. */
data class DokumentForm(
    val id: String, val titel: String = "", val kategorie: String = "sonstiges", val ordnerId: String = "", val datum: String = "",
    val tags: String = "", val notiz: String = "", val mitgliedId: String = "", val mitgliedName: String = "",
    val buchungId: String = "", val buchungNummer: String = "",
) {
    companion object {
        fun von(d: Dokument) = DokumentForm(
            d.id, d.titel, d.kategorie, d.ordnerId.orEmpty(), d.datum, d.tags.joinToString(", "), d.notiz,
            d.mitgliedId, d.mitgliedName, d.buchungId, d.buchungNummer,
        )
    }
}

data class OrdnerForm(
    val id: String, val name: String = "", val parentId: String = "", val kategorie: String = "", val farbe: String = "#3b82f6",
    val beschreibung: String = "",
) {
    companion object {
        fun von(o: Ordner) = OrdnerForm(o.id, o.name, o.parentId.orEmpty(), o.kategorie, o.farbe.ifEmpty { "#3b82f6" }, o.beschreibung)
    }
}

data class LoeschBericht(val geloescht: Int, val buchungenBetroffen: Int)

object DokumentStore {
    /** Größte Datei, die als Dokument angenommen wird. */
    const val MAX_GROESSE = 25L * 1024 * 1024

    val ORDNER_FARBEN = listOf("#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#64748b")

    private const val BUCHUNGEN = "transactions"
    private fun s(v: String) = JsonPrimitive(v)

    fun neueId(): String = "doc-" + System.currentTimeMillis() + "-" + Zeit.zufall()
    fun neueOrdnerId(): String = "folder-" + System.currentTimeMillis() + "-" + Zeit.zufall()

    fun pruefen(f: DokumentForm): String? {
        if (f.titel.isBlank()) return "Bitte einen Titel eingeben."
        if (f.kategorie !in Kategorie.ALLE) return "Bitte eine Kategorie wählen."
        if (f.datum.isNotBlank()) {
            try { LocalDate.parse(f.datum.trim()) } catch (e: Exception) { return "Das Datum ist ungültig." }
        }
        return null
    }

    fun tagListe(text: String): List<String> = text.split(',', ';').map { it.trim() }.filter { it.isNotEmpty() }.distinct()

    /** Setzt oder entfernt ein Textfeld: leer heißt weglassen. */
    private fun setze(m: MutableMap<String, JsonElement>, key: String, v: String) {
        if (v.isEmpty()) m.remove(key) else m[key] = s(v)
    }

    private fun anwenden(m: MutableMap<String, JsonElement>, f: DokumentForm) {
        m["title"] = s(f.titel.trim())
        m["category"] = s(f.kategorie)
        m["isReceipt"] = JsonPrimitive(f.kategorie == "belege")
        setze(m, "folderId", f.ordnerId)
        m["date"] = s(f.datum.trim())
        m["tags"] = JsonArray(tagListe(f.tags).map { s(it) })
        setze(m, "notes", f.notiz.trim())
        setze(m, "memberId", f.mitgliedId)
        setze(m, "memberName", if (f.mitgliedId.isEmpty()) "" else f.mitgliedName)
        setze(m, "transactionId", f.buchungId)
        setze(m, "transactionDocNumber", if (f.buchungId.isEmpty()) "" else f.buchungNummer)
    }

    /**
     * Legt ein neues Dokument mit seiner Datei an. Alles oder nichts: Geht beim Speichern etwas schief, wird die Datei wieder entfernt.
     * [dateiTyp] ist die Angabe des Systems (z. B. "application/pdf"); sie darf leer sein.
     */
    fun neu(
        store: DocumentStore, files: FileStore, bytes: ByteArray, dateiName: String, dateiTyp: String, form: DokumentForm,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): Dokument {
        pruefen(form)?.let { throw DokumentException(it) }
        if (bytes.isEmpty()) throw DokumentException("Die Datei ist leer.")
        if (bytes.size > MAX_GROESSE) throw DokumentException("Die Datei ist zu groß (" + bytes.size / 1024 / 1024 + " MB). Erlaubt sind höchstens " + MAX_GROESSE / 1024 / 1024 + " MB.")
        val stempel = Zeit.stempel(now)
        val fileId = BackupPaket.neueKennung(files)
        files.putBytes(fileId, bytes)
        try {
            return store.transaction {
                val m = LinkedHashMap<String, JsonElement>()
                m["id"] = s(form.id)
                m["fileName"] = s(dateiName)
                m["fileType"] = s(dateiTyp)
                m["fileSize"] = JsonPrimitive(bytes.size.toLong())
                m["fileId"] = s(fileId)
                m["uploadDate"] = s(stempel)
                anwenden(m, form)
                m["createdAt"] = s(stempel)
                m["updatedAt"] = s(stempel)
                val doc = JsonObject(m)
                store.put(Dokumente.DOKUMENTE, form.id, doc)
                Dokument.from(doc)
            }
        } catch (e: Throwable) {
            files.delete(fileId)
            throw e
        }
    }

    /** Ändert die Angaben zu einem Dokument; die Datei und unbekannte Felder bleiben unverändert. */
    fun aendern(store: DocumentStore, form: DokumentForm, now: ZonedDateTime = ZonedDateTime.now()): Dokument {
        pruefen(form)?.let { throw DokumentException(it) }
        return store.transaction {
            val alt = store.get(Dokumente.DOKUMENTE, form.id) ?: throw DokumentException("Das Dokument gibt es nicht mehr.")
            val m = LinkedHashMap<String, JsonElement>(alt)
            anwenden(m, form)
            m["updatedAt"] = s(Zeit.stempel(now))
            val doc = JsonObject(m)
            store.put(Dokumente.DOKUMENTE, form.id, doc)
            Dokument.from(doc)
        }
    }

    /** Verschiebt Dokumente in einen Ordner (null: ohne Ordner); mit [kategorie] ändert sich auch die Kategorie. Gibt die Anzahl zurück. */
    fun verschieben(store: DocumentStore, ids: Collection<String>, ordnerId: String?, kategorie: String?, now: ZonedDateTime = ZonedDateTime.now()): Int =
        store.transaction {
            var n = 0
            val stempel = Zeit.stempel(now)
            for (id in ids) {
                val d = store.get(Dokumente.DOKUMENTE, id) ?: continue
                val m = LinkedHashMap<String, JsonElement>(d)
                setze(m, "folderId", ordnerId.orEmpty())
                if (kategorie != null && kategorie in Kategorie.ALLE) {
                    m["category"] = s(kategorie)
                    m["isReceipt"] = JsonPrimitive(kategorie == "belege")
                }
                m["updatedAt"] = s(stempel)
                store.put(Dokumente.DOKUMENTE, id, JsonObject(m))
                n++
            }
            n
        }

    /**
     * Löscht Dokumente und danach ihre Dateien, soweit niemand sie mehr braucht. Hing ein Dokument als Beleg an einer Buchung
     * (dieselbe Datei), wird der Beleg auch von der Buchung genommen.
     */
    fun loeschen(store: DocumentStore, files: FileStore, ids: Collection<String>, now: ZonedDateTime = ZonedDateTime.now()): LoeschBericht {
        val dateien = ArrayList<String>()
        var geloescht = 0
        var buchungen = 0
        store.transaction {
            val stempel = Zeit.stempel(now)
            for (id in ids) {
                val d = store.get(Dokumente.DOKUMENTE, id) ?: continue
                store.delete(Dokumente.DOKUMENTE, id)
                geloescht++
                val fid = d.text("fileId")?.takeIf { it.isNotEmpty() }
                if (fid != null) dateien.add(fid)
                val buchungId = d.text("transactionId")
                val buchung = if (buchungId.isNullOrEmpty()) null else store.get(BUCHUNGEN, buchungId)
                if (buchung != null && buchungId != null && fid != null && (buchung["receipt"] as? JsonObject)?.text("fileId") == fid) {
                    val m = LinkedHashMap<String, JsonElement>(buchung)
                    m.remove("receipt")
                    m["updatedAt"] = s(stempel)
                    store.put(BUCHUNGEN, buchungId, JsonObject(m))
                    buchungen++
                }
            }
        }
        val benutzt = Dateiverwaltung.referenziert(store)
        dateien.filter { it !in benutzt }.forEach { files.delete(it) }
        return LoeschBericht(geloescht, buchungen)
    }

    // ---------------------------------------------------------------- Ordner

    fun ordnerPruefen(store: DocumentStore, f: OrdnerForm): String? {
        if (f.name.isBlank()) return "Bitte einen Ordnernamen eingeben."
        if (f.parentId.isNotEmpty()) {
            val alle = Dokumente.ordner(store)
            if (alle.none { it.id == f.parentId }) return "Der übergeordnete Ordner gibt es nicht mehr."
            if (f.parentId in Dokumente.nachfahren(alle, f.id)) return "Ein Ordner kann nicht in sich selbst oder in einem seiner Unterordner liegen."
        }
        return null
    }

    fun ordnerSpeichern(store: DocumentStore, f: OrdnerForm, now: ZonedDateTime = ZonedDateTime.now()): Ordner {
        ordnerPruefen(store, f)?.let { throw DokumentException(it) }
        return store.transaction {
            val alt = store.get(Dokumente.ORDNER, f.id)
            val stempel = Zeit.stempel(now)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = s(f.id)
            m["name"] = s(f.name.trim())
            setze(m, "parentId", f.parentId)
            setze(m, "category", f.kategorie)
            m["color"] = s(f.farbe)
            setze(m, "description", f.beschreibung.trim())
            if (alt?.get("createdAt") == null) m["createdAt"] = s(stempel)
            m["updatedAt"] = s(stempel)
            val o = JsonObject(m)
            store.put(Dokumente.ORDNER, f.id, o)
            Ordner.from(o)
        }
    }

    /** (Unterordner, Dokumente darin und darunter) – für die Rückfrage vor dem Löschen. */
    fun ordnerInhalt(store: DocumentStore, id: String): Pair<Int, Int> {
        val alle = Dokumente.ordner(store)
        val ids = Dokumente.nachfahren(alle, id)
        return (ids.size - 1) to Dokumente.dokumente(store).count { it.ordnerId != null && it.ordnerId in ids }
    }

    /** Löscht den Ordner und alle Unterordner. Die Dokumente darin bleiben erhalten und stehen danach ohne Ordner. */
    fun ordnerLoeschen(store: DocumentStore, id: String, now: ZonedDateTime = ZonedDateTime.now()) {
        store.transaction {
            val ids = Dokumente.nachfahren(Dokumente.ordner(store), id)
            val stempel = Zeit.stempel(now)
            for (d in store.all(Dokumente.DOKUMENTE)) {
                val folder = d.text("folderId")
                if (folder != null && folder in ids) {
                    val m = LinkedHashMap<String, JsonElement>(d)
                    m.remove("folderId")
                    m["updatedAt"] = s(stempel)
                    store.put(Dokumente.DOKUMENTE, d.text("id").orEmpty(), JsonObject(m))
                }
            }
            ids.forEach { store.delete(Dokumente.ORDNER, it) }
        }
    }
}

/** Die Ordner, mit denen der Desktop beim ersten Start beginnt (gleiche Kennungen), damit beide Seiten zusammenpassen. */
object StandardOrdner {
    class Eintrag(val id: String, val name: String, val parentId: String?, val kategorie: String, val farbe: String, val beschreibung: String)

    val ALLE: List<Eintrag> = listOf(
        StandardOrdner.Eintrag("folder-vertraege", "Verträge & Vereinbarungen", null, "vertraege", "#3b82f6", "Miet-, Pacht-, Trainer- und Sponsoringverträge"),
        StandardOrdner.Eintrag("folder-trainer", "Übungsleiter & Trainer", "folder-vertraege", "vertraege", "#06b6d4", "Honorare, Ehrenamtspauschalen & Übungsleitervereinbarungen"),
        StandardOrdner.Eintrag("folder-pacht", "Miet- & Pachtverträge", "folder-vertraege", "vertraege", "#6366f1", "Pachtverträge Sportstätten, Gastronomie und Vereinsheim"),
        StandardOrdner.Eintrag("folder-sponsoring", "Sponsoring- & Werbepartner", "folder-vertraege", "vertraege", "#8b5cf6", "Bandenwerbung, Trikotsponsoring und Fördervereinbarungen"),
        StandardOrdner.Eintrag("folder-belege", "Buchhaltungsbelege & Finanzen", null, "belege", "#10b981", "Ein- und Ausgangsrechnungen, Quittungen und Spendenbelege"),
        StandardOrdner.Eintrag("folder-belege-2025", "Belege 2025", "folder-belege", "belege", "#10b981", "Rechnungen und Zahlungsnachweise des Geschäftsjahres 2025"),
        StandardOrdner.Eintrag("folder-belege-2026", "Belege 2026", "folder-belege", "belege", "#14b8a6", "Laufendes Geschäftsjahr 2026"),
        StandardOrdner.Eintrag("folder-spenden", "Spendenbestätigungen (BMF)", "folder-belege", "belege", "#059669", "Geld- und Sachzuwendungsbescheinigungen"),
        StandardOrdner.Eintrag("folder-protokolle", "Protokolle & Niederschriften", null, "protokolle", "#f59e0b", "Jahreshauptversammlungen, Vorstandssitzungen & Abteilungsberichte"),
        StandardOrdner.Eintrag("folder-jhv", "Jahreshauptversammlungen (JHV)", "folder-protokolle", "protokolle", "#d97706", "Niederschriften und Anwesenheitslisten der Mitgliederversammlungen"),
        StandardOrdner.Eintrag("folder-vorstand", "Vorstandssitzungen", "folder-protokolle", "protokolle", "#b45309", "Monatliche Beschlussprotokolle des geschäftsführenden Vorstands"),
        StandardOrdner.Eintrag("folder-satzung", "Satzung & Ordnungen", null, "satzung", "#8b5cf6", "Vereinssatzung, Beitragsordnung, Geschäfts- und Ehrenordnung"),
        StandardOrdner.Eintrag("folder-bescheide", "Finanzamt & Behörden", null, "bescheide", "#ef4444", "Freistellungsbescheide, Vereinsregisterauszüge und Steuerbescheinigungen"),
        StandardOrdner.Eintrag("folder-mitglieder", "Mitglieder & Beitrittswesen", null, "mitglieder", "#0284c7", "Mitgliederakten, Eintrittserklärungen & SEPA-Mandate"),
        StandardOrdner.Eintrag("folder-aufnahmeantraege", "Digitale Aufnahmeanträge", "folder-mitglieder", "mitglieder", "#0369a1", "Vollständig digital erfasste und signierte Mitgliedsanträge"),
        StandardOrdner.Eintrag("folder-events", "Projekte & Vereinsfeste", null, "sonstiges", "#ec4899", "Planungsunterlagen, Sommerfeste, Turniere & Flyer"),
        StandardOrdner.Eintrag("folder-turniere", "Hallenturniere & Wettkämpfe", "folder-events", "sonstiges", "#db2777", "Turnierpläne, Ausschreibungen und Sponsorenübersichten")
    )

    /**
     * Legt fehlende Standard-Ordner an. Gibt es schon einen Ordner mit gleichem Namen an derselben Stelle (z. B. mit anderer
     * Kennung), wird er benutzt und nichts doppelt angelegt. Gibt die Anzahl der neu angelegten Ordner zurück.
     */
    fun anlegenFehlende(store: DocumentStore, now: ZonedDateTime = ZonedDateTime.now()): Int = store.transaction {
        val stempel = Zeit.stempel(now)
        val vorhanden = store.all(Dokumente.ORDNER).map(Ordner::from).toMutableList()
        val zuordnung = HashMap<String, String>() // Standard-Kennung -> vorhandene Kennung
        var neu = 0
        for (e in ALLE) {
            val eltern = e.parentId?.let { zuordnung[it] ?: it }
            if (vorhanden.any { it.id == e.id }) { zuordnung[e.id] = e.id; continue }
            val gleicherName = vorhanden.firstOrNull { it.name == e.name && it.parentId == eltern }
            if (gleicherName != null) { zuordnung[e.id] = gleicherName.id; continue }
            val m = LinkedHashMap<String, JsonElement>()
            m["id"] = JsonPrimitive(e.id)
            m["name"] = JsonPrimitive(e.name)
            if (eltern != null) m["parentId"] = JsonPrimitive(eltern)
            m["category"] = JsonPrimitive(e.kategorie)
            m["color"] = JsonPrimitive(e.farbe)
            m["description"] = JsonPrimitive(e.beschreibung)
            m["createdAt"] = JsonPrimitive(stempel)
            m["updatedAt"] = JsonPrimitive(stempel)
            val o = JsonObject(m)
            store.put(Dokumente.ORDNER, e.id, o)
            vorhanden.add(Ordner.from(o))
            zuordnung[e.id] = e.id
            neu++
        }
        neu
    }
}
