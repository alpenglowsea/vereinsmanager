package de.vereinsmanager.core.finance

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.skr42.Skr42
import de.vereinsmanager.core.skr42.Skr42Main
import de.vereinsmanager.core.skr42.Skr42Sub
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.ZonedDateTime

/** Eine Zeile einer Splittbuchung im Formular. Der Betrag steht als Text, so wie er getippt wird. */
data class TeilForm(
    val id: String,
    val betrag: String = "",
    val text: String = "",
    val sphaere: String = "ideell",
    val sparte: String = "",
    /** Wie am Desktop gespeichert: "40400 - Name" */
    val nummernkreis: String = "",
    /** Beschriftung des Kontos, z. B. "68100 - Nebenkosten …" */
    val konto: String = "",
    val skrKonto: String = "",
    val ust: Int = 0,
)

/** Das Buchungsformular. Der Betrag steht als Text und ist immer ohne Vorzeichen gemeint. */
data class BuchungForm(
    val id: String,
    val datum: String,
    val betrag: String = "",
    /** "income", "expense" oder "transfer" */
    val art: String = "expense",
    val kontoId: String = "",
    val zielkontoId: String = "",
    val belegNummer: String = "",
    val text: String = "",
    val partner: String = "",
    val sphaere: String = "ideell",
    val sparte: String = "",
    val nummernkreis: String = "",
    val konto: String = "",
    val skrKonto: String = "",
    val ust: Int = 0,
    val notiz: String = "",
    val aufgeteilt: Boolean = false,
    val teile: List<TeilForm> = emptyList(),
)

object BuchungRegeln {
    /** Die drei Umsatzsteuersätze des Formulars. */
    val UST_SAETZE = listOf(0, 7, 19)

    /** "BE-2026-014" -> 14, sonst null. */
    private fun laufNummer(beleg: String, jahr: Int): Int? {
        val m = Regex("""^BE-$jahr-(\d+)$""").matchEntire(beleg.trim()) ?: return null
        return m.groupValues[1].toIntOrNull()
    }

    /**
     * Nächste freie Belegnummer "BE-JJJJ-NNN": höchste vorhandene Nummer des Jahres plus eins.
     * Bewusste Abweichung vom Desktop, der "Anzahl aller Buchungen + 1" nimmt und damit
     * Nummern doppelt vergibt, sobald eine Buchung gelöscht wurde.
     */
    fun naechsteBelegNummer(vorhandene: List<String>, jahr: Int): String {
        val hoechste = vorhandene.mapNotNull { laufNummer(it, jahr) }.maxOrNull() ?: 0
        return "BE-$jahr-${(hoechste + 1).toString().padStart(3, '0')}"
    }

    /**
     * Liest einen deutsch getippten Betrag: "12,5", "1.234,50", "12.50", "1.234", "12 €".
     * Ein einzelner Punkt mit genau drei Ziffern danach gilt als Tausenderpunkt ("1.234" = 1234).
     * Gibt null zurück, wenn es keine Zahl ist. Mehr als zwei Nachkommastellen werden kaufmännisch gerundet.
     */
    fun parseBetrag(text: String): BigDecimal? {
        var t = text.trim().replace("€", "").replace(" ", "").replace(" ", "")
        if (t.isEmpty()) return null
        t = if (t.contains(',')) t.replace(".", "").replace(',', '.')
        else if (Regex("""^\d{1,3}(\.\d{3})+$""").matches(t)) t.replace(".", "")
        else t
        if (!Regex("""^\d+(\.\d+)?$""").matches(t)) return null
        return t.toBigDecimalOrNull()?.setScale(2, RoundingMode.HALF_UP)
    }

    /** "1234,5" für das Eingabefeld: Komma, keine Tausenderpunkte, ohne überflüssige Nullen. */
    fun betragText(v: BigDecimal): String {
        val a = v.abs().stripTrailingZeros()
        val s = (if (a.scale() < 0) a.setScale(0) else a).toPlainString()
        return s.replace('.', ',')
    }

