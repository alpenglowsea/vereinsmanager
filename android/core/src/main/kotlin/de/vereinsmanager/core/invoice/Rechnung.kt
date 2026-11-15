package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.donation.DonorAddress
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import java.math.BigDecimal
import java.math.RoundingMode

/** Eine Rechnungsposition (berechnet). */
data class Position(
    val id: String,
    val nummer: Int,
    val text: String,
    val menge: BigDecimal,
    val einheit: String,
    val preis: BigDecimal,
    val ust: Int,
    val summe: BigDecimal,
)

/** Eine Ausgangsrechnung. Entspricht `ClubInvoice` am Desktop; [kleinunternehmer] ist neu (Feld `smallBusiness`). */
data class Rechnung(
    val id: String,
    val nummer: String,
    val datum: String,
    val leistungsdatum: String,
    val faellig: String,
    /** "draft", "open", "paid" oder "cancelled" ("overdue" kennt der Typ, wird aber nur berechnet) */
    val status: String,
    /** "member", "contact" oder "custom" */
    val empfaengerArt: String,
    val empfaengerId: String?,
    val name: String,
    val firma: String,
    val ansprechpartner: String,
    val adresse: DonorAddress,
    val email: String,
    val telefon: String,
    val titel: String,
    val betreff: String,
    val einleitung: String,
    val positionen: List<Position>,
    val schluss: String,
    val sphaere: String,
    val netto: BigDecimal,
    val ustJeSatz: Map<Int, BigDecimal>,
    val ustGesamt: BigDecimal,
    val brutto: BigDecimal,
    val zahlungszielTage: Int,
    val bezahltAm: String?,
    val zahlart: String?,
    val buchungId: String?,
    val dokumentId: String?,
    val notiz: String,
    val kleinunternehmer: Boolean,
    val erstellt: String,
    val geaendert: String,
) {
    /** Name für Listen: Firma, sonst Name. */
    val anzeigeName: String get() = firma.ifBlank { name }
}

/** Die Summen einer Rechnung. */
data class Summen(val positionen: List<Position>, val netto: BigDecimal, val ustJeSatz: Map<Int, BigDecimal>, val ustGesamt: BigDecimal, val brutto: BigDecimal)

