package de.vereinsmanager.core.importe

import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.BuchungStore
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.skr42.Skr42
import de.vereinsmanager.core.skr42.Skr42Main
import de.vereinsmanager.core.skr42.Skr42Sub
import de.vereinsmanager.core.store.DocumentStore
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZonedDateTime

/** Felder einer Buchung, denen eine Spalte der Datei zugeordnet werden kann. */
enum class BuchungFeld(val label: String) {
    DATUM("Buchungsdatum"), BELEGNUMMER("Belegnummer"), PARTNER("Zahlungspartner"), TEXT("Buchungstext / Verwendungszweck"),
    BETRAG("Betrag"), ART("Art (Einnahme/Ausgabe, S/H)"), SPHAERE("Steuerlicher Bereich"), SKR("Konto (SKR-Nummer oder Name)"),
    FINANZKONTO("Finanzkonto (Name oder IBAN)"), UST("Umsatzsteuersatz"), NOTIZ("Notiz"), IBAN("IBAN des Partners"),
}

/** Woher die Datei stammt: Bankauszug (Bereich wird aus Stichwörtern geschätzt, Belege „BK-…“) oder eine Tabelle (Belege „BE-…“). */
enum class ImportQuelle(val text: String, val praefix: String) {
    BANK("Bankauszug", "BK"), TABELLE("Tabelle (Excel, Google Sheets, CSV)", "BE"),
}

/** Eine Zeile der Vorschau. [form] ist bearbeitbar; eine leere Belegnummer heißt: wird beim Import fortlaufend vergeben. */
data class BuchungsZeile(
    val index: Int,
    val form: BuchungForm,
    /** Hinweise aus der Umwandlung (z. B. „Betrag 1.250 als 1250 gelesen“). */
    val hinweise: List<String> = emptyList(),
    /** Beschreibung der vorhandenen Buchung, die dieser Zeile gleicht, sonst null. */
    val duplikat: String? = null,
    /** Das Konto wurde aus einer früheren Buchung mit demselben Partner vorgeschlagen. */
    val kontoVorschlag: Boolean = false,
)

data class BuchungImportBericht(val angelegt: Int, val ersteNummer: String, val letzteNummer: String)

object BuchungImport {
    val REGELN: List<Triple<BuchungFeld, List<String>, List<String>>> = listOf(
        Triple(BuchungFeld.DATUM, listOf("buchungstag", "buchungsdatum", "datum", "belegdatum", "valutadatum", "valuta", "wertstellung", "date", "tag"), listOf("buchungstag", "datum", "valuta")),
        Triple(BuchungFeld.BELEGNUMMER, listOf("belegnummer", "belegnr", "beleg", "rechnungsnummer", "documentnumber", "nummer", "nr"), listOf("belegnummer", "belegnr", "rechnungsnummer")),
        // „Name Zahlungsbeteiligter“: neueres Bank-CSV-Format, wie am Desktop seit P17 (R1, 22.11.2026)
        Triple(BuchungFeld.PARTNER, listOf("zahlungspartner", "partner", "beguenstigterzahlungspflichtiger", "namezahlungsbeteiligter", "beguenstigter", "empfaenger", "auftraggeber", "absender", "name"), listOf("beguenstigter", "zahlungspflichtiger", "zahlungsbeteiligter", "empfaenger", "zahlungspartner", "auftraggeber", "absender")),
        Triple(BuchungFeld.TEXT, listOf("verwendungszweck", "buchungstext", "buchungstext", "bookingtext", "beschreibung", "text", "zweck", "vorgang"), listOf("verwendungszweck", "buchungstext", "beschreibung")),
        Triple(BuchungFeld.BETRAG, listOf("betrag", "betrageur", "umsatz", "amount", "summe", "wert"), listOf("betrag", "umsatz", "amount")),
        Triple(BuchungFeld.ART, listOf("art", "buchungsart", "typ", "type", "einnahmeausgabe", "sollhaben", "sh"), emptyList()),
        Triple(BuchungFeld.SPHAERE, listOf("sphaere", "steuerlichersphaere", "steuerlicherbereich", "steuerbereich", "bereich", "sphere"), listOf("sphaere", "sphere")),
        Triple(BuchungFeld.SKR, listOf("skrkonto", "skr42", "skr", "sachkonto", "buchungskonto", "kategorie", "konto"), listOf("skr", "sachkonto")),
        Triple(BuchungFeld.FINANZKONTO, listOf("finanzkonto", "bankkonto", "kasse", "kontoname"), listOf("finanzkonto", "bankkonto")),
        Triple(BuchungFeld.UST, listOf("ust", "mwst", "umsatzsteuer", "mehrwertsteuer", "steuersatz", "ustsatz", "vat"), listOf("umsatzsteuer", "mwst", "ustsatz")),
        Triple(BuchungFeld.NOTIZ, listOf("notiz", "notizen", "bemerkung", "anmerkung", "kommentar", "notes"), listOf("notiz", "bemerkung", "kommentar")),
        Triple(BuchungFeld.IBAN, listOf("iban", "kontonummeriban", "kontonummer", "ibanzahlungsbeteiligter"), listOf("iban")),
    )