    fun nummernkreisText(m: Skr42Main) = "${m.code} - ${m.name}"

    private fun auswahl(art: String, skr: List<Skr42Main>): Skr42Main? =
        Skr42.mains(if (art == "transfer") null else art, skr).firstOrNull() ?: skr.firstOrNull()

    /** Ein Formular mit den Vorgaben des Desktops: Ausgabe, ideeller Bereich, erstes Konto der Art. */
    fun neu(
        id: String, datum: String, belegNummer: String, kontoId: String,
        skr: List<Skr42Main> = Skr42.standard,
    ): BuchungForm {
        val main = auswahl("expense", skr)
        val sub = main?.subCategories?.firstOrNull()
        return BuchungForm(
            id = id, datum = datum, belegNummer = belegNummer, kontoId = kontoId,
            nummernkreis = main?.let(::nummernkreisText) ?: "", konto = sub?.label ?: "",
            skrKonto = sub?.code ?: "", ust = sub?.vatRateDefault ?: 0,
        )
    }

    /** Formular zu einer vorhandenen Buchung. */
    fun von(b: Buchung): BuchungForm = BuchungForm(
        id = b.id, datum = b.datum, betrag = betragText(b.betrag), art = b.art.ifEmpty { if (b.betrag.signum() < 0) "expense" else "income" },
        kontoId = b.kontoId, zielkontoId = b.zielkontoId, belegNummer = b.belegNummer, text = b.text, partner = b.partner,
        sphaere = b.sphaere.ifEmpty { "ideell" }, sparte = b.sparte, nummernkreis = b.nummernkreis,
        konto = b.konto.ifEmpty { b.kategorie }, skrKonto = b.skrKonto, ust = b.ust, notiz = b.notiz,
        aufgeteilt = b.aufgeteilt,
        teile = b.teile.map {
            TeilForm(
                id = it.id, betrag = betragText(it.betrag), text = it.text, sphaere = it.sphaere.ifEmpty { "ideell" },
                sparte = it.sparte, nummernkreis = it.nummernkreis, konto = it.konto.ifEmpty { it.kategorie },
                skrKonto = it.skrKonto, ust = it.ust,
            )
        },
    )

    /** Der Nummernkreis zu einem gespeicherten Text (auch Altdaten, die nur ein Konto kennen). */
    fun hauptkonto(nummernkreis: String, konto: String, skr: List<Skr42Main>): Skr42Main? =
        // Erst der genaue Treffer "Nummer - Name" bzw. die Kennung: Nummern wie 69000 kommen in mehreren
        // Nummernkreisen vor, die allgemeine Suche nähme dort sonst den ersten.
        skr.firstOrNull { it.id == nummernkreis || nummernkreisText(it) == nummernkreis }
            ?: (if (nummernkreis.isNotEmpty()) Skr42.findMain(nummernkreis, skr) else null)
            ?: (if (konto.isNotEmpty()) Skr42.findMainForSub(konto, skr) else null)

    /** Konten (Unterkonten) des gewählten Nummernkreises. */
    fun unterkonten(nummernkreis: String, konto: String, skr: List<Skr42Main>): List<Skr42Sub> =
        hauptkonto(nummernkreis, konto, skr)?.subCategories ?: emptyList()

    /** Nach Wechsel des Nummernkreises: erstes Konto, dessen Nummer und Umsatzsteuer-Vorgabe. */
    fun mitNummernkreis(f: BuchungForm, main: Skr42Main): BuchungForm {
        val sub = main.subCategories.firstOrNull()
        return f.copy(nummernkreis = nummernkreisText(main), konto = sub?.label ?: "", skrKonto = sub?.code ?: "", ust = sub?.vatRateDefault ?: 0)
    }

