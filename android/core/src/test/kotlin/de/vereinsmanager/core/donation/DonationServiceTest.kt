package de.vereinsmanager.core.donation

import de.vereinsmanager.core.backup.BackupFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate

/** Portiert aus donationService.test.ts; dazu Tests für "Betrag in Worten" und mit der Demo-Sicherung. */
class DonationServiceTest {
    private val stamm = ClubTaxSettings(
        clubName = "Strelitzer FC e.V.",
        address = ClubAddress.Structured("Gottfried-Keller-Straße", "1", "17235", "Neustrelitz"),
        taxNumber = "075/142/03436", taxOffice = "Waren (Müritz)",
        taxExemptionDate = "24.07.2025", taxStatementDate = "24.07.2025", taxAssessmentPeriod = "2022 - 2024",
        promotedPurposes = "Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)",
    )

    private fun beleg(r: DonationReceipt = DonationReceipt()) = r.copy(
        id = "a", receiptNumber = "ZB-1", amount = BigDecimal.ONE, amountInWords = "ein Euro",
    )

    // --- Steuerangaben ---
    @Test fun angabenKommenAusDenStammdaten() {
        val a = DonationService.ermittleSteuerangaben(beleg(), stamm)
        assertEquals("Waren (Müritz)", a.finanzamt)
        assertEquals("075/142/03436", a.steuernummer)
        assertEquals("24.07.2025", a.freistellungsDatum)
        assertEquals("24.07.2025", a.feststellungsDatum)
        assertEquals("2022 - 2024", a.veranlagungszeitraum)
    }

    @Test fun angabenAendernSichMitDenStammdaten() {
        val neu = stamm.copy(taxExemptionDate = "15.03.2027", taxAssessmentPeriod = "2024 - 2026")
        val a = DonationService.ermittleSteuerangaben(beleg(), neu)
        assertEquals("15.03.2027", a.freistellungsDatum)
        assertEquals("2024 - 2026", a.veranlagungszeitraum)
    }

    @Test fun ausgestellteBescheinigungBehaeltIhreAngaben() {
        val a = DonationService.ermittleSteuerangaben(
            beleg(DonationReceipt(exemptionDate = "2023-02-01", assessmentPeriod = "2020 - 2022")), stamm,
        )
        assertEquals("01.02.2023", a.freistellungsDatum)
        assertEquals("2020 - 2022", a.veranlagungszeitraum)
    }

    @Test fun erfindetNichts() {
        val a = DonationService.ermittleSteuerangaben(beleg(), ClubTaxSettings(clubName = "V"))
        assertEquals(Steuerangaben("", "", "", "", "", "", "", ""), a)
    }

    @Test fun zweckWirdFuerDreiStellenZerlegt() {
        val a = DonationService.ermittleSteuerangaben(beleg(), stamm)
        assertEquals("des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)", a.zweckMitVerweis)
        assertEquals("des Sports", a.zweckKurz)
        assertEquals("Förderung des Sports", a.zweckSatzung)
    }

    @Test fun zweckMitGrossgeschriebenemPraefix() {
        val a = DonationService.ermittleSteuerangaben(
            beleg(DonationReceipt(promotedPurpose = "DIE FÖRDERUNG des Sports")), stamm,
        )
        assertEquals("des Sports", a.zweckMitVerweis)
    }

    @Test fun fehlendeStammdaten() {
        assertEquals(emptyList<String>(), DonationService.fehlendeSteuerangaben(stamm))
        val luecke = stamm.copy(taxNumber = "", taxExemptionDate = "", taxStatementDate = "", promotedPurposes = " ")
        assertEquals(
            listOf("Steuernummer", "Datum Freistellungs- oder Feststellungsbescheid", "Steuerbegünstigte Zwecke"),
            DonationService.fehlendeSteuerangaben(luecke),
        )
    }

    // --- Ort und Adresse ---
    @Test fun ortAusObjektUndFreitext() {
        assertEquals("Neustrelitz", DonationService.vereinsOrt(stamm.address))
        assertEquals("Neustrelitz", DonationService.vereinsOrt(ClubAddress.FreeText("Gottfried-Keller-Straße 1, 17235 Neustrelitz")))
        assertEquals("", DonationService.vereinsOrt(ClubAddress.FreeText("irgendwo")))
        assertEquals("", DonationService.vereinsOrt(null))
    }

