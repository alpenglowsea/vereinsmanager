package de.vereinsmanager.core.members

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.math.BigInteger
import java.text.Collator
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.Locale

/** Beschriftungen der festen Auswahlwerte (wie in der Desktop-Fassung, Funktionsinventar Mitglieder). */
object MemberLabels {
    val STATUS = linkedMapOf(
        // „Ehrenmitglied“ ist seit 25.11.2026 kein Status mehr, sondern eine Mitgliedsart (Mitgliedsarten.kt)
        "active" to "Aktiv", "passive" to "Passiv",
        "suspended" to "Ruhend", "terminated" to "Gekündigt",
    )
    // Die Namen der Mitgliedsarten kommen seit 25.11.2026 aus den Einstellungen: Mitgliedsarten.name / Mitgliedsarten.filter
    /** Entscheidung 7: auch Beitragsfrei. */
    val PAYMENT = linkedMapOf(
        "sepa" to "SEPA-Lastschrift", "transfer" to "Überweisung", "cash" to "Bargeld",
        "standing_order" to "Dauerauftrag", "exempt" to "Beitragsfrei",
    )
    /** Mandatsfolge der Lastschrift: das erste Mal FRST, danach RCUR. */
    val MANDATE_SEQUENCE = linkedMapOf("FRST" to "Erstlastschrift (erster Einzug)", "RCUR" to "Folgelastschrift (schon eingezogen)")
    /** Kurz für die Liste. Entscheidung 5: vierteljährlich heißt "viertelj.", nicht "halbj.". */
    val FEE_PERIOD_SHORT = linkedMapOf(
        "monthly" to "mtl.", "quarterly" to "viertelj.", "half_yearly" to "halbj.", "yearly" to "jährl.",
    )
    val FEE_PERIOD = linkedMapOf(
        "monthly" to "monatlich", "quarterly" to "vierteljährlich", "half_yearly" to "halbjährlich",
        "yearly" to "jährlich", "none" to "beitragsfrei",
    )
    val GENDER = linkedMapOf("m" to "männlich", "w" to "weiblich", "d" to "divers", "none" to "–")
}

/** Die für Liste und Detail nötigen Felder eines Mitglieds; das vollständige Dokument bleibt in [raw]. */
data class Member(
    val id: String,
    val number: String,
    val firstName: String,
    val lastName: String,
    val status: String,
    val type: String,
    val department: String,
    val entryDate: String,
    val exitDate: String,
    val birthDate: String,
    val gender: String,
    val street: String,
    val houseNumber: String,
    val zip: String,
    val city: String,
    val country: String,
    val phone: String,
    val email: String,
    val notes: String,
    val fee: BigDecimal,
    val feePeriod: String,
    val paymentMethod: String,
    val raw: JsonObject,
) {
    /** "Nachname, Vorname" */
    val displayName get() = listOf(lastName, firstName).filter { it.isNotEmpty() }.joinToString(", ")

    /** Zählt zu den aktuellen Mitgliedern: nicht gekündigt und nicht vom Typ "ausgetreten". */
    val isCurrent get() = status != "terminated" && type != "ausgetreten"

    val initials get() = (firstName.take(1) + lastName.take(1)).uppercase(Locale.GERMAN)

    companion object {
        private fun JsonObject.s(k: String) = (this[k] as? JsonPrimitive)?.contentOrNull ?: ""

        fun from(doc: JsonObject): Member {
            val a = doc["address"] as? JsonObject
            fun as_(k: String) = a?.s(k) ?: ""
            return Member(
                id = doc.s("id"), number = doc.s("memberNumber"),
                firstName = doc.s("firstName"), lastName = doc.s("lastName"),
                status = doc.s("status").ifEmpty { "active" }, type = doc.s("membershipType").ifEmpty { "full" },
                department = doc.s("department"), entryDate = doc.s("entryDate"), exitDate = doc.s("exitDate"),
                birthDate = doc.s("birthDate"), gender = doc.s("gender"),
                street = as_("street"), houseNumber = as_("houseNumber"), zip = as_("zip"),
                city = as_("city"), country = as_("country"),
                phone = doc.s("phone"), email = doc.s("email"), notes = doc.s("notes"),
                fee = doc.s("feeAmount").toBigDecimalOrNull() ?: BigDecimal.ZERO,
                feePeriod = doc.s("feePeriod"), paymentMethod = doc.s("paymentMethod"), raw = doc,
            )
        }
    }
}

enum class SortKey { NUMBER, NAME, STATUS, DEPARTMENT, ENTRY, CITY, FEE, PAYMENT }

data class MemberFilter(
    val search: String = "",
    val status: String? = null,
    val department: String? = null,
    val type: String? = null,
    val payment: String? = null,
)

data class DepartmentCount(val name: String, val count: Int, val percent: Int)

data class MemberStats(
    val total: Int, val active: Int, val passive: Int,
    val activePercent: Int, val passivePercent: Int,
    val departments: List<DepartmentCount>,
)

