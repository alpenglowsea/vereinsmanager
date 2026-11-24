package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class RechnungenTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 10, 9, 0, 0, 0, ZoneOffset.UTC)
    private val pdfBytes = "%PDF-1.4\nrechnung\n%%EOF\n".toByteArray()
    private val pdf: RechnungsPdf = { _, _, _ -> pdfBytes }

    private class Umgebung { val store = InMemoryDocumentStore(); val files = InMemoryFileStore() }

    private fun umgebung(): Umgebung = Umgebung().also { u ->
        Vereinsdaten.speichern(
            u.store,
            VereinsForm(
                name = "TSV Beispiel", strasse = "Hauptstr.", hausnummer = "1", plz = "17235", ort = "Neustrelitz", kassenwart = "Erika Muster",
                iban = "DE02120300000000202051", bic = "BYLADEM1001", finanzamt = "Neubrandenburg", steuernummer = "079/123/45678",
                email = "info@tsv.example", registernummer = "VR 1234",
            ),
            jetzt,
        )
        u.store.put(Finance.KONTEN, "k1", buildJsonObject { put("id", "k1"); put("name", "Giro"); put("accountType", "bank"); put("initialBalance", 0) })
    }

    private fun form(u: Umgebung, vararg preise: Pair<String, Int>): RechnungForm {
        val pos = preise.mapIndexed { i, (p, ust) -> PositionForm("p$i", "Leistung $i", "1", "Stk.", p, ust) }
        return Rechnungen.neu(u.store, LocalDate.of(2026, 11, 10)).copy(name = "Max Kunde", firma = "Kunde GmbH", strasse = "Weg", hausnummer = "2", plz = "10115", ort = "Berlin", betreff = "Werbung", positionen = pos)
    }

    private fun str(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.content

    // ---------- Rechnen

    @Test fun summenJeSteuersatz() {
        val s = RechnungsRegeln.berechnen(
            listOf(PositionForm("a", "A", "2", "Stk.", "10,00", 19), PositionForm("b", "B", "1", "Std.", "100", 7), PositionForm("c", "C", "1", "Stk.", "5", 0)), false,
        )
        assertEquals(BigDecimal("125.00"), s.netto)
        assertEquals(BigDecimal("3.80"), s.ustJeSatz[19]) // 20 x 19 %
        assertEquals(BigDecimal("7.00"), s.ustJeSatz[7])
        assertEquals(BigDecimal("0.00"), s.ustJeSatz[0])
        assertEquals(BigDecimal("10.80"), s.ustGesamt)
        assertEquals(BigDecimal("135.80"), s.brutto)
    }

    @Test fun mengeBehaeltDreiNachkommastellen() {
        val s = RechnungsRegeln.berechnen(listOf(PositionForm("a", "A", "0,75", "Std.", "10", 0)), false)
        assertEquals(BigDecimal("7.50"), s.netto) // der Desktop rundet 0,75 auf 0,8 und käme auf 8,00
        assertEquals("0,75", RechnungsRegeln.mengeText(s.positionen.single().menge))
    }

    @Test fun umsatzsteuerAusDerSummeDesSatzesNichtJePosition() {
        // 3 x 0,10 € à 19 %: je Position 0,019 -> 0,02 (=0,06), aus der Summe 0,30 x 19 % = 0,057 -> 0,06; mit 7 x 0,10 weicht es ab
        val pos = (1..7).map { PositionForm("p$it", "x", "1", "Stk.", "0,10", 19) }
        val s = RechnungsRegeln.berechnen(pos, false)
        assertEquals(BigDecimal("0.70"), s.netto)
        assertEquals(BigDecimal("0.13"), s.ustGesamt) // 0,70 x 19 % = 0,133; je Position wären es 7 x 0,02 = 0,14
    }

    @Test fun kleinunternehmerHatKeineUmsatzsteuer() {
        val s = RechnungsRegeln.berechnen(listOf(PositionForm("a", "A", "1", "Stk.", "100", 19)), true)
        assertEquals(BigDecimal("100.00"), s.brutto)
        assertEquals(BigDecimal("0.00"), s.ustGesamt)
        assertEquals(0, s.positionen.single().ust)
    }

    @Test fun nummerIstHoechsteDesJahresPlusEins() {
        assertEquals("RE-2026-004", RechnungsRegeln.naechsteNummer(listOf("RE-2026-001", "RE-2026-003", "RE-2025-009", "x"), 2026))
        assertEquals("RE-2027-001", RechnungsRegeln.naechsteNummer(listOf("RE-2026-001"), 2027))
    }

    @Test fun schlusstextFolgtDemZahlungsziel() {
        val v = Vorlage().schluss
        assertTrue(RechnungsRegeln.schlussMitZiel(v, 14, 30).contains("innerhalb von 30 Tagen"))
        assertTrue(RechnungsRegeln.schlussMitZiel(v, 14, 1).contains("innerhalb von 1 Tag "))
        // Eigener Text ohne die Wendung oder mit anderer Zahl bleibt unverändert.
        assertEquals("Zahlbar sofort.", RechnungsRegeln.schlussMitZiel("Zahlbar sofort.", 14, 30))
        assertEquals("Bitte innerhalb von 7 Tagen zahlen.", RechnungsRegeln.schlussMitZiel("Bitte innerhalb von 7 Tagen zahlen.", 14, 30))
        // 14 darf nicht in 140 stecken.
        assertEquals("innerhalb von 140 Tagen", RechnungsRegeln.schlussMitZiel("innerhalb von 140 Tagen", 14, 30))
        assertEquals(v, RechnungsRegeln.schlussMitZiel(v, 14, 14))
    }

    @Test fun faelligUndUeberfaellig() {
        assertEquals("2026-11-24", RechnungsRegeln.faellig("2026-11-10", 14))
        val u = umgebung()
        val r = Rechnungen.speichern(u.store, u.files, form(u, "100" to 19).copy(faellig = "2026-11-24"), RechnungOptionen(pdfAblegen = false), null, jetzt).rechnung
        assertFalse(RechnungsRegeln.ueberfaellig(r, LocalDate.of(2026, 11, 24)))
        assertTrue(RechnungsRegeln.ueberfaellig(r, LocalDate.of(2026, 11, 25)))
        assertFalse(RechnungsRegeln.ueberfaellig(r.copy(status = "paid"), LocalDate.of(2027, 1, 1)))
    }

    // ---------- Speichern

    @Test fun neuesFormularHatVorgabenDerVorlage() {
        val u = umgebung()
        Vorlagen.speichern(u.store, Vorlage(zahlungszielTage = 30, einleitung = "Hallo", schluss = "Danke"), jetzt)
        val f = Rechnungen.neu(u.store, LocalDate.of(2026, 11, 10))
        assertEquals("RE-2026-001", f.nummer)
        assertEquals("2026-12-10", f.faellig)
        assertEquals("Hallo", f.einleitung); assertEquals("Danke", f.schluss)
        assertEquals(1, f.positionen.size)
    }

    @Test fun pruefenLehntFehlerhaftesAb() {
        val u = umgebung()
        val ok = form(u, "100" to 19)
        assertNull(Rechnungen.pruefen(u.store, ok))
        assertNotNull(Rechnungen.pruefen(u.store, ok.copy(name = "", firma = "")))
        assertNotNull(Rechnungen.pruefen(u.store, ok.copy(positionen = emptyList())))
        assertNotNull(Rechnungen.pruefen(u.store, ok.copy(positionen = listOf(ok.positionen[0].copy(text = "")))))
        assertNotNull(Rechnungen.pruefen(u.store, ok.copy(positionen = listOf(ok.positionen[0].copy(menge = "0")))))
        assertNotNull(Rechnungen.pruefen(u.store, ok.copy(positionen = listOf(ok.positionen[0].copy(preis = "abc")))))
        Rechnungen.speichern(u.store, u.files, ok, RechnungOptionen(pdfAblegen = false), null, jetzt)
        assertNotNull(Rechnungen.pruefen(u.store, form(u, "5" to 0).copy(id = "andere", nummer = ok.nummer))) // doppelte Nummer
    }

    @Test fun speichernLegtRechnungUndPdfImUnterordnerAb() {
        val u = umgebung()
        val erg = Rechnungen.speichern(u.store, u.files, form(u, "100" to 19, "50" to 7), RechnungOptionen(), pdf, jetzt)
        val r = erg.rechnung
        assertEquals("RE-2026-001", r.nummer)
        assertEquals(0, BigDecimal("150.00").compareTo(r.netto))
        assertEquals(0, BigDecimal("22.50").compareTo(r.ustGesamt)) // 19,00 + 3,50
        assertEquals(0, BigDecimal("172.50").compareTo(r.brutto))
        assertEquals(2, r.positionen.size)
        val doc = u.store.get("documents", erg.dokumentId!!)!!
        assertEquals("belege", str(doc, "category"))
        assertEquals("Rechnung_RE-2026-001.pdf", str(doc, "fileName"))
        val unter = u.store.get("folders", str(doc, "folderId")!!)!!
        assertEquals("Ausgangsrechnungen", str(unter, "name"))
        assertEquals("Belege 2026", str(u.store.get("folders", str(unter, "parentId")!!), "name"))
        assertEquals(1, u.files.ids().size)
    }

    @Test fun erneutesSpeichernErsetztDasPdfUndBehaeltZahlungsangaben() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        val erst = Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(), pdf, jetzt)
        Rechnungen.bezahlen(u.store, f.id, BezahltAngaben("2026-11-12", "cash", buchungAnlegen = false), jetzt)
        val zweit = Rechnungen.speichern(u.store, u.files, Rechnungen.von(Rechnungen.alle(u.store).single()).copy(betreff = "Neu"), RechnungOptionen(), "%PDF-2".toByteArray().let { b -> { _, _, _ -> b } }, jetzt)
        assertEquals(erst.dokumentId, zweit.dokumentId)
        assertEquals(1, u.store.count("documents"))
        assertEquals(1, u.files.ids().size) // die alte Datei ist weg
        assertEquals("paid", zweit.rechnung.status)
        assertEquals("2026-11-12", zweit.rechnung.bezahltAm)
        assertEquals("cash", zweit.rechnung.zahlart)
        assertEquals("Neu", zweit.rechnung.betreff)
    }

    @Test fun pdfFehlerSpeichertTrotzdem() {
        val u = umgebung()
        val erg = Rechnungen.speichern(u.store, u.files, form(u, "10" to 0), RechnungOptionen(), { _, _, _ -> throw IllegalStateException("kaputt") }, jetzt)
        assertEquals("kaputt", erg.pdfFehler)
        assertNull(erg.dokumentId)
        assertEquals(1, Rechnungen.alle(u.store).size)
        assertEquals(0, u.store.count("documents"))
    }

    @Test fun unbekannteFelderBleiben() {
        val u = umgebung()
        val f = form(u, "10" to 0)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        val alt = u.store.get("invoices", f.id)!!
        u.store.put("invoices", f.id, JsonObject(alt + ("customField" to JsonPrimitive("x"))))
        Rechnungen.speichern(u.store, u.files, Rechnungen.von(Rechnungen.alle(u.store).single()), RechnungOptionen(pdfAblegen = false), null, jetzt)
        assertEquals("x", str(u.store.get("invoices", f.id), "customField"))
    }

    // ---------- Bezahlen

    private val angaben = BezahltAngaben("2026-11-12", "transfer", true, "k1", "44000 - Werbung, Sponsoring & Marketing", "44000 - Werbeeinnahmen & Sponsoring allgemein (19% USt)", "44000")

    @Test fun bezahlenLegtEinnahmeBuchungAn() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
        val b = u.store.get(Finance.BUCHUNGEN, bid)!!
        assertEquals("income", str(b, "type"))
        assertEquals("119", str(b, "amount"))
        assertEquals("2026-11-12", str(b, "date"))
        assertEquals("k1", str(b, "accountId"))
        assertEquals("wirtschaftlich", str(b, "sphere"))
        assertEquals("44000", str(b, "skrAccount"))
        assertEquals("19", str(b, "vatRate"))
        assertEquals("RE-2026-001", str(b, "documentNumber"))
        assertEquals("Kunde GmbH", str(b, "partner"))
        val r = Rechnungen.alle(u.store).single()
        assertEquals("paid", r.status); assertEquals(bid, r.buchungId); assertEquals("2026-11-12", r.bezahltAm)
    }

    @Test fun mehrereSteuersaetzeErgebenEineAufgeteilteBuchung() {
        val u = umgebung()
        val f = form(u, "100" to 19, "100" to 7, "10" to 0)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
        val b = u.store.get(Finance.BUCHUNGEN, bid)!!
        val teile = (b["splits"] as JsonArray).map { it as JsonObject }
        assertEquals(3, teile.size)
        assertEquals(listOf("10", "107", "119"), teile.map { str(it, "amount")!! }.sortedBy { it.toInt() })
        val summe = teile.sumOf { str(it, "amount")!!.toBigDecimal() }
        assertEquals(0, BigDecimal("236").compareTo(summe))
        assertEquals("236", str(b, "amount"))
    }

    @Test fun bezahlenOhneBuchungUndFehlerfaelle() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        try { Rechnungen.bezahlen(u.store, f.id, angaben.copy(kontoId = "gibtsnicht"), jetzt); fail() } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Konto")) }
        try { Rechnungen.bezahlen(u.store, f.id, angaben.copy(skrKonto = ""), jetzt); fail() } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Konto")) }
        assertEquals("open", Rechnungen.alle(u.store).single().status)
        assertNull(Rechnungen.bezahlen(u.store, f.id, angaben.copy(buchungAnlegen = false), jetzt))
        assertEquals(0, u.store.count(Finance.BUCHUNGEN))
        assertEquals("paid", Rechnungen.alle(u.store).single().status)
    }

    @Test fun belegnummerBleibtEindeutig() {
        val u = umgebung()
        val f = form(u, "100" to 0)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        u.store.put(Finance.BUCHUNGEN, "alt", buildJsonObject { put("id", "alt"); put("documentNumber", "RE-2026-001") })
        val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
        assertEquals("RE-2026-001-2", str(u.store.get(Finance.BUCHUNGEN, bid), "documentNumber"))
    }

    @Test fun zuruecksetzenMitUndOhneBuchung() {
        for (mit in listOf(true, false)) {
            val u = umgebung()
            val f = form(u, "100" to 19)
            Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
            val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
            Rechnungen.zuruecksetzen(u.store, u.files, f.id, mit, jetzt)
            val r = Rechnungen.alle(u.store).single()
            assertEquals("open", r.status); assertNull(r.bezahltAm); assertNull(r.buchungId); assertNull(r.zahlart)
            assertEquals(if (mit) null else bid, if (u.store.get(Finance.BUCHUNGEN, bid) == null) null else bid)
        }
    }

    @Test fun stornierenNurWennNichtBezahlt() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        Rechnungen.bezahlen(u.store, f.id, angaben.copy(buchungAnlegen = false), jetzt)
        try { Rechnungen.stornieren(u.store, f.id, jetzt); fail() } catch (e: IllegalArgumentException) { }
        Rechnungen.zuruecksetzen(u.store, u.files, f.id, false, jetzt)
        Rechnungen.stornieren(u.store, f.id, jetzt)
        assertEquals("cancelled", Rechnungen.alle(u.store).single().status)
        try { Rechnungen.bezahlen(u.store, f.id, angaben, jetzt); fail() } catch (e: IllegalArgumentException) { }
    }

    @Test fun betragAenderungGleichtBuchungNurAufWunschAn() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt)
        val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
        val neu = Rechnungen.von(Rechnungen.alle(u.store).single()).let { it.copy(positionen = listOf(it.positionen[0].copy(preis = "200"))) }
        assertTrue(Rechnungen.buchungBetroffen(u.store, neu))
        assertFalse(Rechnungen.buchungBetroffen(u.store, Rechnungen.von(Rechnungen.alle(u.store).single())))
        Rechnungen.speichern(u.store, u.files, neu, RechnungOptionen(pdfAblegen = false, buchungAnpassen = false), null, jetzt)
        assertEquals("119", str(u.store.get(Finance.BUCHUNGEN, bid), "amount"))
        Rechnungen.speichern(u.store, u.files, neu, RechnungOptionen(pdfAblegen = false, buchungAnpassen = true), null, jetzt)
        assertEquals("238", str(u.store.get(Finance.BUCHUNGEN, bid), "amount"))
    }

    // C2 (Code-Prüfung 24.11.2026): Sammellöschen wie am Desktop
    @Test fun sammelLoeschenNimmtPdfsMitUndLaesstBuchungenStehen() {
        val u = umgebung()
        val a = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, a, RechnungOptionen(), pdf, jetzt)
        val ba = Rechnungen.bezahlen(u.store, a.id, angaben, jetzt)!!
        val b = form(u, "50" to 0).copy(id = "zweite", nummer = "RE-2026-051")
        Rechnungen.speichern(u.store, u.files, b, RechnungOptionen(), pdf, jetzt)
        val c = form(u, "10" to 0).copy(id = "dritte", nummer = "RE-2026-052")
        Rechnungen.speichern(u.store, u.files, c, RechnungOptionen(pdfAblegen = false), null, jetzt)
        Rechnungen.loeschenMehrere(u.store, u.files, listOf(a.id, "zweite", "gibt-es-nicht"))
        assertEquals(listOf("dritte"), Rechnungen.alle(u.store).map { it.id })
        assertEquals(0, u.store.count("documents")); assertEquals(0, u.files.ids().size)
        assertNotNull(u.store.get(Finance.BUCHUNGEN, ba))
    }

    @Test fun loeschenEntferntPdfUndWahlweiseBuchung() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(), pdf, jetzt)
        val bid = Rechnungen.bezahlen(u.store, f.id, angaben, jetzt)!!
        Rechnungen.loeschen(u.store, u.files, f.id, false)
        assertEquals(0, u.store.count("invoices")); assertEquals(0, u.store.count("documents")); assertEquals(0, u.files.ids().size)
        assertNotNull(u.store.get(Finance.BUCHUNGEN, bid))
        val g = form(u, "100" to 19).copy(id = "zweite", nummer = "RE-2026-050")
        Rechnungen.speichern(u.store, u.files, g, RechnungOptionen(pdfAblegen = false), null, jetzt)
        val b2 = Rechnungen.bezahlen(u.store, "zweite", angaben, jetzt)!!
        Rechnungen.loeschen(u.store, u.files, "zweite", true)
        assertNull(u.store.get(Finance.BUCHUNGEN, b2))
    }

    @Test fun kontoVorschlagJeSphaere() {
        assertEquals("44000", Rechnungen.kontoVorschlag("wirtschaftlich").skrKonto)
        assertEquals("41000", Rechnungen.kontoVorschlag("zweckbetrieb").skrKonto)
        assertEquals("46900", Rechnungen.kontoVorschlag("vermoegen").skrKonto)
        assertEquals("40890", Rechnungen.kontoVorschlag("ideell").skrKonto)
        assertTrue(Rechnungen.kontoVorschlag("ideell").nummernkreis.startsWith("40800 - "))
    }

    @Test fun kontaktUndMitgliedUebernehmen() {
        val u = umgebung()
        val c = buildJsonObject {
            put("id", "cnt-1"); put("displayName", "Stadtwerke AG"); put("companyName", "Stadtwerke AG"); put("personType", "legal"); put("email", "a@b.de"); put("phone", "123")
            put("address", buildJsonObject { put("street", "Energiestraße"); put("houseNumber", "1"); put("zip", "12345"); put("city", "Musterstadt") })
            put("contactPerson", buildJsonObject { put("salutation", "Dr."); put("firstName", "Klaus"); put("lastName", "Becker"); put("roleOrPosition", "Vorstand") })
        }
        u.store.put("contacts", "cnt-1", c)
        assertEquals(listOf("cnt-1" to "Stadtwerke AG"), Rechnungen.kontakte(u.store))
        val f = Rechnungen.mitKontakt(form(u, "1" to 0), c)
        assertEquals("contact", f.empfaengerArt); assertEquals("Stadtwerke AG", f.firma); assertEquals("z. Hd. Dr. Klaus Becker (Vorstand)", f.ansprechpartner)
        assertEquals("Musterstadt", f.ort); assertEquals("Deutschland", f.land)
    }

    // ---------- Vorlage

    @Test fun vorlageRoundtripBehaeltFremdeFelder() {
        val u = umgebung()
        assertEquals(Vorlage(), Vorlagen.lesen(u.store)) // Vorgaben wie am Desktop
        u.store.put("invoiceTemplate", Vorlagen.ID, buildJsonObject { put("id", Vorlagen.ID); put("marginLeft", 25); put("showClubLogo", true); put("defaultPaymentTermsDays", 21) })
        assertEquals(21, Vorlagen.lesen(u.store).zahlungszielTage)
        Vorlagen.speichern(u.store, Vorlagen.lesen(u.store).copy(akzent = "#ff0000", briefpapier = "data:image/jpeg;base64,AAAA", briefpapierName = "bogen.jpg"), jetzt)
        val o = u.store.get("invoiceTemplate", Vorlagen.ID)!!
        assertEquals("25", str(o, "marginLeft")); assertEquals("true", str(o, "showClubLogo")); assertEquals("#ff0000", str(o, "accentColor"))
        assertEquals("bogen.jpg", str(o, "customBlankoFileName"))
        Vorlagen.speichern(u.store, Vorlagen.lesen(u.store).copy(briefpapier = "", briefpapierName = ""), jetzt)
        assertNull(str(u.store.get("invoiceTemplate", Vorlagen.ID), "customBlankoDataUrl"))
        assertEquals(0xFFFF0000.toInt(), Vorlage(akzent = "#ff0000").akzentFarbe)
        assertEquals(0xFF1E40AF.toInt(), Vorlage(akzent = "blau").akzentFarbe)
        assertTrue(Vorlagen.pruefen(Vorlage(akzent = "rot", zahlungszielTage = 999)).size == 2)
    }

    // ---------- Layout

    private val mass = Mass { t, g, fett -> t.length * g * 0.1764 * (if (fett) 1.1 else 1.0) }

    private fun layout(f: RechnungForm, u: Umgebung, v: Vorlage = Vorlage()): List<List<Zeichnung>> {
        val r = Rechnungen.speichern(u.store, u.files, f, RechnungOptionen(pdfAblegen = false), null, jetzt).rechnung
        return RechnungsLayout.bauen(r, Absender.lesen(u.store.get("settings", "main")), v, mass)
    }

    private fun texte(s: List<Zeichnung>) = s.filterIsInstance<Zeichnung.Text>().map { it.text }

    @Test fun einfacheRechnungHatEineSeiteMitAllenAngaben() {
        val u = umgebung()
        val seiten = layout(form(u, "100" to 19), u)
        assertEquals(1, seiten.size)
        val t = texte(seiten[0])
        assertTrue("TSV Beispiel" in t)
        assertTrue("Rechnung Nr. RE-2026-001" in t)
        assertTrue("Kunde GmbH" in t); assertTrue("Max Kunde" in t); assertTrue("Weg 2" in t); assertTrue("10115 Berlin" in t)
        assertTrue("10.11.2026" in t)
        assertTrue("Summe Netto:" in t); assertTrue("zzgl. 19 % USt:" in t)
        assertTrue("119,00 €" in t)
        assertTrue("Gesamtbetrag (Zahlbetrag):" in t)
        assertTrue(t.any { it.startsWith("IBAN: DE02120300000000202051") })
        assertTrue(t.none { it.contains("Sparkasse") }) // der Desktop schreibt fest „Sparkasse / Hausbank“
        assertTrue(t.none { it.startsWith("Kundennummer") })
        val qr = seiten[0].filterIsInstance<Zeichnung.Qr>().single()
        assertTrue(qr.inhalt.startsWith("BCD\n002\n1\nSCT\nBYLADEM1001\nTSV Beispiel\nDE02120300000000202051\nEUR119.00\n\n\nRechnung RE-2026-001"))
    }

    @Test fun ohneIbanOderMitAusgeschaltetemGiroCodeKeinQr() {
        val u = umgebung()
        val f = form(u, "100" to 19)
        assertTrue(layout(f, u, Vorlage(giroCode = false))[0].none { it is Zeichnung.Qr })
        Vereinsdaten.speichern(u.store, Vereinsdaten.lesen(u.store).copy(iban = "", bic = ""), jetzt)
        assertTrue(layout(f.copy(id = "x", nummer = "RE-2026-009"), u)[0].none { it is Zeichnung.Qr })
    }

    @Test fun kleinunternehmerOhneUstZeilenMitHinweis() {
        val u = umgebung()
        val t = texte(layout(form(u, "100" to 19).copy(kleinunternehmer = true), u)[0])
        assertTrue(t.none { it.startsWith("zzgl.") }); assertTrue("Summe Netto:" !in t)
        assertTrue(t.any { it.contains("§ 19 UStG") })
        assertTrue("100,00 €" in t)
    }

    @Test fun vieleBzwLangePositionenLaufenAufEineZweiteSeite() {
        val u = umgebung()
        val f = form(u, "1" to 19).copy(positionen = (1..40).map { PositionForm("p$it", "Leistung Nummer $it mit etwas längerem Text zur Beschreibung der Arbeit", "1", "Stk.", "10", 19) })
        val seiten = layout(f, u)
        assertTrue(seiten.size >= 2)
        val n = seiten.size
        seiten.forEachIndexed { i, s -> assertTrue(texte(s).contains("Seite ${i + 1} von $n")) }
        assertTrue(texte(seiten[1]).contains("Bezeichnung / Beschreibung")) // Tabellenkopf wiederholt sich
        // alle 40 Positionen stehen genau einmal da
        val alle = seiten.flatten().filterIsInstance<Zeichnung.Text>().map { it.text }
        for (i in 1..40) assertEquals("Position $i", 1, alle.count { it.startsWith("Leistung Nummer $i ") || it == "Leistung Nummer $i" })
        assertEquals(1, alle.count { it == "Gesamtbetrag (Zahlbetrag):" })
        // nichts rutscht unter den Fuß (außer Fußzeile und Seitenzahl)
        for (s in seiten) for (z in s.filterIsInstance<Zeichnung.Text>()) if (z.y > 270.0) assertTrue(z.y >= 274.0)
    }

    @Test fun mitBriefpapierKeinBriefkopfUndKeineFussZeile() {
        val u = umgebung()
        val t = texte(layout(form(u, "100" to 19), u, Vorlage(briefpapier = "data:image/png;base64,AAAA"))[0])
        assertTrue("1. Vorsitzender: -" !in t)
        assertTrue(t.none { it.startsWith("Register:") })
        assertTrue("Rechnung Nr. RE-2026-001" in t)
    }

    @Test fun umbrechenKuerztNichtUndBrichtLangeWoerter() {
        val l = RechnungsLayout.umbrechen("eins zwei drei\n\nvier", 12.0, 10.0, false, mass)
        assertEquals(listOf("eins", "zwei", "drei", "", "vier"), l)
        val lang = RechnungsLayout.umbrechen("Donaudampfschifffahrtsgesellschaft", 20.0, 10.0, false, mass)
        assertTrue(lang.size > 1); assertEquals("Donaudampfschifffahrtsgesellschaft", lang.joinToString(""))
    }

    @Test fun giroCodeOhneBetragOderIbanIstNull() {
        val a = Absender("V", "", "", "", "", "", "", "", "", "", "")
        assertNull(GiroCode.inhalt(a, BigDecimal("10"), "x"))
        assertNull(GiroCode.inhalt(a.copy(iban = "DE02120300000000202051"), BigDecimal.ZERO, "x"))
        assertNotNull(GiroCode.inhalt(a.copy(iban = "DE02120300000000202051"), BigDecimal("10"), "x"))
    }
}
