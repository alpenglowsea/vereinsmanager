package de.vereinsmanager.core.finance

import de.vereinsmanager.core.export.Csv
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.export.PdfTabelle
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.skr42.Skr42
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

/** Ein Konto (Unterkategorie) in der Einnahmen-Überschuss-Rechnung. */
data class EuerKonto(val name: String, val skrKonto: String, val einnahmen: BigDecimal, val ausgaben: BigDecimal, val anzahl: Int)

/** Ein Nummernkreis (Hauptkategorie) mit seinen Konten. */
data class EuerNummernkreis(
    val code: String, val name: String, val einnahmen: BigDecimal, val ausgaben: BigDecimal, val anzahl: Int, val konten: List<EuerKonto>,
) {
    val ergebnis get() = einnahmen - ausgaben
}

/** Einer der vier steuerlichen Bereiche. */
data class EuerSphaere(
    val id: String, val name: String, val einnahmen: BigDecimal, val ausgaben: BigDecimal, val anzahl: Int, val nummernkreise: List<EuerNummernkreis>,
) {
    val ergebnis get() = einnahmen - ausgaben
}

/** Stand der 45.000-€-Grenze für den wirtschaftlichen Geschäftsbetrieb (§ 64 Abs. 3 AO, Einnahmen einschließlich Umsatzsteuer). */
data class GrenzeStand(val einnahmen: BigDecimal, val grenze: BigDecimal) {
    /** Die Grenze gilt als überschritten erst bei MEHR als 45.000,00 €; genau 45.000,00 € sind noch frei. */
    val ueberschritten get() = einnahmen > grenze
    /** Anteil in Prozent, unbegrenzt (kann über 100 liegen). */
    val prozent: Double get() = einnahmen.multiply(BigDecimal(100)).divide(grenze, 4, RoundingMode.HALF_UP).toDouble()
    /** Ab 75 % bis einschließlich der Grenze (exakt gerechnet, nicht über den gerundeten Prozentwert). */
    val warnung get() = !ueberschritten && einnahmen.multiply(BigDecimal(4)) >= grenze.multiply(BigDecimal(3))
    /** Noch frei bis zur Grenze, nie negativ. */
    val puffer: BigDecimal get() = (grenze - einnahmen).max(BigDecimal.ZERO)
}

/** Die Rechnung für ein Geschäftsjahr (oder alle Buchungen, wenn [jahr] null ist). */
data class Euer(val jahr: String?, val sphaeren: List<EuerSphaere>) {
    val einnahmen: BigDecimal get() = sphaeren.fold(BigDecimal.ZERO) { a, s -> a + s.einnahmen }
    val ausgaben: BigDecimal get() = sphaeren.fold(BigDecimal.ZERO) { a, s -> a + s.ausgaben }
    val ergebnis: BigDecimal get() = einnahmen - ausgaben
    val anzahl: Int get() = sphaeren.sumOf { it.anzahl }

    /** Nur für ein einzelnes Jahr sinnvoll: die Grenze gilt je Kalenderjahr. */
    val grenze: GrenzeStand? get() = if (jahr == null) null else
        GrenzeStand(sphaeren.first { it.id == "wirtschaftlich" }.einnahmen, Berichte.WGB_GRENZE)
}

object Berichte {
    val WGB_GRENZE: BigDecimal = BigDecimal("45000.00")
    /** Geschützte Leerzeichen: der Zeilenumbruch der PDF-Tabelle würde gewöhnliche führende Leerzeichen entfernen. */
    private const val EINRUECKEN_1 = "\u00A0\u00A0\u00A0\u00A0"
    private const val EINRUECKEN_2 = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"
    private val SPHAEREN = listOf("ideell", "vermoegen", "zweckbetrieb", "wirtschaftlich")

