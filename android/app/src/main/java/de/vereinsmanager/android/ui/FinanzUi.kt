package de.vereinsmanager.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
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
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.PdfWriter
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.AuswFilter
import de.vereinsmanager.core.finance.Diagramm
import de.vereinsmanager.core.finance.Diagramme
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Finanzauswertung
import de.vereinsmanager.core.finance.Geld
import java.time.LocalDate

/**
 * Finanz-Auswertungen: Kennzahlen und fünf Diagramme (Monatssäulen, Torte, Kontostand-Verlauf, Einnahmen-/Ausgaben-Mix, Sparten),
 * mit CSV- und PDF-Ausgabe. Die Zahlen und die Anordnung der Diagramme stehen in core (Finanzauswertung, Diagramme);
 * hier werden die fertigen Zeichenbefehle nur auf den Bildschirm gebracht. Antippen eines Balkens zeigt den genauen Betrag.
 */
@Composable
fun FinanzAuswertungScreen(model: AppModel, modifier: Modifier = Modifier) {
    val jahre = remember(model.buchungen) { Finance.jahre(model.buchungen) }
    val aktuell = LocalDate.now().year.toString()
    var jahr by remember { mutableStateOf<String?>(if (aktuell in jahre) aktuell else jahre.firstOrNull()) }
    var sphaere by remember { mutableStateOf<String?>(null) }
    var kontoId by remember { mutableStateOf<String?>(null) }
    var mixEinnahmenSparte by remember { mutableStateOf(Finanzauswertung.GESAMT) }
    var mixAusgabenSparte by remember { mutableStateOf(Finanzauswertung.GESAMT) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }

    val gewaehlt = jahr?.takeIf { it in jahre }
    val konto = kontoId?.takeIf { id -> model.konten.any { it.id == id } }
    val filter = AuswFilter(gewaehlt, sphaere, konto)
    val a = remember(model.buchungen, model.konten, model.departments, filter) {
        Finanzauswertung.berechne(model.buchungen, model.konten, filter, model.departments)
    }
    val filterText = Finanzauswertung.filterText(filter, model.konten)
    val spartenWahl = remember(model.departments) { linkedMapOf(Finanzauswertung.GESAMT to Finanzauswertung.GESAMT).also { m -> model.departments.forEach { m[it] = it } } }

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Jahr", jahre.associateWith { it }, gewaehlt) { jahr = it }
            FilterMenu("Bereich", FinanceLabels.SPHERE_SHORT, sphaere) { sphaere = it }
            FilterMenu("Konto", model.konten.associate { it.id to it.name }, konto) { kontoId = it }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(filterText, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            KompaktKnopf("CSV", {
                val verein = model.vereinsname()
                exporter.csv("${Finanzauswertung.dateiname(a, "csv").removeSuffix(".csv")}_${Export.dateiname(verein)}.csv") {
                    Finanzauswertung.csv(a, model.konten, Finanzauswertung.mix(a.posten, true), Finanzauswertung.mix(a.posten, false))
                }
            }, enabled = !a.keineBuchungen && !model.busy)
            KompaktKnopf("PDF", {
                val verein = model.vereinsname()
                exporter.pdfSchreiber("${Finanzauswertung.dateiname(a, "pdf").removeSuffix(".pdf")}_${Export.dateiname(verein)}.pdf") { out ->
                    PdfWriter.rechnung(Diagramme.pdfSeiten(a, verein, filterText, LocalDate.now()), null, out)
                }
            }, enabled = !a.keineBuchungen && !model.busy)
        }
        if (model.buchungen.isEmpty()) Text("Noch keine Buchungen. Legen Sie Buchungen an oder spielen Sie eine Sicherung ein.", Modifier.padding(top = 8.dp))
        else if (a.keineBuchungen) Text("Für diese Auswahl gibt es keine Buchungen. Umbuchungen zwischen Konten zählen nicht.", Modifier.padding(top = 8.dp))

        val k = a.kennzahlen
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kachel("Einnahmen (ohne Spenden)", Geld.euro(k.einnahmen), Modifier.weight(1f))
            Kachel("Spenden", Geld.euro(k.spenden), Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kachel("Ausgaben", Geld.euro(k.ausgaben), Modifier.weight(1f))
            Kachel("Saldo", Geld.euroMitVorzeichen(k.saldo), Modifier.weight(1f))
        }

        val alle = gewaehlt == null
        DiagrammKarte(remember(a) { Diagramme.monatsSaeulen(a.monate, alle) })
        DiagrammKarte(remember(a) { Diagramme.torte(a.kennzahlen) })
        DiagrammKarte(remember(a) { Diagramme.verlauf(a.verlauf, alle) })
        Auswahl("Einnahmen-Mix: Sparte", spartenWahl, mixEinnahmenSparte) { mixEinnahmenSparte = it }
        DiagrammKarte(remember(a, mixEinnahmenSparte) {
            Diagramme.mix("Einnahmen-Mix nach Konto", "Ohne Spenden · $mixEinnahmenSparte", Finanzauswertung.mix(a.posten, true, mixEinnahmenSparte), Diagramme.EINNAHMEN)
        })
        Auswahl("Ausgaben-Mix: Sparte", spartenWahl, mixAusgabenSparte) { mixAusgabenSparte = it }
        DiagrammKarte(remember(a, mixAusgabenSparte) {
            Diagramme.mix("Ausgaben-Mix nach Konto", mixAusgabenSparte, Finanzauswertung.mix(a.posten, false, mixAusgabenSparte), Diagramme.AUSGABEN)
        })
        DiagrammKarte(remember(a) { Diagramme.sparten(a.sparten) })

        Text(
            "Umbuchungen zwischen Konten zählen nicht. Spenden sind Einnahmen auf dem Nummernkreis 40400; Ausgaben dort zählen als Ausgaben. " +
                "Aufgeteilte Buchungen zählen Teil für Teil. Der Kontostand-Verlauf enthält den Anfangsbestand der Konten und gilt unabhängig vom Bereichsfilter. " +
                "Auswertung der gebuchten Beträge, keine Steuerberatung.",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 8.dp),
        )
    }
    val meldung = info
    if (meldung != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Fertig") }, text = { Text(meldung) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

@Composable
private fun Kachel(titel: String, wert: String, modifier: Modifier = Modifier) {
    Card(modifier) {
        Column(Modifier.padding(12.dp)) {
            Text(titel, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

/** Ein Diagramm aus dem Kern: gezeichnet mit denselben Befehlen wie im PDF; Antippen zeigt den Betrag, „Tabelle“ die Zahlen. */
@Composable
private fun DiagrammKarte(d: Diagramm, modifier: Modifier = Modifier) {
    var gewaehlt by remember(d) { mutableStateOf<String?>(null) }
    var tabelle by remember(d) { mutableStateOf(false) }
    Card(modifier.fillMaxWidth()) {
        Column(Modifier.padding(8.dp)) {
            Canvas(
                Modifier.fillMaxWidth().aspectRatio((d.breite / d.hoehe).toFloat())
                    .pointerInput(d) {
                        detectTapGestures { p ->
                            val proMm = size.width / d.breite.toFloat()
                            val x = p.x / proMm; val y = p.y / proMm
                            gewaehlt = d.treffer.firstOrNull { x >= it.x && x <= it.x + it.b && y >= it.y && y <= it.y + it.h }?.text
                        }
                    },
            ) {
                val proMm = size.width / d.breite.toFloat()
                drawIntoCanvas { c ->
                    val nc = c.nativeCanvas
                    nc.save()
                    nc.scale(proMm / (72f / 25.4f), proMm / (72f / 25.4f))
                    PdfWriter.zeichneSeite(nc, d.befehle, begrenzen = false)
                    nc.restore()
                }
            }
            if (d.leer == null) {
                Text(gewaehlt ?: "Tippen Sie auf einen Balken oder eine Zeile für den genauen Betrag.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
                TextButton(onClick = { tabelle = !tabelle }) { Text(if (tabelle) "Tabelle ausblenden" else "Tabelle anzeigen") }
            }
            if (tabelle) d.tabelle.forEachIndexed { i, z ->
                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                    z.forEachIndexed { j, s ->
                        Text(
                            s, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall,
                            fontWeight = if (i == 0) FontWeight.Bold else FontWeight.Normal,
                            textAlign = if (j == 0) androidx.compose.ui.text.style.TextAlign.Start else androidx.compose.ui.text.style.TextAlign.End,
                        )
                    }
                }
            }
        }
    }
}
