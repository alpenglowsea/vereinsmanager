package de.vereinsmanager.core.finance

import de.vereinsmanager.core.members.MemberList
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/** Beschriftungen der festen Auswahlwerte, wie in der Desktop-Fassung. */
object FinanceLabels {
    /** Lange Namen der vier steuerlichen Bereiche (für Auswahl und Filter). */
    val SPHERE = linkedMapOf(
        "ideell" to "1. Ideeller Bereich",
        "vermoegen" to "2. Vermögensverwaltung",
        "zweckbetrieb" to "3. Zweckbetrieb",
        "wirtschaftlich" to "4. Wirtschaftl. Geschäftsbetrieb",
    )

    /** Kurze Namen für Marken in der Liste. */
    val SPHERE_SHORT = linkedMapOf(
        "ideell" to "Ideeller Bereich",
        "vermoegen" to "Vermögensverwaltung",
        "zweckbetrieb" to "Zweckbetrieb",
        "wirtschaftlich" to "Wirtschaftl. Geschäftsbetrieb",
    )

    val KIND = linkedMapOf("income" to "Einnahme", "expense" to "Ausgabe", "transfer" to "Umbuchung")

    val ACCOUNT_TYPE = linkedMapOf(
        "bank" to "Bankkonto / Girokonto",
        "cash" to "Barkasse / Kassenbuch",
        "paypal" to "PayPal-Konto",
        "other" to "Sonstiges Konto / Festgeld",
    )
}

/** Geldbeträge im deutschen Format, unabhängig von der Gerätesprache. */
object Geld {
    private val symbols = DecimalFormatSymbols(Locale.GERMANY)

    /** "1.234,50 €", negativ "-280,00 €". */
    fun euro(v: BigDecimal): String = DecimalFormat("#,##0.00", symbols).format(v) + " €"

    /** Mit Vorzeichen: "+1.200,00 €" oder "-280,00 €". */
    fun euroMitVorzeichen(v: BigDecimal): String = (if (v.signum() > 0) "+" else "") + euro(v)
}

private fun JsonObject.s(k: String) = (this[k] as? JsonPrimitive)?.contentOrNull ?: ""
private fun JsonObject.dec(k: String) = s(k).toBigDecimalOrNull() ?: BigDecimal.ZERO
private fun JsonObject.int(k: String) = s(k).toIntOrNull() ?: 0

/** Ein Finanzkonto oder eine Kasse. */
data class Konto(
    val id: String,
    val name: String,
    val art: String,
    val iban: String,
    val bic: String,
    val anfangsbestand: BigDecimal,
    val farbe: String,
    val beschreibung: String,
    val reihenfolge: Int?,
) {
    val artText get() = FinanceLabels.ACCOUNT_TYPE[art] ?: art

    companion object {
        fun from(doc: JsonObject) = Konto(
            id = doc.s("id"), name = doc.s("name"), art = doc.s("accountType").ifEmpty { "bank" },
            iban = doc.s("iban"), bic = doc.s("bic"), anfangsbestand = doc.dec("initialBalance"),
            farbe = doc.s("color"), beschreibung = doc.s("description"),
            reihenfolge = doc.s("order").toIntOrNull(),
        )
    }
}

/** Angaben zum angehängten Beleg; die Bilddaten selbst werden hier bewusst nicht gehalten. */
data class BelegInfo(
    val name: String, val typ: String, val groesse: Long,
    /** Datei liegt im Jahresarchiv (R4c); dann gibt es keine Datei im Speicher. */
    val archiv: de.vereinsmanager.core.backup.ArchivVermerk? = null,
)

/** Eine Teilbuchung einer aufgeteilten Buchung. */
data class Teilbuchung(
    val id: String,
    val betrag: BigDecimal,
    val text: String,
    val sphaere: String,
    val sparte: String,
    val nummernkreis: String,
    val konto: String,
    val skrKonto: String,
    val kategorie: String,
    val ust: Int,
) {
    companion object {
        fun from(doc: JsonObject) = Teilbuchung(
            id = doc.s("id"), betrag = doc.dec("amount"), text = doc.s("bookingText"),
            sphaere = doc.s("sphere"), sparte = doc.s("department"), nummernkreis = doc.s("mainCategory"),
            konto = doc.s("subCategory"), skrKonto = doc.s("skrAccount"), kategorie = doc.s("category"),
            ust = doc.int("vatRate"),
        )
    }
}

