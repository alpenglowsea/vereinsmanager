package de.vereinsmanager.core.export

import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.Gegenstand
import de.vereinsmanager.core.members.Iban
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Zeit
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale

/** CSV wie PapaParse.unparse (Semikolon, Zeilenende CRLF, Anführungszeichen nur wo nötig) plus BOM für Excel. */
object Csv {
    const val BOM = "﻿"

    private fun feld(s: String): String {
        val q = s.replace("\"", "\"\"")
        val braucht = q.contains('\r') || q.contains('\n') || q.contains('"') || q.contains(BOM) ||
            q.contains(';') || q.startsWith(" ") || q.endsWith(" ")
        return if (braucht) "\"$q\"" else q
    }

    /** Ohne Zeilen entsteht – wie am Desktop – eine leere Datei (nur BOM). */
    fun schreiben(kopf: List<String>, zeilen: List<List<String>>): String {
        if (zeilen.isEmpty()) return BOM
        return BOM + (listOf(kopf) + zeilen).joinToString("\r\n") { z -> z.joinToString(";") { feld(it) } }
    }

    /** Zeilenumbrüche werden zu Leerzeichen. */
    fun einzeilig(s: String) = s.replace(Regex("(\r\n|\n|\r)"), " ")
}

/** Eine Tabelle für die PDF-Ausgabe; gezeichnet wird in der App. [breiten] in Millimetern (A4 quer, 269 mm nutzbar). */
data class PdfTabelle(
    val verein: String,
    val titel: String,
    val kopfRechts: String,
    val spalten: List<String>,
    val breiten: List<Int>,
    val ausrichtung: List<Char>, // 'l', 'c', 'r'
    val zeilen: List<List<String>>,
    val fusszeile: String,
    /** Nummern der Zeilen (ab 0), die fett gedruckt werden, z. B. Summenzeilen. */
    val fett: Set<Int> = emptySet(),
)

