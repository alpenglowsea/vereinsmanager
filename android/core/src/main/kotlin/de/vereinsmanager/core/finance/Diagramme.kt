package de.vereinsmanager.core.finance

import de.vereinsmanager.core.donation.Zeichnung
import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.LocalDate
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** Ein antippbarer Bereich im Diagramm (Millimeter wie die Zeichenbefehle) mit dem Text, der beim Antippen erscheint. */
data class Treffer(val x: Double, val y: Double, val b: Double, val h: Double, val text: String)

/**
 * Ein fertig angeordnetes Diagramm als Liste von Zeichenbefehlen (Millimeter, Ursprung oben links, Schriftgrößen in Punkt).
 * Dieselben Befehle zeichnet die App auf dem Bildschirm und im PDF; dadurch lässt sich die Anordnung ohne Gerät prüfen.
 */
data class Diagramm(
    val titel: String,
    val breite: Double,
    val hoehe: Double,
    val befehle: List<Zeichnung>,
    val treffer: List<Treffer>,
    /** Die Zahlen als Tabelle (erste Zeile = Kopf). */
    val tabelle: List<List<String>>,
    /** Hinweis statt Diagramm, wenn es nichts zu zeichnen gibt. */
    val leer: String? = null,
)

object Diagramme {
    // Farben wie am Desktop; Spenden bewusst blau (auch bei Rot-Grün-Schwäche unterscheidbar).
    const val EINNAHMEN = 0xFF059669.toInt()
    const val AUSGABEN = 0xFFE11D48.toInt()
    const val SPENDEN = 0xFF2563EB.toInt()
    const val SUMME = 0xFF0F172A.toInt()
    private const val RASTER = 0xFFE2E8F0.toInt()
    private const val ACHSE = 0xFF94A3B8.toInt()
    private const val TEXT = 0xFF334155.toInt()
    private const val GRAU = 0xFF64748B.toInt()
    private const val WEISS = 0xFFFFFFFF.toInt()
    private const val RAND = 0xFFCBD5E1.toInt()

    private val DE = DecimalFormatSymbols(Locale.GERMANY)
    private fun eur(v: BigDecimal) = DecimalFormat("#,##0.00", DE).format(v.setScale(2, java.math.RoundingMode.HALF_UP)) + " €"
    private fun eurKurz(v: Double) = DecimalFormat("#,##0", DE).format(Math.round(v)) + " €"

    /** Geschätzte Textbreite in Millimetern (Schrift unbekannt, daher großzügig). */
    fun breite(text: String, pt: Double, fett: Boolean = false): Double = text.length * pt * 0.3528 * (if (fett) 0.58 else 0.54)

    private fun kuerzen(text: String, pt: Double, max: Double): String {
        if (breite(text, pt) <= max) return text
        var t = text
        while (t.length > 1 && breite("$t…", pt) > max) t = t.dropLast(1)
        return "$t…"
    }

    /** „Schöne“ Achse: Grenzen und Schritt (1, 2, 5 mal Zehnerpotenz), die [min] und [max] einschließen. */
    fun skala(min: Double, max: Double, ziele: Int = 4): Triple<Double, Double, Double> {
        val lo = min(min, 0.0); val hi = max(max, 0.0)
        if (hi - lo <= 0.0) return Triple(0.0, 1.0, 1.0)
        val roh = (hi - lo) / ziele
        val z = 10.0.pow(floor(log10(roh)))
        val m = roh / z
        val schritt = (if (m <= 1) 1.0 else if (m <= 2) 2.0 else if (m <= 5) 5.0 else 10.0) * z
        return Triple(floor(lo / schritt) * schritt, ceil(hi / schritt) * schritt, schritt)
    }