    /** Nach Wechsel des Kontos: Nummer und Umsatzsteuer-Vorgabe des Kontos. */
    fun mitKonto(f: BuchungForm, sub: Skr42Sub) = f.copy(konto = sub.label, skrKonto = sub.code, ust = sub.vatRateDefault)

    fun teilMitNummernkreis(t: TeilForm, main: Skr42Main): TeilForm {
        val sub = main.subCategories.firstOrNull()
        return t.copy(nummernkreis = nummernkreisText(main), konto = sub?.label ?: "", skrKonto = sub?.code ?: "", ust = sub?.vatRateDefault ?: 0)
    }

    fun teilMitKonto(t: TeilForm, sub: Skr42Sub) = t.copy(konto = sub.label, skrKonto = sub.code, ust = sub.vatRateDefault)

    /**
     * Wechsel der Buchungsart. Passt der gewählte Nummernkreis nicht zur neuen Art (Einnahme/Ausgabe),
     * springt das Formular auf den ersten passenden. (Der Desktop lässt ihn stehen; hier ist das
     * Formular dadurch nie in einem Zustand, den man erst mühsam korrigieren muss.)
     */
    fun mitArt(f: BuchungForm, art: String, skr: List<Skr42Main> = Skr42.standard): BuchungForm {
        if (art == f.art) return f
        val neu = f.copy(art = art)
        if (art == "transfer") return neu
        val aktuell = hauptkonto(f.nummernkreis, f.konto, skr)
        if (aktuell != null && aktuell.type == art) return neu
        val main = Skr42.mains(art, skr).firstOrNull() ?: return neu
        return mitNummernkreis(neu, main)
    }

    /** Schaltet auf Splittbuchung: zwei Zeilen, die erste trägt den bisherigen Betrag und die Kontoangaben. */
    fun aufteilen(f: BuchungForm, skr: List<Skr42Main> = Skr42.standard, nummer: String = Zeit.zufall(6)): BuchungForm {
        if (f.teile.size >= 2) return f.copy(aufgeteilt = true)
        val erste = TeilForm(
            id = "split-$nummer-1", betrag = f.betrag, text = f.text, sphaere = f.sphaere, sparte = f.sparte,
            nummernkreis = f.nummernkreis, konto = f.konto, skrKonto = f.skrKonto, ust = f.ust,
        )
        return f.copy(aufgeteilt = true, teile = listOf(erste, neuerTeil("split-$nummer-2", f.sphaere, skr)))
    }

    /** Eine weitere Zeile; Vorgabe wie am Desktop: Konto 68100 (Bankspesen), Betrag leer. */
    fun neuerTeil(id: String, sphaere: String, skr: List<Skr42Main> = Skr42.standard): TeilForm {
        val main = Skr42.findMainForSub("68100", skr)
        val sub = main?.subCategories?.firstOrNull { it.code == "68100" }
        return TeilForm(
            id = id, sphaere = sphaere, nummernkreis = main?.let(::nummernkreisText) ?: "",
            konto = sub?.label ?: "", skrKonto = sub?.code ?: "", ust = sub?.vatRateDefault ?: 0,
        )
    }

    /**
     * Setzt den Betrag einer Teilbuchung. Bei genau zwei Teilen füllt die Änderung des ersten Teilbetrags den
     * zweiten mit dem Rest (Gesamtbetrag minus erster Teil) vor – aber nur, solange der zweite leer ist oder noch
     * den zuletzt vorgeschlagenen Rest enthält. Hat der Anwender den zweiten selbst geändert, bleibt er unangetastet.
     */
    fun teilBetragSetzen(f: BuchungForm, index: Int, text: String): BuchungForm {
        val teile = f.teile.mapIndexed { i, t -> if (i == index) t.copy(betrag = text) else t }
        val ohne = f.copy(teile = teile)
        if (index != 0 || f.teile.size != 2) return ohne
        val gesamt = parseBetrag(f.betrag) ?: return ohne
        val neu1 = parseBetrag(text) ?: return ohne
        val rest = gesamt - neu1
        if (rest.signum() <= 0) return ohne
        val zweiter = f.teile[1].betrag
        val alt1 = parseBetrag(f.teile[0].betrag)
        val vorschlagAlt = alt1?.let { gesamt - it }
        val unberuehrt = zweiter.isBlank() || (vorschlagAlt != null && parseBetrag(zweiter)?.compareTo(vorschlagAlt) == 0)
        return if (unberuehrt) ohne.copy(teile = teile.mapIndexed { i, t -> if (i == 1) t.copy(betrag = betragText(rest)) else t }) else ohne
    }

