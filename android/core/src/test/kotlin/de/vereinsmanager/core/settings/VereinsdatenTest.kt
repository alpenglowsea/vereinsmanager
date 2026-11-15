package de.vereinsmanager.core.settings

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class VereinsdatenTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)
    private val iban = "DE89370400440532013000"

    @Test
    fun speichernUndLesenBehaeltFremdeFelder() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", buildJsonObject {
            put("id", "main"); put("clubName", "Alt"); put("taxNumber", "12/345"); put("departments", kotlinx.serialization.json.JsonArray(listOf(JsonPrimitive("Fußball"))))
            put("address", buildJsonObject { put("street", "Weg"); put("houseNumber", "1"); put("zip", "12345"); put("city", "Ort"); put("country", "Österreich") })
        })
        val f = Vereinsdaten.lesen(s).copy(name = "  Neuer Verein ", kassenwart = "Eva", glaeubigerId = "de98 zzz09999999999", iban = "de89 3704 0044 0532 0130 00", bic = "spkdmustxxx")
        val gelesen = Vereinsdaten.speichern(s, f, jetzt)
        assertEquals("Neuer Verein", gelesen.name)
        assertEquals("DE98ZZZ09999999999", gelesen.glaeubigerId)
        assertEquals(iban, gelesen.iban)
        assertEquals("SPKDMUSTXXX", gelesen.bic)
        val d = s.get("settings", "main")!!
        assertEquals("12/345", (d["taxNumber"] as JsonPrimitive).content)
        assertTrue(d.containsKey("departments"))
        assertEquals("Österreich", ((d["address"] as JsonObject)["country"] as JsonPrimitive).content)
        assertEquals("Weg", gelesen.strasse)
    }

    @Test
    fun anschriftAlsTextBleibtTextWennUnveraendert() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", buildJsonObject { put("id", "main"); put("clubName", "V"); put("address", "Hauptstr. 5, 12345 Stadt") })
        val f = Vereinsdaten.lesen(s)
        assertEquals("Hauptstr. 5, 12345 Stadt", f.strasse)
        Vereinsdaten.speichern(s, f.copy(kassenwart = "X"), jetzt)
        assertTrue(s.get("settings", "main")!!["address"] is JsonPrimitive)
        Vereinsdaten.speichern(s, f.copy(ort = "Stadt"), jetzt)
        assertTrue(s.get("settings", "main")!!["address"] is JsonObject)
    }

    @Test
    fun neueEinstellungenWerdenAngelegt() {
        val s = InMemoryDocumentStore()
        Vereinsdaten.speichern(s, VereinsForm(name = "V", strasse = "A", ort = "B"), jetzt)
        val d = s.get("settings", "main")!!
        assertEquals("main", (d["id"] as JsonPrimitive).content)
        assertEquals("Deutschland", ((d["address"] as JsonObject)["country"] as JsonPrimitive).content)
    }

    @Test
    fun pruefen() {
        assertTrue(Vereinsdaten.pruefen(VereinsForm(name = " ")).containsKey("name"))
        assertTrue(Vereinsdaten.pruefen(VereinsForm(name = "V", iban = "DE00 1")).containsKey("iban"))
        assertTrue(Vereinsdaten.pruefen(VereinsForm(name = "V", bic = "x")).containsKey("bic"))
        assertTrue(Vereinsdaten.pruefen(VereinsForm(name = "V")).isEmpty())
        try { Vereinsdaten.speichern(InMemoryDocumentStore(), VereinsForm(), jetzt); fail() } catch (e: IllegalArgumentException) { }
    }

    @Test
    fun lastschriftBereit() {
        fun doc(vararg p: Pair<String, String>) = buildJsonObject { p.forEach { put(it.first, it.second) } }
        assertEquals("Die Gläubiger-ID fehlt.", Vereinsdaten.fehlt(doc("clubName" to "V")))
        assertEquals("Die IBAN des Vereinskontos fehlt.", Vereinsdaten.fehlt(doc("creditorId" to "DE98ZZZ09999999999")))
        assertTrue(Vereinsdaten.fehlt(doc("creditorId" to "X", "creditorIban" to "DE89370400440532013001"))!!.contains("ungültig"))
        assertEquals("creditorId", Vereinsdaten.fehltFeld(doc("clubName" to "V")))
        assertEquals("creditorIban", Vereinsdaten.fehltFeld(doc("creditorId" to "DE98ZZZ09999999999")))
        assertEquals("creditorIban", Vereinsdaten.fehltFeld(doc("creditorId" to "X", "creditorIban" to "DE89370400440532013001")))
        assertNull(Vereinsdaten.fehltFeld(doc("creditorId" to "X", "creditorIban" to "DE89 3704 0044 0532 0130 00")))
        assertNull(Vereinsdaten.glaeubiger(doc("creditorId" to "X")))
        val g = Vereinsdaten.glaeubiger(doc("creditorId" to "de98zzz09999999999", "creditorIban" to "DE89 3704 0044 0532 0130 00", "clubName" to "V", "treasurer" to "Eva"))
        assertNotNull(g)
        assertEquals("DE98ZZZ09999999999", g!!.id)
        assertEquals(iban, g.iban)
        assertEquals("Eva", g.kassenwart)
    }
}
