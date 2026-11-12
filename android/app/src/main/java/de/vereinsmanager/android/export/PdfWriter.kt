package de.vereinsmanager.android.export

import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import de.vereinsmanager.core.donation.ClubTaxSettings
import de.vereinsmanager.core.donation.DonationReceipt
import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.donation.ZuwendungsVordruck
import de.vereinsmanager.core.export.PdfTabelle
import de.vereinsmanager.core.export.StammblattDaten
import de.vereinsmanager.core.sepa.SepaProtokoll
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
    internal fun umbrechen(text: String, p: Paint, breite: Float): List<String> {
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
        val fettP = paint(8f, Color.rgb(15, 23, 42), bold = true)
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
            val zp = if (zi in t.fett) fettP else textP
            val umbruch = zeile.mapIndexed { i, s -> umbrechen(s, zp, breiten[i] - 2 * POLSTER) }
            val hoehe = (umbruch.maxOf { it.size }) * zeilenHoehe + 2 * POLSTER
            if (y + hoehe > SEITE_UNTEN) neueSeite()
            val c = page!!.canvas
            if (zi % 2 == 1) { fill.color = Color.rgb(248, 250, 252); c.drawRect(LINKS, y, LINKS + breiten.sum(), y + hoehe, fill) }
            var x = LINKS
            umbruch.forEachIndexed { i, zl ->
                c.drawRect(x, y, x + breiten[i], y + hoehe, rand)
                zl.forEachIndexed { k, s ->
                    val tx = when (t.ausrichtung.getOrElse(i) { 'l' }) {
                        'r' -> x + breiten[i] - POLSTER - zp.measureText(s)
                        'c' -> x + (breiten[i] - zp.measureText(s)) / 2
                        else -> x + POLSTER
                    }
                    c.drawText(s, tx, y + POLSTER + (k + 1) * zeilenHoehe - 3f, zp)
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

    /** Stammblatt eines Mitglieds, A4 hoch, Aufbau wie am Desktop. */
    fun stammblatt(d: StammblattDaten, out: OutputStream) {
        val doc = PdfDocument()
        val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
        val c = page.canvas
        val dunkel = Color.rgb(15, 23, 42)
        val grau = Color.rgb(100, 116, 139)
        val linie = Paint().apply { color = Color.rgb(203, 213, 225); strokeWidth = 1.4f }
        val balken = Paint().apply { color = Color.rgb(241, 245, 249); style = Paint.Style.FILL }
        val rechts = 196 * MM
        c.drawText(d.verein, LINKS, 18 * MM, paint(16f, dunkel))
        val klein = paint(9f, grau)
        if (d.kopf1.isNotEmpty()) c.drawText(d.kopf1, LINKS, 24 * MM, klein)
        if (d.kopf2.isNotEmpty()) c.drawText(d.kopf2, LINKS, 29 * MM, klein)
        c.drawLine(LINKS, 33 * MM, rechts, 33 * MM, linie)
        c.drawText(d.titel, LINKS, 42 * MM, paint(14f, dunkel))
        c.drawText(d.erstellt, rechts - klein.measureText(d.erstellt), 42 * MM, klein)

        var y = 48 * MM
        val label = paint(8.5f, Color.rgb(71, 85, 105), bold = true)
        val wert = paint(8.5f, Color.rgb(40, 40, 40))
        val zeile = 8.5f * 1.3f
        for (a in d.abschnitte) {
            c.drawRect(LINKS, y, rechts, y + 7 * MM, balken)
            c.drawText(a.titel, 16 * MM, y + 5 * MM, paint(10f, Color.rgb(30, 41, 59), bold = true))
            y += 9 * MM
            for (z in a.zeilen) {
                var x = LINKS
                var hoehe = zeile
                val umbr = z.mapIndexed { i, s -> umbrechen(s, if (i % 2 == 0) label else wert, a.breiten[i] * MM - 2 * 1.5f * MM) }
                hoehe = umbr.maxOf { it.size } * zeile
                umbr.forEachIndexed { i, zl ->
                    zl.forEachIndexed { k, s -> c.drawText(s, x + 1.5f * MM, y + 1.5f * MM + (k + 1) * zeile - 3f, if (i % 2 == 0) label else wert) }
                    x += a.breiten[i] * MM
                }
                y += hoehe + 3f * MM
            }
            y += 3 * MM
        }
        c.drawRect(LINKS, y, rechts, y + 7 * MM, balken)
        c.drawText(d.notizenTitel, 16 * MM, y + 5 * MM, paint(10f, Color.rgb(30, 41, 59), bold = true))
        y += 12 * MM
        val klein8 = paint(8f, Color.rgb(71, 85, 105))
        for (blockText in listOf(d.notizen, d.datenschutz)) {
            for (zl in umbrechen(blockText, klein8, 178 * MM)) { c.drawText(zl, 16 * MM, y, klein8); y += 8f * 1.3f }
            y += 4 * MM
        }
        y += 18 * MM
        val strich = Paint().apply { color = Color.rgb(180, 180, 180); strokeWidth = 1f }
        c.drawLine(16 * MM, y, 85 * MM, y, strich)
        c.drawLine(115 * MM, y, 184 * MM, y, strich)
        val sp = paint(8f, Color.rgb(100, 100, 100))
        c.drawText("Ort, Datum", 16 * MM, y + 4 * MM, sp)
        c.drawText("Unterschrift Mitglied / Gesetzl. Vertreter", 115 * MM, y + 4 * MM, sp)
        doc.finishPage(page)
        doc.writeTo(out)
        doc.close()
    }

    /**
     * Prüfprotokoll zum Lastschrifteinzug, A4 hoch: Kopf mit Vereinsdaten, Summenkasten, Tabelle über mehrere Seiten
     * (Kopfzeile auf jeder Seite) und am Ende die Freigabezeile für Kassenprüfung und Bankeinreichung.
     * Aufbau wie am Desktop, Schrift und Abstände angenähert.
     */
    fun sepaProtokoll(d: SepaProtokoll, out: OutputStream) {
        val doc = PdfDocument()
        val breite = 595
        val hoehe = 842
        val rechts = 196 * MM
        val unten = hoehe - 18 * MM
        val dunkel = Color.rgb(15, 23, 42)
        val grau = Color.rgb(100, 116, 139)
        val textP = paint(7.5f, Color.rgb(40, 40, 40))
        val kopfP = paint(7.5f, Color.WHITE, bold = true)
        val rand = Paint().apply { color = Color.rgb(200, 205, 212); strokeWidth = 0.5f; style = Paint.Style.STROKE }
        val fill = Paint().apply { style = Paint.Style.FILL }
        val breiten = listOf(8f, 16f, 38f, 38f, 34f, 34f, 14f).map { it * MM }
        val rechtsbuendig = setOf(0, 6)
        val zeilenHoehe = 7.5f * 1.25f
        var seite = 0
        var page: PdfDocument.Page? = null
        var y = 0f

        fun seiteAbschliessen() {
            page?.let { pg ->
                pg.canvas.drawText("Seite $seite | ${d.fusszeile}", LINKS, hoehe - 10 * MM, paint(8f, Color.rgb(140, 140, 140)))
                doc.finishPage(pg)
            }
        }

        fun tabellenKopf() {
            val c = page!!.canvas
            val kh = zeilenHoehe + 2 * POLSTER
            fill.color = Color.rgb(30, 41, 59)
            c.drawRect(LINKS, y, LINKS + breiten.sum(), y + kh, fill)
            var x = LINKS
            d.spalten.forEachIndexed { i, s ->
                val tx = if (i in rechtsbuendig && i != 0) x + breiten[i] - POLSTER - kopfP.measureText(s) else x + POLSTER
                c.drawText(s, tx, y + POLSTER + zeilenHoehe - 3f, kopfP)
                x += breiten[i]
            }
            y += kh
        }

        fun neueSeite() {
            seiteAbschliessen()
            seite += 1
            val pg = doc.startPage(PdfDocument.PageInfo.Builder(breite, hoehe, seite).create())
            page = pg
            y = 15 * MM
            if (seite > 1) tabellenKopf()
        }

        // Seite 1: Kopf
        seite = 1
        page = doc.startPage(PdfDocument.PageInfo.Builder(breite, hoehe, seite).create())
        val c1 = page!!.canvas
        val klein = paint(9f, grau)
        c1.drawText(d.verein, LINKS, 18 * MM, paint(16f, dunkel))
        if (d.kopf1.isNotEmpty()) c1.drawText(d.kopf1, LINKS, 24 * MM, klein)
        if (d.kopf2.isNotEmpty()) c1.drawText(d.kopf2, LINKS, 29 * MM, klein)
        c1.drawLine(LINKS, 33 * MM, rechts, 33 * MM, Paint().apply { color = Color.rgb(203, 213, 225); strokeWidth = 1.4f })
        c1.drawText(d.titel, LINKS, 42 * MM, paint(13f, dunkel))
        c1.drawText(d.daten, LINKS, 48 * MM, klein)

        // Summenkasten
        val kastenOben = 53 * MM
        val kastenHoehe = 18 * MM
        fill.color = Color.rgb(241, 245, 249)
        c1.drawRect(LINKS, kastenOben, rechts, kastenOben + kastenHoehe, fill)
        val spaltenBreite = (rechts - LINKS) / 3f
        val beschriftung = listOf("Gesamtsumme", "Anzahl", "Zyklus")
        val werte = listOf(d.summeText, d.anzahlText, d.zyklus)
        for (i in 0..2) {
            val x = LINKS + i * spaltenBreite + 4 * MM
            c1.drawText(beschriftung[i], x, kastenOben + 6 * MM, paint(8f, grau))
            c1.drawText(werte[i], x, kastenOben + 13 * MM, paint(12f, dunkel, bold = true))
        }
        y = kastenOben + kastenHoehe + 6 * MM
        tabellenKopf()

        d.zeilen.forEachIndexed { zi, zeile ->
            val umbruch = zeile.mapIndexed { i, s -> umbrechen(s, textP, breiten[i] - 2 * POLSTER) }
            val h = umbruch.maxOf { it.size } * zeilenHoehe + 2 * POLSTER
            if (y + h > unten) neueSeite()
            val c = page!!.canvas
            if (zi % 2 == 1) { fill.color = Color.rgb(248, 250, 252); c.drawRect(LINKS, y, LINKS + breiten.sum(), y + h, fill) }
            var x = LINKS
            umbruch.forEachIndexed { i, zl ->
                c.drawRect(x, y, x + breiten[i], y + h, rand)
                zl.forEachIndexed { k, s ->
                    val tx = if (i in rechtsbuendig) x + breiten[i] - POLSTER - textP.measureText(s) else x + POLSTER
                    c.drawText(s, tx, y + POLSTER + (k + 1) * zeilenHoehe - 3f, textP)
                }
                x += breiten[i]
            }
            y += h
        }

        // Fußnote und Freigabe; passt der Block nicht mehr auf die Seite, kommt er auf eine neue
        val blockHoehe = 52 * MM
        if (y + blockHoehe > unten) { neueSeite(); y = 20 * MM }
        val c = page!!.canvas
        y += 5 * MM
        if (d.fussnote.isNotEmpty()) {
            c.drawText(d.fussnote, LINKS, y, paint(7.5f, grau))
            y += 8 * MM
        }
        y += 4 * MM
        c.drawText("Kassenprüfung & Freigabe zur Bankeinreichung", LINKS, y, paint(10f, dunkel, bold = true))
        y += 16 * MM
        val strich = Paint().apply { color = Color.rgb(60, 60, 60); strokeWidth = 0.8f }
        val mitte = LINKS + 80 * MM
        c.drawLine(LINKS, y, LINKS + 70 * MM, y, strich)
        c.drawLine(mitte, y, rechts, y, strich)
        val beschr = paint(8f, grau)
        c.drawText("Datum", LINKS, y + 4.5f * MM, beschr)
        val name = if (d.kassenwart.isNotEmpty()) "Unterschrift Kassenwart/Schatzmeister: ${d.kassenwart}" else "Unterschrift Kassenwart/Schatzmeister"
        c.drawText(name, mitte, y + 4.5f * MM, beschr)
        c.drawText("Erstellt am ${d.erstellt}", LINKS, y + 14 * MM, beschr)

        seiteAbschliessen()
        doc.writeTo(out)
        doc.close()
    }

    /**
     * Zuwendungsbestätigung nach amtlichem Muster, A4 hoch. Die Zeichenbefehle kommen aus dem Kern
     * ([ZuwendungsVordruck], Maße des Desktops); hier wird nur gezeichnet. Die Schrift des Geräts ist etwas breiter oder
     * schmaler als die des Desktops: Zeilen, die über den rechten Rand des Vordrucks hinausragen würden, werden dafür
     * etwas verkleinert statt abgeschnitten.
     */
    private val NORMAL = Typeface.create("sans-serif", Typeface.NORMAL)
    private val FETT = Typeface.create("sans-serif", Typeface.BOLD)

    private fun schrift(size: Double, bold: Boolean, farbe: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size.toFloat(); color = farbe; typeface = if (bold) FETT else NORMAL
    }

    /** Textbreite in Millimetern mit der Schrift der PDF-Seiten (für den Seitenumbruch im Kern). */
    val mass = de.vereinsmanager.core.invoice.Mass { text, groesse, fett -> schrift(groesse, fett, Color.BLACK).measureText(text).toDouble() / MM.toDouble() }

    /**
     * Zeichnet Befehle des Kerns auf eine Seite. [begrenzen]: Zeilen, die über den rechten Rand des Vordrucks hinausragen
     * würden, werden etwas verkleinert statt abgeschnitten (Zuwendungsbestätigung).
     */
    internal fun zeichneSeite(c: android.graphics.Canvas, befehle: List<Zeichnung>, begrenzen: Boolean) {
        val schwarz = Color.BLACK
        val strich = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = schwarz; style = Paint.Style.STROKE }
        val flaeche = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val rechterRand = 195.3f * MM
        fun p(size: Double, bold: Boolean, grau: Boolean = false, farbe: Int? = null) =
            schrift(size, bold, farbe ?: if (grau) Color.rgb(110, 110, 110) else schwarz)
        for (z in befehle) {
            when (z) {
                is Zeichnung.Rechteck -> {
                    val l = z.x.toFloat() * MM; val o = z.y.toFloat() * MM; val r = (z.x + z.b).toFloat() * MM; val u = (z.y + z.h).toFloat() * MM
                    if (z.fuellung != null) { flaeche.color = z.fuellung!!; c.drawRect(l, o, r, u, flaeche) }
                    if (z.rand) {
                        strich.color = z.farbe ?: schwarz
                        strich.strokeWidth = 0.25f * MM
                        c.drawRect(l, o, r, u, strich)
                    }
                }
                is Zeichnung.Qr -> zeichneQr(c, z, strich, flaeche)
                is Zeichnung.Sektor -> {
                    flaeche.color = z.fuellung
                    val aussen = android.graphics.RectF((z.cx - z.aussen).toFloat() * MM, (z.cy - z.aussen).toFloat() * MM, (z.cx + z.aussen).toFloat() * MM, (z.cy + z.aussen).toFloat() * MM)
                    val weg = android.graphics.Path()
                    weg.arcTo(aussen, z.start.toFloat(), z.winkel.toFloat())
                    if (z.innen > 0.0) {
                        val innen = android.graphics.RectF((z.cx - z.innen).toFloat() * MM, (z.cy - z.innen).toFloat() * MM, (z.cx + z.innen).toFloat() * MM, (z.cy + z.innen).toFloat() * MM)
                        weg.arcTo(innen, (z.start + z.winkel).toFloat(), -z.winkel.toFloat())
                    } else weg.lineTo(z.cx.toFloat() * MM, z.cy.toFloat() * MM)
                    weg.close()
                    c.drawPath(weg, flaeche)
                    // dünner weißer Rand trennt die Scheiben
                    strich.color = Color.WHITE; strich.strokeWidth = 0.5f * MM
                    c.drawPath(weg, strich)
                }
                is Zeichnung.Linienzug -> {
                    strich.color = z.farbe ?: schwarz
                    strich.strokeWidth = z.dicke.toFloat() * MM
                    strich.strokeCap = Paint.Cap.ROUND
                    strich.strokeJoin = Paint.Join.ROUND
                    val weg = android.graphics.Path()
                    z.punkte.forEachIndexed { i, (x, y) -> if (i == 0) weg.moveTo(x.toFloat() * MM, y.toFloat() * MM) else weg.lineTo(x.toFloat() * MM, y.toFloat() * MM) }
                    c.drawPath(weg, strich)
                    strich.strokeCap = Paint.Cap.BUTT
                    strich.strokeJoin = Paint.Join.MITER
                }
                is Zeichnung.Linie -> {
                    strich.color = z.farbe ?: schwarz
                    strich.strokeWidth = z.dicke.toFloat() * MM
                    c.drawLine(z.x1.toFloat() * MM, z.y1.toFloat() * MM, z.x2.toFloat() * MM, z.y2.toFloat() * MM, strich)
                }
                is Zeichnung.Text -> {
                    val paint = p(z.groesse, z.fett, z.grau, z.farbe)
                    val x0 = z.x.toFloat() * MM
                    val y = z.y.toFloat() * MM
                    val w = paint.measureText(z.text)
                    if (begrenzen && z.aus == Zeichnung.Aus.LINKS && z.fettAnhang == null && x0 + w > rechterRand && w > 0f) {
                        paint.textSize = paint.textSize * ((rechterRand - x0) / w).coerceAtLeast(0.7f)
                    }
                    val breite = paint.measureText(z.text)
                    val x = when (z.aus) {
                        Zeichnung.Aus.LINKS -> x0
                        Zeichnung.Aus.MITTE -> x0 - breite / 2
                        Zeichnung.Aus.RECHTS -> x0 - breite
                    }
                    c.drawText(z.text, x, y, paint)
                    z.fettAnhang?.let { a -> c.drawText(a, x0 + paint.measureText(z.text + " ") + 0.6f * MM, y, p(z.groesse, true)) }
                }
                is Zeichnung.Umbruch -> if (z.schrumpfen) {
                    val text = z.absaetze.joinToString(" ")
                    val breite = z.breite.toFloat() * MM
                    var groesse = z.groesse
                    var paint = p(groesse, false)
                    while (paint.measureText(text) > breite && groesse > 5.5) { groesse -= 0.25; paint = p(groesse, false) }
                    if (paint.measureText(text) <= breite) {
                        c.drawText(text, z.x.toFloat() * MM, z.y.toFloat() * MM, paint)
                    } else {
                        val klein = p(6.0, false)
                        umbrechen(text, klein, breite).take(2).forEachIndexed { i, zl ->
                            c.drawText(zl, z.x.toFloat() * MM, (z.y + (i - 1) * 3.0 + 0.2).toFloat() * MM, klein)
                        }
                    }
                } else {
                    val paint = p(z.groesse, false)
                    var y = z.y.toFloat() * MM
                    for (absatz in z.absaetze) {
                        val zeilen = umbrechen(absatz, paint, z.breite.toFloat() * MM).let { l -> if (z.maxZeilen != null) l.take(z.maxZeilen!!) else l }
                        zeilen.forEachIndexed { i, zl -> c.drawText(zl, z.x.toFloat() * MM, y + i * z.zeilenabstand.toFloat() * MM, paint) }
                        y += zeilen.size * z.zeilenabstand.toFloat() * MM + z.absatzAbstand.toFloat() * MM
                    }
                }
            }
        }
    }

    /** QR-Code als Vektor-Quadrate (scharf in jeder Vergrößerung), auf weißem Feld mit Ruhezone von zwei Modulen. */
    private fun zeichneQr(c: android.graphics.Canvas, z: Zeichnung.Qr, strich: Paint, flaeche: Paint) {
        val hints = mapOf(com.google.zxing.EncodeHintType.CHARACTER_SET to "UTF-8")
        val matrix = com.google.zxing.qrcode.encoder.Encoder.encode(z.inhalt, com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M, hints).matrix
        val n = matrix.width
        val x0 = z.x.toFloat() * MM; val y0 = z.y.toFloat() * MM; val g = z.groesse.toFloat() * MM
        flaeche.color = Color.WHITE
        strich.color = Color.rgb(203, 213, 225); strich.strokeWidth = 0.3f * MM
        c.drawRoundRect(x0, y0, x0 + g, y0 + g, MM, MM, flaeche)
        c.drawRoundRect(x0, y0, x0 + g, y0 + g, MM, MM, strich)
        flaeche.color = Color.BLACK
        val rand = 2
        val m = g / (n + 2 * rand)
        for (r in 0 until n) for (s in 0 until n) {
            if (matrix.get(s, r).toInt() == 1) {
                val x = x0 + (s + rand) * m
                val y = y0 + (r + rand) * m
                c.drawRect(x, y, x + m + 0.04f * MM, y + m + 0.04f * MM, flaeche)
            }
        }
    }

    /**
     * Zuwendungsbestätigung nach amtlichem Muster, A4 hoch. Die Zeichenbefehle kommen aus dem Kern
     * ([ZuwendungsVordruck], Maße des Desktops); hier wird nur gezeichnet.
     */
    fun zuwendung(r: DonationReceipt, st: ClubTaxSettings, out: OutputStream, unterschrift: de.vereinsmanager.core.donation.Unterschrift? = null) {
        val doc = PdfDocument()
        val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
        zeichneSeite(page.canvas, ZuwendungsVordruck.bauen(r, st, unterschrift), begrenzen = true)
        doc.finishPage(page)
        doc.writeTo(out)
        doc.close()
    }

    /** Eine Rechnung: je Seite die Befehle aus dem Kern; [hintergrund] ist das Briefpapier, das auf jede Seite gelegt wird. */
    fun rechnung(seiten: List<List<Zeichnung>>, hintergrund: android.graphics.Bitmap?, out: OutputStream) {
        val doc = PdfDocument()
        seiten.forEachIndexed { i, befehle ->
            val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, i + 1).create())
            val c = page.canvas
            if (hintergrund != null) {
                c.drawBitmap(hintergrund, null, android.graphics.RectF(0f, 0f, 595f, 842f), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
            }
            zeichneSeite(c, befehle, begrenzen = false)
            doc.finishPage(page)
        }
        doc.writeTo(out)
        doc.close()
    }
}
