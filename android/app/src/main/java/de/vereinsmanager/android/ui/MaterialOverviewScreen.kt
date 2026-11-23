package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.export.MaterialUebersicht
import de.vereinsmanager.core.members.Ausgabe
import de.vereinsmanager.core.members.MemberMaterial
import java.time.LocalDate

/** Alle Materialausgaben aller Mitglieder: Kennzahlen, Suche, Filter, Rückgabe umschalten, Entfernen, CSV und PDF. */
@Composable
fun MaterialOverviewScreen(model: AppModel, modifier: Modifier = Modifier) {
    var suche by model.gemerkt("material", "suche", "")
    var filter by model.gemerkt("material", "filter", MaterialUebersicht.Filter.ALLE)
    var entfernen by remember { mutableStateOf<Ausgabe?>(null) }
    var info by remember { mutableStateOf("") }
    val exporter = rememberExporter(model) { info = it }

    val alle = remember(model.stand) { model.alleAusgaben() }
    val k = remember(alle) { MaterialUebersicht.kennzahlen(alle) }
    val gezeigt = remember(alle, suche, filter, model.members) { MaterialUebersicht.filtern(alle, model.members, suche, filter) }
    val mitglieder = remember(model.members) { model.members.associateBy { it.id } }
    val heute = LocalDate.now().toString()

    Column(modifier.padding(horizontal = 16.dp)) {
        Text("Alle ausgeteilten Gegenstände", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column { Text("Gesamt", style = MaterialTheme.typography.labelMedium); Text("${k.gesamt}", style = MaterialTheme.typography.titleMedium) }
            Column { Text("Ausgegeben", style = MaterialTheme.typography.labelMedium); Text("${k.ausgegeben}", style = MaterialTheme.typography.titleMedium) }
            Column { Text("Zurück", style = MaterialTheme.typography.labelMedium); Text("${k.zurueck}", style = MaterialTheme.typography.titleMedium) }
            Column { Text("Eigenanteil", style = MaterialTheme.typography.labelMedium); Text(euro(k.eigenanteil), style = MaterialTheme.typography.titleMedium) }
        }
        OutlinedTextField(suche, { suche = it }, label = { Text("Suchen (Mitglied, Gegenstand, Nummer, Notiz)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        FilterZuruecksetzen(model, "material", Modifier.padding(top = 4.dp))
        Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(filter == MaterialUebersicht.Filter.ALLE, { filter = MaterialUebersicht.Filter.ALLE }, label = { Text("Alle") })
            FilterChip(filter == MaterialUebersicht.Filter.AUSGEGEBEN, { filter = MaterialUebersicht.Filter.AUSGEGEBEN }, label = { Text("Ausgegeben") })
            FilterChip(filter == MaterialUebersicht.Filter.ZURUECK, { filter = MaterialUebersicht.Filter.ZURUECK }, label = { Text("Zurückgegeben") })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                val l = gezeigt
                exporter.csv("ausgeteilte_gegenstaende_$heute.csv") { Export.materialCsv(l, model.members, model.gegenstaende()) }
            }) { Text("CSV") }
            OutlinedButton(onClick = {
                val l = gezeigt
                exporter.pdf("ausgeteilte_gegenstaende_$heute.pdf") { Export.materialPdf(l, model.members, model.gegenstaende(), model.vereinsname(), LocalDate.now()) }
            }) { Text("PDF") }
        }
        if (info.isNotEmpty()) Text(info, Modifier.padding(top = 4.dp))
        Text("${gezeigt.size} von ${alle.size} angezeigt (Export betrifft die angezeigten)", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (alle.isEmpty()) Text("Noch keine Gegenstände ausgegeben.", Modifier.padding(top = 8.dp))
        LazyColumn {
            items(gezeigt, key = { it.id }) { a ->
                val m = mitglieder[a.memberId]
                Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Row {
                        Text(a.itemName, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Text(if (a.returned) "zurückgegeben" else "ausgegeben", style = MaterialTheme.typography.labelLarge)
                    }
                    Text(m?.let { "${it.displayName} (${it.number})" } ?: "Unbekanntes Mitglied", style = MaterialTheme.typography.bodySmall)
                    Text(
                        listOf(a.itemNumber, "${a.quantity} ${a.unit}".trim(), "Ausgabe ${deDate(a.issueDate)}")
                            .filter { it.isNotEmpty() }.joinToString(" · ") +
                            if (a.returned && a.returnDate.isNotEmpty()) " · Rückgabe ${deDate(a.returnDate)}" else "",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(MemberMaterial.eigenanteil(a), style = MaterialTheme.typography.bodySmall)
                    if (a.notes.isNotEmpty()) Text(a.notes, style = MaterialTheme.typography.bodySmall)
                    Row {
                        TextButton(onClick = { info = model.ausgabeUmschalten(a.id) ?: "" }) { Text(if (a.returned) "Wieder ausgeben" else "Zurückgeben") }
                        TextButton(onClick = { entfernen = a }) { Text("Entfernen") }
                    }
                }
                HorizontalDivider()
            }
        }
    }
    val e = entfernen
    if (e != null) {
        AlertDialog(
            onDismissRequest = { entfernen = null },
            title = { Text("Verknüpfung entfernen") },
            text = { Text("Gegenstand-Verknüpfung „${e.itemName}“ wirklich entfernen?") },
            confirmButton = { Button(onClick = { info = model.ausgabeEntfernen(e.id) ?: ""; entfernen = null }) { Text("Entfernen") } },
            dismissButton = { OutlinedButton(onClick = { entfernen = null }) { Text("Abbrechen") } },
        )
    }
}