    private class SubAcc(var skr: String) { var ein = BigDecimal.ZERO; var aus = BigDecimal.ZERO; var n = 0 }
    private class MainAcc(val code: String, val name: String) { var ein = BigDecimal.ZERO; var aus = BigDecimal.ZERO; var n = 0; val subs = LinkedHashMap<String, SubAcc>() }
    private class SphAcc { var ein = BigDecimal.ZERO; var aus = BigDecimal.ZERO; var n = 0; val mains = LinkedHashMap<String, MainAcc>() }

    /**
     * Die Rechnung wie auf dem Bildschirm des Desktops: Umbuchungen zählen nicht; aufgeteilte Buchungen werden Teil für Teil
     * mit der jeweiligen Sphäre und Kategorie gezählt; Ausgabe ist, was negativ oder als Ausgabe gebucht ist. Eine unbekannte
     * oder leere Sphäre zählt zum ideellen Bereich.
     */
    fun euer(buchungen: List<Buchung>, jahr: String?): Euer {
        val acc = SPHAEREN.associateWith { SphAcc() }
        fun zeile(sphRoh: String, haupt: String, unter: String, skr: String, betrag: BigDecimal, ausgabe: Boolean) {
            val sph = if (sphRoh in acc) sphRoh else "ideell"
            val konto = unter.ifBlank { "Sonstige Buchung" }
            val teile = haupt.split(" - ")
            val key: String; val code: String; val name: String
            if (haupt.isNotBlank()) {
                key = haupt; code = teile[0]; name = if (teile.size > 1) teile.drop(1).joinToString(" - ") else haupt
            } else {
                val gefunden = Skr42.findMainForSub(konto)
                if (gefunden != null) { key = "${gefunden.code} - ${gefunden.name}"; code = gefunden.code; name = gefunden.name }
                else { key = "Allgemein ($sph)"; code = ""; name = "Allgemeine Erlöse/Kosten $sph" }
            }
            val s = acc.getValue(sph)
            val m = s.mains.getOrPut(key) { MainAcc(code, name) }
            val k = m.subs.getOrPut(konto) { SubAcc(skr) }
            if (k.skr.isEmpty()) k.skr = skr
            s.n++; m.n++; k.n++
            if (ausgabe) { s.aus += betrag; m.aus += betrag; k.aus += betrag } else { s.ein += betrag; m.ein += betrag; k.ein += betrag }
        }
        for (b in buchungen) {
            if (b.istUmbuchung) continue
            if (jahr != null && !b.datum.startsWith(jahr)) continue
            val ausgabe = b.istAusgabe
            if (b.aufgeteilt) {
                for (t in b.teile) {
                    zeile(
                        t.sphaere.ifEmpty { b.sphaere }, t.nummernkreis.ifEmpty { b.nummernkreis },
                        t.konto.ifEmpty { t.kategorie.ifEmpty { b.konto.ifEmpty { b.kategorie } } },
                        t.skrKonto.ifEmpty { b.skrKonto }, t.betrag.abs(), ausgabe,
                    )
                }
            } else {
                zeile(b.sphaere, b.nummernkreis, b.konto.ifEmpty { b.kategorie }, b.skrKonto, b.betrag.abs(), ausgabe)
            }
        }
        val sphaeren = SPHAEREN.map { id ->
            val s = acc.getValue(id)
            EuerSphaere(
                id, FinanceLabels.SPHERE.getValue(id), s.ein, s.aus, s.n,
                s.mains.values.sortedWith(compareBy({ it.code.ifEmpty { "~" } }, { it.name })).map { m ->
                    EuerNummernkreis(
                        m.code, m.name, m.ein, m.aus, m.n,
                        m.subs.entries.sortedWith(compareBy({ it.value.skr.ifEmpty { "~" } }, { it.key })).map { (name, k) ->
                            EuerKonto(name, k.skr, k.ein, k.aus, k.n)
                        },
                    )
                },
            )
        }
        return Euer(jahr, sphaeren)
    }

    // ---------- PDF der EÜR ----------

