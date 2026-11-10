package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.members.Zeit
import java.math.BigDecimal

/** Misst Text in Millimetern; die App liefert das mit der Schrift des Geräts, die Tests mit einer festen Zeichenbreite. */
fun interface Mass {
    fun breite(text: String, groesse: Double, fett: Boolean): Double
}

/** Der EPC-Text („GiroCode“) für eine Überweisung; null, wenn IBAN oder Betrag fehlen. */
object GiroCode {
    fun inhalt(a: Absender, brutto: BigDecimal, verwendungszweck: String): String? {
        if (a.iban.isBlank() || brutto.signum() <= 0) return null
        // Zeile 10 (strukturierte Referenz) bleibt leer, der Verwendungszweck steht in Zeile 11 (EPC069-12)
        return listOf(
            "BCD", "002", "1", "SCT", a.bic, a.name.take(70), a.iban,
            "EUR" + de.vereinsmanager.core.export.Export.fixed2(brutto), "", "", verwendungszweck.take(140),
        ).joinToString("\n")
    }
}

/**
 * Das Rechnungs-PDF als Zeichenbefehle je Seite (A4 hoch, Millimeter, Ursprung oben links), nach dem Vorbild des Desktops
 * (DIN 5008) – mit Seitenumbruch, den der Desktop nicht hat. Der Seitenumbruch hängt von der Schrift ab; deshalb misst die App.
 */
object RechnungsLayout {
    private const val DUNKEL = 0xFF0F172A.toInt()
    private const val MITTEL = 0xFF334155.toInt()
    private const val GRAU = 0xFF64748B.toInt()
    private const val HELL = 0xFF94A3B8.toInt()
    private const val LINIE = 0xFFE2E8F0.toInt()
    private const val RAHMEN = 0xFFCBD5E1.toInt()
    private const val FLAECHE = 0xFFF8FAFC.toInt()
    private const val FLAECHE2 = 0xFFF1F5F9.toInt()
    private const val SLATE_TEXT = 0xFF475569.toInt()

    private const val L = 20.0
    private const val R = 190.0
    private const val PT = 0.3528 // mm je Punkt

    fun bauen(r: Rechnung, a: Absender, v: Vorlage, m: Mass): List<List<Zeichnung>> = Baum(r, a, v, m).fertig()

    private fun datum(iso: String) = if (iso.isEmpty()) "-" else Zeit.deutsch(iso)

    /** Bricht [text] (mit Zeilenumbrüchen) auf die Breite [breite] mm um. */
    fun umbrechen(text: String, breite: Double, groesse: Double, fett: Boolean, m: Mass): List<String> {
        val ergebnis = ArrayList<String>()
        for (absatz in text.split("\n")) {
            if (absatz.isBlank()) { ergebnis.add(""); continue }
            var zeile = ""
            for (wort in absatz.split(" ").filter { it.isNotEmpty() }) {
                val probe = if (zeile.isEmpty()) wort else "$zeile $wort"
                if (m.breite(probe, groesse, fett) <= breite) { zeile = probe; continue }
                if (zeile.isNotEmpty()) { ergebnis.add(zeile); zeile = "" }
                // ein einzelnes zu langes Wort Buchstabe für Buchstabe brechen
                var rest = wort
                while (rest.isNotEmpty() && m.breite(rest, groesse, fett) > breite) {
                    var n = rest.length
                    while (n > 1 && m.breite(rest.substring(0, n), groesse, fett) > breite) n--
                    ergebnis.add(rest.substring(0, n)); rest = rest.substring(n)
                }
                zeile = rest
            }
            ergebnis.add(zeile)
        }
        return ergebnis
    }

    private class Baum(val r: Rechnung, val a: Absender, val v: Vorlage, val m: Mass) {
        val akzent = v.akzentFarbe
        val seiten = ArrayList<MutableList<Zeichnung>>()
        var z: MutableList<Zeichnung> = ArrayList()
        var y = 0.0
        val standard = !v.hatBriefpapier
        val unten = if (standard) 270.0 else 262.0
        val oben = if (standard) 30.0 else v.randOben.toDouble().coerceAtLeast(20.0)