    /** Summe der Teilbeträge; ungültige Zeilen zählen 0. */
    fun teilSumme(f: BuchungForm): BigDecimal =
        f.teile.fold(BigDecimal.ZERO) { a, t -> a + (parseBetrag(t.betrag) ?: BigDecimal.ZERO) }

    /** Alle Fehler des Formulars, Schlüssel = Feldname. Leer = in Ordnung. Meldungen wie am Desktop. */
    fun pruefen(f: BuchungForm, konten: List<Konto>): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.datum.isBlank() || runCatching { LocalDate.parse(f.datum) }.isFailure) e["datum"] = "Bitte ein Datum wählen."
        if (konten.isEmpty()) e["konto"] = "Bitte zuerst ein Konto anlegen."
        else if (konten.none { it.id == f.kontoId }) e["konto"] = "Bitte ein Konto wählen."
        if (f.text.isBlank()) e["text"] = "Buchungstext ist erforderlich."
        if (f.partner.isBlank() && f.art != "transfer") e["partner"] = "Zahlungspartner ist erforderlich."
        val betrag = parseBetrag(f.betrag)
        if (f.betrag.isNotBlank() && betrag == null) e["betrag"] = "Bitte einen Betrag wie 12,50 eingeben."
        else if (betrag == null || betrag.signum() <= 0) e["betrag"] = "Betrag muss größer als 0 sein."
        if (f.belegNummer.isBlank()) e["belegNummer"] = "Belegnummer ist erforderlich."
        if (f.art == "transfer") {
            if (f.zielkontoId.isEmpty() || konten.none { it.id == f.zielkontoId }) e["zielkonto"] = "Bitte ein Zielkonto wählen."
            else if (f.zielkontoId == f.kontoId) e["zielkonto"] = "Zielkonto muss sich vom Quellkonto unterscheiden."
        } else if (f.aufgeteilt) {
            if (f.teile.size < 2) e["teile"] = "Eine Splittbuchung muss aus mindestens 2 Teilbuchungen bestehen."
            val summen = f.teile.map { parseBetrag(it.betrag) }
            if (summen.any { it == null || it.signum() <= 0 }) {
                e["teile"] = "Jede Teilbuchung muss einen Betrag größer als 0,00 € haben."
            } else if (betrag != null) {
                val diff = betrag - teilSumme(f)
                if (diff.signum() != 0) {
                    e["teile"] = "Die Summe der Teilbeträge (${Geld.euro(teilSumme(f))}) stimmt nicht mit der Buchungssumme " +
                        "(${Geld.euro(betrag)}) überein. Differenz: ${Geld.euro(diff)}."
                }
            }
        }
        return e
    }
}

/** Baut aus dem Formular das Dokument für den Speicher; unbekannte Felder des bisherigen Dokuments bleiben erhalten. */
object BuchungDokument {
    private fun s(v: String) = JsonPrimitive(v)

