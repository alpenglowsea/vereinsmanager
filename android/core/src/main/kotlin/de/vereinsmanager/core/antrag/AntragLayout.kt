package de.vereinsmanager.core.antrag

import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.invoice.Mass
import de.vereinsmanager.core.invoice.RechnungsLayout
import de.vereinsmanager.core.members.Iban
import de.vereinsmanager.core.members.MemberLabels
import de.vereinsmanager.core.settings.VereinsForm
import java.time.LocalDate

/**
 * Das Antragsformular als Zeichenbefehle für A4 hoch (Millimeter, Ursprung oben links): ausgefüllt und unterschrieben
 * ([bauen] mit einem Antrag) oder leer zum Ausdrucken (ohne Antrag). Nichts wird erfunden: Fehlt dem Verein die Gläubiger-ID,
 * steht dort „nicht hinterlegt“.
 */
object AntragLayout {
    private const val L = 15.0
    private const val B = 180.0
    private const val MARINE = 0xFF1E3A8A.toInt()
    private const val GRAU = 0xFF64748B.toInt()
    private const val HELL = 0xFFE2E8F0.toInt()
    private const val WEISS = 0xFFFFFFFF.toInt()
    private const val RAND = 0xFF94A3B8.toInt()
    private const val UNTEN = 280.0

    private fun deutsch(iso: String): String = AntragRegeln.datum(iso)?.let { "%02d.%02d.%04d".format(it.dayOfMonth, it.monthValue, it.year) } ?: iso

    fun beitragText(v: BeitragsVorgabe): String {
        val betrag = java.text.DecimalFormat("#,##0.00", java.text.DecimalFormatSymbols(java.util.Locale.GERMANY)).format(v.wert)
        return "$betrag € ${AntragEinstellungen.PERIODEN[v.periode] ?: v.periode}"
    }

    private class Baum(val a: Antrag?, val verein: VereinsForm, val e: AntragEinstellungen, val nummer: String, val heute: LocalDate, val m: Mass) {
        val seiten = ArrayList<MutableList<Zeichnung>>()
        var s: MutableList<Zeichnung> = ArrayList<Zeichnung>().also { seiten.add(it) }
        var y = 15.0
        val leer get() = a == null

        fun text(t: String, x: Double, yy: Double, pt: Double, fett: Boolean = false, aus: Zeichnung.Aus = Zeichnung.Aus.LINKS, farbe: Int? = null) {
            if (t.isNotEmpty()) s.add(Zeichnung.Text(t, x, yy, pt, fett, aus, farbe = farbe))
        }
        fun linie(x1: Double, y1: Double, x2: Double, farbe: Int = RAND, d: Double = 0.2) { s.add(Zeichnung.Linie(x1, y1, x2, y1, d, farbe)) }

        fun platz(hoehe: Double) {
            if (y + hoehe <= UNTEN) return
            s = ArrayList<Zeichnung>().also { seiten.add(it) }
            y = 15.0
        }

        fun kopf() {
            s.add(Zeichnung.Rechteck(L, y, B, 19.0, fuellung = MARINE, rand = false))
            text(verein.name.ifBlank { "Verein" }, L + 4, y + 8.0, 14.0, true, farbe = WEISS)
            val anschrift = listOf("${verein.strasse} ${verein.hausnummer}".trim(), "${verein.plz} ${verein.ort}".trim()).filter { it.isNotEmpty() }.joinToString(", ")
            val unter = listOfNotNull(
                anschrift.takeIf { it.isNotEmpty() }, verein.registernummer.takeIf { it.isNotBlank() }?.let { "Register: $it" },
                verein.steuernummer.takeIf { it.isNotBlank() }?.let { "St.-Nr.: $it" },
            ).joinToString("  •  ")
            text(unter, L + 4, y + 14.5, 8.0, farbe = WEISS)
            y += 25.0
            text("AUFNAHMEANTRAG & BEITRITTSERKLÄRUNG", L, y, 13.0, true)
            y += 5.0
            text(
                if (a == null) "Bitte in Druckbuchstaben ausfüllen und unterschreiben." else
                    "Erfasst am ${deutsch(heute.toString())}" + if (nummer.isNotBlank()) "  •  Mitgliedsnummer $nummer" else "",
                L, y, 8.5, farbe = GRAU,
            )
            y += 7.0
        }

        fun abschnitt(titel: String) {
            platz(16.0)
            s.add(Zeichnung.Rechteck(L, y, B, 6.0, fuellung = HELL, rand = false))
            text(titel, L + 2.5, y + 4.2, 9.0, true)
            y += 8.5
        }

        /** Ein Feld mit Beschriftung und Wert (oder leerer Linie); [spalten] teilt die Zeile gleichmäßig. */
        fun zeile(vararg felder: Pair<String, String>) {
            platz(11.0)
            val n = felder.size
            val w = (B - (n - 1) * 4.0) / n
            felder.forEachIndexed { i, (name, wert) ->
                val x = L + i * (w + 4.0)
                text(name, x, y + 2.6, 6.8, farbe = GRAU)
                text(kuerze(wert, w, 9.5), x, y + 7.0, 9.5)
                linie(x, y + 8.2, x + w)
            }
            y += 11.0
        }

