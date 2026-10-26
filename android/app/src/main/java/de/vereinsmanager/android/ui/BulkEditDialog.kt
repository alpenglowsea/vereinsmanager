package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.BulkEdit
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberLabels
import de.vereinsmanager.core.members.MemberRules
import de.vereinsmanager.core.members.NotesEdit

@Composable
private fun Haken(label: String, an: Boolean, onChange: (Boolean) -> Unit, inhalt: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(an, onChange)
            Text(label, style = MaterialTheme.typography.titleSmall)
        }
        if (an) Column(Modifier.padding(start = 16.dp)) { inhalt() }
    }
}

/** Sammelbearbeitung: nur Felder mit Haken werden geändert. Es gelten die Verknüpfungsregeln des Formulars. */
@Composable
fun BulkEditDialog(model: AppModel, members: List<Member>, onDismiss: () -> Unit, onDone: (String) -> Unit) {
    var payment by remember { mutableStateOf<String?>(null) }
    var period by remember { mutableStateOf<String?>(null) }
    var dueDay by remember { mutableStateOf<Int?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var type by remember { mutableStateOf<String?>(null) }
    var dept by remember { mutableStateOf<String?>(null) }
    var feeOn by remember { mutableStateOf(false) }
    var fee by remember { mutableStateOf("") }
    var entryOn by remember { mutableStateOf(false) }
    var entry by remember { mutableStateOf("") }
    var exitOn by remember { mutableStateOf(false) }
    var exit by remember { mutableStateOf("") }
    var consent by remember { mutableStateOf<Boolean?>(null) }
    var notesOn by remember { mutableStateOf(false) }
    var notesAppend by remember { mutableStateOf(true) }
    var notes by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    val feeValue = if (feeOn && fee.isNotBlank()) MemberRules.parseFee(fee) else null
    val edit = BulkEdit(
        paymentMethod = payment, feePeriod = period, monthlyDueDay = dueDay, status = status, type = type,
        department = dept?.takeIf { it.isNotEmpty() }, fee = feeValue, entryDate = if (entryOn) entry else null, exitDate = if (exitOn) exit else null,
        dataPrivacyConsent = consent,
        notes = if (notesOn) (if (notesAppend) NotesEdit.Append(notes) else NotesEdit.Replace(notes)) else null,
    )
    val first = members.take(3).joinToString(", ") { it.displayName }
    val more = if (members.size > 3) " und ${members.size - 3} weitere" else ""

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Sammelbearbeitung") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Betroffen: ${members.size} Mitglieder ($first$more). Nur Felder mit Haken werden geändert. Es gelten dieselben Regeln wie im Formular: Wer auf „Gekündigt“ gesetzt wird, bekommt automatisch auch Beitrag 0 und Zahlungsart beitragsfrei.")
                Haken("Zahlungsart", payment != null, { payment = if (it) "sepa" else null }) {
                    Auswahl("", MemberLabels.PAYMENT, payment ?: "sepa") { payment = it }
                }
                Haken("Zahlungsweise", period != null, { period = if (it) "yearly" else null }) {
                    Auswahl("", PERIOD_FORM, period ?: "yearly") { period = it }
                }
                Haken("Einzugstag (monatlich)", dueDay != null, { dueDay = if (it) 1 else null }) {
                    Row {
                        FilterChip(dueDay == 1, { dueDay = 1 }, { Text("1.") })
                        FilterChip(dueDay == 15, { dueDay = 15 }, { Text("15.") }, modifier = Modifier.padding(start = 8.dp))
                    }
                }
                Haken("Status", status != null, { status = if (it) "active" else null }) {
                    Auswahl("", STATUS_FORM, status ?: "active") { status = it }
                }
                Haken("Mitgliedstyp", type != null, { type = if (it) "full" else null }) {
                    Auswahl("", TYPE_FORM, type ?: "full") { type = it }
                }
                Haken("Sparte", dept != null, { dept = if (it) (model.departments.firstOrNull() ?: "") else null }) {
                    Auswahl("", model.departments.associateWith { it }, dept ?: "") { dept = it }
                }
                Haken("Beitrag (€)", feeOn, { feeOn = it }) {
                    Feld("Betrag", fee, { fee = it }, keyboard = KeyboardType.Decimal,
                        hinweis = "Bei gekündigten, ausgetretenen und beitragsfreien Mitgliedern wird der Beitrag nicht gesetzt.")
                }
                Haken("Eintrittsdatum", entryOn, { entryOn = it }) { DatumFeld("", entry) { entry = it } }
                Haken("Austrittsdatum", exitOn, { exitOn = it }) {
                    DatumFeld("Leer lassen löscht das Austrittsdatum", exit, optional = true) { exit = it }
                }
                Haken("Datenschutz-Einwilligung", consent != null, { consent = if (it) true else null }) {
                    Row {
                        FilterChip(consent == true, { consent = true }, { Text("liegt vor") })
                        FilterChip(consent == false, { consent = false }, { Text("liegt nicht vor") }, modifier = Modifier.padding(start = 8.dp))
                    }
                }
                Haken("Notizen", notesOn, { notesOn = it }) {
                    Row {
                        FilterChip(notesAppend, { notesAppend = true }, { Text("anhängen") })
                        FilterChip(!notesAppend, { notesAppend = false }, { Text("ersetzen") }, modifier = Modifier.padding(start = 8.dp))
                    }
                    Feld("Text", notes, { notes = it }, singleLine = false)
                }
                if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(
                enabled = !edit.isEmpty && !model.busy,
                onClick = {
                    model.bulkEdit(members.map { it.id }, edit) { report, fehler ->
                        if (fehler != null || report == null) error = "Fehler: $fehler"
                        else onDone(
                            "${report.changed} Mitglieder geändert, ${report.unchanged} ohne Änderung" +
                                (if (report.feeSkipped > 0) "; Beitrag nicht gesetzt bei ${report.feeSkipped} (gekündigt, ausgetreten oder beitragsfrei)" else "") + ".",
                        )
                    }
                },
            ) { Text("Anwenden") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}