/** Eine Buchung im Journal. Positive Beträge sind Einnahmen, negative Ausgaben. */
data class Buchung(
    val id: String,
    val datum: String,
    val betrag: BigDecimal,
    val art: String,
    val kontoId: String,
    val zielkontoId: String,
    val belegNummer: String,
    val text: String,
    val partner: String,
    val sphaere: String,
    val sparte: String,
    val nummernkreis: String,
    val konto: String,
    val skrKonto: String,
    val kategorie: String,
    val ust: Int,
    val notiz: String,
    val teile: List<Teilbuchung>,
    val beleg: BelegInfo?,
) {
    val istUmbuchung get() = art == "transfer"

    /** Ausgabe, wenn Art "Ausgabe" oder der Betrag negativ ist (wie in der EÜR der Desktop-Fassung). */
    val istAusgabe get() = !istUmbuchung && (art == "expense" || betrag.signum() < 0)
    val istEinnahme get() = !istUmbuchung && !istAusgabe
    val aufgeteilt get() = teile.isNotEmpty()

    companion object {
        fun from(doc: JsonObject): Buchung {
            val r = doc["receipt"] as? JsonObject
            val teile = (doc["splits"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.let(Teilbuchung::from) } ?: emptyList()
            return Buchung(
                id = doc.s("id"), datum = doc.s("date"), betrag = doc.dec("amount"),
                art = doc.s("type"), kontoId = doc.s("accountId"), zielkontoId = doc.s("targetAccountId"),
                belegNummer = doc.s("documentNumber"), text = doc.s("bookingText"), partner = doc.s("partner"),
                sphaere = doc.s("sphere"), sparte = doc.s("department"), nummernkreis = doc.s("mainCategory"),
                konto = doc.s("subCategory"), skrKonto = doc.s("skrAccount"), kategorie = doc.s("category"),
                ust = doc.int("vatRate"), notiz = doc.s("notes"), teile = teile,
                beleg = r?.let { BelegInfo(it.s("name"), it.s("type"), it.s("size").toLongOrNull() ?: 0L, de.vereinsmanager.core.backup.ArchivVermerk.aus(it["archiv"])) },
            )
        }
    }
}

enum class BuchungSortierung { DATUM, BETRAG, BELEGNUMMER, PARTNER, KATEGORIE, SPHAERE }

/** Einnahmen und Ausgaben einer Auswahl, Umbuchungen zählen nicht mit. */
data class Summen(val einnahmen: BigDecimal, val ausgaben: BigDecimal) {
    val saldo: BigDecimal get() = einnahmen - ausgaben
}

data class BuchungFilter(
    val suche: String = "",
    val kontoId: String? = null,
    val sphaere: String? = null,
    /** "income", "expense" oder "transfer" */
    val art: String? = null,
    /** Vierstellig, z. B. "2025" */
    val jahr: String? = null,
    /** true: nur mit Beleg, false: nur ohne Beleg */
    val mitBeleg: Boolean? = null,
)

object Finance {
    const val BUCHUNGEN = "transactions"
    const val KONTEN = "accounts"

    fun konten(store: DocumentStore): List<Konto> {
        val alle = store.all(KONTEN).map { Konto.from(it) }
        // Wie am Desktop: Konten mit gespeicherter Reihenfolge zuerst in dieser Reihenfolge; die übrigen behalten ihre Lage.
        return alle.withIndex().sortedWith(compareBy<IndexedValue<Konto>>({ it.value.reihenfolge ?: Int.MAX_VALUE }, { it.index })).map { it.value }
    }

    fun buchungen(store: DocumentStore): List<Buchung> = store.all(BUCHUNGEN).map { Buchung.from(it) }

    /**
     * Kontostand = Anfangsbestand + alle Buchungen. Eine Umbuchung mit Zielkonto mindert das Quellkonto und
     * mehrt das Zielkonto, jeweils um den Betrag ohne Vorzeichen. Buchungen auf unbekannte Konten zählen nicht.
     */
    fun kontostaende(konten: List<Konto>, buchungen: List<Buchung>): Map<String, BigDecimal> {
        val stand = LinkedHashMap<String, BigDecimal>()
        for (k in konten) stand[k.id] = k.anfangsbestand
        for (b in buchungen) {
            if (b.istUmbuchung && b.zielkontoId.isNotEmpty()) {
                val betrag = b.betrag.abs()
                stand[b.kontoId]?.let { stand[b.kontoId] = it - betrag }
                stand[b.zielkontoId]?.let { stand[b.zielkontoId] = it + betrag }
            } else {
                stand[b.kontoId]?.let { stand[b.kontoId] = it + b.betrag }
            }
        }
        return stand
    }

    fun gesamtLiquiditaet(staende: Map<String, BigDecimal>): BigDecimal =
        staende.values.fold(BigDecimal.ZERO) { a, b -> a + b }

    /** Jahre, in denen es Buchungen gibt, neuestes zuerst. */
    fun jahre(buchungen: List<Buchung>): List<String> =
        buchungen.map { it.datum.take(4) }.filter { it.length == 4 }.distinct().sortedDescending()

    fun passt(b: Buchung, f: BuchungFilter): Boolean {
        val q = f.suche.trim().lowercase(Locale.GERMAN)
        if (q.isNotEmpty()) {
            val treffer = listOf(b.belegNummer, b.text, b.partner, b.kategorie, b.notiz)
                .any { it.lowercase(Locale.GERMAN).contains(q) }
            if (!treffer) return false
        }
        if (f.kontoId != null && b.kontoId != f.kontoId && b.zielkontoId != f.kontoId) return false
        if (f.sphaere != null && b.sphaere != f.sphaere) return false
        when (f.art) {
            "income" -> if (!b.istEinnahme) return false
            "expense" -> if (!b.istAusgabe) return false
            "transfer" -> if (!b.istUmbuchung) return false
        }
        if (f.mitBeleg != null && (b.beleg != null) != f.mitBeleg) return false
        if (f.jahr != null && !b.datum.startsWith(f.jahr)) return false
        return true
    }

    fun filtern(buchungen: List<Buchung>, f: BuchungFilter) = buchungen.filter { passt(it, f) }

    /** Gleichstand bleibt in der Reihenfolge des Speichers, auch bei absteigender Sortierung. */
    fun sortieren(buchungen: List<Buchung>, nach: BuchungSortierung, aufsteigend: Boolean, konten: List<Konto> = emptyList()): List<Buchung> {
        val kontoName = konten.associate { it.id to it.name }
        val cmp: Comparator<Buchung> = when (nach) {
            BuchungSortierung.DATUM -> Comparator { a, b -> a.datum.compareTo(b.datum) }
            BuchungSortierung.BETRAG -> Comparator { a, b -> a.betrag.compareTo(b.betrag) }
            BuchungSortierung.BELEGNUMMER -> Comparator { a, b -> MemberList.naturalCompare(a.belegNummer, b.belegNummer) }
            BuchungSortierung.PARTNER -> Comparator { a, b ->
                MemberList.compareText("${a.partner} ${a.text}", "${b.partner} ${b.text}")
            }
            BuchungSortierung.KATEGORIE -> Comparator { a, b ->
                MemberList.compareText("${a.kategorie} ${kontoName[a.kontoId] ?: ""}", "${b.kategorie} ${kontoName[b.kontoId] ?: ""}")
            }
            BuchungSortierung.SPHAERE -> Comparator { a, b -> a.sphaere.compareTo(b.sphaere) }
        }
        return buchungen.sortedWith(if (aufsteigend) cmp else cmp.reversed())
    }

    fun summen(buchungen: List<Buchung>): Summen {
        var ein = BigDecimal.ZERO
        var aus = BigDecimal.ZERO
        for (b in buchungen) {
            if (b.istUmbuchung) continue
            if (b.istAusgabe) aus += b.betrag.abs() else ein += b.betrag.abs()
        }
        return Summen(ein, aus)
    }

    /** Kurzer Text für die Liste: Partner und Buchungstext, falls beides da ist, durch " – " getrennt. */
    fun titel(b: Buchung): String {
        val teile = listOf(b.partner, b.text).filter { it.isNotBlank() }
        return if (teile.isEmpty()) "(ohne Text)" else teile.joinToString(" – ")
    }
}
