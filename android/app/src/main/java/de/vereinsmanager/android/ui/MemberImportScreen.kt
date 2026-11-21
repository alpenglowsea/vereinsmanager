package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.height
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.horizontalScroll
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

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        ImportKopf("Mitglieder importieren", step) { step = it }
        if (ergebnis.isNotEmpty()) {
            ImportErgebnis(ergebnis, onDone)
        } else when (step) {
            0 -> Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                if (hinweis.isNotEmpty()) FormKarte { Text(hinweis, color = MaterialTheme.colorScheme.error) }
                FormKarte {
                    KartenTitel("Datei wählen")
                    Text(
                        "Wählen Sie eine Excel-Datei (.xlsx, gelesen wird die erste Tabelle) oder eine CSV-Datei. Trennzeichen Semikolon, " +
                            "Komma oder Tabulator werden erkannt. Die erste Zeile muss die Spaltenüberschriften enthalten.",
                    )
                    Button(onClick = {
                        openLauncher.launch(arrayOf("text/*", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/octet-stream"))
                    }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(52.dp)) {
                        Text("Excel- oder CSV-Datei wählen")
                    }
                }
                FormKarte {
                    KartenTitel("Muster-Vorlage")
                    Text("Eine Datei mit den passenden Spaltenüberschriften zum Ausfüllen.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { vorlageLauncher.launch("Mitglieder_Vorlage.csv") }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(48.dp)) {
                        Text("Muster-Vorlage speichern")
                    }
                }
            }
            1 -> {
                val t = table
                if (t != null) SpaltenSchritt(
                    model, t, dateiName, hinweis, mapping, defaultDept,
                    onMapping = { mapping = it }, onDept = { defaultDept = it },
                    onBack = { step = 0 }, onNext = { step = 2; abgewaehlt = emptySet() },
                    modifier = Modifier.weight(1f),
                )
            }
            else -> {
                val t = table
                if (t != null) VorschauSchritt(
                    model, t, mapping, defaultDept, strategy, abgewaehlt, suche,
                    onStrategy = { strategy = it }, onAbgewaehlt = { abgewaehlt = it }, onSuche = { suche = it },
                    onBack = { step = 1 }, onFinished = { ergebnis = it },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun SpaltenSchritt(
    model: AppModel, t: CsvTable, dateiName: String, hinweis: String, mapping: ColumnMapping, defaultDept: String,
    onMapping: (ColumnMapping) -> Unit, onDept: (String) -> Unit, onBack: () -> Unit, onNext: () -> Unit, modifier: Modifier = Modifier,
) {
    val optionen = remember(t) { linkedMapOf("" to "– nicht zuordnen –").also { m -> t.headers.forEach { m[it] = it } } }
    val hatName = mapping.containsKey(ImportField.NACHNAME) || mapping.containsKey(ImportField.VOLLNAME)
    Column(modifier.verticalScroll(rememberScrollState())) {
        FormKarte {
            KartenTitel("Spalten zuordnen")
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
        }
        ZweiKnoepfe("Zurück", onBack, "Zur Vorschau", onNext, rechtsAktiv = hatName, modifier = Modifier.padding(bottom = 12.dp))
    }
}

@Composable
private fun VorschauSchritt(
    model: AppModel, t: CsvTable, mapping: ColumnMapping, defaultDept: String, strategy: DuplicateStrategy,
    abgewaehlt: Set<Int>, suche: String,
    onStrategy: (DuplicateStrategy) -> Unit, onAbgewaehlt: (Set<Int>) -> Unit, onSuche: (String) -> Unit,
    onBack: () -> Unit, onFinished: (String) -> Unit, modifier: Modifier = Modifier,
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
    Column(modifier.fillMaxSize()) {
        // Alles außer den Knöpfen unten liegt in der Liste: so schrumpft sie bei geöffneter Tastatur nicht auf einen Streifen.
        LazyColumn(Modifier.weight(1f, fill = true), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 8.dp)) {
            item {
                ImportKacheln(listOf(Triple("Zeilen", rows.size.toString(), 0), Triple("Ausgewählt", gewaehlt.size.toString(), 1), Triple("Vorhanden", dubletten.toString(), if (dubletten > 0) 2 else 0)))
                if (mitWarnung > 0) Text("$mitWarnung Zeile(n) mit Warnung.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
            }
            if (dubletten > 0) item {
                DetailKarte("Wenn ein Mitglied schon vorhanden ist") {
                    Text("Gleiche Nummer oder gleicher Name.", style = MaterialTheme.typography.bodySmall)
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TabChip("Aktualisieren", strategy == DuplicateStrategy.UPDATE) { onStrategy(DuplicateStrategy.UPDATE) }
                        TabChip("Überspringen", strategy == DuplicateStrategy.SKIP) { onStrategy(DuplicateStrategy.SKIP) }
                        TabChip("Neu anlegen", strategy == DuplicateStrategy.CREATE_ALWAYS) { onStrategy(DuplicateStrategy.CREATE_ALWAYS) }
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
            }
            item {
                SuchFeld(suche, onSuche, "In der Vorschau suchen", Modifier.padding(vertical = 8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 8.dp)) {
                    KompaktKnopf("Alle", { onAbgewaehlt(emptySet()) })
                    KompaktKnopf("Keine", { onAbgewaehlt(rows.map { it.index }.toSet()) })
                }
            }
            itemsIndexed(sichtbar, key = { _, r -> r.index }) { i, r ->
                val an = r.index !in abgewaehlt
                ListenKarte(i == 0, i == sichtbar.lastIndex, an, onClick = { onAbgewaehlt(if (an) abgewaehlt + r.index else abgewaehlt - r.index) }, onLongClick = {}) {
                    Checkbox(an, null)
                    Column(Modifier.weight(1f).padding(start = 10.dp)) {
                        val name = listOf(r.form.firstName, r.form.lastName).filter { it.isNotEmpty() }.joinToString(" ")
                        Text(name.ifEmpty { "(ohne Namen)" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(
                            listOf(r.form.number, r.form.department, listOf(r.form.zip, r.form.city).filter { it.isNotEmpty() }.joinToString(" "))
                                .filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (r.isDuplicate) Text("bereits vorhanden", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        r.warnings.forEach { Text("⚠ $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
        ImportLeiste(fehler) {
            ZweiKnoepfe(
                "Zurück", onBack, "${gewaehlt.size} importieren",
                {
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
                rechtsAktiv = !model.busy, linksAktiv = !model.busy,
            )
        }
    }
}
