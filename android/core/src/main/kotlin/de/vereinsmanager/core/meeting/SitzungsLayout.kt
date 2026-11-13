package de.vereinsmanager.core.meeting

import de.vereinsmanager.core.calendar.Kalender
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.invoice.Mass
import de.vereinsmanager.core.invoice.RechnungsLayout
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.settings.VereinsForm

/**
 * Einladung, Protokoll und Registerauszug als Zeichenbefehle für A4 hoch (Millimeter, Ursprung oben links), wie beim Antrag und bei der Rechnung.
 * Mit Briefpapier entfällt der eigene Kopf; der Text beginnt dann unter dem oberen Rand der Vorlage.
 * Nichts wird erfunden: Fehlende Angaben bleiben leer oder werden ausdrücklich als „nicht festgestellt“ bezeichnet.
 */
object SitzungsLayout {
    private const val L = 15.0
    private const val B = 180.0
    private const val UNTEN = 278.0
    private const val MARINE = 0xFF1E3A8A.toInt()
    private const val GRAU = 0xFF64748B.toInt()
    private const val HELL = 0xFFE2E8F0.toInt()
    private const val WEISS = 0xFFFFFFFF.toInt()
    private const val RAND = 0xFF94A3B8.toInt()
    private const val ROT = 0xFFB91C1C.toInt()

    private class Baum(val verein: VereinsForm, val m: Mass, val briefpapier: Boolean, val oben: Double) {
        val seiten = ArrayList<MutableList<Zeichnung>>()
        var s: MutableList<Zeichnung> = ArrayList<Zeichnung>().also { seiten.add(it) }
        var y = oben

        fun text(t: String, x: Double, yy: Double, pt: Double, fett: Boolean = false, aus: Zeichnung.Aus = Zeichnung.Aus.LINKS, farbe: Int? = null) {
            if (t.isNotEmpty()) s.add(Zeichnung.Text(t, x, yy, pt, fett, aus, farbe = farbe))
        }
        fun linie(x1: Double, yy: Double, x2: Double, farbe: Int = RAND, d: Double = 0.2) { s.add(Zeichnung.Linie(x1, yy, x2, yy, d, farbe)) }

        fun platz(hoehe: Double) {
            if (y + hoehe <= UNTEN) return
            s = ArrayList<Zeichnung>().also { seiten.add(it) }
            y = oben
        }

        fun kopf(titel: String, unter: String?) {
            if (!briefpapier) {
                s.add(Zeichnung.Rechteck(L, y, B, 19.0, fuellung = MARINE, rand = false))
                text(verein.name.ifBlank { "Verein" }, L + 4, y + 8.0, 14.0, true, farbe = WEISS)
                val anschrift = listOf("${verein.strasse} ${verein.hausnummer}".trim(), "${verein.plz} ${verein.ort}".trim()).filter { it.isNotEmpty() }.joinToString(", ")
                text(anschrift, L + 4, y + 14.5, 8.0, farbe = WEISS)
                y += 25.0
            }
            text(titel, L, y, 14.0, true)
            y += 5.5
            if (unter != null) { text(unter, L, y, 8.5, farbe = GRAU); y += 6.0 } else y += 2.0
        }

        fun abschnitt(titel: String) {
            platz(16.0)
            s.add(Zeichnung.Rechteck(L, y, B, 6.0, fuellung = HELL, rand = false))
            text(titel, L + 2.5, y + 4.2, 9.0, true)
            y += 9.0
        }

        fun absatz(t: String, pt: Double = 9.0, fett: Boolean = false, farbe: Int? = null, x: Double = L, breite: Double = B, abstand: Double = 1.5) {
            val hoehe = pt * 0.45
            for (z in RechnungsLayout.umbrechen(t, breite, pt, fett, m)) {
                platz(hoehe + 1.0); text(z, x, y + hoehe, pt, fett, farbe = farbe); y += hoehe + 0.9
            }
            y += abstand
        }

