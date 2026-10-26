package de.vereinsmanager.android.ui

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.ColumnMapping
import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.DuplicateStrategy
import de.vereinsmanager.core.members.ImportField
import de.vereinsmanager.core.members.ImportRow
import de.vereinsmanager.core.members.MemberCsv
import java.time.LocalDate

private val SCHRITTE = listOf("1  Datei", "2  Spalten", "3  Vorschau")

/** CSV-Import in drei Schritten: Datei wählen, Spalten zuordnen, Vorschau prüfen und importieren. */
@Composable
fun MemberImportScreen(model: AppModel, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var step by remember { mutableStateOf(0) }
    var table by remember { mutableStateOf<CsvTable?>(null) }
    var dateiName by remember { mutableStateOf("") }
    var hinweis by remember { mutableStateOf("") }
    var mapping by remember { mutableStateOf<ColumnMapping>(emptyMap()) }
    var defaultDept by remember { mutableStateOf("") }
    var strategy by remember { mutableStateOf(DuplicateStrategy.UPDATE) }
    var abgewaehlt by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var suche by remember { mutableStateOf("") }
    var ergebnis by remember { mutableStateOf("") }

    BackHandler(enabled = step > 0) { step -= 1 }

    val openLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            try {
                val (t, fallback) = model.loadCsv(uri)
                if (t.headers.isEmpty() || t.rows.isEmpty()) {
                    hinweis = "Die Datei enthält keine Mitglieder (nötig sind eine Überschriftenzeile und mindestens eine Datenzeile)."
                } else {
                    table = t
                    dateiName = uri.lastPathSegment ?: "Datei"
                    mapping = MemberCsv.erkenneSpalten(t.headers)
                    abgewaehlt = emptySet()
                    hinweis = if (fallback) "Die Datei war nicht UTF-8 und wurde als Windows-1252 gelesen. Prüfen Sie Umlaute in der Vorschau." else ""
                    step = 1
                }
            } catch (e: Exception) {
                hinweis = "Die Datei konnte nicht gelesen werden: ${e.message ?: e::class.simpleName}"
            }
        }
    }
    val vorlageLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri: Uri? ->
        if (uri != null) hinweis = model.writeCsvTemplate(uri)
    }

    Column(modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("Mitglieder aus CSV importieren", style = MaterialTheme.typography.titleLarge)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SCHRITTE.forEachIndexed { i, s -> FilterChip(selected = i == step, onClick = {}, enabled = false, label = { Text(s) }) }
        }
        if (ergebnis.isNotEmpty()) {
            Text(ergebnis, Modifier.padding(vertical = 8.dp))
            Button(onClick = onDone) { Text("Fertig") }
        } else when (step) {
            0 -> Column(Modifier.verticalScroll(rememberScrollState())) {
                Text(
                    "Wählen Sie eine CSV-Datei (z. B. aus Excel mit „Speichern unter → CSV“). Trennzeichen Semikolon, Komma oder Tabulator " +
                        "werden erkannt. Die erste Zeile muss die Spaltenüberschriften enthalten.",
                )
                Button(onClick = { openLauncher.launch(arrayOf("text/*", "application/vnd.ms-excel", "application/octet-stream")) }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                    Text("CSV-Datei wählen")
                }
                OutlinedButton(onClick = { vorlageLauncher.launch("Mitglieder_Vorlage.csv") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text("Muster-Vorlage speichern")
                }
                if (hinweis.isNotEmpty()) Text(hinweis, Modifier.padding(top = 12.dp))
            }
            1 -> {
                val t = table
                if (t != null) SpaltenSchritt(
                    model, t, dateiName, hinweis, mapping, defaultDept,
                    onMapping = { mapping = it }, onDept = { defaultDept = it },
                    onBack = { step = 0 }, onNext = { step = 2; abgewaehlt = emptySet() },
                )
            }
            else -> {
                val t = table
                if (t != null) VorschauSchritt(
                    model, t, mapping, defaultDept, strategy, abgewaehlt, suche,
                    onStrategy = { strategy = it }, onAbgewaehlt = { abgewaehlt = it }, onSuche = { suche = it },
                    onBack = { step = 1 }, onFinished = { ergebnis = it },
                )
            }
        }
    }
}

@Composable
private fun SpaltenSchritt(
    model: AppModel, t: CsvTable, dateiName: String, hinweis: String, mapping: ColumnMapping, defaultDept: String,
    onMapping: (ColumnMapping) -> Unit, onDept: (String) -> Unit, onBack: () -> Unit, onNext: () -> Unit,
) {
    val optionen = remember(t) { linkedMapOf("" to "– nicht zuordnen –").also { m -> t.headers.forEach { m[it] = it } } }
    val hatName = mapping.containsKey(ImportField.NACHNAME) || mapping.containsKey(ImportField.VOLLNAME)
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Text("$dateiName: ${t.rows.size} Zeile(n), ${t.headers.size} Spalte(n).", style = MaterialTheme.typography.bodyMedium)
        if (hinweis.isNotEmpty()) Text(hinweis, Modifier.padding(top = 4.dp))
        Text(
            "Die Zuordnung wurde anhand der Überschriften vorgeschlagen. Korrigieren Sie, was nicht stimmt. " +
                "Felder ohne Zuordnung bleiben leer bzw. werden beim Aktualisieren nicht verändert.",
            Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodySmall,
        )
        if (model.departments.isNotEmpty()) {
            Auswahl("Sparte, wenn die Datei keine angibt", linkedMapOf("" to "erste Sparte (${model.departments.first()})").also { m -> model.departments.forEach { m[it] = it } }, defaultDept) { onDept(it) }
        }
        ImportField.values().forEach { f ->
            Auswahl(f.label, optionen, mapping[f] ?: "") { v ->
                onMapping(if (v.isEmpty()) mapping - f else mapping + (f to v))
            }
        }
        if (!hatName) Text("Ohne Nachname oder vollständigen Namen kann nicht importiert werden.", Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack) { Text("Zurück") }
            Button(onClick = onNext, enabled = hatName) { Text("Weiter zur Vorschau") }
        }
    }
}

