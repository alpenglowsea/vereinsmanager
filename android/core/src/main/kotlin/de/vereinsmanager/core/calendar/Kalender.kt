package de.vereinsmanager.core.calendar

import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import java.text.Collator
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Eine Terminart (Bereich "calendarCategories"). */
data class Terminart(val raw: JsonObject, val id: String, val name: String, val farbe: String, val beschreibung: String, val system: Boolean)

data class Teilnehmer(
    val memberId: String,
    val name: String,
    val email: String = "",
    val telefon: String = "",
    val sparte: String = "",
    val rolle: String = "participant",
    val status: String = "invited",
    val notiz: String = "",
)

/**
 * Wiederholung eines Termins. [frequenz]: daily, weekly, monthly, yearly. Der Desktop kennt zusätzlich "biweekly";
 * das wird beim Lesen zu weekly mit doppeltem Intervall. [wochentage]: 0 = Sonntag … 6 = Samstag (wie am Desktop).
 */
data class Wiederholung(val frequenz: String, val intervall: Int, val wochentage: List<Int>, val endeArt: String, val bis: String, val anzahl: Int)

/** Ein Termin (Bereich "calendarEvents"); [raw] ist das gespeicherte Dokument mit allen, auch unbekannten, Feldern. */
data class Termin(
    val raw: JsonObject,
    val id: String,
    val titel: String,
    val beschreibung: String,
    val art: String,
    val sparte: String,
    val beginn: String,
    val beginnZeit: String,
    val ende: String,
    val endeZeit: String,
    val ganztaegig: Boolean,
    val ort: String,
    val serie: Wiederholung?,
    val teilnehmer: List<Teilnehmer>,
) {
    companion object {
        private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

        fun from(o: JsonObject): Termin {
            val beginn = t(o, "startDate")
            val rec = (o["recurrence"] as? JsonObject)?.let { r ->
                val f = t(r, "frequency")
                if (f.isEmpty() || f == "none") null else {
                    val iv = ((r["interval"] as? JsonPrimitive)?.doubleOrNull?.toInt() ?: 1).coerceAtLeast(1)
                    Wiederholung(
                        frequenz = if (f == "biweekly") "weekly" else f,
                        intervall = if (f == "biweekly") iv * 2 else iv,
                        wochentage = (r["daysOfWeek"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.doubleOrNull?.toInt() } ?: emptyList(),
                        endeArt = t(r, "endType").ifEmpty { "never" }, bis = t(r, "untilDate"),
                        anzahl = (r["count"] as? JsonPrimitive)?.doubleOrNull?.toInt() ?: 0,
                    )
                }
            }
            val tn = (o["participants"] as? JsonArray)?.mapNotNull { e ->
                (e as? JsonObject)?.let { p ->
                    Teilnehmer(
                        t(p, "memberId"), t(p, "memberName"), t(p, "memberEmail"), t(p, "memberPhone"), t(p, "memberDepartment"),
                        t(p, "role").ifEmpty { "participant" }, t(p, "status").ifEmpty { "invited" }, t(p, "notes"),
                    )
                }
            } ?: emptyList()
            return Termin(
                raw = o, id = t(o, "id"), titel = t(o, "title").ifEmpty { "Termin" }, beschreibung = t(o, "description"),
                art = t(o, "categoryId").ifEmpty { "cat-general" }, sparte = t(o, "department").ifEmpty { "all" },
                beginn = beginn, beginnZeit = t(o, "startTime"), ende = t(o, "endDate").ifEmpty { beginn }, endeZeit = t(o, "endTime"),
                ganztaegig = (o["isAllDay"] as? JsonPrimitive)?.contentOrNull == "true", ort = t(o, "location"), serie = rec, teilnehmer = tn,
            )
        }
    }
}

/** Ein Auftreten eines Termins (bei Serien eines von vielen) im Zeitraum. [ende] ist das letzte Datum bei mehrtägigen Terminen. */
data class Vorkommen(val termin: Termin, val datum: LocalDate, val ende: LocalDate, val ausSerie: Boolean)

/** Geburtstag oder Vereinsjubiläum eines Mitglieds. */
data class Besonderes(
    val art: String, // "birthday" | "anniversary"
    val titel: String,
    val datum: LocalDate,
    val memberId: String,
    val name: String,
    val sparte: String,
    val jahre: Int,
    val rund: Boolean,
    val details: String,
)

/** Eingabefelder der Termin-Maske. [id] ist null bei einem neuen Termin. */
data class TerminForm(
    val id: String? = null,
    val titel: String = "",
    val beschreibung: String = "",
    val art: String = "cat-general",
    val sparte: String = "all",
    val beginn: String = "",
    val beginnZeit: String = "18:00",
    val ende: String = "",
    val endeZeit: String = "19:30",
    val ganztaegig: Boolean = false,
    val ort: String = "",
    val serie: Boolean = false,
    val frequenz: String = "weekly",
    val intervall: String = "1",
    val wochentage: Set<Int> = emptySet(),
    val endeArt: String = "never",
    val bis: String = "",
    val anzahl: String = "10",
    val teilnehmer: List<Teilnehmer> = emptyList(),
) {
    companion object {
        fun von(t: Termin) = TerminForm(
            id = t.id, titel = t.titel, beschreibung = t.beschreibung, art = t.art, sparte = t.sparte, beginn = t.beginn,
            beginnZeit = t.beginnZeit.ifEmpty { "18:00" }, ende = t.ende, endeZeit = t.endeZeit.ifEmpty { "19:30" }, ganztaegig = t.ganztaegig,
            ort = t.ort, serie = t.serie != null, frequenz = t.serie?.frequenz ?: "weekly", intervall = (t.serie?.intervall ?: 1).toString(),
            wochentage = t.serie?.wochentage?.toSet()?.takeIf { it.isNotEmpty() }
                ?: runCatching { setOf(LocalDate.parse(t.beginn).dayOfWeek.value % 7) }.getOrDefault(emptySet()),
            endeArt = t.serie?.endeArt ?: "never", bis = t.serie?.bis ?: "", anzahl = (t.serie?.anzahl?.takeIf { it > 0 } ?: 10).toString(),
            teilnehmer = t.teilnehmer,
        )
    }
}

data class ArtFarbe(val hex: String, val bg: String, val text: String, val rand: String)

data class ImportBericht(val neu: Int, val uebersprungen: Int)

object Kalender {
    const val AREA = "calendarEvents"
    const val ARTEN_AREA = "calendarCategories"
    const val ALLE_SPARTEN = "all"

    val ROLLEN: Map<String, String> = linkedMapOf(
        "participant" to "Teilnehmer", "organizer" to "Organisator", "helper" to "Helfer", "trainer" to "Trainer", "referee" to "Schiedsrichter",
    )
    val STATUS: Map<String, String> = linkedMapOf("invited" to "Eingeladen", "confirmed" to "Zugesagt", "declined" to "Abgesagt", "attended" to "Teilgenommen")
    val FREQUENZEN: Map<String, String> = linkedMapOf("daily" to "Täglich", "weekly" to "Wöchentlich", "monthly" to "Monatlich", "yearly" to "Jährlich")
    val ENDE_ARTEN: Map<String, String> = linkedMapOf("never" to "Nie", "until_date" to "Bis zu einem Datum", "count" to "Nach einer Anzahl")

    /** Montag zuerst, Zahlen wie am Desktop (0 = Sonntag). */
    val WOCHENTAGE: List<Pair<Int, String>> = listOf(1 to "Mo", 2 to "Di", 3 to "Mi", 4 to "Do", 5 to "Fr", 6 to "Sa", 0 to "So")
    private val TAGE_LANG = listOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag")
    private val TAGE_KURZ = listOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")
    val MONATE = listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")

    val FARBEN: List<ArtFarbe> = listOf(
        ArtFarbe("#ef4444", "bg-rose-100", "text-rose-800", "border-rose-300"),
        ArtFarbe("#10b981", "bg-emerald-100", "text-emerald-800", "border-emerald-300"),
        ArtFarbe("#2563eb", "bg-blue-100", "text-blue-800", "border-blue-300"),
        ArtFarbe("#7c3aed", "bg-purple-100", "text-purple-800", "border-purple-300"),
        ArtFarbe("#f59e0b", "bg-amber-100", "text-amber-800", "border-amber-300"),
        ArtFarbe("#ea580c", "bg-orange-100", "text-orange-800", "border-orange-300"),
        ArtFarbe("#0891b2", "bg-cyan-100", "text-cyan-800", "border-cyan-300"),
        ArtFarbe("#64748b", "bg-slate-100", "text-slate-800", "border-slate-300"),
    )

    private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    // ---------- Terminarten ----------

    private fun standardArt(id: String, name: String, farbe: Int, icon: String, beschreibung: String): Terminart {
        val f = FARBEN[farbe]
        val o = JsonObject(
            mapOf(
                "id" to JsonPrimitive(id), "name" to JsonPrimitive(name), "color" to JsonPrimitive(f.hex), "badgeBg" to JsonPrimitive(f.bg),
                "badgeText" to JsonPrimitive(f.text), "badgeBorder" to JsonPrimitive(f.rand), "icon" to JsonPrimitive(icon),
                "description" to JsonPrimitive(beschreibung), "isSystem" to JsonPrimitive(true),
            ),
        )
        return Terminart(o, id, name, f.hex, beschreibung, true)
    }

    /** Die acht Terminarten, die auch der Desktop beim ersten Start anlegt. */
    val STANDARD_ARTEN: List<Terminart> = listOf(
        standardArt("cat-match", "Spiel & Wettkampf", 0, "Trophy", "Punktspiele, Turniere, Pokalspiele und Meisterschaften"),
        standardArt("cat-training", "Training & Kurse", 1, "Activity", "Reguläre Trainingseinheiten, Übungsstunden und Fitnesskurse"),
        standardArt("cat-assembly", "Mitgliederversammlung / JHV", 2, "Landmark", "Ordentliche und außerordentliche Jahreshauptversammlungen"),
        standardArt("cat-board", "Vorstandssitzung & Gremien", 3, "Users", "Monatliche Vorstandssitzungen, Abteilungsleiter-Treffen und Ausschüsse"),
        standardArt("cat-celebration", "Vereinsfest & Event", 4, "PartyPopper", "Sommerfeste, Jubiläen, Weihnachtsfeiern und Vereinsmeisterschaften"),
        standardArt("cat-maintenance", "Arbeitseinsatz & Pflege", 5, "Wrench", "Platzpflege, Hallenreinigung, Reparaturen und Geländearbeiten"),
        standardArt("cat-course", "Lehrgang & Fortbildung", 6, "GraduationCap", "Trainerscheine, Schiedsrichterlehrgänge und Erste-Hilfe-Kurse"),
        standardArt("cat-general", "Allgemeiner Termin", 7, "Calendar", "Sonstige Vereinstermine, Fristen und Ankündigungen"),
    )

    private fun art(o: JsonObject) = Terminart(
        o, t(o, "id"), t(o, "name").ifEmpty { "Terminart" }, t(o, "color").ifEmpty { "#64748b" }, t(o, "description"),
        (o["isSystem"] as? JsonPrimitive)?.contentOrNull == "true",
    )

    /** Gespeicherte Terminarten; ohne gespeicherte gelten die Standardarten (sie werden erst beim ersten Ändern mit gespeichert). */
    fun arten(store: DocumentStore): List<Terminart> = store.all(ARTEN_AREA).map { art(it) }.ifEmpty { STANDARD_ARTEN }

    private fun artenSichern(store: DocumentStore) {
        if (store.count(ARTEN_AREA) == 0) STANDARD_ARTEN.forEach { store.put(ARTEN_AREA, it.id, it.raw) }
    }

    /** Neue Terminart ([id] null) oder Änderung; [farbe] ist ein Index in [FARBEN]. */
    fun artSpeichern(store: DocumentStore, id: String?, name: String, farbe: Int, beschreibung: String, now: ZonedDateTime = ZonedDateTime.now()): Terminart = store.transaction {
        val n = name.trim()
        require(n.isNotEmpty()) { "Bitte einen Namen eingeben." }
        val vorhanden = arten(store)
        require(vorhanden.none { it.id != id && it.name.trim().equals(n, ignoreCase = true) }) { "Diese Terminart gibt es schon." }
        artenSichern(store)
        val f = FARBEN[farbe.coerceIn(FARBEN.indices)]
        val neueId = id ?: "cat-${now.toInstant().toEpochMilli()}-${Zeit.zufall(4)}"
        val m = LinkedHashMap<String, JsonElement>(id?.let { store.get(ARTEN_AREA, it) } ?: emptyMap())
        require(id == null || m.isNotEmpty()) { "Die Terminart gibt es nicht mehr." }
        m["id"] = JsonPrimitive(neueId)
        m["name"] = JsonPrimitive(n)
        m["color"] = JsonPrimitive(f.hex); m["badgeBg"] = JsonPrimitive(f.bg); m["badgeText"] = JsonPrimitive(f.text); m["badgeBorder"] = JsonPrimitive(f.rand)
        if (beschreibung.isBlank()) m.remove("description") else m["description"] = JsonPrimitive(beschreibung.trim())
        if (id == null) m["isSystem"] = JsonPrimitive(false)
        JsonObject(m).also { store.put(ARTEN_AREA, neueId, it) }.let { art(it) }
    }

    /** Eine Terminart löschen, die kein Termin mehr benutzt und keine Standardart ist (der Desktop lässt verwaiste Termine zurück). */
    fun artLoeschen(store: DocumentStore, id: String) = store.transaction {
        val a = arten(store).firstOrNull { it.id == id } ?: throw IllegalArgumentException("Die Terminart gibt es nicht mehr.")
        require(!a.system) { "Standardarten lassen sich nicht löschen." }
        val n = alle(store).count { it.art == id }
        require(n == 0) { "${a.name} wird noch von $n ${if (n == 1) "Termin" else "Terminen"} benutzt. Bitte zuerst dort eine andere Terminart wählen." }
        store.delete(ARTEN_AREA, id)
    }

    // ---------- Termine lesen ----------

    fun alle(store: DocumentStore): List<Termin> = store.all(AREA).map { Termin.from(it) }
    fun termin(store: DocumentStore, id: String): Termin? = store.get(AREA, id)?.let { Termin.from(it) }

    private fun datum(s: String): LocalDate? = runCatching { LocalDate.parse(s) }.getOrNull()
    private val ZEIT = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")

    /** Mo, Di … für ein ISO-Datum. */
    fun wochentagKurz(d: LocalDate) = TAGE_KURZ[d.dayOfWeek.value - 1]
    fun wochentagLang(d: LocalDate) = TAGE_LANG[d.dayOfWeek.value - 1]

    /** "Do, 12.11.2026" */
    fun datumKurz(iso: String): String = datum(iso)?.let { "${wochentagKurz(it)}, ${Zeit.deutsch(iso)}" } ?: iso

    /** Wann ein Termin stattfindet, als Text: "Do, 12.11.2026, 18:00–19:30 Uhr" bzw. "… bis …". */
    fun zeitText(beginn: String, beginnZeit: String, ende: String, endeZeit: String, ganztaegig: Boolean): String {
        val tage = if (ende.isEmpty() || ende == beginn) datumKurz(beginn) else "${datumKurz(beginn)} bis ${datumKurz(ende)}"
        if (ganztaegig) return "$tage, ganztägig"
        val zeit = when {
            beginnZeit.isEmpty() -> ""
            endeZeit.isEmpty() -> "$beginnZeit Uhr"
            ende.isEmpty() || ende == beginn -> "$beginnZeit–$endeZeit Uhr"
            else -> "$beginnZeit Uhr bis $endeZeit Uhr"
        }
        return if (zeit.isEmpty()) tage else "$tage, $zeit"
    }

    // ---------- Serien ----------

    /** Alle Starttage einer Serie bis [grenze], in zeitlicher Reihenfolge. Rechnet immer vom ersten Termin aus (kein Abdriften am Monatsende). */
    private fun serienTage(start: LocalDate, s: Wiederholung, grenze: LocalDate): Sequence<LocalDate> = sequence {
        val iv = s.intervall.coerceAtLeast(1).toLong()
        when (s.frequenz) {
            "daily" -> { var k = 0L; while (true) { val d = start.plusDays(k * iv); if (d.isAfter(grenze)) break; yield(d); k++ } }
            "monthly" -> { var k = 0L; while (true) { val d = start.plusMonths(k * iv); if (d.isAfter(grenze)) break; yield(d); k++ } }
            "yearly" -> { var k = 0L; while (true) { val d = start.plusYears(k * iv); if (d.isAfter(grenze)) break; yield(d); k++ } }
            "weekly" -> {
                val tage = s.wochentage.ifEmpty { listOf(start.dayOfWeek.value % 7) }.distinct().sortedBy { (it + 6) % 7 }
                val montag = start.minusDays((start.dayOfWeek.value - 1).toLong())
                var w = 0L
                while (true) {
                    val wm = montag.plusWeeks(w * iv)
                    if (wm.isAfter(grenze)) break
                    for (tag in tage) {
                        val d = wm.plusDays(((tag + 6) % 7).toLong())
                        if (!d.isBefore(start) && !d.isAfter(grenze)) yield(d)
                    }
                    w++
                }
            }
            else -> yield(start)
        }
    }

    /** Alle Termine im Zeitraum [von]…[bis] (einschließlich), Serien aufgelöst, mehrtägige Termine mit ihrem letzten Tag. */
    fun vorkommen(termine: List<Termin>, von: LocalDate, bis: LocalDate): List<Vorkommen> {
        val out = ArrayList<Vorkommen>()
        for (t in termine) {
            val start = datum(t.beginn) ?: continue
            val endT = datum(t.ende)?.takeIf { !it.isBefore(start) } ?: start
            val dauer = ChronoUnit.DAYS.between(start, endT)
            val s = t.serie
            if (s == null) {
                if (!start.isAfter(bis) && !endT.isBefore(von)) out += Vorkommen(t, start, endT, false)
                continue
            }
            val bisDatum = if (s.endeArt == "until_date") datum(s.bis) else null
            val grenze = if (bisDatum != null && bisDatum.isBefore(bis)) bisDatum else bis
            var tage = serienTage(start, s, grenze)
            if (s.endeArt == "count") tage = tage.take(s.anzahl.coerceAtLeast(1))
            for (d in tage.take(20_000)) {
                val e = d.plusDays(dauer)
                if (!d.isAfter(bis) && !e.isBefore(von)) out += Vorkommen(t, d, e, d != start)
            }
        }
        return out.sortedWith(compareBy<Vorkommen>({ it.datum }, { !it.termin.ganztaegig }, { it.termin.beginnZeit }, { it.termin.titel.lowercase(Locale.GERMANY) }))
    }

    /** Die Vorkommen, die an einem bestimmten Tag stattfinden (auch mehrtägige, die schon laufen). */
    fun amTag(liste: List<Vorkommen>, tag: LocalDate): List<Vorkommen> = liste.filter { !tag.isBefore(it.datum) && !tag.isAfter(it.ende) }

    /** Suche und Filter wie am Desktop; ein Termin für alle Sparten bleibt bei jedem Sparten-Filter sichtbar. */
    fun filtern(liste: List<Vorkommen>, suche: String, art: String?, sparte: String?, arten: List<Terminart>): List<Vorkommen> {
        val q = suche.trim().lowercase(Locale.GERMANY)
        val namen = arten.associate { it.id to it.name }
        return liste.filter { v ->
            val t = v.termin
            (art == null || t.art == art) &&
                (sparte == null || t.sparte == ALLE_SPARTEN || t.sparte == sparte) &&
                (q.isEmpty() || listOf(t.titel, t.beschreibung, t.ort, namen[t.art] ?: "", t.sparte).any { it.lowercase(Locale.GERMANY).contains(q) } ||
                    t.teilnehmer.any { it.name.lowercase(Locale.GERMANY).contains(q) })
        }
    }

    // ---------- Geburtstage und Jubiläen ----------

    private val RUNDE_GEBURTSTAGE = setOf(18, 30, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100)
    private val RUNDE_JUBILAEEN = setOf(10, 20, 25, 30, 40, 50, 60, 70)

    private fun imJahr(iso: String, jahr: Int): LocalDate? {
        val d = datum(iso) ?: return null
        // Am 29.2. in Jahren ohne Schalttag gilt der 28.2. (der Desktop erzeugt dort ein ungültiges Datum).
        return if (d.monthValue == 2 && d.dayOfMonth == 29 && !java.time.Year.isLeap(jahr.toLong())) LocalDate.of(jahr, 2, 28) else LocalDate.of(jahr, d.monthValue, d.dayOfMonth)
    }

    /** Geburtstage und Jubiläen (ab 5 Jahren) der nicht ausgetretenen Mitglieder im Zeitraum, auch über den Jahreswechsel. */
    fun besondere(mitglieder: List<Member>, von: LocalDate, bis: LocalDate): List<Besonderes> {
        val out = ArrayList<Besonderes>()
        for (jahr in von.year..bis.year) {
            for (m in mitglieder) {
                if (m.status == "terminated") continue
                val name = "${m.firstName} ${m.lastName}".trim()
                datum(m.birthDate)?.let { geb ->
                    val alter = jahr - geb.year
                    val tag = imJahr(m.birthDate, jahr)
                    if (alter > 0 && tag != null && !tag.isBefore(von) && !tag.isAfter(bis)) {
                        val rund = alter in RUNDE_GEBURTSTAGE
                        out += Besonderes(
                            "birthday", "$name ($alter. Geburtstag)${if (rund) " 🎂" else ""}", tag, m.id, name, m.department, alter, rund,
                            if (rund) "Runder Geburtstag: $alter Jahre" else "$alter. Geburtstag",
                        )
                    }
                }
                datum(m.entryDate)?.let { ein ->
                    val jahre = jahr - ein.year
                    val tag = imJahr(m.entryDate, jahr)
                    if (jahre >= 5 && tag != null && !tag.isBefore(von) && !tag.isAfter(bis)) {
                        val rund = jahre in RUNDE_JUBILAEEN
                        val zusatz = when {
                            jahre == 25 -> " (Silbernes Jubiläum 🥈)"
                            jahre == 50 -> " (Goldenes Jubiläum 🥇)"
                            jahre == 60 -> " (Diamant-Jubiläum 💎)"
                            rund -> " ($jahre Jahre Jubiläum 🎖️)"
                            else -> " ($jahre Jahre im Verein)"
                        }
                        out += Besonderes("anniversary", name + zusatz, tag, m.id, name, m.department, jahre, rund, "$jahre Jahre Vereinszugehörigkeit seit ${Zeit.deutsch(m.entryDate)}")
                    }
                }
            }
        }
        val c = Collator.getInstance(Locale.GERMANY)
        return out.sortedWith(compareBy<Besonderes> { it.datum }.thenComparator { a, b -> c.compare(a.titel, b.titel) })
    }

    // ---------- Termin anlegen und ändern ----------

    fun neu(heute: LocalDate, art: String = "cat-general") =
        TerminForm(art = art, beginn = heute.toString(), ende = heute.toString(), wochentage = setOf(heute.dayOfWeek.value % 7))

    fun pruefen(f: TerminForm): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.titel.isBlank()) e["titel"] = "Bitte einen Titel eingeben."
        val b = datum(f.beginn)
        if (b == null) e["beginn"] = "Bitte ein Datum wählen."
        val en = datum(f.ende)
        if (en == null) e["ende"] = "Bitte ein Datum wählen."
        else if (b != null && en.isBefore(b)) e["ende"] = "Das Ende liegt vor dem Beginn."
        if (!f.ganztaegig) {
            if (!ZEIT.matches(f.beginnZeit)) e["beginnZeit"] = "Uhrzeit als HH:MM, z. B. 18:30."
            if (f.endeZeit.isNotBlank() && !ZEIT.matches(f.endeZeit)) e["endeZeit"] = "Uhrzeit als HH:MM, z. B. 19:30."
            else if (f.endeZeit.isNotBlank() && ZEIT.matches(f.beginnZeit) && b != null && en != null && b == en && f.endeZeit < f.beginnZeit) e["endeZeit"] = "Das Ende liegt vor dem Beginn."
        }
        if (f.serie) {
            val iv = f.intervall.trim().toIntOrNull()
            if (iv == null || iv < 1 || iv > 99) e["intervall"] = "Intervall: ganze Zahl von 1 bis 99."
            if (f.frequenz !in FREQUENZEN) e["frequenz"] = "Bitte eine Wiederholung wählen."
            if (f.frequenz == "weekly" && f.wochentage.isEmpty()) e["wochentage"] = "Bitte mindestens einen Wochentag wählen."
            if (f.endeArt == "until_date") {
                val bis = datum(f.bis)
                if (bis == null) e["bis"] = "Bitte ein Enddatum der Serie wählen."
                else if (b != null && bis.isBefore(b)) e["bis"] = "Das Enddatum liegt vor dem ersten Termin."
            }
            if (f.endeArt == "count") {
                val n = f.anzahl.trim().toIntOrNull()
                if (n == null || n < 1 || n > 999) e["anzahl"] = "Anzahl: ganze Zahl von 1 bis 999."
            }
        }
        return e
    }

    private fun setzen(m: MutableMap<String, JsonElement>, key: String, wert: String) {
        val w = wert.trim()
        if (w.isEmpty()) m.remove(key) else m[key] = JsonPrimitive(w)
    }

    private fun teilnehmerJson(p: Teilnehmer): JsonObject {
        val m = LinkedHashMap<String, JsonElement>()
        m["memberId"] = JsonPrimitive(p.memberId); m["memberName"] = JsonPrimitive(p.name)
        setzen(m, "memberEmail", p.email); setzen(m, "memberPhone", p.telefon); setzen(m, "memberDepartment", p.sparte)
        m["role"] = JsonPrimitive(p.rolle); m["status"] = JsonPrimitive(p.status)
        setzen(m, "notes", p.notiz)
        return JsonObject(m)
    }

    fun neueId(now: ZonedDateTime = ZonedDateTime.now()) = "evt-${now.toInstant().toEpochMilli()}-${Zeit.zufall(5)}"

    /** Prüft und speichert; unbekannte Felder des bisherigen Dokuments bleiben erhalten. */
    fun speichern(store: DocumentStore, f: TerminForm, now: ZonedDateTime = ZonedDateTime.now()): JsonObject = store.transaction {
        val fehler = pruefen(f)
        require(fehler.isEmpty()) { fehler.values.first() }
        val base = f.id?.let { store.get(AREA, it) }
        require(f.id == null || base != null) { "Den Termin gibt es nicht mehr." }
        val stamp = Zeit.stempel(now)
        val id = f.id ?: neueId(now)
        val m = LinkedHashMap<String, JsonElement>(base ?: emptyMap())
        m["id"] = JsonPrimitive(id)
        m["title"] = JsonPrimitive(f.titel.trim())
        setzen(m, "description", f.beschreibung)
        m["categoryId"] = JsonPrimitive(f.art.ifBlank { "cat-general" })
        m["department"] = JsonPrimitive(f.sparte.ifBlank { ALLE_SPARTEN })
        m["startDate"] = JsonPrimitive(f.beginn)
        m["endDate"] = JsonPrimitive(f.ende.ifBlank { f.beginn })
        m["isAllDay"] = JsonPrimitive(f.ganztaegig)
        if (f.ganztaegig) { m.remove("startTime"); m.remove("endTime") } else { m["startTime"] = JsonPrimitive(f.beginnZeit); setzen(m, "endTime", f.endeZeit) }
        // Ändert sich der Ort, passen die vom Desktop gespeicherten Koordinaten nicht mehr.
        if (base != null && t(base, "location") != f.ort.trim()) { m.remove("locationLat"); m.remove("locationLng") }
        setzen(m, "location", f.ort)
        if (f.serie) {
            val r = LinkedHashMap<String, JsonElement>()
            r["frequency"] = JsonPrimitive(f.frequenz)
            r["interval"] = JsonPrimitive(f.intervall.trim().toInt())
            if (f.frequenz == "weekly") r["daysOfWeek"] = JsonArray(f.wochentage.sortedBy { (it + 6) % 7 }.map { JsonPrimitive(it) })
            r["endType"] = JsonPrimitive(f.endeArt)
            if (f.endeArt == "until_date") r["untilDate"] = JsonPrimitive(f.bis)
            if (f.endeArt == "count") r["count"] = JsonPrimitive(f.anzahl.trim().toInt())
            m["recurrence"] = JsonObject(r)
        } else m.remove("recurrence")
        m["participants"] = JsonArray(f.teilnehmer.map { teilnehmerJson(it) })
        if (base == null) m["createdAt"] = JsonPrimitive(stamp)
        m["updatedAt"] = JsonPrimitive(stamp)
        JsonObject(m).also { store.put(AREA, id, it) }
    }

    fun loeschen(store: DocumentStore, id: String) = store.transaction { store.delete(AREA, id) }

    /** Den Status eines Teilnehmers ändern, ohne das ganze Formular zu öffnen. */
    fun teilnehmerStatus(store: DocumentStore, terminId: String, memberId: String, status: String, now: ZonedDateTime = ZonedDateTime.now()) = store.transaction {
        require(status in STATUS) { "Unbekannter Status." }
        val t = termin(store, terminId) ?: throw IllegalArgumentException("Den Termin gibt es nicht mehr.")
        val f = TerminForm.von(t)
        speichern(store, f.copy(teilnehmer = f.teilnehmer.map { if (it.memberId == memberId) it.copy(status = status) else it }), now)
    }

    // ---------- Teilnehmer ----------

    private fun alsTeilnehmer(m: Member, rolle: String) = Teilnehmer(
        m.id, "${m.firstName} ${m.lastName}".trim(), m.email, m.phone, m.department, rolle, "invited",
    )

    /** Fügt ein Mitglied hinzu; war es schon dabei, bleibt die Liste unverändert (der Desktop erlaubt doppelte Einträge). */
    fun teilnehmerHinzu(liste: List<Teilnehmer>, m: Member, rolle: String = "participant"): List<Teilnehmer> =
        if (liste.any { it.memberId == m.id }) liste else liste + alsTeilnehmer(m, rolle)

    /** Alle aktuellen Mitglieder einer Sparte ([ALLE_SPARTEN] = alle) hinzufügen. */
    fun teilnehmerSparte(liste: List<Teilnehmer>, mitglieder: List<Member>, sparte: String, rolle: String = "participant"): List<Teilnehmer> {
        var r = liste
        mitglieder.filter { it.status != "terminated" && (sparte == ALLE_SPARTEN || it.department == sparte) }
            .sortedWith(compareBy({ it.lastName.lowercase(Locale.GERMANY) }, { it.firstName.lowercase(Locale.GERMANY) }))
            .forEach { r = teilnehmerHinzu(r, it, rolle) }
        return r
    }

    /** "3 zugesagt · 1 abgesagt · 2 offen" */
    fun zusagen(t: Termin): String {
        if (t.teilnehmer.isEmpty()) return ""
        val z = t.teilnehmer.count { it.status == "confirmed" || it.status == "attended" }
        val a = t.teilnehmer.count { it.status == "declined" }
        val o = t.teilnehmer.count { it.status == "invited" }
        return listOf(if (z > 0) "$z zugesagt" else null, if (a > 0) "$a abgesagt" else null, if (o > 0) "$o offen" else null).filterNotNull().joinToString(" · ")
    }

    // ---------- Einladung ----------

    /** E-Mail-Adressen der Teilnehmer (nur gültig aussehende, ohne Doppelte). */
    fun empfaenger(t: Termin): List<String> = t.teilnehmer.map { it.email.trim() }.filter { it.contains('@') }.distinct()

    fun betreff(t: Termin, verein: String) = "Einladung: ${t.titel}" + if (verein.isNotBlank()) " [$verein]" else ""

    /**
     * Text für Mail oder Nachrichten-Apps. Er nennt bewusst keine Teilnehmer und keine Zusagen
     * (der Desktop schreibt beides in den Text, der dann etwa in einer Gruppe landet).
     */
    fun einladungsText(t: Termin, verein: String): String = buildString {
        appendLine("Liebe Vereinsmitglieder,")
        appendLine()
        appendLine("wir laden herzlich zu diesem Vereinstermin ein:")
        appendLine()
        appendLine("Termin: ${t.titel}")
        appendLine("Wann: ${zeitText(t.beginn, t.beginnZeit, t.ende, t.endeZeit, t.ganztaegig)}")
        if (t.ort.isNotBlank()) appendLine("Wo: ${t.ort}")
        if (t.serie != null) appendLine("Wiederholung: ${serieText(t.serie)}")
        if (t.beschreibung.isNotBlank()) { appendLine(); appendLine(t.beschreibung.trim()) }
        appendLine()
        appendLine("Bitte gebt uns eine kurze Rückmeldung, ob ihr teilnehmen könnt.")
        if (verein.isNotBlank()) { appendLine(); appendLine("Mit freundlichen Grüßen"); append(verein) }
    }.trimEnd()

    /** Die Wiederholung in Worten: "wöchentlich (Mo, Mi), bis 31.12.2026". */
    fun serieText(s: Wiederholung): String {
        val iv = s.intervall.coerceAtLeast(1)
        val grund = when (s.frequenz) {
            "daily" -> if (iv == 1) "täglich" else "alle $iv Tage"
            "weekly" -> {
                val tage = s.wochentage.sortedBy { (it + 6) % 7 }.joinToString(", ") { TAGE_KURZ[(it + 6) % 7] }
                (if (iv == 1) "wöchentlich" else "alle $iv Wochen") + if (tage.isNotEmpty()) " ($tage)" else ""
            }
            "monthly" -> if (iv == 1) "monatlich" else "alle $iv Monate"
            "yearly" -> if (iv == 1) "jährlich" else "alle $iv Jahre"
            else -> s.frequenz
        }
        return grund + when (s.endeArt) {
            "until_date" -> if (s.bis.isNotEmpty()) ", bis ${Zeit.deutsch(s.bis)}" else ""
            "count" -> ", ${s.anzahl} Mal"
            else -> ""
        }
    }
}
