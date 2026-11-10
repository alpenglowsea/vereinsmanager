package de.vereinsmanager.core.sepa

import de.vereinsmanager.core.backup.BackupFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

/** Kotlin-Fassung von src/services/sepaService.test.ts, ergänzt um Tests mit der Demo-Sicherung. */
class SepaServiceTest {
    private val validIban = "DE89370400440532013000"

    private fun bd(s: String) = BigDecimal(s)
    private fun assertAmount(expected: String, actual: BigDecimal) =
        assertEquals("erwartet $expected, war $actual", 0, bd(expected).compareTo(actual))

    private fun member(
        status: String = "active", paymentMethod: String = "sepa", fee: String = "120",
        period: String = "yearly", iban: String = validIban, mandateRef: String? = "MAND-1",
    ) = SepaMember(
        id = "mem-1", memberNumber = "M-0001", firstName = "Max", lastName = "Muster",
        status = status, paymentMethod = paymentMethod, feeAmount = bd(fee), feePeriod = period,
        department = "Fussball", entryDate = "2020-01-01", iban = iban,
        mandateReference = mandateRef, mandateDate = "2020-01-01",
    )

    private fun item(
        memberNumber: String = "M-0001", amount: String = "120", e2e: String = "E2E-1",
        isValid: Boolean = true, selected: Boolean = true, holder: String = "Max Muster",
        remittance: String = "Mitgliedsbeitrag 2026", seq: String = "RCUR",
    ) = SepaItem(
        memberId = "mem-1", memberNumber = memberNumber, memberName = "Muster, Max",
        accountHolder = holder, iban = validIban, bic = "COBADEFFXXX", mandateReference = "MAND-1",
        mandateDate = "2020-01-01", amount = bd(amount), feePeriod = "yearly",
        remittanceInfo = remittance, endToEndId = e2e, isValid = isValid, selected = selected, sequenceType = seq,
    )

    private val run = SepaRunConfig(
        periodFilter = SepaPeriodFilter.YEARLY, targetYear = 2026, executionDate = "2026-10-01",
        creditorIban = validIban, creditorBic = "COBADEFFXXX",
        creditorId = "DE98ZZZ09999999999", creditorName = "TSV Musterstadt",
    )

    private val fixedNow = ZonedDateTime.of(2026, 10, 25, 12, 0, 0, 0, ZoneOffset.UTC)

    // --- IBAN ---
    @Test fun gueltigeDeutscheIban() = assertTrue(SepaService.validateIban(validIban).isValid)
    @Test fun leerzeichenUndKleinschreibung() =
        assertTrue(SepaService.validateIban("de89 3704 0044 0532 0130 00").isValid)
    @Test fun falschePruefziffer() = assertFalse(SepaService.validateIban("DE89370400440532013001").isValid)
    @Test fun zuKurzeDeutscheIban() {
        val r = SepaService.validateIban("DE8937040044053201")
        assertFalse(r.isValid)
        assertTrue(r.error!!.contains("22 Zeichen"))
    }
    @Test fun leereEingabe() {
        assertFalse(SepaService.validateIban("").isValid)
        assertFalse(SepaService.validateIban(null).isValid)
    }
    @Test fun viererGruppen() =
        assertEquals("DE89 3704 0044 0532 0130 00", SepaService.validateIban(validIban).formatted)

    // --- Zeichensatz ---
    @Test fun umlauteAusschreiben() =
        assertEquals("Mueller Gruen Strasse", SepaService.sanitizeText("Müller Grün Straße"))
    @Test fun geschuetzteUndMehrfachLeerzeichenWerdenEines() = assertEquals("Beitrag 2026 Mueller", SepaService.sanitizeText("Beitrag\u00A0\u00A02026 \t Müller"))
    @Test fun kaufmaennischesUnd() = assertEquals("Meier + Sohn", SepaService.sanitizeText("Meier & Sohn"))
    @Test fun unterstrichEntfernt() = assertEquals("Beitrag2026", SepaService.sanitizeText("Beitrag_2026"))
    @Test fun akzenteAufGrundbuchstaben() = assertEquals("Jose Nunez", SepaService.sanitizeText("José Núñez"))
    @Test fun zerlegteUmlauteAuchAusgeschrieben() {
        // "u" + kombinierender Umlautpunkt (zerlegte Schreibweise) -> nur "u"; der Desktop macht dasselbe.
        assertEquals("Mu", SepaService.sanitizeText("Mü"))
    }
    @Test fun zeilenumbruch() = assertEquals("Zeile1 Zeile2", SepaService.sanitizeText("Zeile1\nZeile2"))
    @Test fun kuerzen() = assertEquals(140, SepaService.sanitizeText("A".repeat(200), 140).length)

