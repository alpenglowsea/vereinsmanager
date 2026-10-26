package de.vereinsmanager.core.members

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

/** Auswertung der Mitglieder (Funktionsinventar "Auswertung Mitglieder"); rechnet alles live, speichert nichts. */
object MemberAnalytics {
    data class Kennzahlen(
        val gesamt: Int, val aktiv: Int, val passiv: Int, val jahresSoll: BigDecimal,
        val sepa: Int, val sepaProzent: Int, val sparten: Int, val groessteSparte: String?, val groessteSparteAnzahl: Int,
    )

    data class SpartenZeile(val name: String, val anzahl: Int, val prozent: Int, val jahresSoll: BigDecimal)
    data class Anteil(val schluessel: String, val bezeichnung: String, val anzahl: Int, val prozent: Int)
    data class Monat(val index: Int, val zugaenge: Int, val abgaenge: Int)
    data class Jahr(val jahr: Int, val zugaenge: Int, val abgaenge: Int) { val saldo get() = zugaenge - abgaenge }
    enum class Art { EINTRITT, AUSTRITT }
    data class Ereignis(val art: Art, val datum: String, val member: Member)

    val MONATE = listOf("Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez")

    private fun prozent(n: Int, total: Int) = if (total > 0) (n.toDouble() / total * 100).roundToInt() else 0

    private fun faktor(period: String) = when (period) { "monthly" -> 12; "quarterly" -> 4; "half_yearly" -> 2; else -> 1 }

    /** Aktuelle Mitglieder: nicht gekündigt und nicht vom Typ "ausgetreten" (wie am Desktop). */
    fun aktuelle(members: List<Member>) = members.filter { it.status != "terminated" && it.type != "ausgetreten" && it.type != "terminated" }

    fun kennzahlen(members: List<Member>): Kennzahlen {
        val cur = aktuelle(members)
        val soll = members.filter { it.status != "terminated" }
            .fold(BigDecimal.ZERO) { s, m -> s + m.fee.multiply(BigDecimal(faktor(m.feePeriod))) }
        val sepa = cur.count { it.paymentMethod == "sepa" }
        val sp = sparten(members)
        return Kennzahlen(
            cur.size, members.count { it.status == "active" }, members.count { it.status == "passive" }, soll,
            sepa, prozent(sepa, cur.size), sp.size, sp.firstOrNull()?.name, sp.firstOrNull()?.anzahl ?: 0,
        )
    }

    /** Kopfzahl und Jahressoll je Sparte, größte zuerst; nur aktuelle Mitglieder. */
    fun sparten(members: List<Member>): List<SpartenZeile> {
        val cur = aktuelle(members)
        val zahl = LinkedHashMap<String, Int>()
        val soll = HashMap<String, BigDecimal>()
        for (m in cur) {
            zahl[m.department] = (zahl[m.department] ?: 0) + 1
            soll[m.department] = (soll[m.department] ?: BigDecimal.ZERO) + m.fee.multiply(BigDecimal(faktor(m.feePeriod)))
        }
        return zahl.entries.sortedByDescending { it.value }
            .map { SpartenZeile(it.key.ifEmpty { "(ohne Sparte)" }, it.value, prozent(it.value, cur.size), soll[it.key] ?: BigDecimal.ZERO) }
    }

    private val TYPEN = linkedMapOf(
        "full" to "Vollmitglied (Erwachsene)", "youth" to "Jugend / Kinder", "reduced" to "Ermäßigt (Student/Rentner)",
        "family" to "Familienbeitrag", "supporting" to "Fördermitglied / Sponsor", "honorary" to "Ehrenmitglied", "ausgetreten" to "Ausgetreten",
    )

    /** Anzahl je Mitgliedschaftstyp über alle Mitglieder. Abweichung: Prozent bezogen auf alle Mitglieder (am Desktop auf die aktuellen, daher teils über 100 %). */
    fun typen(members: List<Member>): List<Anteil> =
        TYPEN.map { (k, l) -> members.count { it.type == k }.let { n -> Anteil(k, l, n, prozent(n, members.size)) } }

    private val ZAHLWEGE = linkedMapOf(
        "sepa" to "SEPA-Lastschrift", "transfer" to "Überweisung / Selbstzahler", "standing_order" to "Dauerauftrag", "cash" to "Barzahlung",
    )

    fun zahlwege(members: List<Member>): List<Anteil> {
        val cur = aktuelle(members)
        return ZAHLWEGE.map { (k, l) -> cur.count { it.paymentMethod == k }.let { n -> Anteil(k, l, n, prozent(n, cur.size)) } }
    }

