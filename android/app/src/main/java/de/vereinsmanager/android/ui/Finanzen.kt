package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
fun BuchungenScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, onKonten: () -> Unit, modifier: Modifier = Modifier) {
    var filter by remember { mutableStateOf(BuchungFilter()) }
    var sortierung by remember { mutableStateOf(BuchungSortierung.DATUM) }
    var aufsteigend by remember { mutableStateOf(false) }
    var sortOffen by remember { mutableStateOf(false) }

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
                Button(onClick = onNew, modifier = Modifier.weight(1f)) { Text("Neue Buchung") }
                OutlinedButton(onClick = onKonten, modifier = Modifier.weight(1f)) { Text("Konten verwalten") }
            }
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Card(Modifier.width(168.dp).height(88.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Gesamt-Liquidität", style = MaterialTheme.typography.labelMedium, maxLines = 1)
                        Text(Geld.euro(liquiditaet), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
                        Text("${konten.size} Konten & Kassen", style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    }
                }
                konten.forEach { k ->
                    val gewaehlt = filter.kontoId == k.id
                    Card(
                        Modifier.width(168.dp).height(88.dp).clickable { filter = filter.copy(kontoId = if (gewaehlt) null else k.id) },
                        colors = if (gewaehlt) CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer) else CardDefaults.cardColors(),
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(10.dp).clip(CircleShape).background(kontoFarbe(k.farbe)))
                                Spacer(Modifier.width(6.dp))
                                Text(k.name, style = MaterialTheme.typography.labelMedium, maxLines = 1)
                            }
                            Text(Geld.euro(staende[k.id] ?: k.anfangsbestand), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
                            Text(k.artText, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        }
                    }
                }
            }
            OutlinedTextField(
                filter.suche, { filter = filter.copy(suche = it) }, label = { Text("Suchen") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
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
            Row {
                TextButton(onClick = { sortOffen = true }) { Text("Sortiert nach ${SORTIERUNG[sortierung]}") }
                TextButton(onClick = { aufsteigend = !aufsteigend }) { Text(if (aufsteigend) "aufsteigend ↑" else "absteigend ↓") }
                DropdownMenu(sortOffen, { sortOffen = false }) {
                    SORTIERUNG.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { sortierung = k; sortOffen = false }) }
                }
            }
        }
        Text(
            "${shown.size} von ${buchungen.size} Buchungen",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            "Einnahmen ${Geld.euro(summen.einnahmen)} · Ausgaben ${Geld.euro(summen.ausgaben)} · Saldo ${Geld.euro(summen.saldo)}",
            style = MaterialTheme.typography.bodySmall,
        )
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (buchungen.isEmpty()) Text("Keine Buchungen. Legen Sie eine an oder spielen Sie auf der Startseite eine Sicherung ein.", Modifier.padding(top = 16.dp))
        LazyColumn(state = liste) {
            items(shown, key = { it.id }) { b ->
                BuchungZeile(b, kontoName, onClick = { onOpen(b.id) })
            }
        }
    }
}

@Composable
private fun BuchungZeile(b: Buchung, kontoName: Map<String, String>, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(Finance.titel(b), style = MaterialTheme.typography.bodyLarge, maxLines = 2)
            val konto = if (b.istUmbuchung) "${kontoName[b.kontoId] ?: "?"} → ${kontoName[b.zielkontoId] ?: "?"}" else kontoName[b.kontoId]
            Text(
                listOfNotNull(
                    deDate(b.datum).takeIf { b.datum.isNotEmpty() },
                    b.belegNummer.takeIf { it.isNotEmpty() },
                    konto,
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall, maxLines = 1,
            )
            Text(
                listOfNotNull(
                    if (b.istUmbuchung) "Umbuchung" else FinanceLabels.SPHERE_SHORT[b.sphaere],
                    if (b.aufgeteilt) "aufgeteilt" else null,
                    if (b.beleg != null) "Beleg" else null,
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall, maxLines = 1,
            )
        }
        Text(
            betragText(b), color = betragFarbe(b), fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(start = 8.dp), maxLines = 1,
        )
    }
    HorizontalDivider()
}

@Composable
private fun Feld(label: String, wert: String) {
    if (wert.isBlank()) return
    Column(Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(wert)
    }
}

/** Eine Buchung mit allen Angaben, dazu Bearbeiten und Löschen. */
@Composable
fun BuchungDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onBeleg: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    var loeschen by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val b = model.buchungen.firstOrNull { it.id == id }
    if (b == null) { Text("Buchung nicht gefunden.", modifier.padding(16.dp)); return }
    val kontoName = remember(model.konten) { model.konten.associate { it.id to it.name } }
    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(
            betragText(b), color = betragFarbe(b), fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(Finance.titel(b), style = MaterialTheme.typography.titleMedium)
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Feld("Datum", if (b.datum.isNotEmpty()) deDate(b.datum) else "")
        Feld("Belegnummer", b.belegNummer)
        Feld("Buchungsart", FinanceLabels.KIND[b.art] ?: b.art)
        Feld(if (b.istUmbuchung) "Von Konto" else "Konto", kontoName[b.kontoId] ?: b.kontoId)
        if (b.istUmbuchung) Feld("Auf Konto", kontoName[b.zielkontoId] ?: b.zielkontoId)
        Feld("Zahlungspartner", b.partner)
        Feld("Buchungstext", b.text)
        if (!b.istUmbuchung) {
            Feld("Steuerliche Sphäre", FinanceLabels.SPHERE[b.sphaere] ?: b.sphaere)
            Feld("Nummernkreis", b.nummernkreis)
            Feld("Konto (SKR 42)", b.konto.ifEmpty { b.kategorie })
            Feld("Kontonummer", b.skrKonto)
            Feld("Sparte", b.sparte)
            if (!b.aufgeteilt) Feld("Umsatzsteuer", "${b.ust} %")
        }
        Feld("Notiz", b.notiz)
        if (b.aufgeteilt) {
            Text("Aufteilung", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 12.dp))
            b.teile.forEachIndexed { i, t ->
                Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Row {
                            Text("Teil ${i + 1}", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                            Text(Geld.euro(t.betrag.abs()), fontWeight = FontWeight.Bold)
                        }
                        Feld("Text", t.text)
                        Feld("Sphäre", FinanceLabels.SPHERE[t.sphaere] ?: t.sphaere)
                        Feld("Konto", listOf(t.skrKonto, t.konto.ifEmpty { t.kategorie }).filter { it.isNotEmpty() }.joinToString(" – "))
                        Feld("Sparte", t.sparte)
                        Feld("Umsatzsteuer", "${t.ust} %")
                    }
                }
            }
        }
        BelegAbschnitt(model, b, onAnzeigen = onBeleg)
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onEdit) { Text("Bearbeiten") }
            OutlinedButton(onClick = { loeschen = true }) { Text("Löschen") }
        }
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
