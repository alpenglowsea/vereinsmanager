package de.vereinsmanager.core.files

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FotoPdfTest {
    private fun text(b: ByteArray) = String(b, Charsets.ISO_8859_1)

    private fun enthaelt(heu: ByteArray, nadel: ByteArray): Boolean {
        outer@ for (i in 0..heu.size - nadel.size) {
            for (j in nadel.indices) if (heu[i + j] != nadel[j]) continue@outer
            return true
        }
        return false
    }

    @Test
    fun masseWerdenAusDemJpegKopfGelesen() {
        assertEquals(24 to 32, FotoPdf.jpegMasse(TestJpegs.farbe))
        assertEquals(16 to 16, FotoPdf.jpegMasse(TestJpegs.grau))
        assertNull(FotoPdf.jpegMasse("kein Bild".toByteArray()))
        assertNull(FotoPdf.jpegMasse(TestJpegs.farbe.copyOf(12)))
        assertNull(FotoPdf.jpegMasse(ByteArray(0)))
    }

    @Test
    fun pdfHatEinenStimmigenAufbau() {
        val pdf = text(FotoPdf.erzeugen(listOf(FotoSeite(TestJpegs.farbe, 24, 32), FotoSeite(TestJpegs.grau, 16, 16))))
        assertTrue(pdf.startsWith("%PDF-1.4\n"))
        assertTrue(pdf.endsWith("%%EOF\n"))
        assertTrue(pdf.contains("/Count 2"))
        // zwei Seiten = 2 + 2 * 3 Objekte
        val start = Regex("startxref\n(\\d+)\n").find(pdf)!!.groupValues[1].toInt()
        assertTrue(pdf.substring(start).startsWith("xref\n0 9\n"))
        val eintraege = Regex("(\\d{10}) 00000 n ").findAll(pdf.substring(start)).map { it.groupValues[1].toInt() }.toList()
        assertEquals(8, eintraege.size)
        for ((i, o) in eintraege.withIndex()) assertTrue("Objekt ${i + 1} beginnt nicht bei $o", pdf.substring(o).startsWith("${i + 1} 0 obj\n"))
    }

    @Test
    fun dasJpegWirdUnveraendertUebernommenUndFarbraumPasst() {
        val pdf = FotoPdf.erzeugen(listOf(FotoSeite(TestJpegs.farbe, 24, 32), FotoSeite(TestJpegs.grau, 16, 16)))
        assertTrue(enthaelt(pdf, TestJpegs.farbe))
        assertTrue(enthaelt(pdf, TestJpegs.grau))
        val t = text(pdf)
        assertTrue(t.contains("/ColorSpace /DeviceRGB"))
        assertTrue(t.contains("/ColorSpace /DeviceGray"))
        assertTrue(t.contains("/Filter /DCTDecode"))
    }

    @Test
    fun seiteHatDasSeitenverhaeltnisDesBildesUndPasstInA4() {
        val t = text(FotoPdf.erzeugen(listOf(FotoSeite(TestJpegs.farbe, 24, 32))))
        assertTrue(t, t.contains("/MediaBox [0 0 595.00 793.33]"))
        val q = text(FotoPdf.erzeugen(listOf(FotoSeite(TestJpegs.grau, 16, 16))))
        assertTrue(q, q.contains("/MediaBox [0 0 595.00 595.00]"))
    }

    @Test
    fun ungueltigeEingabenWerdenAbgelehnt() {
        try { FotoPdf.erzeugen(emptyList()); fail() } catch (e: IllegalArgumentException) { assertNotNull(e.message) }
        try { FotoPdf.erzeugen(listOf(FotoSeite("x".toByteArray(), 1, 1))); fail() } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("JPEG")) }
        try { FotoPdf.erzeugen(listOf(FotoSeite(TestJpegs.farbe, 99, 99))); fail() } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Maße")) }
    }
}