        fun text(s: String, x: Double, y: Double, groesse: Double, fett: Boolean = false, aus: Zeichnung.Aus = Zeichnung.Aus.LINKS, farbe: Int = DUNKEL) {
            z.add(Zeichnung.Text(s, x, y, groesse, fett, aus, farbe = farbe))
        }
        fun linie(x1: Double, y1: Double, x2: Double, y2: Double, dicke: Double, farbe: Int) { z.add(Zeichnung.Linie(x1, y1, x2, y2, dicke, farbe)) }

        fun neueSeite() {
            z = ArrayList(); seiten.add(z); y = oben
        }

        /** Sorgt dafür, dass noch [hoehe] mm Platz sind, sonst neue Seite. */
        fun platz(hoehe: Double) { if (y + hoehe > unten) neueSeite() }

        fun fertig(): List<List<Zeichnung>> {
            z = ArrayList(); seiten.add(z)
            kopf()
            adresse()
            inhalt()
            val n = seiten.size
            seiten.forEachIndexed { i, s ->
                z = s
                if (standard) fuss()
                if (n > 1) text("Seite ${i + 1} von $n", R, if (standard) 275.0 else 267.0, 7.0, aus = Zeichnung.Aus.RECHTS, farbe = HELL)
            }
            return seiten
        }

        fun kopf() {
            if (!standard) return
            text(a.name, L, 22.0, 16.0, true, farbe = akzent)
            linie(L, 26.0, R, 26.0, 1.2, akzent)
            val teile = listOf(a.register, a.finanzamt, if (a.steuernummer.isNotBlank()) "St.-Nr.: ${a.steuernummer}" else "").filter { it.isNotBlank() }
            if (teile.isNotEmpty()) text(teile.joinToString(" • "), L, 31.0, 8.5, farbe = GRAU)
            if (v.faltmarken) {
                linie(4.0, 148.5, 9.0, 148.5, 0.3, RAHMEN); linie(4.0, 105.0, 8.0, 105.0, 0.3, RAHMEN); linie(4.0, 210.0, 8.0, 210.0, 0.3, RAHMEN)
            }
            val absender = listOf(a.name, a.anschrift, a.email).filter { it.isNotBlank() }.joinToString(" • ")
            text(absender, L, 48.0, 7.5, farbe = GRAU)
            linie(L, 49.5, 105.0, 49.5, 0.2, LINIE)
        }

        var adresseEnde = 0.0
        var metaEnde = 0.0

        fun adresse() {
            var ay = if (standard) 53.0 else maxOf(v.randOben.toDouble(), 52.0)
            if (r.firma.isNotBlank()) { text(r.firma, L, ay, 10.0, true); ay += 4.8 }
            if (r.ansprechpartner.isNotBlank()) { text(r.ansprechpartner, L, ay, 10.0); ay += 4.8 }
            else if (r.name.isNotBlank() && r.name != r.firma) { text(r.name, L, ay, 10.0); ay += 4.8 }
            val ad = r.adresse
            val strasse = "${ad.street} ${ad.houseNumber}".trim()
            if (strasse.isNotEmpty()) { text(strasse, L, ay, 10.0); ay += 4.8 }
            val ort = "${ad.zip} ${ad.city}".trim()
            if (ort.isNotEmpty()) { text(ort, L, ay, 10.0); ay += 4.8 }
            if (ad.country.isNotBlank() && !ad.country.equals("Deutschland", ignoreCase = true)) { text(ad.country.uppercase(), L, ay, 10.0); ay += 4.8 }
            adresseEnde = ay

            var my = if (standard) 52.0 else maxOf(v.randOben.toDouble(), 50.0)
            val meta = listOf(
                Triple("Rechnungsnummer:", r.nummer, true), Triple("Rechnungsdatum:", datum(r.datum), false),
                Triple("Leistungsdatum:", datum(r.leistungsdatum), false), Triple("Fälligkeitsdatum:", datum(r.faellig), true),
            )
            for ((label, wert, fett) in meta) {
                text(label, 135.0, my, 8.5, farbe = GRAU)
                text(wert, R, my, 8.5, fett, Zeichnung.Aus.RECHTS)
                my += 4.8
            }
            metaEnde = my
        }

