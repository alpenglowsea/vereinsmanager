package de.vereinsmanager.android.ui

import androidx.compose.foundation.Canvas
import de.vereinsmanager.core.donation.Zeichnung
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.Surface
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.horizontalScroll
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

    val sc = MaterialTheme.colorScheme
    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KopfKnopf("CSV", {
                val verein = model.vereinsname()
                exporter.csv("${Finanzauswertung.dateiname(a, "csv").removeSuffix(".csv")}_${Export.dateiname(verein)}.csv") {
                    Finanzauswertung.csv(a, model.konten, Finanzauswertung.mix(a.posten, true), Finanzauswertung.mix(a.posten, false))
                }
            }, Modifier.weight(1f), enabled = !a.keineBuchungen && !model.busy)
            KopfKnopf("PDF", {
                val verein = model.vereinsname()
                exporter.pdfSchreiber("${Finanzauswertung.dateiname(a, "pdf").removeSuffix(".pdf")}_${Export.dateiname(verein)}.pdf") { out ->
                    PdfWriter.rechnung(Diagramme.pdfSeiten(a, verein, filterText, LocalDate.now()), null, out)
                }
            }, Modifier.weight(1f), enabled = !a.keineBuchungen && !model.busy)
        }
        Text("Auswertung", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
        Text(filterText, style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Jahr", jahre.associateWith { it }, gewaehlt) { jahr = it }
            FilterMenu("Bereich", FinanceLabels.SPHERE_SHORT, sphaere) { sphaere = it }
            FilterMenu("Konto", model.konten.associate { it.id to it.name }, konto) { kontoId = it }
        }
        if (model.buchungen.isEmpty()) Text("Noch keine Buchungen. Legen Sie Buchungen an oder spielen Sie eine Sicherung ein.", Modifier.padding(top = 8.dp))
        else if (a.keineBuchungen) Text("Für diese Auswahl gibt es keine Buchungen. Umbuchungen zwischen Konten zählen nicht.", Modifier.padding(top = 8.dp))

        val k = a.kennzahlen
        val werte = listOf(Geld.euro(k.einnahmen), Geld.euro(k.spenden), Geld.euro(k.ausgaben), Geld.euroMitVorzeichen(k.saldo))
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val gr = kachelSchrift(maxWidth, listOf(1f, 1f), werte.map { it.length }, 26f)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatKachel("Einnahmen", werte[0], "ohne Spenden", sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                    StatKachel("Spenden", werte[1], "Nummernkreis 40400", sc.tertiaryContainer, sc.onTertiaryContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                }
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatKachel("Ausgaben", werte[2], null, sc.errorContainer, sc.onErrorContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                    if (k.saldo.signum() >= 0) StatKachel("Saldo", werte[3], "Überschuss", sc.primaryContainer, sc.onPrimaryContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                    else StatKachel("Saldo", werte[3], "Fehlbetrag", sc.errorContainer, sc.onErrorContainer, Modifier.weight(1f).fillMaxHeight(), gr)
                }
            }
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
            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
        )
    }
    val meldung = info
    if (meldung != null) AlertDialog(
        onDismissRequest = { info = null }, title = { Text("Fertig") }, text = { Text(meldung) },
        confirmButton = { TextButton(onClick = { info = null }) { Text("OK") } },
    )
}

/** Ein Diagramm aus dem Kern: gezeichnet mit denselben Befehlen wie im PDF; Antippen zeigt den Betrag, „Tabelle“ die Zahlen. */
@Composable
private fun DiagrammKarte(d: Diagramm, modifier: Modifier = Modifier) {
    var gewaehlt by remember(d) { mutableStateOf<String?>(null) }
    var tabelle by remember(d) { mutableStateOf(false) }
    // Die Zeichenbefehle aus dem Kern malen für das PDF auf Weiß; auf dem Bildschirm werden Fläche, Schrift und Linien in die Farben der App umgesetzt.
    val sc = MaterialTheme.colorScheme
    val befehle = remember(d, sc) { d.befehle.map { umfaerben(it, sc) } }
    Surface(modifier.fillMaxWidth().padding(vertical = 2.dp), shape = RoundedCornerShape(24.dp), color = sc.surfaceContainer, contentColor = sc.onSurface, border = BorderStroke(1.5.dp, sc.outlineVariant)) {
        Column(Modifier.padding(10.dp)) {
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
                    PdfWriter.zeichneSeite(nc, befehle, begrenzen = false)
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

/** Setzt die festen Farben der Diagramm-Befehle (Weiß, Schiefergrau) in die Farben der App um; Datenfarben (Grün, Rot, Blau) bleiben. */
private fun umfaerben(z: Zeichnung, sc: androidx.compose.material3.ColorScheme): Zeichnung {
    fun f(c: Int): Int = when (c) {
        0xFFFFFFFF.toInt() -> sc.surfaceContainer.toArgb()
        0xFFE2E8F0.toInt() -> sc.outlineVariant.toArgb()   // Raster
        0xFFCBD5E1.toInt() -> sc.outlineVariant.toArgb()   // Rand
        0xFF94A3B8.toInt() -> sc.outline.toArgb()          // Achse
        0xFF334155.toInt(), 0xFF0F172A.toInt() -> sc.onSurface.toArgb()
        0xFF64748B.toInt() -> sc.onSurfaceVariant.toArgb()
        else -> c
    }
    return when (z) {
        is Zeichnung.Text -> z.copy(farbe = z.farbe?.let { f(it) } ?: (if (z.grau) sc.onSurfaceVariant else sc.onSurface).toArgb())
        is Zeichnung.Rechteck -> z.copy(fuellung = z.fuellung?.let { f(it) }, farbe = z.farbe?.let { f(it) })
        is Zeichnung.Linie -> z.copy(farbe = z.farbe?.let { f(it) } ?: sc.outline.toArgb())
        is Zeichnung.Linienzug -> z.copy(farbe = z.farbe?.let { f(it) } ?: sc.onSurface.toArgb())
        is Zeichnung.Sektor -> z.copy(fuellung = f(z.fuellung))
        else -> z
    }
}
