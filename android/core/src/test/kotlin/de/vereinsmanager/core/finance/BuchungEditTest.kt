package de.vereinsmanager.core.finance

import de.vereinsmanager.core.skr42.Skr42
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BuchungEditTest {
    private fun d(s: String) = BigDecimal(s)
    private val jetzt = ZonedDateTime.of(2026, 10, 26, 12, 0, 0, 0, ZoneOffset.UTC)
    private val konten = listOf(
        Konto("k1", "Giro", "bank", "", "", d("0"), "", "", null),
        Konto("k2", "Kasse", "cash", "", "", d("0"), "", "", null),
    )

    private fun gut() = BuchungRegeln.neu("tx-1", "2026-10-26", "BE-2026-001", "k1")
        .copy(betrag = "280,00", text = "Spielbälle", partner = "Sportshop")

    @Test
    fun betragWirdDeutschGelesen() {
        assertEquals(d("12.50"), BuchungRegeln.parseBetrag("12,5"))
        assertEquals(d("1234.50"), BuchungRegeln.parseBetrag("1.234,50"))
        assertEquals(d("12.50"), BuchungRegeln.parseBetrag("12.50"))
        assertEquals(d("1234.00"), BuchungRegeln.parseBetrag("1.234"))
        assertEquals(d("12.00"), BuchungRegeln.parseBetrag("12 €"))
        assertNull(BuchungRegeln.parseBetrag("abc"))
        assertNull(BuchungRegeln.parseBetrag(""))
        assertNull(BuchungRegeln.parseBetrag("-5"))
    }

    @Test
    fun betragsTextFuerDasEingabefeld() {
        assertEquals("1234,5", BuchungRegeln.betragText(d("1234.50")))
        assertEquals("280", BuchungRegeln.betragText(d("-280")))
        assertEquals("100", BuchungRegeln.betragText(d("100.00")))
    }

    @Test
    fun naechsteBelegNummerNimmtDieHoechsteDesJahresPlusEins() {
        val vorhanden = listOf("BE-2026-001", "BE-2026-007", "BE-2025-020", "xyz", "")
        assertEquals("BE-2026-008", BuchungRegeln.naechsteBelegNummer(vorhanden, 2026))
        assertEquals("BE-2025-021", BuchungRegeln.naechsteBelegNummer(vorhanden, 2025))
        assertEquals("BE-2027-001", BuchungRegeln.naechsteBelegNummer(vorhanden, 2027))
        assertEquals("BE-2026-1000", BuchungRegeln.naechsteBelegNummer(listOf("BE-2026-999"), 2026))
    }

    @Test
    fun neuesFormularHatDieVorgabenEinerAusgabe() {
        val f = gut()
        val main = Skr42.mains("expense").first()
        assertEquals("expense", f.art)
        assertEquals("ideell", f.sphaere)
        assertEquals("${main.code} - ${main.name}", f.nummernkreis)
        assertEquals(main.subCategories.first().label, f.konto)
        assertEquals(main.subCategories.first().code, f.skrKonto)
    }

    @Test
    fun gueltigesFormularHatKeineFehler() {
        assertTrue(BuchungRegeln.pruefen(gut(), konten).isEmpty())
    }

    @Test
    fun pflichtfelderMeldenWieAmDesktop() {
        val f = gut().copy(text = " ", partner = "", betrag = "0", belegNummer = "")
        val e = BuchungRegeln.pruefen(f, konten)
        assertEquals("Buchungstext ist erforderlich.", e["text"])
        assertEquals("Zahlungspartner ist erforderlich.", e["partner"])
        assertEquals("Betrag muss größer als 0 sein.", e["betrag"])
        assertEquals("Belegnummer ist erforderlich.", e["belegNummer"])
        assertEquals(4, e.size)
    }

    @Test
    fun umbuchungBrauchtKeinenPartnerAberEinAnderesZielkonto() {
        val f = gut().copy(art = "transfer", partner = "", zielkontoId = "k1")
        assertEquals("Zielkonto muss sich vom Quellkonto unterscheiden.", BuchungRegeln.pruefen(f, konten)["zielkonto"])
        assertEquals("Bitte ein Zielkonto wählen.", BuchungRegeln.pruefen(f.copy(zielkontoId = ""), konten)["zielkonto"])
        assertTrue(BuchungRegeln.pruefen(f.copy(zielkontoId = "k2"), konten).isEmpty())
    }

    @Test
    fun ungueltigerBetragUndFehlendeKonten() {
        assertEquals("Bitte einen Betrag wie 12,50 eingeben.", BuchungRegeln.pruefen(gut().copy(betrag = "abc"), konten)["betrag"])
        assertEquals("Bitte zuerst ein Konto anlegen.", BuchungRegeln.pruefen(gut(), emptyList())["konto"])
        assertEquals("Bitte ein Konto wählen.", BuchungRegeln.pruefen(gut().copy(kontoId = "x"), konten)["konto"])
    }

    @Test
    fun splitSummeMussStimmen() {
        val f = gut().copy(betrag = "100").let { BuchungRegeln.aufteilen(it, nummer = "t") }
        val schief = f.copy(teile = listOf(f.teile[0].copy(betrag = "60"), f.teile[1].copy(betrag = "30")))
        assertEquals(
            "Die Summe der Teilbeträge (90,00 €) stimmt nicht mit der Buchungssumme (100,00 €) überein. Differenz: 10,00 €.",
            BuchungRegeln.pruefen(schief, konten)["teile"],
        )
        val richtig = schief.copy(teile = listOf(schief.teile[0], schief.teile[1].copy(betrag = "40")))
        assertTrue(BuchungRegeln.pruefen(richtig, konten).isEmpty())
        val null0 = schief.copy(teile = listOf(schief.teile[0], schief.teile[1].copy(betrag = "")))
        assertEquals("Jede Teilbuchung muss einen Betrag größer als 0,00 € haben.", BuchungRegeln.pruefen(null0, konten)["teile"])
        val einzeln = f.copy(teile = listOf(f.teile[0]))
        assertEquals("Eine Splittbuchung muss aus mindestens 2 Teilbuchungen bestehen.", BuchungRegeln.pruefen(einzeln, konten)["teile"])
    }

    @Test
    fun aufteilenUebernimmtBetragUndKonto() {
        val f = BuchungRegeln.aufteilen(gut().copy(betrag = "100"), nummer = "t")
        assertTrue(f.aufgeteilt)
        assertEquals(2, f.teile.size)
        assertEquals("100", f.teile[0].betrag)
        assertEquals(gut().konto, f.teile[0].konto)
        assertEquals("", f.teile[1].betrag)
        assertEquals("68100", f.teile[1].skrKonto)
        assertEquals("68000", f.teile[1].nummernkreis.substringBefore(" - "))
        assertEquals(f, BuchungRegeln.aufteilen(f, nummer = "u").copy())
    }

    @Test
    fun artWechselSpringtAufPassendenNummernkreis() {
        val e = BuchungRegeln.mitArt(gut(), "income")
        val main = Skr42.mains("income").first()
        assertEquals("income", e.art)
        assertEquals("${main.code} - ${main.name}", e.nummernkreis)
        assertEquals(main.subCategories.first().code, e.skrKonto)
        // Zurück auf Ausgabe: wieder ein Ausgaben-Nummernkreis
        assertEquals("expense", Skr42.findMain(BuchungRegeln.mitArt(e, "expense").nummernkreis)!!.type)
        // Passt der Nummernkreis schon zur neuen Art, bleibt er stehen
        val zweiter = Skr42.mains("expense")[1]
        val von = gut().copy(art = "transfer", nummernkreis = BuchungRegeln.nummernkreisText(zweiter))
        assertEquals(BuchungRegeln.nummernkreisText(zweiter), BuchungRegeln.mitArt(von, "expense").nummernkreis)
        // Umbuchung ändert nur die Art
        assertEquals(gut().copy(art = "transfer"), BuchungRegeln.mitArt(gut(), "transfer"))
    }

    @Test
    fun nummernkreisMitDoppelterNummerWirdGenauGefunden() {
        val zwb = Skr42.standard.first { it.id == "HK-69000-ZWB" }
        val gefunden = BuchungRegeln.hauptkonto(BuchungRegeln.nummernkreisText(zwb), "", Skr42.standard)
        assertEquals("HK-69000-ZWB", gefunden!!.id)
    }

    @Test
    fun ausgabeWirdNegativGespeichertEinnahmeUndUmbuchungPositiv() {
        val aus = BuchungDokument.build(gut(), null, jetzt)
        assertEquals("-280", aus["amount"]!!.jsonPrimitive.content)
        val ein = BuchungDokument.build(gut().copy(art = "income"), null, jetzt)
        assertEquals("280", ein["amount"]!!.jsonPrimitive.content)
        val um = BuchungDokument.build(gut().copy(art = "transfer", zielkontoId = "k2"), null, jetzt)
        assertEquals("280", um["amount"]!!.jsonPrimitive.content)
        assertEquals("k2", um["targetAccountId"]!!.jsonPrimitive.content)
        assertEquals("", aus["targetAccountId"]!!.jsonPrimitive.content)
        assertEquals("2026-10-26T12:00:00.000Z", aus["createdAt"]!!.jsonPrimitive.content)
        assertEquals("12.5", BuchungDokument.build(gut().copy(betrag = "12,5"), null, jetzt).let { it["amount"]!!.jsonPrimitive.content.removePrefix("-") })
    }

    @Test
    fun bearbeitenBehaeltUnbekannteFelderBelegUndAnlagedatum() {
        val alt = buildJsonObject {
            put("id", "tx-1"); put("date", "2025-03-01"); put("amount", -100); put("type", "expense"); put("accountId", "k1")
            put("documentNumber", "BE-2025-010"); put("bookingText", "alt"); put("partner", "p"); put("sphere", "ideell")
            put("createdAt", "2025-03-01T14:00:00.000Z"); put("updatedAt", "2025-03-01T14:00:00.000Z")
            put("zukunftsFeld", "bleibt"); put("department", "Fußball")
            put("receipt", buildJsonObject { put("name", "r.pdf"); put("size", 5) })
        }
        val b = Buchung.from(alt)
        val neu = BuchungDokument.build(BuchungRegeln.von(b).copy(text = "neu"), alt, jetzt)
        assertEquals("bleibt", neu["zukunftsFeld"]!!.jsonPrimitive.content)
        assertEquals("r.pdf", (neu["receipt"] as JsonObject)["name"]!!.jsonPrimitive.content)
        assertEquals("2025-03-01T14:00:00.000Z", neu["createdAt"]!!.jsonPrimitive.content)
        assertEquals("2026-10-26T12:00:00.000Z", neu["updatedAt"]!!.jsonPrimitive.content)
        assertEquals("neu", neu["bookingText"]!!.jsonPrimitive.content)
        assertEquals("Fußball", neu["department"]!!.jsonPrimitive.content)
        assertEquals("-100", neu["amount"]!!.jsonPrimitive.content)
        // Sparte leeren entfernt das Feld
        assertFalse(BuchungDokument.build(BuchungRegeln.von(b).copy(sparte = ""), alt, jetzt).containsKey("department"))
    }

    @Test
    fun splitbuchungKommtUnveraendertZurueck() {
        val f = BuchungRegeln.aufteilen(gut().copy(betrag = "100"), nummer = "t").let {
            it.copy(teile = listOf(it.teile[0].copy(betrag = "60"), it.teile[1].copy(betrag = "40,50")))
        }.copy(betrag = "100,50")
        assertTrue(BuchungRegeln.pruefen(f, konten).isEmpty())
        val doc = BuchungDokument.build(f, null, jetzt)
        assertTrue(doc["isSplit"]!!.jsonPrimitive.boolean)
        assertEquals(2, (doc["splits"] as JsonArray).size)
        val b = Buchung.from(doc)
        assertEquals(d("-100.5"), b.betrag)
        assertEquals(d("60"), b.teile[0].betrag)
        assertEquals(d("40.5"), b.teile[1].betrag)
        assertEquals("68100", b.teile[1].skrKonto)
        // oben stehen die Angaben der ersten Zeile
        assertEquals(f.teile[0].skrKonto, doc["skrAccount"]!!.jsonPrimitive.content)
        val zurueck = BuchungRegeln.von(b)
        assertTrue(zurueck.aufgeteilt)
        assertEquals("40,5", zurueck.teile[1].betrag)
        assertTrue(BuchungRegeln.pruefen(zurueck, konten).isEmpty())
    }

    @Test
    fun unbekannteFelderInTeilbuchungenBleiben() {
        val f = BuchungRegeln.aufteilen(gut().copy(betrag = "100"), nummer = "t").let {
            it.copy(teile = listOf(it.teile[0].copy(betrag = "60"), it.teile[1].copy(betrag = "40")))
        }
        val alt = BuchungDokument.build(f, null, jetzt)
        val mitExtra = JsonObject(
            alt + ("splits" to buildJsonArray {
                (alt["splits"] as JsonArray).forEach { t -> add(JsonObject((t as JsonObject) + ("extra" to JsonPrimitive("x")))) }
            }),
        )
        val neu = BuchungDokument.build(BuchungRegeln.von(Buchung.from(mitExtra)), mitExtra, jetzt)
        assertEquals("x", ((neu["splits"] as JsonArray)[0] as JsonObject)["extra"]!!.jsonPrimitive.content)
    }

    @Test
    fun ausSplitWirdEinfacheBuchung() {
        val f = BuchungRegeln.aufteilen(gut().copy(betrag = "100"), nummer = "t").let {
            it.copy(teile = listOf(it.teile[0].copy(betrag = "60"), it.teile[1].copy(betrag = "40")))
        }
        val alt = BuchungDokument.build(f, null, jetzt)
        val neu = BuchungDokument.build(f.copy(aufgeteilt = false), alt, jetzt)
        assertFalse(neu.containsKey("splits"))
        assertFalse(neu["isSplit"]!!.jsonPrimitive.boolean)
    }

    @Test
    fun speichernAendernUndLoeschenImSpeicher() {
        val store = InMemoryDocumentStore()
        BuchungStore.speichern(store, gut(), jetzt)
        BuchungStore.speichern(store, gut().copy(id = "tx-2", belegNummer = "BE-2026-002"), jetzt)
        assertEquals(2, Finance.buchungen(store).size)
        BuchungStore.speichern(store, gut().copy(text = "geändert"), jetzt)
        assertEquals(2, Finance.buchungen(store).size)
        assertEquals("geändert", Finance.buchungen(store).first { it.id == "tx-1" }.text)
        BuchungStore.loeschen(store, "tx-1")
        assertEquals(listOf("tx-2"), Finance.buchungen(store).map { it.id })
        assertNotNull(store.get("transactions", "tx-2"))
    }
}
