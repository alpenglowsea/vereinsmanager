package de.vereinsmanager.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.PdfWriter
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.sepa.Beitragslauf
import de.vereinsmanager.core.sepa.Lauf
import de.vereinsmanager.core.sepa.LaufParameter
import de.vereinsmanager.core.sepa.SepaItem
import de.vereinsmanager.core.sepa.SepaPeriodFilter
import java.math.BigDecimal
import java.time.LocalDate

private fun euro(b: BigDecimal) = Export.fixed2(b) + " €"

private fun maskiert(iban: String) = if (iban.isEmpty()) "keine IBAN" else iban.take(6) + "..." + iban.takeLast(4)

/** Beitragslauf: Lastschrifteinzug der Mitgliedsbeiträge vorbereiten, als SEPA-Datei und Prüfprotokoll ausgeben, frühere Läufe ansehen. */
@Composable
fun BeitragslaufScreen(model: AppModel, onEinstellungen: () -> Unit, modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(0) }
    Column(modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Neuer Lauf") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Historie (${model.laeufe.size})") })
        }
        if (tab == 0) NeuerLauf(model, onEinstellungen) else Historie(model)
    }
}

@Composable
private fun NeuerLauf(model: AppModel, onEinstellungen: () -> Unit) {
    val heute = remember { LocalDate.now() }
    var filter by remember { mutableStateOf(SepaPeriodFilter.MONTHLY_1) }
    var jahr by remember { mutableStateOf(heute.year) }
    var monat by remember { mutableStateOf(heute.monthValue) }
    var quartal by remember { mutableStateOf((heute.monthValue - 1) / 3 + 1) }
    var halbjahr by remember { mutableStateOf(if (heute.monthValue <= 6) 1 else 2) }
    var ausfuehrung by remember { mutableStateOf(heute.plusDays(5).toString()) }
    var titel by remember { mutableStateOf("") }
    var vorlage by remember { mutableStateOf(Beitragslauf.STANDARD_VORLAGE) }
    var suche by remember { mutableStateOf("") }
    var gueltigFilter by remember { mutableStateOf<String?>(null) }
    var sparte by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }
    var betragFuer by remember { mutableStateOf<SepaItem?>(null) }

    val p = LaufParameter(filter, jahr, monat, quartal, halbjahr, ausfuehrung, titel, vorlage)
    val basis = remember(model.members, filter, jahr, monat, quartal, halbjahr, vorlage, ausfuehrung) {
        Beitragslauf.vorbereiten(model.members.map { it.raw }, p)
    }
    // Abwahl und geänderte Beträge gelten nur für den eingestellten Zeitraum
    var abgewaehlt by remember(filter, jahr, monat, quartal, halbjahr) { mutableStateOf(emptySet<String>()) }
    var betraege by remember(filter, jahr, monat, quartal, halbjahr) { mutableStateOf(emptyMap<String, BigDecimal>()) }
    val posten = remember(basis, abgewaehlt, betraege) {
        basis.map { i -> i.copy(amount = betraege[i.memberId] ?: i.amount, selected = i.isValid && i.memberId !in abgewaehlt) }
    }
    val aktive = remember(posten) { posten.filter { it.selected && it.isValid && it.amount.signum() > 0 } }
    val summe = aktive.fold(BigDecimal.ZERO) { s, i -> s + i.amount }
    val ungueltig = posten.count { !it.isValid }
    val sparten = remember(posten) { posten.mapNotNull { it.department?.takeIf { d -> d.isNotEmpty() } }.distinct().sorted().associateWith { it } }
    val sichtbar = remember(posten, suche, gueltigFilter, sparte) {
        val q = suche.trim().lowercase()
        posten.filter { i ->
            (q.isEmpty() || i.memberName.lowercase().contains(q) || i.memberNumber.lowercase().contains(q) || i.accountHolder.lowercase().contains(q)) &&
                (gueltigFilter == null || (gueltigFilter == "gueltig") == i.isValid) &&
                (sparte == null || i.department == sparte)
        }
    }
    val exporter = rememberExporter(model) { info = it }
    val g = model.glaeubiger
    val kannErzeugen = !model.busy && g != null && aktive.isNotEmpty()

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (model.lastschriftFehlt != null) item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Vereinsdaten unvollständig", fontWeight = FontWeight.SemiBold)
                    Text("Für einen Lastschrifteinzug fehlt noch: ${model.lastschriftFehlt}")
                    OutlinedButton(onClick = onEinstellungen) { Text("Zu den Einstellungen") }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Auswahl("Zeitraum", Beitragslauf.FILTER_TEXT.entries.associate { it.key.wire to it.value }, filter.wire) {
                        filter = SepaPeriodFilter.fromWire(it) ?: filter
                    }
                    val jahre = (heute.year - 1..heute.year + 1).associate { it.toString() to it.toString() }
                    Auswahl("Jahr", jahre, jahr.toString()) { jahr = it.toInt() }
                    when {
                        Beitragslauf.istMonatlich(filter) ->
                            Auswahl("Monat", (1..12).associate { it.toString() to Beitragslauf.monatsname(it) }, monat.toString()) { monat = it.toInt() }
                        filter == SepaPeriodFilter.QUARTERLY ->
                            Auswahl("Quartal", (1..4).associate { it.toString() to "Q$it" }, quartal.toString()) { quartal = it.toInt() }
                        filter == SepaPeriodFilter.HALF_YEARLY ->
                            Auswahl("Halbjahr", (1..2).associate { it.toString() to "H$it" }, halbjahr.toString()) { halbjahr = it.toInt() }
                    }
                    DatumFeld("Ausführungsdatum (Fälligkeit)", ausfuehrung) { ausfuehrung = it }
                    Feld("Titel", titel, { titel = it }, hinweis = "Leer lassen: ${Beitragslauf.titel(p.copy(titel = ""))}")
                    Feld("Verwendungszweck", vorlage, { vorlage = it }, hinweis = "Platzhalter: {PERIOD} {month} {year} {MEMBER_NO} {NAME} {DEPT}")
                }
            }
        }
        item {
            Text(
                "${aktive.size} von ${posten.size} Posten ausgewählt · Summe ${euro(summe)}" + if (ungueltig > 0) " · $ungueltig fehlerhaft" else "",
                fontWeight = FontWeight.SemiBold,
            )
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Feld("Suchen (Name, Nummer, Kontoinhaber)", suche, { suche = it })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterMenu("Status", linkedMapOf("gueltig" to "Nur gültige", "ungueltig" to "Nur fehlerhafte"), gueltigFilter) { gueltigFilter = it }
                    if (sparten.isNotEmpty()) FilterMenu("Sparte", sparten, sparte) { sparte = it }
                }
            }
        }
        if (posten.isEmpty()) item { Text("Für diesen Zeitraum gibt es keine Mitglieder mit Lastschrift.") }
        items(sichtbar, key = { it.memberId }) { i ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = i.selected,
                        onCheckedChange = { an -> abgewaehlt = if (an) abgewaehlt - i.memberId else abgewaehlt + i.memberId },
                        enabled = i.isValid,
                    )
                    Column(Modifier.weight(1f).clickable(enabled = i.isValid) { betragFuer = i }.padding(vertical = 8.dp)) {
                        Text("${i.memberNumber} · ${i.memberName}", fontWeight = FontWeight.SemiBold)
                        Text("${i.accountHolder} · ${maskiert(i.iban)}", style = MaterialTheme.typography.bodySmall)
                        if (i.mandateReference.isNotEmpty()) Text("Mandat ${i.mandateReference} · ${i.sequenceType}", style = MaterialTheme.typography.bodySmall)
                        if (!i.isValid) Text(i.validationErrors.joinToString("; "), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    Text(euro(i.amount), fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                Button(
                    onClick = {
                        model.laufErzeugen(p, posten) { erg, fehler ->
                            if (erg == null) info = fehler ?: "Der Lauf konnte nicht erzeugt werden."
                            else exporter.xml(erg.xmlDateiname) { erg.xml }
                        }
                    },
                    enabled = kannErzeugen, modifier = Modifier.fillMaxWidth(),
                ) { Text("SEPA-Datei erstellen und speichern") }
                OutlinedButton(
                    onClick = {
                        val proto = Beitragslauf.protokoll(p, posten, g!!)
                        exporter.pdfSchreiber(proto.dateiname) { out -> PdfWriter.sepaProtokoll(proto, out) }
                    },
                    enabled = kannErzeugen, modifier = Modifier.fillMaxWidth(),
                ) { Text("Prüfprotokoll (PDF)") }
                Text(
                    "Beim Erstellen wird der Lauf in der Historie abgelegt. Die Mandatsfolge (Erst-/Folgelastschrift) wird dabei nicht verändert.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }

    val b = betragFuer
    if (b != null) {
        var text by remember(b.memberId) { mutableStateOf(Export.fixed2(b.amount).replace('.', ',')) }
        val wert = text.trim().replace(',', '.').toBigDecimalOrNull()
        AlertDialog(
            onDismissRequest = { betragFuer = null },
            title = { Text("Betrag ändern") },
            text = {
                Column {
                    Text(b.memberName)
                    Feld("Betrag in €", text, { text = it }, error = if (wert == null || wert.signum() < 0) "Bitte einen Betrag ab 0 eingeben." else null,
                        keyboard = androidx.compose.ui.text.input.KeyboardType.Decimal)
                    Text("Gilt nur für diesen Lauf, nicht für das Mitglied.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { betraege = betraege + (b.memberId to wert!!.setScale(2, java.math.RoundingMode.HALF_UP)); betragFuer = null },
                    enabled = wert != null && wert.signum() >= 0,
                ) { Text("Übernehmen") }
            },
            dismissButton = { TextButton(onClick = { betragFuer = null }) { Text("Abbrechen") } },
        )
    }
    val m = info
    if (m != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Hinweis") }, text = { Text(m) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

@Composable
private fun Historie(model: AppModel) {
    var info by remember { mutableStateOf<String?>(null) }
    var loeschen by remember { mutableStateOf<Lauf?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val g = model.glaeubiger

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (model.laeufe.isEmpty()) item { Text("Noch kein Lauf erstellt.") }
        items(model.laeufe, key = { it.id }) { l ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(l.titel, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Ausführung ${deDate(l.ausfuehrung)} · ${l.aktive.size} Posten · ${euro(l.summe)}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(
                        "Erstellt ${l.erstellt.take(10).let { deDate(it) }}" + if (l.gebucht) " · verbucht" else " · nicht verbucht",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { exporter.xml(Beitragslauf.xmlDateiname(l.titel, l.ausfuehrung)) { l.xml.orEmpty() } },
                            enabled = !l.xml.isNullOrEmpty() && !model.busy, modifier = Modifier.weight(1f),
                        ) { Text("XML") }
                        OutlinedButton(
                            onClick = {
                                if (g == null) info = "Für das Protokoll fehlen Vereinsdaten: ${model.lastschriftFehlt ?: "bitte in den Einstellungen ergänzen"}."
                                else {
                                    val proto = Beitragslauf.protokoll(Beitragslauf.parameterVon(l), l.posten, g)
                                    exporter.pdfSchreiber(proto.dateiname) { out -> PdfWriter.sepaProtokoll(proto, out) }
                                }
                            },
                            enabled = !model.busy, modifier = Modifier.weight(1f),
                        ) { Text("Protokoll") }
                        OutlinedButton(onClick = { loeschen = l }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Löschen") }
                    }
                }
            }
        }
    }

    val l = loeschen
    if (l != null) AlertDialog(
        onDismissRequest = { loeschen = null },
        title = { Text("Lauf löschen?") },
        text = {
            Text(
                "„${l.titel}“ wird aus der Historie entfernt." +
                    if (l.gebucht) " Die dazu verbuchten Buchungen bleiben bestehen." else "",
            )
        },
        confirmButton = {
            TextButton(onClick = { model.laufLoeschen(l.id) { e -> loeschen = null; if (e != null) info = e } }, enabled = !model.busy) { Text("Löschen") }
        },
        dismissButton = { TextButton(onClick = { loeschen = null }) { Text("Abbrechen") } },
    )
    val m = info
    if (m != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Hinweis") }, text = { Text(m) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}
