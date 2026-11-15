package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.BorderStroke
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
 * Einnahmen-Überschuss-Rechnung nach den vier steuerlichen Bereichen, je Geschäftsjahr, mit der Kachel zur Freigrenze (§ 64 AO)
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
    val sc = MaterialTheme.colorScheme

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Jahr", jahre.associateWith { it }, gewaehlt) { jahr = it }
            Spacer(Modifier.weight(1f))
            KopfKnopf("PDF", {
                val verein = model.vereinsname()
                val name = "EUER_${gewaehlt ?: "alle"}_${Export.dateiname(verein)}.pdf"
                exporter.pdf(name) { Berichte.euerPdf(euer, verein, LocalDate.now()) }
            }, Modifier.width(96.dp), enabled = euer.anzahl > 0 && !model.busy)
        }
        Text(
            if (gewaehlt == null) "Alle Jahre" else "Geschäftsjahr $gewaehlt",
            style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp),
        )
        if (model.buchungen.isEmpty()) Text("Noch keine Buchungen. Legen Sie Buchungen an oder spielen Sie eine Sicherung ein.", Modifier.padding(top = 8.dp))
        else Text("${euer.anzahl} Buchungszeilen, Umbuchungen zählen nicht", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)

        val ein = Geld.euro(euer.einnahmen)
        val aus = Geld.euro(euer.ausgaben)
        val erg = Geld.euroMitVorzeichen(euer.ergebnis)
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 12.dp)) {
            // Gemeinsame Schriftgröße für alle drei Beträge, so groß wie der längste noch in die Kachel passt.
            val innen = (maxWidth - 16.dp) / 3 - 20.dp
            val g = minOf(24f, innen.value / (maxOf(ein.length, aus.length, erg.length, 5) * 0.62f)).coerceAtLeast(12f).sp
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                StatKachel("Einnahmen", ein, null, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                StatKachel("Ausgaben", aus, null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
                if (euer.ergebnis.signum() >= 0) StatKachel("Ergebnis", erg, "Überschuss", sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                else StatKachel("Ergebnis", erg, "Fehlbetrag", sc.errorContainer, sc.onErrorContainer, gleich, g)
            }
        }

        val g = euer.grenze
        if (g != null) GrenzeKachel(g, gewaehlt ?: "")
        else Text(
            "Die Besteuerungsgrenze für den wirtschaftlichen Geschäftsbetrieb gilt je Kalenderjahr. Wählen Sie oben ein Jahr, um sie zu sehen.",
            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp),
        )

        Text("Die vier steuerlichen Bereiche", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 14.dp, bottom = 2.dp))
        euer.sphaeren.forEach { s -> SphaereKarte(s, euer.jahr, s.id in offen) { offen = if (s.id in offen) offen - s.id else offen + s.id } }
        Text(
            "Auswertung der gebuchten Beträge, keine Steuerberatung. Ob und wie Beträge steuerlich zu behandeln sind, klären Sie bitte mit dem Finanzamt oder einer Steuerberatung.",
            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 16.dp),
        )
    }
    val meldung = info
    if (meldung != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Fertig") }, text = { Text(meldung) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

@Composable
private fun GrenzeKachel(g: GrenzeStand, jahr: String) {
    val sc = MaterialTheme.colorScheme
    val farbe = when {
        g.ueberschritten -> sc.error
        g.warnung -> sc.tertiary
        else -> sc.primary
    }
    val prozent = "%.1f".format(java.util.Locale.GERMANY, g.prozent)
    DetailKarte("Wirtschaftlicher Geschäftsbetrieb $jahr", Modifier.padding(top = 5.dp)) {
        Text("${Geld.euro(g.einnahmen)} von ${Geld.euro(g.grenze)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
        Box(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(14.dp).clip(RoundedCornerShape(7.dp)).background(sc.outlineVariant)) {
            Box(Modifier.fillMaxWidth(g.prozent.coerceIn(0.0, 100.0).toFloat() / 100f).height(14.dp).clip(RoundedCornerShape(7.dp)).background(farbe))
        }
        Text(
            when {
                g.ueberschritten -> "Grenze überschritten: ${Geld.euro(g.einnahmen - g.grenze)} darüber ($prozent %)."
                g.warnung -> "Achtung: $prozent % erreicht, noch ${Geld.euro(g.puffer)} frei."
                else -> "$prozent % erreicht, noch ${Geld.euro(g.puffer)} frei."
            },
            style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = farbe,
        )
        Text(
            "Einnahmen einschließlich Umsatzsteuer aus wirtschaftlichen Geschäftsbetrieben, die keine Zweckbetriebe sind (§ 64 Abs. 3 AO). " +
                "Bis einschließlich ${Geld.euro(g.grenze)} im Jahr $jahr bleiben sie körperschaft- und gewerbesteuerfrei. Keine Steuerberatung; gerechnet wird mit den gebuchten Beträgen.",
            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun SphaereKarte(s: EuerSphaere, jahr: String?, aufgeklappt: Boolean, onToggle: () -> Unit) {
    val sc = MaterialTheme.colorScheme
    val form = RoundedCornerShape(24.dp)
    Surface(shape = form, color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant), modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Column {
            Row(Modifier.fillMaxWidth().clip(form).clickable(onClick = onToggle).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(s.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary)
                    Text("Einnahmen ${Geld.euro(s.einnahmen)} · Ausgaben ${Geld.euro(s.ausgaben)}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End, modifier = Modifier.padding(start = 8.dp)) {
                    Text(Geld.euroMitVorzeichen(s.ergebnis), fontWeight = FontWeight.ExtraBold, maxLines = 1, color = if (s.ergebnis.signum() < 0) sc.error else sc.onSurface)
                    Text(if (aufgeklappt) "▲" else "▼", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                }
            }
            if (aufgeklappt) {
                HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = sc.outlineVariant)
                if (s.nummernkreise.isEmpty()) Text("Keine Buchungen in diesem Bereich.", Modifier.padding(16.dp), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                s.nummernkreise.forEach { m ->
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp)) {
                        Text(listOf(m.code, m.name).filter { it.isNotEmpty() }.joinToString(" "), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(Geld.euroMitVorzeichen(m.ergebnis), fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.padding(start = 8.dp))
                    }
                    m.konten.forEach { k ->
                        Row(Modifier.fillMaxWidth().padding(start = 28.dp, end = 16.dp, top = 3.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(listOf(k.skrKonto, k.name).filter { it.isNotEmpty() }.joinToString(" "), style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    listOfNotNull(
                                        "Einnahmen ${Geld.euro(k.einnahmen)}".takeIf { k.einnahmen.signum() != 0 },
                                        "Ausgaben ${Geld.euro(k.ausgaben)}".takeIf { k.ausgaben.signum() != 0 },
                                        if (k.anzahl == 1) "1 Buchung" else "${k.anzahl} Buchungen",
                                    ).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant,
                                )
                            }
                            Text(Geld.euroMitVorzeichen(k.einnahmen - k.ausgaben), style = MaterialTheme.typography.bodyMedium, maxLines = 1, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                }
                if (s.id == "wirtschaftlich") Text(
                    "Einnahmen bis ${Geld.euro(Berichte.wgbGrenze(jahr))} im Jahr bleiben ertragsteuerfrei (§ 64 Abs. 3 AO).",
                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(16.dp),
                )
                Spacer(Modifier.height(10.dp))
            }
        }
    }
}