    fun erkenneSpalten(headers: List<String>): Map<BuchungFeld, String> = Tabellen.zuordnen(headers, REGELN)

    /** Stichwörter wie am Desktop (nur der Bereich; ein Konto lässt sich daraus nicht verlässlich ableiten). */
    fun schaetzeSphaere(text: String): String? {
        val l = text.lowercase()
        fun hat(vararg w: String) = w.any { l.contains(it) }
        return when {
            hat("beitrag", "aufnahme", "mitglied", "dtaus", "sepa-el", "spende", "zuwendung", "schenkung", "zuschuss", "foerderung", "förderung",
                "gemeinde", "landessportbund", "lsb", "arag", "versicherung", "verband", "sportbund", "porto", "telekom", "vodafone", "software", "hosting",
                "gebuehr", "gebühr", "kontofuehrung", "kontoführung", "entgeltabrechnung") -> "ideell"
            hat("zinsen", "zinsgutschrift", "kupon", "dividende", "pacht", "mieteinnahme", "vereinsheim miete") -> "vermoegen"
            hat("uebungsleiter", "übungsleiter", "trainer", "aufwandsentschaedigung", "aufwandsentschädigung", "ehrenamt", "turnier", "startgeld",
                "meldegeld", "eintritt", "schiedsrichter", "kampfgericht", "spielleiter", "sport", "baelle", "bälle", "trikot", "netz", "turnmatten",
                "halle", "platzmiete", "flutlicht") -> "zweckbetrieb"
            hat("sponsoring", "werbung", "bande", "anzeige", "plakat", "metro", "rewe", "edeka", "getraenke", "getränke", "brauerei", "kiosk", "wurst",
                "fleisch", "gema", "festzelt", "veranstaltungstechnik") -> "wirtschaftlich"
            else -> null
        }
    }

    private fun sphaereAusText(t: String): String? {
        val n = Tabellen.norm(t)
        return when {
            n.isEmpty() -> null
            n.startsWith("ideell") || n == "1" || n.startsWith("1ideell") -> "ideell"
            n.contains("vermoegen") || n == "2" -> "vermoegen"
            n.contains("zweckbetrieb") || n == "3" -> "zweckbetrieb"
            n.contains("wirtschaft") || n == "4" -> "wirtschaftlich"
            else -> null
        }
    }

    /** Richtung aus der Art-Spalte: "income", "expense", "transfer" oder null. */
    private fun artAusText(t: String): String? = when (Tabellen.norm(t)) {
        "einnahme", "einnahmen", "income", "haben", "h", "gutschrift", "zahlungseingang" -> "income"
        "ausgabe", "ausgaben", "expense", "soll", "s", "belastung", "lastschrift", "zahlungsausgang" -> "expense"
        "umbuchung", "transfer" -> "transfer"
        else -> null
    }

