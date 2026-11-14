package de.vereinsmanager.core.settings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class LeisteTest {
    private val erlaubt = setOf("START", "MITGLIEDER", "BUCHUNGEN", "KALENDER", "INVENTAR", "SPENDEN", "KONTAKTE")

    @Test
    fun leerOderNullGibtVoreinstellung() {
        assertEquals(Leiste.STANDARD, Leiste.lesen(null, erlaubt))
        assertEquals(Leiste.STANDARD, Leiste.lesen("", erlaubt))
        assertEquals(Leiste.STANDARD, Leiste.lesen("  ,  ", erlaubt))
    }

    @Test
    fun gueltigeWahlWirdGelesenUndKodiertRundherum() {
        val wahl = listOf("INVENTAR", "START", "SPENDEN", "KALENDER")
        assertEquals(wahl, Leiste.lesen(Leiste.kodieren(wahl), erlaubt))
        assertEquals("INVENTAR,START,SPENDEN,KALENDER", Leiste.kodieren(wahl))
        assertEquals(wahl, Leiste.lesen(" INVENTAR , START,SPENDEN ,KALENDER ", erlaubt))
    }

    @Test
    fun kaputteWahlFaelltAufVoreinstellung() {
        assertEquals(Leiste.STANDARD, Leiste.lesen("START,MITGLIEDER,BUCHUNGEN", erlaubt))            // zu wenige
        assertEquals(Leiste.STANDARD, Leiste.lesen("START,MITGLIEDER,BUCHUNGEN,KALENDER,SPENDEN", erlaubt)) // zu viele
        assertEquals(Leiste.STANDARD, Leiste.lesen("START,START,BUCHUNGEN,KALENDER", erlaubt))        // doppelt
        assertEquals(Leiste.STANDARD, Leiste.lesen("START,MITGLIEDER,BUCHUNGEN,GIBTESNICHT", erlaubt)) // unbekannt
    }

    @Test
    fun gueltigPrueftAnzahlEindeutigkeitUndNamen() {
        assertTrue(Leiste.gueltig(Leiste.STANDARD, erlaubt))
        assertFalse(Leiste.gueltig(listOf("START", "START", "BUCHUNGEN", "KALENDER"), erlaubt))
        assertFalse(Leiste.gueltig(listOf("START", "MITGLIEDER", "BUCHUNGEN"), erlaubt))
        assertFalse(Leiste.gueltig(listOf("START", "MITGLIEDER", "BUCHUNGEN", "X"), erlaubt))
    }

    @Test
    fun setzenErsetztEinenPlatz() {
        assertEquals(listOf("START", "INVENTAR", "BUCHUNGEN", "KALENDER"), Leiste.setzen(Leiste.STANDARD, 1, "INVENTAR"))
    }

    @Test
    fun setzenAufBereitsVergebenesZielTauscht() {
        // KALENDER steht auf Platz 3; wird es auf Platz 0 gelegt, rückt START nach Platz 3.
        assertEquals(listOf("KALENDER", "MITGLIEDER", "BUCHUNGEN", "START"), Leiste.setzen(Leiste.STANDARD, 0, "KALENDER"))
        assertTrue(Leiste.gueltig(Leiste.setzen(Leiste.STANDARD, 0, "KALENDER"), erlaubt))
    }

    @Test
    fun setzenAufDenselbenPlatzAendertNichts() {
        assertEquals(Leiste.STANDARD, Leiste.setzen(Leiste.STANDARD, 2, "BUCHUNGEN"))
    }

    @Test
    fun setzenLehntFalschePlaetzeAb() {
        try { Leiste.setzen(Leiste.STANDARD, 4, "INVENTAR"); fail("Platz 4 gibt es nicht") } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Platz 4")) }
        try { Leiste.setzen(Leiste.STANDARD, -1, "INVENTAR"); fail("Platz -1 gibt es nicht") } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Platz -1")) }
    }

    @Test
    fun jedeFolgeVonWahlenBleibtGueltig() {
        var l = Leiste.STANDARD
        val ziele = erlaubt.toList()
        for (i in 0 until 60) l = Leiste.setzen(l, i % 4, ziele[(i * 3) % ziele.size])
        assertTrue(Leiste.gueltig(l, erlaubt))
    }
}
