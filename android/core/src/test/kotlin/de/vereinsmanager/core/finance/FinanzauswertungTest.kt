package de.vereinsmanager.core.finance

import de.vereinsmanager.core.donation.Zeichnung
import java.math.BigDecimal
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FinanzauswertungTest {
    private fun d(s: String) = BigDecimal(s)
    private var n = 0
    private fun b(
        datum: String, betrag: String, art: String? = null, konto: String = "k1", ziel: String = "", sph: String = "ideell",
        sparte: String = "", nk: String = "", kontoName: String = "", teile: List<Teilbuchung> = emptyList(),
    ) = Buchung(
        id = "b${n++}", datum = datum, betrag = d(betrag), art = art ?: if (d(betrag).signum() < 0) "expense" else "income",
        kontoId = konto, zielkontoId = ziel, belegNummer = "", text = "", partner = "", sphaere = sph, sparte = sparte,
        nummernkreis = nk, konto = kontoName, skrKonto = "", kategorie = "", ust = 0, notiz = "", teile = teile, beleg = null,
    )
    private fun t(betrag: String, sph: String = "", nk: String = "", sparte: String = "", konto: String = "") = Teilbuchung(
        id = "t${n++}", betrag = d(betrag), text = "", sphaere = sph, sparte = sparte, nummernkreis = nk, konto = konto, skrKonto = "", kategorie = "", ust = 0,
    )
    private fun k(id: String, name: String, anfang: String) = Konto(id, name, "bank", "", "", d(anfang), "", "", null)

    private val konten = listOf(k("k1", "Giro", "1000"), k("k2", "Kasse", "50"))
    private val heute = LocalDate.of(2026, 11, 12)
    private val spendeNk = "40400 - Spenden"

    private val buchungen get() = listOf(
        b("2026-01-10", "200", kontoName = "Beiträge", sparte = "Fußball"),
        b("2026-01-20", "100", nk = spendeNk, kontoName = "Geldspende"),
        b("2026-01-25", "-30", nk = spendeNk, kontoName = "Rückerstattung"),
        b("2026-03-05", "-80", sparte = "Fußball", kontoName = "Material"),
        b("2025-03-05", "500", kontoName = "Beiträge", sparte = "Chor"),
        b("2026-02-01", "300", art = "transfer", konto = "k1", ziel = "k2"),
    )

    @Test fun kennzahlenEinJahrOhneUmbuchungen() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026"), listOf("Fußball"), heute)
        assertEquals(d("200"), a.kennzahlen.einnahmen)
        assertEquals(d("100"), a.kennzahlen.spenden)
        assertEquals(d("110"), a.kennzahlen.ausgaben)
        assertEquals(d("190"), a.kennzahlen.saldo)
    }

    @Test fun ausgabeAufSpendenkontoIstKeineSpende() {
        val p = Finanzauswertung.posten(buchungen, AuswFilter(jahr = "2026"))
        val rueck = p.single { it.konto == "Rückerstattung" }
        assertTrue(rueck.ausgabe); assertFalse(rueck.spende)
    }

    @Test fun alleJahreFasstGleicheMonateZusammen() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(), emptyList(), heute)
        assertEquals(d("-0") + d("80"), a.monate[2].ausgaben)
        assertEquals(d("500"), a.monate[2].einnahmen)
        assertEquals(d("200"), a.monate[0].einnahmen)
    }

    @Test fun kontofilterUndLeereAuswahl() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026", kontoId = "k2"), emptyList(), heute)
        assertTrue(a.keineBuchungen)
    }

    @Test fun bereichsfilterGiltJeTeilbetrag() {
        val x = b("2026-04-01", "100", sph = "ideell", teile = listOf(t("60", sph = "zweckbetrieb"), t("40", sph = "")))
        val z = Finanzauswertung.posten(listOf(x), AuswFilter(sphaere = "zweckbetrieb"))
        assertEquals(1, z.size); assertEquals(d("60"), z[0].betrag)
        val i = Finanzauswertung.posten(listOf(x), AuswFilter(sphaere = "ideell"))
        assertEquals(d("40"), i.single().betrag)
    }

    @Test fun unbekannterBereichZaehltAlsIdeell() {
        val x = b("2026-04-01", "10", sph = "komisch")
        assertEquals(1, Finanzauswertung.posten(listOf(x), AuswFilter(sphaere = "ideell")).size)
    }

    @Test fun buchungOhneKontoBekommtBezeichnung() {
        val p = Finanzauswertung.posten(listOf(b("2026-04-01", "10")), AuswFilter())
        assertEquals("Ohne Konto", p.single().konto)
    }

    @Test fun verlaufIstEchterKontostandMitAnfangsbestand() {
        val v = Finanzauswertung.verlauf(buchungen, konten, AuswFilter(jahr = "2026"), heute)
        assertEquals(11, v.size)                               // bis einschließlich November
        // Anfang 1050 + 2025: +500 = 1550; Jan: +200+100-30 = 1820; Umbuchung wirkt nicht auf die Summe; März: -80 = 1740
        assertEquals(d("1820"), v[0].stand)
        assertEquals(d("1820"), v[1].stand)
        assertEquals(d("1740"), v[2].stand)
        assertEquals(d("1740"), v[10].stand)
    }

    @Test fun verlaufEinKontoBeruecksichtigtUmbuchung() {
        val v = Finanzauswertung.verlauf(buchungen, konten, AuswFilter(jahr = "2026", kontoId = "k2"), heute)
        assertEquals(d("50"), v[0].stand)
        assertEquals(d("350"), v[1].stand)                     // Februar: +300 aus Umbuchung
    }

    @Test fun verlaufAlleJahreMitAnfangUndJahresenden() {
        val v = Finanzauswertung.verlauf(buchungen, konten, AuswFilter(), heute)
        assertEquals(listOf("Anfang", "2025", "2026"), v.map { it.name })
        assertEquals(d("1050"), v[0].stand); assertEquals(d("1550"), v[1].stand); assertEquals(d("1740"), v[2].stand)
    }

    @Test fun verlaufFuerVergangenesJahrHatZwoelfPunkte() {
        assertEquals(12, Finanzauswertung.verlauf(buchungen, konten, AuswFilter(jahr = "2025"), heute).size)
        assertTrue(Finanzauswertung.verlauf(buchungen, konten, AuswFilter(jahr = "2030"), heute).isEmpty())
    }

    @Test fun mixUndSparten() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026"), listOf("Fußball", "Chor"), heute)
        assertEquals(listOf("Beiträge"), Finanzauswertung.mix(a.posten, true).map { it.name })
        assertEquals(d("200"), Finanzauswertung.mix(a.posten, true, "Fußball").single().wert)
        assertTrue(Finanzauswertung.mix(a.posten, true, "Chor").isEmpty())
        assertEquals(d("80"), Finanzauswertung.mix(a.posten, false, "Fußball").single().wert)
        val s = a.sparten
        assertEquals("Gesamtverein", s[0].name); assertEquals(d("300"), s[0].einnahmen); assertEquals(d("110"), s[0].ausgaben)
        assertEquals(d("120"), s[1].summe)
    }

    @Test fun csvEnthaeltAlleAbschnitte() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026"), listOf("Fußball"), heute)
        val c = Finanzauswertung.csv(a, konten, Finanzauswertung.mix(a.posten, true), Finanzauswertung.mix(a.posten, false))
        assertTrue(c.contains("Abschnitt;Bezeichnung;Einnahmen;Spenden;Ausgaben;Wert"))
        assertTrue(c.contains("Kennzahlen;Gesamt;200,00;100,00;110,00;190,00"))
        assertTrue(c.contains("Kontostand (Ende);Nov;;;;1740,00"))
        assertEquals("Finanzauswertung_2026.csv", Finanzauswertung.dateiname(a, "csv"))
        assertEquals("Finanzauswertung_alle-Jahre.pdf", Finanzauswertung.dateiname(a.copy(filter = AuswFilter()), "pdf"))
    }

    // ---------------- Diagramme

    private fun pruefe(d: Diagramm) {
        for (z in d.befehle) when (z) {
            is Zeichnung.Rechteck -> { assertTrue(d.titel, z.x >= -0.01 && z.y >= -0.01 && z.x + z.b <= d.breite + 0.01 && z.y + z.h <= d.hoehe + 0.01) }
            is Zeichnung.Text -> { assertTrue(z.x.isFinite() && z.y.isFinite()); assertTrue(d.titel + " " + z.text, z.y in 0.0..d.hoehe) }
            is Zeichnung.Linie -> assertTrue(z.x1.isFinite() && z.y1.isFinite() && z.y2 <= d.hoehe + 0.01)
            is Zeichnung.Linienzug -> z.punkte.forEach { assertTrue(it.first in 0.0..d.breite && it.second in 0.0..d.hoehe) }
            is Zeichnung.Sektor -> assertTrue(z.cx + z.aussen <= d.breite && z.cy + z.aussen <= d.hoehe && z.winkel in 0.0..360.0)
            else -> {}
        }
        for (t in d.treffer) assertTrue(t.text.isNotEmpty() && t.x.isFinite() && t.b > 0 && t.h > 0)
    }

    @Test fun diagrammeLiegenImRahmenUndHabenTreffer() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026"), listOf("Fußball", "Chor"), heute)
        val m = Diagramme.monatsSaeulen(a.monate, false)
        assertEquals(12, m.treffer.size); assertEquals(13, m.tabelle.size)
        assertTrue(m.treffer[0].text.contains("Jan: Einnahmen 200,00 €"))
        val to = Diagramme.torte(a.kennzahlen); assertEquals(3, to.treffer.size)
        val v = Diagramme.verlauf(a.verlauf, false); assertEquals(11, v.treffer.size)
        val mx = Diagramme.mix("Einnahmen-Mix", "", Finanzauswertung.mix(a.posten, true), Diagramme.EINNAHMEN)
        val sp = Diagramme.sparten(a.sparten)
        listOf(m, to, v, mx, sp).forEach { pruefe(it); assertNull(it.leer) }
    }

    @Test fun leereAuswahlErgibtHinweisStattDiagramm() {
        val a = Finanzauswertung.berechne(emptyList(), konten, AuswFilter(), emptyList(), heute)
        listOf(Diagramme.monatsSaeulen(a.monate, true), Diagramme.torte(a.kennzahlen), Diagramme.verlauf(a.verlauf, true),
            Diagramme.mix("x", "", emptyList(), 0), Diagramme.sparten(a.sparten)).forEach { assertNotNull(it.leer); pruefe(it) }
    }

    @Test fun einzigeScheibeUndNegativerVerlauf() {
        val einzig = Diagramme.torte(Kennzahlen(d("100"), d("0"), d("0")))
        val s = einzig.befehle.filterIsInstance<Zeichnung.Sektor>().single()
        assertTrue(s.winkel > 359 && s.winkel < 360); pruefe(einzig)
        val v = Diagramme.verlauf(listOf(VerlaufPunkt("Jan", d("-500")), VerlaufPunkt("Feb", d("200"))), false); pruefe(v)
        val einPunkt = Diagramme.verlauf(listOf(VerlaufPunkt("Jan", d("0"))), false); pruefe(einPunkt)
    }

    @Test fun mixFasstUebrigeKontenZusammen() {
        val viele = (1..20).map { Anteil("K$it", d((100 - it).toString())) }
        val m = Diagramme.mix("t", "", viele, Diagramme.AUSGABEN, maxZeilen = 12)
        assertEquals(12, m.treffer.size); assertTrue(m.treffer.last().text.startsWith("Übrige (9 Konten)")); pruefe(m)
    }

    @Test fun schoneAchse() {
        val (lo, hi, st) = Diagramme.skala(-30.0, 740.0)
        assertTrue(lo <= -30.0 && hi >= 740.0 && st > 0)
        assertEquals(0.0, lo % st, 1e-9)
        val (a, b2, _) = Diagramme.skala(0.0, 0.0); assertTrue(b2 > a)
    }

    @Test fun pdfSeitenSindVollstaendigUndGanzAufDemBlatt() {
        val a = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = "2026"), listOf("Fußball", "Chor"), heute)
        val seiten = Diagramme.pdfSeiten(a, "Testverein e.V.", Finanzauswertung.filterText(a.filter, konten), heute)
        assertEquals(2, seiten.size)
        for (s in seiten) for (z in s) when (z) {
            is Zeichnung.Rechteck -> assertTrue(z.x >= 0 && z.y >= 0 && z.x + z.b <= 210.01 && z.y + z.h <= 297.01)
            is Zeichnung.Text -> assertTrue(z.text, z.x in 0.0..210.0 && z.y in 0.0..297.0)
            is Zeichnung.Sektor -> assertTrue(z.cy + z.aussen <= 297.0)
            else -> {}
        }
        assertTrue(seiten[0].any { it is Zeichnung.Text && it.text == "Finanz-Auswertung" })
        assertTrue(seiten[1].any { it is Zeichnung.Text && it.text == "Seite 2 von 2" })
    }
}
