package de.vereinsmanager.android.ui

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.importe.ArtVorgabe
import de.vereinsmanager.core.importe.BuchungFeld
import de.vereinsmanager.core.importe.BuchungImport
import de.vereinsmanager.core.importe.BuchungsZeile
import de.vereinsmanager.core.importe.ImportQuelle
import de.vereinsmanager.core.importe.KontaktFeld
import de.vereinsmanager.core.importe.KontaktImport
import de.vereinsmanager.core.importe.KontaktZeile
import de.vereinsmanager.core.importe.Tabellen
import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.skr42.Skr42

private val IMPORT_SCHRITTE = listOf("1  Datei", "2  Spalten", "3  Vorschau")

/**
 * Erster Schritt beider Importe: Datei wählen (CSV oder Excel) oder Text aus Excel/Google Sheets einfügen.
 * [onTabelle] bekommt Tabelle, Anzeigename und einen Hinweis (leer, wenn nichts zu sagen ist).
 */
@Composable
private fun DateiSchritt(
    model: AppModel, beschreibung: String, vorlageName: String, vorlageText: () -> String,
    onTabelle: (CsvTable, String, String) -> Unit, kopf: @Composable () -> Unit = {},
) {
    var hinweis by remember { mutableStateOf("") }
    var eingefuegt by remember { mutableStateOf("") }

    val oeffnen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            try {
                val (t, h) = model.loadTabelle(uri)
                if (t.headers.isEmpty() || t.rows.isEmpty()) hinweis = "Die Datei enthält keine Daten (nötig sind eine Überschriftenzeile und mindestens eine Datenzeile)."
                else onTabelle(t, uri.lastPathSegment ?: "Datei", h)
            } catch (e: Exception) {
                hinweis = "Die Datei konnte nicht gelesen werden: ${e.message ?: e::class.simpleName}"
            }
        }
    }
    val vorlage = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri: Uri? ->
        if (uri != null) hinweis = model.writeText(uri, vorlageText())
    }

    Column(Modifier.verticalScroll(rememberScrollState())) {
        kopf()
        Text(beschreibung)
        Button(
            onClick = {
                oeffnen.launch(arrayOf("text/*", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/octet-stream"))
            },
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) { Text("Datei wählen (Excel oder CSV)") }
        Text(
            "Oder kopieren Sie die Zellen in Excel oder Google Sheets (mit der Überschriftenzeile) und fügen Sie sie hier ein:",
            Modifier.padding(top = 16.dp), style = MaterialTheme.typography.bodyMedium,
        )
        Feld("Eingefügte Tabelle", eingefuegt, { eingefuegt = it }, singleLine = false)
        Button(
            onClick = {
                val t = model.tabelleAusText(eingefuegt)
                if (t.headers.isEmpty() || t.rows.isEmpty()) hinweis = "Im eingefügten Text fehlen die Überschriftenzeile oder die Datenzeilen."
                else onTabelle(t, "Eingefügter Text", "")
            },
            enabled = eingefuegt.isNotBlank(), modifier = Modifier.fillMaxWidth(),
        ) { Text("Eingefügten Text verwenden") }
        OutlinedButton(onClick = { vorlage.launch(vorlageName) }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) { Text("Muster-Vorlage speichern") }
        if (hinweis.isNotEmpty()) Text(hinweis, Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun Schritte(step: Int) {
    Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        IMPORT_SCHRITTE.forEachIndexed { i, s -> FilterChip(selected = i == step, onClick = {}, enabled = false, label = { Text(s) }) }
    }
}

// ======================================================================= Buchungen

private fun signiert(f: BuchungForm): String {
    val b = BuchungRegeln.parseBetrag(f.betrag) ?: return f.betrag.ifEmpty { "–" }
    return Geld.euroMitVorzeichen(if (f.art == "expense") b.negate() else b)
}

private fun datumAnzeige(f: BuchungForm) = if (Tabellen.datum(f.datum) == f.datum) Zeit.deutsch(f.datum) else f.datum.ifEmpty { "ohne Datum" }

/** Buchungen importieren: Bankauszug (CSV) oder Tabelle aus Excel/Google Sheets/CSV. Nichts wird weggelassen; Fehlerzeilen lassen sich in der Vorschau korrigieren. */
@Composable
fun BuchungImportScreen(model: AppModel, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var step by remember { mutableStateOf(0) }
    var quelle by remember { mutableStateOf(ImportQuelle.BANK) }
    var table by remember { mutableStateOf<CsvTable?>(null) }
    var dateiName by remember { mutableStateOf("") }
    var hinweis by remember { mutableStateOf("") }
    var mapping by remember { mutableStateOf<Map<BuchungFeld, String>>(emptyMap()) }
    var kontoId by remember { mutableStateOf(model.konten.firstOrNull()?.id ?: "") }
    var sphaere by remember { mutableStateOf("ideell") }
    var zeilen by remember { mutableStateOf<List<BuchungsZeile>>(emptyList()) }
    var abgewaehlt by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var ergebnis by remember { mutableStateOf("") }

    BackHandler(enabled = step > 0 && ergebnis.isEmpty()) { step -= 1 }

    Column(modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("Buchungen importieren", style = MaterialTheme.typography.titleLarge)
        Schritte(step)
        if (ergebnis.isNotEmpty()) {
            Text(ergebnis, Modifier.padding(vertical = 8.dp))
            Button(onClick = onDone) { Text("Fertig") }
        } else if (model.konten.isEmpty()) {
            Text("Bitte legen Sie zuerst unter „Konten verwalten“ ein Konto an.")
        } else when (step) {
            0 -> DateiSchritt(
                model, "Wählen Sie eine Excel-Datei (.xlsx) oder eine CSV-Datei, zum Beispiel den Kontoauszug aus dem Online-Banking. " +
                    "Die erste Zeile muss die Spaltenüberschriften enthalten.",
                "Buchungen_Vorlage.csv", { BuchungImport.vorlage() },
                onTabelle = { t, name, h ->
                    table = t; dateiName = name; hinweis = h
                    mapping = BuchungImport.erkenneSpalten(t.headers); step = 1
                },
                kopf = {
                    Text("Woher kommt die Datei?", style = MaterialTheme.typography.labelMedium)
                    Row(Modifier.padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ImportQuelle.values().forEach { q -> FilterChip(quelle == q, { quelle = q }, label = { Text(if (q == ImportQuelle.BANK) "Bankauszug" else "Tabelle") }) }
                    }
                    Text(
                        if (quelle == ImportQuelle.BANK) "Bankauszug: Der steuerliche Bereich wird aus Stichwörtern geschätzt, Belegnummern lauten BK-<Jahr>-<laufend>."
                        else "Tabelle: Belegnummern aus der Datei werden übernommen, sonst BE-<Jahr>-<laufend>.",
                        style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp),
                    )
                },
            )
            1 -> {
                val t = table
                if (t != null) BuchungSpalten(
                    model, t, dateiName, hinweis, mapping, kontoId, sphaere,
                    onMapping = { mapping = it }, onKonto = { kontoId = it }, onSphaere = { sphaere = it },
                    onBack = { step = 0 },
                    onNext = {
                        val z = BuchungImport.umwandeln(t.rows, mapping, quelle, model.konten, kontoId, sphaere, model.buchungen)
                        zeilen = z
                        abgewaehlt = z.filter { it.duplikat != null || BuchungImport.fehler(it.form, model.konten).isNotEmpty() }.map { it.index }.toSet()
                        step = 2
                    },
                )
            }
            else -> BuchungVorschau(
                model, quelle, zeilen, abgewaehlt,
                onZeilen = { zeilen = it }, onAbgewaehlt = { abgewaehlt = it }, onBack = { step = 1 }, onFinished = { ergebnis = it },
            )
        }
    }
}

@Composable
private fun BuchungSpalten(
    model: AppModel, t: CsvTable, dateiName: String, hinweis: String, mapping: Map<BuchungFeld, String>, kontoId: String, sphaere: String,
    onMapping: (Map<BuchungFeld, String>) -> Unit, onKonto: (String) -> Unit, onSphaere: (String) -> Unit, onBack: () -> Unit, onNext: () -> Unit,
) {
    val optionen = remember(t) { linkedMapOf("" to "– nicht zuordnen –").also { m -> t.headers.forEach { m[it] = it } } }
    val ok = mapping.containsKey(BuchungFeld.DATUM) && mapping.containsKey(BuchungFeld.BETRAG) &&
        (mapping.containsKey(BuchungFeld.TEXT) || mapping.containsKey(BuchungFeld.PARTNER))
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Text("$dateiName: ${t.rows.size} Zeile(n), ${t.headers.size} Spalte(n).", style = MaterialTheme.typography.bodyMedium)
        if (hinweis.isNotEmpty()) Text(hinweis, Modifier.padding(top = 4.dp))
        Text(
            "Die Zuordnung wurde anhand der Überschriften vorgeschlagen. Korrigieren Sie, was nicht stimmt.",
            Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodySmall,
        )
        Auswahl("Finanzkonto (wenn die Datei keines angibt)", model.konten.associate { it.id to it.name }, kontoId) { onKonto(it) }
        Auswahl("Steuerlicher Bereich (wenn nicht erkennbar)", FinanceLabels.SPHERE, sphaere) { onSphaere(it) }
        BuchungFeld.values().forEach { f ->
            Auswahl(f.label, optionen, mapping[f] ?: "") { v -> onMapping(if (v.isEmpty()) mapping - f else mapping + (f to v)) }
        }
        if (!ok) Text("Nötig sind mindestens Datum, Betrag und Buchungstext oder Zahlungspartner.", Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack) { Text("Zurück") }
            Button(onClick = onNext, enabled = ok) { Text("Weiter zur Vorschau") }
        }
    }
}

