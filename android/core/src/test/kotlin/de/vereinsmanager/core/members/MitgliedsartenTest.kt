package de.vereinsmanager.core.members

import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Gleiche Fälle wie Desktop `mitgliedsarten.test.ts`. */
class MitgliedsartenTest {
    private fun settings(json: String) = Json.parseToJsonElement(json).jsonObject

    @Test
    fun standardArtenUndIhreRegeln() {
        val a = Mitgliedsarten.lesen(null as JsonObject?)
        assertEquals(listOf("full", "reduced", "youth", "family", "supporting", "honorary"), a.map { it.id })
        assertEquals("full", Mitgliedsarten.standard(a))
        assertTrue(Mitgliedsarten.beitragsfrei(a, "honorary"))
        assertFalse(Mitgliedsarten.beitragsfrei(a, "full"))
        assertEquals("youth", Mitgliedsarten.unter18Art(a))
        assertEquals(listOf("full", "reduced", "youth", "family", "supporting"), Mitgliedsarten.antragsArten(a).map { it.id })
    }

    @Test
    fun eigeneListeLesenUndSchreiben() {
        val a = Mitgliedsarten.lesen(settings("""{"membershipTypes":[
            {"id":"erw","name":"  Erwachsene ","imAntrag":true},{"id":"erw","name":"doppelt"},{"id":"ausgetreten","name":"nein"},
            {"id":"","name":"x"},{"id":"kids","name":"","unter18":true,"beitragsfrei":"ja"},"quatsch"]}"""))
        assertEquals(listOf(MitgliedsArt("erw", "Erwachsene", imAntrag = true), MitgliedsArt("kids", "kids", unter18 = true)), a)
        assertEquals(6, Mitgliedsarten.lesen(settings("""{"membershipTypes":[{"id":"x","name":"X","geloescht":true}]}""")).size)
        // Rundlauf über JSON (so liest es auch der Desktop)
        val zurueck = Mitgliedsarten.lesen(JsonObject(mapOf(Mitgliedsarten.SCHLUESSEL to Mitgliedsarten.json(Mitgliedsarten.loeschen(Mitgliedsarten.STANDARD, "family")))))
        assertEquals(Mitgliedsarten.loeschen(Mitgliedsarten.STANDARD, "family"), zurueck)
        assertEquals("""{"id":"honorary","name":"Ehrenmitglied","beitragsfrei":true}""", Mitgliedsarten.json(Mitgliedsarten.STANDARD).last().toString())
    }

    @Test
    fun namenGeloeschtUnbekanntAustritt() {
        val a = Mitgliedsarten.loeschen(Mitgliedsarten.STANDARD, "family")
        assertEquals("Familie (gelöscht)", Mitgliedsarten.name(a, "family"))
        assertEquals("unbekannt", Mitgliedsarten.name(a, "unbekannt"))
        assertEquals("Ausgetreten", Mitgliedsarten.name(a, "ausgetreten"))
        assertEquals("–", Mitgliedsarten.name(a, null))
        assertEquals("Familie", Mitgliedsarten.name(Mitgliedsarten.wiederherstellen(a, "family"), "family"))
        assertNull(Mitgliedsarten.unter18Art(Mitgliedsarten.loeschen(a, "youth")))
        assertEquals("reduced", Mitgliedsarten.standard(Mitgliedsarten.loeschen(a, "full")))
    }

    @Test
    fun pruefung() {
        val a = Mitgliedsarten.STANDARD
        assertTrue(Mitgliedsarten.pruefen(a).isEmpty())
        val b = a.map { when (it.id) { "reduced" -> it.copy(name = "vollmitglied "); "family" -> it.copy(name = " "); else -> it } }
        assertEquals(mapOf("name.reduced" to "Diesen Namen gibt es schon.", "name.family" to "Bitte einen Namen eingeben."), Mitgliedsarten.pruefen(b))
        assertTrue(Mitgliedsarten.pruefen(a.map { it.copy(unter18 = true) })["liste"]!!.startsWith("Nur eine Art"))
        assertTrue(Mitgliedsarten.pruefen(a.map { it.copy(geloescht = true) })["liste"]!!.startsWith("Mindestens eine"))
        assertTrue(Mitgliedsarten.pruefen(Mitgliedsarten.loeschen(a, "family") + MitgliedsArt("n", "Familie")).isEmpty())
    }