        /** Beschriftung links, Wert rechts daneben (bricht um). */
        fun feld(label: String, wert: String) {
            if (wert.isBlank()) return
            val zeilen = RechnungsLayout.umbrechen(wert, B - 42.0, 9.0, false, m)
            platz(zeilen.size * 4.2 + 1.0)
            text(label, L, y + 3.2, 8.0, farbe = GRAU)
            zeilen.forEachIndexed { i, z -> text(z, L + 42.0, y + 3.2 + i * 4.2, 9.5) }
            y += zeilen.size * 4.2 + 1.2
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
            val unterzeile = listOf(name, datumText).filter { it.isNotBlank() }.joinToString(", ")
            if (unterzeile.isNotEmpty()) text(unterzeile, x, y + h + 7.0, 8.5)
        }

        fun fuss() {
            seiten.forEachIndexed { i, p -> p.add(Zeichnung.Text("Seite ${i + 1} von ${seiten.size}", 105.0, 290.0, 7.0, false, Zeichnung.Aus.MITTE, grau = true)) }
        }
    }

    private fun baum(verein: VereinsForm, m: Mass, briefpapier: Boolean, randOben: Double) =
        Baum(verein, m, briefpapier, if (briefpapier) randOben.coerceIn(20.0, 100.0) else 15.0)

    private fun datumLang(iso: String): String = Sitzungen.datum(iso)?.let { "${Kalender.wochentagLang(it)}, ${Zeit.deutsch(iso)}" } ?: iso

    private fun uhr(s: Sitzung): String = if (s.beginn.isBlank()) "" else "${s.beginn} Uhr" + if (s.ende.isNotBlank()) " bis ca. ${s.ende} Uhr" else ""

    /** Die Einladung mit Tagesordnung (§ 32 BGB). Voraussetzung: [Sitzungen.einladungFehlt] ist leer. */
    fun einladung(s: Sitzung, verein: VereinsForm, m: Mass, briefpapier: Boolean = false, randOben: Double = 45.0): List<List<Zeichnung>> {
        val t = baum(verein, m, briefpapier, randOben)
        t.kopf("EINLADUNG", Sitzungen.artName(s.art) + if (s.einladungsDatum.isNotBlank()) "  •  Einladung vom ${Zeit.deutsch(s.einladungsDatum)}" else "")
        t.absatz(s.titel, 12.0, fett = true, abstand = 3.0)
        t.absatz("Liebe Mitglieder,", 9.5)
        t.absatz("hiermit laden wir Sie herzlich zu folgender Veranstaltung ein:", 9.5, abstand = 3.0)
        t.feld("Wann", datumLang(s.datum) + if (uhr(s).isNotEmpty()) ", ${uhr(s)}" else "")
        t.feld("Wo", s.ort)
        t.y += 3.0
        t.abschnitt("Tagesordnung")
        s.tops.forEach { top ->
            val r = RechnungsLayout.umbrechen(top.titel + if (top.berichterstatter.isNotBlank()) " (${top.berichterstatter})" else "", B - 20.0, 9.5, false, m)
            t.platz(r.size * 4.4 + 2.0)
            t.text(top.nummer, L, t.y + 3.4, 9.5, true)
            r.forEachIndexed { i, z -> t.text(z, L + 20.0, t.y + 3.4 + i * 4.4, 9.5) }
            t.y += r.size * 4.4 + 1.6
        }
        t.y += 3.0
        t.absatz("Bei der Einberufung ist der Gegenstand der Beschlussfassung zu bezeichnen (§ 32 Abs. 1 Satz 2 BGB); die Form und die Frist der Einladung richten sich nach der Satzung.", 8.0, farbe = GRAU)
        t.y += 4.0
        t.platz(30.0)
        t.absatz("Mit freundlichen Grüßen", 9.5, abstand = 8.0)
        if (s.leitung.isNotBlank()) t.absatz(s.leitung, 9.5, abstand = 0.5)
        if (verein.name.isNotBlank()) t.absatz(verein.name, 9.5)
        t.fuss()
        return t.seiten
    }

    private fun sigZeile(t: Baum, s: Sitzung, mitUnterschriften: Boolean) {
        t.platz(38.0)
        val halb = (B - 8.0) / 2
        fun datumDe(z: String) = if (z.length >= 10) Zeit.deutsch(z.take(10)) else ""
        val sl = s.signaturen.firstOrNull { it.istLeitung }
        val ss = s.signaturen.firstOrNull { it.istSchrift }
        t.unterschrift(
            "Versammlungsleitung", if (mitUnterschriften) sl?.unterschrift else null, s.leitung,
            if (mitUnterschriften && sl != null) datumDe(sl.zeit) else "", L, halb,
        )
        t.unterschrift(
            "Protokollführung", if (mitUnterschriften) ss?.unterschrift else null, s.schrift,
            if (mitUnterschriften && ss != null) datumDe(ss.zeit) else "", L + halb + 8.0, halb,
        )
        t.y += 30.0
    }