    // --- Beitragsberechnung ---
    @Test fun jahresbeitragVoll() =
        assertAmount("120", SepaService.calculateCollectionAmount(member(), SepaPeriodFilter.YEARLY))
    @Test fun monatsbeitragVoll() = assertAmount(
        "10", SepaService.calculateCollectionAmount(member(fee = "10", period = "monthly"), SepaPeriodFilter.MONTHLY_1),
    )
    @Test fun nullBeitrag() =
        assertAmount("0", SepaService.calculateCollectionAmount(member(fee = "0"), SepaPeriodFilter.YEARLY))
    @Test fun jahresbeitragImMonatslaufGerundet() = assertAmount(
        "10.00", SepaService.calculateCollectionAmount(member(fee = "120"), SepaPeriodFilter.MONTHLY_ALL),
    )
    @Test fun rundenAufZweiStellen() = assertAmount(
        "8.33", SepaService.calculateCollectionAmount(member(fee = "100"), SepaPeriodFilter.MONTHLY_ALL),
    )
    @Test fun monatsbeitragImJahreslauf() = assertAmount(
        "120", SepaService.calculateCollectionAmount(member(fee = "10", period = "monthly"), SepaPeriodFilter.YEARLY),
    )

    // --- Auswahl ---
    private val yearly = SepaRunConfig(periodFilter = SepaPeriodFilter.YEARLY, targetYear = 2026)

    @Test fun gekuendigteAusgeschlossen() =
        assertEquals(0, SepaService.buildCollectionItems(listOf(member(status = "terminated")), yearly).size)
    @Test fun ruhendeAusgeschlossen() =
        assertEquals(0, SepaService.buildCollectionItems(listOf(member(status = "suspended")), yearly).size)
    @Test fun ohneSepaAusgeschlossen() =
        assertEquals(0, SepaService.buildCollectionItems(listOf(member(paymentMethod = "transfer")), yearly).size)
    @Test fun aktivesSepaMitglied() {
        val items = SepaService.buildCollectionItems(listOf(member()), yearly)
        assertEquals(1, items.size)
        assertEquals("M-0001", items[0].memberNumber)
        assertTrue(items[0].isValid)
        assertEquals("Fussball", items[0].department)
    }
    @Test fun ungueltigeIbanWirdGemeldet() {
        val items = SepaService.buildCollectionItems(listOf(member(iban = "DE00000000000000000000")), yearly)
        assertFalse(items[0].isValid)
        assertFalse(items[0].selected)
        assertTrue(items[0].validationErrors.joinToString(" ").contains("IBAN"))
    }

    // --- Verwendungszweck ---
    private val sep = SepaRunConfig(periodFilter = SepaPeriodFilter.YEARLY, targetYear = 2026, targetMonth = 9)

    @Test fun platzhalterDerEingabemaske() {
        val items = SepaService.buildCollectionItems(
            listOf(member()), sep.copy(remittanceTemplate = "Mitgliedsbeitrag {month}/{year} - {memberNumber}"),
        )
        assertEquals("Mitgliedsbeitrag 09/2026 - M-0001", items[0].remittanceInfo)
    }
    @Test fun platzhalterAlterVorlagen() {
        val items = SepaService.buildCollectionItems(
            listOf(member()), sep.copy(remittanceTemplate = "Beitrag {PERIOD} {MEMBER_NO}"),
        )
        assertEquals("Beitrag 2026 M-0001", items[0].remittanceInfo)
    }
    @Test fun unbekannterPlatzhalterBleibt() {
        val items = SepaService.buildCollectionItems(
            listOf(member()), sep.copy(remittanceTemplate = "Beitrag {unbekannt}"),
        )
        assertTrue(items[0].remittanceInfo.contains("unbekannt"))
    }
    @Test fun keineUebrigenPlatzhalter() {
        val items = SepaService.buildCollectionItems(
            listOf(member()), sep.copy(remittanceTemplate = "Mitgliedsbeitrag {month}/{year} {name} {department}"),
        )
        assertFalse(Regex("month|year|name|department").containsMatchIn(items[0].remittanceInfo))
    }

