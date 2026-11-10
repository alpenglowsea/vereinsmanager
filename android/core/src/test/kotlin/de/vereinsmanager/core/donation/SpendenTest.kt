package de.vereinsmanager.core.donation

import de.vereinsmanager.core.documents.StandardOrdner
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.files.readBytes
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.InMemoryDocumentStore
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
import java.io.ByteArrayInputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.zip.ZipInputStream

class SpendenTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 10, 9, 0, 0, 0, ZoneOffset.UTC)
    private val pdfBytes = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n".toByteArray()
    private val pdf: SpendenPdf = { _, _ -> pdfBytes }

    private class Umgebung {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
    }

    private fun umgebung(): Umgebung = Umgebung().also { u ->
        Vereinsdaten.speichern(
            u.store,
            VereinsForm(
                name = "TSV Beispiel", strasse = "Hauptstr.", hausnummer = "1", plz = "17235", ort = "Neustrelitz", kassenwart = "Erika Muster",
                finanzamt = "Neubrandenburg", steuernummer = "079/123/45678", freistellungsDatum = "2025-07-24",
                veranlagungszeitraum = "2022-2024", zweck = "Förderung des Sports",
            ),
            jetzt,
        )
        u.store.put(Finance.KONTEN, "k1", buildJsonObject { put("id", "k1"); put("name", "Giro"); put("accountType", "bank"); put("initialBalance", 0) })
    }

    private fun form(u: Umgebung, betrag: String = "150", name: String = "Max Spender") =
        Spenden.neu(u.store, LocalDate.of(2026, 11, 10)).copy(betrag = betrag, inWorten = Spenden.inWorten(betrag), name = name, strasse = "Weg", hausnummer = "2", plz = "10115", ort = "Berlin")

    private fun str(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.content

    @Test fun neuesFormularIstMitVereinsdatenVorbelegt() {
        val u = umgebung()
        val f = Spenden.neu(u.store, LocalDate.of(2026, 11, 10))
        assertEquals("ZB-2026-001", f.nummer)
        assertEquals("2026-11-10", f.datum)
        assertEquals("Neubrandenburg", f.finanzamt)
        assertEquals("079/123/45678", f.steuernummer)
        assertEquals("2025-07-24", f.freistellung)
        assertEquals("Förderung des Sports", f.zweck)
        assertEquals("Erika Muster (Vorstand)", f.aussteller)
        assertEquals("Neustrelitz, 10.11.2026", f.ortDatum)
    }

    @Test fun nummerIstHoechsteDesJahresPlusEinsAuchNachLoeschen() {
        val liste = listOf("ZB-2026-001", "ZB-2026-003", "ZB-2025-009", "frei")
        assertEquals("ZB-2026-004", Spenden.naechsteNummer(liste, 2026))
        assertEquals("ZB-2027-001", Spenden.naechsteNummer(liste, 2027))
    }

    @Test fun pruefenLehntFehlerhaftesAb() {
        val u = umgebung()
        assertNotNull(Spenden.pruefen(u.store, form(u, betrag = "0")))
        assertNotNull(Spenden.pruefen(u.store, form(u, betrag = "abc")))
        assertNotNull(Spenden.pruefen(u.store, form(u, name = "  ")))
        assertNotNull(Spenden.pruefen(u.store, form(u).copy(art = "goods", sachBeschreibung = "")))
        assertNull(Spenden.pruefen(u.store, form(u).copy(art = "goods", sachBeschreibung = "Laptop")))
        assertNull(Spenden.pruefen(u.store, form(u)))
    }

    @Test fun doppelteNummerWirdAbgelehnt() {
        val u = umgebung()
        Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(pdfAblegen = false), null, jetzt)
        val zweite = form(u).copy(id = Spenden.neueId(), nummer = "zb-2026-001")
        assertTrue(Spenden.pruefen(u.store, zweite)!!.contains("gibt es schon"))
        // die eigene Nummer beim Bearbeiten ist kein Konflikt
        val eigene = Spenden.von(Spenden.alle(u.store).single(), Spenden.steuerangaben(u.store))
        assertNull(Spenden.pruefen(u.store, eigene))
    }

    @Test fun speichernLegtBestaetigungBuchungUndPdfAn() {
        val u = umgebung()
        val f = form(u)
        val erg = Spenden.speichern(u.store, u.files, f, SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), pdf, jetzt)
        assertNull(erg.pdfFehler)
        val r = Spenden.alle(u.store).single()
        assertEquals("ZB-2026-001", r.receiptNumber)
        assertEquals(0, BigDecimal("150").compareTo(r.amount))
        assertEquals("Einhundertfünfzig Euro", r.amountInWords)
        assertTrue(r.isDirectlyPromoted)
        assertEquals(erg.buchungId, r.transactionId)
        assertEquals(erg.dokumentId, r.documentId)

        val b = u.store.get(Finance.BUCHUNGEN, erg.buchungId!!)!!
        assertEquals("income", str(b, "type"))
        assertEquals("150", str(b, "amount"))
        assertEquals("k1", str(b, "accountId"))
        assertEquals("ideell", str(b, "sphere"))
        assertEquals("40450", str(b, "skrAccount"))
        assertTrue(str(b, "mainCategory")!!.startsWith("40400 - "))
        assertTrue(str(b, "category")!!.startsWith("40450 - "))
        assertEquals("SP-2026-001", str(b, "documentNumber"))
        assertEquals("Spende / Zuwendung: Max Spender (ZB-2026-001)", str(b, "bookingText"))

        val d = u.store.get("documents", erg.dokumentId!!)!!
        assertEquals("belege", str(d, "category"))
        assertEquals("application/pdf", str(d, "fileType"))
        assertEquals(erg.buchungId, str(d, "transactionId"))
        val ordner = u.store.get("folders", str(d, "folderId")!!)!!
        assertEquals("Belege 2026", str(ordner, "name"))
        assertTrue(u.files.readBytes(str(d, "fileId")!!)!!.contentEquals(pdfBytes))
    }

    @Test fun sachspendeBekommtKeineBuchung() {
        val u = umgebung()
        val f = form(u).copy(art = "goods", sachBeschreibung = "Laptop, 2 Jahre alt", sachHerkunft = "private")
        val erg = Spenden.speichern(u.store, u.files, f, SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), pdf, jetzt)
        assertNull(erg.buchungId)
        assertEquals(0, u.store.count(Finance.BUCHUNGEN))
        assertEquals("Laptop, 2 Jahre alt", Spenden.alle(u.store).single().goodsDescription)
    }

    @Test fun buchungsNummerBleibtEindeutig() {
        val u = umgebung()
        val a = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(buchungAnlegen = true, kontoId = "k1", pdfAblegen = false), null, jetzt)
        // zweite Bestätigung mit gleichen letzten Ziffern der Nummer
        val zweite = form(u).copy(id = Spenden.neueId(), nummer = "ZB-2025-001", datum = "2026-11-11")
        val b = Spenden.speichern(u.store, u.files, zweite, SpendeOptionen(buchungAnlegen = true, kontoId = "k1", pdfAblegen = false), null, jetzt)
        assertEquals("SP-2026-001", str(u.store.get(Finance.BUCHUNGEN, a.buchungId!!), "documentNumber"))
        assertEquals("SP-2026-001-2", str(u.store.get(Finance.BUCHUNGEN, b.buchungId!!), "documentNumber"))
    }

    @Test fun fehlendesKontoVerhindertAllesSpeichern() {
        val u = umgebung()
        try {
            Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(buchungAnlegen = true, kontoId = "gibtsNicht"), pdf, jetzt)
            fail()
        } catch (e: IllegalStateException) { assertTrue(e.message!!.contains("Konto")) }
        assertEquals(0, u.store.count(Spenden.BEREICH))
        assertEquals(0, u.store.count(Finance.BUCHUNGEN))
        assertEquals(0, u.store.count("documents"))
        assertTrue(u.files.ids().isEmpty())
    }

    @Test fun pdfFehlerLaesstBestaetigungGespeichert() {
        val u = umgebung()
        val erg = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(), { _, _ -> throw IllegalStateException("kaputt") }, jetzt)
        assertEquals("kaputt", erg.pdfFehler)
        assertEquals(1, u.store.count(Spenden.BEREICH))
        assertNull(erg.dokumentId)
        assertEquals(0, u.store.count("documents"))
    }

    @Test fun bearbeitenErsetztPdfOhneZweiteBuchung() {
        val u = umgebung()
        val erg = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), pdf, jetzt)
        val altDatei = str(u.store.get("documents", erg.dokumentId!!), "fileId")!!
        val f = Spenden.von(Spenden.alle(u.store).single(), Spenden.steuerangaben(u.store)).copy(notiz = "geändert")
        // Buchung nicht noch einmal anlegen, auch wenn der Schalter gesetzt bleibt
        val neu = Spenden.speichern(u.store, u.files, f, SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), { _, _ -> "%PDF-neu".toByteArray() }, jetzt)
        assertEquals(1, u.store.count(Finance.BUCHUNGEN))
        assertEquals(erg.buchungId, neu.buchungId)
        assertEquals(1, u.store.count("documents"))
        assertEquals(erg.dokumentId, neu.dokumentId)
        val neueDatei = str(u.store.get("documents", neu.dokumentId!!), "fileId")!!
        assertFalse(altDatei == neueDatei)
        assertNull(u.files.readBytes(altDatei))
        assertEquals("geändert", Spenden.alle(u.store).single().notes)
    }

    @Test fun aenderungAnBetragBetrifftBuchungUndWirdAufWunschAngeglichen() {
        val u = umgebung()
        val erg = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(buchungAnlegen = true, kontoId = "k1", pdfAblegen = false), null, jetzt)
        val unveraendert = Spenden.von(Spenden.alle(u.store).single(), Spenden.steuerangaben(u.store))
        assertFalse(Spenden.buchungBetroffen(u.store, unveraendert))
        assertFalse(Spenden.buchungBetroffen(u.store, unveraendert.copy(notiz = "nur Notiz")))
        val neu = unveraendert.copy(betrag = "200,50", inWorten = Spenden.inWorten("200,50"))
        assertTrue(Spenden.buchungBetroffen(u.store, neu))

        // ohne Wunsch bleibt die Buchung wie sie war
        Spenden.speichern(u.store, u.files, neu, SpendeOptionen(pdfAblegen = false), null, jetzt)
        assertEquals("150", str(u.store.get(Finance.BUCHUNGEN, erg.buchungId!!), "amount"))
        // mit Wunsch wird sie angeglichen
        Spenden.speichern(u.store, u.files, neu, SpendeOptionen(pdfAblegen = false, buchungAnpassen = true), null, jetzt)
        val b = u.store.get(Finance.BUCHUNGEN, erg.buchungId!!)!!
        assertEquals("200.5", str(b, "amount"))
        assertEquals("income", str(b, "type"))
    }

    @Test fun loeschenEntferntPdfUndBuchungNurAufWunsch() {
        val u = umgebung()
        val erg = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), pdf, jetzt)
        val datei = str(u.store.get("documents", erg.dokumentId!!), "fileId")!!
        val id = Spenden.alle(u.store).single().id
        Spenden.loeschen(u.store, u.files, id, buchungMitLoeschen = false)
        assertEquals(0, u.store.count(Spenden.BEREICH))
        assertEquals(0, u.store.count("documents"))
        assertNull(u.files.readBytes(datei))
        assertEquals(1, u.store.count(Finance.BUCHUNGEN))

        val u2 = umgebung()
        val e2 = Spenden.speichern(u2.store, u2.files, form(u2), SpendeOptionen(buchungAnlegen = true, kontoId = "k1"), pdf, jetzt)
        Spenden.loeschen(u2.store, u2.files, Spenden.alle(u2.store).single().id, buchungMitLoeschen = true)
        assertNull(u2.store.get(Finance.BUCHUNGEN, e2.buchungId!!))
        assertTrue(u2.files.ids().isEmpty())
    }

    @Test fun unbekannteFelderBleibenErhalten() {
        val u = umgebung()
        val erg = Spenden.speichern(u.store, u.files, form(u), SpendeOptionen(pdfAblegen = false), null, jetzt)
        val id = Spenden.alle(u.store).single().id
        val roh = u.store.get(Spenden.BEREICH, id)!!
        u.store.put(Spenden.BEREICH, id, JsonObject(roh + ("fremd" to JsonPrimitive("bleibt"))))
        Spenden.speichern(u.store, u.files, Spenden.von(Spenden.alle(u.store).single(), Spenden.steuerangaben(u.store)), SpendeOptionen(pdfAblegen = false), null, jetzt)
        assertEquals("bleibt", str(u.store.get(Spenden.BEREICH, id), "fremd"))
        assertNull(erg.buchungId)
    }

    @Test fun mitgliedUebernimmtNameUndAnschrift() {
        val u = umgebung()
        val m = de.vereinsmanager.core.members.Member.from(
            buildJsonObject {
                put("id", "m1"); put("firstName", "Anna"); put("lastName", "Beispiel")
                put("address", buildJsonObject { put("street", "Gasse"); put("houseNumber", "5"); put("zip", "12345"); put("city", "Ort") })
            },
        )
        val f = Spenden.mitMitglied(form(u), m)
        assertEquals("member", f.quelle)
        assertEquals("m1", f.mitgliedId)
        assertEquals("Anna Beispiel", f.name)
        assertEquals("Gasse", f.strasse)
        assertEquals("Deutschland", f.land)
    }

    @Test fun zipEnthaeltAlleDateien() {
        val zip = SpendenZip.bauen(listOf("a.pdf", "b.pdf"), listOf(byteArrayOf(1, 2, 3), byteArrayOf(4)))
        val z = ZipInputStream(ByteArrayInputStream(zip))
        val gelesen = ArrayList<Pair<String, Int>>()
        while (true) { val e = z.nextEntry ?: break; gelesen.add(e.name to z.readBytes().size) }
        assertEquals(listOf("a.pdf" to 3, "b.pdf" to 1), gelesen)
    }

    @Test fun vordruckGeldspendeEnthaeltDieAmtlichenTexteUndAngaben() {
        val u = umgebung()
        Spenden.speichern(u.store, u.files, form(u).copy(verzicht = true), SpendeOptionen(pdfAblegen = false), null, jetzt)
        val r = Spenden.alle(u.store).single()
        val z = ZuwendungsVordruck.bauen(r, Spenden.steuerangaben(u.store))
        val texte = z.filterIsInstance<Zeichnung.Text>().map { it.text }
        assertTrue(texte.contains("Bestätigung über Geldzuwendungen/Mitgliedsbeitrag"))
        assertTrue(texte.contains("TSV Beispiel"))
        assertTrue(texte.contains("Max Spender"))
        assertTrue(texte.contains("Weg 2"))
        assertTrue(texte.contains("10115 Berlin"))
        assertTrue(texte.contains("150,00€"))
        assertTrue(texte.contains("10.11.2026"))
        assertTrue(texte.contains("Neubrandenburg"))
        assertTrue(texte.contains("079/123/45678"))
        assertTrue(texte.contains("24.07.2025"))
        assertTrue(texte.contains("2022-2024"))
        assertTrue(texte.contains("Beleg-Nr. ZB-2026-001"))
        assertTrue(texte.contains("034122"))
        assertTrue(z.filterIsInstance<Zeichnung.Text>().any { it.fettAnhang == "(2013)" })
        val worte = z.filterIsInstance<Zeichnung.Umbruch>().first { it.maxZeilen == 1 }
        assertEquals(listOf("Einhundertfünfzig Euro"), worte.absaetze)
        val hinweis = z.filterIsInstance<Zeichnung.Umbruch>().last()
        assertEquals(listOf(ZuwendungsVordruck.HINWEIS_1, ZuwendungsVordruck.HINWEIS_2), hinweis.absaetze)
        // Verzicht ja: Ja-Kästchen hat ein Kreuz (zwei Linien mehr als beim Nein-Kästchen)
        val kreuze = z.filterIsInstance<Zeichnung.Linie>().count { it.dicke == 0.35 }
        assertEquals(6, kreuze) // Ja (2) + Freistellung (2) + Mitgliedsbeitrag-Kästchen (2); Feststellung nicht angekreuzt
        assertFalse(texte.any { it.contains("Sachzuwendung") && it.startsWith("Bestätigung über Sach") })
    }

    @Test fun vordruckSachspendeVerschiebtSpaeterTeileUndZeigtHerkunft() {
        val u = umgebung()
        val f = form(u).copy(art = "goods", sachBeschreibung = "Laptop", sachHerkunft = "business", sachUnterlagen = "Rechnung vom 1.5.")
        Spenden.speichern(u.store, u.files, f, SpendeOptionen(pdfAblegen = false), null, jetzt)
        val r = Spenden.alle(u.store).single()
        val st = Spenden.steuerangaben(u.store)
        val geld = ZuwendungsVordruck.bauen(r.copy(type = "money"), st).filterIsInstance<Zeichnung.Text>().first { it.text.startsWith("Wir sind wegen") }
        val sach = ZuwendungsVordruck.bauen(r, st)
        val sachFoerderung = sach.filterIsInstance<Zeichnung.Text>().first { it.text.startsWith("Wir sind wegen") }
        assertEquals(geld.y + 18.0, sachFoerderung.y, 0.0001)
        val texte = sach.filterIsInstance<Zeichnung.Text>().map { it.text }
        assertTrue(texte.contains("Bestätigung über Sachzuwendungen"))
        assertTrue(texte.contains("Wert der Zuwendung - in Ziffern -"))
        assertTrue(texte.contains("Unterlagen zur Wertermittlung (z. B. Rechnung, Gutachten): Rechnung vom 1.5."))
        assertTrue(texte.contains("Es wird bestätigt, dass über die Sachzuwendung keine weitere Bestätigung ausgestellt wurde und wird."))
        assertFalse(texte.contains("034122"))
        assertTrue(texte.any { it.startsWith("Bestätigung über Sachzuwendung / steuerbegünstigte") })
    }

    @Test fun vordruckOhneFreistellungLaesstDieAngabenLeer() {
        val r = DonationReceipt(id = "x", receiptNumber = "ZB-1", donorName = "A", amount = BigDecimal("10"), date = "2026-01-02")
        val z = ZuwendungsVordruck.bauen(r, ClubTaxSettings(clubName = "Verein"))
        val texte = z.filterIsInstance<Zeichnung.Text>().map { it.text }
        assertFalse(texte.contains("Neubrandenburg"))
        // Kreuze nur bei "Nein" (kein Verzicht) und beim Mitgliedsbeitrag-Kästchen; keines bei Freistellung und Feststellung
        assertEquals(4, z.filterIsInstance<Zeichnung.Linie>().count { it.dicke == 0.35 })
    }
}