    // ---- Alter ----

    enum class GeschlechtFilter { ALLE, M, W, D, KEIN }

    private val GRUPPEN = listOf("kids" to "Kinder (0–13 Jahre)", "teens" to "Jugendliche (14–17 Jahre)", "adults" to "Erwachsene (18–59 Jahre)", "seniors" to "Senioren (ab 60 Jahre)", "unknown" to "Ohne Geburtsdatum")

    fun geschlechter(members: List<Member>): List<Pair<GeschlechtFilter, Int>> {
        val cur = aktuelle(members)
        return listOf(
            GeschlechtFilter.M to cur.count { it.gender == "m" }, GeschlechtFilter.W to cur.count { it.gender == "w" },
            GeschlechtFilter.D to cur.count { it.gender == "d" }, GeschlechtFilter.KEIN to cur.count { it.gender == "none" || it.gender.isEmpty() },
        )
    }

    /** Altersgruppen der aktuellen Mitglieder, optional nach Geschlecht gefiltert; Alter zum Tag genau. */
    fun altersgruppen(members: List<Member>, filter: GeschlechtFilter, today: LocalDate): List<Anteil> {
        val cur = aktuelle(members).filter {
            when (filter) {
                GeschlechtFilter.ALLE -> true
                GeschlechtFilter.KEIN -> it.gender.isEmpty() || it.gender == "none"
                GeschlechtFilter.M -> it.gender == "m"
                GeschlechtFilter.W -> it.gender == "w"
                GeschlechtFilter.D -> it.gender == "d"
            }
        }
        val z = LinkedHashMap<String, Int>().apply { GRUPPEN.forEach { put(it.first, 0) } }
        for (m in cur) {
            val b = runCatching { LocalDate.parse(m.birthDate) }.getOrNull()
            val key = if (b == null) "unknown" else {
                var a = today.year - b.year
                if (today.monthValue < b.monthValue || (today.monthValue == b.monthValue && today.dayOfMonth < b.dayOfMonth)) a--
                when { a <= 13 -> "kids"; a <= 17 -> "teens"; a <= 59 -> "adults"; else -> "seniors" }
            }
            z[key] = z.getValue(key) + 1
        }
        return GRUPPEN.map { (k, l) -> Anteil(k, l, z.getValue(k), prozent(z.getValue(k), cur.size)) }
    }

    // ---- Zu- und Abgänge ----

    private val DATUM_ISO = Regex("""^(\d{4})[-./](\d{1,2})[-./](\d{1,2})""")
    private val DATUM_DE = Regex("""^(\d{1,2})[-./](\d{1,2})[-./](\d{4})""")

    /** (Jahr, Monat 0–11) aus Datum oder Zeitstempel. Zeitstempel mit Uhrzeit werden in Ortszeit umgerechnet. */
    fun jahrMonat(s: String?, zone: ZoneId = ZoneId.systemDefault()): Pair<Int, Int>? {
        val t = s?.trim().orEmpty()
        if (t.isEmpty()) return null
        if (t.contains('T') && (t.endsWith("Z") || t.contains('+'))) {
            runCatching { Instant.parse(t).atZone(zone) }.getOrNull()?.let { return it.year to it.monthValue - 1 }
        }
        DATUM_ISO.find(t)?.let { return it.groupValues[1].toInt() to it.groupValues[2].toInt() - 1 }
        DATUM_DE.find(t)?.let { return it.groupValues[3].toInt() to it.groupValues[2].toInt() - 1 }
        return null
    }

    private fun roh(m: Member, k: String) = (m.raw[k] as? JsonPrimitive)?.contentOrNull.orEmpty()

    /** Austritt: Austrittsdatum, sonst bei Status "Gekündigt" das Datum der letzten Änderung bzw. Anlage. Null: kein Austritt. */
    fun austrittsDatum(m: Member): String? {
        if (m.exitDate.isNotEmpty()) return m.exitDate
        if (m.status == "terminated") return roh(m, "updatedAt").ifEmpty { roh(m, "createdAt") }
        return null
    }

    private fun passt(m: Member, abteilung: String?) = abteilung == null || m.department == abteilung

    fun eintritte(members: List<Member>, jahr: Int?, abteilung: String?, zone: ZoneId = ZoneId.systemDefault()) =
        members.filter { m ->
            passt(m, abteilung) && m.entryDate.isNotEmpty() && jahrMonat(m.entryDate, zone)?.let { jahr == null || it.first == jahr } == true
        }

