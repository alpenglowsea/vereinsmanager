package de.vereinsmanager.android.ui

import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.documents.DateiFormat
import de.vereinsmanager.core.documents.DokFilter
import de.vereinsmanager.core.documents.DokSortierung
import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.documents.Kategorie
import de.vereinsmanager.core.documents.OrdnerForm
import de.vereinsmanager.core.finance.Belege
import java.time.LocalDate
import kotlin.concurrent.thread

private val dokHandler = Handler(Looper.getMainLooper())

private fun farbe(hex: String): Color = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (e: Exception) {
    Color(0xFF64748B)
}

private fun dokumentZahl(n: Int) = if (n == 1) "1 Dokument" else "$n Dokumente"

// ------------------------------------------------------------------ Übersicht

/**
 * Die Dokumente: Ordner für Ordner (jeder Ordner ist eine eigene Seite), mit Suche und Filtern. Solange gesucht oder gefiltert
 * wird, zeigt die Seite eine flache Trefferliste aus dem Ordner und allen Unterordnern.
 */
@Composable
fun DokumenteScreen(
    model: AppModel, folderId: String?, onOpenFolder: (String) -> Unit, onJump: (List<String>) -> Unit,
    onOpenDoc: (String) -> Unit, onNewDoc: (String?) -> Unit, modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) { model.standardOrdnerSicherstellen() }

    val alleOrdner = model.ordner
    val alleDok = model.dokumente
    val aktuell = folderId?.let { id -> alleOrdner.firstOrNull { it.id == id } }

    var text by remember { mutableStateOf("") }
    var format by remember { mutableStateOf(DateiFormat.ALLE) }
    var jahr by remember { mutableStateOf<String?>(null) }
    var sort by remember { mutableStateOf(DokSortierung.DATUM_NEU) }
    var sortOffen by remember { mutableStateOf(false) }
    var auswahl by remember { mutableStateOf(false) }
    var gewaehlt by remember { mutableStateOf<Set<String>>(emptySet()) }
    var ordnerDialog by remember { mutableStateOf<OrdnerForm?>(null) }
    var ordnerNeu by remember { mutableStateOf(true) }
    var verschieben by remember { mutableStateOf(false) }
    var loeschen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }

    val filter = DokFilter(text, format, jahr, sort)
    val unter = Dokumente.unterordner(alleOrdner, folderId)
    val angezeigt: List<Dokument> =
        if (filter.aktiv) Dokumente.suchen(alleDok, alleOrdner, folderId, filter)
        else Dokumente.suchen(Dokumente.direkt(alleDok, alleOrdner, folderId), alleOrdner, null, DokFilter(sortierung = sort))
    val pfad = Dokumente.pfad(alleOrdner, folderId)

    if (folderId != null && aktuell == null) {
        Text("Diesen Ordner gibt es nicht mehr.", modifier.padding(16.dp))
        return
    }

    LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { onJump(emptyList()) }, enabled = folderId != null) { Text("Dokumente") }
                pfad.forEachIndexed { i, o ->
                    Text("›")
                    TextButton(onClick = { onJump(pfad.take(i + 1).map { it.id }) }, enabled = i < pfad.lastIndex) { Text(o.name) }
                }
            }
        }
        item {
            OutlinedTextField(
                value = text, onValueChange = { text = it }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                label = { Text(if (folderId == null) "Suchen (Titel, Datei, Notiz, Schlagwort …)" else "In diesem Ordner suchen") },
            )
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterMenu(
                    "Format", DateiFormat.values().filter { it != DateiFormat.ALLE }.associate { it.name to it.titel },
                    if (format == DateiFormat.ALLE) null else format.name,
                ) { format = it?.let { n -> DateiFormat.valueOf(n) } ?: DateiFormat.ALLE }
                FilterMenu("Jahr", Dokumente.jahre(alleDok).associateWith { it }, jahr) { jahr = it }
                Box {
                    FilterChip(selected = false, onClick = { sortOffen = true }, label = { Text("Sortierung: ${sort.titel}") })
                    DropdownMenu(sortOffen, { sortOffen = false }) {
                        DokSortierung.values().forEach { s -> DropdownMenuItem(text = { Text(s.titel) }, onClick = { sort = s; sortOffen = false }) }
                    }
                }
            }
        }
        item {
            if (auswahl) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${gewaehlt.size} ausgewählt", style = MaterialTheme.typography.titleSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { verschieben = true }, enabled = gewaehlt.isNotEmpty() && !model.busy) { Text("Verschieben") }
                        OutlinedButton(onClick = { loeschen = true }, enabled = gewaehlt.isNotEmpty() && !model.busy) { Text("Löschen") }
                        TextButton(onClick = { auswahl = false; gewaehlt = emptySet() }) { Text("Abbrechen") }
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { onNewDoc(folderId) }) { Text("Dokument hinzufügen") }
                        OutlinedButton(onClick = { ordnerNeu = true; ordnerDialog = OrdnerForm(DokumentStore.neueOrdnerId(), parentId = folderId.orEmpty(), kategorie = aktuell?.kategorie.orEmpty()) }) { Text("Neuer Ordner") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (aktuell != null) OutlinedButton(onClick = { ordnerNeu = false; ordnerDialog = OrdnerForm.von(aktuell) }) { Text("Ordner bearbeiten") }
                        if (angezeigt.isNotEmpty()) OutlinedButton(onClick = { auswahl = true }) { Text("Auswählen") }
                    }
                }
            }
        }
        if (!filter.aktiv) {
            items(unter, key = { "o-" + it.id }) { o ->
                Card(Modifier.fillMaxWidth().clickable { onOpenFolder(o.id) }) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(14.dp).clip(CircleShape).background(farbe(o.farbe)))
                        Column(Modifier.weight(1f)) {
                            Text(o.name, fontWeight = FontWeight.SemiBold)
                            val unterAnzahl = Dokumente.unterordner(alleOrdner, o.id).size
                            Text(
                                dokumentZahl(Dokumente.anzahl(alleDok, alleOrdner, o.id)) + if (unterAnzahl > 0) " · $unterAnzahl Unterordner" else "",
                                style = MaterialTheme.typography.bodySmall,
                            )
                            if (o.beschreibung.isNotEmpty()) Text(o.beschreibung, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Lucide.ChevronRight, null, Modifier.size(20.dp))
                    }
                }
            }
        }
        if (filter.aktiv) item { Text(if (angezeigt.isEmpty()) "Keine Treffer." else "${dokumentZahl(angezeigt.size)} gefunden", style = MaterialTheme.typography.titleSmall) }
        if (!filter.aktiv && unter.isEmpty() && angezeigt.isEmpty()) item { Text("Dieser Ordner ist leer.") }
        items(angezeigt, key = { "d-" + it.id }) { d ->
            Card(
                Modifier.fillMaxWidth().clickable {
                    if (auswahl) gewaehlt = if (d.id in gewaehlt) gewaehlt - d.id else gewaehlt + d.id else onOpenDoc(d.id)
                },
            ) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (auswahl) Checkbox(checked = d.id in gewaehlt, onCheckedChange = { gewaehlt = if (it) gewaehlt + d.id else gewaehlt - d.id })
                    Column(Modifier.weight(1f)) {
                        Text(d.titel.ifEmpty { d.dateiName }, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(
                            listOf(if (d.datum.isEmpty()) "ohne Datum" else deDate(d.datum), groesse(d.groesse), Kategorie.titel(d.kategorie)).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (filter.aktiv && d.ordnerId != null) {
                            Text(Dokumente.pfadText(alleOrdner, d.ordnerId), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }

    val od = ordnerDialog
    if (od != null) {
        OrdnerDialog(
            model, od, ordnerNeu, onDismiss = { ordnerDialog = null },
            onGeloescht = { parent ->
                ordnerDialog = null
                // Der gelöschte Ordner war die Seite, auf der wir stehen: zum Eltern-Ordner zurück.
                if (od.id == folderId) onJump(Dokumente.pfad(model.ordner, parent).map { it.id })
            },
        )
    }

    if (verschieben) {
        VerschiebenDialog(
            model, gewaehlt.size, onDismiss = { verschieben = false },
            onWahl = { ziel, kategorie ->
                verschieben = false
                val ids = gewaehlt.toList()
                model.dokumenteVerschieben(ids, ziel, kategorie) { n, f ->
                    meldung = if (f != null) "Verschieben fehlgeschlagen: $f" else "${dokumentZahl(n ?: 0)} verschoben."
                    auswahl = false; gewaehlt = emptySet()
                }
            },
        )
    }

    if (loeschen) {
        val gewaehlteDok = alleDok.filter { it.id in gewaehlt }
        val belege = gewaehlteDok.count { it.istBeleg && it.buchungId.isNotEmpty() }
        AlertDialog(
            onDismissRequest = { loeschen = false },
            title = { Text("${dokumentZahl(gewaehlteDok.size)} löschen?") },
            text = {
                Text(
                    "Die Dokumente und ihre Dateien werden entfernt." +
                        if (belege > 0) "\n\n${if (belege == 1) "Eines davon ist" else "$belege davon sind"} der Beleg einer Buchung und wird dort ebenfalls entfernt." else "",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    loeschen = false
                    model.dokumenteLoeschen(gewaehlteDok.map { it.id }) { r, f ->
                        meldung = if (f != null) "Löschen fehlgeschlagen: $f"
                        else dokumentZahl(r?.geloescht ?: 0) + " gelöscht." + if ((r?.buchungenBetroffen ?: 0) > 0) "\nBelege an ${r!!.buchungenBetroffen} Buchung(en) wurden entfernt." else ""
                        auswahl = false; gewaehlt = emptySet()
                    }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }

    val m = meldung
    if (m != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text(if (m.contains("fehlgeschlagen")) "Fehler" else "Fertig") },
            text = { Text(m) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}

// ------------------------------------------------------------------ Ordner-Fenster

@Composable
private fun OrdnerDialog(model: AppModel, start: OrdnerForm, neu: Boolean, onDismiss: () -> Unit, onGeloescht: (String?) -> Unit) {
    var f by remember(start.id) { mutableStateOf(start) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var loeschen by remember { mutableStateOf(false) }

    val gesperrt = remember(f.id, model.ordner) { Dokumente.nachfahren(model.ordner, f.id) }
    val eltern = remember(model.ordner, gesperrt) {
        val m = linkedMapOf("" to "(oberste Ebene)")
        model.ordner.filter { it.id !in gesperrt }.sortedBy { Dokumente.pfadText(model.ordner, it.id).lowercase() }
            .forEach { m[it.id] = Dokumente.pfadText(model.ordner, it.id) }
        m
    }
    val kategorien = remember {
        val m = linkedMapOf("" to "(keine)")
        Kategorie.ALLE.forEach { m[it] = Kategorie.titel(it) }
        m
    }

    Aktionsdialog(
        titel = if (neu) "Neuer Ordner" else "Ordner bearbeiten",
        onDismiss = onDismiss,
        inhalt = {
            Feld("Name", f.name, { f = f.copy(name = it) })
            Auswahl("Übergeordneter Ordner", eltern, f.parentId) { f = f.copy(parentId = it) }
            Auswahl("Kategorie", kategorien, f.kategorie) { f = f.copy(kategorie = it) }
            Text("Farbe", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DokumentStore.ORDNER_FARBEN.forEach { c ->
                    Box(
                        Modifier.size(36.dp).clip(CircleShape).background(farbe(c))
                            .border(if (c == f.farbe) 3.dp else 0.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                            .clickable { f = f.copy(farbe = c) },
                    )
                }
            }
            Feld("Beschreibung (freiwillig)", f.beschreibung, { f = f.copy(beschreibung = it) }, singleLine = false)
            if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error)
        },
        aktionen = {
            Button(
                onClick = { model.ordnerSpeichern(f) { e -> if (e == null) onDismiss() else fehler = e } },
                enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
            ) { Text("Speichern") }
            if (!neu) OutlinedButton(onClick = { loeschen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Ordner löschen") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )

    if (loeschen) {
        val (unterordner, dokumente) = DokumentStore.ordnerInhalt(model.store, f.id)
        AlertDialog(
            onDismissRequest = { loeschen = false },
            title = { Text("Ordner „${f.name}“ löschen?") },
            text = {
                Text(
                    "Der Ordner enthält $unterordner Unterordner und ${dokumentZahl(dokumente)} (mit allen Unterordnern). " +
                        "Die Unterordner werden mit gelöscht. Die Dokumente bleiben erhalten und stehen danach ohne Ordner.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    loeschen = false
                    model.ordnerLoeschen(f.id) { e -> if (e == null) onGeloescht(start.parentId.ifEmpty { null }) else fehler = e }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}

// ------------------------------------------------------------------ Verschieben

@Composable
private fun VerschiebenDialog(model: AppModel, anzahl: Int, onDismiss: () -> Unit, onWahl: (String?, String?) -> Unit) {
    var ziel by remember { mutableStateOf<String?>(null) }
    var uebernehmen by remember { mutableStateOf(true) }
    val optionen = remember(model.ordner) {
        listOf<Pair<String?, String>>(null to "(ohne Ordner)") +
            model.ordner.map { it.id to Dokumente.pfadText(model.ordner, it.id) }.sortedBy { it.second.lowercase() }
    }
    val zielKategorie = ziel?.let { z -> model.ordner.firstOrNull { it.id == z }?.kategorie }?.takeIf { it in Kategorie.ALLE }

    Aktionsdialog(
        titel = "${dokumentZahl(anzahl)} verschieben",
        onDismiss = onDismiss,
        inhalt = {
            optionen.forEach { (id, name) ->
                Row(Modifier.fillMaxWidth().clickable { ziel = id }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = ziel == id, onClick = { ziel = id })
                    Text(name)
                }
            }
            if (zielKategorie != null) {
                Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = uebernehmen, onCheckedChange = { uebernehmen = it })
                    Text("Kategorie „${Kategorie.titel(zielKategorie)}“ des Ordners übernehmen")
                }
            }
        },
        aktionen = {
            Button(onClick = { onWahl(ziel, if (zielKategorie != null && uebernehmen) zielKategorie else null) }, modifier = Modifier.fillMaxWidth()) { Text("Verschieben") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

// ------------------------------------------------------------------ Einzelnes Dokument

@Composable
private fun Zeile(label: String, wert: String) {
    if (wert.isBlank()) return
    Column(Modifier.padding(top = 8.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(wert)
    }
}

@Composable
fun DokumentDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onAnzeigen: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val d = model.dokumente.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val speichern = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(d?.dateiTyp?.takeIf { it.isNotBlank() } ?: "application/octet-stream")) { uri ->
        if (uri != null) model.dokumentSpeichernUnter(id, uri) { meldung = it }
    }

    if (d == null) {
        Text("Das Dokument gibt es nicht mehr.", modifier.padding(16.dp))
        return
    }

    fun weitergeben() {
        thread {
            val datei = model.dokumentDatei(id)
            dokHandler.post {
                if (datei == null) {
                    meldung = "Die Datei ist nicht mehr vorhanden."
                } else {
                    try {
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", datei.datei)
                        val senden = Intent(Intent.ACTION_SEND).setType(datei.mime).putExtra(Intent.EXTRA_STREAM, uri)
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        context.startActivity(Intent.createChooser(senden, "Weitergeben"))
                    } catch (e: Exception) {
                        meldung = "Weitergeben nicht möglich: ${e.message ?: "keine passende App"}"
                    }
                }
            }
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text(d.titel.ifEmpty { d.dateiName }, style = MaterialTheme.typography.headlineSmall)
        Zeile("Datei", "${d.dateiName} (${groesse(d.groesse)})")
        Zeile("Kategorie", Kategorie.titel(d.kategorie))
        Zeile("Ordner", if (d.ordnerId == null) "(ohne Ordner)" else Dokumente.pfadText(model.ordner, d.ordnerId))
        Zeile("Datum", if (d.datum.isEmpty()) "" else deDate(d.datum))
        Zeile("Schlagworte", d.tags.joinToString(", "))
        Zeile("Mitglied", d.mitgliedName)
        Zeile("Buchung", d.buchungNummer)
        Zeile("Notiz", d.notiz)
        Button(onClick = onAnzeigen, enabled = d.dateiId != null, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Anzeigen") }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf("Weitergeben", { weitergeben() }, Modifier.weight(1f), enabled = d.dateiId != null && !model.busy)
            KompaktKnopf("Speichern unter …", { speichern.launch(d.dateiName.ifEmpty { "Dokument" }) }, Modifier.weight(1f), enabled = d.dateiId != null && !model.busy)
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf("Bearbeiten", onEdit, Modifier.weight(1f), enabled = !model.busy)
            KompaktKnopf("Löschen", { loeschen = true }, Modifier.weight(1f), enabled = !model.busy)
        }
    }

    if (loeschen) {
        val buchung = if (d.buchungId.isEmpty()) null else model.store.get("transactions", d.buchungId)
        val istBelegDerBuchung = buchung != null && d.dateiId != null && Belege.dateiId(buchung) == d.dateiId
        AlertDialog(
            onDismissRequest = { loeschen = false },
            title = { Text("Dokument löschen?") },
            text = {
                Text(
                    "„${d.titel.ifEmpty { d.dateiName }}“ wird gelöscht. Die Datei wird entfernt, wenn kein anderes Dokument sie braucht." +
                        if (istBelegDerBuchung) "\n\nDieses Dokument ist der Beleg der Buchung ${d.buchungNummer.ifEmpty { "(ohne Nummer)" }}. Der Beleg wird dort ebenfalls entfernt." else "",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    loeschen = false
                    model.dokumenteLoeschen(listOf(id)) { _, f -> if (f == null) onDeleted() else meldung = "Löschen fehlgeschlagen: $f" }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }

    val m = meldung
    if (m != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text(if (m == "Datei gespeichert.") "Fertig" else "Hinweis") },
            text = { Text(m) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}

@Composable
fun DokumentAnsichtScreen(model: AppModel, id: String, modifier: Modifier = Modifier) =
    DateiAnsicht("dok-$id", { model.dokumentDatei(id) }, "Die Datei", modifier)

// ------------------------------------------------------------------ Hinzufügen und Bearbeiten

/** Ein Fenster zum Suchen und Wählen aus einer Liste (Mitglied oder Buchung). Zeigt höchstens 30 Treffer. */
@Composable
private fun WahlDialog(titel: String, eintraege: List<Pair<String, String>>, onDismiss: () -> Unit, onWahl: (String) -> Unit) {
    var q by remember { mutableStateOf("") }
    val treffer = eintraege.filter { q.isBlank() || it.second.contains(q.trim(), ignoreCase = true) }
    Aktionsdialog(
        titel = titel,
        onDismiss = onDismiss,
        inhalt = {
            OutlinedTextField(value = q, onValueChange = { q = it }, label = { Text("Suchen") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            if (treffer.isEmpty()) Text("Nichts gefunden.", Modifier.padding(top = 8.dp))
            treffer.take(30).forEach { (id, name) ->
                TextButton(onClick = { onWahl(id) }, modifier = Modifier.fillMaxWidth()) {
                    Text(name, Modifier.fillMaxWidth(), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            if (treffer.size > 30) Text("… und ${treffer.size - 30} weitere. Bitte die Suche verfeinern.", style = MaterialTheme.typography.bodySmall)
        },
        aktionen = { TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") } },
    )
}

/**
 * id == null: neues Dokument – zuerst Datei wählen oder Foto aufnehmen, dann die Angaben. Sonst: Angaben eines vorhandenen
 * Dokuments ändern (die Datei bleibt).
 */
@Composable
fun DokumentFormScreen(model: AppModel, id: String?, ordnerVorgabe: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var meldung by remember { mutableStateOf<String?>(null) }

    if (id == null) {
        DisposableEffect(Unit) { onDispose { model.dokEntwurf = null; model.fotosVerwerfen() } }
    }

    val vorhanden = id?.let { i -> model.dokumente.firstOrNull { it.id == i } }
    if (id != null && vorhanden == null) {
        Text("Das Dokument gibt es nicht mehr.", modifier.padding(16.dp))
        return
    }
    val entwurf = model.dokEntwurf

    if (id == null && entwurf == null) {
        DateiWahl(model, onAbbrechen = onDone, modifier = modifier, meldung = { meldung = it })
    } else {
        val start = remember(id, entwurf) {
            vorhanden?.let { DokumentForm.von(it) } ?: DokumentForm(
                id = DokumentStore.neueId(),
                titel = entwurf!!.name.substringBeforeLast('.', entwurf.name),
                kategorie = ordnerVorgabe?.let { o -> model.ordner.firstOrNull { it.id == o }?.kategorie }?.takeIf { it in Kategorie.ALLE } ?: "sonstiges",
                ordnerId = ordnerVorgabe.orEmpty(), datum = LocalDate.now().toString(),
            )
        }
        var f by remember(start.id) { mutableStateOf(start) }
        var fehler by remember { mutableStateOf<String?>(null) }
        var waehleMitglied by remember { mutableStateOf(false) }
        var waehleBuchung by remember { mutableStateOf(false) }

        val ordnerAuswahl = remember(model.ordner) {
            val m = linkedMapOf("" to "(ohne Ordner)")
            model.ordner.sortedBy { Dokumente.pfadText(model.ordner, it.id).lowercase() }.forEach { m[it.id] = Dokumente.pfadText(model.ordner, it.id) }
            m
        }
        val kategorien = remember { Kategorie.ALLE.associateWith { Kategorie.titel(it) } }

        Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
            if (entwurf != null) Text("Datei: ${entwurf.name} (${groesse(entwurf.bytes.size.toLong())})", style = MaterialTheme.typography.bodyMedium)
            if (vorhanden != null) Text("Datei: ${vorhanden.dateiName} (${groesse(vorhanden.groesse)})", style = MaterialTheme.typography.bodyMedium)
            Feld("Titel", f.titel, { f = f.copy(titel = it) })
            Auswahl("Kategorie", kategorien, f.kategorie) { f = f.copy(kategorie = it) }
            Auswahl("Ordner", ordnerAuswahl, f.ordnerId) { neuerOrdner ->
                val kat = model.ordner.firstOrNull { it.id == neuerOrdner }?.kategorie?.takeIf { it in Kategorie.ALLE }
                f = f.copy(ordnerId = neuerOrdner, kategorie = kat ?: f.kategorie)
            }
            DatumFeld("Datum", f.datum, optional = true) { f = f.copy(datum = it) }
            Feld("Schlagworte", f.tags, { f = f.copy(tags = it) }, hinweis = "Mit Komma trennen")
            Feld("Notiz", f.notiz, { f = f.copy(notiz = it) }, singleLine = false)

            Text("Mitglied (freiwillig)", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(f.mitgliedName.ifEmpty { "kein Mitglied verknüpft" }, Modifier.weight(1f))
                OutlinedButton(onClick = { waehleMitglied = true }) { Text("Wählen") }
                if (f.mitgliedId.isNotEmpty()) TextButton(onClick = { f = f.copy(mitgliedId = "", mitgliedName = "") }) { Text("Entfernen") }
            }
            Text("Buchung (freiwillig)", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (f.buchungId.isEmpty()) "keine Buchung verknüpft" else f.buchungNummer.ifEmpty { "Buchung ohne Nummer" }, Modifier.weight(1f))
                OutlinedButton(onClick = { waehleBuchung = true }) { Text("Wählen") }
                if (f.buchungId.isNotEmpty()) TextButton(onClick = { f = f.copy(buchungId = "", buchungNummer = "") }) { Text("Entfernen") }
            }

            if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
            Button(
                onClick = {
                    val problem = DokumentStore.pruefen(f)
                    if (problem != null) {
                        fehler = problem
                    } else {
                        fehler = null
                        val fertig: (String?) -> Unit = { e -> if (e == null) onDone() else fehler = e }
                        if (vorhanden != null) model.dokumentAendern(f, fertig) else model.dokumentSpeichern(f, fertig)
                    }
                },
                enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text(if (vorhanden != null) "Speichern" else "Dokument ablegen") }
            OutlinedButton(onClick = onDone, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("Abbrechen") }
        }

        if (waehleMitglied) {
            WahlDialog(
                "Mitglied wählen",
                model.members.sortedBy { it.lastName.lowercase() }.map { it.id to "${it.number} ${it.firstName} ${it.lastName}".trim() },
                onDismiss = { waehleMitglied = false },
                onWahl = { mid ->
                    val mm = model.members.firstOrNull { it.id == mid }
                    f = f.copy(mitgliedId = mid, mitgliedName = if (mm == null) "" else "${mm.firstName} ${mm.lastName}".trim())
                    waehleMitglied = false
                },
            )
        }
        if (waehleBuchung) {
            WahlDialog(
                "Buchung wählen",
                model.buchungen.sortedByDescending { it.datum }.map { it.id to listOf(it.belegNummer, deDate(it.datum), it.partner.ifEmpty { it.text }).filter { s -> s.isNotEmpty() }.joinToString(" · ") },
                onDismiss = { waehleBuchung = false },
                onWahl = { bid ->
                    val b = model.buchungen.firstOrNull { it.id == bid }
                    f = f.copy(buchungId = bid, buchungNummer = b?.belegNummer.orEmpty())
                    waehleBuchung = false
                },
            )
        }
    }

    val m = meldung
    if (m != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text("Hinweis") },
            text = { Text(m) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}

/** Erster Schritt beim Hinzufügen: eine Datei wählen oder ein Foto aufnehmen. */
@Composable
private fun DateiWahl(model: AppModel, onAbbrechen: () -> Unit, modifier: Modifier, meldung: (String) -> Unit) {
    val dateiLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.dokumentDateiWaehlen(uri) { f -> if (f != null) meldung("Die Datei lässt sich nicht übernehmen: $f") }
    }
    val kamera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> model.fotoAufgenommen(ok) }
    fun fotoMachen() {
        try {
            kamera.launch(model.neuesFotoZiel(FOTO_ZIEL))
        } catch (e: Exception) {
            meldung("Die Kamera lässt sich nicht starten: ${e.message ?: "keine Kamera-App gefunden"}")
        }
    }

    Column(modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Welche Datei soll abgelegt werden?", style = MaterialTheme.typography.titleMedium)
        Text("Jede Dateiart ist möglich, bis ${DokumentStore.MAX_GROESSE / 1024 / 1024} MB. Fotos werden verkleinert und zu einer PDF gemacht.")
        Button(onClick = { dateiLauncher.launch(arrayOf("*/*")) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Datei wählen") }
        OutlinedButton(onClick = { model.fotosVerwerfen(); fotoMachen() }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Foto aufnehmen") }
        TextButton(onClick = onAbbrechen, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    }

    // Aufgenommene Seiten: dasselbe Fenster wie beim Beleg, nur dass am Ende ein Entwurf entsteht.
    if (model.fotoSeiten.isNotEmpty() && model.fotoBuchungId == FOTO_ZIEL && !model.busy) {
        Aktionsdialog(
            titel = "Foto aufgenommen",
            onDismiss = null,
            inhalt = {
                model.fotoSeiten.forEachIndexed { i, s ->
                    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text("Seite ${i + 1}" + if (s.edit.istUnveraendert) "" else " (bearbeitet)", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            KompaktKnopf("Zuschneiden / Drehen", { model.fotoBearbeiten = i }, Modifier.weight(1f))
                            OutlinedButton(onClick = { model.fotoEntfernen(i) }) { Text("Entfernen") }
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = model.fotoGrau, onCheckedChange = { model.fotoGrau = it })
                    Text("Graustufen (kleinere Datei)")
                }
            },
            aktionen = {
                Button(
                    onClick = { model.dokumentAusFotos { f -> if (f != null) meldung("Die PDF konnte nicht erstellt werden: $f") } },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Fertig – weiter zu den Angaben") }
                OutlinedButton(onClick = { fotoMachen() }, modifier = Modifier.fillMaxWidth()) { Text("Weitere Seite aufnehmen") }
                TextButton(onClick = { model.fotosVerwerfen() }, modifier = Modifier.fillMaxWidth()) { Text("Alles verwerfen") }
            },
        )
        val nr = model.fotoBearbeiten
        val ent = if (nr != null) model.fotoSeiten.getOrNull(nr) else null
        if (nr != null && ent != null) {
            SeitenEditor(ent, onFertig = { model.fotoBearbeiten = null }, onVerwerfen = { model.fotoEntfernen(nr) })
        }
    }
}

/** Kennzeichnet in [AppModel.fotoBuchungId], dass aufgenommene Seiten zu einem neuen Dokument gehören (nicht zu einer Buchung). */
private const val FOTO_ZIEL = "dokument"