    /** Findet ein Konto des Kontenrahmens: nach Nummer (auch "40000 - Name") oder genauem Namen. */
    fun findeKonto(text: String, art: String, skr: List<Skr42Main>): Pair<Skr42Main, Skr42Sub>? {
        val t = text.trim()
        if (t.isEmpty()) return null
        val code = Regex("""^(\d{4,6})\b""").find(t)?.groupValues?.get(1)
        val lower = t.lowercase()
        val treffer = skr.flatMap { m -> m.subCategories.map { m to it } }.filter { (_, s) ->
            (code != null && s.code == code) || (code == null && (s.name.lowercase() == lower || s.label.lowercase() == lower))
        }
        return treffer.firstOrNull { it.first.type == art } ?: treffer.firstOrNull()
    }

    private fun mitKonto(f: BuchungForm, main: Skr42Main, sub: Skr42Sub, ust: Int? = null) =
        f.copy(nummernkreis = BuchungRegeln.nummernkreisText(main), konto = sub.label, skrKonto = sub.code, ust = ust ?: sub.vatRateDefault)

    private fun normText(s: String) = s.trim().lowercase().replace(Regex("\\s+"), " ")

    /** Beschreibt eine vorhandene Buchung, die dieser Zeile gleicht (gleiches Datum, gleicher Betrag, gleiche Belegnummer, Partner oder Text). */
    fun findeDuplikat(f: BuchungForm, vorhandene: List<Buchung>): String? {
        val betrag = BuchungRegeln.parseBetrag(f.betrag) ?: return null
        val signiert = if (f.art == "expense") betrag.negate() else betrag
        val partner = normText(f.partner); val text = normText(f.text); val nr = f.belegNummer.trim()
        val b = vorhandene.firstOrNull { v ->
            v.datum == f.datum && !v.istUmbuchung && f.art != "transfer" && v.betrag.compareTo(signiert) == 0 &&
                ((nr.isNotEmpty() && v.belegNummer == nr) ||
                    (partner.isNotEmpty() && normText(v.partner) == partner) ||
                    (text.isNotEmpty() && normText(v.text) == text))
        } ?: return null
        return "${b.belegNummer.ifEmpty { "ohne Nr." }}: ${b.partner.ifEmpty { b.text }}"
    }

    /** Fehler, die den Import dieser Zeile verhindern (Meldungen so, dass man weiß, was zu tun ist). */
    fun fehler(f: BuchungForm, konten: List<Konto>): List<String> {
        val e = ArrayList<String>()
        if (runCatching { LocalDate.parse(f.datum) }.isFailure) e.add(if (f.datum.isBlank()) "Datum fehlt – bitte eintragen." else "Datum „${f.datum}“ nicht lesbar – bitte korrigieren.")
        val b = BuchungRegeln.parseBetrag(f.betrag)
        if (b == null) e.add(if (f.betrag.isBlank()) "Betrag fehlt – bitte eintragen." else "Betrag „${f.betrag}“ nicht lesbar – bitte korrigieren.")
        else if (b.signum() <= 0) e.add("Betrag ist 0 – bitte korrigieren.")
        if (konten.none { it.id == f.kontoId }) e.add("Bitte ein Finanzkonto wählen.")
        if (f.text.isBlank()) e.add("Buchungstext fehlt – bitte eintragen.")
        if (f.art == "transfer") {
            if (f.zielkontoId.isEmpty() || konten.none { it.id == f.zielkontoId }) e.add("Umbuchung: bitte das Zielkonto wählen.")
            else if (f.zielkontoId == f.kontoId) e.add("Umbuchung: Zielkonto muss ein anderes Konto sein.")
        }
        return e
    }

