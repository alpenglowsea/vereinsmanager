package de.vereinsmanager.core.donation

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal

data class DonorAddress(
    val street: String = "", val houseNumber: String = "", val zip: String = "",
    val city: String = "", val country: String = "",
)

/** Vereinsadresse: Die Desktop-Fassung kennt sie als Objekt oder als Freitext. */
sealed interface ClubAddress {
    data class Structured(val street: String, val houseNumber: String, val zip: String, val city: String) : ClubAddress
    data class FreeText(val text: String) : ClubAddress
}

/** Eine Zuwendungsbestätigung (Spendenquittung). Entspricht `DonationReceipt` am Desktop. */
data class DonationReceipt(
    val id: String = "",
    val receiptNumber: String = "",
    /** "money" oder "goods" */
    val type: String = "money",
    val date: String = "",
    /** "member" oder "external" */
    val donorType: String = "external",
    val donorName: String = "",
    val donorAddress: DonorAddress = DonorAddress(),
    val amount: BigDecimal = BigDecimal.ZERO,
    val amountInWords: String = "",
    val isWaiverOfRefund: Boolean = false,
    val goodsDescription: String? = null,
    /** "business" oder "private" */
    val goodsOrigin: String? = null,
    val goodsValuationBasis: String? = null,
    val taxOffice: String = "",
    val taxNumber: String = "",
    val exemptionDate: String = "",
    val statementDate: String? = null,
    val assessmentPeriod: String = "",
    val promotedPurpose: String = "",
    val isDirectlyPromoted: Boolean = true,
    val issuedBy: String = "",
    val cityAndDate: String = "",
    val notes: String? = null,
    val memberId: String? = null,
    /** Die Einnahmebuchung, die zu dieser Spende angelegt wurde. */
    val transactionId: String? = null,
    /** Das abgelegte PDF im Dokumentenarchiv. */
    val documentId: String? = null,
    /** Die hinterlegte Unterschrift soll im PDF stehen. */
    val signed: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = "",
)

/** Die für den Vordruck nötigen Vereinsdaten (Ausschnitt der Einstellungen). */
data class ClubTaxSettings(
    val clubName: String = "",
    val address: ClubAddress? = null,
    val taxNumber: String = "",
    val taxOffice: String = "",
    val taxExemptionDate: String = "",
    val taxStatementDate: String = "",
    val taxAssessmentPeriod: String = "",
    val promotedPurposes: String = "",
)

private fun JsonObject.s(k: String): String? = (this[k] as? JsonPrimitive)?.contentOrNull
private fun JsonObject.b(k: String): Boolean? = (this[k] as? JsonPrimitive)?.booleanOrNull

fun JsonObject.toDonationReceipt(): DonationReceipt {
    val a = this["donorAddress"] as? JsonObject
    return DonationReceipt(
        id = s("id") ?: "",
        receiptNumber = s("receiptNumber") ?: "",
        type = s("type") ?: "money",
        date = s("date") ?: "",
        donorType = s("donorType") ?: "external",
        donorName = s("donorName") ?: "",
        donorAddress = DonorAddress(
            a?.s("street") ?: "", a?.s("houseNumber") ?: "", a?.s("zip") ?: "",
            a?.s("city") ?: "", a?.s("country") ?: "",
        ),
        amount = s("amount")?.toBigDecimalOrNull() ?: BigDecimal.ZERO,
        amountInWords = s("amountInWords") ?: "",
        isWaiverOfRefund = b("isWaiverOfRefund") ?: false,
        goodsDescription = s("goodsDescription"),
        goodsOrigin = s("goodsOrigin"),
        goodsValuationBasis = s("goodsValuationBasis"),
        taxOffice = s("taxOffice") ?: "",
        taxNumber = s("taxNumber") ?: "",
        exemptionDate = s("exemptionDate") ?: "",
        statementDate = s("statementDate"),
        assessmentPeriod = s("assessmentPeriod") ?: "",
        promotedPurpose = s("promotedPurpose") ?: "",
        isDirectlyPromoted = b("isDirectlyPromoted") ?: true,
        issuedBy = s("issuedBy") ?: "",
        cityAndDate = s("cityAndDate") ?: "",
        notes = s("notes"),
        memberId = s("memberId")?.takeIf { it.isNotEmpty() },
        transactionId = s("transactionId")?.takeIf { it.isNotEmpty() },
        documentId = s("documentId")?.takeIf { it.isNotEmpty() },
        signed = b("signed") ?: false,
        createdAt = s("createdAt") ?: "",
        updatedAt = s("updatedAt") ?: "",
    )
}

/** Liest die Vereinsdaten aus dem `settings`-Objekt der Sicherung. */
fun JsonObject.toClubTaxSettings(): ClubTaxSettings {
    val addr: ClubAddress? = when (val a = this["address"]) {
        is JsonObject -> ClubAddress.Structured(a.s("street") ?: "", a.s("houseNumber") ?: "", a.s("zip") ?: "", a.s("city") ?: "")
        is JsonPrimitive -> a.contentOrNull?.let { ClubAddress.FreeText(it) }
        else -> null
    }
    return ClubTaxSettings(
        clubName = s("clubName") ?: "",
        address = addr,
        taxNumber = s("taxNumber") ?: "",
        taxOffice = s("taxOffice") ?: "",
        taxExemptionDate = s("taxExemptionDate") ?: "",
        taxStatementDate = s("taxStatementDate") ?: "",
        taxAssessmentPeriod = s("taxAssessmentPeriod") ?: "",
        promotedPurposes = s("promotedPurposes") ?: "",
    )
}