    private class Zeichner(val breite: Double) {
        val b = ArrayList<Zeichnung>()
        val t = ArrayList<Treffer>()
        fun text(s: String, x: Double, y: Double, pt: Double, fett: Boolean = false, aus: Zeichnung.Aus = Zeichnung.Aus.LINKS, farbe: Int = TEXT) {
            b.add(Zeichnung.Text(s, x, y, pt, fett, aus, farbe = farbe))
        }
        fun rechteck(x: Double, y: Double, w: Double, h: Double, farbe: Int) { if (w > 0 && h > 0) b.add(Zeichnung.Rechteck(x, y, w, h, fuellung = farbe, rand = false)) }
        fun linie(x1: Double, y1: Double, x2: Double, y2: Double, farbe: Int, d: Double = 0.2) { b.add(Zeichnung.Linie(x1, y1, x2, y2, d, farbe)) }
        fun kopf(titel: String, untertitel: String) {
            text(kuerzen(titel, 8.5, breite - 6), 3.0, 6.0, 8.5, fett = true, farbe = SUMME)
            if (untertitel.isNotEmpty()) text(kuerzen(untertitel, 6.3, breite - 6), 3.0, 10.2, 6.3, farbe = GRAU)
        }
        fun legende(eintraege: List<Pair<String, Int>>, y: Double) {
            var x = 3.0
            for ((n, f) in eintraege) {
                rechteck(x, y - 2.2, 2.4, 2.4, f)
                text(n, x + 3.4, y, 6.3)
                x += 3.4 + breite(n, 6.3) + 4.0
            }
        }
        fun fertig(titel: String, hoehe: Double, tabelle: List<List<String>>, leer: String? = null): Diagramm {
            val grund = Zeichnung.Rechteck(0.0, 0.0, breite, hoehe, fuellung = WEISS, farbe = RAND, rand = true)
            return Diagramm(titel, breite, hoehe, listOf<Zeichnung>(grund) + b, t, tabelle, leer)
        }
    }

    private fun leeresDiagramm(titel: String, untertitel: String, breite: Double, hoehe: Double, hinweis: String): Diagramm {
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        z.text(hinweis, breite / 2, hoehe / 2 + 3, 7.0, aus = Zeichnung.Aus.MITTE, farbe = GRAU)
        return z.fertig(titel, hoehe, emptyList(), hinweis)
    }

    // ---------------------------------------------------------------- 1. Monatssäulen

    fun monatsSaeulen(monate: List<MonatsSumme>, alleJahre: Boolean, breite: Double = 100.0, hoehe: Double = 75.0): Diagramm {
        val titel = "Einnahmen, Ausgaben & Spenden nach Monat"
        val untertitel = if (alleJahre) "Alle Jahre zusammen, je Monat" else "Monatliche Gegenüberstellung der Zahlungsströme"
        val tabelle = listOf(listOf("Monat", "Einnahmen", "Spenden", "Ausgaben")) + monate.map { listOf(it.name, eur(it.einnahmen), eur(it.spenden), eur(it.ausgaben)) }
        if (monate.all { it.einnahmen.signum() == 0 && it.spenden.signum() == 0 && it.ausgaben.signum() == 0 }) return leeresDiagramm(titel, untertitel, breite, 45.0, "Keine Buchungen für diese Auswahl.")
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        val pos = monate.maxOf { (it.einnahmen + it.spenden).toDouble() }
        val neg = monate.maxOf { it.ausgaben.toDouble() }
        val (lo, hi, schritt) = skala(-neg, pos)
        val beschr = generateSequence(lo) { it + schritt }.takeWhile { it <= hi + schritt / 2 }.toList()
        val x0 = 3.0 + beschr.maxOf { breite(eurKurz(it), 6.0) } + 1.5
        val x1 = breite - 3.0
        val oben = 15.0; val unten = hoehe - 11.0
        fun y(v: Double) = unten - (v - lo) / (hi - lo) * (unten - oben)
        for (t in beschr) {
            z.linie(x0, y(t), x1, y(t), if (abs(t) < 1e-9) ACHSE else RASTER, if (abs(t) < 1e-9) 0.3 else 0.15)
            z.text(eurKurz(t), x0 - 1.0, y(t) + 0.9, 6.0, aus = Zeichnung.Aus.RECHTS, farbe = GRAU)
        }
        val slot = (x1 - x0) / 12; val bw = slot * 0.62
        monate.forEachIndexed { i, m ->
            val x = x0 + i * slot + (slot - bw) / 2
            val e = m.einnahmen.toDouble(); val s = m.spenden.toDouble(); val a = m.ausgaben.toDouble()
            z.rechteck(x, y(e), bw, y(0.0) - y(e), EINNAHMEN)
            z.rechteck(x, y(e + s), bw, y(e) - y(e + s), SPENDEN)
            z.rechteck(x, y(0.0), bw, y(-a) - y(0.0), AUSGABEN)
            z.text(m.name, x0 + i * slot + slot / 2, unten + 4.0, 6.0, aus = Zeichnung.Aus.MITTE, farbe = GRAU)
            z.t.add(Treffer(x0 + i * slot, oben, slot, unten - oben, "${m.name}: Einnahmen ${eur(m.einnahmen)} · Spenden ${eur(m.spenden)} · Ausgaben ${eur(m.ausgaben)}"))
        }
        z.legende(listOf("Einnahmen" to EINNAHMEN, "Spenden" to SPENDEN, "Ausgaben" to AUSGABEN), hoehe - 2.0)
        return z.fertig(titel, hoehe, tabelle)
    }

