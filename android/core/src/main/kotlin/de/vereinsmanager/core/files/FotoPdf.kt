package de.vereinsmanager.core.files

import java.io.ByteArrayOutputStream
import java.util.Locale

/** Eine Seite für die PDF: ein fertig verkleinertes JPEG samt Pixelmaßen. */
class FotoSeite(val jpeg: ByteArray, val breite: Int, val hoehe: Int)

/**
 * Baut aus JPEG-Bildern eine PDF-Datei, ohne die Bilder neu zu kodieren: das JPEG wird unverändert in die PDF
 * übernommen (Filter DCTDecode). Je Bild eine Seite; die Seite hat das Seitenverhältnis des Bildes und passt in
 * ein A4-Blatt (595 × 842 Punkt), ein schmaler Kassenbon bleibt also schmal.
 *
 * Das Verkleinern des Fotos (Pixelzahl, JPEG-Qualität) macht die App mit den Mitteln von Android; hier geht es nur
 * um die Datei.
 */
object FotoPdf {
    private const val A4_BREITE = 595.0
    private const val A4_HOEHE = 842.0

    /** Liest Breite und Höhe aus dem Kopf eines JPEG. Null, wenn es keines ist oder nicht 8-Bit/Farbe/Graustufen. */
    fun jpegMasse(b: ByteArray): Pair<Int, Int>? {
        if (b.size < 4 || b[0] != 0xFF.toByte() || b[1] != 0xD8.toByte()) return null
        var i = 2
        while (i + 4 <= b.size) {
            if (b[i] != 0xFF.toByte()) { i++; continue }
            val m = b[i + 1].toInt() and 0xFF
            if (m == 0xFF) { i++; continue } // Füllbytes
            if (m == 0xD8 || m == 0x01 || m in 0xD0..0xD7) { i += 2; continue } // Marken ohne Länge
            if (m == 0xD9 || m == 0xDA) return null // Ende bzw. Bilddaten, ohne eine Kopfmarke gefunden zu haben
            val len = ((b[i + 2].toInt() and 0xFF) shl 8) or (b[i + 3].toInt() and 0xFF)
            if (len < 2) return null
            val sof = m in 0xC0..0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC
            if (sof) {
                if (i + 10 > b.size) return null
                val bits = b[i + 4].toInt() and 0xFF
                val hoehe = ((b[i + 5].toInt() and 0xFF) shl 8) or (b[i + 6].toInt() and 0xFF)
                val breite = ((b[i + 7].toInt() and 0xFF) shl 8) or (b[i + 8].toInt() and 0xFF)
                val komponenten = b[i + 9].toInt() and 0xFF
                if (bits != 8 || (komponenten != 1 && komponenten != 3) || breite <= 0 || hoehe <= 0) return null
                return breite to hoehe
            }
            i += 2 + len
        }
        return null
    }

    private fun farbraum(jpeg: ByteArray): String {
        // Anzahl der Komponenten steht in derselben Kopfmarke; jpegMasse hat sie schon als 1 oder 3 geprüft.
        var i = 2
        while (i + 10 <= jpeg.size) {
            if (jpeg[i] != 0xFF.toByte()) { i++; continue }
            val m = jpeg[i + 1].toInt() and 0xFF
            if (m == 0xFF) { i++; continue }
            if (m == 0xD8 || m == 0x01 || m in 0xD0..0xD7) { i += 2; continue }
            val len = ((jpeg[i + 2].toInt() and 0xFF) shl 8) or (jpeg[i + 3].toInt() and 0xFF)
            if (m in 0xC0..0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC) {
                return if ((jpeg[i + 9].toInt() and 0xFF) == 1) "/DeviceGray" else "/DeviceRGB"
            }
            i += 2 + len
        }
        return "/DeviceRGB"
    }

    private fun zahl(d: Double): String = String.format(Locale.ROOT, "%.2f", d)

    /** Baut aus den Seiten eine PDF. Wirft [IllegalArgumentException], wenn keine Seite da ist oder ein Bild kein brauchbares JPEG ist. */
    fun erzeugen(seiten: List<FotoSeite>): ByteArray {
        require(seiten.isNotEmpty()) { "Keine Seiten." }
        for ((n, s) in seiten.withIndex()) {
            val m = jpegMasse(s.jpeg) ?: throw IllegalArgumentException("Seite ${n + 1} ist kein brauchbares JPEG.")
            require(m.first == s.breite && m.second == s.hoehe) { "Seite ${n + 1}: Maße passen nicht zum Bild." }
        }
        val out = ByteArrayOutputStream()
        val offsets = ArrayList<Int>()
        fun schreibe(t: String) = out.write(t.toByteArray(Charsets.ISO_8859_1))
        fun objekt(nr: Int, block: () -> Unit) {
            while (offsets.size < nr) offsets.add(0)
            offsets[nr - 1] = out.size()
            schreibe("$nr 0 obj\n")
            block()
            schreibe("endobj\n")
        }

        schreibe("%PDF-1.4\n")
        out.write(byteArrayOf('%'.code.toByte(), 0xE2.toByte(), 0xE3.toByte(), 0xCF.toByte(), 0xD3.toByte(), '\n'.code.toByte()))

        // Objektnummern: 1 Katalog, 2 Seitenbaum, dann je Seite drei (Seite, Inhalt, Bild).
        objekt(1) { schreibe("<< /Type /Catalog /Pages 2 0 R >>\n") }
        val kinder = seiten.indices.joinToString(" ") { "${3 + it * 3} 0 R" }
        objekt(2) { schreibe("<< /Type /Pages /Kids [$kinder] /Count ${seiten.size} >>\n") }
        for ((n, s) in seiten.withIndex()) {
            val seite = 3 + n * 3
            val faktor = minOf(A4_BREITE / s.breite, A4_HOEHE / s.hoehe)
            val w = s.breite * faktor
            val h = s.hoehe * faktor
            val inhalt = "q ${zahl(w)} 0 0 ${zahl(h)} 0 0 cm /Im0 Do Q\n".toByteArray(Charsets.ISO_8859_1)
            objekt(seite) {
                schreibe(
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${zahl(w)} ${zahl(h)}] " +
                        "/Resources << /XObject << /Im0 ${seite + 2} 0 R >> >> /Contents ${seite + 1} 0 R >>\n",
                )
            }
            objekt(seite + 1) {
                schreibe("<< /Length ${inhalt.size} >>\nstream\n")
                out.write(inhalt)
                schreibe("endstream\n")
            }
            objekt(seite + 2) {
                schreibe(
                    "<< /Type /XObject /Subtype /Image /Width ${s.breite} /Height ${s.hoehe} " +
                        "/ColorSpace ${farbraum(s.jpeg)} /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.jpeg.size} >>\nstream\n",
                )
                out.write(s.jpeg)
                schreibe("\nendstream\n")
            }
        }
        val xref = out.size()
        schreibe("xref\n0 ${offsets.size + 1}\n")
        schreibe("0000000000 65535 f \n")
        for (o in offsets) schreibe(String.format(Locale.ROOT, "%010d 00000 n \n", o))
        schreibe("trailer\n<< /Size ${offsets.size + 1} /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n")
        return out.toByteArray()
    }
}
