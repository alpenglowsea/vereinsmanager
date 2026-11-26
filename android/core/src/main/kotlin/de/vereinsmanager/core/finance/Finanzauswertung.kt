package de.vereinsmanager.core.finance

import de.vereinsmanager.core.export.Csv
import de.vereinsmanager.core.skr42.Skr42
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

/** Filter der Finanz-Auswertung. null heißt „alle“. */
data class AuswFilter(val jahr: String? = null, val sphaere: String? = null, val kontoId: String? = null)

/** Eine Zeile der Auswertung: eine Buchung oder bei aufgeteilten Buchungen ein Teilbetrag. Der Betrag ist immer positiv. */
data class Posten(
    val jahr: Int, val monat: Int, val betrag: BigDecimal, val ausgabe: Boolean, val spende: Boolean,
    val sparte: String, val konto: String,
)

data class MonatsSumme(val name: String, val einnahmen: BigDecimal, val spenden: BigDecimal, val ausgaben: BigDecimal)
data class Kennzahlen(val einnahmen: BigDecimal, val spenden: BigDecimal, val ausgaben: BigDecimal) {
    val saldo get() = einnahmen + spenden - ausgaben
}
data class VerlaufPunkt(val name: String, val stand: BigDecimal)
data class Anteil(val name: String, val wert: BigDecimal)
data class SpartenSumme(val name: String, val einnahmen: BigDecimal, val ausgaben: BigDecimal) {
    val summe get() = einnahmen - ausgaben
}

data class Auswertung(
    val filter: AuswFilter,
    val posten: List<Posten>,
    val kennzahlen: Kennzahlen,
    val monate: List<MonatsSumme>,
    val verlauf: List<VerlaufPunkt>,
    val sparten: List<SpartenSumme>,
    val keineBuchungen: Boolean,
)

/**
 * Die Zahlen hinter den Diagrammen der Finanz-Auswertung (Desktop: `FinanceAnalyticsView`), mit diesen Abweichungen:
 * Einnahme/Ausgabe nach Buchungsart statt nach Vorzeichen, Ausgaben auf dem Spendenkonto zählen als Ausgaben (nicht als Spende),
 * der Bereichsfilter gilt je Teilbetrag, und der Verlauf ist ein echter Kontostand mit Anfangsbestand.
 */
object Finanzauswertung {
    val MONATE = listOf("Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez")
    const val GESAMT = "Gesamtverein"
    private val SPHAEREN = setOf("ideell", "vermoegen", "zweckbetrieb", "wirtschaftlich")

    /**
     * Zeilen der Auswertung nach Filter. Umbuchungen zählen nicht; aufgeteilte Buchungen Teil für Teil.
     * [spendenkreis]: heutige Nummer des Spenden-Nummernkreises (ursprünglich 40400; der Verein kann ihn umnummerieren,
     * `Kontenrahmen.standardNummernkreis`).
     */
    fun posten(buchungen: List<Buchung>, f: AuswFilter, spendenkreis: String = Skr42.SPENDEN_HAUPTKONTO_CODE): List<Posten> {
        fun spende(nummernkreis: String) = nummernkreis.substringBefore(" - ").trim() == spendenkreis
        val ergebnis = ArrayList<Posten>()
        for (b in buchungen) {
            if (b.istUmbuchung) continue
            val jahr = b.datum.take(4).toIntOrNull() ?: continue
            val monat = (b.datum.drop(5).take(2).toIntOrNull() ?: continue) - 1
            if (monat !in 0..11) continue
            if (f.jahr != null && jahr.toString() != f.jahr) continue
            if (f.kontoId != null && b.kontoId != f.kontoId) continue
            val ausgabe = b.istAusgabe
            fun zeile(sph: String, nk: String, sparte: String, konto: String, betrag: BigDecimal) {
                val s = if (sph in SPHAEREN) sph else "ideell"
                if (f.sphaere != null && s != f.sphaere) return
                ergebnis.add(Posten(jahr, monat, betrag.abs(), ausgabe, !ausgabe && spende(nk), sparte, konto.ifBlank { "Ohne Konto" }))
            }
            if (b.aufgeteilt) {
                for (t in b.teile) zeile(
                    t.sphaere.ifEmpty { b.sphaere }, t.nummernkreis.ifEmpty { b.nummernkreis }, t.sparte.ifEmpty { b.sparte },
                    t.konto.ifEmpty { t.kategorie.ifEmpty { b.konto.ifEmpty { b.kategorie } } }, t.betrag,
                )
            } else zeile(b.sphaere, b.nummernkreis, b.sparte, b.konto.ifEmpty { b.kategorie }, b.betrag)
        }
        return ergebnis
    }