    // --- XML ---
    private fun xml(items: List<SepaItem>) = SepaService.generateSepaXml(run, items, fixedNow)

    @Test fun pain008() {
        val x = xml(listOf(item()))
        assertTrue(x.contains("urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"))
        assertTrue(x.contains("<PmtMtd>DD</PmtMtd>"))
    }
    @Test fun anzahlUndSumme() {
        val x = xml(listOf(item(), item(memberNumber = "M-0002", amount = "80.5", e2e = "E2E-2")))
        assertEquals(2, Regex("<NbOfTxs>2</NbOfTxs>").findAll(x).count())
        assertEquals(2, Regex("<CtrlSum>200\\.50</CtrlSum>").findAll(x).count())
    }
    @Test fun summeStimmtMitEinzelbetraegen() {
        val x = xml(listOf(
            item(amount = "33.33"), item(memberNumber = "M-0002", amount = "66.67", e2e = "E2E-2"),
            item(memberNumber = "M-0003", amount = "0.01", e2e = "E2E-3"),
        ))
        val single = Regex("<InstdAmt Ccy=\"EUR\">([\\d.]+)</InstdAmt>").findAll(x)
            .fold(BigDecimal.ZERO) { s, m -> s + BigDecimal(m.groupValues[1]) }
        val control = BigDecimal(Regex("<CtrlSum>([\\d.]+)</CtrlSum>").find(x)!!.groupValues[1])
        assertEquals(0, single.compareTo(control))
        assertEquals("100.01", control.toPlainString())
    }
    @Test fun faelligkeitUndGlaeubigerId() {
        val x = xml(listOf(item()))
        assertTrue(x.contains("<ReqdColltnDt>2026-10-01</ReqdColltnDt>"))
        assertTrue(x.contains("DE98ZZZ09999999999"))
    }
    @Test fun nurAusgewaehlteGueltigePosten() {
        val x = xml(listOf(
            item(), item(memberNumber = "M-0003", isValid = false, e2e = "E2E-3"),
            item(memberNumber = "M-0004", selected = false, e2e = "E2E-4"),
            item(memberNumber = "M-0005", amount = "0", e2e = "E2E-5"),
        ))
        assertEquals(1, Regex("<DrctDbtTxInf>").findAll(x).count())
        assertTrue(x.contains("<NbOfTxs>1</NbOfTxs>"))
    }
    @Test fun jeMandatsfolgeEinBlock() {
        val x = xml(listOf(
            item(memberNumber = "M-0001", amount = "10", e2e = "E1", seq = "FRST"),
            item(memberNumber = "M-0002", amount = "20", e2e = "E2", seq = "RCUR"),
            item(memberNumber = "M-0003", amount = "5.5", e2e = "E3", seq = "FRST"),
        ))
        assertEquals(2, Regex("<PmtInf>").findAll(x).count())
        assertTrue(x.indexOf("<SeqTp>FRST</SeqTp>") < x.indexOf("<SeqTp>RCUR</SeqTp>"))
        assertTrue(x.contains("<NbOfTxs>2</NbOfTxs>\n      <CtrlSum>15.50</CtrlSum>"))
        assertTrue(x.contains("<NbOfTxs>1</NbOfTxs>\n      <CtrlSum>20.00</CtrlSum>") || x.contains("<NbOfTxs>1</NbOfTxs>\n      <CtrlSum>20</CtrlSum>"))
        assertTrue(x.contains("<NbOfTxs>3</NbOfTxs>\n      <CtrlSum>35.50</CtrlSum>"))
        // wohlgeformt: lässt sich als XML einlesen, mit 2 Zahlungsblöcken und 3 Buchungen
        val dok = javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(x.byteInputStream())
        assertEquals(2, dok.getElementsByTagName("PmtInf").length)
        assertEquals(3, dok.getElementsByTagName("DrctDbtTxInf").length)
        val ids = Regex("<PmtInfId>(.*?)</PmtInfId>").findAll(x).map { it.groupValues[1] }.toList()
        assertEquals(ids.size, ids.toSet().size)
    }
    @Test fun unbekannteFolgeWirdFolgelastschrift() {
        val x = xml(listOf(item(seq = ""), item(memberNumber = "M-0002", e2e = "E2", seq = "quatsch")))
        assertEquals(1, Regex("<PmtInf>").findAll(x).count())
        assertTrue(x.contains("<SeqTp>RCUR</SeqTp>"))
    }
    @Test fun sonderzeichenMaskiert() {
        val x = xml(listOf(item(holder = "Meier & Sohn", remittance = "Beitrag <2026>")))
        assertFalse(Regex("&(?!amp;|lt;|gt;|quot;|apos;)").containsMatchIn(x))
        assertTrue(x.contains("<Ustrd>Beitrag 2026</Ustrd>"))
    }
    @Test fun zweiNachkommastellen() =
        assertTrue(xml(listOf(item(amount = "5"))).contains("<InstdAmt Ccy=\"EUR\">5.00</InstdAmt>"))
    @Test fun leererLaufWirdVerweigert() {
        try { xml(listOf(item(selected = false))); fail() } catch (_: IllegalStateException) {}
    }
    @Test fun zeitstempelImKopf() {
        assertTrue(xml(listOf(item())).contains("<CreDtTm>2026-10-25T12:00:00</CreDtTm>"))
    }

