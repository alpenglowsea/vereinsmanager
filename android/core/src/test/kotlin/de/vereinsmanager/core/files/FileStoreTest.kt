package de.vereinsmanager.core.files

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.io.InputStream

class FileStoreTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun dir() = DirFileStore(File(tmp.root, "dateien"))

    private fun pruefeBeide(block: (FileStore) -> Unit) {
        block(InMemoryFileStore())
        block(dir())
    }

    @Test
    fun schreibenLesenGroesseUndLoeschen() = pruefeBeide { s ->
        assertEquals(5L, s.putBytes("a1", byteArrayOf(1, 2, 3, 4, 5)))
        assertArrayEquals(byteArrayOf(1, 2, 3, 4, 5), s.readBytes("a1"))
        assertEquals(5L, s.size("a1"))
        s.delete("a1")
        assertNull(s.open("a1"))
        assertNull(s.size("a1"))
        s.delete("a1") // doppeltes Löschen ist kein Fehler
    }

    @Test
    fun ueberschreibenErsetztDenInhalt() = pruefeBeide { s ->
        s.putBytes("x", byteArrayOf(1, 2, 3))
        s.putBytes("x", byteArrayOf(9))
        assertArrayEquals(byteArrayOf(9), s.readBytes("x"))
        assertEquals(listOf("x"), s.ids())
    }

    @Test
    fun grosseDateiKommtUnveraendertZurueck() = pruefeBeide { s ->
        val gross = ByteArray(3 * 1024 * 1024 + 17) { (it * 31).toByte() }
        assertEquals(gross.size.toLong(), s.putBytes("gross", gross))
        assertArrayEquals(gross, s.readBytes("gross"))
    }

    @Test
    fun kennungenWerdenGeprueft() = pruefeBeide { s ->
        for (schlecht in listOf("", "../x", "a/b", "a\\b", ".versteckt", "mit leer", "ä", "x".repeat(101))) {
            try {
                s.putBytes(schlecht, byteArrayOf(1))
                fail("Hätte abgelehnt werden müssen: \"$schlecht\"")
            } catch (e: IllegalArgumentException) {
                // erwartet
            }
        }
        s.putBytes("doc-2026_03.v1", byteArrayOf(1)) // gültig
        s.putBytes("x".repeat(100), byteArrayOf(1)) // genau 100 ist erlaubt
        assertEquals(2, s.ids().size)
    }

    @Test
    fun fehlerBeimSchreibenLaesstDasAlteStehenUndHinterlaesstNichts() {
        val s = dir()
        s.putBytes("beleg", byteArrayOf(1, 2, 3))
        val kaputt = object : InputStream() {
            var n = 0
            override fun read(): Int = if (n++ < 10) 7 else throw IOException("Abbruch")
        }
        try {
            s.put("beleg", kaputt)
            fail("Fehler erwartet")
        } catch (e: IOException) {
            // erwartet
        }
        assertArrayEquals(byteArrayOf(1, 2, 3), s.readBytes("beleg"))
        assertEquals(listOf("beleg"), s.ids())
        assertEquals(1, File(tmp.root, "dateien").listFiles()!!.size) // keine Zwischendatei übrig
    }

    @Test
    fun leerenOrdnerGibtEsOhneFehler() {
        val s = DirFileStore(File(tmp.root, "gibt-es-nicht"))
        assertTrue(s.ids().isEmpty())
        assertNull(s.open("a"))
        s.clear()
    }

    @Test
    fun clearLoeschtAlles() = pruefeBeide { s ->
        s.putBytes("a", byteArrayOf(1))
        s.putBytes("b", byteArrayOf(2))
        s.clear()
        assertTrue(s.ids().isEmpty())
        assertFalse(s.open("a") != null)
    }

    @Test
    fun kennungenKommenSortiertZurueckBeiDerOrdnerAblage() {
        val s = dir()
        s.putBytes("b", byteArrayOf(1)); s.putBytes("a", byteArrayOf(1)); s.putBytes("c", byteArrayOf(1))
        assertEquals(listOf("a", "b", "c"), s.ids())
    }
}
