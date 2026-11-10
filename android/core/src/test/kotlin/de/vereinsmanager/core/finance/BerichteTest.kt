package de.vereinsmanager.core.finance

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate

class BerichteTest {
    private fun bd(s: String) = BigDecimal(s)
    private fun assertBetrag(erwartet: String, ist: BigDecimal) = assertEquals("erwartet $erwartet, war $ist", 0, bd(erwartet).compareTo(ist))

    private fun doc(vararg p: Pair<String, Any?>) = JsonObject(p.filter { it.second != null }.associate { (k, v) ->
        k to when (v) { is JsonArray -> v; is JsonObject -> v; else -> JsonPrimitive(v.toString()) }
    })

    private fun buchung(
        id: String, datum: String, betrag: String, art: String = "income", sphaere: String = "ideell", haupt: String = "",
        konto: String = "", skr: String = "", kategorie: String = "", konto1: String = "k1", ziel: String? = null,
        teile: List<JsonObject> = emptyList(), notiz: String = "", text: String = "", partner: String = "", beleg: String = "",
    ) = Buchung.from(doc(
        "id" to id, "date" to datum, "amount" to betrag, "type" to art, "accountId" to konto1, "targetAccountId" to ziel,
        "documentNumber" to beleg, "bookingText" to text, "partner" to partner, "sphere" to sphaere, "mainCategory" to haupt,
        "subCategory" to konto, "skrAccount" to skr, "category" to kategorie, "vatRate" to 0, "notes" to notiz,
        "isSplit" to (teile.isNotEmpty()), "splits" to (if (teile.isEmpty()) null else JsonArray(teile)),
    ))

    private fun teil(id: String, betrag: String, sphaere: String, haupt: String, konto: String, skr: String, text: String = "") =
        doc("id" to id, "amount" to betrag, "sphere" to sphaere, "mainCategory" to haupt, "subCategory" to konto, "skrAccount" to skr, "bookingText" to text, "vatRate" to 19)

    private val konten = listOf(
        Konto("k1", "Girokonto", "bank", "", "", bd("0"), "blue", "", null),
        Konto("k2", "Kasse", "cash", "", "", bd("0"), "green", "", null),
    )

    private val beitrag = "40000 - Mitgliedsbeiträge & Aufnahmegebühren"

    @Test fun umbuchungenUndAndereJahreZaehlenNicht() {
        val e = Berichte.euer(listOf(
            buchung("1", "2025-03-01", "100", haupt = beitrag, konto = "Echte Mitgliedsbeiträge", skr = "40000"),
            buchung("2", "2025-03-02", "500", art = "transfer", ziel = "k2"),
            buchung("3", "2024-12-31", "999", haupt = beitrag, konto = "Echte Mitgliedsbeiträge"),
        ), "2025")
        assertBetrag("100", e.einnahmen)
        assertBetrag("0", e.ausgaben)
        assertEquals(1, e.anzahl)
        assertBetrag("1099", Berichte.euer(listOf(
            buchung("1", "2025-03-01", "100"), buchung("3", "2024-12-31", "999"),
        ), null).einnahmen)
    }

    @Test fun negativerBetragUndArtAusgabeSindAusgaben() {
        val e = Berichte.euer(listOf(
            buchung("1", "2025-01-01", "-30", art = "expense"),
            buchung("2", "2025-01-02", "-20", art = "income"),
            buchung("3", "2025-01-03", "15", art = "expense"),
        ), "2025")
        assertBetrag("65", e.ausgaben)
        assertBetrag("0", e.einnahmen)
        assertBetrag("-65", e.ergebnis)
    }

    @Test fun aufgeteilteBuchungWirdTeilFuerTeilGezaehlt() {
        val e = Berichte.euer(listOf(
            buchung(
                "1", "2025-05-01", "-120", art = "expense", sphaere = "ideell",
                teile = listOf(
                    teil("a", "70", "ideell", "62 - Raumkosten", "Miete", "62000"),
                    teil("b", "50", "wirtschaftlich", "63 - Warenkosten", "Getränke", "63000"),
                ),
            ),
        ), "2025")
        assertBetrag("70", e.sphaeren.first { it.id == "ideell" }.ausgaben)
        assertBetrag("50", e.sphaeren.first { it.id == "wirtschaftlich" }.ausgaben)
        assertBetrag("120", e.ausgaben)
        assertEquals(2, e.anzahl)
    }

