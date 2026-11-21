package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.unit.sp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.AusgabeForm
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberHistory
import de.vereinsmanager.core.members.MemberMaterial
import java.time.LocalDate

/** Reiter "Material": was dem Mitglied aus dem Inventar überlassen wurde. */
@Composable
fun MemberMaterialTab(model: AppModel, m: Member, onOverview: () -> Unit) {
    val ausgaben = remember(model.stand, m.id) { model.ausgaben(m.id) }
    var dialog by remember { mutableStateOf<AusgabeForm?>(null) }
    var entfernen by remember { mutableStateOf<Ausgabe?>(null) }
    var fehler by remember { mutableStateOf("") }
    val exporter = rememberExporter(model) { fehler = it }

    Column {
        Text("Inventar & Material (${ausgaben.size})", style = MaterialTheme.typography.titleMedium)
        Text("Dem Mitglied zur Nutzung überlassene Vereinsgegenstände", style = MaterialTheme.typography.bodySmall)
        Button(
            onClick = { dialog = AusgabeForm(issueDate = LocalDate.now().toString()) },
            modifier = Modifier.padding(vertical = 8.dp),
        ) { Text("Gegenstand ausgeben") }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                val liste = ausgaben
                exporter.csv("material_${m.lastName}_${m.firstName}.csv") { Export.materialCsv(liste, model.members, model.gegenstaende()) }
            }) { Text("CSV") }
            OutlinedButton(onClick = {
                val liste = ausgaben
                exporter.pdf("material_${m.lastName}_${m.firstName}.pdf") {
                    Export.materialPdf(liste, model.members, model.gegenstaende(), model.vereinsname(), LocalDate.now())
                }
            }) { Text("PDF") }
            OutlinedButton(onClick = onOverview) { Text("Alle ausgeteilten Gegenstände") }
        }
        if (fehler.isNotEmpty()) Text(fehler, color = MaterialTheme.colorScheme.error)
        if (ausgaben.isEmpty()) Text("Keine Gegenstände verknüpft.", Modifier.padding(top = 8.dp))
        ausgaben.forEach { a ->
            DetailKarte {
                Row {
                    Text(a.itemName, style = MaterialTheme.typography.titleSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = Modifier.weight(1f))
                    Text(
                        if (a.returned) "zurückgegeben" else "ausgegeben", style = MaterialTheme.typography.labelLarge,
                        color = if (a.returned) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.primary,
                    )
                }
                val zeile1 = listOf(a.itemNumber, "${a.quantity} ${a.unit}".trim()).filter { it.isNotEmpty() }.joinToString(" · ")
                Text(zeile1, style = MaterialTheme.typography.bodySmall)
                val zeile2 = "Ausgabe ${Zeit2.de(a.issueDate)}" + if (a.returned && a.returnDate.isNotEmpty()) " · Rückgabe ${Zeit2.de(a.returnDate)}" else ""
                Text(zeile2, style = MaterialTheme.typography.bodySmall)
                Text(MemberMaterial.eigenanteil(a), style = MaterialTheme.typography.bodySmall)
                if (a.notes.isNotEmpty()) Text(a.notes, style = MaterialTheme.typography.bodySmall)
                // Drei Knöpfe in einer Zeile, gleichmäßig verteilt: links, Mitte, rechts
                // (T-224, T-247, T-251). Schrift 13 sp: groß genug zum Lesen, und
                // „Wieder ausgeben“, „Bearbeiten“, „Entfernen“ passen nebeneinander.
                val knopfRand = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                val knopfText = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { fehler = model.ausgabeUmschalten(a.id) ?: "" }, contentPadding = knopfRand) {
                        Text(if (a.returned) "Wieder ausgeben" else "Zurückgeben", style = knopfText, maxLines = 1, softWrap = false)
                    }
                    TextButton(onClick = { dialog = AusgabeForm.von(a) }, contentPadding = knopfRand) {
                        Text("Bearbeiten", style = knopfText, maxLines = 1, softWrap = false)
                    }
                    TextButton(onClick = { entfernen = a }, contentPadding = knopfRand) {
                        Text("Entfernen", style = knopfText, maxLines = 1, softWrap = false, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }

    val d = dialog
    if (d != null) AusgabeDialog(model, m.id, d, onDismiss = { dialog = null })
    val e = entfernen
    if (e != null) {
        AlertDialog(
            onDismissRequest = { entfernen = null },
            title = { Text("Verknüpfung entfernen") },
            text = { Text("Gegenstand-Verknüpfung „${e.itemName}“ wirklich entfernen?") },
            confirmButton = { Button(onClick = { fehler = model.ausgabeEntfernen(e.id) ?: ""; entfernen = null }) { Text("Entfernen") } },
            dismissButton = { OutlinedButton(onClick = { entfernen = null }) { Text("Abbrechen") } },
        )
    }
}

private object Zeit2 {
    fun de(iso: String) = if (iso.isEmpty()) "" else deDate(iso)
}

@Composable
private fun AusgabeDialog(model: AppModel, memberId: String, start: AusgabeForm, onDismiss: () -> Unit) {
    val gegenstaende = remember { model.gegenstaende() }
    var form by remember { mutableStateOf(if (start.itemId.isEmpty() && gegenstaende.isNotEmpty()) start.copy(itemId = gegenstaende[0].id) else start) }
    var fehler by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var speicherFehler by remember { mutableStateOf("") }
    val optionen = remember(gegenstaende) { gegenstaende.associate { it.id to (it.name + if (it.nummer.isNotEmpty()) " (${it.nummer})" else "") } }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (form.id == null) "Gegenstand ausgeben" else "Ausgabe bearbeiten") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                if (gegenstaende.isEmpty()) {
                    Text("Im Inventar gibt es noch keine Gegenstände. Spielen Sie eine Sicherung mit Inventar ein.")
                } else {
                    Auswahl("Gegenstand", optionen, form.itemId) { form = form.copy(itemId = it) }
                    fehler["item"]?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Feld("Menge", form.quantity, { form = form.copy(quantity = it) }, error = fehler["quantity"], keyboard = KeyboardType.Number)
                    DatumFeld("Ausgabedatum", form.issueDate, error = fehler["issueDate"]) { form = form.copy(issueDate = it) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(form.hasContribution, { form = form.copy(hasContribution = it) })
                        Text("Eigenanteil geleistet")
                    }
                    if (form.hasContribution) {
                        Feld("Betrag in Euro", form.contribution, { form = form.copy(contribution = it) }, keyboard = KeyboardType.Decimal)
                    }
                    Feld("Notiz", form.notes, { form = form.copy(notes = it) }, singleLine = false)
                    if (speicherFehler.isNotEmpty()) Text(speicherFehler, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = gegenstaende.isNotEmpty(),
                onClick = {
                    val f = MemberMaterial.validate(form, gegenstaende)
                    fehler = f
                    if (f.isEmpty()) {
                        val err = model.speichereAusgabe(memberId, form)
                        if (err == null) onDismiss() else speicherFehler = err
                    }
                },
            ) { Text("Speichern") }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}

/** Reiter "Historie": Protokolleinträge dieses Mitglieds, neueste zuerst. */
@Composable
fun MemberHistoryTab(model: AppModel, m: Member) {
    val eintraege = remember(model.stand, m.id) { model.historie(m.id) }
    Column {
        Text("Änderungshistorie (${eintraege.size})", style = MaterialTheme.typography.titleMedium)
        Text("Lückenlose Revisions- und Änderungshistorie.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
        if (eintraege.isEmpty()) Text("Keine bisherigen Änderungsprotokolle für dieses Mitglied erfasst.", Modifier.padding(top = 8.dp))
        eintraege.forEach { e ->
            DetailKarte {
                Text(e.summary, style = MaterialTheme.typography.titleSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                Text(MemberHistory.zeit(e.timestamp), style = MaterialTheme.typography.bodySmall)
                Text("Bearbeitet durch: ${e.author}", style = MaterialTheme.typography.bodySmall)
                e.changes.forEach { (label, alt, neu) ->
                    Text("$label: $alt → $neu", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 8.dp, top = 2.dp))
                }
            }
        }
    }
}