    /**
     * Wandelt die Zeilen der Datei in Vorschau-Zeilen um. Nichts wird weggelassen: Was nicht lesbar ist, bleibt als Zeile
     * mit Fehler stehen und lässt sich in der Vorschau korrigieren.
     */
    fun umwandeln(
        rows: List<Map<String, String>>, mapping: Map<BuchungFeld, String>, quelle: ImportQuelle,
        konten: List<Konto>, standardKontoId: String, standardSphaere: String,
        vorhandene: List<Buchung>, skr: List<Skr42Main> = Skr42.standard,
    ): List<BuchungsZeile> {
        fun wert(r: Map<String, String>, f: BuchungFeld) = mapping[f]?.let { r[it] }?.trim().orEmpty()
        val vorhandeneNummern = vorhandene.map { it.belegNummer.trim() }.filter { it.isNotEmpty() }.toHashSet()
        val gesehene = HashSet<String>()
        // Vorschlag aus der Historie: letzter Eintrag je Partner und Richtung mit gesetztem Konto
        val historie = HashMap<String, Buchung>()
        vorhandene.filter { it.skrKonto.isNotEmpty() && it.partner.isNotBlank() && !it.istUmbuchung && !it.aufgeteilt }
            .sortedBy { it.datum }.forEach { historie[normText(it.partner) + "|" + (if (it.istAusgabe) "e" else "a")] = it }

        return rows.mapIndexed { i, r ->
            val hinweise = ArrayList<String>()
            val datumRoh = wert(r, BuchungFeld.DATUM)
            val datum = Tabellen.datum(datumRoh) ?: datumRoh

            val betragRoh = wert(r, BuchungFeld.BETRAG)
            val zahl = Tabellen.betrag(betragRoh)
            if (zahl?.mehrdeutig == true) hinweise.add("Betrag „$betragRoh“ als ${BuchungRegeln.betragText(zahl.wert)} gelesen (Tausenderpunkt). Bitte prüfen.")
            val artText = wert(r, BuchungFeld.ART)
            val artSpalte = artAusText(artText)
            if (artText.isNotEmpty() && artSpalte == null) hinweise.add("Art „$artText“ nicht erkannt – Vorzeichen des Betrags entscheidet.")
            val art = artSpalte ?: if (zahl != null && zahl.wert.signum() < 0) "expense" else "income"

            val partnerRoh = wert(r, BuchungFeld.PARTNER)
            val textRoh = wert(r, BuchungFeld.TEXT)
            val text = textRoh.ifEmpty { partnerRoh }
            val partner = partnerRoh.ifEmpty { if (art == "transfer") "" else "Unbekannt" }
            if (partnerRoh.isEmpty() && art != "transfer") hinweise.add("Zahlungspartner fehlt – „Unbekannt“ eingetragen.")

            val konto = konten.firstOrNull { k ->
                val v = wert(r, BuchungFeld.FINANZKONTO)
                v.isNotEmpty() && (Tabellen.norm(k.name) == Tabellen.norm(v) || (k.iban.isNotEmpty() && Tabellen.norm(k.iban) == Tabellen.norm(v)))
            }?.id ?: standardKontoId

            var sphaere = sphaereAusText(wert(r, BuchungFeld.SPHAERE))
            var form = BuchungForm(
                id = "", datum = datum, betrag = if (zahl != null) BuchungRegeln.betragText(zahl.wert) else betragRoh, art = art,
                kontoId = konto, text = text, partner = partner,
            )

            // Konto aus der Datei, sonst Vorschlag aus früheren Buchungen desselben Partners
            var vorschlag = false
            val ustSpalte = wert(r, BuchungFeld.UST).replace("%", "").replace(",", ".").trim().toBigDecimalOrNull()?.toInt()
            if (art != "transfer") {
                val gefunden = findeKonto(wert(r, BuchungFeld.SKR), art, skr)
                if (gefunden != null) form = mitKonto(form, gefunden.first, gefunden.second, ustSpalte)
                else {
                    val alt = historie[normText(partnerRoh) + "|" + (if (art == "expense") "e" else "a")]
                    if (alt != null && partnerRoh.isNotEmpty()) {
                        form = form.copy(nummernkreis = alt.nummernkreis, konto = alt.konto.ifEmpty { alt.kategorie }, skrKonto = alt.skrKonto, ust = ustSpalte ?: alt.ust, sparte = alt.sparte)
                        if (sphaere == null) sphaere = alt.sphaere.ifEmpty { null }
                        vorschlag = true
                    } else if (ustSpalte != null) form = form.copy(ust = ustSpalte)
                }
            }
            if (sphaere == null && quelle == ImportQuelle.BANK) sphaere = schaetzeSphaere("$partnerRoh $textRoh")
            form = form.copy(sphaere = sphaere ?: standardSphaere)

            // Belegnummer: aus der Datei, wenn frei; sonst leer (= wird beim Import vergeben)
            val nr = wert(r, BuchungFeld.BELEGNUMMER)
            var beleg = ""
            if (nr.isNotEmpty()) {
                if (nr in vorhandeneNummern || !gesehene.add(nr)) hinweise.add("Belegnummer $nr gibt es schon – es wird eine neue vergeben.")
                else beleg = nr
            }
            val iban = wert(r, BuchungFeld.IBAN)
            val notiz = listOf(wert(r, BuchungFeld.NOTIZ), if (iban.isNotEmpty()) "IBAN: $iban" else "", "Import: ${quelle.text}")
                .filter { it.isNotEmpty() }.joinToString(" · ")
            form = form.copy(belegNummer = beleg, notiz = notiz)
            val dup = findeDuplikat(form, vorhandene)
            BuchungsZeile(i, form, hinweise, dup, vorschlag)
        }
    }

