package de.vereinsmanager.core.finance

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class KontoStoreTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)
    private val iban = "DE89 3704 0044 0532 0130 00"

    private fun store(vararg ids: String) = InMemoryDocumentStore().also { s ->
        ids.forEach { s.put("accounts", it, buildJsonObject { put("id", it); put("name", "Konto $it"); put("accountType", "bank"); put("initialBalance", 0) }) }
    }

    private fun buchung(s: InMemoryDocumentStore, id: String, konto: String, ziel: String = "", art: String = "expense") =
        s.put("transactions", id, buildJsonObject {
            put("id", id); put("date", "2026-03-01"); put("amount", -5); put("type", art); put("accountId", konto)
            put("targetAccountId", ziel); put("documentNumber", "BE-$id")
        })

    @Test
    fun anlegenSchreibtDieFelderWieDerDesktop() {
        val s = store()
        val k = KontoStore.speichern(s, KontoForm("acc-1", " Sparkasse ", "bank", iban.lowercase(), "spkdmustxxx", "1.234,50", "blue", " Hauptkonto "), jetzt)
        assertEquals("Sparkasse", k.name)
        assertEquals("DE89370400440532013000", k.iban)
        assertEquals("SPKDMUSTXXX", k.bic)
        assertEquals(BigDecimal("1234.5"), k.anfangsbestand.stripTrailingZeros().let { BigDecimal(it.toPlainString()) })
        assertEquals("blue", k.farbe)
        assertNull(k.reihenfolge)
        assertEquals("Hauptkonto", k.beschreibung)
        assertTrue(s.get("accounts", "acc-1")!!.containsKey("createdAt"))
    }

    @Test
    fun anfangsbestandLeerNullUndMinus() {
        assertEquals(0, KontoStore.parseBestand("")!!.signum())
        assertEquals(BigDecimal("-120.50"), KontoStore.parseBestand("-120,5"))
        assertNull(KontoStore.parseBestand("abc"))
    }

    @Test
    fun pruefenMeldetFehler() {
        assertTrue(KontoStore.pruefen(KontoForm("a", name = " ")).containsKey("name"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", iban = "DE00 1234")).containsKey("iban"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", iban = "DE89 3704 0044 0532 0130 01")).containsKey("iban"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", bic = "xx")).containsKey("bic"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", anfangsbestand = "x")).containsKey("anfangsbestand"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", art = "tresor")).containsKey("art"))
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "Kasse", art = "cash", iban = "Quatsch")).isEmpty()) // IBAN zählt nur bei Bankkonten
        assertTrue(KontoStore.pruefen(KontoForm("a", name = "X", iban = iban)).isEmpty())
        try { KontoStore.speichern(store(), KontoForm("a"), jetzt); fail() } catch (e: KontoException) { }
    }

    @Test
    fun aendernBehaeltUnbekanntesOrderUndCreatedAt() {
        val s = store()
        s.put("accounts", "a", buildJsonObject {
            put("id", "a"); put("name", "Alt"); put("accountType", "bank"); put("initialBalance", 5); put("order", 3)
            put("createdAt", "2020-01-01T00:00:00.000Z"); put("desktopFeld", "bleibt")
        })
        val k = KontoStore.speichern(s, KontoForm.von(Konto.from(s.get("accounts", "a")!!)).copy(name = "Neu"), jetzt)
        assertEquals("Neu", k.name)
        assertEquals(3, k.reihenfolge)
        val d = s.get("accounts", "a")!!
        assertEquals("2020-01-01T00:00:00.000Z", (d["createdAt"] as JsonPrimitive).content)
        assertEquals("bleibt", (d["desktopFeld"] as JsonPrimitive).content)
    }

    @Test
    fun formVonUndZurueck() {
        val s = store()
        KontoStore.speichern(s, KontoForm("a", "X", "cash", "", "", "-12,5", "red", ""), jetzt)
        val f = KontoForm.von(Konto.from(s.get("accounts", "a")!!))
        assertEquals("-12,5", f.anfangsbestand)
        assertEquals("cash", f.art)
    }

    @Test
    fun letztesKontoBleibt() {
        val s = store("a")
        try { KontoStore.loeschen(s, "a"); fail() } catch (e: KontoException) { assertTrue(e.message!!.contains("mindestens")) }
        assertEquals(1, Finance.konten(s).size)
    }

    @Test
    fun loeschenOhneBuchungenGeht() {
        val s = store("a", "b")
        KontoStore.loeschen(s, "a")
        assertEquals(listOf("b"), Finance.konten(s).map { it.id })
    }

    @Test
    fun loeschenMitBuchungenBrauchtZiel() {
        val s = store("a", "b")
        buchung(s, "t1", "a")
        assertEquals(1, KontoStore.buchungenAm(s, "a"))
        for (ziel in listOf(null, "a", "gibtsnicht")) {
            try { KontoStore.loeschen(s, "a", ziel); fail() } catch (e: KontoException) { }
        }
        assertEquals(2, Finance.konten(s).size)
        KontoStore.loeschen(s, "a", "b", jetzt)
        assertEquals(listOf("b"), Finance.konten(s).map { it.id })
        assertEquals("b", Finance.buchungen(s).single().kontoId)
    }

    @Test
    fun loeschenUebertraegtAuchDasZielkonto() {
        val s = store("a", "b", "c")
        buchung(s, "t1", "b", "a", "transfer")
        KontoStore.loeschen(s, "a", "c", jetzt)
        val t = Finance.buchungen(s).single()
        assertEquals("b", t.kontoId)
        assertEquals("c", t.zielkontoId)
    }

    @Test
    fun umbuchungZwischenDenZweiKontenVerhindertDasLoeschen() {
        val s = store("a", "b")
        buchung(s, "t1", "a", "b", "transfer")
        try { KontoStore.loeschen(s, "a", "b", jetzt); fail() } catch (e: KontoException) { assertTrue(e.message!!.contains("Umbuchung")) }
        assertEquals(2, Finance.konten(s).size)
        assertEquals("a", Finance.buchungen(s).single().kontoId)
    }

    @Test
    fun reihenfolgeSchiebenUndOrdnen() {
        val s = store("a", "b", "c")
        assertFalse(KontoStore.schieben(s, "a", -1))
        assertTrue(KontoStore.schieben(s, "c", -1))
        assertEquals(listOf("a", "c", "b"), Finance.konten(s).map { it.id })
        assertTrue(KontoStore.schieben(s, "a", 1))
        assertEquals(listOf("c", "a", "b"), Finance.konten(s).map { it.id })
        KontoStore.ordnen(s, listOf("b"))
        assertEquals(listOf("b", "c", "a"), Finance.konten(s).map { it.id })
    }
}