    @Test fun ortUndDatum() {
        val d = LocalDate.of(2025, 7, 28)
        assertEquals("Neustrelitz, 28.07.2025", DonationService.standardOrtUndDatum(stamm, d))
        assertEquals("28.07.2025", DonationService.standardOrtUndDatum(stamm.copy(address = ClubAddress.FreeText("")), d))
    }

    @Test fun adresszeilen() {
        assertEquals(listOf("Gottfried-Keller-Straße 1", "17235 Neustrelitz"), DonationService.adresszeilen(stamm.address))
        assertEquals(
            listOf("Musterweg 3", "12345 Beispielstadt"),
            DonationService.adresszeilen(ClubAddress.FreeText("Musterweg 3, 12345 Beispielstadt")),
        )
        assertEquals(emptyList<String>(), DonationService.adresszeilen(null))
    }

    // --- Betrag in Worten ---
    private fun w(s: String) = DonationService.numberToGermanWords(BigDecimal(s))

    @Test fun wortePlain() {
        assertEquals("Null Euro", w("0"))
        assertEquals("Null Euro", w("-5"))
        assertEquals("Zwei Euro", w("2"))
        assertEquals("Elf Euro", w("11"))
        assertEquals("Zwölf Euro", w("12"))
        assertEquals("Einundzwanzig Euro", w("21"))
        assertEquals("Neunundneunzig Euro", w("99"))
        assertEquals("Einhundert Euro", w("100"))
        assertEquals("Einhundertelf Euro", w("111"))
        assertEquals("Einhunderteinundzwanzig Euro", w("121"))
        assertEquals("Neunhundertneunundneunzig Euro", w("999"))
        assertEquals("Eintausend Euro", w("1000"))
        assertEquals("Eintausendeinhundert Euro", w("1100"))
        assertEquals("Einundzwanzigtausend Euro", w("21000"))
        assertEquals("Einhunderteintausend Euro", w("101000"))
        assertEquals("Eintausendfünfhundert Euro", w("1500"))
        assertEquals("Zweitausendfünfhundert Euro und fünfundsiebzig Cent", w("2500.75"))
        assertEquals("Zwölf Euro und vierunddreißig Cent", w("12.34"))
        assertEquals("Eine Million Euro", w("1000000"))
        assertEquals("Zwei Millionen Euro", w("2000000"))
        assertEquals(
            "Eine Million zweihundertvierunddreißigtausendfünfhundertsiebenundsechzig Euro und neunundachtzig Cent",
            w("1234567.89"),
        )
        assertEquals("Null Euro und fünfzig Cent", w("0.5"))
    }

    /** Hier weicht Kotlin bewusst vom Desktop ab (dort: "Eins Euro", "Einhundertein", "eins Cent"). */
    @Test fun woerteMitEinsAmEnde() {
        assertEquals("Ein Euro", w("1"))
        assertEquals("Ein Euro und ein Cent", w("1.01"))
        assertEquals("Null Euro und ein Cent", w("0.01"))
        assertEquals("Einhunderteins Euro", w("101"))
        assertEquals("Zweihunderteins Euro", w("201"))
        assertEquals("Eintausendeins Euro", w("1001"))
        assertEquals("Eintausendeinhunderteins Euro", w("1101"))
        assertEquals("Einhunderttausendeins Euro", w("100001"))
        assertEquals("Eine Million eins Euro", w("1000001"))
        assertEquals("Einhunderteine Millionen Euro", w("101000000"))
    }

    @Test fun rundetAufCent() {
        assertEquals("Zwei Euro", w("1.999")) // 1,999 -> 2,00
    }

    // --- Mit der Demo-Sicherung ---
    @Test fun demoSpendenLassenSichLesenUndAusgeben() {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        val file = BackupFile.parse(text)
        val receipts = file.list("donations")!!.map { it.toDonationReceipt() }
        assertEquals(2, receipts.size)
        val settings = file.single("settings")!!.toClubTaxSettings()
        assertTrue(settings.clubName.isNotEmpty())
        // Jede Bescheinigung ergibt einen lesbaren Betrag in Worten.
        for (r in receipts) {
            assertTrue(r.receiptNumber.isNotEmpty())
            assertTrue(DonationService.numberToGermanWords(r.amount).endsWith("Euro") ||
                DonationService.numberToGermanWords(r.amount).endsWith("Cent"))
        }
    }
}
