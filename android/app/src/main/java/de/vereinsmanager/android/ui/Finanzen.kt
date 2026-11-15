package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.Berichte
import java.time.LocalDate
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungFilter
import de.vereinsmanager.core.finance.BuchungSortierung
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld

private val SORTIERUNG = linkedMapOf(
    BuchungSortierung.DATUM to "Datum", BuchungSortierung.BETRAG to "Betrag", BuchungSortierung.BELEGNUMMER to "Belegnr.",
    BuchungSortierung.PARTNER to "Partner", BuchungSortierung.KATEGORIE to "Kategorie", BuchungSortierung.SPHAERE to "Sphäre",
)

private val BELEG_AUSWAHL = linkedMapOf("ja" to "Mit Beleg", "nein" to "Ohne Beleg")

/** Die Kontofarben der Desktop-Fassung (Farbnamen aus dem Konto-Datensatz). */
internal fun kontoFarbe(name: String): Color = when (name) {
    "emerald" -> Color(0xFF10B981)
    "green" -> Color(0xFF22C55E)
    "blue" -> Color(0xFF3B82F6)
    "indigo" -> Color(0xFF6366F1)
    "purple", "violet" -> Color(0xFFA855F7)
    "pink" -> Color(0xFFEC4899)
    "rose" -> Color(0xFFF43F5E)
    "red" -> Color(0xFFEF4444)
    "orange" -> Color(0xFFF97316)
    "amber" -> Color(0xFFF59E0B)
    "yellow" -> Color(0xFFEAB308)
    "teal" -> Color(0xFF14B8A6)
    "cyan" -> Color(0xFF06B6D4)
    else -> Color(0xFF64748B)
}

@Composable
private fun istDunkel(): Boolean = MaterialTheme.colorScheme.surface.luminance() < 0.5f

@Composable
private fun betragFarbe(b: Buchung): Color = when {
    b.istUmbuchung -> MaterialTheme.colorScheme.onSurface
    b.istAusgabe -> if (istDunkel()) Color(0xFFEF9A9A) else Color(0xFFC62828)
    else -> if (istDunkel()) Color(0xFF81C784) else Color(0xFF2E7D32)
}

@Composable
private fun betragText(b: Buchung): String = when {
    b.istUmbuchung -> Geld.euro(b.betrag.abs())
    b.istAusgabe -> Geld.euro(b.betrag.abs().negate())
    else -> Geld.euroMitVorzeichen(b.betrag.abs())
}