    @Test
    fun neueArtReihenfolgeImport() {
        val a = Mitgliedsarten.STANDARD
        val n = Mitgliedsarten.neu(a, " Senioren ", 1000)
        assertEquals(MitgliedsArt("art-rs", "Senioren", imAntrag = true), n)
        assertEquals("art-rs-2", Mitgliedsarten.neu(a + n, "x", 1000).id)
        assertEquals(listOf("reduced", "full"), Mitgliedsarten.verschieben(a, "reduced", -1).take(2).map { it.id })
        assertEquals(a, Mitgliedsarten.verschieben(a, "full", -1))
        val ms = listOf("""{"id":"1","membershipType":"youth","status":"active"}""", """{"id":"2","membershipType":"youth","status":"terminated"}""", """{"id":"3","membershipType":"full"}""")
            .map { Member.from(settings(it)) }
        assertEquals(2, Mitgliedsarten.anzahl(ms, "youth"))
        val mit = a + MitgliedsArt("art-sen", "Senioren 65+")
        assertEquals("art-sen", Mitgliedsarten.ausText(mit, "senioren 65+", null))
        assertEquals("youth", Mitgliedsarten.ausText(mit, "Jugendlicher", null))
        assertEquals("honorary", Mitgliedsarten.ausText(mit, "Ehrenmitglied", null))
        assertEquals("youth", Mitgliedsarten.ausText(mit, "irgendwas", 12))
        assertEquals("full", Mitgliedsarten.ausText(mit, "", 40))
        assertEquals("full", Mitgliedsarten.ausText(Mitgliedsarten.loeschen(mit, "youth"), "Jugend", 12))
    }

    @Test
    fun ehrenStatusWirdZurArtUndDerBeitragBleibt() {
        val s = InMemoryDocumentStore()
        s.put(MemberStore.AREA, "m1", settings("""{"id":"m1","status":"honorary","membershipType":"full","feeAmount":20,"fremd":"bleibt"}"""))
        s.put(MemberStore.AREA, "m2", settings("""{"id":"m2","status":"active","membershipType":"honorary","feeAmount":0}"""))
        s.put(MemberStore.AREA, "m3", settings("""{"id":"m3","status":"honorary","membershipType":"ausgetreten"}"""))
        assertEquals(2, Mitgliedsarten.ehrenStatusUmstellen(s))
        val m1 = s.get(MemberStore.AREA, "m1")!!
        assertEquals(listOf("active", "honorary", "20", "bleibt"), listOf("status", "membershipType", "feeAmount", "fremd").map { (m1[it] as JsonPrimitive).content })
        assertEquals("ausgetreten", (s.get(MemberStore.AREA, "m3")!!["membershipType"] as JsonPrimitive).content)
        assertEquals(0, Mitgliedsarten.ehrenStatusUmstellen(s))
        assertEquals(Vereinsdaten.ID, "main")
    }

    @Test
    fun antragEinstellungenMitEigenenArtenSpeichernUndLesen() {
        val s = InMemoryDocumentStore()
        val std = de.vereinsmanager.core.antrag.AntragEinstellungenStore.lesen(s)
        val arten = Mitgliedsarten.loeschen(Mitgliedsarten.STANDARD, "family") + MitgliedsArt("art-sen", "Senioren", imAntrag = true) +
            MitgliedsArt("art-ehv", "Ehrenvorsitz", beitragsfrei = true, imAntrag = true)
        val e = std.copy(arten = arten, beitraege = std.beitraege - "family" + ("art-sen" to de.vereinsmanager.core.antrag.BeitragsVorgabe("9,5", "yearly")))
        de.vereinsmanager.core.antrag.AntragEinstellungenStore.speichern(s, e)
        val zurueck = de.vereinsmanager.core.antrag.AntragEinstellungenStore.lesen(s)
        assertEquals(arten, zurueck.arten)
        // Vorgaben nur für nicht gelöschte, nicht beitragsfreie Arten
        assertEquals(listOf("full", "reduced", "youth", "supporting", "art-sen"), zurueck.beitraege.keys.toList())
        assertEquals("9.50" to "yearly", zurueck.beitrag("art-sen").let { it.betrag to it.periode })
        // Beitragsfreie Art im Antrag: „beitragsfrei“, Mitglied wird beitragsfrei angelegt
        assertEquals("beitragsfrei", de.vereinsmanager.core.antrag.AntragLayout.beitragText(zurueck.beitrag("art-ehv")))
        assertEquals(listOf("full", "reduced", "youth", "supporting", "art-sen", "art-ehv"), zurueck.artenAuswahl.keys.toList())
        assertEquals("Familie (gelöscht)", zurueck.artName("family"))
        // Ungültige Liste wird nicht gespeichert
        val kaputt = e.copy(arten = arten.map { it.copy(name = "gleich") })
        assertTrue(runCatching { de.vereinsmanager.core.antrag.AntragEinstellungenStore.speichern(s, kaputt) }.isFailure)
    }
}