    fun austritte(members: List<Member>, jahr: Int?, abteilung: String?, zone: ZoneId = ZoneId.systemDefault()) =
        members.filter { m ->
            if (!passt(m, abteilung)) return@filter false
            val d = austrittsDatum(m) ?: return@filter false
            // Gekündigt ohne verwertbares Datum zählt bei "alle Jahre" trotzdem (wie am Desktop).
            val jm = jahrMonat(d, zone)
            if (m.exitDate.isEmpty() && jahr == null) true else jm?.let { jahr == null || it.first == jahr } == true
        }

    /** Jahre mit Eintritt oder Austritt (1951 bis nächstes Jahr), neueste zuerst. */
    fun verfuegbareJahre(members: List<Member>, aktuellesJahr: Int, zone: ZoneId = ZoneId.systemDefault()): List<Int> {
        val set = sortedSetOf<Int>()
        fun add(y: Int?) { if (y != null && y > 1950 && y <= aktuellesJahr + 1) set.add(y) }
        for (m in members) {
            add(jahrMonat(m.entryDate, zone)?.first)
            austrittsDatum(m)?.let { add(jahrMonat(it, zone)?.first) }
        }
        return set.toList().reversed()
    }

    /** Vorgabe: laufendes Jahr, sonst das jüngste vorhandene Jahr. */
    fun vorgabeJahr(verfuegbar: List<Int>, aktuellesJahr: Int): Int = if (aktuellesJahr in verfuegbar || verfuegbar.isEmpty()) aktuellesJahr else verfuegbar.first()

    fun monate(members: List<Member>, jahr: Int?, abteilung: String?, zone: ZoneId = ZoneId.systemDefault()): List<Monat> {
        val ein = eintritte(members, jahr, abteilung, zone).mapNotNull { jahrMonat(it.entryDate, zone)?.second }
        val aus = austritte(members, jahr, abteilung, zone).mapNotNull { m -> austrittsDatum(m)?.let { jahrMonat(it, zone)?.second } }
        return (0..11).map { i -> Monat(i, ein.count { it == i }, aus.count { it == i }) }
    }

    /** Die letzten bis zu fünf Jahre, ältestes zuerst. */
    fun mehrjahr(members: List<Member>, verfuegbar: List<Int>, abteilung: String?, zone: ZoneId = ZoneId.systemDefault()): List<Jahr> =
        verfuegbar.take(5).reversed().map { y ->
            Jahr(y, eintritte(members, y, abteilung, zone).size, austritte(members, y, abteilung, zone).size)
        }

    /** Ereignisliste, neueste zuerst. */
    fun ereignisse(members: List<Member>, jahr: Int?, abteilung: String?, zone: ZoneId = ZoneId.systemDefault()): List<Ereignis> {
        val e = eintritte(members, jahr, abteilung, zone).map { Ereignis(Art.EINTRITT, it.entryDate, it) }
        val a = austritte(members, jahr, abteilung, zone).map { Ereignis(Art.AUSTRITT, austrittsDatum(it).orEmpty(), it) }
        return (e + a).sortedByDescending { sortWert(it.datum, zone) }
    }

    private fun sortWert(d: String, zone: ZoneId): Long {
        val t = d.trim()
        if (t.contains('T')) runCatching { return Instant.parse(t).toEpochMilli() }
        val jm = DATUM_ISO.find(t)?.let { LocalDate.of(it.groupValues[1].toInt(), it.groupValues[2].toInt().coerceIn(1, 12), it.groupValues[3].toInt().coerceIn(1, 28)) }
            ?: DATUM_DE.find(t)?.let { LocalDate.of(it.groupValues[3].toInt(), it.groupValues[2].toInt().coerceIn(1, 12), it.groupValues[1].toInt().coerceIn(1, 28)) }
        return jm?.atStartOfDay(zone)?.toInstant()?.toEpochMilli() ?: 0L
    }

    fun suchen(e: List<Ereignis>, q: String, art: Art?): List<Ereignis> {
        val s = q.trim().lowercase(Locale.GERMANY)
        return e.filter { ev ->
            (art == null || ev.art == art) && (s.isEmpty() ||
                "${ev.member.firstName} ${ev.member.lastName}".lowercase(Locale.GERMANY).contains(s) ||
                ev.member.number.lowercase(Locale.GERMANY).contains(s) || ev.member.department.lowercase(Locale.GERMANY).contains(s))
        }
    }
}
