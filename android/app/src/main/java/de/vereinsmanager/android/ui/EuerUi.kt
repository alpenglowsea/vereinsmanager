package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.Berichte
import de.vereinsmanager.core.finance.EuerSphaere
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.GrenzeStand
import de.vereinsmanager.core.finance.Geld
import java.time.LocalDate

/**
 * Einnahmen-Überschuss-Rechnung nach den vier steuerlichen Bereichen, je Geschäftsjahr, mit der Kachel zur 45.000-€-Grenze
 * und PDF-Ausgabe. Die Rechnung selbst steht in core (Berichte.euer), Bildschirm und PDF nutzen dieselbe.
 */
@Composable
fun EuerScreen(model: AppModel, modifier: Modifier = Modifier) {
    val jahre = remember(model.buchungen) { Finance.jahre(model.buchungen) }
    val aktuell = LocalDate.now().year.toString()
    // Vorgabe: das laufende Jahr, wenn es Buchungen gibt, sonst das neueste Jahr. null = alle Jahre.
    var jahr by remember { mutableStateOf<String?>(if (aktuell in jahre) aktuell else jahre.firstOrNull()) }
    val gewaehlt = jahr?.takeIf { it in jahre }
    var offen by remember { mutableStateOf(setOf<String>()) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val euer = remember(model.buchungen, gewaehlt) { Berichte.euer(model.buchungen, gewaehlt) }

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Jahr", jahre.associateWith { it }, gewaehlt) { jahr = it }
            Text(if (gewaehlt == null) "alle Jahre" else "Geschäftsjahr $gewaehlt", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            KompaktKnopf("PDF", {
                val verein = model.vereinsname()
                val name = "EUER_${gewaehlt ?: "alle"}_${Export.dateiname(verein)}.pdf"
                exporter.pdf(name) { Berichte.euerPdf(euer, verein, LocalDate.now()) }
            }, enabled = euer.anzahl > 0 && !model.busy)
        }
        if (model.buchungen.isEmpty()) Text("Noch keine Buchungen. Legen Sie Buchungen an oder spielen Sie eine Sicherung ein.", Modifier.padding(top = 16.dp))

        Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Column(Modifier.padding(12.dp)) {
                Text("Gesamtergebnis", style = MaterialTheme.typography.labelMedium)
                Text(Geld.euroMitVorzeichen(euer.ergebnis), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Einnahmen ${Geld.euro(euer.einnahmen)} · Ausgaben ${Geld.euro(euer.ausgaben)}", style = MaterialTheme.typography.bodySmall)
                Text("${euer.anzahl} Buchungszeilen, Umbuchungen zählen nicht", style = MaterialTheme.typography.bodySmall)
            }
        }

        val g = euer.grenze
        if (g != null) GrenzeKachel(g, gewaehlt ?: "", Modifier.padding(top = 8.dp))
        else Text(
            "Die 45.000-€-Grenze für den wirtschaftlichen Geschäftsbetrieb gilt je Kalenderjahr. Wählen Sie oben ein Jahr, um sie zu sehen.",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp),
        )

        euer.sphaeren.forEach { s -> SphaereKarte(s, s.id in offen) { offen = if (s.id in offen) offen - s.id else offen + s.id } }
        Text(
            "Auswertung der gebuchten Beträge, keine Steuerberatung. Ob und wie Beträge steuerlich zu behandeln sind, klären Sie bitte mit dem Finanzamt oder einer Steuerberatung.",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 12.dp),
        )
    }
    val meldung = info
    if (meldung != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Fertig") }, text = { Text(meldung) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

@Composable
private fun GrenzeKachel(g: GrenzeStand, jahr: String, modifier: Modifier = Modifier) {
    val farbe = when {
        g.ueberschritten -> MaterialTheme.colorScheme.error
        g.warnung -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }
    Card(modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(12.dp)) {
            Text("Wirtschaftlicher Geschäftsbetrieb $jahr", style = MaterialTheme.typography.labelMedium)
            Text("${Geld.euro(g.einnahmen)} von ${Geld.euro(g.grenze)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Box(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(10.dp).clip(RoundedCornerShape(5.dp)).background(MaterialTheme.colorScheme.outlineVariant)) {
                Box(Modifier.fillMaxWidth(g.prozent.coerceIn(0.0, 100.0).toFloat() / 100f).height(10.dp).background(farbe))
            }
            Text(
                when {
                    g.ueberschritten -> "Grenze überschritten: ${Geld.euro(g.einnahmen - g.grenze)} darüber (${"%.1f".format(java.util.Locale.GERMANY, g.prozent)} %)."
                    g.warnung -> "Achtung: ${"%.1f".format(java.util.Locale.GERMANY, g.prozent)} % erreicht, noch ${Geld.euro(g.puffer)} frei."
                    else -> "${"%.1f".format(java.util.Locale.GERMANY, g.prozent)} % erreicht, noch ${Geld.euro(g.puffer)} frei."
                },
                style = MaterialTheme.typography.bodyMedium, color = farbe,
            )
            Text(
                "Einnahmen einschließlich Umsatzsteuer aus wirtschaftlichen Geschäftsbetrieben, die keine Zweckbetriebe sind (§ 64 Abs. 3 AO). " +
                    "Bis einschließlich 45.000 € im Jahr bleiben sie körperschaft- und gewerbesteuerfrei. Keine Steuerberatung; gerechnet wird mit den gebuchten Beträgen.",
                style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun SphaereKarte(s: EuerSphaere, aufgeklappt: Boolean, onToggle: () -> Unit) {
    Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(s.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text("Einnahmen ${Geld.euro(s.einnahmen)} · Ausgaben ${Geld.euro(s.ausgaben)}", style = MaterialTheme.typography.bodySmall)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(Geld.euroMitVorzeichen(s.ergebnis), fontWeight = FontWeight.Bold, maxLines = 1)
                    Text(if (aufgeklappt) "▲" else "▼", style = MaterialTheme.typography.bodySmall)
                }
            }
            if (aufgeklappt) {
                HorizontalDivider()
                if (s.nummernkreise.isEmpty()) Text("Keine Buchungen in diesem Bereich.", Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall)
                s.nummernkreise.forEach { m ->
                    Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp)) {
                        Text(listOf(m.code, m.name).filter { it.isNotEmpty() }.joinToString(" "), fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        Text(Geld.euroMitVorzeichen(m.ergebnis), fontWeight = FontWeight.Medium, maxLines = 1, modifier = Modifier.padding(start = 8.dp))
                    }
                    m.konten.forEach { k ->
                        Row(Modifier.fillMaxWidth().padding(start = 24.dp, end = 12.dp, top = 2.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(listOf(k.skrKonto, k.name).filter { it.isNotEmpty() }.joinToString(" "), style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    listOfNotNull(
                                        "Einnahmen ${Geld.euro(k.einnahmen)}".takeIf { k.einnahmen.signum() != 0 },
                                        "Ausgaben ${Geld.euro(k.ausgaben)}".takeIf { k.ausgaben.signum() != 0 },
                                        if (k.anzahl == 1) "1 Buchung" else "${k.anzahl} Buchungen",
                                    ).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            Text(Geld.euroMitVorzeichen(k.einnahmen - k.ausgaben), style = MaterialTheme.typography.bodyMedium, maxLines = 1, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                }
                if (s.id == "wirtschaftlich") Text(
                    "Einnahmen bis 45.000 € im Jahr bleiben ertragsteuerfrei (§ 64 Abs. 3 AO).",
                    style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp),
                )
                Box(Modifier.padding(bottom = 8.dp))
            }
        }
    }
}
