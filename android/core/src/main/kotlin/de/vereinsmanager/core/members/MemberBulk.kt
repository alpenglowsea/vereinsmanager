package de.vereinsmanager.core.members

import java.math.BigDecimal
import java.time.LocalDate

/** Notizen in der Sammelbearbeitung: anhängen (neue Zeile) oder ersetzen. Leerer Text ändert nichts. */
sealed interface NotesEdit {
    val text: String
    data class Append(override val text: String) : NotesEdit
    data class Replace(override val text: String) : NotesEdit
}

/**
 * Was die Sammelbearbeitung ändern soll. Nur gesetzte Felder (nicht null) werden angefasst.
 * [exitDate]: null = nicht ändern, "" = Austrittsdatum löschen. [entryDate]: leer wird ignoriert.
 */
data class BulkEdit(
    val paymentMethod: String? = null,
    val feePeriod: String? = null,
    val monthlyDueDay: Int? = null,
    val status: String? = null,
    val type: String? = null,
    val department: String? = null,
    val fee: BigDecimal? = null,
    val entryDate: String? = null,
    val exitDate: String? = null,
    val dataPrivacyConsent: Boolean? = null,
    val notes: NotesEdit? = null,
) {
    val isEmpty: Boolean get() = paymentMethod == null && feePeriod == null && monthlyDueDay == null && status == null &&
        type == null && department == null && fee == null && entryDate.isNullOrEmpty() && exitDate == null &&
        dataPrivacyConsent == null && notes?.text.isNullOrBlank()
}

/** Ergebnis je Mitglied: geändertes Formular und ob der Beitrag wegen Sperre nicht gesetzt werden konnte. */
data class BulkResult(val form: MemberForm, val feeSkipped: Boolean)

object MemberBulk {
    /**
     * Wendet die Änderung auf ein Mitglied an – anders als am Desktop MIT den Verknüpfungsregeln des Formulars
     * (Entscheidung 4): Typ und Status zuerst, dann Zahlweise und Zahlungsart, danach der Beitrag. Ist der Beitrag
     * für dieses Mitglied gesperrt (gekündigt, ausgetreten, beitragsfrei), wird er nicht gesetzt ([BulkResult.feeSkipped]).
     */
    fun anwenden(start: MemberForm, e: BulkEdit, today: LocalDate, arten: List<MitgliedsArt> = Mitgliedsarten.STANDARD): BulkResult {
        var f = start
        if (e.type != null) f = MemberRules.setType(f, e.type, today, arten)
        if (e.status != null) f = MemberRules.setStatus(f, e.status, today, arten)
        if (e.feePeriod != null) f = MemberRules.setFeePeriod(f, e.feePeriod)
        if (e.paymentMethod != null) f = MemberRules.setPayment(f, e.paymentMethod)
        var skipped = false
        if (e.fee != null) {
            if (f.isFeeLocked) skipped = true else f = f.copy(fee = MemberRules.formatFee(e.fee))
        }
        if (e.department != null) f = f.copy(department = e.department)
        if (!e.entryDate.isNullOrEmpty()) f = f.copy(entryDate = e.entryDate)
        if (e.exitDate != null) f = f.copy(exitDate = e.exitDate)
        if (e.monthlyDueDay != null) f = f.copy(monthlyDueDay = if (e.monthlyDueDay == 15) 15 else 1)
        if (e.dataPrivacyConsent != null) f = f.copy(dataPrivacyConsent = e.dataPrivacyConsent)
        val n = e.notes
        if (n != null && n.text.isNotBlank()) {
            f = when (n) {
                is NotesEdit.Replace -> f.copy(notes = n.text)
                is NotesEdit.Append -> f.copy(notes = if (f.notes.isEmpty()) n.text.trim() else f.notes + "\n" + n.text.trim())
            }
        }
        return BulkResult(f, skipped)
    }
}

data class BulkReport(val changed: Int, val unchanged: Int, val feeSkipped: Int)