    /** Das Protokoll; [mitUnterschriften]: gespeicherte Unterschriften einzeichnen, sonst leere Zeilen zum Unterschreiben auf Papier. */
    fun protokoll(s: Sitzung, verein: VereinsForm, m: Mass, mitUnterschriften: Boolean, briefpapier: Boolean = false, randOben: Double = 45.0): List<List<Zeichnung>> {
        val t = baum(verein, m, briefpapier, randOben)
        t.kopf(if (s.istVersammlung) "NIEDERSCHRIFT" else "PROTOKOLL", s.titel)
        if (s.status != "approved") t.absatz("Entwurf – noch nicht genehmigt (Status: ${Sitzungen.statusName(s.status)})", 8.5, fett = true, farbe = ROT)
        if (s.signaturen.any { Sitzungen.pruefung(s, it) == Sitzungen.Pruefung.GEAENDERT }) {
            t.absatz("Achtung: Der Protokolltext wurde nach einer Unterschrift geändert.", 8.5, fett = true, farbe = ROT)
        }

        t.abschnitt("Rahmendaten")
        t.feld("Art", Sitzungen.artName(s.art))
        t.feld("Datum", datumLang(s.datum))
        t.feld("Zeit", uhr(s))
        t.feld("Ort", s.ort)
        t.feld("Versammlungsleitung", s.leitung)
        t.feld("Protokollführung", s.schrift)
        val einlDetails = listOfNotNull(s.einladungsDatum.takeIf { it.isNotBlank() }?.let { "am ${Zeit.deutsch(it)}" }, s.einladungsWeg.takeIf { it.isNotBlank() })
        t.feld(
            "Einladung",
            if (s.einladungOk) "form- und fristgerecht" + (if (einlDetails.isEmpty()) "" else " (" + einlDetails.joinToString(", ") + ")")
            else "Die ordnungsgemäße Einladung ist nicht bestätigt.",
        )
        t.feld(
            "Beschlussfähigkeit",
            if (s.beschlussfaehig) "festgestellt" + (s.stimmberechtigteWirksam?.let { " ($it stimmberechtigte Anwesende)" } ?: "") else "nicht festgestellt",
        )
        t.y += 2.0

        val anwesend = s.teilnehmer.filter { it.anwesend }
        val fehlend = s.teilnehmer.filter { !it.anwesend }
        if (s.teilnehmer.isNotEmpty()) {
            t.abschnitt("Teilnehmer (${anwesend.size} anwesend, davon ${anwesend.count { it.stimmrecht }} stimmberechtigt)")
            anwesend.forEach { a ->
                val zusatz = listOfNotNull(a.rolle.takeIf { it.isNotBlank() }, if (a.stimmrecht) null else "ohne Stimmrecht")
                t.absatz("• ${a.name}" + (if (zusatz.isEmpty()) "" else " (" + zusatz.joinToString(", ") + ")"), 9.0, abstand = 0.2)
            }
            if (fehlend.isNotEmpty()) t.absatz("Nicht anwesend: " + fehlend.joinToString(", ") { it.name }, 8.5, farbe = GRAU)
            t.y += 2.0
        }

        s.tops.forEach { top ->
            t.abschnitt("${top.nummer}  ${top.titel}")
            if (top.berichterstatter.isNotBlank()) t.absatz("Berichterstatter: ${top.berichterstatter}", 8.5, farbe = GRAU)
            if (top.notizen.isNotBlank()) t.absatz(top.notizen, 9.0)
            top.beschluesse.forEach { b ->
                t.platz(26.0)
                t.absatz("Beschluss: ${b.titel}", 9.5, fett = true, abstand = 0.5)
                t.absatz("Antrag: ${b.antrag}", 9.0, x = L + 4.0, breite = B - 4.0, abstand = 0.5)
                if (b.antragsteller.isNotBlank()) t.absatz("Antragsteller: ${b.antragsteller}", 8.5, x = L + 4.0, breite = B - 4.0, farbe = GRAU, abstand = 0.3)
                t.absatz(
                    "Abstimmung: Ja ${b.ja}, Nein ${b.nein}, Enthaltungen ${b.enthaltung} – Ergebnis: ${Sitzungen.ERGEBNISSE[b.ergebnis] ?: b.ergebnis}",
                    9.0, fett = true, x = L + 4.0, breite = B - 4.0, abstand = 0.5,
                )
                val kennz = listOfNotNull(if (b.steuer) "steuerlich relevant (Finanzamt)" else null, if (b.register) "Vereinsregister" else null)
                if (kennz.isNotEmpty()) t.absatz("Kennzeichen: ${kennz.joinToString(", ")}", 8.5, x = L + 4.0, breite = B - 4.0, farbe = GRAU, abstand = 0.3)
                if (b.verantwortlich.isNotBlank() || b.frist.isNotBlank()) {
                    t.absatz("Umsetzung: ${b.verantwortlich}${if (b.frist.isNotBlank()) (if (b.verantwortlich.isNotBlank()) " bis " else "bis ") + Zeit.deutsch(b.frist) else ""}", 8.5, x = L + 4.0, breite = B - 4.0, abstand = 0.3)
                }
                if (b.notiz.isNotBlank()) t.absatz(b.notiz, 8.5, x = L + 4.0, breite = B - 4.0, farbe = GRAU, abstand = 0.3)
                t.y += 2.0
            }
        }
        if (s.notizen.isNotBlank()) { t.abschnitt("Allgemeine Anmerkungen"); t.absatz(s.notizen, 9.0) }

        t.y += 6.0
        sigZeile(t, s, mitUnterschriften)
        t.fuss()
        return t.seiten
    }