object MemberList {
    const val NO_DEPARTMENT = "Ohne Sparte"

    private val collator: Collator = Collator.getInstance(Locale.GERMAN).apply { strength = Collator.SECONDARY }

    /** Vergleich mit festen deutschen Regeln (Entscheidung 14), unabhängig von der Gerätesprache. */
    fun compareText(a: String, b: String): Int = collator.compare(a, b)

    /** "M-2" vor "M-10": Zifferngruppen zählen als Zahl. */
    fun naturalCompare(a: String, b: String): Int {
        val ra = Regex("\\d+|\\D+").findAll(a).map { it.value }.toList()
        val rb = Regex("\\d+|\\D+").findAll(b).map { it.value }.toList()
        for (i in 0 until minOf(ra.size, rb.size)) {
            val x = ra[i]
            val y = rb[i]
            val c = if (x[0].isDigit() && y[0].isDigit()) BigInteger(x).compareTo(BigInteger(y)) else compareText(x, y)
            if (c != 0) return c
        }
        return ra.size.compareTo(rb.size)
    }

    fun matches(m: Member, f: MemberFilter): Boolean {
        if (f.status != null && m.status != f.status) return false
        if (f.department != null && m.department != f.department) return false
        if (f.type != null && m.type != f.type) return false
        if (f.payment != null && m.paymentMethod != f.payment) return false
        val q = f.search.trim().lowercase(Locale.GERMAN)
        if (q.isEmpty()) return true
        return listOf(m.number, m.firstName, m.lastName, m.email, m.phone, m.department, m.city, m.zip, m.notes)
            .any { it.lowercase(Locale.GERMAN).contains(q) }
    }

    fun filter(members: List<Member>, f: MemberFilter) = members.filter { matches(it, f) }

    fun sort(members: List<Member>, key: SortKey, ascending: Boolean = true): List<Member> {
        val nameCmp = Comparator<Member> { a, b ->
            val c = compareText(a.lastName, b.lastName)
            if (c != 0) c else compareText(a.firstName, b.firstName)
        }
        val cmp: Comparator<Member> = when (key) {
            SortKey.NUMBER -> Comparator { a, b -> naturalCompare(a.number, b.number) }
            SortKey.NAME -> nameCmp
            SortKey.STATUS -> Comparator { a, b -> compareText(MemberLabels.STATUS[a.status] ?: a.status, MemberLabels.STATUS[b.status] ?: b.status) }
            SortKey.DEPARTMENT -> Comparator { a, b -> compareText(a.department, b.department) }
            SortKey.ENTRY -> Comparator { a, b -> a.entryDate.compareTo(b.entryDate) }
            SortKey.CITY -> Comparator { a, b -> compareText(a.city, b.city) }
            SortKey.FEE -> Comparator { a, b -> a.fee.compareTo(b.fee) }
            SortKey.PAYMENT -> Comparator { a, b -> compareText(a.paymentMethod, b.paymentMethod) }
        }
        val sorted = members.sortedWith(cmp.then(nameCmp))
        return if (ascending) sorted else sorted.reversed()
    }

    private fun percent(part: Int, total: Int) = if (total == 0) 0 else Math.round(part * 100.0 / total).toInt()

    /**
     * Kacheln oben in der Liste. Annahmen, die am Desktop-Code nicht eindeutig waren und noch geprüft werden:
     * Die Sparten-Kachel zählt nur aktuelle Mitglieder; Sparten, die nicht in den Einstellungen stehen, fehlen.
     */
    fun stats(members: List<Member>, departmentsFromSettings: List<String>): MemberStats {
        val current = members.filter { it.isCurrent }
        val total = current.size
        val active = current.count { it.status == "active" }
        val passive = current.count { it.status == "passive" }
        val rows = (departmentsFromSettings.map { d -> d to current.count { it.department == d } } +
            (NO_DEPARTMENT to current.count { it.department.isBlank() }))
            .sortedWith(compareByDescending<Pair<String, Int>> { it.second }.thenBy { it.first })
            .map { DepartmentCount(it.first, it.second, percent(it.second, total)) }
        return MemberStats(total, active, passive, percent(active, total), percent(passive, total), rows)
    }

    fun age(birthDate: String, today: LocalDate): Int? {
        val b = try { LocalDate.parse(birthDate) } catch (e: DateTimeParseException) { return null }
        var years = today.year - b.year
        if (today.monthValue < b.monthValue || (today.monthValue == b.monthValue && today.dayOfMonth < b.dayOfMonth)) years--
        return if (years < 0) null else years
    }

    fun membershipDuration(entryDate: String, today: LocalDate): String? {
        val e = try { LocalDate.parse(entryDate) } catch (ex: DateTimeParseException) { return null }
        val years = age(e.toString(), today) ?: return null
        return when {
            years < 1 -> "Neu im Verein (< 1 Jahr)"
            years == 1 -> "1 Jahr im Verein"
            else -> "$years Jahre im Verein"
        }
    }
}
