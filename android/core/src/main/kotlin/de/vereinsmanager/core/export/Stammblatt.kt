package de.vereinsmanager.core.export

import de.vereinsmanager.core.members.Iban
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberLabels
import de.vereinsmanager.core.members.Zeit
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate

/** Ein Abschnitt des Stammblatts: Titel und Zeilen mit je vier Zellen (Bezeichnung, Wert, Bezeichnung, Wert). */
data class StammblattAbschnitt(val titel: String, val zeilen: List<List<String>>, val breiten: List<Int>)

data class StammblattDaten(
    val verein: String,
    val kopf1: String,
    val kopf2: String,
    val titel: String,
    val erstellt: String,
    val abschnitte: List<StammblattAbschnitt>,
    val notizenTitel: String,
    val notizen: String,
    val datenschutz: String,
    val dateiname: String,
)

object Stammblatt {
    private fun t(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    /** Vereinsanschrift: Text oder Objekt (Straße Hausnummer, PLZ Ort). */
    fun vereinsAnschrift(settings: JsonObject?): String {
        val a = settings?.get("address")
        if (a is JsonPrimitive) return a.contentOrNull?.trim().orEmpty()
        if (a is JsonObject) {
            val strasse = listOf(t(a, "street"), t(a, "houseNumber")).filter { it.isNotEmpty() }.joinToString(" ")
            val ort = listOf(t(a, "zip"), t(a, "city")).filter { it.isNotEmpty() }.joinToString(" ")
            return listOf(strasse, ort).filter { it.isNotEmpty() }.joinToString(", ")
        }
        return ""
    }

    private fun d(iso: String) = if (iso.isEmpty()) "–" else Zeit.deutsch(iso)
    private fun o(s: String) = s.ifEmpty { "–" }

    /**
     * Inhalt wie am Desktop. Abweichung: Status, Typ und Zahlart stehen in deutscher Schreibweise statt als englische
     * Kennung in Großbuchstaben (ACTIVE, FULL).
     */
    fun erstellen(m: Member, settings: JsonObject?, heute: LocalDate): StammblattDaten {
        val verein = t(settings, "clubName").ifEmpty { "Verein" }
        val bank = m.raw["bankDetails"] as? JsonObject
        val consent = (m.raw["dataPrivacyConsent"] as? JsonPrimitive)?.content == "true"
        val gender = when (m.gender) { "m" -> "Männlich"; "w" -> "Weiblich"; "d" -> "Divers"; else -> "–" }
        val basis = listOf(
            listOf("Mitgliedsnummer:", m.number, "Status:", MemberLabels.STATUS[m.status] ?: m.status),
            listOf("Vollständiger Name:", "${m.firstName} ${m.lastName}".trim(), "Geschlecht:", gender),
            listOf("Geburtsdatum:", d(m.birthDate), "Abteilung:", m.department),
            listOf("Straße / Hausnr.:", "${m.street} ${m.houseNumber}".trim(), "Eintrittsdatum:", d(m.entryDate)),
            listOf("PLZ / Wohnort:", "${m.zip} ${m.city}".trim(), "Austrittsdatum:", d(m.exitDate)),
            listOf("Telefonnummer:", o(m.phone), "E-Mail-Adresse:", o(m.email)),
        )
        val rhythmus = when (m.feePeriod) { "yearly" -> "Jährlich"; "half_yearly" -> "Halbjährlich"; "quarterly" -> "Vierteljährlich"; "none" -> "Beitragsfrei"; else -> "Monatlich" }
        val zahlung = listOf(
            listOf("Mitgliedschaftstyp:", de.vereinsmanager.core.members.Mitgliedsarten.name(de.vereinsmanager.core.members.Mitgliedsarten.lesen(settings), m.type), "Beitragshöhe:", "${Export.fixed2(m.fee).replace('.', ',')} €"),
            listOf("Zahlungsrhythmus:", rhythmus, "Zahlungsmethode:", MemberLabels.PAYMENT[m.paymentMethod] ?: m.paymentMethod),
            listOf("Kontoinhaber:", o(t(bank, "accountHolder")), "Kreditinstitut:", o(t(bank, "bankName"))),
            listOf("IBAN:", o(Iban.gruppiert(t(bank, "iban"))), "BIC:", o(t(bank, "bic"))),
            listOf("SEPA-Mandatsreferenz:", o(t(bank, "mandateReference")), "Mandatsdatum:", d(t(bank, "mandateDate"))),
        )
        return StammblattDaten(
            verein = verein,
            kopf1 = listOf(vereinsAnschrift(settings), t(settings, "email")).filter { it.isNotEmpty() }.joinToString(" | "),
            kopf2 = listOf(t(settings, "associationNumber"), "Steuernummer: ${t(settings, "taxNumber")}".takeIf { t(settings, "taxNumber").isNotEmpty() })
                .filterNotNull().filter { it.isNotEmpty() }.joinToString(" | "),
            titel = "Mitglieder-Stammblatt & Datennachweis",
            erstellt = "Erstellt am: ${Zeit.deutsch(heute.toString())}",
            abschnitte = listOf(
                StammblattAbschnitt("1. Persönliche Stammdaten", basis, listOf(35, 55, 35, 55)),
                StammblattAbschnitt("2. Beitrags- & Zahlungsmodalitäten", zahlung, listOf(38, 52, 35, 55)),
            ),
            notizenTitel = "3. Notizen & Datenschutzhinweis (DSGVO Art. 13/14)",
            notizen = "Interne Notizen: ${m.notes.ifEmpty { "Keine besonderen Vermerke." }}",
            datenschutz = "Datenschutzstatus: Das Mitglied hat der zweckgebundenen Erhebung, Speicherung und Verarbeitung der oben genannten Daten " +
                "für Zwecke der Vereinsverwaltung und satzungsgemäßen Betreuung gem. Art. 6 Abs. 1 lit. b DSGVO zugestimmt. " +
                "(${if (consent) "Einwilligung erteilt" else "Keine gesonderte Einwilligung"})",
            dateiname = "stammblatt_${m.number}_${m.lastName}.pdf",
        )
    }
}