        fun kuerze(t: String, w: Double, pt: Double): String {
            if (m.breite(t, pt, false) <= w) return t
            var r = t
            while (r.length > 1 && m.breite("$r…", pt, false) > w) r = r.dropLast(1)
            return "$r…"
        }

        fun kaestchen(x: Double, yy: Double, gesetzt: Boolean) {
            s.add(Zeichnung.Rechteck(x, yy - 3.0, 3.2, 3.2, rand = true, farbe = RAND))
            if (gesetzt) {
                s.add(Zeichnung.Linie(x + 0.5, yy - 2.5, x + 2.7, yy - 0.3, 0.4, 0xFF000000.toInt()))
                s.add(Zeichnung.Linie(x + 2.7, yy - 2.5, x + 0.5, yy - 0.3, 0.4, 0xFF000000.toInt()))
            }
        }

        /** Kästchen mit Text daneben (bricht um). */
        fun kaestchenText(gesetzt: Boolean, t: String, pt: Double = 8.0, fett: Boolean = false, breite: Double = B) {
            val zeilen = RechnungsLayout.umbrechen(t, breite - 6.0, pt, fett, m)
            platz(zeilen.size * 3.6 + 3.0)
            kaestchen(L, y + 2.8, gesetzt)
            zeilen.forEachIndexed { i, z -> text(z, L + 6.0, y + 2.8 + i * 3.6, pt, fett) }
            y += zeilen.size * 3.6 + 2.0
        }

        fun absatz(t: String, pt: Double = 7.8, farbe: Int? = null) {
            val zeilen = RechnungsLayout.umbrechen(t, B, pt, false, m)
            for (z in zeilen) { platz(4.0); text(z, L, y + 3.0, pt, farbe = farbe); y += 3.6 }
            y += 1.5
        }

        /** Auswahl in einer Zeile: Kästchen mit Beschriftung nebeneinander. */
        fun auswahl(titel: String, optionen: List<Pair<String, Boolean>>) {
            platz(9.0)
            text(titel, L, y + 2.6, 6.8, farbe = GRAU)
            var x = L
            for ((name, an) in optionen) {
                kaestchen(x, y + 7.2, an)
                text(name, x + 4.6, y + 7.0, 8.5)
                x += 4.6 + m.breite(name, 8.5, false) + 6.0
            }
            y += 10.0
        }

        fun unterschrift(titel: String, u: Unterschrift?, name: String, datumText: String, x: Double, breite: Double) {
            val h = 20.0
            if (u != null && !u.leer) {
                val bb = minOf(breite - 2.0, (h - 2.0) * u.seitenverhaeltnis)
                val hh = bb / u.seitenverhaeltnis
                val x0 = x + 1.0
                val y0 = y + (h - hh)
                for (st in u.striche) if (st.size >= 2) s.add(Zeichnung.Linienzug(st.map { (px, py) -> (x0 + px * bb) to (y0 + py * hh) }, 0.5, 0xFF0F172A.toInt()))
            }
            linie(x, y + h, x + breite, 0xFF000000.toInt(), 0.3)
            text(titel, x, y + h + 3.4, 7.0, farbe = GRAU)
            if (name.isNotBlank() || datumText.isNotBlank()) text(listOf(name, datumText).filter { it.isNotBlank() }.joinToString(", "), x, y + h + 6.8, 8.0)
        }

        fun fuss() {
            seiten.forEachIndexed { i, p -> p.add(Zeichnung.Text("Seite ${i + 1} von ${seiten.size}", 105.0, 290.0, 7.0, false, Zeichnung.Aus.MITTE, grau = true)) }
        }
    }