object Export {
    private fun s(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.contentOrNull ?: ""
    private fun sub(o: JsonObject, a: String, k: String) = (o[a] as? JsonObject)?.let { s(it, k) } ?: ""

    /** Wie JavaScript toFixed(2): immer zwei Nachkommastellen, Punkt. */
    fun fixed2(v: BigDecimal): String = v.setScale(2, RoundingMode.HALF_UP).toPlainString()

    private fun deZahl(v: BigDecimal): String =
        NumberFormat.getNumberInstance(Locale.GERMANY).apply { minimumFractionDigits = 2; maximumFractionDigits = 2 }.format(v)

    fun datum(iso: String) = if (iso.isEmpty()) "" else Zeit.deutsch(iso)

    // ---------- Mitglieder ----------

    val MITGLIEDER_KOPF = listOf(
        "Mitgliedsnummer", "Nachname", "Vorname", "Geschlecht", "Geburtsdatum", "Straße", "Hausnummer", "PLZ", "Ort", "Land",
        "Telefon", "E-Mail", "Eintrittsdatum", "Austrittsdatum", "Status", "Abteilung", "Mitgliedschaftstyp", "Beitrag (EUR)",
        "Zahlungsweise", "Zahlungsmethode", "IBAN", "BIC", "Bankname", "Kontoinhaber", "Mandatsdatum", "Mandatsreferenz",
        "DSGVO-Einwilligung", "Notizen",
    )

    private fun statusText(s: String) = when (s) { "active" -> "Aktiv"; "passive" -> "Passiv"; "terminated" -> "Gekündigt"; else -> "Ruhend" }

    private fun periodeText(p: String) = when (p) {
        "monthly" -> "Monatlich"; "quarterly" -> "Vierteljährlich"; "half_yearly" -> "Halbjährlich"; "none" -> "Beitragsfrei"; else -> "Jährlich"
    }

    private fun zahlartText(p: String) = when (p) {
        "exempt" -> "Beitragsfrei"; "sepa" -> "SEPA-Lastschrift"; "transfer" -> "Überweisung"; "cash" -> "Bar"; else -> "Dauerauftrag"
    }

    /** [arten]: Mitgliedsarten aus den Einstellungen (seit 25.11.2026); daraus der Name der Art. */
    fun mitgliederZeile(m: Member, arten: List<de.vereinsmanager.core.members.MitgliedsArt> = de.vereinsmanager.core.members.Mitgliedsarten.STANDARD): List<String> {
        val gender = when (m.gender) { "m" -> "Männlich"; "w" -> "Weiblich"; "d" -> "Divers"; else -> "Keine Angabe" }
        val consent = (m.raw["dataPrivacyConsent"] as? JsonPrimitive)?.content == "true"
        return listOf(
            m.number, m.lastName, m.firstName, gender, m.birthDate, m.street, m.houseNumber, m.zip, m.city, m.country,
            m.phone, m.email, m.entryDate, m.exitDate, statusText(m.status), m.department, de.vereinsmanager.core.members.Mitgliedsarten.name(arten, m.type), fixed2(m.fee),
            periodeText(m.feePeriod), zahlartText(m.paymentMethod),
            Iban.gruppiert(sub(m.raw, "bankDetails", "iban")), sub(m.raw, "bankDetails", "bic"), sub(m.raw, "bankDetails", "bankName"),
            sub(m.raw, "bankDetails", "accountHolder"), sub(m.raw, "bankDetails", "mandateDate"), sub(m.raw, "bankDetails", "mandateReference"),
            if (consent) "Ja" else "Nein", Csv.einzeilig(m.notes),
        )
    }

    fun mitgliederCsv(members: List<Member>, arten: List<de.vereinsmanager.core.members.MitgliedsArt> = de.vereinsmanager.core.members.Mitgliedsarten.STANDARD): String =
        Csv.schreiben(MITGLIEDER_KOPF, members.map { mitgliederZeile(it, arten) })

    fun mitgliederPdf(members: List<Member>, verein: String, heute: LocalDate, titel: String = "Mitgliederliste"): PdfTabelle {
        fun status(s: String) = when (s) { "active" -> "Aktiv"; "passive" -> "Passiv"; "terminated" -> "Gekündigt"; else -> "Ruhend" }
        fun periode(p: String) = when (p) { "yearly" -> "J."; "none" -> "Frei"; "quarterly" -> "Q."; "half_yearly" -> "H."; else -> "M." }
        fun zahlung(p: String) = when (p) { "exempt" -> "Frei"; "sepa" -> "SEPA"; "transfer" -> "Überw."; else -> "Bar" }
        return PdfTabelle(
            verein, titel, "Stand: ${Zeit.deutsch(heute.toString())} | Gesamt: ${members.size} Mitglieder",
            listOf("Nr.", "Name, Vorname", "Abteilung", "Status", "Telefon", "E-Mail", "Wohnort", "Eintritt", "Beitrag", "Zahlung"),
            listOf(18, 40, 26, 18, 28, 44, 32, 20, 23, 18),
            listOf('l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'),
            members.map { m ->
                listOf(
                    m.number, "${m.lastName}, ${m.firstName}", m.department, status(m.status), m.phone.ifEmpty { "–" }, m.email.ifEmpty { "–" },
                    "${m.zip} ${m.city}".trim(), if (m.entryDate.isEmpty()) "–" else datum(m.entryDate),
                    "${deZahl(m.fee)} € / ${if (m.paymentMethod == "exempt" || m.feePeriod == "none") "Frei" else periode(m.feePeriod)}", zahlung(m.paymentMethod),
                )
            },
            "$verein - Vertrauliche Mitgliederdaten gem. DSGVO",
        )
    }

    fun dateiname(text: String) = text.trim().replace(Regex("[^A-Za-z0-9äöüÄÖÜß_-]+"), "_").trim('_').ifEmpty { "Verein" }

    // ---------- Material ----------

    val MATERIAL_KOPF = listOf(
        "Mitgliedsnummer", "Mitglied Name", "Abteilung", "Inventarnummer", "Gegenstand", "Menge", "Einheit", "Ausgabedatum", "Status",
        "Rückgabedatum", "Eigenanteil", "Eigenanteil Betrag (EUR)", "Notizen",
    )

    private fun betragOderNull(a: Ausgabe): BigDecimal? = a.contribution?.takeIf { a.hasContribution && it.signum() != 0 }

    fun materialZeile(a: Ausgabe, m: Member?, inv: Gegenstand?): List<String> = listOf(
        m?.number ?: "", m?.let { "${it.lastName}, ${it.firstName}" } ?: "", m?.department ?: "",
        a.itemNumber.ifEmpty { inv?.nummer ?: "" }, a.raw.let { s(it, "itemName") }.ifEmpty { inv?.name ?: "" },
        a.quantity.toString(), a.unit.ifEmpty { inv?.einheit ?: "Stk." }, a.issueDate,
        if (a.returned) "Zurückgegeben" else "Ausgegeben", a.returnDate,
        if (a.hasContribution) "Ja" else "Nein", betragOderNull(a)?.let { fixed2(it) } ?: "0.00", Csv.einzeilig(a.notes),
    )

    fun materialCsv(ausgaben: List<Ausgabe>, members: List<Member>, inventar: List<Gegenstand>): String {
        val mm = members.associateBy { it.id }
        val im = inventar.associateBy { it.id }
        return Csv.schreiben(MATERIAL_KOPF, ausgaben.map { materialZeile(it, mm[it.memberId], im[it.itemId]) })
    }

    fun materialPdf(ausgaben: List<Ausgabe>, members: List<Member>, inventar: List<Gegenstand>, verein: String, heute: LocalDate): PdfTabelle {
        val mm = members.associateBy { it.id }
        val im = inventar.associateBy { it.id }
        val aktiv = ausgaben.count { !it.returned }
        val summe = ausgaben.mapNotNull { betragOderNull(it) }.fold(BigDecimal.ZERO) { x, y -> x + y }
        return PdfTabelle(
            verein, "Übersicht ausgeteilter Gegenstände & Materialausgabe",
            "Stand: ${Zeit.deutsch(heute.toString())} | Gesamt: ${ausgaben.size} Zuweisungen ($aktiv aktiv) | Eigenanteil gesamt: ${deZahl(summe)} €",
            listOf("Mitglied", "Inventar-Nr.", "Gegenstand", "Menge", "Ausgabedatum", "Status", "Eigenanteil", "Bemerkung"),
            listOf(50, 26, 60, 20, 24, 28, 24, 37),
            listOf('l', 'l', 'l', 'c', 'c', 'l', 'r', 'l'),
            ausgaben.map { a ->
                val m = mm[a.memberId]
                val inv = im[a.itemId]
                listOf(
                    m?.let { "${it.lastName}, ${it.firstName} (${it.number})" } ?: "Unbekannt",
                    a.itemNumber.ifEmpty { inv?.nummer ?: "" }.ifEmpty { "–" },
                    s(a.raw, "itemName").ifEmpty { inv?.name ?: "Gegenstand" },
                    "${a.quantity} ${a.unit.ifEmpty { inv?.einheit ?: "Stk." }}",
                    if (a.issueDate.isEmpty()) "–" else datum(a.issueDate),
                    if (a.returned) "Zurück (${datum(a.returnDate)})" else "Ausgegeben",
                    if (a.hasContribution) "${deZahl(a.contribution ?: BigDecimal.ZERO)} €" else "–",
                    a.notes,
                )
            },
            "$verein - Material- & Inventarnutzung",
        )
    }
}

/** Übersicht "Alle ausgeteilten Gegenstände": Kennzahlen, Suche, Filter. */
object MaterialUebersicht {
    enum class Filter { ALLE, AUSGEGEBEN, ZURUECK }