    // ---------------------------------------------------------------- 2. Torte

    fun torte(k: Kennzahlen, breite: Double = 100.0): Diagramm {
        val titel = "Jahresübersicht: Einnahmen, Ausgaben & Spenden"
        val untertitel = "Anteil an allen Bewegungen im gewählten Zeitraum"
        val teile = listOf(Triple("Einnahmen", k.einnahmen, EINNAHMEN), Triple("Ausgaben", k.ausgaben, AUSGABEN), Triple("Spenden", k.spenden, SPENDEN)).filter { it.second.signum() > 0 }
        val gesamt = teile.fold(BigDecimal.ZERO) { a, t -> a + t.second }
        val tabelle = listOf(listOf("Art", "Betrag", "Anteil")) + teile.map { listOf(it.first, eur(it.second), prozent(it.second, gesamt)) }
        if (teile.isEmpty()) return leeresDiagramm(titel, untertitel, breite, 45.0, "Keine Buchungen für diese Auswahl.")
        val r = min(breite / 2 - 8.0, 26.0)
        val cx = breite / 2; val cy = 14.0 + r
        val hoehe = cy + r + 5.0 + teile.size * 5.6 + 1.5
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        var start = -90.0
        for ((_, w, f) in teile) {
            val winkel = w.toDouble() / gesamt.toDouble() * 360.0
            // Eine einzelne Scheibe (100 %) wird knapp unter 360° gezeichnet, damit der Ring nicht verschwindet.
            z.b.add(Zeichnung.Sektor(cx, cy, r, r * 0.58, start, min(winkel, 359.9), f))
            start += winkel
        }
        var y = cy + r + 7.0
        for ((n, w, f) in teile) {
            z.rechteck(3.0, y - 2.6, 3.0, 3.0, f)
            z.text(n, 8.0, y, 7.0)
            val txt = "${eur(w)}  (${prozent(w, gesamt)})"
            z.text(txt, breite - 3.0, y, 7.0, fett = true, aus = Zeichnung.Aus.RECHTS)
            z.t.add(Treffer(0.0, y - 4.0, breite, 5.6, "$n: $txt"))
            y += 5.6
        }
        return z.fertig(titel, hoehe, tabelle)
    }

    private fun prozent(w: BigDecimal, gesamt: BigDecimal): String =
        if (gesamt.signum() == 0) "0 %" else "${Math.round(w.toDouble() / gesamt.toDouble() * 100)} %"

    // ---------------------------------------------------------------- 3. Verlauf

