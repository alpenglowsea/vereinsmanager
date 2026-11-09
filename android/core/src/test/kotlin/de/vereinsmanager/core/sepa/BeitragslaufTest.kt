package de.vereinsmanager.core.sepa

import de.vereinsmanager.core.settings.Glaeubiger
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BeitragslaufTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)
    private val g = Glaeubiger("DE98ZZZ09999999999", "Testverein", "DE89370400440532013000", "SPKDMUSTXXX", "Eva Kasse", "Weg 1, 12345 Ort")

    private fun param(filter: SepaPeriodFilter = SepaPeriodFilter.MONTHLY_1) =
        LaufParameter(filter, 2026, 11, 4, 2, "2026-11-16")

    private fun mitglied(
        s: InMemoryDocumentStore, nr: String, vor: String, nach: String, status: String = "active", zahlart: String = "sepa",
        periode: String = "monthly", beitrag: Int = 12, iban: String = "DE89370400440532013000", inhaber: String = "", tag: Int? = null,
    ) = s.put("members", "m-$nr", buildJsonObject {
        put("id", "m-$nr"); put("memberNumber", nr); put("firstName", vor); put("lastName", nach); put("status", status)
        put("paymentMethod", zahlart); put("feeAmount", beitrag); put("feePeriod", periode); put("entryDate", "2020-01-01")
        put("bankDetails", buildJsonObject {
            put("iban", iban); put("mandateReference", "MR-$nr"); put("mandateDate", "2020-01-01"); put("accountHolder", inhaber)
            if (tag != null) put("monthlyDueDay", tag)
        })
    })

    @Test
    fun titelWieAmDesktop() {
        assertEquals("Monatsbeitrag November 2026 (1. d. M.)", Beitragslauf.titel(param()))
        assertEquals("Monatsbeitrag November 2026 (15. d. M.)", Beitragslauf.titel(param(SepaPeriodFilter.MONTHLY_15)))
        assertEquals("Monatsbeitrag November 2026 (Alle)", Beitragslauf.titel(param(SepaPeriodFilter.MONTHLY_ALL)))
        assertEquals("Quartalsbeitrag Q4 2026", Beitragslauf.titel(param(SepaPeriodFilter.QUARTERLY)))
        assertEquals("Halbjahresbeitrag H2 2026", Beitragslauf.titel(param(SepaPeriodFilter.HALF_YEARLY)))
        assertEquals("Jahresbeitrag 2026", Beitragslauf.titel(param(SepaPeriodFilter.YEARLY)))
        assertEquals("Mein Titel", Beitragslauf.titel(param().copy(titel = " Mein Titel ")))
    }

    @Test
    fun vorbereitenNimmtNurPassendeMitglieder() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        mitglied(s, "2", "Bernd", "Bar", zahlart = "cash")
        mitglied(s, "3", "Cora", "Co", status = "terminated")
        mitglied(s, "4", "Dirk", "Dorn", periode = "yearly", beitrag = 120)
        mitglied(s, "5", "Emil", "Eck", tag = 15)
        val posten = Beitragslauf.vorbereiten(s, param())
        assertEquals(listOf("1"), posten.map { it.memberNumber })
        assertEquals(BigDecimal("12"), posten.single().amount.stripTrailingZeros().let { BigDecimal(it.toPlainString()) })
        assertEquals(listOf("5"), Beitragslauf.vorbereiten(s, param(SepaPeriodFilter.MONTHLY_15)).map { it.memberNumber })
        assertEquals(listOf("4"), Beitragslauf.vorbereiten(s, param(SepaPeriodFilter.YEARLY)).map { it.memberNumber })
    }

    @Test
    fun ungueltigePostenWerdenNichtAusgewaehlt() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt", iban = "DE00")
        val p = Beitragslauf.vorbereiten(s, param()).single()
        assertFalse(p.isValid)
        assertFalse(p.selected)
    }

    @Test
    fun erzeugenSpeichertLaufUndLiefertXml() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        mitglied(s, "2", "Bernd", "Bau", beitrag = 7)
        mitglied(s, "3", "Cora", "Co", iban = "DE00")
        val posten = Beitragslauf.vorbereiten(s, param())
        val r = Beitragslauf.erzeugen(s, param(), posten, g, jetzt)
        assertTrue(r.xml.contains("pain.008"))
        assertTrue(r.xml.contains("DE89370400440532013000"))
        assertEquals("SEPA_Monatsbeitrag_November_2026__1__d__M___2026-11-16.xml", r.xmlDateiname)
        val l = Beitragslauf.lauf(s, r.lauf.id)!!
        assertEquals(2, l.anzahl)
        assertEquals(0, BigDecimal("19").compareTo(l.summe))
        assertEquals(3, l.posten.size)
        assertEquals(2, l.aktive.size)
        assertFalse(l.gebucht)
        assertEquals(11, l.monat)
        assertTrue(l.xml!!.length > 100)
    }

    @Test
    fun erzeugenOhneGueltigePostenWirft() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt", iban = "DE00")
        val posten = Beitragslauf.vorbereiten(s, param())
        try { Beitragslauf.erzeugen(s, param(), posten, g, jetzt); fail() } catch (e: IllegalStateException) { }
        assertTrue(Beitragslauf.laeufe(s).isEmpty())
    }

    @Test
    fun abgewaehltePostenBleibenInDerHistorieAberNichtImXml() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        mitglied(s, "2", "Bernd", "Bau")
        val posten = Beitragslauf.vorbereiten(s, param()).map { if (it.memberNumber == "2") it.copy(selected = false) else it }
        val r = Beitragslauf.erzeugen(s, param(), posten, g, jetzt)
        assertEquals(1, r.lauf.anzahl)
        assertEquals(2, r.lauf.posten.size)
        assertFalse(r.xml.contains("MR-2"))
        assertTrue(r.xml.contains("MR-1"))
        assertFalse(Beitragslauf.lauf(s, r.lauf.id)!!.posten.first { it.memberNumber == "2" }.selected)
    }

    @Test
    fun laeufeSortierenUndLoeschen() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        val posten = Beitragslauf.vorbereiten(s, param())
        val a = Beitragslauf.erzeugen(s, param(), posten, g, jetzt)
        val b = Beitragslauf.erzeugen(s, param().copy(ausfuehrung = "2026-12-01"), posten, g, jetzt.plusDays(1))
        assertEquals(listOf(b.lauf.id, a.lauf.id), Beitragslauf.laeufe(s).map { it.id })
        Beitragslauf.loeschen(s, a.lauf.id)
        assertNull(Beitragslauf.lauf(s, a.lauf.id))
        assertEquals(1, Beitragslauf.laeufe(s).size)
    }

    @Test
    fun parameterAusGespeichertemLauf() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        val r = Beitragslauf.erzeugen(s, param(), Beitragslauf.vorbereiten(s, param()), g, jetzt)
        val p = Beitragslauf.parameterVon(r.lauf)
        assertEquals(SepaPeriodFilter.MONTHLY_1, p.filter)
        assertEquals(2026, p.jahr)
        assertEquals(11, p.monat)
        assertEquals("2026-11-16", p.ausfuehrung)
    }

    @Test
    fun protokollInhalt() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt", inhaber = "Anna Alt")
        mitglied(s, "2", "Bernd", "Bau", inhaber = "Petra Bau")
        mitglied(s, "3", "Cora", "Co")
        val p = Beitragslauf.protokoll(param(), Beitragslauf.vorbereiten(s, param()), g, LocalDate.of(2026, 11, 9))
        assertEquals("36.00 €", p.summeText)
        assertEquals("3 Posten", p.anzahlText)
        assertEquals("Monatlich (1. des Monats)", p.zyklus)
        assertEquals("09.11.2026", p.erstellt)
        assertEquals("Fälligkeitsdatum: 16.11.2026 | Erstellt: 09.11.2026", p.daten)
        assertEquals("DE8937...3000", p.zeilen[0][4])
        assertEquals("Anna Alt", p.zeilen[0][3])
        assertEquals("Petra Bau*", p.zeilen[1][3])
        assertEquals("Cora Co", p.zeilen[2][3]) // leerer Kontoinhaber: Name des Mitglieds
        assertTrue(p.fussnote.startsWith("* "))
        assertEquals("SEPA_Einzugsprotokoll_2026-11-16_monthly_1.pdf", p.dateiname)
        assertEquals(7, p.spalten.size)
        assertTrue(p.kopf1.contains("Gläubiger-ID: DE98ZZZ09999999999"))
    }

    @Test
    fun protokollOhneAbweichungHatKeineFussnote() {
        val s = InMemoryDocumentStore()
        mitglied(s, "1", "Anna", "Alt")
        val p = Beitragslauf.protokoll(param(), Beitragslauf.vorbereiten(s, param()), g)
        assertEquals("", p.fussnote)
        assertNotNull(p.zeilen.single())
    }
}
