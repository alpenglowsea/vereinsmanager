package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.DocumentChoice
import de.vereinsmanager.core.members.MaterialChoice
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberList
import de.vereinsmanager.core.members.SortKey

/** Löschen mit Rückfragen zu Dokumenten und ausgegebenem Material (Entscheidung 9). */
@Composable
fun DeleteMemberDialog(model: AppModel, members: List<Member>, onDismiss: () -> Unit, onDeleted: () -> Unit) {
    val ids = members.map { it.id }
    val (materialCount, docCount) = remember(ids) { model.dependencies(ids) }
    var docs by remember { mutableStateOf(DocumentChoice.KEEP) }
    var transfer by remember { mutableStateOf(false) }
    var target by remember { mutableStateOf<Member?>(null) }
    var menu by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val candidates = remember(ids, model.members) {
        MemberList.sort(model.members.filter { it.id !in ids && it.isCurrent }, SortKey.NAME)
    }
    val canDelete = !model.busy && (!(materialCount > 0 && transfer) || target != null)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Mitglied löschen") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                if (members.size == 1) {
                    val m = members[0]
                    Text("Soll ${m.displayName} (${m.number}) wirklich unwiderruflich gelöscht werden? Das Änderungsprotokoll bleibt erhalten.")
                } else {
                    Text("Sollen ${members.size} Mitglieder wirklich unwiderruflich gelöscht werden? Das Änderungsprotokoll bleibt erhalten.")
                }
                if (docCount > 0) {
                    Text("Verknüpfte Dokumente: $docCount", modifier = Modifier.padding(top = 12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(docs == DocumentChoice.KEEP, { docs = DocumentChoice.KEEP }); Text("Dokumente behalten")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(docs == DocumentChoice.DELETE, { docs = DocumentChoice.DELETE }); Text("Dokumente mitlöschen")
                    }
                }
                if (materialCount > 0) {
                    Text("Noch ausgegebenes Material: $materialCount", modifier = Modifier.padding(top = 12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(!transfer, { transfer = false }); Text("Zurück ins Inventar (als zurückgegeben gebucht)")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(transfer, { transfer = true }); Text("Auf ein anderes Mitglied übertragen")
                    }
                    if (transfer) {
                        OutlinedButton(onClick = { menu = true }) { Text(target?.let { "${it.displayName} (${it.number})" } ?: "Mitglied wählen …") }
                        DropdownMenu(menu, { menu = false }) {
                            candidates.forEach { c ->
                                DropdownMenuItem(text = { Text("${c.displayName} (${c.number})") }, onClick = { target = c; menu = false })
                            }
                        }
                    }
                }
                if (error != null) Text(error!!, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(
                enabled = canDelete,
                onClick = {
                    val choice = if (materialCount > 0 && transfer) MaterialChoice.Transfer(target!!.id) else MaterialChoice.Return
                    model.deleteMembers(ids, docs, choice) { _, fehler -> if (fehler == null) onDeleted() else error = "Fehler: $fehler" }
                },
            ) { Text(if (members.size == 1) "Unwiderruflich löschen" else "Ja, ${members.size} Mitglieder löschen") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}
