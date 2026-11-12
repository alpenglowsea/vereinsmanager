package de.vereinsmanager.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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

private fun hexFarbe(hex: String): Color = try { Color(android.graphics.Color.parseColor(hex)) } catch (e: Exception) { Color(0xFF64748B) }

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

    fun export(wort: String, ids: List<Termin>): List<Pair<String, () -> Unit>> {
        val teil = Export.dateiname(model.vereinsname())
        return listOf(
            "iCal (.ics) – ${ids.size} $wort Termine" to { exporter.ics("termine_${teil}_$heute.ics") { Austausch.icsSchreiben(ids, model.terminarten, "${model.vereinsname()} Terminkalender") } },
            "CSV – ${ids.size} $wort Termine" to { exporter.csv("termine_${teil}_$heute.csv") { Austausch.csvSchreiben(ids, model.terminarten) } },
        )
    }

    Column(modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterChip(!liste, { liste = false }, { Text("Monat", maxLines = 1, softWrap = false) })
            FilterChip(liste, { liste = true }, { Text("Liste", maxLines = 1, softWrap = false) })
            KompaktKnopf("Neuer Termin", { onNeu((if (liste) heute else tag).toString()) }, primaer = true)
            ExportMenue("Exportieren", export("alle", model.termine), kompakt = false)
            KompaktKnopf("Importieren", { dateiWahl.launch(arrayOf("*/*")) }, enabled = !model.busy)
            KompaktKnopf("Terminarten", onArten)
        }
        OutlinedTextField(
            suche, { suche = it }, label = { Text("Termine, Orte, Teilnehmer suchen …") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Terminart", model.terminarten.associate { it.id to it.name }, art) { art = it }
            FilterMenu("Sparte", spartenMap(model).filterKeys { it != Kalender.ALLE_SPARTEN }, sparte) { sparte = it }
            FilterChip(zeigeGeb, { zeigeGeb = !zeigeGeb }, { Text("Geburtstage", maxLines = 1, softWrap = false) })
            FilterChip(zeigeJub, { zeigeJub = !zeigeJub }, { Text("Jubiläen", maxLines = 1, softWrap = false) })
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))

        // Zeitraum wählen
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf("‹", { if (liste) listeStart = listeStart.minusDays(30) else monat = monat.minusMonths(1) })
            Text(
                if (liste) "ab ${dt(listeStart)}" else "${Kalender.MONATE[monat.monthValue - 1]} ${monat.year}",
                style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.weight(1f),
            )
            KompaktKnopf("›", { if (liste) listeStart = listeStart.plusDays(30) else monat = monat.plusMonths(1) })
            KompaktKnopf("Heute", { monat = YearMonth.from(heute); tag = heute; listeStart = heute })
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            if (!liste) {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    listOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So").forEach { Text(it, Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium) }
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
                            Box(
                                Modifier.weight(1f).height(50.dp).padding(1.dp)
                                    .background(if (gewaehlt) MaterialTheme.colorScheme.primaryContainer else Color.Transparent, RoundedCornerShape(8.dp))
                                    .clickable { tag = zelle },
                                contentAlignment = Alignment.TopCenter,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = 4.dp)) {
                                    Text(
                                        zelle.dayOfMonth.toString(), style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = if (zelle == heute) FontWeight.ExtraBold else FontWeight.Normal,
                                        color = when {
                                            zelle == heute -> MaterialTheme.colorScheme.primary
                                            YearMonth.from(zelle) != monat -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                                            else -> MaterialTheme.colorScheme.onSurface
                                        },
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 2.dp).height(7.dp)) {
                                        punkte.forEach { Box(Modifier.size(6.dp).background(it, CircleShape)) }
                                        if (feier) Box(Modifier.size(6.dp).background(MaterialTheme.colorScheme.tertiary, CircleShape))
                                    }
                                }
                            }
                            d = d.plusDays(1)
                        }
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Text("${Kalender.wochentagLang(tag)}, ${dt(tag)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                TagesListe(model, Kalender.amTag(vorkommen, tag), besondere.filter { it.datum == tag }, onOpen)
                if (model.termine.isEmpty()) Text("Noch keine Termine. Legen Sie mit „Neuer Termin“ den ersten an.", Modifier.padding(top = 8.dp))
            } else {
                val tage = (vorkommen.map { it.datum } + besondere.map { it.datum }).distinct().sorted()
                if (tage.isEmpty()) Text("Keine Termine in diesem Zeitraum.", Modifier.padding(top = 12.dp))
                tage.forEach { t ->
                    Text(
                        "${Kalender.wochentagLang(t)}, ${dt(t)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                        color = if (t == heute) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 12.dp),
                    )
                    TagesListe(model, vorkommen.filter { it.datum == t }, besondere.filter { it.datum == t }, onOpen)
                }
            }
        }
    }

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
    if (termine.isEmpty() && besondere.isEmpty()) Text("Keine Termine.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
    termine.forEach { v ->
        Row(Modifier.fillMaxWidth().clickable { onOpen(v.termin.id) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(4.dp).height(36.dp).background(artFarbe(model.terminarten, v.termin.art), RoundedCornerShape(2.dp)))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(v.termin.titel, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOf(uhrzeit(v) + if (v.ende != v.datum) " (bis ${Zeit(v.ende)})" else "", v.termin.ort).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
        HorizontalDivider()
    }
    besondere.forEach { b ->
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(4.dp).height(32.dp).background(MaterialTheme.colorScheme.tertiary, RoundedCornerShape(2.dp)))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(b.titel, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
                Text(b.details, style = MaterialTheme.typography.bodySmall)
            }
        }
        HorizontalDivider()
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

    @Composable
    fun Zeile(label: String, wert: String) {
        if (wert.isBlank()) return
        Column(Modifier.padding(vertical = 4.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.bodyLarge)
        }
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).background(artFarbe(model.terminarten, t.art), CircleShape))
            Text("  ${art?.name ?: "Allgemeiner Termin"}", style = MaterialTheme.typography.labelLarge)
        }
        Text(t.titel, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 4.dp))
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Zeile("Wann", Kalender.zeitText(t.beginn, t.beginnZeit, t.ende, t.endeZeit, t.ganztaegig))
        t.serie?.let { Zeile("Wiederholung", Kalender.serieText(it)) }
        Zeile("Sparte", if (t.sparte == Kalender.ALLE_SPARTEN) "Alle Sparten" else t.sparte)
        if (t.ort.isNotBlank()) {
            Column(Modifier.padding(vertical = 4.dp)) {
                Text("Ort", style = MaterialTheme.typography.labelMedium)
                Text(
                    t.ort, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.clickable {
                        // Die Karten-App des Geräts öffnet die Suche; unsere App schickt nichts ins Internet.
                        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(t.ort)))) } catch (e: Exception) { meldung = "Keine Karten-App gefunden." }
                    },
                )
                Text("Antippen öffnet die Karten-App.", style = MaterialTheme.typography.bodySmall)
            }
        }
        Zeile("Beschreibung", t.beschreibung)

        if (t.teilnehmer.isNotEmpty()) {
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            Text("Teilnehmer (${t.teilnehmer.size})", style = MaterialTheme.typography.titleMedium)
            Text(Kalender.zusagen(t), style = MaterialTheme.typography.bodySmall)
            t.teilnehmer.forEach { p ->
                var offen by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(p.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOf(Kalender.ROLLEN[p.rolle] ?: p.rolle, p.sparte).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                    Box {
                        OutlinedButton(onClick = { offen = true }, enabled = !model.busy) { Text(Kalender.STATUS[p.status] ?: p.status, maxLines = 1, softWrap = false) }
                        DropdownMenu(offen, { offen = false }) {
                            Kalender.STATUS.forEach { (k, v) ->
                                DropdownMenuItem(text = { Text(v) }, onClick = { offen = false; model.terminStatus(t.id, p.memberId, k) { f -> if (f != null) meldung = f } })
                            }
                        }
                    }
                }
                HorizontalDivider()
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Bearbeiten", onEdit, primaer = true), Aktion("Einladen", { einladen = true })),
                listOf(Aktion("Löschen", { loeschen = true })),
            ),
            Modifier.padding(top = 16.dp),
        )
    }

    if (einladen) {
        val verein = model.vereinsname()
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
private fun ZeitFeld(label: String, wert: String, fehler: String?, optional: Boolean = false, onChange: (String) -> Unit) {
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

@Composable
fun TerminFormScreen(model: AppModel, id: String?, tag: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.termine.firstOrNull { it.id == i } }
    var f by remember {
        mutableStateOf<TerminForm>(
            if (vorhanden != null) model.terminFormular(vorhanden)
            else model.terminNeu(tag?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()),
        )
    }
    var zeigeFehler by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var mitglied by remember { mutableStateOf(false) }
    var sparteWahl by remember { mutableStateOf(false) }
    val pruef = if (zeigeFehler) model.terminPruefen(f) else emptyMap()
    val sparten = remember(model.departments, model.members, f.sparte) { spartenMap(model, f.sparte) }
    val arten = remember(model.terminarten, f.art) {
        LinkedHashMap<String, String>().also { m -> model.terminarten.forEach { m[it.id] = it.name }; m.putIfAbsent(f.art, "Allgemeiner Termin") }
    }
    val einheit = when (f.frequenz) { "daily" -> "Tage"; "weekly" -> "Wochen"; "monthly" -> "Monate"; else -> "Jahre" }

    Column(modifier.padding(horizontal = 16.dp)) {
        Text(if (vorhanden == null) "Neuer Termin" else "Termin bearbeiten", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
            Feld("Titel *", f.titel, { f = f.copy(titel = it) }, pruef["titel"])
            Auswahl("Terminart", arten, f.art) { f = f.copy(art = it) }
            Auswahl("Sparte", sparten, f.sparte) { f = f.copy(sparte = it) }
            Feld("Beschreibung", f.beschreibung, { f = f.copy(beschreibung = it) }, singleLine = false)
            Feld("Ort", f.ort, { f = f.copy(ort = it) }, hinweis = "Antippen im Termin öffnet die Karten-App")

            Text("Datum und Uhrzeit", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(f.ganztaegig, { f = f.copy(ganztaegig = it) })
                Text("  Ganztägig")
            }
            DatumFeld("Beginn *", f.beginn, pruef["beginn"]) { n -> f = f.copy(beginn = n, ende = if (f.ende.isEmpty() || f.ende < n) n else f.ende) }
            if (!f.ganztaegig) ZeitFeld("Beginn Uhrzeit", f.beginnZeit, pruef["beginnZeit"]) { f = f.copy(beginnZeit = it) }
            DatumFeld("Ende", f.ende, pruef["ende"]) { f = f.copy(ende = it) }
            if (!f.ganztaegig) ZeitFeld("Ende Uhrzeit", f.endeZeit, pruef["endeZeit"], optional = true) { f = f.copy(endeZeit = it) }

            Text("Wiederholung", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
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
                    Text("Wochentage", style = MaterialTheme.typography.labelMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Kalender.WOCHENTAGE.forEach { (n, name) ->
                            FilterChip(n in f.wochentage, { f = f.copy(wochentage = if (n in f.wochentage) f.wochentage - n else f.wochentage + n) }, { Text(name, maxLines = 1, softWrap = false) })
                        }
                    }
                    pruef["wochentage"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                }
                Auswahl("Ende der Serie", Kalender.ENDE_ARTEN, f.endeArt) { f = f.copy(endeArt = it) }
                if (f.endeArt == "until_date") DatumFeld("Letzter Termin spätestens am", f.bis, pruef["bis"]) { f = f.copy(bis = it) }
                if (f.endeArt == "count") Feld("Anzahl der Termine", f.anzahl, { f = f.copy(anzahl = it.filter { c -> c.isDigit() }.take(3)) }, pruef["anzahl"], keyboard = KeyboardType.Number)
            }

            Text("Teilnehmer (${f.teilnehmer.size})", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            f.teilnehmer.forEach { p ->
                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(p.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOf(Kalender.ROLLEN[p.rolle] ?: p.rolle, Kalender.STATUS[p.status] ?: p.status).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = { f = f.copy(teilnehmer = f.teilnehmer.filter { it.memberId != p.memberId }) }) { Text("Entfernen") }
                }
                HorizontalDivider()
            }
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KompaktKnopf("Mitglied hinzufügen", { mitglied = true })
                KompaktKnopf("Ganze Sparte", { sparteWahl = true })
            }
        }
        if (zeigeFehler && pruef.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf("Speichern", {
                zeigeFehler = true
                if (model.terminPruefen(f).isEmpty()) model.terminSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e }
            }, primaer = true, enabled = !model.busy)
            KompaktKnopf("Abbrechen", onDone)
        }
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
        onDismissRequest = onDismiss, title = { Text("Mitglied hinzufügen") },
        text = {
            Column {
                OutlinedTextField(suche, { suche = it }, label = { Text("Name oder Nummer") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Auswahl("Rolle", Kalender.ROLLEN, rolle) { rolle = it }
                Column(Modifier.height(260.dp).verticalScroll(rememberScrollState())) {
                    treffer.forEach { m ->
                        val dabei = m.id in schonDabei
                        TextButton(onClick = { onWahl(m, rolle); onDismiss() }, enabled = !dabei, modifier = Modifier.fillMaxWidth()) {
                            Text(m.displayName + (if (m.department.isNotEmpty()) " · ${m.department}" else "") + if (dabei) " (dabei)" else "", maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (treffer.isEmpty()) Text("Kein Mitglied gefunden.", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Schließen") } },
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

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text("Terminarten und Farben", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(vertical = 8.dp)) { KompaktKnopf("Neue Terminart", { neu = true }, primaer = true, enabled = !model.busy) }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 4.dp))
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            model.terminarten.forEach { a ->
                Row(Modifier.fillMaxWidth().clickable { bearbeiten = a }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(16.dp).background(hexFarbe(a.farbe), CircleShape))
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(a.name, style = MaterialTheme.typography.bodyLarge)
                        Text(listOf(if (a.system) "Standardart" else "", "${benutzt[a.id] ?: 0} Termine").filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                }
                HorizontalDivider()
            }
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
                    if (a != null && !a.system) TextButton(onClick = { neu = false; bearbeiten = null; loeschen = a }) { Text("Terminart löschen", color = MaterialTheme.colorScheme.error) }
                    if (a?.system == true) Text("Standardarten lassen sich umbenennen und umfärben, aber nicht löschen.", style = MaterialTheme.typography.bodySmall)
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
        AlertDialog(
            onDismissRequest = { loeschen = null }, title = { Text("Terminart löschen?") },
            text = { Text("${a.name} wird gelöscht. Das geht nur, wenn kein Termin sie mehr benutzt.") },
            confirmButton = { TextButton(onClick = { loeschen = null; model.terminartLoeschen(a.id) { f -> meldung = f ?: "${a.name} gelöscht." } }) { Text("Löschen") } },
            dismissButton = { TextButton(onClick = { loeschen = null }) { Text("Abbrechen") } },
        )
    }
}