    private fun summe(p: List<Posten>, pass: (Posten) -> Boolean) = p.filter(pass).fold(BigDecimal.ZERO) { a, x -> a + x.betrag }

    fun kennzahlen(p: List<Posten>) = Kennzahlen(
        summe(p) { !it.ausgabe && !it.spende }, summe(p) { it.spende }, summe(p) { it.ausgabe },
    )

    /** Zwölf Monate; bei „alle Jahre“ fallen gleiche Monate verschiedener Jahre zusammen (zeigt, in welchen Monaten am meisten passiert). */
    fun monate(p: List<Posten>): List<MonatsSumme> = MONATE.mapIndexed { i, n ->
        val m = p.filter { it.monat == i }
        MonatsSumme(n, summe(m) { !it.ausgabe && !it.spende }, summe(m) { it.spende }, summe(m) { it.ausgabe })
    }

    /** Einnahmen (ohne Spenden) oder Ausgaben nach Konto, größte zuerst; [sparte] null oder [GESAMT] = alle. */
    fun mix(p: List<Posten>, einnahme: Boolean, sparte: String? = null): List<Anteil> {
        val rel = p.filter { (if (einnahme) !it.ausgabe && !it.spende else it.ausgabe) && (sparte == null || sparte == GESAMT || it.sparte == sparte) }
        return rel.groupBy { it.konto }.map { (k, v) -> Anteil(k, v.fold(BigDecimal.ZERO) { a, x -> a + x.betrag }) }
            .sortedWith(compareByDescending<Anteil> { it.wert }.thenBy { it.name })
    }

    /** „Gesamtverein“ und je Sparte Einnahmen (mit Spenden), Ausgaben und Summe. */
    fun sparten(p: List<Posten>, spartenListe: List<String>): List<SpartenSumme> =
        (listOf(GESAMT) + spartenListe.filter { it != GESAMT }).map { n ->
            val m = if (n == GESAMT) p else p.filter { it.sparte == n }
            SpartenSumme(n, summe(m) { !it.ausgabe }, summe(m) { it.ausgabe })
        }

    private fun wirkung(b: Buchung, kontoIds: Set<String>): BigDecimal {
        if (b.istUmbuchung) {
            val betrag = b.betrag.abs()
            var w = BigDecimal.ZERO
            if (b.zielkontoId.isNotEmpty()) {
                if (b.kontoId in kontoIds) w -= betrag
                if (b.zielkontoId in kontoIds) w += betrag
            }
            return w
        }
        return if (b.kontoId in kontoIds) b.betrag else BigDecimal.ZERO
    }