    @Test fun gliederungNachNummernkreisUndKonto() {
        val e = Berichte.euer(listOf(
            buchung("1", "2025-01-01", "10", haupt = beitrag, konto = "Echte Mitgliedsbeiträge", skr = "40000"),
            buchung("2", "2025-01-02", "20", haupt = beitrag, konto = "Echte Mitgliedsbeiträge", skr = "40000"),
            buchung("3", "2025-01-03", "5", haupt = beitrag, konto = "Aufnahmegebühren", skr = "40010"),
        ), "2025")
        val ideell = e.sphaeren.first { it.id == "ideell" }
        assertEquals(1, ideell.nummernkreise.size)
        val nk = ideell.nummernkreise[0]
        assertEquals("40000", nk.code)
        assertEquals("Mitgliedsbeiträge & Aufnahmegebühren", nk.name)
        assertEquals(2, nk.konten.size)
        assertEquals("40000", nk.konten[0].skrKonto)
        assertBetrag("30", nk.konten[0].einnahmen)
        assertEquals(2, nk.konten[0].anzahl)
        assertBetrag("35", nk.einnahmen)
    }

    @Test fun ohneNummernkreisUndKontoGibtEsAuffangzeilen() {
        val e = Berichte.euer(listOf(buchung("1", "2025-01-01", "10")), "2025")
        val nk = e.sphaeren[0].nummernkreise.single()
        assertEquals("Allgemeine Erlöse/Kosten ideell", nk.name)
        assertEquals("", nk.code)
        assertEquals("Sonstige Buchung", nk.konten.single().name)
    }

    @Test fun unbekannteSphaereZaehltAlsIdeell() {
        val e = Berichte.euer(listOf(buchung("1", "2025-01-01", "10", sphaere = "")), "2025")
        assertBetrag("10", e.sphaeren.first { it.id == "ideell" }.einnahmen)
        assertEquals(4, e.sphaeren.size)
    }

    @Test fun grenzeGenau45000IstNochFreiAberWarnung() {
        val e = Berichte.euer(listOf(buchung("1", "2025-06-01", "45000.00", sphaere = "wirtschaftlich")), "2025")
        val g = e.grenze!!
        assertFalse(g.ueberschritten)
        assertTrue(g.warnung)
        assertBetrag("0", g.puffer)
    }

    @Test fun grenzeUeberschrittenErstBeiMehrAls45000() {
        val e = Berichte.euer(listOf(buchung("1", "2025-06-01", "45000.01", sphaere = "wirtschaftlich")), "2025")
        assertTrue(e.grenze!!.ueberschritten)
        assertFalse(e.grenze!!.warnung)
    }

    @Test fun grenzeUnter75ProzentKeineWarnung() {
        val e = Berichte.euer(listOf(buchung("1", "2025-06-01", "33749.99", sphaere = "wirtschaftlich")), "2025")
        assertFalse(e.grenze!!.warnung)
        val e2 = Berichte.euer(listOf(buchung("1", "2025-06-01", "33750", sphaere = "wirtschaftlich")), "2025")
        assertTrue(e2.grenze!!.warnung)
        assertBetrag("11250", e2.grenze!!.puffer)
    }

    @Test fun grenzeNurFuerEinJahrUndNurWirtschaftlicherBetrieb() {
        assertNull(Berichte.euer(emptyList(), null).grenze)
        val e = Berichte.euer(listOf(
            buchung("1", "2025-06-01", "40000", sphaere = "zweckbetrieb"),
            buchung("2", "2025-06-01", "-100", art = "expense", sphaere = "wirtschaftlich"),
        ), "2025")
        assertBetrag("0", e.grenze!!.einnahmen)
    }