        fun inhalt() {
            y = maxOf(adresseEnde + 12.0, metaEnde + 10.0, 96.0)
            text("${r.titel.ifBlank { "Rechnung" }} Nr. ${r.nummer}", L, y, 14.0, true)
            if (r.betreff.isNotBlank()) {
                for (zeile in umbrechen("Betreff: ${r.betreff}", 170.0, 10.5, true, m)) { y += 6.0; text(zeile, L, y, 10.5, true, farbe = MITTEL) }
            }
            y += 6.0
            if (r.einleitung.isNotBlank()) {
                val zeilen = umbrechen(r.einleitung, 170.0, 9.5, false, m)
                // Text zeilenweise setzen, damit er über Seiten laufen kann
                for (zeile in zeilen) { platz(4.5); text(zeile, L, y, 9.5, farbe = MITTEL); y += 4.5 }
                y += 4.0
            }
            tabelle()
            summen()
            if (r.kleinunternehmer && v.kleinunternehmerHinweis.isNotBlank()) {
                for (zeile in umbrechen(v.kleinunternehmerHinweis, 170.0, 9.0, false, m)) { platz(4.2); text(zeile, L, y, 9.0, farbe = MITTEL); y += 4.2 }
                y += 3.0
            }
            if (r.schluss.isNotBlank()) {
                for (zeile in umbrechen(r.schluss, 170.0, 9.0, false, m)) { platz(4.2); text(zeile, L, y, 9.0, farbe = MITTEL); y += 4.2 }
                y += 4.0
            }
            zahlungsbox()
        }

        val sp = doubleArrayOf(14.0, 76.0, 26.0, 26.0, 28.0)

        fun tabellenkopf() {
            val h = 8.5 * PT * 1.2 + 5.6
            z.add(Zeichnung.Rechteck(L, y, 170.0, h, fuellung = FLAECHE, rand = false))
            val b = y + 2.8 + 8.5 * PT
            text("Pos.", L + sp[0] / 2, b, 8.5, true, Zeichnung.Aus.MITTE, MITTEL)
            text("Bezeichnung / Beschreibung", L + sp[0] + 2.8, b, 8.5, true, farbe = MITTEL)
            text("Menge", L + sp[0] + sp[1] + sp[2] - 2.8, b, 8.5, true, Zeichnung.Aus.RECHTS, MITTEL)
            text("Einzelpreis", L + sp[0] + sp[1] + sp[2] + sp[3] - 2.8, b, 8.5, true, Zeichnung.Aus.RECHTS, MITTEL)
            text("Gesamtpreis", R - 2.8, b, 8.5, true, Zeichnung.Aus.RECHTS, MITTEL)
            linie(L, y + h, R, y + h, 0.2, LINIE)
            y += h
        }

        fun tabelle() {
            platz(9.2 + 12.0)
            tabellenkopf()
            val zl = 9.0 * PT * 1.2
            for (p in r.positionen) {
                val bez = umbrechen(p.text, sp[1] - 5.6, 9.0, false, m)
                val menge = umbrechen("${RechnungsRegeln.mengeText(p.menge)} ${p.einheit.ifBlank { "Stk." }}", sp[2] - 5.6, 9.0, false, m)
                val zeilen = maxOf(bez.size, menge.size, 1)
                val h = zeilen * zl + 5.6
                if (y + h > unten) { neueSeite(); tabellenkopf() }
                val b = y + 2.8 + 9.0 * PT
                text(p.nummer.toString(), L + sp[0] / 2, b, 9.0, aus = Zeichnung.Aus.MITTE)
                bez.forEachIndexed { i, s -> text(s, L + sp[0] + 2.8, b + i * zl, 9.0) }
                menge.forEachIndexed { i, s -> text(s, L + sp[0] + sp[1] + sp[2] - 2.8, b + i * zl, 9.0, aus = Zeichnung.Aus.RECHTS) }
                text(Geld.euro(p.preis), L + sp[0] + sp[1] + sp[2] + sp[3] - 2.8, b, 9.0, aus = Zeichnung.Aus.RECHTS)
                text(Geld.euro(p.summe), R - 2.8, b, 9.0, true, Zeichnung.Aus.RECHTS)
                linie(L, y + h, R, y + h, 0.2, LINIE)
                y += h
            }
            y += 4.0
        }

