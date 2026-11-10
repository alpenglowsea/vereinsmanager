package de.vereinsmanager.core.sepa

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.math.BigDecimal

/** Welche Beitragsperiode ein Lauf einzieht (wie `SepaPeriodFilter` am Desktop). */
enum class SepaPeriodFilter(val wire: String) {
    MONTHLY_1("monthly_1"), MONTHLY_15("monthly_15"), MONTHLY_ALL("monthly_all"),
    QUARTERLY("quarterly"), HALF_YEARLY("half_yearly"), YEARLY("yearly");

    companion object {
        fun fromWire(s: String?): SepaPeriodFilter? = values().firstOrNull { it.wire == s }
    }
}

/** Das, was der Einzug von einem Mitglied braucht. Wird aus dem Mitglieds-JSON gelesen. */
data class SepaMember(
    val id: String,
    val memberNumber: String,
    val firstName: String,
    val lastName: String,
    val status: String? = null,
    val paymentMethod: String? = null,
    val feeAmount: BigDecimal? = null,
    /** "monthly" | "quarterly" | "half_yearly" | "yearly" */
    val feePeriod: String? = null,
    val department: String? = null,
    val entryDate: String? = null,
    val exitDate: String? = null,
    val iban: String? = null,
    val bic: String? = null,
    val bankName: String? = null,
    val mandateReference: String? = null,
    val mandateDate: String? = null,
    val accountHolder: String? = null,
    val mandateSequenceType: String? = null,
    val monthlyDueDay: Int? = null,
)

/** Dateiformat der Lastschrift-XML. Seit der Formatumstellung der Banken im November 2026 gilt .08; .02 bleibt für ältere Bankprogramme wählbar. */
enum class SepaFormat(val wire: String, val namespace: String, val bicElement: String, val text: String) {
    PAIN_008_001_08("pain.008.001.08", "urn:iso:std:iso:20022:tech:xsd:pain.008.001.08", "BICFI", "Neu (pain.008.001.08)"),
    PAIN_008_001_02("pain.008.001.02", "urn:iso:std:iso:20022:tech:xsd:pain.008.001.02", "BIC", "Alt (pain.008.001.02)"),
    ;

    companion object {
        fun fromWire(w: String?): SepaFormat? = entries.firstOrNull { it.wire == w }
    }
}

data class SepaRunConfig(
    val periodFilter: SepaPeriodFilter = SepaPeriodFilter.MONTHLY_1,
    val targetYear: Int? = null,
    val targetMonth: Int? = null,
    val targetQuarter: Int? = null,
    val targetHalfYear: Int? = null,
    val executionDate: String = "",
    val creditorId: String = "",
    val creditorName: String = "",
    val creditorIban: String = "",
    val creditorBic: String? = null,
    val remittanceTemplate: String? = null,
    val format: SepaFormat = SepaFormat.PAIN_008_001_08,
)

data class SepaItem(
    val memberId: String,
    val memberNumber: String,
    val memberName: String,
    val accountHolder: String,
    val iban: String,
    val bic: String,
    val bankName: String? = null,
    val mandateReference: String,
    val mandateDate: String,
    val sequenceType: String = "RCUR",
    val amount: BigDecimal,
    val feePeriod: String? = null,
    val department: String? = null,
    val monthlyDueDay: Int? = null,
    val remittanceInfo: String,
    val endToEndId: String,
    val isValid: Boolean,
    val validationErrors: List<String> = emptyList(),
    val selected: Boolean,
)

data class IbanCheck(val isValid: Boolean, val formatted: String, val country: String, val error: String? = null)

private fun JsonObject.str(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it.isString || it.contentOrNull != null }?.contentOrNull

/** Liest ein Mitglied aus seinem JSON-Dokument; Felder, die fehlen, bleiben leer. */
fun JsonObject.toSepaMember(): SepaMember {
    val bank = this["bankDetails"] as? JsonObject
    val fee = (this["feeAmount"] as? JsonPrimitive)?.contentOrNull?.toBigDecimalOrNull()
    return SepaMember(
        id = str("id") ?: "",
        memberNumber = str("memberNumber") ?: "",
        firstName = str("firstName") ?: "",
        lastName = str("lastName") ?: "",
        status = str("status"),
        paymentMethod = str("paymentMethod"),
        feeAmount = fee,
        feePeriod = str("feePeriod"),
        department = str("department"),
        entryDate = str("entryDate"),
        exitDate = str("exitDate"),
        iban = bank?.str("iban"),
        bic = bank?.str("bic"),
        bankName = bank?.str("bankName"),
        mandateReference = bank?.str("mandateReference"),
        mandateDate = bank?.str("mandateDate"),
        accountHolder = bank?.str("accountHolder"),
        mandateSequenceType = bank?.str("mandateSequenceType"),
        monthlyDueDay = (bank?.get("monthlyDueDay") as? JsonPrimitive)?.intOrNull,
    )
}
