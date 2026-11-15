package de.vereinsmanager.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.material3.Surface
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.calendar.Austausch
import de.vereinsmanager.core.calendar.Besonderes
import de.vereinsmanager.core.calendar.Kalender
import de.vereinsmanager.core.calendar.Teilnehmer
import de.vereinsmanager.core.calendar.Termin
import de.vereinsmanager.core.calendar.TerminForm
import de.vereinsmanager.core.calendar.TerminLesung
import de.vereinsmanager.core.calendar.Terminart
import de.vereinsmanager.core.calendar.Vorkommen
import de.vereinsmanager.core.export.Export
import java.time.LocalDate
import java.time.YearMonth

internal fun hexFarbe(hex: String): Color = try { Color(android.graphics.Color.parseColor(hex)) } catch (e: Exception) { Color(0xFF64748B) }

private fun artFarbe(arten: List<Terminart>, id: String): Color = hexFarbe(arten.firstOrNull { it.id == id }?.farbe ?: "#64748b")

private fun uhrzeit(v: Vorkommen) = if (v.termin.ganztaegig || v.termin.beginnZeit.isEmpty()) "ganztägig" else v.termin.beginnZeit

private fun spartenMap(model: AppModel, aktuell: String = ""): LinkedHashMap<String, String> {
    val m = LinkedHashMap<String, String>()
    m[Kalender.ALLE_SPARTEN] = "Alle Sparten"
    (model.departments + model.members.map { it.department }).filter { it.isNotBlank() }.distinct().sorted().forEach { m[it] = it }
    if (aktuell.isNotBlank()) m.putIfAbsent(aktuell, aktuell)
    return m
}

// ---------------------------------------------------------------- Kalender (Monat und Liste)