    /**
     * Echter Kontostand am Ende jedes Monats (gewähltes Jahr; im laufenden Jahr nur bis zum aktuellen Monat) bzw. am Ende jedes Jahres
     * („alle Jahre“, mit „Anfang“ = Anfangsbestand). Anfangsbestand der Konten plus alle Buchungen bis dahin, unabhängig vom
     * Bereichsfilter. Bei gewähltem Konto zählt nur dieses.
     */
    fun verlauf(buchungen: List<Buchung>, konten: List<Konto>, f: AuswFilter, heute: LocalDate): List<VerlaufPunkt> {
        val ids = konten.map { it.id }.filter { f.kontoId == null || it == f.kontoId }.toSet()
        val anfang = konten.filter { it.id in ids }.fold(BigDecimal.ZERO) { a, k -> a + k.anfangsbestand }
        val ereignisse = buchungen.map { it.datum to wirkung(it, ids) }.filter { it.second.signum() != 0 }
        fun stand(bis: String) = ereignisse.filter { it.first <= bis }.fold(anfang) { a, e -> a + e.second }
        if (f.jahr != null) {
            val j = f.jahr.toIntOrNull() ?: return emptyList()
            val letzter = if (j == heute.year) heute.monthValue else 12
            if (j > heute.year) return emptyList()
            return (1..letzter).map { m -> VerlaufPunkt(MONATE[m - 1], stand("%04d-%02d-31".format(j, m))) }
        }
        val jahre = buchungen.mapNotNull { it.datum.take(4).toIntOrNull() }
        if (jahre.isEmpty()) return emptyList()
        val punkte = ArrayList<VerlaufPunkt>()
        punkte.add(VerlaufPunkt("Anfang", anfang))
        for (j in jahre.min()..maxOf(jahre.max(), 0)) punkte.add(VerlaufPunkt(j.toString(), stand("%04d-12-31".format(j))))
        return punkte
    }

    fun berechne(
        buchungen: List<Buchung>, konten: List<Konto>, f: AuswFilter, spartenListe: List<String>, heute: LocalDate = LocalDate.now(),
        spendenkreis: String = Skr42.SPENDEN_HAUPTKONTO_CODE,
    ): Auswertung {
        val p = posten(buchungen, f, spendenkreis)
        return Auswertung(f, p, kennzahlen(p), monate(p), verlauf(buchungen, konten, f, heute), sparten(p, spartenListe), p.isEmpty())
    }

    // ---------- Text ----------

    fun filterText(f: AuswFilter, konten: List<Konto>): String = listOf(
        if (f.jahr == null) "Alle Jahre" else "Jahr ${f.jahr}",
        f.sphaere?.let { FinanceLabels.SPHERE_SHORT[it] ?: it } ?: "Alle Bereiche",
        f.kontoId?.let { id -> konten.firstOrNull { it.id == id }?.name ?: id } ?: "Alle Konten",
    ).joinToString(" · ")

    private fun zahl(v: BigDecimal) = v.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',')

    /** Alle Zahlen der Auswertung in einer Datei: Abschnitt; Bezeichnung; Einnahmen; Spenden; Ausgaben; Wert. */
    fun csv(a: Auswertung, konten: List<Konto>, mixEinnahmen: List<Anteil>, mixAusgaben: List<Anteil>): String {
        val z = ArrayList<List<String>>()
        z.add(listOf("Filter", filterText(a.filter, konten), "", "", "", ""))
        val k = a.kennzahlen
        z.add(listOf("Kennzahlen", "Gesamt", zahl(k.einnahmen), zahl(k.spenden), zahl(k.ausgaben), zahl(k.saldo)))
        a.monate.forEach { z.add(listOf(if (a.filter.jahr == null) "Monat (alle Jahre zusammen)" else "Monat", it.name, zahl(it.einnahmen), zahl(it.spenden), zahl(it.ausgaben), zahl(it.einnahmen + it.spenden - it.ausgaben))) }
        a.verlauf.forEach { z.add(listOf("Kontostand (Ende)", it.name, "", "", "", zahl(it.stand))) }
        mixEinnahmen.forEach { z.add(listOf("Einnahmen nach Konto (ohne Spenden)", it.name, zahl(it.wert), "", "", zahl(it.wert))) }
        mixAusgaben.forEach { z.add(listOf("Ausgaben nach Konto", it.name, "", "", zahl(it.wert), zahl(it.wert))) }
        a.sparten.forEach { z.add(listOf("Sparte (Einnahmen mit Spenden)", it.name, zahl(it.einnahmen), "", zahl(it.ausgaben), zahl(it.summe))) }
        return Csv.schreiben(listOf("Abschnitt", "Bezeichnung", "Einnahmen", "Spenden", "Ausgaben", "Wert"), z)
    }

    fun dateiname(a: Auswertung, endung: String) = "Finanzauswertung_${a.filter.jahr ?: "alle-Jahre"}.$endung"
}