        fun summen() {
            val sx = 115.0
            val zeilen = if (r.kleinunternehmer) 0 else 1 + r.ustJeSatz.size
            platz(4.5 + zeilen * 4.5 + 5.0 + 12.0)
            linie(sx, y, R, y, 0.3, LINIE)
            y += 4.5
            if (!r.kleinunternehmer) {
                text("Summe Netto:", sx, y, 9.0, farbe = SLATE_TEXT)
                text(Geld.euro(r.netto), R, y, 9.0, true, Zeichnung.Aus.RECHTS)
                y += 4.5
                for ((satz, betrag) in r.ustJeSatz) {
                    text(if (satz == 0) "zzgl. 0 % USt (steuerbefreit):" else "zzgl. $satz % USt:", sx, y, 9.0, farbe = SLATE_TEXT)
                    text(Geld.euro(betrag), R, y, 9.0, aus = Zeichnung.Aus.RECHTS)
                    y += 4.5
                }
            }
            linie(sx, y, R, y, 0.8, akzent)
            y += 5.0
            z.add(Zeichnung.Rechteck(sx - 2, y - 4, 79.0, 8.0, fuellung = FLAECHE2, rand = false))
            text("Gesamtbetrag (Zahlbetrag):", sx, y + 1.5, 10.5, true, farbe = akzent)
            text(Geld.euro(r.brutto), R, y + 1.5, 10.5, true, Zeichnung.Aus.RECHTS, akzent)
            y += 12.0
        }

        fun zahlungsbox() {
            if (!v.giroCode) return
            val inhalt = GiroCode.inhalt(a, r.brutto, "Rechnung ${r.nummer}") ?: return
            platz(28.0 + 2.0)
            val by = y
            z.add(Zeichnung.Rechteck(L, by, 170.0, 28.0, fuellung = FLAECHE, farbe = RAHMEN))
            z.add(Zeichnung.Qr(inhalt, L + 3.0, by + 2.0, 24.0))
            val tx = 51.0
            text("Zahlungsinformationen & GiroCode (SEPA-Überweisung)", tx, by + 5.5, 8.5, true)
            text("Empfänger: ${a.name}", tx, by + 10.5, 8.0, farbe = SLATE_TEXT)
            text("IBAN: ${a.iban}   BIC: ${a.bic.ifBlank { "-" }}", tx, by + 15.0, 8.0, farbe = SLATE_TEXT)
            text("Verwendungszweck: ${r.nummer}  •  Fällig bis: ${datum(r.faellig)}", tx, by + 19.5, 8.0, true, farbe = akzent)
            text("Mit Ihrer Banking-App scannen, um alle Zahlungsdaten zu übernehmen.", tx, by + 24.0, 7.0, farbe = HELL)
            y += 30.0
        }

        fun fuss() {
            val fy = 278.0
            linie(L, fy, R, fy, 0.3, LINIE)
            fun s(t: String, x: Double, dy: Double) = text(t, x, fy + dy, 7.0, farbe = GRAU)
            s(a.name, L, 4.0); s("1. Vorsitzender: ${a.vorsitzender.ifBlank { "-" }}", L, 7.5); s("Kassier/Schatzmeister: ${a.kassenwart.ifBlank { "-" }}", L, 11.0)
            s("Register: ${a.register.ifBlank { "-" }}", 80.0, 4.0); s("Steuernummer: ${a.steuernummer.ifBlank { "-" }}", 80.0, 7.5); s("Finanzamt: ${a.finanzamt.ifBlank { "-" }}", 80.0, 11.0)
            s("IBAN: ${a.iban.ifBlank { "-" }}", 140.0, 4.0); s("BIC: ${a.bic.ifBlank { "-" }}", 140.0, 7.5); s("Gläubiger-ID: ${a.glaeubigerId.ifBlank { "-" }}", 140.0, 11.0)
        }
    }
}
