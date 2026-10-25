package de.vereinsmanager.core.skr42

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class Skr42Test {
    // Die Zahlen unten stammen aus einem Lauf des Desktop-Codes (taxSpheres.ts) vom 25.10.2026.
    @Test fun umfang() {
        assertEquals(27, Skr42.standard.size)
        assertEquals(143, Skr42.standard.sumOf { it.subCategories.size })
        assertEquals(11, Skr42.mains("income").size)
        assertEquals(16, Skr42.mains("expense").size)
    }

    @Test fun kontocodesSindEindeutig() {
        val codes = Skr42.standard.flatMap { m -> m.subCategories.map { it.code } }
        assertEquals(codes.size, codes.toSet().size)
    }

    @Test fun umlauteKommenKorrektAus() {
        assertEquals("Spenden, Schenkungen & Zuwendungen", Skr42.standard.first { it.code == "40400" }.name)
    }

    @Test fun hauptkontoSpendenExistiert() {
        assertTrue(Skr42.standard.any { it.code == Skr42.SPENDEN_HAUPTKONTO_CODE })
    }

    // findMainForSub: erwartete Ergebnisse aus dem Desktop-Lauf
    @Test fun kontoPerNummer() {
        assertEquals("HK-40000", Skr42.findMainForSub("40000")!!.id)
        assertEquals("HK-40400", Skr42.findMainForSub("40400")!!.id)
    }

    @Test fun kontoPerBeschriftung() {
        assertEquals("HK-40000", Skr42.findMainForSub("40000 - Echte Mitgliedsbeiträge (laufend)")!!.id)
    }

    @Test fun freieStichwoerterFindenNichts() {
        // Das ist der Grund, warum automatische Buchungen mit freiem Text in der EÜR bei "Allgemein" landen.
        for (s in listOf("Spenden / Schenkungen", "Mitgliedsbeiträge", "zinserträge", "Allgemeine Verwaltungskosten", "xyz", "")) {
            assertNull("'$s' dürfte nichts finden", Skr42.findMainForSub(s))
        }
    }

    @Test fun nummernkreisSuche() {
        assertEquals("HK-40400", Skr42.findMain("HK-40400")!!.id)
        assertEquals("HK-40400", Skr42.findMain("40400")!!.id)
        assertEquals("HK-40400", Skr42.findMain("40400 - Spenden, Schenkungen & Zuwendungen")!!.id)
        assertEquals("HK-40400", Skr42.findMain("40450")!!.id) // über das Konto 40450
        assertEquals("HK-40000", Skr42.findMain("40000")!!.id)
        assertNull(Skr42.findMain("nix"))
    }

    @Test fun eigeneKontenWerdenHinzugemischt() {
        val eigenes = Skr42Main("custom-90001", "90001", "Testkonto", "income", emptyList(), isCustom = true)
        val alle = Skr42.withCustom(listOf(eigenes))
        assertEquals(28, alle.size)
        assertEquals("custom-90001", Skr42.findMain("90001", alle)!!.id)
        assertEquals(27, Skr42.standard.size) // der mitgelieferte Stand bleibt unverändert
    }

    @Test fun kontenListeNachTyp() {
        val einnahmen = Skr42.subs("income")
        assertTrue(einnahmen.isNotEmpty())
        assertEquals(Skr42.standard.first { it.code == "40400" }.subCategories, Skr42.subs(mainId = "40400"))
    }
}
