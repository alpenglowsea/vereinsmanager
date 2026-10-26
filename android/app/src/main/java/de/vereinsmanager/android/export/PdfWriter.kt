package de.vereinsmanager.android.export

import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import de.vereinsmanager.core.export.PdfTabelle
import java.io.OutputStream

/**
 * Zeichnet eine [PdfTabelle] auf A4 quer (842 x 595 Punkte) mit Android-PdfDocument:
 * Kopf mit Vereinsname, Titel und Stand, Tabelle mit Zeilenumbruch in den Zellen, Fußzeile mit Seitenzahl.
 * Der Seitenaufbau folgt der Desktop-Fassung; Schrift und Abstände sind angenähert, nicht pixelgleich.
 */
object PdfWriter {
    private const val W = 842
    private const val H = 595
    private const val MM = 72f / 25.4f
    private const val LINKS = 14 * MM
    private const val KOPF_UNTEN = 25 * MM
    private const val TABELLE_START = 28 * MM
    private const val FUSS_Y = H - 8 * MM
    private const val SEITE_UNTEN = H - 16 * MM
    private const val POLSTER = 2 * MM

    private fun paint(size: Float, color: Int, bold: Boolean = false) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size; this.color = color; typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    /** Bricht [text] auf Zeilen der Breite [breite] um; zu lange Wörter werden hart getrennt. */
    private fun umbrechen(text: String, p: Paint, breite: Float): List<String> {
        val zeilen = ArrayList<String>()
        for (absatz in text.split("\n")) {
            var aktuell = ""
            for (wort in absatz.split(" ")) {
                var w = wort
                while (p.measureText(w) > breite && w.length > 1) {
                    if (aktuell.isNotEmpty()) { zeilen.add(aktuell); aktuell = "" }
                    var n = w.length
                    while (n > 1 && p.measureText(w, 0, n) > breite) n--
                    zeilen.add(w.substring(0, n)); w = w.substring(n)
                }
                val probe = if (aktuell.isEmpty()) w else "$aktuell $w"
                if (p.measureText(probe) <= breite || aktuell.isEmpty()) aktuell = probe else { zeilen.add(aktuell); aktuell = w }
            }
            zeilen.add(aktuell)
        }
        return zeilen
    }

    fun schreiben(t: PdfTabelle, out: OutputStream) {
        val doc = PdfDocument()
        val kopfFarbe = Color.rgb(30, 41, 59)
        val textP = paint(8f * 1.0f, Color.rgb(40, 40, 40))
        val kopfP = paint(8f, Color.WHITE, bold = true)
        val rand = Paint().apply { color = Color.rgb(200, 205, 212); strokeWidth = 0.5f; style = Paint.Style.STROKE }
        val fill = Paint().apply { style = Paint.Style.FILL }
        val breiten = t.breiten.map { it * MM }
        val zeilenHoehe = 8f * 1.25f
        var seite = 0
        var page: PdfDocument.Page? = null
        var y = 0f

        fun neueSeite() {
            page?.let { pg ->
                val c = pg.canvas
                c.drawText("Seite $seite | ${t.fusszeile}", LINKS, FUSS_Y, paint(8f, Color.rgb(140, 140, 140)))
                doc.finishPage(pg)
            }
            seite += 1
            val pg = doc.startPage(PdfDocument.PageInfo.Builder(W, H, seite).create())
            page = pg
            val c = pg.canvas
            if (seite == 1) {
                c.drawText(t.verein, LINKS, 15 * MM, paint(18f, Color.rgb(20, 30, 50)))
                c.drawText(t.titel, LINKS, 22 * MM, paint(12f, Color.rgb(100, 110, 120)))
                val rp = paint(9f, Color.rgb(100, 110, 120))
                c.drawText(t.kopfRechts, 283 * MM - rp.measureText(t.kopfRechts), 22 * MM, rp)
                c.drawLine(LINKS, KOPF_UNTEN, 283 * MM, KOPF_UNTEN, Paint().apply { color = Color.rgb(220, 225, 230); strokeWidth = 1.4f })
                y = TABELLE_START
            } else {
                y = 15 * MM
            }
            // Tabellenkopf auf jeder Seite
            val kopfHoehe = zeilenHoehe + 2 * POLSTER
            fill.color = kopfFarbe
            c.drawRect(LINKS, y, LINKS + breiten.sum(), y + kopfHoehe, fill)
            var x = LINKS
            t.spalten.forEachIndexed { i, s ->
                c.drawText(s, x + POLSTER, y + POLSTER + zeilenHoehe - 3f, kopfP)
                x += breiten[i]
            }
            y += kopfHoehe
        }

        neueSeite()
        t.zeilen.forEachIndexed { zi, zeile ->
            val umbruch = zeile.mapIndexed { i, s -> umbrechen(s, textP, breiten[i] - 2 * POLSTER) }
            val hoehe = (umbruch.maxOf { it.size }) * zeilenHoehe + 2 * POLSTER
            if (y + hoehe > SEITE_UNTEN) neueSeite()
            val c = page!!.canvas
            if (zi % 2 == 1) { fill.color = Color.rgb(248, 250, 252); c.drawRect(LINKS, y, LINKS + breiten.sum(), y + hoehe, fill) }
            var x = LINKS
            umbruch.forEachIndexed { i, zl ->
                c.drawRect(x, y, x + breiten[i], y + hoehe, rand)
                zl.forEachIndexed { k, s ->
                    val tx = when (t.ausrichtung.getOrElse(i) { 'l' }) {
                        'r' -> x + breiten[i] - POLSTER - textP.measureText(s)
                        'c' -> x + (breiten[i] - textP.measureText(s)) / 2
                        else -> x + POLSTER
                    }
                    c.drawText(s, tx, y + POLSTER + (k + 1) * zeilenHoehe - 3f, textP)
                }
                x += breiten[i]
            }
            y += hoehe
        }
        // letzte Seite abschließen
        page?.let { pg ->
            pg.canvas.drawText("Seite $seite | ${t.fusszeile}", LINKS, FUSS_Y, paint(8f, Color.rgb(140, 140, 140)))
            doc.finishPage(pg)
        }
        doc.writeTo(out)
        doc.close()
    }
}