@Composable
fun KalenderScreen(
    model: AppModel, onOpen: (String) -> Unit, onNeu: (String) -> Unit, onArten: () -> Unit, modifier: Modifier = Modifier,
) {
    val heute = LocalDate.now()
    var liste by remember { mutableStateOf(false) }
    var monat by remember { mutableStateOf(YearMonth.from(heute)) }
    var tag by remember { mutableStateOf(heute) }
    var listeStart by remember { mutableStateOf(heute) }
    var suche by remember { mutableStateOf("") }
    var art by remember { mutableStateOf<String?>(null) }
    var sparte by remember { mutableStateOf<String?>(null) }
    var zeigeGeb by remember { mutableStateOf(true) }
    var zeigeJub by remember { mutableStateOf(true) }
    var info by remember { mutableStateOf<String?>(null) }
    var lesung by remember { mutableStateOf<TerminLesung?>(null) }
    var exportOffen by remember { mutableStateOf(false) }
    val sc = MaterialTheme.colorScheme
    val exporter = rememberExporter(model) { info = it }
    val dateiWahl = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.kalenderDateiLesen(uri) { l, f -> if (f != null) info = "Die Datei lässt sich nicht lesen: $f" else lesung = l }
    }

    // Das Raster reicht von Montag der ersten bis Sonntag der letzten Woche des Monats.
    val rasterStart = monat.atDay(1).minusDays((monat.atDay(1).dayOfWeek.value - 1).toLong())
    val rasterEnde = monat.atEndOfMonth().let { it.plusDays((7 - it.dayOfWeek.value).toLong()) }
    val von = if (liste) listeStart else rasterStart
    val bis = if (liste) listeStart.plusDays(59) else rasterEnde

    val vorkommen = remember(model.termine, model.terminarten, von, bis, suche, art, sparte) {
        Kalender.filtern(Kalender.vorkommen(model.termine, von, bis), suche, art, sparte, model.terminarten)
    }
    val besondere = remember(model.members, von, bis, zeigeGeb, zeigeJub) {
        Kalender.besondere(model.members, von, bis).filter { (it.art == "birthday" && zeigeGeb) || (it.art == "anniversary" && zeigeJub) }
    }
    // Kennzahlen: Termine heute, in dieser Woche (Mo–So) und in diesem Monat – ohne Suche und Filter.
    val wocheVon = heute.minusDays((heute.dayOfWeek.value - 1).toLong())
    val wocheBis = wocheVon.plusDays(6)
    val monatVon = heute.withDayOfMonth(1)
    val monatBis = heute.withDayOfMonth(heute.lengthOfMonth())
    val zahlen = remember(model.termine, heute) {
        val alle = Kalender.vorkommen(model.termine, minOf(monatVon, wocheVon), maxOf(monatBis, wocheBis))
        listOf(
            alle.count { it.datum == heute }.toString(),
            alle.count { !it.datum.isBefore(wocheVon) && !it.datum.isAfter(wocheBis) }.toString(),
            alle.count { !it.datum.isBefore(monatVon) && !it.datum.isAfter(monatBis) }.toString(),
        )
    }

    fun export(wort: String, ids: List<Termin>): List<Pair<String, () -> Unit>> {
        val teil = Export.dateiname(model.vereinsname())
        return listOf(
            "iCal (.ics) – ${ids.size} $wort Termine" to { exporter.ics("termine_${teil}_$heute.ics") { Austausch.icsSchreiben(ids, model.terminarten, "${model.vereinsname()} Terminkalender") } },
            "CSV – ${ids.size} $wort Termine" to { exporter.csv("termine_${teil}_$heute.csv") { Austausch.csvSchreiben(ids, model.terminarten) } },
        )
    }

    // Die ganze Seite scrollt; unten bleibt Platz für die Leiste.
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KopfKnopf("Neuer Termin", { onNeu((if (liste) heute else tag).toString()) }, Modifier.weight(1f), primaer = true)
            KopfKnopf("Import", { dateiWahl.launch(arrayOf("*/*")) }, Modifier.weight(1f), enabled = !model.busy)
            KopfKnopf("Export", { exportOffen = true }, Modifier.weight(1f))
        }
        Text("Kalender", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
            val g = kachelSchrift(maxWidth, listOf(1f, 1f, 1f), zahlen.map { maxOf(it.length, 3) }, 40f)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                StatKachel("Heute", zahlen[0], null, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                StatKachel("Woche", zahlen[1], null, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                StatKachel("Monat", zahlen[2], null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            TabChip("Monat", !liste) { liste = false }
            TabChip("Liste", liste) { liste = true }
            TabChip("Terminarten", false) { onArten() }
        }
        SuchFeld(suche, { suche = it }, "Termin suchen …", Modifier.padding(top = 10.dp))
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Terminart", model.terminarten.associate { it.id to it.name }, art) { art = it }
            FilterMenu("Sparte", spartenMap(model).filterKeys { it != Kalender.ALLE_SPARTEN }, sparte) { sparte = it }
            FilterChip(zeigeGeb, { zeigeGeb = !zeigeGeb }, { Text("Geburtstage", maxLines = 1, softWrap = false) })
            FilterChip(zeigeJub, { zeigeJub = !zeigeJub }, { Text("Jubiläen", maxLines = 1, softWrap = false) })
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))

        // Zeitraum wählen
        Surface(shape = RoundedCornerShape(28.dp), color = sc.surfaceContainer, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KompaktKnopf("‹", { if (liste) listeStart = listeStart.minusDays(30) else monat = monat.minusMonths(1) })
                Text(
                    if (liste) "ab ${dt(listeStart)}" else "${Kalender.MONATE[monat.monthValue - 1]} ${monat.year}",
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.weight(1f),
                )
                KompaktKnopf("›", { if (liste) listeStart = listeStart.plusDays(30) else monat = monat.plusMonths(1) })
                KompaktKnopf("Heute", { monat = YearMonth.from(heute); tag = heute; listeStart = heute })
            }
        }

        if (!liste) {
            Surface(shape = RoundedCornerShape(28.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Column(Modifier.padding(8.dp)) {
                    Row(Modifier.fillMaxWidth()) {
                        listOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So").forEach { Text(it, Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant) }
                    }
                    var d = rasterStart
                    while (!d.isAfter(rasterEnde)) {
                        Row(Modifier.fillMaxWidth()) {
                            repeat(7) {
                                val zelle = d
                                val tagesTermine = Kalender.amTag(vorkommen, zelle)
                                val punkte = tagesTermine.map { artFarbe(model.terminarten, it.termin.art) }.distinct().take(3)
                                val feier = besondere.any { it.datum == zelle }
                                val gewaehlt = zelle == tag
                                val form = RoundedCornerShape(16.dp)
                                Box(
                                    Modifier.weight(1f).height(52.dp).padding(1.5.dp)
                                        .clip(form)
                                        .background(if (gewaehlt) sc.primary else Color.Transparent, form)
                                        .then(if (zelle == heute && !gewaehlt) Modifier.border(1.5.dp, sc.primary, form) else Modifier)
                                        .clickable { tag = zelle },
                                    contentAlignment = Alignment.TopCenter,
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = 6.dp)) {
                                        Text(
                                            zelle.dayOfMonth.toString(), style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (zelle == heute || gewaehlt) FontWeight.ExtraBold else FontWeight.Normal,
                                            color = when {
                                                gewaehlt -> sc.onPrimary
                                                zelle == heute -> sc.primary
                                                YearMonth.from(zelle) != monat -> sc.onSurface.copy(alpha = 0.4f)
                                                else -> sc.onSurface
                                            },
                                        )
                                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 3.dp).height(7.dp)) {
                                            punkte.forEach { Box(Modifier.size(6.dp).background(if (gewaehlt) sc.onPrimary else it, CircleShape)) }
                                            if (feier) Box(Modifier.size(6.dp).background(if (gewaehlt) sc.onPrimary else sc.tertiary, CircleShape))
                                        }
                                    }
                                }
                                d = d.plusDays(1)
                            }
                        }
                    }
                }
            }
            Text("${Kalender.wochentagLang(tag)}, ${dt(tag)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
            TagesListe(model, Kalender.amTag(vorkommen, tag), besondere.filter { it.datum == tag }, onOpen)
            if (model.termine.isEmpty()) Text("Noch keine Termine. Legen Sie mit „Neuer Termin“ den ersten an.", Modifier.padding(top = 8.dp))
        } else {
            val tage = (vorkommen.map { it.datum } + besondere.map { it.datum }).distinct().sorted()
            if (tage.isEmpty()) Text("Keine Termine in diesem Zeitraum.", Modifier.padding(top = 12.dp))
            tage.forEach { t ->
                Text(
                    "${Kalender.wochentagLang(t)}, ${dt(t)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold,
                    color = if (t == heute) sc.primary else sc.onSurface, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp),
                )
                TagesListe(model, vorkommen.filter { it.datum == t }, besondere.filter { it.datum == t }, onOpen)
            }
        }
        Spacer(Modifier.height(96.dp))
    }

    if (exportOffen) ExportAuswahl("Alle ${model.termine.size} Termine exportieren als:", export("alle", model.termine), { exportOffen = false })
    lesung?.let { l ->
        AlertDialog(
            onDismissRequest = { lesung = null },
            title = { Text("${l.termine.size} Termine gefunden") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    l.termine.take(5).map { Termin.from(it) }.forEach { Text("• ${it.titel} (${Kalender.datumKurz(it.beginn)})", style = MaterialTheme.typography.bodySmall) }
                    if (l.termine.size > 5) Text("… und ${l.termine.size - 5} weitere", style = MaterialTheme.typography.bodySmall)
                    if (l.hinweise.isNotEmpty()) {
                        Text("Hinweise", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                        l.hinweise.take(8).forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
                        if (l.hinweise.size > 8) Text("… und ${l.hinweise.size - 8} weitere Hinweise", style = MaterialTheme.typography.bodySmall)
                    }
                    Text("Schon vorhandene Termine werden übersprungen.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                }
            },
            confirmButton = {
                TextButton(enabled = l.termine.isNotEmpty() && !model.busy, onClick = {
                    lesung = null
                    model.kalenderImportieren(l) { r, f -> info = if (f != null) "Import fehlgeschlagen: $f" else "${r!!.neu} Termine übernommen, ${r.uebersprungen} schon vorhanden übersprungen." }
                }) { Text("Übernehmen") }
            },
            dismissButton = { TextButton(onClick = { lesung = null }) { Text("Abbrechen") } },
        )
    }
}

private fun dt(d: LocalDate) = de.vereinsmanager.core.members.Zeit.deutsch(d.toString())

@Composable
private fun TagesListe(model: AppModel, termine: List<Vorkommen>, besondere: List<Besonderes>, onOpen: (String) -> Unit) {
    val sc = MaterialTheme.colorScheme
    val gesamt = termine.size + besondere.size
    if (gesamt == 0) Text("Keine Termine.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(vertical = 4.dp))
    termine.forEachIndexed { i, v ->
        ListenKarte(erste = i == 0, letzte = i == gesamt - 1, angehakt = false, onClick = { onOpen(v.termin.id) }, onLongClick = {}) {
            Box(Modifier.width(6.dp).height(40.dp).background(artFarbe(model.terminarten, v.termin.art), RoundedCornerShape(3.dp)))
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(v.termin.titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOf(uhrzeit(v) + if (v.ende != v.datum) " (bis ${dt(v.ende)})" else "", v.termin.ort).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
    besondere.forEachIndexed { j, b ->
        ListenKarte(erste = termine.size + j == 0, letzte = termine.size + j == gesamt - 1, angehakt = false, onClick = {}, onLongClick = {}) {
            Box(Modifier.width(6.dp).height(36.dp).background(sc.tertiary, RoundedCornerShape(3.dp)))
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(b.titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 2)
                Text(b.details, style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
            }
        }
    }
}

// ---------------------------------------------------------------- Termin ansehen

@Composable
fun TerminDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    val t = model.termine.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var einladen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val exporter = rememberExporter(model) { meldung = it }
    if (t == null) { Text("Den Termin gibt es nicht mehr.", modifier.padding(16.dp)); return }
    val art = model.terminarten.firstOrNull { it.id == t.art }
    val sc = MaterialTheme.colorScheme
    val farbe = artFarbe(model.terminarten, t.art)
    val zeile: @Composable (String, String) -> Unit = { l, w -> DetailFeld(l, w) }

    val datum = datumTagJahr(t.beginn)
    val zeit = if (t.ganztaegig || t.beginnZeit.isEmpty()) "ganztägig" else t.beginnZeit
    val zeitUnter = if (!t.ganztaegig && t.endeZeit.isNotEmpty()) "bis ${t.endeZeit}" else null
    val anzahl = t.teilnehmer.size.toString()

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(10.dp).height(64.dp).background(farbe, RoundedCornerShape(5.dp)))
            Column(Modifier.weight(1f).padding(start = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(t.titel, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Schild(art?.name ?: "Allgemeiner Termin", farbe.copy(alpha = 0.22f), sc.onSurface)
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            val g = kachelSchrift(maxWidth, listOf(1f, 1f, 1f), listOf(datum.first.length, zeit.length, anzahl.length), 26f)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                StatKachel("Datum", datum.first, datum.second, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                StatKachel("Uhrzeit", zeit, zeitUnter, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                StatKachel("Teilnehmer", anzahl, null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
            }
        }
        Spacer(Modifier.height(8.dp))
        DetailKarte("Wann und wo") {
            zeile("Wann", Kalender.zeitText(t.beginn, t.beginnZeit, t.ende, t.endeZeit, t.ganztaegig))
            t.serie?.let { zeile("Wiederholung", Kalender.serieText(it)) }
            if (t.ort.isNotBlank()) {
                Column(Modifier.padding(vertical = 4.dp)) {
                    Text("Ort", style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable {
                            // Die Karten-App des Geräts öffnet die Suche; unsere App schickt nichts ins Internet.
                            try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(t.ort)))) } catch (e: Exception) { meldung = "Keine Karten-App gefunden." }
                        },
                    ) {
                        Icon(Lucide.MapPin, contentDescription = "Auf der Karte zeigen", tint = sc.primary, modifier = Modifier.size(20.dp))
                        Text("  " + t.ort, color = sc.primary, style = MaterialTheme.typography.bodyLarge)
                    }
                    Text("Antippen öffnet die Karten-App.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                }
            }
        }
        if (t.sparte.isNotBlank() || t.beschreibung.isNotBlank()) DetailKarte("Einzelheiten") {
            zeile("Sparte", if (t.sparte == Kalender.ALLE_SPARTEN) "Alle Sparten" else t.sparte)
            zeile("Beschreibung", t.beschreibung)
        }
        if (t.teilnehmer.isNotEmpty()) DetailKarte("Teilnehmer (${t.teilnehmer.size})") {
            Text(Kalender.zusagen(t), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
            t.teilnehmer.forEachIndexed { i, p ->
                var offen by remember { mutableStateOf(false) }
                if (i > 0) HorizontalDivider(color = sc.outlineVariant)
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(p.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOf(Kalender.ROLLEN[p.rolle] ?: p.rolle, p.sparte).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                    Box {
                        OutlinedButton(onClick = { offen = true }, enabled = !model.busy, shape = RoundedCornerShape(20.dp)) { Text(Kalender.STATUS[p.status] ?: p.status, maxLines = 1, softWrap = false) }
                        DropdownMenu(offen, { offen = false }) {
                            Kalender.STATUS.forEach { (k, v) ->
                                DropdownMenuItem(text = { Text(v) }, onClick = { offen = false; model.terminStatus(t.id, p.memberId, k) { f -> if (f != null) meldung = f } })
                            }
                        }
                    }
                }
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Bearbeiten", onEdit, primaer = true), Aktion("Einladen", { einladen = true })),
                listOf(Aktion("Löschen", { loeschen = true })),
            ),
            Modifier.padding(top = 12.dp, bottom = 16.dp),
        )
    }

    if (einladen) {
        val verein = model.vereinsnameOderLeer()
        AlertDialog(
            onDismissRequest = { einladen = false }, title = { Text("Einladung verschicken") },
            text = {
                Column {
                    Text("Der Einladungstext nennt weder Teilnehmer noch Zusagen.", style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = {
                        einladen = false
                        val an = Kalender.empfaenger(t)
                        if (an.isEmpty()) { meldung = "Kein Teilnehmer hat eine E-Mail-Adresse." } else {
                            // Alle als Blindkopie: die Adressen sehen sich gegenseitig nicht.
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")).apply {
                                putExtra(Intent.EXTRA_BCC, an.toTypedArray()); putExtra(Intent.EXTRA_SUBJECT, Kalender.betreff(t, verein)); putExtra(Intent.EXTRA_TEXT, Kalender.einladungsText(t, verein))
                            }
                            try { context.startActivity(intent) } catch (e: Exception) { meldung = "Kein Mailprogramm gefunden." }
                        }
                    }) { Text("Per E-Mail (alle als Blindkopie)") }
                    TextButton(onClick = {
                        einladen = false
                        val intent = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, Kalender.betreff(t, verein)); putExtra(Intent.EXTRA_TEXT, Kalender.einladungsText(t, verein)) }
                        try { context.startActivity(Intent.createChooser(intent, "Einladung teilen")) } catch (e: Exception) { meldung = "Teilen ist nicht möglich." }
                    }) { Text("Text teilen (Nachrichten-App)") }
                    TextButton(onClick = {
                        einladen = false
                        exporter.ics("termin_${Export.dateiname(t.titel)}_${t.beginn}.ics") { Austausch.icsSchreiben(listOf(t), model.terminarten, t.titel) }
                    }) { Text("Kalenderdatei (.ics) speichern") }
                }
            },
            confirmButton = { TextButton(onClick = { einladen = false }) { Text("Schließen") } },
        )
    }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false }, title = { Text("Termin löschen?") },
            text = { Text("${t.titel} wird endgültig gelöscht" + if (t.serie != null) " – bei einer Serie alle Termine der Serie." else ".") },
            confirmButton = { TextButton(onClick = { loeschen = false; model.terminLoeschen(t.id) { f -> if (f == null) onDeleted() else meldung = f } }) { Text("Löschen") } },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}


// ---------------------------------------------------------------- Termin anlegen / ändern

/** Uhrzeit ohne Tippen: zwei Auswahllisten, damit keine ungültige Zeit entstehen kann. */
@Composable
internal fun ZeitFeld(label: String, wert: String, fehler: String?, optional: Boolean = false, onChange: (String) -> Unit) {
    val h = wert.substringBefore(':', "").toIntOrNull()
    val m = wert.substringAfter(':', "").toIntOrNull()
    var hOffen by remember { mutableStateOf(false) }
    var mOffen by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                OutlinedButton(onClick = { hOffen = true }) { Text(if (h == null) "Std." else "%02d".format(h)) }
                DropdownMenu(hOffen, { hOffen = false }) {
                    (0..23).forEach { x -> DropdownMenuItem(text = { Text("%02d".format(x)) }, onClick = { hOffen = false; onChange("%02d:%02d".format(x, m ?: 0)) }) }
                }
            }
            Text(":")
            Box {
                OutlinedButton(onClick = { mOffen = true }) { Text(if (m == null) "Min." else "%02d".format(m)) }
                DropdownMenu(mOffen, { mOffen = false }) {
                    ((0..55 step 5).toList() + listOfNotNull(m)).distinct().sorted().forEach { x ->
                        DropdownMenuItem(text = { Text("%02d".format(x)) }, onClick = { mOffen = false; onChange("%02d:%02d".format(h ?: 18, x)) })
                    }
                }
            }
            Text("Uhr")
            if (optional && wert.isNotEmpty()) TextButton(onClick = { onChange("") }) { Text("Entfernen") }
        }
        if (fehler != null) Text(fehler, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}