    fun verlauf(punkte: List<VerlaufPunkt>, alleJahre: Boolean, breite: Double = 100.0, hoehe: Double = 70.0): Diagramm {
        val titel = "Kontostand-Verlauf"
        val untertitel = if (alleJahre) "Anfangsbestand plus Buchungen, jeweils am Jahresende" else "Anfangsbestand plus Buchungen, jeweils am Monatsende"
        val tabelle = listOf(listOf("Stichtag", "Kontostand")) + punkte.map { listOf(it.name, eur(it.stand)) }
        if (punkte.isEmpty()) return leeresDiagramm(titel, untertitel, breite, 45.0, "Keine Buchungen für diese Auswahl.")
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        val werte = punkte.map { it.stand.toDouble() }
        val (lo, hi, schritt) = skala(werte.min(), werte.max())
        val beschr = generateSequence(lo) { it + schritt }.takeWhile { it <= hi + schritt / 2 }.toList()
        val x0 = 3.0 + beschr.maxOf { breite(eurKurz(it), 6.0) } + 1.5
        val x1 = breite - 5.0
        val oben = 15.0; val unten = hoehe - 8.0
        fun y(v: Double) = unten - (v - lo) / (hi - lo) * (unten - oben)
        for (t in beschr) {
            z.linie(x0, y(t), x1, y(t), if (abs(t) < 1e-9) ACHSE else RASTER, if (abs(t) < 1e-9) 0.3 else 0.15)
            z.text(eurKurz(t), x0 - 1.0, y(t) + 0.9, 6.0, aus = Zeichnung.Aus.RECHTS, farbe = GRAU)
        }
        val n = punkte.size
        val spanne = x1 - x0
        fun x(i: Int) = if (n == 1) (x0 + x1) / 2 else x0 + 2.0 + i * (spanne - 4.0) / (n - 1)
        if (n > 1) z.b.add(Zeichnung.Linienzug(punkte.indices.map { x(it) to y(werte[it]) }, 0.5, SUMME))
        val jeden = max(1, ceil(n / 8.0).toInt())
        punkte.forEachIndexed { i, p ->
            z.rechteck(x(i) - 0.8, y(werte[i]) - 0.8, 1.6, 1.6, SUMME)
            if (i % jeden == 0 || i == n - 1 && jeden == 1) z.text(p.name, x(i), unten + 4.2, 6.0, aus = Zeichnung.Aus.MITTE, farbe = GRAU)
            val halb = if (n == 1) spanne / 2 else spanne / (n - 1) / 2
            z.t.add(Treffer(x(i) - halb, oben, halb * 2, unten - oben, "${p.name}: Kontostand ${eur(p.stand)}"))
        }
        return z.fertig(titel, hoehe, tabelle)
    }

    // ---------------------------------------------------------------- 4. Mix nach Konto

    fun mix(titel: String, untertitel: String, anteile: List<Anteil>, farbe: Int, breite: Double = 100.0, maxZeilen: Int = 12): Diagramm {
        val tabelle = listOf(listOf("Konto", "Betrag")) + anteile.map { listOf(it.name, eur(it.wert)) }
        if (anteile.isEmpty()) return leeresDiagramm(titel, untertitel, breite, 40.0, "Keine Buchungen für diese Auswahl.")
        val zeilen = if (anteile.size <= maxZeilen) anteile else
            anteile.take(maxZeilen - 1) + Anteil("Übrige (${anteile.size - maxZeilen + 1} Konten)", anteile.drop(maxZeilen - 1).fold(BigDecimal.ZERO) { a, x -> a + x.wert })
        val hoehe = 14.0 + zeilen.size * 9.0 + 2.0
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        val groesst = zeilen.maxOf { it.wert.toDouble() }.takeIf { it > 0 } ?: 1.0
        zeilen.forEachIndexed { i, a ->
            val y0 = 14.0 + i * 9.0
            val wert = eur(a.wert)
            z.text(kuerzen(a.name, 6.8, breite - 6.0 - breite(wert, 6.8, true) - 2.0), 3.0, y0 + 3.0, 6.8)
            z.text(wert, breite - 3.0, y0 + 3.0, 6.8, fett = true, aus = Zeichnung.Aus.RECHTS)
            val len = (breite - 6.0) * (a.wert.toDouble() / groesst)
            z.rechteck(3.0, y0 + 4.2, max(len, 0.4), 3.4, farbe)
            z.t.add(Treffer(0.0, y0, breite, 9.0, "${a.name}: $wert"))
        }
        return z.fertig(titel, hoehe, tabelle)
    }