    /** Ganze Beträge ohne Nachkommastellen, sonst als Dezimalzahl – wie JavaScript sie schreibt. */
    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    private fun teil(t: TeilForm, base: JsonObject?): JsonObject {
        val betrag = BuchungRegeln.parseBetrag(t.betrag) ?: BigDecimal.ZERO
        val felder = mutableMapOf<String, JsonElement>(
            "id" to s(t.id), "amount" to zahl(betrag.abs()), "bookingText" to s(t.text), "sphere" to s(t.sphaere),
            "mainCategory" to s(t.nummernkreis), "subCategory" to s(t.konto), "category" to s(t.konto),
            "skrAccount" to s(t.skrKonto), "vatRate" to JsonPrimitive(t.ust),
        )
        val m = LinkedHashMap<String, JsonElement>((base ?: JsonObject(emptyMap())))
        m.putAll(felder)
        if (t.sparte.isEmpty()) m.remove("department") else m["department"] = s(t.sparte)
        return JsonObject(m)
    }

    /**
     * Ausgaben werden negativ gespeichert, Einnahmen und Umbuchungen positiv. Der angehängte Beleg
     * ("receipt") wird hier nie angefasst. Bei einer Splittbuchung übernimmt die Buchung die Angaben
     * der ersten Zeile, wie am Desktop.
     */
    fun build(f: BuchungForm, base: JsonObject?, now: ZonedDateTime = ZonedDateTime.now()): JsonObject {
        val stamp = Zeit.stempel(now)
        val gesamt = (BuchungRegeln.parseBetrag(f.betrag) ?: BigDecimal.ZERO).abs()
        val vorzeichen = if (f.art == "expense") gesamt.negate() else gesamt
        val split = f.aufgeteilt && f.art != "transfer" && f.teile.isNotEmpty()
        val erste = if (split) f.teile.first() else null
        val m = LinkedHashMap<String, JsonElement>(base ?: JsonObject(emptyMap()))
        val altTeile = (base?.get("splits") as? JsonArray)?.mapNotNull { it as? JsonObject }?.associateBy { (it["id"] as? JsonPrimitive)?.content }
        m.putAll(
            mapOf(
                "id" to s(f.id), "date" to s(f.datum), "amount" to zahl(vorzeichen), "type" to s(f.art),
                "accountId" to s(f.kontoId), "targetAccountId" to s(if (f.art == "transfer") f.zielkontoId else ""),
                "documentNumber" to s(f.belegNummer.trim()), "bookingText" to s(f.text.trim()), "partner" to s(f.partner.trim()),
                "sphere" to s(erste?.sphaere ?: f.sphaere),
                "mainCategory" to s(erste?.nummernkreis ?: f.nummernkreis),
                "subCategory" to s(erste?.konto ?: f.konto), "category" to s(erste?.konto ?: f.konto),
                "skrAccount" to s(erste?.skrKonto ?: f.skrKonto), "vatRate" to JsonPrimitive(erste?.ust ?: f.ust),
                "notes" to s(f.notiz), "isSplit" to JsonPrimitive(split),
                "createdAt" to (base?.get("createdAt") ?: s(stamp)), "updatedAt" to s(stamp),
            ),
        )
        val sparte = erste?.sparte ?: f.sparte
        if (sparte.isEmpty()) m.remove("department") else m["department"] = s(sparte)
        if (split) m["splits"] = JsonArray(f.teile.map { teil(it, altTeile?.get(it.id)) }) else m.remove("splits")
        return JsonObject(m)
    }
}

object BuchungStore {
    /** Legt eine Buchung an oder ändert sie. Gibt das gespeicherte Dokument zurück. */
    fun speichern(store: DocumentStore, form: BuchungForm, now: ZonedDateTime = ZonedDateTime.now()): JsonObject =
        store.transaction {
            val neu = BuchungDokument.build(form, store.get(Finance.BUCHUNGEN, form.id), now)
            store.put(Finance.BUCHUNGEN, form.id, neu)
            neu
        }

    fun loeschen(store: DocumentStore, id: String) = store.transaction { store.delete(Finance.BUCHUNGEN, id) }
}