    data class Kennzahlen(val gesamt: Int, val ausgegeben: Int, val zurueck: Int, val eigenanteil: BigDecimal)

    fun kennzahlen(l: List<Ausgabe>) = Kennzahlen(
        l.size, l.count { !it.returned }, l.count { it.returned },
        l.mapNotNull { a -> a.contribution?.takeIf { a.hasContribution } }.fold(BigDecimal.ZERO) { x, y -> x + y },
    )

    fun filtern(l: List<Ausgabe>, members: List<Member>, suche: String, filter: Filter): List<Ausgabe> {
        val mm = members.associateBy { it.id }
        val q = suche.trim().lowercase(Locale.GERMANY)
        return l.filter { a ->
            val ok = when (filter) { Filter.ALLE -> true; Filter.AUSGEGEBEN -> !a.returned; Filter.ZURUECK -> a.returned }
            ok && (q.isEmpty() || listOf(mm[a.memberId]?.let { "${it.lastName} ${it.firstName} ${it.number}" } ?: "Unbekanntes Mitglied", a.itemName, a.itemNumber, a.notes)
                .any { it.lowercase(Locale.GERMANY).contains(q) })
        }.sortedWith(compareByDescending<Ausgabe> { it.issueDate }.thenBy { it.id })
    }
}