    fun euerPdf(e: Euer, verein: String, heute: LocalDate): PdfTabelle {
        val zeilen = ArrayList<List<String>>()
        val fett = HashSet<Int>()
        fun summe(a: BigDecimal, b: BigDecimal) = listOf(Geld.euro(a), Geld.euro(b), Geld.euroMitVorzeichen(a - b))
        for (s in e.sphaeren) {
            fett.add(zeilen.size)
            zeilen.add(listOf(s.name) + summe(s.einnahmen, s.ausgaben))
            for (m in s.nummernkreise) {
                zeilen.add(listOf(EINRUECKEN_1 + listOf(m.code, m.name).filter { it.isNotEmpty() }.joinToString(" ")) + summe(m.einnahmen, m.ausgaben))
                for (k in m.konten) {
                    zeilen.add(listOf(EINRUECKEN_2 + listOf(k.skrKonto, k.name).filter { it.isNotEmpty() }.joinToString(" ")) + summe(k.einnahmen, k.ausgaben))
                }
            }
        }
        fett.add(zeilen.size)
        zeilen.add(listOf("Gesamtergebnis") + summe(e.einnahmen, e.ausgaben))
        val g = e.grenze
        val hinweis = if (g == null) "Die 45.000-€-Grenze gilt je Kalenderjahr und wird nur bei Wahl eines Jahres ausgewiesen."
        else "Wirtschaftlicher Geschäftsbetrieb ${e.jahr}: Einnahmen ${Geld.euro(g.einnahmen)} von ${Geld.euro(g.grenze)} (§ 64 Abs. 3 AO, einschl. USt)" +
            if (g.ueberschritten) " – Grenze überschritten." else "."
        return PdfTabelle(
            verein, "Einnahmen-Überschuss-Rechnung (EÜR) – " + (e.jahr ?: "alle Jahre"),
            "Stand: ${Zeit.deutsch(heute.toString())} | ${e.anzahl} Buchungszeilen",
            listOf("Bereich / Nummernkreis / Konto", "Einnahmen", "Ausgaben", "Ergebnis"),
            listOf(134, 45, 45, 45),
            listOf('l', 'r', 'r', 'r'),
            zeilen,
            "$hinweis Keine Steuerberatung.",
            fett,
        )
    }

    // ---------- Buchungs-Export ----------

    private val CSV_KOPF = listOf(
        "Buchungs-ID", "Datum", "Belegnummer", "Teil", "Buchungstext", "Zahlungspartner", "Konto", "Zielkonto", "Steuerliche Sphäre",
        "Sparte", "Kategorie", "SKR-Konto", "Betrag (EUR)", "Typ", "USt-Satz (%)", "Beleg vorhanden", "Notizen",
    )

    private fun typText(b: Buchung) = when { b.istUmbuchung -> "Umbuchung"; b.istAusgabe -> "Ausgabe"; else -> "Einnahme" }

    /** Vorzeichen eines Teilbetrags: wie die Buchung, zu der er gehört. */
    private fun vorzeichen(b: Buchung, betrag: BigDecimal) = if (b.istAusgabe) betrag.abs().negate() else betrag.abs()

