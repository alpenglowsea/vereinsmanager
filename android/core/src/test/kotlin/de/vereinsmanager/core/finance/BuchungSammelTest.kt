package de.vereinsmanager.core.finance

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BuchungSammelTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)

    private fun s(): InMemoryDocumentStore {
        val st = InMemoryDocumentStore()
        for (k in listOf("a1", "a2")) st.put("accounts", k, buildJsonObject { put("id", k); put("name", k) })
        st.put("transactions", "t1", buildJsonObject {
            put("id", "t1"); put("type", "expense"); put("accountId", "a1"); put("partner", "Alt"); put("date", "2026-01-01"); put("sphere", "ideell")
            put("notes", "erste"); put("department", "Fußball"); put("vatRate", 19); put("isSplit", false)
        })
        st.put("transactions", "t2", buildJsonObject {
            put("id", "t2"); put("type", "transfer"); put("accountId", "a1"); put("targetAccountId", "a2"); put("isSplit", false)
        })
        st.put("transactions", "t3", buildJsonObject {
            put("id", "t3"); put("type", "income"); put("accountId", "a1"); put("isSplit", true); put("sphere", "ideell")
        })
        return st
    }

    private fun f(st: InMemoryDocumentStore, id: String, k: String) = (st.get("transactions", id)!![k] as? JsonPrimitive)?.content

    @Test
    fun aendertNurGesetzteFelder() {
        val st = s()
        val r = BuchungSammelStore.anwenden(st, listOf("t1"), BuchungSammel(sphaere = "zweckbetrieb", partner = " Neu ", ust = 7), jetzt)
        assertEquals(1, r.geaendert)
        assertEquals("zweckbetrieb", f(st, "t1", "sphere")); assertEquals("Neu", f(st, "t1", "partner")); assertEquals("7", f(st, "t1", "vatRate"))
        assertEquals("a1", f(st, "t1", "accountId")); assertEquals("erste", f(st, "t1", "notes")); assertEquals("2026-01-01", f(st, "t1", "date"))
        assertTrue(f(st, "t1", "updatedAt")!!.startsWith("2026-11-09"))
    }

    @Test
    fun kategorieSetztAlleVierFelder() {
        val st = s()
        BuchungSammelStore.anwenden(st, listOf("t1"), BuchungSammel(kategorie = SammelKategorie("40000 - Mitgliedsbeiträge", "40000 - Echte", "40000", 0)), jetzt)
        assertEquals("40000 - Mitgliedsbeiträge", f(st, "t1", "mainCategory")); assertEquals("40000 - Echte", f(st, "t1", "subCategory"))
        assertEquals("40000 - Echte", f(st, "t1", "category")); assertEquals("40000", f(st, "t1", "skrAccount")); assertEquals("0", f(st, "t1", "vatRate"))
    }

    @Test
    fun umbuchungUndSplitBekommenKeineZuordnung() {
        val st = s()
        val r = BuchungSammelStore.anwenden(st, listOf("t1", "t2", "t3"), BuchungSammel(sphaere = "vermoegen"), jetzt)
        assertEquals(1, r.geaendert); assertEquals(2, r.ohneZuordnung)
        assertNull(f(st, "t2", "sphere")); assertEquals("ideell", f(st, "t3", "sphere"))
    }

    @Test
    fun kontoWechselOhneSelbstumbuchung() {
        val st = s()
        val r = BuchungSammelStore.anwenden(st, listOf("t1", "t2"), BuchungSammel(kontoId = "a2"), jetzt)
        assertEquals("a2", f(st, "t1", "accountId")); assertEquals("a1", f(st, "t2", "accountId"))
        assertEquals(1, r.kontoUebersprungen)
    }

    @Test
    fun sparteLeerenUndNotizen() {
        val st = s()
        BuchungSammelStore.anwenden(st, listOf("t1"), BuchungSammel(sparte = "", notizAnhaengen = " zweite "), jetzt)
        assertNull(f(st, "t1", "department")); assertEquals("erste\nzweite", f(st, "t1", "notes"))
        BuchungSammelStore.anwenden(st, listOf("t1"), BuchungSammel(notizErsetzen = ""), jetzt)
        assertEquals("", f(st, "t1", "notes"))
    }

    @Test
    fun unveraenderteWerdenNichtAngefasst() {
        val st = s()
        val r = BuchungSammelStore.anwenden(st, listOf("t1"), BuchungSammel(sphaere = "ideell"), jetzt)
        assertEquals(0, r.geaendert); assertEquals(1, r.ohneAenderung); assertNull(f(st, "t1", "updatedAt"))
    }

    @Test
    fun fehlerFallenVorDemSchreibenAuf() {
        val st = s()
        for (e in listOf(BuchungSammel(), BuchungSammel(datum = "gestern"), BuchungSammel(kontoId = "gibt-es-nicht"))) {
            try { BuchungSammelStore.anwenden(st, listOf("t1"), e, jetzt); fail() } catch (x: IllegalArgumentException) { }
        }
        assertEquals("Alt", f(st, "t1", "partner"))
    }

    @Test
    fun unbekannteIdsWerdenUebergangen() {
        val st = s()
        assertEquals(1, BuchungSammelStore.anwenden(st, listOf("gibt-es-nicht", "t1"), BuchungSammel(datum = "2026-02-02"), jetzt).geaendert)
        assertFalse(st.get("transactions", "gibt-es-nicht") != null)
    }
}