    /** Nächste freie Nummer "<Präfix>-JJJJ-NNN": höchste vorhandene des Jahres + 1. */
    fun naechsteNummer(praefix: String, vorhandene: Collection<String>, jahr: Int): String {
        val re = Regex("""^$praefix-$jahr-(\d+)$""")
        val hoechste = vorhandene.mapNotNull { re.matchEntire(it.trim())?.groupValues?.get(1)?.toIntOrNull() }.maxOrNull() ?: 0
        return "$praefix-$jahr-${(hoechste + 1).toString().padStart(3, '0')}"
    }

    /** Legt die Buchungen an (alles oder nichts). Zeilen mit Fehlern dürfen nicht übergeben werden. */
    fun importieren(
        store: DocumentStore, zeilen: List<BuchungsZeile>, quelle: ImportQuelle, now: ZonedDateTime = ZonedDateTime.now(),
    ): BuchungImportBericht {
        require(zeilen.isNotEmpty()) { "Keine Buchungen zum Importieren ausgewählt." }
        return store.transaction {
            val konten = Finance.konten(store)
            zeilen.forEach { z -> fehler(z.form, konten).firstOrNull()?.let { throw IllegalArgumentException("Zeile ${z.index + 2}: $it") } }
            val nummern = HashSet(Finance.buchungen(store).map { it.belegNummer.trim() }.filter { it.isNotEmpty() })
            val ids = HashSet(store.ids(Finance.BUCHUNGEN))
            val vergeben = ArrayList<String>()
            val basis = now.toInstant().toEpochMilli()
            zeilen.forEach { z ->
                var f = z.form
                if (f.belegNummer.isBlank()) {
                    val jahr = LocalDate.parse(f.datum).year
                    f = f.copy(belegNummer = naechsteNummer(quelle.praefix, nummern, jahr))
                }
                nummern.add(f.belegNummer.trim())
                var id: String
                do { id = "tx-$basis-${Zeit.zufall(4)}" } while (!ids.add(id))
                BuchungStore.speichern(store, f.copy(id = id), now)
                vergeben.add(f.belegNummer)
            }
            BuchungImportBericht(zeilen.size, vergeben.first(), vergeben.last())
        }
    }

    /** Musterdatei zum Ausfüllen (Semikolon, deutsche Zahlen). */
    fun vorlage(): String = listOf(
        "Datum;Belegnummer;Partner;Text;Betrag;Art;Bereich;Konto;Umsatzsteuer;Notiz",
        "15.01.2026;;Max Mustermann;Spende Weihnachtsfeier;50,00;Einnahme;ideell;40450;0;",
        "20.01.2026;;Sportartikel Müller;Bälle und Trikots;-235,90;Ausgabe;zweckbetrieb;;19;Rechnung 4711",
        "31.01.2026;;Sparkasse;Kontoführung Januar;-7,90;;;;;",
    ).joinToString("\r\n") + "\r\n"
}