    @Test fun csvHatKopfZeilenJeTeilUndVorzeichen() {
        val csv = Berichte.journalCsv(listOf(
            buchung("1", "2025-05-01", "-120", art = "expense", sphaere = "ideell", teile = listOf(
                teil("a", "70", "ideell", "62 - Raumkosten", "Miete", "62000", "Miete Mai"),
                teil("b", "50", "wirtschaftlich", "63 - Warenkosten", "Getränke", "63000"),
            ), text = "Einkauf", notiz = "zwei\nZeilen"),
            buchung("2", "2025-05-02", "50", art = "transfer", ziel = "k2"),
            buchung("3", "2025-05-03", "12.5"),
        ), konten)
        val zeilen = csv.removePrefix("﻿").split("\r\n")
        assertEquals(1 + 4, zeilen.size)
        assertTrue(zeilen[0].startsWith("Buchungs-ID;Datum;Belegnummer;Teil;"))
        assertTrue(zeilen[0].contains("SKR-Konto") && zeilen[0].contains("Sparte"))
        assertTrue(zeilen[1].contains(";1/2;Miete Mai;"))
        assertTrue(zeilen[1].contains(";-70.00;Ausgabe;"))
        assertTrue(zeilen[1].contains(";62000;"))
        assertTrue(zeilen[2].contains(";2/2;Einkauf;") && zeilen[2].contains("4. Wirtschaftl. Geschäftsbetrieb") && zeilen[2].contains(";-50.00;"))
        assertTrue(zeilen[1].endsWith("zwei Zeilen"))
        assertTrue(zeilen[3].contains(";Girokonto;Kasse;") && zeilen[3].contains(";Umbuchung;"))
        assertTrue(zeilen[4].contains(";12.50;Einnahme;"))
    }

    @Test fun csvLeerHatNurBom() {
        assertEquals("﻿", Berichte.journalCsv(emptyList(), konten))
    }

    @Test fun journalPdfRechnetUmbuchungenNichtMit() {
        val t = Berichte.journalPdf(listOf(
            buchung("1", "2025-05-03", "100", konto1 = "k1"),
            buchung("2", "2025-05-04", "-40", art = "expense"),
            buchung("3", "2025-05-05", "500", art = "transfer", ziel = "k2"),
        ), konten, "Testverein", LocalDate.of(2026, 1, 2))
        assertEquals(269, t.breiten.sum())
        assertEquals(t.spalten.size, t.breiten.size)
        assertEquals(t.spalten.size, t.ausrichtung.size)
        assertEquals(3 + 3, t.zeilen.size)
        assertTrue(t.zeilen.all { it.size == t.spalten.size })
        assertEquals(setOf(3, 4, 5), t.fett)
        assertEquals("100,00 €", t.zeilen[3].last())
        assertEquals("40,00 €", t.zeilen[4].last())
        assertEquals("+60,00 €", t.zeilen[5].last())
        assertTrue(t.zeilen[2][4].contains("Girokonto → Kasse"))
        assertTrue(t.fusszeile.contains("1 Umbuchungen"))
        assertTrue(t.kopfRechts.contains("3 Buchungen"))
    }

    @Test fun euerPdfHatSummenzeilenUndPassendeBreiten() {
        val e = Berichte.euer(listOf(
            buchung("1", "2025-01-01", "100", haupt = beitrag, konto = "Echte Mitgliedsbeiträge", skr = "40000"),
            buchung("2", "2025-01-02", "-30", art = "expense"),
        ), "2025")
        val t = Berichte.euerPdf(e, "Testverein", LocalDate.of(2026, 1, 2))
        assertEquals(269, t.breiten.sum())
        assertTrue(t.zeilen.all { it.size == t.spalten.size })
        val gesamt = t.zeilen.last()
        assertEquals("Gesamtergebnis", gesamt[0])
        assertEquals("100,00 €", gesamt[1])
        assertEquals("30,00 €", gesamt[2])
        assertEquals("+70,00 €", gesamt[3])
        assertTrue(t.fett.contains(t.zeilen.size - 1))
        assertEquals(4 + 1, t.fett.size)
        assertTrue(t.titel.contains("2025"))
        assertTrue(t.fusszeile.contains("45.000,00 €"))
        assertTrue(Berichte.euerPdf(Berichte.euer(emptyList(), null), "V", LocalDate.of(2026, 1, 2)).fusszeile.contains("je Kalenderjahr"))
    }
}
