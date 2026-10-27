package de.vereinsmanager.core.files

import org.junit.Assert.assertEquals
import org.junit.Test

class DateinamenTest {
    @Test
    fun verboteneZeichenWerdenZuMinus() {
        assertEquals("a-b-c-d-e-f-g-h-i", Dateinamen.bereinigen("a/b\\c:d*e?f\"g<h>i"))
        assertEquals("a-b", Dateinamen.bereinigen("a\tb"))
        assertEquals("Müller & Söhne.pdf", Dateinamen.bereinigen("Müller & Söhne.pdf"))
    }

    @Test
    fun zwischenraumUndPunkteAmRandEntfallen() {
        assertEquals("Rechnung.pdf", Dateinamen.bereinigen("  Rechnung.pdf. "))
        assertEquals("Datei", Dateinamen.bereinigen(""))
        assertEquals("Datei", Dateinamen.bereinigen("..."))
        assertEquals("Datei", Dateinamen.bereinigen("   "))
    }

    @Test
    fun windowsSondernamenBekommenUnterstrich() {
        assertEquals("_CON.pdf", Dateinamen.bereinigen("CON.pdf"))
        assertEquals("_con", Dateinamen.bereinigen("con"))
        assertEquals("_COM1.txt", Dateinamen.bereinigen("COM1.txt"))
        assertEquals("Console.pdf", Dateinamen.bereinigen("Console.pdf"))
        assertEquals("LPT10", Dateinamen.bereinigen("LPT10"))
    }

    @Test
    fun langeNamenWerdenGekuerztDieEndungBleibt() {
        assertEquals("a".repeat(16) + ".pdf", Dateinamen.bereinigen("a".repeat(150) + ".pdf", max = 20))
        assertEquals("b".repeat(100), Dateinamen.bereinigen("b".repeat(150)))
        // eine zu lange "Endung" ist keine
        assertEquals("Datei.verylongext", Dateinamen.bereinigen("Datei.verylongextension", max = 17))
    }

    @Test
    fun kuerzenZerreisstKeinSonderzeichen() {
        val name = "ab" + "😀" + "cd" // zwei Buchstaben, ein Emoji (zwei Zeichen), zwei Buchstaben
        assertEquals("ab", Dateinamen.bereinigen(name, max = 3))
    }

    @Test
    fun ordnerBehandelnPunkteNichtAlsEndung() {
        assertEquals("Satzung v1.2", Dateinamen.bereinigen("Satzung v1.2", mitEndung = false))
        assertEquals("Satzu", Dateinamen.bereinigen("Satzung v1.2", max = 5, mitEndung = false))
    }

    @Test
    fun gleicheNamenWerdenDurchgezaehlt() {
        assertEquals("a.pdf", Dateinamen.eindeutig("a.pdf", emptySet()))
        assertEquals("a (2).pdf", Dateinamen.eindeutig("a.pdf", setOf("A.PDF")))
        assertEquals("a (3).pdf", Dateinamen.eindeutig("a.pdf", setOf("a.pdf", "a (2).pdf")))
        assertEquals("Ordner (2)", Dateinamen.eindeutig("Ordner", setOf("ordner"), mitEndung = false))
        assertEquals("v1.2 (2)", Dateinamen.eindeutig("v1.2", setOf("v1.2"), mitEndung = false))
    }
}