    /**
     * Eine Zeile je Buchung, bei aufgeteilten Buchungen eine Zeile je Teil (Spalte „Teil“, z. B. 2/3), damit die Summen stimmen.
     * Beträge mit Punkt und zwei Stellen wie in der Desktop-Fassung.
     */
    fun journalCsv(buchungen: List<Buchung>, konten: List<Konto>): String {
        val kontoName = konten.associate { it.id to it.name }
        fun konto(id: String) = kontoName[id] ?: id
        val zeilen = ArrayList<List<String>>()
        for (b in buchungen) {
            val beleg = if (b.beleg != null) "Ja" else "Nein"
            val ziel = if (b.istUmbuchung && b.zielkontoId.isNotEmpty()) konto(b.zielkontoId) else ""
            if (b.aufgeteilt) {
                b.teile.forEachIndexed { i, t ->
                    zeilen.add(listOf(
                        b.id, b.datum, b.belegNummer, "${i + 1}/${b.teile.size}", t.text.ifEmpty { b.text }, b.partner, konto(b.kontoId), ziel,
                        FinanceLabels.SPHERE[t.sphaere.ifEmpty { b.sphaere }] ?: t.sphaere.ifEmpty { b.sphaere }, t.sparte.ifEmpty { b.sparte },
                        t.kategorie.ifEmpty { b.kategorie }, t.skrKonto.ifEmpty { b.skrKonto }, Export.fixed2(vorzeichen(b, t.betrag)),
                        typText(b), t.ust.toString(), beleg, Csv.einzeilig(b.notiz),
                    ))
                }
            } else {
                zeilen.add(listOf(
                    b.id, b.datum, b.belegNummer, "", b.text, b.partner, konto(b.kontoId), ziel,
                    FinanceLabels.SPHERE[b.sphaere] ?: b.sphaere, b.sparte, b.kategorie, b.skrKonto, Export.fixed2(b.betrag),
                    typText(b), b.ust.toString(), beleg, Csv.einzeilig(b.notiz),
                ))
            }
        }
        return Csv.schreiben(CSV_KOPF, zeilen)
    }

    /**
     * Journal als PDF, eine Zeile je Buchung. Am Ende stehen Einnahmen, Ausgaben und Saldo; Umbuchungen werden gelistet,
     * aber nicht mitgerechnet (anders als am Desktop, wo sie in der Summe landen).
     */
    fun journalPdf(buchungen: List<Buchung>, konten: List<Konto>, verein: String, heute: LocalDate, titel: String = "Buchungsjournal"): PdfTabelle {
        val kontoName = konten.associate { it.id to it.name }
        fun konto(id: String) = kontoName[id] ?: id
        val zeilen = ArrayList<List<String>>()
        for (b in buchungen) {
            val kontoText = if (b.istUmbuchung) "${konto(b.kontoId)} → ${konto(b.zielkontoId)}" else konto(b.kontoId)
            val sph = when {
                b.istUmbuchung -> "Umbuchung"
                b.aufgeteilt -> "mehrere"
                else -> FinanceLabels.SPHERE_SHORT[b.sphaere] ?: b.sphaere.ifEmpty { "–" }
            }
            val kat = if (b.aufgeteilt) "aufgeteilt (${b.teile.size} Teile)" else b.kategorie.ifEmpty { "–" }
            val betrag = if (b.istUmbuchung) Geld.euro(b.betrag.abs()) else Geld.euroMitVorzeichen(vorzeichen(b, b.betrag))
            zeilen.add(listOf(
                Export.datum(b.datum).ifEmpty { "–" }, b.belegNummer.ifEmpty { "–" }, b.partner.ifEmpty { "–" }, b.text.ifEmpty { "–" },
                kontoText, sph, kat, if (b.beleg != null) "Ja" else "Nein", betrag,
            ))
        }
        val s = Finance.summen(buchungen)
        val umb = buchungen.count { it.istUmbuchung }
        val fett = HashSet<Int>()
        fun summenZeile(text: String, wert: String) { fett.add(zeilen.size); zeilen.add(listOf("", "", "", text, "", "", "", "", wert)) }
        summenZeile("Einnahmen", Geld.euro(s.einnahmen))
        summenZeile("Ausgaben", Geld.euro(s.ausgaben))
        summenZeile("Saldo", Geld.euroMitVorzeichen(s.saldo))
        return PdfTabelle(
            verein, titel, "Stand: ${Zeit.deutsch(heute.toString())} | ${buchungen.size} Buchungen",
            listOf("Datum", "Beleg-Nr.", "Partner", "Buchungstext", "Konto", "Sphäre", "Kategorie", "Beleg", "Betrag"),
            listOf(20, 28, 36, 59, 26, 30, 36, 8, 26),
            listOf('l', 'l', 'l', 'l', 'l', 'l', 'l', 'c', 'r'),
            zeilen,
            "$verein - Buchungsjournal" + if (umb > 0) " | $umb Umbuchungen sind in den Summen nicht enthalten" else "",
            fett,
        )
    }
}
