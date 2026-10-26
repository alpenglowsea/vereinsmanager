package de.vereinsmanager.core.finance

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue

class FinanceTest {
    private fun d(s: String) = BigDecimal(s)

    private fun kontoDoc(id: String, name: String, start: Number, order: Int? = null): JsonObject = buildJsonObject {
        put("id", id); put("name", name); put("accountType", "bank"); put("initialBalance", start)
        if (order != null) put("order", order)
    }

    private fun buchungDoc(
        id: String, datum: String, betrag: Number, art: String, konto: String,
        ziel: String? = null, nr: String = "", text: String = "", partner: String = "",
        sphaere: String = "ideell", kategorie: String = "", notiz: String = "", beleg: Boolean = false,
    ): JsonObject = buildJsonObject {
        put("id", id); put("date", datum); put("amount", betrag); put("type", art); put("accountId", konto)
        if (ziel != null) put("targetAccountId", ziel)
        put("documentNumber", nr); put("bookingText", text); put("partner", partner); put("sphere", sphaere)
        put("category", kategorie); put("notes", notiz); put("vatRate", 19)
        if (beleg) put("receipt", buildJsonObject { put("name", "r.pdf"); put("type", "application/pdf"); put("size", 1234) })
    }

    private fun konten(vararg k: Konto) = k.toList()
    private fun k(id: String, start: String) = Konto(id, id, "bank", "", "", d(start), "", "", null)

    @Test
    fun kontostandAusAnfangsbestandUndBuchungen() {
        val ks = konten(k("a", "100.00"), k("b", "0"))
        val bs = listOf(
            Buchung.from(buchungDoc("1", "2025-01-01", 50, "income", "a")),
            Buchung.from(buchungDoc("2", "2025-01-02", -30.5, "expense", "a")),
            Buchung.from(buchungDoc("3", "2025-01-03", 10, "income", "b")),
        )
        val st = Finance.kontostaende(ks, bs)
        assertEquals(0, d("119.50").compareTo(st["a"]))
        assertEquals(0, d("10").compareTo(st["b"]))
        assertEquals(0, d("129.50").compareTo(Finance.gesamtLiquiditaet(st)))
    }

    @Test
    fun umbuchungMindertQuelleUndMehrtZiel() {
        val ks = konten(k("a", "100"), k("b", "0"))
        // Das Vorzeichen spielt bei Umbuchungen keine Rolle.
        val bs = listOf(
            Buchung.from(buchungDoc("1", "2025-01-01", -40, "transfer", "a", ziel = "b")),
            Buchung.from(buchungDoc("2", "2025-01-02", 10, "transfer", "a", ziel = "b")),
        )
        val st = Finance.kontostaende(ks, bs)
        assertEquals(0, d("50").compareTo(st["a"]))
        assertEquals(0, d("50").compareTo(st["b"]))
        // Die Gesamtsumme bleibt bei Umbuchungen gleich.
        assertEquals(0, d("100").compareTo(Finance.gesamtLiquiditaet(st)))
    }

    @Test
    fun buchungAufUnbekanntesKontoZaehltNicht() {
        val ks = konten(k("a", "10"))
        val bs = listOf(Buchung.from(buchungDoc("1", "2025-01-01", 99, "income", "x")))
        assertEquals(0, d("10").compareTo(Finance.kontostaende(ks, bs)["a"]))
    }

    @Test
    fun umbuchungMitUnbekanntemZielMindertNurDieQuelle() {
        val ks = konten(k("a", "100"))
        val bs = listOf(Buchung.from(buchungDoc("1", "2025-01-01", 30, "transfer", "a", ziel = "weg")))
        assertEquals(0, d("70").compareTo(Finance.kontostaende(ks, bs)["a"]))
    }

    @Test
    fun einnahmeAusgabeUndUmbuchungWerdenUnterschieden() {
        val e = Buchung.from(buchungDoc("1", "2025-01-01", 5, "income", "a"))
        val a = Buchung.from(buchungDoc("2", "2025-01-01", -5, "expense", "a"))
        val aPositiv = Buchung.from(buchungDoc("3", "2025-01-01", 5, "expense", "a"))
        val u = Buchung.from(buchungDoc("4", "2025-01-01", 5, "transfer", "a", ziel = "b"))
        assertTrue(e.istEinnahme); assertFalse(e.istAusgabe)
        assertTrue(a.istAusgabe)
        assertTrue(aPositiv.istAusgabe) // Art zählt, auch wenn das Vorzeichen fehlt
        assertTrue(u.istUmbuchung); assertFalse(u.istEinnahme); assertFalse(u.istAusgabe)
    }