@Composable
private fun BuchungVorschau(
    model: AppModel, quelle: ImportQuelle, zeilen: List<BuchungsZeile>, abgewaehlt: Set<Int>,
    onZeilen: (List<BuchungsZeile>) -> Unit, onAbgewaehlt: (Set<Int>) -> Unit, onBack: () -> Unit, onFinished: (String) -> Unit,
) {
    var filter by remember { mutableStateOf("alle") }
    var bearbeite by remember { mutableStateOf<Int?>(null) }
    var sammel by remember { mutableStateOf(false) }
    var fehlerText by remember { mutableStateOf("") }

    val fehlerJe = remember(zeilen, model.konten) { zeilen.associate { it.index to BuchungImport.fehler(it.form, model.konten) } }
    val gewaehlt = zeilen.filter { it.index !in abgewaehlt && fehlerJe[it.index].isNullOrEmpty() }
    val mitFehler = zeilen.count { !fehlerJe[it.index].isNullOrEmpty() }
    val duplikate = zeilen.count { it.duplikat != null }
    val ohneKonto = gewaehlt.count { it.form.art != "transfer" && it.form.skrKonto.isEmpty() }
    val sichtbar = zeilen.filter {
        when (filter) {
            "fehler" -> !fehlerJe[it.index].isNullOrEmpty()
            "ohnekonto" -> it.form.art != "transfer" && it.form.skrKonto.isEmpty()
            "duplikat" -> it.duplikat != null
            else -> true
        }
    }

    fun ersetze(neu: BuchungsZeile) { onZeilen(zeilen.map { if (it.index == neu.index) neu else it }) }

    Column(Modifier.fillMaxSize()) {
        Text("${zeilen.size} Zeile(n), ${gewaehlt.size} ausgewählt. $mitFehler mit Fehler, $duplikate mögliche Duplikate, $ohneKonto ausgewählte ohne Konto.")
        if (mitFehler > 0) Text("Zeilen mit Fehler werden nicht importiert, bevor Sie sie berichtigt haben: antippen und korrigieren.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(filter == "alle", { filter = "alle" }, label = { Text("Alle") })
            FilterChip(filter == "fehler", { filter = "fehler" }, label = { Text("Fehler") })
            FilterChip(filter == "ohnekonto", { filter = "ohnekonto" }, label = { Text("Ohne Konto") })
            FilterChip(filter == "duplikat", { filter = "duplikat" }, label = { Text("Duplikate") })
        }
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            KompaktKnopf("Alle ohne Fehler", { onAbgewaehlt(zeilen.filter { !fehlerJe[it.index].isNullOrEmpty() }.map { it.index }.toSet()) })
            KompaktKnopf("Keine", { onAbgewaehlt(zeilen.map { it.index }.toSet()) })
            KompaktKnopf("Konto für Auswahl setzen", { sammel = true }, enabled = gewaehlt.isNotEmpty())
        }
        HorizontalDivider()
        LazyColumn(Modifier.weight(1f, fill = true)) {
            items(sichtbar, key = { it.index }) { z ->
                val f = z.form
                val fehler = fehlerJe[z.index].orEmpty()
                Row(Modifier.fillMaxWidth().clickable { bearbeite = z.index }.padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
                    Checkbox(z.index !in abgewaehlt && fehler.isEmpty(), { c -> onAbgewaehlt(if (c) abgewaehlt - z.index else abgewaehlt + z.index) }, enabled = fehler.isEmpty())
                    Column(Modifier.weight(1f)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${datumAnzeige(f)} · ${f.partner.ifEmpty { "–" }}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f), maxLines = 1)
                            Text(signiert(f), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        }
                        Text(f.text, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                        val konto = if (f.art == "transfer") "Umbuchung" else if (f.skrKonto.isEmpty()) "Konto fehlt" else "${f.skrKonto} ${f.konto}"
                        val beleg = if (f.belegNummer.isEmpty()) "Beleg wird vergeben" else f.belegNummer
                        Text(
                            listOf(model.konten.firstOrNull { it.id == f.kontoId }?.name.orEmpty(), konto, FinanceLabels.SPHERE_SHORT[f.sphaere].orEmpty(), beleg)
                                .filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (f.art != "transfer" && f.skrKonto.isEmpty()) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (z.kontoVorschlag) Text("Konto aus früherer Buchung dieses Partners vorgeschlagen.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        if (z.duplikat != null) Text("Mögliches Duplikat von ${z.duplikat}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        z.hinweise.forEach { Text("Hinweis: $it", style = MaterialTheme.typography.bodySmall) }
                        fehler.forEach { Text("⚠ $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                }
                HorizontalDivider()
            }
        }
        if (fehlerText.isNotEmpty()) Text(fehlerText, color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack, enabled = !model.busy) { Text("Zurück") }
            Button(
                enabled = !model.busy && gewaehlt.isNotEmpty(),
                onClick = {
                    fehlerText = ""
                    model.importBuchungen(gewaehlt, quelle) { r, err ->
                        if (err != null || r == null) fehlerText = "Fehler: ${err ?: "unbekannt"}"
                        else onFinished("${r.angelegt} Buchung(en) importiert (Belege ${r.ersteNummer} bis ${r.letzteNummer}).")
                    }
                },
            ) { Text("${gewaehlt.size} importieren") }
        }
    }

    bearbeite?.let { idx ->
        zeilen.firstOrNull { it.index == idx }?.let { z ->
            ZeileDialog(
                model, z.form,
                onDismiss = { bearbeite = null },
                onSave = { neu ->
                    ersetze(z.copy(form = neu, duplikat = BuchungImport.findeDuplikat(neu, model.buchungen)))
                    // Eine berichtigte Fehlerzeile wird gleich zum Import vorgemerkt
                    if (BuchungImport.fehler(neu, model.konten).isEmpty() && !BuchungImport.fehler(z.form, model.konten).isEmpty()) onAbgewaehlt(abgewaehlt - z.index)
                    bearbeite = null
                },
            )
        }
    }
    if (sammel) SammelKontoDialog(
        model,
        onDismiss = { sammel = false },
        onSave = { g ->
            onZeilen(zeilen.map { z ->
                if (z.index in abgewaehlt || z.form.art != g.art || z.form.art == "transfer") z
                else z.copy(form = z.form.copy(nummernkreis = g.nummernkreis, konto = g.konto, skrKonto = g.skrKonto, ust = g.ust, sphaere = g.sphaere, sparte = g.sparte), kontoVorschlag = false)
            })
            sammel = false
        },
    )
}

@Composable
private fun spartenAuswahl(model: AppModel, f: BuchungForm): Map<String, String> = remember(model.departments, f.sparte) {
    val liste = linkedMapOf("" to "Keine Sparte")
    model.departments.forEach { liste[it] = it }
    if (f.sparte.isNotEmpty()) liste.putIfAbsent(f.sparte, f.sparte)
    liste
}

/** Eine Zeile berichtigen: Datum, Betrag, Art, Konto, Partner, Text, Beleg und die Zuordnung zum Kontenrahmen. */
@Composable
private fun ZeileDialog(model: AppModel, start: BuchungForm, onDismiss: () -> Unit, onSave: (BuchungForm) -> Unit) {
    var f by remember { mutableStateOf(start) }
    var datumText by remember { mutableStateOf(if (Tabellen.datum(start.datum) == start.datum) Zeit.deutsch(start.datum) else start.datum) }
    val fehler = BuchungImport.fehler(f, model.konten)
    Aktionsdialog(
        titel = "Zeile bearbeiten", onDismiss = onDismiss,
        inhalt = {
            Feld("Datum (TT.MM.JJJJ)", datumText, { t -> datumText = t; f = f.copy(datum = Tabellen.datum(t) ?: t) }, keyboard = KeyboardType.Text)
            Feld("Betrag (€, ohne Vorzeichen)", f.betrag, { f = f.copy(betrag = it) }, keyboard = KeyboardType.Decimal)
            Auswahl("Art", FinanceLabels.KIND, f.art) { f = BuchungRegeln.mitArt(f, it) }
            Auswahl("Finanzkonto", model.konten.associate { it.id to it.name }, f.kontoId) { f = f.copy(kontoId = it) }
            if (f.art == "transfer") Auswahl("Zielkonto", model.konten.associate { it.id to it.name }, f.zielkontoId) { f = f.copy(zielkontoId = it) }
            Feld("Zahlungspartner", f.partner, { f = f.copy(partner = it) })
            Feld("Buchungstext", f.text, { f = f.copy(text = it) })
            Feld("Belegnummer", f.belegNummer, { f = f.copy(belegNummer = it) }, hinweis = "Leer lassen: wird fortlaufend vergeben.")
            if (f.art != "transfer") Zuordnung(
                sphaere = f.sphaere, sparte = f.sparte, nummernkreis = f.nummernkreis, konto = f.konto, ust = f.ust, art = f.art,
                sparten = spartenAuswahl(model, f), skr = Skr42.standard,
                onSphaere = { f = f.copy(sphaere = it) }, onSparte = { f = f.copy(sparte = it) },
                onNummernkreis = { f = BuchungRegeln.mitNummernkreis(f, it) },
                onKonto = { f = BuchungRegeln.mitKonto(f, it) }, onUst = { f = f.copy(ust = it) },
            )
            fehler.forEach { Text("⚠ $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        },
        aktionen = {
            Button(onClick = { onSave(f) }, modifier = Modifier.fillMaxWidth()) { Text("Übernehmen") }
            OutlinedButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

/** Ein Konto des Kontenrahmens für alle ausgewählten Einnahmen bzw. Ausgaben auf einmal setzen. */
@Composable
private fun SammelKontoDialog(model: AppModel, onDismiss: () -> Unit, onSave: (BuchungForm) -> Unit) {
    var g by remember { mutableStateOf(BuchungForm(id = "", datum = "", art = "expense")) }
    Aktionsdialog(
        titel = "Konto für die Auswahl", onDismiss = onDismiss,
        inhalt = {
            Text("Gilt für alle ausgewählten Zeilen der gewählten Art. Zeilen mit Fehler und abgewählte Zeilen bleiben unverändert.", style = MaterialTheme.typography.bodySmall)
            Auswahl("Für welche Zeilen?", linkedMapOf("expense" to "Ausgaben", "income" to "Einnahmen"), g.art) { g = BuchungRegeln.mitArt(g.copy(nummernkreis = "", konto = "", skrKonto = ""), it) }
            Zuordnung(
                sphaere = g.sphaere, sparte = g.sparte, nummernkreis = g.nummernkreis, konto = g.konto, ust = g.ust, art = g.art,
                sparten = spartenAuswahl(model, g), skr = Skr42.standard,
                onSphaere = { g = g.copy(sphaere = it) }, onSparte = { g = g.copy(sparte = it) },
                onNummernkreis = { g = BuchungRegeln.mitNummernkreis(g, it) },
                onKonto = { g = BuchungRegeln.mitKonto(g, it) }, onUst = { g = g.copy(ust = it) },
            )
        },
        aktionen = {
            Button(onClick = { onSave(g) }, enabled = g.skrKonto.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text("Setzen") }
            OutlinedButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

// ======================================================================= Kontakte

/** Kontakte aus Excel/CSV/Zwischenablage importieren. Vorhandene (gleiche Nummer oder gleicher Name) sind in der Vorschau abgewählt. */
@Composable
fun KontaktImportScreen(model: AppModel, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var step by remember { mutableStateOf(0) }
    var table by remember { mutableStateOf<CsvTable?>(null) }
    var dateiName by remember { mutableStateOf("") }
    var hinweis by remember { mutableStateOf("") }
    var mapping by remember { mutableStateOf<Map<KontaktFeld, String>>(emptyMap()) }
    var vorgabeArt by remember { mutableStateOf(ArtVorgabe.ERKENNEN) }
    var vorgabeTyp by remember { mutableStateOf("other") }
    var zeilen by remember { mutableStateOf<List<KontaktZeile>>(emptyList()) }
    var abgewaehlt by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var ergebnis by remember { mutableStateOf("") }

    BackHandler(enabled = step > 0 && ergebnis.isEmpty()) { step -= 1 }

    Column(modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("Kontakte importieren", style = MaterialTheme.typography.titleLarge)
        Schritte(step)
        if (ergebnis.isNotEmpty()) {
            Text(ergebnis, Modifier.padding(vertical = 8.dp))
            Button(onClick = onDone) { Text("Fertig") }
        } else when (step) {
            0 -> DateiSchritt(
                model, "Wählen Sie eine Excel-Datei (.xlsx) oder eine CSV-Datei mit Ihren Kontakten. Die erste Zeile muss die Spaltenüberschriften enthalten.",
                "Kontakte_Vorlage.csv", { KontaktImport.vorlage() },
                onTabelle = { t, name, h -> table = t; dateiName = name; hinweis = h; mapping = KontaktImport.erkenneSpalten(t.headers); step = 1 },
            )
            1 -> table?.let { t ->
                val optionen = remember(t) { linkedMapOf("" to "– nicht zuordnen –").also { m -> t.headers.forEach { m[it] = it } } }
                val ok = mapping.containsKey(KontaktFeld.NAME) || mapping.containsKey(KontaktFeld.NACHNAME)
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    Text("$dateiName: ${t.rows.size} Zeile(n), ${t.headers.size} Spalte(n).", style = MaterialTheme.typography.bodyMedium)
                    if (hinweis.isNotEmpty()) Text(hinweis, Modifier.padding(top = 4.dp))
                    Text("Die Zuordnung wurde anhand der Überschriften vorgeschlagen. Korrigieren Sie, was nicht stimmt.", Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodySmall)
                    Auswahl("Art, wenn die Datei sie nicht angibt", ArtVorgabe.values().associate { it.name to it.text }, vorgabeArt.name) { vorgabeArt = ArtVorgabe.valueOf(it) }
                    Auswahl("Kontakttyp, wenn die Datei keinen angibt", Kontakte.TYPEN, vorgabeTyp) { vorgabeTyp = it }
                    KontaktFeld.values().forEach { f ->
                        Auswahl(f.label, optionen, mapping[f] ?: "") { v -> mapping = if (v.isEmpty()) mapping - f else mapping + (f to v) }
                    }
                    if (!ok) Text("Ohne Name oder Nachname kann nicht importiert werden.", Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error)
                    Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { step = 0 }) { Text("Zurück") }
                        Button(
                            enabled = ok,
                            onClick = {
                                val z = KontaktImport.umwandeln(t.rows, mapping, vorgabeArt, vorgabeTyp, model.kontakte)
                                zeilen = z
                                abgewaehlt = z.filter { it.duplikat != null || it.fehler.isNotEmpty() }.map { it.index }.toSet()
                                step = 2
                            },
                        ) { Text("Weiter zur Vorschau") }
                    }
                }
            }
            else -> KontaktVorschau(model, zeilen, abgewaehlt, { zeilen = it }, { abgewaehlt = it }, { step = 1 }, { ergebnis = it })
        }
    }
}

@Composable
private fun KontaktVorschau(
    model: AppModel, zeilen: List<KontaktZeile>, abgewaehlt: Set<Int>,
    onZeilen: (List<KontaktZeile>) -> Unit, onAbgewaehlt: (Set<Int>) -> Unit, onBack: () -> Unit, onFinished: (String) -> Unit,
) {
    var fehlerText by remember { mutableStateOf("") }
    val gewaehlt = zeilen.filter { it.index !in abgewaehlt && it.fehler.isEmpty() }
    Column(Modifier.fillMaxSize()) {
        Text("${zeilen.size} Zeile(n), ${gewaehlt.size} ausgewählt, ${zeilen.count { it.duplikat != null }} bereits vorhanden, ${zeilen.count { it.fehler.isNotEmpty() }} nicht importierbar.")
        Text("Bereits vorhandene Kontakte (gleiche Nummer oder gleicher Name) sind abgewählt. Wenn Sie sie anhaken, entsteht ein zweiter Kontakt mit neuer Nummer.", style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 4.dp)) {
            KompaktKnopf("Alle", { onAbgewaehlt(zeilen.filter { it.fehler.isNotEmpty() }.map { it.index }.toSet()) })
            KompaktKnopf("Keine", { onAbgewaehlt(zeilen.map { it.index }.toSet()) })
        }
        LazyColumn(Modifier.weight(1f, fill = true)) {
            items(zeilen, key = { it.index }) { z ->
                val f = z.form
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                    Checkbox(z.index !in abgewaehlt && z.fehler.isEmpty(), { c -> onAbgewaehlt(if (c) abgewaehlt - z.index else abgewaehlt + z.index) }, enabled = z.fehler.isEmpty())
                    Column(Modifier.weight(1f)) {
                        Text(Kontakte.anzeigeName(f).ifBlank { "(ohne Namen)" }, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOf(f.nummer.ifEmpty { "Nummer wird vergeben" }, f.typen.joinToString(", ") { Kontakte.TYPEN[it] ?: it }, listOf(f.plz, f.ort).filter { it.isNotEmpty() }.joinToString(" "))
                                .filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(f.art == "legal", { onZeilen(zeilen.map { if (it.index == z.index) KontaktImport.mitArt(it, "legal") else it }) }, label = { Text("Firma") })
                            FilterChip(f.art == "natural", { onZeilen(zeilen.map { if (it.index == z.index) KontaktImport.mitArt(it, "natural") else it }) }, label = { Text("Privatperson") })
                        }
                        if (z.duplikat != null) Text("Bereits vorhanden: ${z.duplikat}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        z.hinweise.forEach { Text("Hinweis: $it", style = MaterialTheme.typography.bodySmall) }
                        z.fehler.forEach { Text("⚠ $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                }
                HorizontalDivider()
            }
        }
        if (fehlerText.isNotEmpty()) Text(fehlerText, color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack, enabled = !model.busy) { Text("Zurück") }
            Button(
                enabled = !model.busy && gewaehlt.isNotEmpty(),
                onClick = {
                    fehlerText = ""
                    model.importKontakte(gewaehlt) { r, err ->
                        if (err != null || r == null) fehlerText = "Fehler: ${err ?: "unbekannt"}"
                        else onFinished("${r.angelegt} Kontakt(e) importiert (${r.ersteNummer} bis ${r.letzteNummer}).")
                    }
                },
            ) { Text("${gewaehlt.size} importieren") }
        }
    }
}
