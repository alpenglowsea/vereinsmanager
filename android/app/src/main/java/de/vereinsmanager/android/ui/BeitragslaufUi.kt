package de.vereinsmanager.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material3.Surface
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.BoxWithConstraints
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
import de.vereinsmanager.core.sepa.SepaFormat
import de.vereinsmanager.core.sepa.SepaPeriodFilter
import java.math.BigDecimal
import java.time.LocalDate

private fun maskiert(iban: String) = if (iban.isEmpty()) "keine IBAN" else iban.take(6) + "..." + iban.takeLast(4)

/** Beitragslauf: Lastschrifteinzug der Mitgliedsbeiträge vorbereiten, als SEPA-Datei und Prüfprotokoll ausgeben, frühere Läufe ansehen. */
@Composable
fun BeitragslaufScreen(model: AppModel, onEinstellungen: () -> Unit, modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(0) }
    Column(modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TabChip("Neuer Lauf", tab == 0) { tab = 0 }
            TabChip("Historie (${model.laeufe.size})", tab == 1) { tab = 1 }
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
    var format by remember { mutableStateOf(SepaFormat.PAIN_008_001_08) }
    var suche by remember { mutableStateOf("") }
    var gueltigFilter by remember { mutableStateOf<String?>(null) }
    var sparte by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }
    var betragFuer by remember { mutableStateOf<SepaItem?>(null) }

    val p = LaufParameter(filter, jahr, monat, quartal, halbjahr, ausfuehrung, titel, vorlage, format)
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

    val sc = MaterialTheme.colorScheme
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp)) {
        if (model.lastschriftFehlt != null) item {
            Surface(shape = RoundedCornerShape(24.dp), color = sc.errorContainer, modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Vereinsdaten unvollständig", fontWeight = FontWeight.ExtraBold, color = sc.onErrorContainer)
                    Text("Für einen Lastschrifteinzug fehlt noch: ${model.lastschriftFehlt}", color = sc.onErrorContainer)
                    OutlinedButton(onClick = onEinstellungen) { Text("Zu den Einstellungen") }
                }
            }
        }
        item {
            val werte = listOf("${aktive.size} von ${posten.size}", euro(summe), ungueltig.toString())
            BoxWithConstraints(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                val gr = kachelSchrift(maxWidth, listOf(1f, 1.3f, 1f), werte.map { it.length }, 24f)
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatKachel("Posten", werte[0], "ausgewählt", sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                    StatKachel("Summe", werte[1], "dieser Lauf", sc.primaryContainer, sc.onPrimaryContainer, Modifier.weight(1.3f).fillMaxHeight(), gr)
                    if (ungueltig > 0) StatKachel("Fehlerhaft", werte[2], "bitte prüfen", sc.errorContainer, sc.onErrorContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                    else StatKachel("Fehlerhaft", werte[2], "alles in Ordnung", sc.tertiaryContainer, sc.onTertiaryContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                }
            }
        }
        item {
            DetailKarte("Zeitraum und Datei") {
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
                Auswahl("Dateiformat", SepaFormat.entries.associate { it.wire to it.text }, format.wire) { format = SepaFormat.fromWire(it) ?: format }
                Feld("Titel", titel, { titel = it }, hinweis = "Leer lassen: ${Beitragslauf.titel(p.copy(titel = ""))}")
                Feld("Verwendungszweck", vorlage, { vorlage = it }, hinweis = "Platzhalter: {PERIOD} {month} {year} {MEMBER_NO} {NAME} {DEPT}")
            }
        }
        item {
            Column(Modifier.padding(top = 8.dp)) {
                Text("Posten", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
                SuchFeld(suche, { suche = it }, "Mitglied suchen …", Modifier.padding(top = 8.dp))
                Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterMenu("Status", linkedMapOf("gueltig" to "Nur gültige", "ungueltig" to "Nur fehlerhafte"), gueltigFilter) { gueltigFilter = it }
                    if (sparten.isNotEmpty()) FilterMenu("Sparte", sparten, sparte) { sparte = it }
                }
            }
        }
        if (posten.isEmpty()) item { Text("Für diesen Zeitraum gibt es keine Mitglieder mit Lastschrift.", color = sc.onSurfaceVariant) }
        itemsIndexed(sichtbar, key = { _, i -> i.memberId }) { n, i ->
            ListenKarte(
                erste = n == 0, letzte = n == sichtbar.lastIndex, angehakt = false,
                onClick = { if (i.isValid) betragFuer = i }, onLongClick = {},
            ) {
                Checkbox(
                    checked = i.selected,
                    onCheckedChange = { an -> abgewaehlt = if (an) abgewaehlt - i.memberId else abgewaehlt + i.memberId },
                    enabled = i.isValid,
                )
                Column(Modifier.weight(1f).padding(horizontal = 6.dp)) {
                    Text("${i.memberNumber} · ${i.memberName}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("${i.accountHolder} · ${maskiert(i.iban)}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (i.mandateReference.isNotEmpty()) Text("Mandat ${i.mandateReference} · ${i.sequenceType}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (!i.isValid) Text(i.validationErrors.joinToString("; "), color = sc.error, style = MaterialTheme.typography.bodySmall)
                }
                Text(euro(i.amount), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall, maxLines = 1, softWrap = false)
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
                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant,
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
    var verbuchen by remember { mutableStateOf<Lauf?>(null) }
    var folgeFuer by remember { mutableStateOf<Pair<String, List<SepaItem>>?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val g = model.glaeubiger

    val sc = MaterialTheme.colorScheme
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp)) {
        if (model.laeufe.isEmpty()) item { Text("Noch kein Lauf erstellt.", color = sc.onSurfaceVariant) }
        items(model.laeufe, key = { it.id }) { l ->
            DetailKarte(l.titel) {
                Text(
                    "Ausführung ${deDate(l.ausfuehrung)} · ${l.aktive.size} Posten · ${euro(l.summe)}",
                    style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold,
                )
                Text(
                    "Erstellt ${l.erstellt.take(10).let { deDate(it) }}" +
                        if (l.gebucht) " · verbucht" + (model.konten.firstOrNull { it.id == l.gebuchtAufKonto }?.let { " auf ${it.name}" } ?: "") else " · nicht verbucht",
                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant,
                )
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KompaktKnopf(
                        "XML", { exporter.xml(Beitragslauf.xmlDateiname(l.titel, l.ausfuehrung)) { l.xml.orEmpty() } },
                        Modifier.weight(1f), enabled = !l.xml.isNullOrEmpty() && !model.busy,
                    )
                    KompaktKnopf(
                        "Protokoll",
                        {
                            if (g == null) info = "Für das Protokoll fehlen Vereinsdaten: ${model.lastschriftFehlt ?: "bitte in den Einstellungen ergänzen"}."
                            else {
                                val proto = Beitragslauf.protokoll(Beitragslauf.parameterVon(l), l.posten, g)
                                exporter.pdfSchreiber(proto.dateiname) { out -> PdfWriter.sepaProtokoll(proto, out) }
                            }
                        },
                        Modifier.weight(1f), enabled = !model.busy,
                    )
                    KompaktKnopf("Löschen", { loeschen = l }, Modifier.weight(1f), enabled = !model.busy)
                }
                if (!l.gebucht && l.aktive.isNotEmpty()) {
                    Button(onClick = { verbuchen = l }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("Als Einnahmen verbuchen …") }
                }
            }
        }
    }

    val v = verbuchen
    if (v != null) VerbuchenDialog(
        model, v, onDismiss = { verbuchen = null },
        onFertig = { text, folge -> verbuchen = null; if (folge.isEmpty()) info = text else folgeFuer = text to folge },
    )
    val ff = folgeFuer
    if (ff != null) FolgeDialog(model, ff.first, ff.second, onDismiss = { folgeFuer = null; info = ff.first }, onErgebnis = { folgeFuer = null; info = ff.first + " " + it })

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

@Composable
private fun VerbuchenDialog(model: AppModel, l: Lauf, onDismiss: () -> Unit, onFertig: (String, List<SepaItem>) -> Unit) {
    val konten = model.konten
    var kontoId by remember { mutableStateOf(konten.firstOrNull { it.art == "bank" }?.id ?: konten.firstOrNull()?.id.orEmpty()) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val summe = l.aktive.fold(BigDecimal.ZERO) { s, i -> s + i.amount }

    Aktionsdialog(
        titel = "Lauf verbuchen?",
        onDismiss = onDismiss,
        inhalt = {
            Text("„${l.titel}“: ${l.aktive.size} Lastschriften über ${euro(summe)} werden als Einnahmen gebucht (Konto 40000, ideeller Bereich, Datum ${deDate(l.ausfuehrung)}).")
            Auswahl("Gutschrift auf Konto", konten.associate { it.id to it.name }, kontoId) { kontoId = it }
            Text("Das geht nur einmal je Lauf. Gebucht wird erst, wenn du hier bestätigst – die Bank hat das Geld zu dem Zeitpunkt vielleicht noch nicht eingezogen.", style = MaterialTheme.typography.bodySmall)
            if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error)
        },
        aktionen = {
            Button(
                onClick = {
                    model.laufVerbuchen(l.id, kontoId) { r, e ->
                        if (r == null) fehler = e ?: "Das Verbuchen ist fehlgeschlagen."
                        else onFertig("${r.anzahl} Buchungen über ${euro(r.summe)} angelegt.", model.erstlastschriften(l))
                    }
                },
                enabled = !model.busy && kontoId.isNotEmpty(), modifier = Modifier.fillMaxWidth(),
            ) { Text("Verbuchen") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

@Composable
private fun FolgeDialog(model: AppModel, ergebnis: String, posten: List<SepaItem>, onDismiss: () -> Unit, onErgebnis: (String) -> Unit) {
    Aktionsdialog(
        titel = "Auf Folgelastschrift umstellen?",
        onDismiss = onDismiss,
        inhalt = {
            Text(ergebnis, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 8.dp))
            Text("Bei ${posten.size} Mitgliedern steht das Mandat noch auf Erstlastschrift (FRST). Nach dem ersten Einzug gilt normalerweise Folgelastschrift (RCUR):")
            Text(posten.joinToString("\n") { "${it.memberNumber} · ${it.memberName}" }, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
            Text("Erst umstellen, wenn die Bank den Einzug wirklich ausgeführt hat.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        },
        aktionen = {
            Button(
                onClick = { model.aufFolgelastschrift(posten.map { it.memberId }) { n, e -> onErgebnis(e ?: "$n Mandate auf Folgelastschrift umgestellt.") } },
                enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
            ) { Text("Ja, umstellen") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Nein, so lassen") }
        },
    )
}