/** Buchungsjournal: Kontostände oben, darunter Suche, Filter und die Buchungen als Karten-Liste. */
@Composable
fun BuchungenScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, onKonten: () -> Unit, onImport: () -> Unit, modifier: Modifier = Modifier) {
    var filter by remember { mutableStateOf(BuchungFilter()) }
    var sortierung by remember { mutableStateOf(BuchungSortierung.DATUM) }
    var aufsteigend by remember { mutableStateOf(false) }
    var sortOffen by remember { mutableStateOf(false) }
    var gewaehlt by remember { mutableStateOf<Set<String>>(emptySet()) }
    val waehlt = gewaehlt.isNotEmpty()
    // Zurück-Geste beendet zuerst die Auswahl.
    BackHandler(enabled = waehlt) { gewaehlt = emptySet() }
    var sammelOffen by remember { mutableStateOf(false) }
    var exportOffen by remember { mutableStateOf(false) }
    var loeschenOffen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }

    val konten = model.konten
    val buchungen = model.buchungen
    val staende = remember(konten, buchungen) { Finance.kontostaende(konten, buchungen) }
    val liquiditaet = remember(staende) { Finance.gesamtLiquiditaet(staende) }
    val jahre = remember(buchungen) { Finance.jahre(buchungen) }
    val kontoName = remember(konten) { konten.associate { it.id to it.name } }
    val shown = remember(buchungen, filter, sortierung, aufsteigend, konten) {
        Finance.sortieren(Finance.filtern(buchungen, filter), sortierung, aufsteigend, konten)
    }
    val summen = remember(shown) { Finance.summen(shown) }

    val liste = rememberLazyListState()
    val kopf = rememberKopfZustand(liste)

    Column(modifier.padding(horizontal = 16.dp).nestedScroll(kopf.verfolgung)) {
        Column(Modifier.einklappbar(kopf)) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KopfKnopf("Neue Buchung", onNew, Modifier.weight(1f), primaer = true)
                KopfKnopf("Import", onImport, Modifier.weight(1f))
                KopfKnopf("Export", { exportOffen = true }, Modifier.weight(1f), enabled = !waehlt)
            }
            Text("Buchungen", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
            val sc = MaterialTheme.colorScheme
            val werte = listOf(Geld.euro(summen.einnahmen), Geld.euro(summen.ausgaben), Geld.euro(summen.saldo))
            BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                // Eine gemeinsame Schriftgröße, so groß wie der längste Betrag noch in die Kachel passt.
                val innen = (maxWidth - 16.dp) / 3 - 20.dp
                val g = minOf(22f, innen.value / (werte.maxOf { it.length } * 0.62f)).coerceAtLeast(12f).sp
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    StatKachel("Einnahmen", werte[0], null, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                    StatKachel("Ausgaben", werte[1], null, sc.errorContainer, sc.onErrorContainer, gleich, g)
                    StatKachel("Saldo", werte[2], null, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                }
            }
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Surface(Modifier.width(168.dp).height(88.dp), shape = RoundedCornerShape(22.dp), color = sc.tertiaryContainer) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Gesamt-Liquidität", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = sc.onTertiaryContainer, maxLines = 1)
                        Text(Geld.euro(liquiditaet), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = sc.onTertiaryContainer, maxLines = 1)
                        Text("${konten.size} Konten & Kassen", style = MaterialTheme.typography.bodySmall, color = sc.onTertiaryContainer, maxLines = 1)
                    }
                }
                konten.forEach { k ->
                    val gewaehlt = filter.kontoId == k.id
                    Surface(
                        Modifier.width(168.dp).height(88.dp).clip(RoundedCornerShape(22.dp)).clickable { filter = filter.copy(kontoId = if (gewaehlt) null else k.id) },
                        shape = RoundedCornerShape(22.dp), color = if (gewaehlt) sc.primaryContainer else sc.surface,
                        border = BorderStroke(1.5.dp, if (gewaehlt) sc.primary else sc.outlineVariant),
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(10.dp).clip(CircleShape).background(kontoFarbe(k.farbe)))
                                Spacer(Modifier.width(6.dp))
                                Text(k.name, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, maxLines = 1)
                            }
                            Text(Geld.euro(staende[k.id] ?: k.anfangsbestand), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                            Text(k.artText, style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1)
                        }
                    }
                }
                Surface(
                    Modifier.width(140.dp).height(88.dp).clip(RoundedCornerShape(22.dp)).clickable(onClick = onKonten),
                    shape = RoundedCornerShape(22.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant),
                ) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text("Konten verwalten ›", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = sc.primary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                }
            }
            TextField(
                filter.suche, { filter = filter.copy(suche = it) }, placeholder = { Text("Buchung suchen …") },
                singleLine = true, shape = RoundedCornerShape(28.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = sc.surfaceContainer, unfocusedContainerColor = sc.surfaceContainer,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterMenu("Jahr", jahre.associateWith { it }, filter.jahr) { filter = filter.copy(jahr = it) }
                FilterMenu("Art", FinanceLabels.KIND, filter.art) { filter = filter.copy(art = it) }
                FilterMenu("Konto", kontoName, filter.kontoId) { filter = filter.copy(kontoId = it) }
                FilterMenu("Sphäre", FinanceLabels.SPHERE, filter.sphaere) { filter = filter.copy(sphaere = it) }
                FilterMenu("Beleg", BELEG_AUSWAHL, filter.mitBeleg?.let { if (it) "ja" else "nein" }) {
                    filter = filter.copy(mitBeleg = when (it) { "ja" -> true; "nein" -> false; else -> null })
                }
            }
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KompaktKnopf("Sortiert nach ${SORTIERUNG[sortierung]}", { sortOffen = true })
                KompaktKnopf(if (aufsteigend) "aufsteigend ↑" else "absteigend ↓", { aufsteigend = !aufsteigend })
                DropdownMenu(sortOffen, { sortOffen = false }) {
                    SORTIERUNG.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { sortierung = k; sortOffen = false }) }
                }
            }
        }
        Text(
            "${shown.size} von ${buchungen.size} Buchungen",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
        )
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                KompaktKnopf("Bearbeiten", { sammelOffen = true }, enabled = !model.busy, primaer = true)
                KompaktKnopf("Löschen", { loeschenOffen = true }, enabled = !model.busy)
                ExportMenue("Exportieren", exportPunkte(model, exporter, shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        Spacer(Modifier.height(6.dp))
        if (buchungen.isEmpty()) Text("Keine Buchungen. Legen Sie eine an oder spielen Sie auf der Startseite eine Sicherung ein.", Modifier.padding(top = 16.dp))
        LazyColumn(state = liste, contentPadding = PaddingValues(bottom = 96.dp)) {
            itemsIndexed(shown, key = { _, b -> b.id }) { i, b ->
                BuchungZeile(
                    b, kontoName, erste = i == 0, letzte = i == shown.lastIndex, waehlt = waehlt, angehakt = b.id in gewaehlt,
                    onLongClick = { if (b.id !in gewaehlt) gewaehlt = gewaehlt + b.id; info = null },
                    onClick = { if (waehlt) gewaehlt = if (b.id in gewaehlt) gewaehlt - b.id else gewaehlt + b.id else onOpen(b.id) },
                )
            }
        }
    }

    if (exportOffen) {
        val punkte = exportPunkte(model, exporter, shown, "angezeigte")
        AlertDialog(
            onDismissRequest = { exportOffen = false },
            title = { Text("Exportieren") },
            text = { Text("${shown.size} angezeigte Buchungen exportieren als:") },
            confirmButton = { TextButton({ exportOffen = false; punkte[0].second() }) { Text("CSV (Tabelle)") } },
            dismissButton = { TextButton({ exportOffen = false; punkte[1].second() }) { Text("PDF (Journal)") } },
        )
    }
    val ids = gewaehlt.filter { id -> buchungen.any { it.id == id } }
    if (sammelOffen && ids.isNotEmpty()) {
        BuchungSammelDialog(model, ids.size, ids, onDismiss = { sammelOffen = false }, onDone = { sammelOffen = false; info = it; gewaehlt = emptySet() })
    }
    if (loeschenOffen && ids.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = { loeschenOffen = false },
            title = { Text("${ids.size} Buchungen löschen?") },
            text = { Text("Die Buchungen werden endgültig gelöscht, die Kontostände ändern sich entsprechend. Angehängte Belege werden mit gelöscht.") },
            confirmButton = {
                TextButton(enabled = !model.busy, onClick = {
                    loeschenOffen = false
                    model.buchungenLoeschen(ids) { n, e -> gewaehlt = emptySet(); info = if (e == null) "$n Buchungen gelöscht." else "Löschen fehlgeschlagen: $e" }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschenOffen = false }) { Text("Abbrechen") } },
        )
    }
    val meldung = info
    if (meldung != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Fertig") }, text = { Text(meldung) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

/** Die Einträge des Export-Menüs für eine Liste von Buchungen (in der Reihenfolge der Liste). */
private fun exportPunkte(model: AppModel, exporter: de.vereinsmanager.android.export.Exporter, liste: List<Buchung>, wort: String): List<Pair<String, () -> Unit>> {
    val heute = LocalDate.now()
    val name = model.vereinsname()
    val verein = Export.dateiname(name)
    val konten = model.konten
    return listOf(
        "CSV – ${liste.size} $wort Buchungen" to { exporter.csv("buchungen_${verein}_$heute.csv") { Berichte.journalCsv(liste, konten) } },
        "PDF – ${liste.size} $wort Buchungen" to { exporter.pdf("buchungsjournal_${verein}_$heute.pdf") { Berichte.journalPdf(liste, konten, name, heute) } },
    )
}

@Composable
internal fun ExportMenue(titel: String, punkte: List<Pair<String, () -> Unit>>, kompakt: Boolean) {
    var offen by remember { mutableStateOf(false) }
    Box {
        KompaktKnopf(titel, { offen = true }, enabled = punkte.isNotEmpty())
        DropdownMenu(offen, { offen = false }) {
            punkte.forEach { (text, aktion) -> DropdownMenuItem(text = { Text(text) }, onClick = { offen = false; aktion() }) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BuchungZeile(b: Buchung, kontoName: Map<String, String>, erste: Boolean, letzte: Boolean, waehlt: Boolean, angehakt: Boolean, onLongClick: () -> Unit, onClick: () -> Unit) {
    val s = MaterialTheme.colorScheme
    // Karten liegen dicht übereinander: nur die erste und die letzte haben große Rundungen oben bzw. unten.
    val form = RoundedCornerShape(topStart = if (erste) 28.dp else 10.dp, topEnd = if (erste) 28.dp else 10.dp, bottomStart = if (letzte) 28.dp else 10.dp, bottomEnd = if (letzte) 28.dp else 10.dp)
    Surface(
        shape = form, color = if (angehakt) s.primaryContainer.copy(alpha = 0.45f) else s.surface,
        border = BorderStroke(1.5.dp, if (angehakt) s.primary else s.outlineVariant),
        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp).clip(form).combinedClickable(onClick = onClick, onLongClick = onLongClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (waehlt) Checkbox(angehakt, { onClick() })
            else {
                val (flaeche, text, zeichen) = when {
                    b.istUmbuchung -> Triple(s.secondaryContainer, s.onSecondaryContainer, "⇄")
                    b.istAusgabe -> Triple(s.errorContainer, s.onErrorContainer, "−")
                    else -> Triple(s.primaryContainer, s.onPrimaryContainer, "+")
                }
                Box(Modifier.size(44.dp).clip(CircleShape).background(flaeche), contentAlignment = Alignment.Center) {
                    Text(zeichen, color = text, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
                }
            }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(Finance.titel(b), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val konto = if (b.istUmbuchung) "${kontoName[b.kontoId] ?: "?"} → ${kontoName[b.zielkontoId] ?: "?"}" else kontoName[b.kontoId]
                Text(
                    listOfNotNull(deDate(b.datum).takeIf { b.datum.isNotEmpty() }, b.belegNummer.takeIf { it.isNotEmpty() }, konto).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = s.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOfNotNull(
                        if (b.istUmbuchung) "Umbuchung" else FinanceLabels.SPHERE_SHORT[b.sphaere],
                        if (b.aufgeteilt) "aufgeteilt" else null,
                        if (b.beleg != null) "Beleg" else null,
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = s.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                betragText(b), color = betragFarbe(b), fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.titleSmall, maxLines = 1, softWrap = false,
            )
        }
    }
}

@Composable
private fun Feld(label: String, wert: String) {
    if (wert.isBlank()) return
    Column(Modifier.padding(vertical = 4.dp)) {
        if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(wert, style = MaterialTheme.typography.bodyLarge)
    }
}

/** Kleines farbiges Schild (Art der Buchung, Belegnummer) – wie das Status-Schild bei Mitgliedern. */
@Composable
internal fun Schild(text: String, flaeche: Color, schrift: Color) {
    Text(
        text, color = schrift, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold,
        maxLines = 1, softWrap = false,
        modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(flaeche).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/** Eine Buchung mit allen Angaben, dazu Bearbeiten und Löschen – im gleichen Aufbau wie die Mitglieder-Detailansicht. */
@Composable
fun BuchungDetailScreen(
    model: AppModel, id: String, onEdit: () -> Unit, onBeleg: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier,
    onRechnung: (String) -> Unit = {}, onSpende: (String) -> Unit = {},
) {
    var loeschen by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val b = model.buchungen.firstOrNull { it.id == id }
    if (b == null) { Text("Buchung nicht gefunden.", modifier.padding(16.dp)); return }
    val kontoName = remember(model.konten) { model.konten.associate { it.id to it.name } }
    val sc = MaterialTheme.colorScheme
    val (artFlaeche, artSchrift) = when {
        b.istUmbuchung -> sc.secondaryContainer to sc.onSecondaryContainer
        b.istAusgabe -> sc.errorContainer to sc.onErrorContainer
        else -> sc.primaryContainer to sc.onPrimaryContainer
    }
    val datum = if (b.datum.isNotEmpty()) deDate(b.datum) else ""
    val tag = if (datum.length >= 10) datum.take(6) else datum.ifEmpty { "–" }
    val jahr = if (datum.length >= 10) datum.takeLast(4) else null
    val betragKurz = betragText(b)
    val belegZahl = when { b.beleg != null -> "ja"; b.istUmbuchung -> "–"; else -> "fehlt" }
    val belegUnter = when { b.beleg != null -> groesse(b.beleg!!.groesse); b.istUmbuchung -> "nicht nötig"; else -> "noch anhängen" }
    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Column(Modifier.fillMaxWidth().padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Finance.titel(b), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Schild(FinanceLabels.KIND[b.art] ?: b.art, artFlaeche, artSchrift)
                if (b.belegNummer.isNotBlank()) Text(b.belegNummer, style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            // Drei Kacheln mit einer gemeinsamen Schriftgröße: so groß, wie der längste Wert (meist der Betrag) noch hineinpasst.
            val gewichte = listOf(1.6f, 1f, 1f)
            val summe = gewichte.sum()
            val laengen = listOf(betragKurz.length, tag.length, belegZahl.length)
            val g = gewichte.indices.minOf { i ->
                val innen = (maxWidth - 16.dp) * (gewichte[i] / summe) - 20.dp
                innen.value / (maxOf(laengen[i], 3) * 0.62f)
            }.coerceIn(14f, 28f).sp
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatKachel("Betrag", betragKurz, if (b.aufgeteilt) "aufgeteilt" else if (b.istUmbuchung) "Umbuchung" else null, artFlaeche, artSchrift, Modifier.weight(1.6f).fillMaxHeight(), g)
                StatKachel("Datum", tag, jahr, sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(1f).fillMaxHeight(), g)
                StatKachel("Beleg", belegZahl, belegUnter, sc.tertiaryContainer, sc.onTertiaryContainer, Modifier.weight(1f).fillMaxHeight(), g)
            }
        }
        Spacer(Modifier.height(8.dp))
        DetailKarte("Buchung") {
            Feld("Datum", datum)
            Feld("Belegnummer", b.belegNummer)
            Feld(if (b.istUmbuchung) "Von Konto" else "Konto", kontoName[b.kontoId] ?: b.kontoId)
            if (b.istUmbuchung) Feld("Auf Konto", kontoName[b.zielkontoId] ?: b.zielkontoId)
            Feld("Zahlungspartner", b.partner)
            Feld("Buchungstext", b.text)
            if (b.aufgeteilt) Feld("Nummernkreis", b.nummernkreis)
        }
        if (!b.istUmbuchung && !b.aufgeteilt) {
            DetailKarte("Zuordnung") {
                Feld("Steuerliche Sphäre", FinanceLabels.SPHERE[b.sphaere] ?: b.sphaere)
                Feld("Nummernkreis", b.nummernkreis)
                Feld("Konto (SKR 42)", b.konto.ifEmpty { b.kategorie })
                Feld("Kontonummer", b.skrKonto)
                Feld("Sparte", b.sparte)
                Feld("Umsatzsteuer", "${b.ust} %")
            }
        }
        if (b.aufgeteilt) {
            DetailKarte("Aufteilung (${b.teile.size} Teile)") {
                b.teile.forEachIndexed { i, t ->
                    if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = sc.outlineVariant)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Teil ${i + 1}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(Geld.euro(t.betrag.abs()), fontWeight = FontWeight.ExtraBold)
                    }
                    Feld("Text", t.text)
                    Feld("Sphäre", FinanceLabels.SPHERE[t.sphaere] ?: t.sphaere)
                    Feld("Konto", listOf(t.skrKonto, t.konto.ifEmpty { t.kategorie }).filter { it.isNotEmpty() }.joinToString(" – "))
                    Feld("Sparte", t.sparte)
                    Feld("Umsatzsteuer", "${t.ust} %")
                }
            }
        }
        DetailKarte("Beleg") { BelegAbschnitt(model, b, onAnzeigen = onBeleg, mitTitel = false) }
        if (b.notiz.isNotBlank()) DetailKarte("Notiz") { Feld("", b.notiz) }
        if (fehler != null) Text(fehler!!, color = sc.error, modifier = Modifier.padding(top = 8.dp))
        val rechnung = model.rechnungen.firstOrNull { it.buchungId == b.id }
        val spende = model.spenden.firstOrNull { it.transactionId == b.id }
        Aktionsleiste(
            listOfNotNull(
                Aktion("Bearbeiten", onEdit, primaer = true),
                Aktion("Löschen", { loeschen = true }),
                rechnung?.let { r -> Aktion("Rechnung ${r.nummer} öffnen", { onRechnung(r.id) }) },
                spende?.let { s -> Aktion("Bestätigung ${s.receiptNumber} öffnen", { onSpende(s.id) }) },
            ),
            Modifier.padding(top = 12.dp, bottom = 16.dp),
        )
    }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false },
            title = { Text("Buchung löschen?") },
            text = {
                Text(
                    "${b.belegNummer} · ${Finance.titel(b)} über ${Geld.euro(b.betrag.abs())} wird endgültig gelöscht, " +
                        "die Kontostände ändern sich entsprechend." +
                        if (b.beleg != null) " Der angehängte Beleg wird mit gelöscht." else "",
                )
            },
            confirmButton = {
                TextButton(enabled = !model.busy, onClick = {
                    loeschen = false
                    model.deleteBuchung(b.id) { f -> if (f == null) onDeleted() else fehler = "Löschen fehlgeschlagen: $f" }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}