private val TERMIN_SCHRITTE = listOf("Termin", "Zeit", "Teilnehmer")

/** In welchem Schritt eine Fehlermeldung steht (Schlüssel der Prüfung aus dem Kern). */
private fun terminFehlerSchritt(schluessel: String): Int = if (schluessel == "titel") 0 else 1

@Composable
fun TerminFormScreen(model: AppModel, id: String?, tag: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.termine.firstOrNull { it.id == i } }
    var f by remember {
        mutableStateOf<TerminForm>(
            if (vorhanden != null) model.terminFormular(vorhanden)
            else model.terminNeu(tag?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()),
        )
    }
    var schritt by remember { mutableStateOf(0) }
    // Nach dem ersten Speichern-Versuch wird laufend neu geprüft: Behobene Fehler verschwinden sofort.
    var versucht by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var mitglied by remember { mutableStateOf(false) }
    var sparteWahl by remember { mutableStateOf(false) }
    val pruef = if (versucht) model.terminPruefen(f) else emptyMap()
    val sparten = remember(model.departments, model.members, f.sparte) { spartenMap(model, f.sparte) }
    val arten = remember(model.terminarten, f.art) {
        LinkedHashMap<String, String>().also { m -> model.terminarten.forEach { m[it.id] = it.name }; m.putIfAbsent(f.art, "Allgemeiner Termin") }
    }
    val einheit = when (f.frequenz) { "daily" -> "Tage"; "weekly" -> "Wochen"; "monthly" -> "Monate"; else -> "Jahre" }
    val sc = MaterialTheme.colorScheme
    val fehlerNr = pruef.keys.minOfOrNull { terminFehlerSchritt(it) }

    // Alles scrollt zusammen: Die Knöpfe stehen am Ende der Seite und sind bei geöffneter Tastatur durch Hinunterscrollen erreichbar.
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        FormKopf(if (vorhanden == null) "Neuer Termin" else "Termin bearbeiten", TERMIN_SCHRITTE, schritt, fehlerNr) { schritt = it }
        FormKarte {
            when (schritt) {
                0 -> {
                    Feld("Titel *", f.titel, { f = f.copy(titel = it) }, pruef["titel"])
                    Auswahl("Terminart", arten, f.art) { f = f.copy(art = it) }
                    Auswahl("Sparte", sparten, f.sparte) { f = f.copy(sparte = it) }
                    Feld("Beschreibung", f.beschreibung, { f = f.copy(beschreibung = it) }, singleLine = false)
                    Feld("Ort", f.ort, { f = f.copy(ort = it) }, hinweis = "Antippen im Termin öffnet die Karten-App")
                }
                1 -> {
                    Text("Datum und Uhrzeit", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary)
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                        Switch(f.ganztaegig, { f = f.copy(ganztaegig = it) })
                        Text("  Ganztägig")
                    }
                    DatumFeld("Beginn *", f.beginn, pruef["beginn"]) { n -> f = f.copy(beginn = n, ende = if (f.ende.isEmpty() || f.ende < n) n else f.ende) }
                    if (!f.ganztaegig) ZeitFeld("Beginn Uhrzeit", f.beginnZeit, pruef["beginnZeit"]) { f = f.copy(beginnZeit = it) }
                    DatumFeld("Ende", f.ende, pruef["ende"]) { f = f.copy(ende = it) }
                    if (!f.ganztaegig) ZeitFeld("Ende Uhrzeit", f.endeZeit, pruef["endeZeit"], optional = true) { f = f.copy(endeZeit = it) }

                    Text("Wiederholung", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 14.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                        Switch(f.serie, { f = f.copy(serie = it) })
                        Text("  Regelmäßig wiederholen")
                    }
                    if (f.serie) {
                        Auswahl("Wiederholung", Kalender.FREQUENZEN, f.frequenz) { f = f.copy(frequenz = it) }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Alle")
                            Column(Modifier.width(96.dp)) { Feld("", f.intervall, { f = f.copy(intervall = it.filter { c -> c.isDigit() }.take(2)) }, pruef["intervall"], keyboard = KeyboardType.Number) }
                            Text(einheit)
                        }
                        if (f.frequenz == "weekly") {
                            Text("Wochentage", style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant)
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Kalender.WOCHENTAGE.forEach { (n, name) ->
                                    TabChip(name, n in f.wochentage) { f = f.copy(wochentage = if (n in f.wochentage) f.wochentage - n else f.wochentage + n) }
                                }
                            }
                            pruef["wochentage"]?.let { Text(it, color = sc.error, style = MaterialTheme.typography.bodySmall) }
                        }
                        Auswahl("Ende der Serie", Kalender.ENDE_ARTEN, f.endeArt) { f = f.copy(endeArt = it) }
                        if (f.endeArt == "until_date") DatumFeld("Letzter Termin spätestens am", f.bis, pruef["bis"]) { f = f.copy(bis = it) }
                        if (f.endeArt == "count") Feld("Anzahl der Termine", f.anzahl, { f = f.copy(anzahl = it.filter { c -> c.isDigit() }.take(3)) }, pruef["anzahl"], keyboard = KeyboardType.Number)
                    }
                }
                else -> {
                    Text("Teilnehmer (${f.teilnehmer.size})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary)
                    if (f.teilnehmer.isEmpty()) Text("Noch niemand eingeladen. Teilnehmer sind freiwillig.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(vertical = 4.dp))
                    f.teilnehmer.forEachIndexed { i, p ->
                        if (i > 0) HorizontalDivider(color = sc.outlineVariant)
                        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(p.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(listOf(Kalender.ROLLEN[p.rolle] ?: p.rolle, Kalender.STATUS[p.status] ?: p.status).joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                            }
                            TextButton(onClick = { f = f.copy(teilnehmer = f.teilnehmer.filter { it.memberId != p.memberId }) }) { Text("Entfernen") }
                        }
                    }
                    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KompaktKnopf("Mitglied hinzufügen", { mitglied = true })
                        KompaktKnopf("Ganze Sparte", { sparteWahl = true })
                    }
                }
            }
        }
        if (fehler != null) Text(fehler!!, color = sc.error)
        if (pruef.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = sc.error)
        FormFuss(
            schritt, TERMIN_SCHRITTE.size, { schritt = it }, onDone,
            {
                versucht = true
                val fm = model.terminPruefen(f)
                if (fm.isNotEmpty()) schritt = fm.keys.minOf { terminFehlerSchritt(it) }
                else { fehler = null; model.terminSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e } }
            },
            !model.busy,
        )
    }

    if (mitglied) MitgliedWahl(model, f.teilnehmer.map { it.memberId }.toSet(), onDismiss = { mitglied = false }) { m, rolle -> f = f.copy(teilnehmer = Kalender.teilnehmerHinzu(f.teilnehmer, m, rolle)) }
    if (sparteWahl) {
        AlertDialog(
            onDismissRequest = { sparteWahl = false }, title = { Text("Ganze Sparte einladen") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    sparten.forEach { (k, v) ->
                        TextButton(onClick = { sparteWahl = false; f = f.copy(teilnehmer = Kalender.teilnehmerSparte(f.teilnehmer, model.members, k)) }, modifier = Modifier.fillMaxWidth()) { Text(if (k == Kalender.ALLE_SPARTEN) "Alle Mitglieder" else v) }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { sparteWahl = false }) { Text("Abbrechen") } },
        )
    }
}