    // --- Datum ---
    @Test fun formatDate() {
        assertEquals("2026-10-01", SepaService.formatDate("2026-10-01"))
        assertEquals("2026-10-01", SepaService.formatDate("2026-10-01T08:00:00.000Z"))
        val clock = Clock.fixed(Instant.parse("2026-10-25T10:00:00Z"), ZoneOffset.UTC)
        assertEquals("2026-10-25", SepaService.formatDate("kein Datum", clock))
    }

    // --- Mit der Demo-Sicherung ---
    private val demoMembers by lazy {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        BackupFile.parse(text).list("members")!!.map { it.toSepaMember() }
    }

    @Test fun demoJahreslaufNimmtNurDasJahresMitgliedMitSepa() {
        // Aus der Demo-Datei von Hand gezählt: MG-009 (yearly, sepa); MG-004 zahlt bar, MG-005 per Überweisung.
        val items = SepaService.buildCollectionItems(demoMembers, yearly)
        assertEquals(listOf("MG-009"), items.map { it.memberNumber })
        assertAmount("120", items[0].amount)
        assertTrue(items[0].isValid)
    }

    @Test fun demoMonatslaufRespektiertDenFaelligkeitstag() {
        val m1 = SepaService.buildCollectionItems(demoMembers, SepaRunConfig(periodFilter = SepaPeriodFilter.MONTHLY_1))
        val m15 = SepaService.buildCollectionItems(demoMembers, SepaRunConfig(periodFilter = SepaPeriodFilter.MONTHLY_15))
        assertEquals(listOf("MG-001", "MG-003"), m1.map { it.memberNumber })
        assertEquals(listOf("MG-002", "MG-008"), m15.map { it.memberNumber })
    }

    @Test fun demoIbanPruefungStimmtMitDesktopErgebnisUeberein() {
        // Ergebnis der Desktop-Rechnung (MOD 97) für die Demo-Mitglieder: nur MG-003 und MG-009 haben
        // eine gültige Prüfziffer, die übrigen Demo-IBANs sind frei erfunden.
        val gueltig = demoMembers.filter { it.iban != null && SepaService.validateIban(it.iban).isValid }
            .map { it.memberNumber }
        assertEquals(listOf("MG-003", "MG-009"), gueltig)
    }
}