    /** Der Auszug mit den angenommenen, für das Vereinsregister gekennzeichneten Beschlüssen. Voraussetzung: [Sitzungen.auszugFehlt] ist null. */
    fun auszug(s: Sitzung, verein: VereinsForm, m: Mass, mitUnterschriften: Boolean, briefpapier: Boolean = false, randOben: Double = 45.0): List<List<Zeichnung>> {
        val t = baum(verein, m, briefpapier, randOben)
        t.kopf("AUSZUG AUS DEM PROTOKOLL", s.titel)
        t.absatz("Hiermit wird bescheinigt, dass am ${Zeit.deutsch(s.datum)}${if (s.ort.isNotBlank()) " in ${s.ort}" else ""} die ${Sitzungen.artName(s.art)} stattgefunden hat.", 9.5, abstand = 3.0)
        if (s.einladungOk) {
            t.absatz("Die Einberufung erfolgte ordnungsgemäß, form- und fristgerecht" + (if (s.einladungsWeg.isNotBlank()) " (${s.einladungsWeg})" else "") + ".", 9.5)
        }
        t.absatz(
            "Die Beschlussfähigkeit wurde festgestellt" + (s.stimmberechtigteWirksam?.let { "; es waren $it stimmberechtigte Mitglieder anwesend" } ?: "") + ".", 9.5,
        )
        t.absatz("Versammlungsleiter war ${s.leitung.ifBlank { "–" }}, Protokollführer war ${s.schrift.ifBlank { "–" }}.", 9.5, abstand = 3.0)
        t.absatz("Es wurden folgende für das Vereinsregister gekennzeichnete Beschlüsse gefasst:", 9.5, fett = true, abstand = 3.0)
        Sitzungen.registerBeschluesse(s).forEach { (top, b) ->
            t.platz(24.0)
            t.absatz("${top.nummer}: ${b.titel}", 9.5, fett = true, abstand = 0.5)
            t.absatz(b.antrag, 9.0, x = L + 4.0, breite = B - 4.0, abstand = 0.5)
            t.absatz("Abstimmung: Ja ${b.ja}, Nein ${b.nein}, Enthaltungen ${b.enthaltung} – angenommen", 9.0, fett = true, x = L + 4.0, breite = B - 4.0, abstand = 3.0)
        }
        t.y += 6.0
        sigZeile(t, s, mitUnterschriften)
        t.fuss()
        return t.seiten
    }
}