    @Test
    fun summenLassenUmbuchungenAus() {
        val bs = listOf(
            Buchung.from(buchungDoc("1", "2025-01-01", 100, "income", "a")),
            Buchung.from(buchungDoc("2", "2025-01-01", -30, "expense", "a")),
            Buchung.from(buchungDoc("3", "2025-01-01", 70, "transfer", "a", ziel = "b")),
        )
        val s = Finance.summen(bs)
        assertEquals(0, d("100").compareTo(s.einnahmen))
        assertEquals(0, d("30").compareTo(s.ausgaben))
        assertEquals(0, d("70").compareTo(s.saldo))
    }

    private val beispiel = listOf(
        Buchung.from(buchungDoc("1", "2025-03-01", -280, "expense", "a", nr = "BE-2025-010", text = "Spielbälle", partner = "Sportshop Franke", sphaere = "zweckbetrieb", kategorie = "Sportgeräte", beleg = true)),
        Buchung.from(buchungDoc("2", "2025-02-20", 1200, "income", "b", nr = "BE-2025-009", text = "Sponsoring", partner = "Autohaus", sphaere = "wirtschaftlich", notiz = "Bande")),
        Buchung.from(buchungDoc("3", "2024-12-31", 3450, "income", "a", nr = "BE-2024-100", text = "Mitgliedsbeitrag Q1", partner = "Mitglieder")),
        Buchung.from(buchungDoc("4", "2025-01-10", 20, "transfer", "a", ziel = "b", nr = "BE-2025-002", text = "Kassenauffüllung")),
    )

    @Test
    fun filterNachSucheKontoSphaereArtJahrBeleg() {
        fun ids(f: BuchungFilter) = Finance.filtern(beispiel, f).map { it.id }
        assertEquals(listOf("1", "2", "3", "4"), ids(BuchungFilter()))
        assertEquals(listOf("1"), ids(BuchungFilter(suche = "FRANKE")))
        assertEquals(listOf("2"), ids(BuchungFilter(suche = "bande"))) // Notiz wird durchsucht
        assertEquals(listOf("3"), ids(BuchungFilter(suche = "be-2024")))
        // Konto: auch als Zielkonto einer Umbuchung
        assertEquals(listOf("2", "4"), ids(BuchungFilter(kontoId = "b")))
        assertEquals(listOf("1"), ids(BuchungFilter(sphaere = "zweckbetrieb")))
        assertEquals(listOf("2", "3"), ids(BuchungFilter(art = "income")))
        assertEquals(listOf("1"), ids(BuchungFilter(art = "expense")))
        assertEquals(listOf("4"), ids(BuchungFilter(art = "transfer")))
        assertEquals(listOf("3"), ids(BuchungFilter(jahr = "2024")))
        assertEquals(listOf("1"), ids(BuchungFilter(mitBeleg = true)))
        assertEquals(listOf("2", "3", "4"), ids(BuchungFilter(mitBeleg = false)))
        assertEquals(listOf("2"), ids(BuchungFilter(kontoId = "b", art = "income", jahr = "2025")))
    }

    @Test
    fun jahreNeuestesZuerst() {
        assertEquals(listOf("2025", "2024"), Finance.jahre(beispiel))
    }

    @Test
    fun sortierenNachDatumBetragUndBelegnummer() {
        fun ids(n: BuchungSortierung, auf: Boolean) = Finance.sortieren(beispiel, n, auf).map { it.id }
        assertEquals(listOf("1", "2", "4", "3"), ids(BuchungSortierung.DATUM, false))
        assertEquals(listOf("3", "4", "2", "1"), ids(BuchungSortierung.DATUM, true))
        assertEquals(listOf("3", "2", "4", "1"), ids(BuchungSortierung.BETRAG, false))
        // Natürliche Reihenfolge der Belegnummern: 002 < 009 < 010 < (2024-)100? Text vor Zahl: "BE-2024-100" < "BE-2025-…"
        assertEquals(listOf("3", "4", "2", "1"), ids(BuchungSortierung.BELEGNUMMER, true))
    }