@Composable
private fun VorschauSchritt(
    model: AppModel, t: CsvTable, mapping: ColumnMapping, defaultDept: String, strategy: DuplicateStrategy,
    abgewaehlt: Set<Int>, suche: String,
    onStrategy: (DuplicateStrategy) -> Unit, onAbgewaehlt: (Set<Int>) -> Unit, onSuche: (String) -> Unit,
    onBack: () -> Unit, onFinished: (String) -> Unit,
) {
    var fehler by remember { mutableStateOf("") }
    val rows: List<ImportRow> = remember(t, mapping, defaultDept, model.members) {
        MemberCsv.umwandeln(t.rows, mapping, model.members, model.departments, defaultDept.ifEmpty { null }, LocalDate.now())
    }
    val gewaehlt = rows.filter { it.index !in abgewaehlt }
    val dubletten = gewaehlt.count { it.isDuplicate }
    val mitWarnung = rows.count { it.warnings.isNotEmpty() }
    val sichtbar = remember(rows, suche) {
        val s = suche.trim().lowercase()
        if (s.isEmpty()) rows else rows.filter { r ->
            (r.form.firstName + " " + r.form.lastName + " " + r.form.number + " " + r.form.city).lowercase().contains(s)
        }
    }
    Column(Modifier.fillMaxSize()) {
        Text("${rows.size} Zeile(n), ${gewaehlt.size} ausgewählt, davon $dubletten bereits vorhanden, $mitWarnung mit Warnung.")
        if (dubletten > 0) {
            Text("Wenn ein Mitglied schon vorhanden ist (gleiche Nummer oder gleicher Name):", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.labelMedium)
            Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(strategy == DuplicateStrategy.UPDATE, { onStrategy(DuplicateStrategy.UPDATE) }, label = { Text("Aktualisieren") })
                FilterChip(strategy == DuplicateStrategy.SKIP, { onStrategy(DuplicateStrategy.SKIP) }, label = { Text("Überspringen") })
                FilterChip(strategy == DuplicateStrategy.CREATE_ALWAYS, { onStrategy(DuplicateStrategy.CREATE_ALWAYS) }, label = { Text("Neu anlegen") })
            }
            Text(
                when (strategy) {
                    DuplicateStrategy.UPDATE -> "Nur die Felder, die in der Datei ausgefüllt sind, werden überschrieben."
                    DuplicateStrategy.SKIP -> "Vorhandene Mitglieder bleiben unverändert."
                    DuplicateStrategy.CREATE_ALWAYS -> "Es entsteht ein zweites Mitglied mit neuer Mitgliedsnummer."
                },
                style = MaterialTheme.typography.bodySmall,
            )
        }
        OutlinedTextField(suche, onSuche, label = { Text("In der Vorschau suchen") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 4.dp)) {
            OutlinedButton(onClick = { onAbgewaehlt(emptySet()) }) { Text("Alle") }
            OutlinedButton(onClick = { onAbgewaehlt(rows.map { it.index }.toSet()) }) { Text("Keine") }
        }
        LazyColumn(Modifier.weight(1f, fill = true)) {
            items(sichtbar, key = { it.index }) { r ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(r.index !in abgewaehlt, { c -> onAbgewaehlt(if (c) abgewaehlt - r.index else abgewaehlt + r.index) })
                    Column(Modifier.weight(1f)) {
                        val name = listOf(r.form.firstName, r.form.lastName).filter { it.isNotEmpty() }.joinToString(" ")
                        Text(name.ifEmpty { "(ohne Namen)" }, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOf(r.form.number, r.form.department, listOf(r.form.zip, r.form.city).filter { it.isNotEmpty() }.joinToString(" "))
                                .filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (r.isDuplicate) Text("bereits vorhanden", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        r.warnings.forEach { Text("⚠ $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                }
                HorizontalDivider()
            }
        }
        if (fehler.isNotEmpty()) Text(fehler, color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack, enabled = !model.busy) { Text("Zurück") }
            Button(
                enabled = !model.busy,
                onClick = {
                    if (gewaehlt.isEmpty()) {
                        fehler = "Keine Mitglieder zum Importieren ausgewählt."
                    } else {
                        fehler = ""
                        model.importCsv(gewaehlt, strategy) { rep, err ->
                            if (err != null || rep == null) fehler = "Fehler: ${err ?: "unbekannt"}"
                            else onFinished("Import fertig: ${rep.added} neu, ${rep.updated} aktualisiert, ${rep.skipped} übersprungen.")
                        }
                    }
                },
            ) { Text("${gewaehlt.size} importieren") }
        }
    }
}