    // ---------------------------------------------------------------- 5. Sparten

    fun sparten(summen: List<SpartenSumme>, breite: Double = 100.0, maxBloecke: Int = 15): Diagramm {
        val titel = "Einnahmen, Ausgaben und Summe nach Sparte"
        val untertitel = "Einnahmen einschließlich Spenden; Summe = Einnahmen − Ausgaben"
        val tabelle = listOf(listOf("Sparte", "Einnahmen", "Ausgaben", "Summe")) + summen.map { listOf(it.name, eur(it.einnahmen), eur(it.ausgaben), eur(it.summe)) }
        if (summen.all { it.einnahmen.signum() == 0 && it.ausgaben.signum() == 0 }) return leeresDiagramm(titel, untertitel, breite, 45.0, "Keine Buchungen für diese Auswahl.")
        val gezeigt = summen.take(1) + summen.drop(1).sortedByDescending { max(it.einnahmen.toDouble(), it.ausgaben.toDouble()) }.take(maxBloecke - 1)
        val hoehe = 17.0 + gezeigt.size * 19.0 + 1.0
        val z = Zeichner(breite)
        z.kopf(titel, untertitel)
        z.legende(listOf("Einnahmen" to EINNAHMEN, "Ausgaben" to AUSGABEN, "Summe" to SUMME), 14.5)
        val wertBreite = 24.0
        val x0 = 3.0; val x1 = breite - 3.0 - wertBreite
        val lo = min(0.0, gezeigt.minOf { it.summe.toDouble() })
        val hi = max(0.0, gezeigt.maxOf { max(it.einnahmen.toDouble(), max(it.ausgaben.toDouble(), it.summe.toDouble())) })
        val spanne = (hi - lo).takeIf { it > 0 } ?: 1.0
        fun x(v: Double) = x0 + (v - lo) / spanne * (x1 - x0)
        val nullX = x(0.0)
        gezeigt.forEachIndexed { i, s ->
            val y0 = 17.0 + i * 19.0
            z.text(kuerzen(s.name, 7.0, breite - 6.0), 3.0, y0 + 3.0, 7.0, fett = true, farbe = SUMME)
            val reihen = listOf(Triple(s.einnahmen, EINNAHMEN, 0), Triple(s.ausgaben, AUSGABEN, 1), Triple(s.summe, SUMME, 2))
            reihen.forEach { (w, f, r) ->
                val yb = y0 + 4.4 + r * 4.6
                val v = w.toDouble()
                val a = min(x(v), nullX); val e = max(x(v), nullX)
                z.rechteck(a, yb, max(e - a, 0.4), 3.2, f)
                z.text(eur(w), breite - 3.0, yb + 2.7, 6.5, aus = Zeichnung.Aus.RECHTS)
            }
            z.t.add(Treffer(0.0, y0, breite, 19.0, "${s.name}: Einnahmen ${eur(s.einnahmen)} · Ausgaben ${eur(s.ausgaben)} · Summe ${eur(s.summe)}"))
        }
        if (lo < 0) z.linie(nullX, 17.0, nullX, hoehe - 1.0, ACHSE, 0.2)
        return z.fertig(titel, hoehe, tabelle)
    }

    // ---------------------------------------------------------------- Seiten für das PDF

    /** Verschiebt alle Befehle um ([dx], [dy]) Millimeter. */
    fun verschiebe(befehle: List<Zeichnung>, dx: Double, dy: Double): List<Zeichnung> = befehle.map {
        when (it) {
            is Zeichnung.Text -> it.copy(x = it.x + dx, y = it.y + dy)
            is Zeichnung.Rechteck -> it.copy(x = it.x + dx, y = it.y + dy)
            is Zeichnung.Linie -> it.copy(x1 = it.x1 + dx, y1 = it.y1 + dy, x2 = it.x2 + dx, y2 = it.y2 + dy)
            is Zeichnung.Linienzug -> it.copy(punkte = it.punkte.map { (x, y) -> (x + dx) to (y + dy) })
            is Zeichnung.Sektor -> it.copy(cx = it.cx + dx, cy = it.cy + dy)
            is Zeichnung.Qr -> it.copy(x = it.x + dx, y = it.y + dy)
            is Zeichnung.Umbruch -> it.copy(x = it.x + dx, y = it.y + dy)
        }
    }