    fun bauen(a: Antrag?, verein: VereinsForm, e: AntragEinstellungen, nummer: String, heute: LocalDate, m: Mass): List<List<Zeichnung>> {
        val t = Baum(a, verein, e, nummer, heute, m)
        val v = verein.name.ifBlank { "dem Verein" }
        fun ersetze(s: String) = s.replace("{verein}", v)
        val k = a ?: Antrag()
        val datumHeute = deutsch(heute.toString())
        t.kopf()

        // 1. Person
        t.abschnitt("1. Angaben zur Person")
        if (t.leer) t.auswahl("Anrede / Geschlecht", listOf("männlich" to false, "weiblich" to false, "divers" to false, "keine Angabe" to false))
        else t.zeile("Geschlecht" to (MemberLabels.GENDER[k.geschlecht]?.takeIf { k.geschlecht != "none" } ?: "keine Angabe"))
        t.zeile("Nachname" to k.nachname, "Vorname" to k.vorname)
        t.zeile("Geburtsdatum" to deutsch(k.geburtsdatum), "Staatsangehörigkeit" to if (t.leer) "" else k.staatsangehoerigkeit)
        t.zeile("Straße" to k.strasse, "Hausnummer" to k.hausnummer)
        t.zeile("Postleitzahl" to k.plz, "Wohnort" to k.ort, "Land" to if (t.leer) "" else k.land)
        t.zeile("Telefon / Mobil (freiwillig)" to k.telefon, "E-Mail (freiwillig)" to k.email)

        // 2. Vertreter
        val minder = a != null && AntragRegeln.minderjaehrig(k, heute)
        if (t.leer || minder) {
            t.abschnitt(if (t.leer) "2. Gesetzlicher Vertreter (nur bei Minderjährigen unter 18 Jahren)" else "2. Gesetzlicher Vertreter")
            t.zeile("Name des Vertreters" to k.vertreterName, "Beziehung" to if (t.leer) "" else k.vertreterBeziehung)
            t.zeile("Telefon (freiwillig)" to k.vertreterTelefon, "E-Mail (freiwillig)" to k.vertreterEmail)
        }

        // 3. Mitgliedschaft
        t.abschnitt("3. Gewünschte Mitgliedschaft")
        if (t.leer) {
            t.zeile("Sparte / Abteilung" to "", "Eintrittsdatum" to "")
            for ((art, name) in AntragEinstellungen.ARTEN) {
                t.platz(5.0)
                t.kaestchen(L, t.y + 3.0, false)
                t.text("$name – ${beitragText(e.beitrag(art))}", L + 5.0, t.y + 2.8, 8.5)
                t.y += 5.0
            }
            t.y += 2.0
            t.zeile("Bisheriger Verein (freiwillig)" to "", "Bemerkung (freiwillig)" to "")
        } else {
            t.zeile("Sparte / Abteilung" to k.sparte, "Eintrittsdatum" to deutsch(k.eintritt))
            t.zeile("Mitgliedsart" to (AntragEinstellungen.ARTEN[k.mitgliedsart] ?: k.mitgliedsart), "Mitgliedsbeitrag" to beitragText(e.beitrag(k.mitgliedsart)))
            if (k.vorverein.isNotBlank() || k.notiz.isNotBlank()) t.zeile("Bisheriger Verein" to k.vorverein, "Bemerkung" to k.notiz)
        }

        // 4. Zahlung
        t.abschnitt("4. Zahlungsweise und SEPA-Lastschriftmandat")
        val sepa = t.leer || k.sepa
        if (t.leer) t.auswahl("Zahlungsweg", listOf("SEPA-Lastschrift" to false, "Überweisung / Dauerauftrag" to false))
        else t.zeile("Zahlungsweg" to if (k.sepa) "SEPA-Lastschrift" else "Überweisung (Selbstzahler)")
        if (sepa) {
            t.zeile("Kontoinhaber" to k.kontoinhaber, "IBAN" to Iban.gruppiert(k.iban))
            t.zeile("Kreditinstitut" to k.bankname, "BIC" to k.bic)
            t.zeile(
                "Gläubiger-Identifikationsnummer" to verein.glaeubigerId.ifBlank { "nicht hinterlegt" },
                "Mandatsreferenz" to if (nummer.isNotBlank() && a != null) "MANDAT-$nummer-${heute.year}" else "",
                "Einzug" to if (a != null) "zum ${if (k.faelligkeitstag == 15) 15 else 1}. des Monats" else "",
            )
            t.absatz(ersetze(AntragEinstellungen.SEPA_TEXT), 7.3, GRAU)
        }

        // 5. Erklärungen
        t.abschnitt("5. Erklärungen")
        t.kaestchenText(a != null && k.datenschutz, "Datenschutz: " + ersetze(e.datenschutz), 7.6)
        t.kaestchenText(a != null && k.satzung, "Satzung: " + ersetze(e.satzung), 7.6)
        t.y += 3.0

        // Unterschriften
        val brauchtVertreter = t.leer || minder
        val brauchtInhaber = t.leer || (a != null && AntragRegeln.kontoinhaberMussUnterschreiben(k, heute))
        t.platz(34.0)
        val halb = (B - 8.0) / 2
        val ortDatum = if (a != null) "$datumHeute" else "Ort, Datum"
        t.unterschrift("Unterschrift Antragsteller/in", k.unterschrift, if (a != null) k.name else "", if (a != null) datumHeute else "", L, halb)
        if (brauchtVertreter) t.unterschrift("Unterschrift gesetzlicher Vertreter" + if (t.leer) " (bei unter 18)" else "", k.vertreterUnterschrift, if (a != null) k.vertreterName else "", if (a != null) datumHeute else "", L + halb + 8.0, halb)
        t.y += 30.0
        if (brauchtInhaber && sepa) {
            t.platz(34.0)
            t.unterschrift("Unterschrift Kontoinhaber (SEPA-Mandat)" + if (t.leer) ", falls nicht Antragsteller" else "", k.kontoinhaberUnterschrift, if (a != null) k.kontoinhaber else "", if (a != null) datumHeute else "", L, halb)
            t.y += 30.0
        }
        if (t.leer) t.text(ortDatum, L, t.y, 7.0, farbe = GRAU)
        t.fuss()
        return t.seiten
    }
}