    @Test
    fun gleichstandBleibtInDerReihenfolgeDesSpeichers() {
        val gleich = listOf(
            Buchung.from(buchungDoc("x", "2025-01-01", 1, "income", "a")),
            Buchung.from(buchungDoc("y", "2025-01-01", 2, "income", "a")),
            Buchung.from(buchungDoc("z", "2025-01-01", 3, "income", "a")),
        )
        assertEquals(listOf("x", "y", "z"), Finance.sortieren(gleich, BuchungSortierung.DATUM, true).map { it.id })
        assertEquals(listOf("x", "y", "z"), Finance.sortieren(gleich, BuchungSortierung.DATUM, false).map { it.id })
    }

    @Test
    fun aufgeteilteBuchungUndBelegWerdenGelesen() {
        val doc = buildJsonObject {
            put("id", "s1"); put("date", "2025-04-01"); put("amount", -100); put("type", "expense"); put("accountId", "a")
            put("isSplit", true)
            put("splits", buildJsonArray {
                add(buildJsonObject { put("id", "t1"); put("amount", 60); put("sphere", "ideell"); put("vatRate", 0); put("category", "x") })
                add(buildJsonObject { put("id", "t2"); put("amount", 40.5); put("sphere", "zweckbetrieb"); put("vatRate", 7); put("skrAccount", "6500") })
            })
            put("receipt", buildJsonObject { put("name", "beleg.jpg"); put("type", "image/jpeg"); put("size", 345678); put("dataUrl", "data:...") })
        }
        val b = Buchung.from(doc)
        assertTrue(b.aufgeteilt)
        assertEquals(2, b.teile.size)
        assertEquals(0, d("40.5").compareTo(b.teile[1].betrag))
        assertEquals("6500", b.teile[1].skrKonto)
        assertEquals(7, b.teile[1].ust)
        assertEquals(BelegInfo("beleg.jpg", "image/jpeg", 345678L), b.beleg)
    }

    @Test
    fun buchungOhneBelegHatKeinenBeleg() {
        assertNull(Buchung.from(buchungDoc("1", "2025-01-01", 1, "income", "a")).beleg)
    }

    @Test
    fun ausDemSpeicherLesenUndKontenReihenfolge() {
        val store = InMemoryDocumentStore()
        store.put("accounts", "c", kontoDoc("c", "Kasse", 5))
        store.put("accounts", "a", kontoDoc("a", "Giro", 100, order = 1))
        store.put("accounts", "b", kontoDoc("b", "Spenden", 0, order = 0))
        store.put("transactions", "1", buchungDoc("1", "2025-01-01", 10, "income", "a"))
        // Mit Reihenfolge zuerst (0, 1), dann die ohne Angabe
        assertEquals(listOf("b", "a", "c"), Finance.konten(store).map { it.id })
        assertEquals(1, Finance.buchungen(store).size)
        val k = Finance.konten(store).first { it.id == "a" }
        assertEquals(0, d("100").compareTo(k.anfangsbestand))
        assertNotNull(k.artText)
    }

    @Test
    fun betragsformat() {
        assertEquals("1.234,50 €", Geld.euro(d("1234.5")))
        assertEquals("-280,00 €", Geld.euro(d("-280")))
        assertEquals("0,00 €", Geld.euro(BigDecimal.ZERO))
        assertEquals("+1.200,00 €", Geld.euroMitVorzeichen(d("1200")))
        assertEquals("-5,00 €", Geld.euroMitVorzeichen(d("-5")))
    }

    @Test
    fun titelAusPartnerUndText() {
        fun t(p: String, x: String) = Finance.titel(Buchung.from(buchungDoc("1", "2025-01-01", 1, "income", "a", partner = p, text = x)))
        assertEquals("Franke – Bälle", t("Franke", "Bälle"))
        assertEquals("Bälle", t("", "Bälle"))
        assertEquals("(ohne Text)", t("", ""))
    }
}