@Composable
private fun MitgliedWahl(model: AppModel, schonDabei: Set<String>, onDismiss: () -> Unit, onWahl: (de.vereinsmanager.core.members.Member, String) -> Unit) {
    var suche by remember { mutableStateOf("") }
    var rolle by remember { mutableStateOf("participant") }
    val treffer = remember(model.members, suche) {
        val q = suche.trim().lowercase()
        model.members.filter { it.status != "terminated" && (q.isEmpty() || "${it.firstName} ${it.lastName} ${it.number}".lowercase().contains(q)) }
            .sortedBy { it.displayName.lowercase() }.take(40)
    }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Mitglieder hinzufügen") },
        text = {
            Column {
                SuchFeld(suche, { suche = it }, "Name oder Nummer", Modifier.fillMaxWidth())
                Auswahl("Rolle", Kalender.ROLLEN, rolle) { rolle = it }
                Column(Modifier.height(260.dp).verticalScroll(rememberScrollState())) {
                    treffer.forEach { m ->
                        val dabei = m.id in schonDabei
                        TextButton(onClick = { onWahl(m, rolle) }, enabled = !dabei, modifier = Modifier.fillMaxWidth()) {
                            Text(m.displayName + (if (m.department.isNotEmpty()) " · ${m.department}" else "") + if (dabei) " (dabei)" else "", maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (treffer.isEmpty()) Text("Kein Mitglied gefunden.", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Fertig") } },
    )
}

// ---------------------------------------------------------------- Terminarten verwalten

@Composable
fun TerminartenScreen(model: AppModel, modifier: Modifier = Modifier) {
    var bearbeiten by remember { mutableStateOf<Terminart?>(null) }
    var neu by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var loeschen by remember { mutableStateOf<Terminart?>(null) }
    val benutzt = remember(model.termine) { model.termine.groupingBy { it.art }.eachCount() }

    val sc = MaterialTheme.colorScheme
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp)) { KopfKnopf("Neue Terminart", { neu = true }, Modifier.weight(1f), primaer = true, enabled = !model.busy) }
        Text("Terminarten", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
        Text("Antippen zum Bearbeiten. Die Farbe erscheint im Kalender und im Termin.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 4.dp))
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            model.terminarten.forEachIndexed { i, a ->
                ListenKarte(erste = i == 0, letzte = i == model.terminarten.lastIndex, angehakt = false, onClick = { bearbeiten = a }, onLongClick = {}) {
                    Box(Modifier.size(40.dp).background(hexFarbe(a.farbe), CircleShape))
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(a.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOf(if (a.system) "Standardart" else "", "${benutzt[a.id] ?: 0} Termine").filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                }
            }
            Spacer(Modifier.height(96.dp))
        }
    }

    if (neu || bearbeiten != null) {
        val a = bearbeiten
        var name by remember(a) { mutableStateOf(a?.name ?: "") }
        var farbe by remember(a) { mutableStateOf(Kalender.FARBEN.indexOfFirst { it.hex.equals(a?.farbe, ignoreCase = true) }.takeIf { it >= 0 } ?: 2) }
        var text by remember(a) { mutableStateOf(a?.beschreibung ?: "") }
        var fehler by remember(a) { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { neu = false; bearbeiten = null },
            title = { Text(if (a == null) "Neue Terminart" else "Terminart bearbeiten") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    Feld("Name *", name, { name = it }, fehler)
                    Text("Farbe", style = MaterialTheme.typography.labelMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Kalender.FARBEN.forEachIndexed { i, c ->
                            Box(
                                Modifier.size(if (i == farbe) 38.dp else 30.dp).background(hexFarbe(c.hex), CircleShape).clickable { farbe = i },
                                contentAlignment = Alignment.Center,
                            ) { if (i == farbe) Text("✓", color = Color.White, fontWeight = FontWeight.Bold) }
                        }
                    }
                    Feld("Beschreibung", text, { text = it }, singleLine = false)
                    if (a != null) TextButton(onClick = { neu = false; bearbeiten = null; loeschen = a }) { Text("Terminart löschen", color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(enabled = !model.busy, onClick = {
                    model.terminartSpeichern(a?.id, name, farbe, text) { f -> if (f == null) { neu = false; bearbeiten = null } else fehler = f }
                }) { Text("Speichern") }
            },
            dismissButton = { TextButton(onClick = { neu = false; bearbeiten = null }) { Text("Abbrechen") } },
        )
    }
    loeschen?.let { a ->
        val n = remember(a, model.termine) { model.terminartNutzung(a.id) }
        AlertDialog(
            onDismissRequest = { loeschen = null }, title = { Text(if (n > 0) "Achtung: ${a.name} wird benutzt" else "Terminart löschen?") },
            text = {
                Text(
                    if (n == 0) "${a.name} wird von keinem Termin benutzt und endgültig gelöscht."
                    else "${a.name} wird von $n ${if (n == 1) "Termin" else "Terminen"} benutzt. " +
                        "Beim Löschen ${if (n == 1) "wechselt dieser Termin" else "wechseln diese Termine"} zu „Allgemeiner Termin“ (oder der ersten übrigen Terminart). Das lässt sich nicht rückgängig machen.",
                )
            },
            confirmButton = {
                TextButton(onClick = { loeschen = null; model.terminartLoeschen(a.id) { u, f -> meldung = f ?: (if ((u ?: 0) > 0) "${a.name} gelöscht, $u Termine umgestellt." else "${a.name} gelöscht.") } }) {
                    Text(if (n > 0) "Trotzdem löschen" else "Löschen", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { loeschen = null }) { Text("Abbrechen") } },
        )
    }
}