private fun JsonObject.s(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
private fun JsonObject.d(k: String): BigDecimal = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull?.toBigDecimalOrNull() ?: BigDecimal.ZERO
private fun JsonObject.i(k: String): Int? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.let { it.intOrNull ?: it.doubleOrNull?.toInt() }

fun JsonObject.toRechnung(): Rechnung {
    val a = this["recipientAddress"] as? JsonObject
    val pos = (this["items"] as? JsonArray).orEmpty().mapIndexedNotNull { idx, e ->
        val o = e as? JsonObject ?: return@mapIndexedNotNull null
        Position(
            id = o.s("id") ?: "pos-$idx", nummer = o.i("position") ?: (idx + 1), text = o.s("description").orEmpty(),
            menge = o.d("quantity"), einheit = o.s("unit").orEmpty(), preis = o.d("unitPrice"), ust = o.i("vatRate") ?: 0, summe = o.d("totalPrice"),
        )
    }
    val ustObj = this["vatAmounts"] as? JsonObject
    val ust = ustObj?.mapNotNull { (k, v) ->
        val rate = k.toIntOrNull() ?: return@mapNotNull null
        rate to ((v as? JsonPrimitive)?.contentOrNull?.toBigDecimalOrNull() ?: BigDecimal.ZERO)
    }?.toMap().orEmpty()
    val datum = s("date").orEmpty()
    return Rechnung(
        id = s("id").orEmpty(), nummer = s("invoiceNumber").orEmpty(), datum = datum,
        leistungsdatum = s("deliveryDate")?.ifEmpty { null } ?: datum, faellig = s("dueDate")?.ifEmpty { null } ?: datum,
        status = s("status") ?: "open", empfaengerArt = s("recipientType") ?: "custom", empfaengerId = s("recipientId")?.ifEmpty { null },
        name = s("recipientName").orEmpty(), firma = s("recipientCompany").orEmpty(), ansprechpartner = s("recipientContactPerson").orEmpty(),
        adresse = DonorAddress(a?.s("street").orEmpty(), a?.s("houseNumber").orEmpty(), a?.s("zip").orEmpty(), a?.s("city").orEmpty(), a?.s("country").orEmpty()),
        email = s("recipientEmail").orEmpty(), telefon = s("recipientPhone").orEmpty(),
        titel = s("title")?.ifEmpty { null } ?: "Rechnung", betreff = s("subject").orEmpty(), einleitung = s("introText").orEmpty(),
        positionen = pos, schluss = s("outroText").orEmpty(), sphaere = s("taxSphere") ?: "wirtschaftlich",
        netto = d("subtotalNet"), ustJeSatz = ust, ustGesamt = d("totalVat"), brutto = d("totalAmount"),
        zahlungszielTage = i("paymentTermsDays") ?: 14, bezahltAm = s("paidAt")?.ifEmpty { null }, zahlart = s("paymentMethod")?.ifEmpty { null },
        buchungId = s("linkedTransactionId")?.ifEmpty { null }, dokumentId = s("documentId")?.ifEmpty { null },
        notiz = s("notes").orEmpty(), kleinunternehmer = (this["smallBusiness"] as? JsonPrimitive)?.booleanOrNull ?: false,
        erstellt = s("createdAt").orEmpty(), geaendert = s("updatedAt").orEmpty(),
    )
}

/** Eine Position im Formular; Zahlen als Text, so wie sie getippt werden. */
data class PositionForm(
    val id: String,
    val text: String = "",
    val menge: String = "1",
    val einheit: String = "Stk.",
    val preis: String = "",
    val ust: Int = 19,
)

/** Das Rechnungsformular. */
data class RechnungForm(
    val id: String,
    val nummer: String = "",
    val datum: String = "",
    val leistungsdatum: String = "",
    val zahlungszielTage: Int = 14,
    val faellig: String = "",
    val status: String = "open",
    val sphaere: String = "wirtschaftlich",
    val empfaengerArt: String = "custom",
    val empfaengerId: String = "",
    val name: String = "",
    val firma: String = "",
    val ansprechpartner: String = "",
    val strasse: String = "",
    val hausnummer: String = "",
    val plz: String = "",
    val ort: String = "",
    val land: String = "Deutschland",
    val email: String = "",
    val telefon: String = "",
    val titel: String = "Rechnung",
    val betreff: String = "",
    val einleitung: String = "",
    val schluss: String = "",
    val positionen: List<PositionForm> = emptyList(),
    val kleinunternehmer: Boolean = false,
    val notiz: String = "",
)

object RechnungsRegeln {
    val UST_SAETZE = listOf(0, 7, 19)

    /** Menge: bis zu drei Nachkommastellen (der Desktop rundet auf eine, aus 0,75 wird dort 0,8). */
    fun parseMenge(text: String): BigDecimal? {
        var t = text.trim().replace(" ", "")
        if (t.isEmpty()) return null
        t = if (t.contains(',')) t.replace(".", "").replace(',', '.') else t
        if (!Regex("""^\d+(\.\d+)?$""").matches(t)) return null
        return t.toBigDecimalOrNull()?.setScale(3, RoundingMode.HALF_UP)
    }

    fun parsePreis(text: String): BigDecimal? {
        var t = text.trim().replace("€", "").replace(" ", "")
        if (t.isEmpty()) return null
        t = if (t.contains(',')) t.replace(".", "").replace(',', '.')
        else if (Regex("""^\d{1,3}(\.\d{3})+$""").matches(t)) t.replace(".", "") else t
        if (!Regex("""^-?\d+(\.\d+)?$""").matches(t)) return null
        return t.toBigDecimalOrNull()?.setScale(2, RoundingMode.HALF_UP)
    }

    /** Menge als Eingabetext: "2,5", "1". */
    fun mengeText(v: BigDecimal): String = v.stripTrailingZeros().let { (if (it.scale() < 0) it.setScale(0) else it).toPlainString() }.replace('.', ',')

    /**
     * Rechnet die Positionen: Summe je Position auf Cent gerundet, Umsatzsteuer je Satz aus der Nettosumme dieses Satzes
     * (nicht je Position, damit sich Rundungen nicht aufsummieren). Beim Kleinunternehmer ist jeder Satz 0.
     */
    fun berechnen(positionen: List<PositionForm>, kleinunternehmer: Boolean): Summen {
        val fertig = positionen.mapIndexed { i, p ->
            val menge = parseMenge(p.menge) ?: BigDecimal.ONE.setScale(3)
            val preis = parsePreis(p.preis) ?: BigDecimal.ZERO.setScale(2)
            val satz = if (kleinunternehmer) 0 else p.ust
            Position(p.id, i + 1, p.text.trim(), menge, p.einheit.trim(), preis, satz, (menge * preis).setScale(2, RoundingMode.HALF_UP))
        }
        val netto = fertig.fold(BigDecimal.ZERO) { a, p -> a + p.summe }.setScale(2, RoundingMode.HALF_UP)
        val jeSatz = linkedMapOf<Int, BigDecimal>()
        fertig.groupBy { it.ust }.toSortedMap().forEach { (satz, l) ->
            val n = l.fold(BigDecimal.ZERO) { a, p -> a + p.summe }
            jeSatz[satz] = (n * BigDecimal(satz) / BigDecimal(100)).setScale(2, RoundingMode.HALF_UP)
        }
        val ust = jeSatz.values.fold(BigDecimal.ZERO) { a, b -> a + b }.setScale(2, RoundingMode.HALF_UP)
        return Summen(fertig, netto, jeSatz, ust, (netto + ust).setScale(2, RoundingMode.HALF_UP))
    }

    /** Fällig = Rechnungsdatum + Zahlungsziel in Tagen (leer bei ungültigem Datum). */
    /**
     * Ändert sich das Zahlungsziel, soll der Schlusstext mitgehen: Steht darin „innerhalb von <alt> Tagen“ (oder „… Tag“),
     * wird die Zahl durch [neu] ersetzt. Eigene Formulierungen ohne diese Wendung oder mit einer anderen Zahl bleiben unberührt.
     */
    fun schlussMitZiel(schluss: String, alt: Int, neu: Int): String {
        if (alt == neu) return schluss
        val re = Regex("""(innerhalb\s+von\s+)$alt(\s+Tag(?:en)?)\b""", RegexOption.IGNORE_CASE)
        if (!re.containsMatchIn(schluss)) return schluss
        return re.replace(schluss) { m -> m.groupValues[1] + neu + (if (neu == 1) " Tag" else " Tagen") }
    }

    fun faellig(datum: String, tage: Int): String = try { java.time.LocalDate.parse(datum).plusDays(tage.toLong()).toString() } catch (e: Exception) { "" }

    /** Offen und Fälligkeitsdatum vor [heute]. */
    fun ueberfaellig(r: Rechnung, heute: java.time.LocalDate): Boolean =
        r.status == "open" && (try { java.time.LocalDate.parse(r.faellig).isBefore(heute) } catch (e: Exception) { false })

    /** "RE-2026-014" -> 14 */
    private fun lauf(nummer: String, jahr: Int): Int? = Regex("""^RE-$jahr-(\d+)$""").matchEntire(nummer.trim())?.groupValues?.get(1)?.toIntOrNull()

    /** Höchste vorhandene Nummer des Jahres plus eins (der Desktop nimmt „Anzahl + 1“ und vergibt damit nach dem Löschen doppelt). */
    fun naechsteNummer(vorhandene: List<String>, jahr: Int): String =
        "RE-$jahr-${((vorhandene.mapNotNull { lauf(it, jahr) }.maxOrNull() ?: 0) + 1).toString().padStart(3, '0')}"

    fun json(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }
}