    /**
     * Die Auswertung als PDF-Seiten (A4 hoch, Befehle in Millimetern): Kopf, Kennzahlen, Monatssäulen, Torte und Verlauf auf Seite 1,
     * die beiden Konto-Mixe und der Sparten-Vergleich danach. Die Mixe zeigen den Gesamtverein.
     */
    fun pdfSeiten(a: Auswertung, verein: String, filterText: String, heute: LocalDate): List<List<Zeichnung>> {
        val seiten = ArrayList<MutableList<Zeichnung>>()
        fun neueSeite() = ArrayList<Zeichnung>().also { seiten.add(it) }
        var s = neueSeite()
        s.add(Zeichnung.Text(verein, 15.0, 17.0, 11.0, true))
        s.add(Zeichnung.Text("Erstellt am ${"%02d.%02d.%04d".format(heute.dayOfMonth, heute.monthValue, heute.year)}", 195.0, 17.0, 8.0, false, Zeichnung.Aus.RECHTS, grau = true))
        s.add(Zeichnung.Text("Finanz-Auswertung", 15.0, 25.0, 14.0, true))
        s.add(Zeichnung.Text(filterText, 15.0, 30.5, 8.0, false, grau = true))
        val k = a.kennzahlen
        val kacheln = listOf(
            Triple("Einnahmen (ohne Spenden)", "+" + eur(k.einnahmen), EINNAHMEN), Triple("Spenden", "+" + eur(k.spenden), SPENDEN),
            Triple("Ausgaben", "-" + eur(k.ausgaben), AUSGABEN),
            Triple("Saldo", (if (k.saldo.signum() >= 0) "+" else "") + eur(k.saldo), if (k.saldo.signum() >= 0) EINNAHMEN else AUSGABEN),
        )
        kacheln.forEachIndexed { i, (n, w, f) ->
            val x = 15.0 + i * 45.0
            s.add(Zeichnung.Rechteck(x, 35.0, 43.0, 15.0, farbe = RAND))
            s.add(Zeichnung.Text(kuerzen(n, 6.3, 40.0), x + 2.0, 40.0, 6.3, false, farbe = GRAU))
            s.add(Zeichnung.Text(kuerzen(w, 9.0, 40.0), x + 2.0, 46.5, 9.0, true, farbe = f))
        }
        var y = 54.0
        fun platz(d: Diagramm, x: Double, yy: Double) { s.addAll(verschiebe(d.befehle, x, yy)) }
        val monat = monatsSaeulen(a.monate, a.filter.jahr == null, 180.0, 80.0)
        platz(monat, 15.0, y); y += monat.hoehe + 4.0
        val torte = torte(a.kennzahlen, 88.0)
        val verlauf = verlauf(a.verlauf, a.filter.jahr == null, 88.0, torte.hoehe)
        platz(torte, 15.0, y); platz(verlauf, 107.0, y)
        s = neueSeite()
        val ein = mix("Einnahmen-Mix nach Konto", "Ohne Spenden, Gesamtverein", Finanzauswertung.mix(a.posten, true), EINNAHMEN, 88.0)
        val aus = mix("Ausgaben-Mix nach Konto", "Gesamtverein", Finanzauswertung.mix(a.posten, false), AUSGABEN, 88.0)
        platz(ein, 15.0, 15.0); platz(aus, 107.0, 15.0)
        y = 15.0 + max(ein.hoehe, aus.hoehe) + 4.0
        val sp = sparten(a.sparten, 180.0)
        if (y + sp.hoehe > 280.0) { s = neueSeite(); y = 15.0 }
        platz(sp, 15.0, y)
        seiten.forEachIndexed { i, p -> p.add(Zeichnung.Text("Seite ${i + 1} von ${seiten.size}", 105.0, 290.0, 7.0, false, Zeichnung.Aus.MITTE, grau = true)) }
        return seiten
    }
}
