package de.vereinsmanager.android.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.ArtikelFoto
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.inventory.Artikel
import de.vereinsmanager.core.inventory.ArtikelForm
import de.vereinsmanager.core.inventory.Inventar
import de.vereinsmanager.core.inventory.InventarFilter
import de.vereinsmanager.core.inventory.InventarSort
import de.vereinsmanager.core.inventory.SammelAenderung
import de.vereinsmanager.core.members.MemberMaterial
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate

private fun zustandKurz(z: String) = Inventar.ZUSTAENDE[z]?.substringBefore(" /") ?: z

/** Das Foto eines Gegenstands; es wird erst hier (und nur für dieses eine) entschlüsselt, nie für die ganze Liste. */
@Composable
private fun FotoAnzeige(foto: String, modifier: Modifier = Modifier) {
    val bild by produceState<ImageBitmap?>(null, foto) {
        value = if (foto.isEmpty()) null else withContext(Dispatchers.Default) { ArtikelFoto.bild(foto)?.asImageBitmap() }
    }
    bild?.let { Image(it, contentDescription = "Foto des Gegenstands", modifier = modifier.fillMaxWidth().heightIn(max = 240.dp).clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Fit) }
}

// ---------------------------------------------------------------- Liste

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun InventarScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, modifier: Modifier = Modifier) {
    val alle = model.inventar
    val ausgegeben = model.inventarAusgegeben
    val heute = LocalDate.now()
    var suche by remember { mutableStateOf("") }
    var sparte by remember { mutableStateOf<String?>(null) }
    var art by remember { mutableStateOf<String?>(null) }
    var zustand by remember { mutableStateOf<String?>(null) }
    var nurPruefung by remember { mutableStateOf(false) }
    var sortierung by remember { mutableStateOf(InventarSort.NAME) }
    var gewaehlt by remember { mutableStateOf(setOf<String>()) }
    var loeschen by remember { mutableStateOf(false) }
    var sammel by remember { mutableStateOf(false) }
    var exportOffen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val waehlt = gewaehlt.isNotEmpty()
    BackHandler(enabled = waehlt) { gewaehlt = emptySet() }

    val filter = InventarFilter(suche, sparte, art, zustand, nurPruefung)
    // Der Wert wird absteigend gezeigt (das Teuerste zuerst), alles andere aufsteigend.
    val shown = remember(alle, filter, sortierung, heute) { Inventar.filtern(alle, filter, sortierung, sortierung != InventarSort.WERT, heute) }
    val k = remember(alle, heute) { Inventar.kennzahlen(alle, heute) }
    val sparten = remember(alle, model.departments) { Inventar.sparten(alle, model.departments) }
    val ausgemustert = alle.count { it.ausgemustert }
    val sc = MaterialTheme.colorScheme
    val liste = rememberLazyListState()
    val kopf = rememberKopfZustand(liste)

    fun export(liste: List<Artikel>, wort: String): List<Pair<String, () -> Unit>> {
        val teil = Export.dateiname(model.vereinsname())
        return listOf(
            "CSV – ${liste.size} $wort Gegenstände" to { exporter.csv("inventar_${teil}_$heute.csv") { Inventar.csv(liste, ausgegeben) } },
            "PDF – ${liste.size} $wort Gegenstände" to { exporter.pdf("inventarliste_${teil}_$heute.pdf") { Inventar.pdf(liste, model.vereinsname(), "Inventarliste", heute) } },
        )
    }

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp).nestedScroll(kopf.verfolgung)) {
        Column(Modifier.einklappbar(kopf)) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KopfKnopf("Neuer Gegenstand", onNew, Modifier.weight(1f), primaer = true)
                KopfKnopf("Export", { exportOffen = true }, Modifier.weight(1f), enabled = !waehlt)
            }
            Text("Inventar", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
            val werte = listOf(k.positionen.toString(), Geld.euro(k.wert), k.ueberfaellig.toString())
            BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                val gew = listOf(1f, 1.2f, 1f)
                val g = kachelSchrift(maxWidth, gew, werte.map { maxOf(it.length, 3) }, 34f)
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatKachel("Artikel", werte[0], null, sc.primaryContainer, sc.onPrimaryContainer, Modifier.weight(gew[0]).fillMaxHeight(), g)
                    StatKachel("Gesamtwert", werte[1], null, sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(gew[1]).fillMaxHeight(), g)
                    if (k.ueberfaellig > 0) StatKachel("Überfällig", werte[2], null, sc.errorContainer, sc.onErrorContainer, Modifier.weight(gew[2]).fillMaxHeight(), g)
                    else StatKachel("Überfällig", werte[2], null, sc.tertiaryContainer, sc.onTertiaryContainer, Modifier.weight(gew[2]).fillMaxHeight(), g)
                }
            }
            Text(
                "${k.einheiten} Einheiten · ${k.sparten} Sparten · Reparatur / beschädigt: ${k.reparatur}. Überfällig = Prüfung überfällig.",
                style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp),
            )
            SuchFeld(suche, { suche = it }, "Gegenstand suchen …", Modifier.padding(top = 10.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FilterMenu("Sparte", sparten.associateWith { it }, sparte) { sparte = it }
                FilterMenu("Art", Inventar.ARTEN_KURZ, art) { art = it }
                FilterMenu("Zustand", Inventar.ZUSTAENDE, zustand) { zustand = it }
                FilterChip(nurPruefung, { nurPruefung = !nurPruefung }, { Text("Prüfung fällig", maxLines = 1, softWrap = false) })
                FilterMenu("Sortierung", InventarSort.entries.associate { it.name to it.text }, sortierung.takeIf { it != InventarSort.NAME }?.name) {
                    sortierung = it?.let { n -> InventarSort.valueOf(n) } ?: InventarSort.NAME
                }
            }
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
        Text(
            "${shown.size} von ${alle.size - (if (zustand == "discarded") 0 else ausgemustert)} Gegenständen" +
                if (ausgemustert > 0 && zustand != "discarded") " · $ausgemustert ausgemustert (ausgeblendet)" else "",
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
        )
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                KompaktKnopf("Bearbeiten", { sammel = true }, enabled = !model.busy)
                KompaktKnopf("Löschen", { loeschen = true }, enabled = !model.busy)
                ExportMenue("Exportieren", export(shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        Spacer(Modifier.height(6.dp))
        if (alle.isEmpty()) Text("Noch kein Inventar. Legen Sie mit „Neuer Gegenstand“ den ersten an.", Modifier.padding(top = 16.dp))
        LazyColumn(state = liste, contentPadding = PaddingValues(bottom = 96.dp)) {
            itemsIndexed(shown, key = { _, a -> a.id }) { i, a ->
                val an = a.id in gewaehlt
                val aus = ausgegeben[a.id] ?: 0
                val ueber = Inventar.ueberfaellig(a, heute)
                val bald = !ueber && Inventar.pruefungBald(a, heute)
                ListenKarte(
                    erste = i == 0, letzte = i == shown.lastIndex, angehakt = an,
                    onClick = { if (waehlt) gewaehlt = if (an) gewaehlt - a.id else gewaehlt + a.id else onOpen(a.id) },
                    onLongClick = { if (!an) gewaehlt = gewaehlt + a.id; info = null },
                ) {
                    if (waehlt) Checkbox(an, { gewaehlt = if (an) gewaehlt - a.id else gewaehlt + a.id })
                    else Marke(a.name.ifBlank { "?" }, (a.id.hashCode() and 0x7fffffff), 44.dp)
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(a.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            listOf(a.nummer, a.sparte, Inventar.ARTEN_KURZ[a.art] ?: "").filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        val unten = listOf("${a.menge} ${a.einheit}", a.standort, zustandKurz(a.zustand).takeIf { a.zustand !in setOf("good", "new") }.orEmpty())
                            .filter { it.isNotEmpty() }.joinToString(" · ")
                        Text(unten, style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val warn = listOfNotNull(
                            if (aus > 0) "ausgegeben: $aus von ${a.menge}" else null,
                            if (ueber) "Prüfung überfällig" else if (bald) "Prüfung bald fällig" else null,
                        )
                        if (warn.isNotEmpty()) {
                            Text(
                                warn.joinToString(" · "), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                color = if (aus > a.menge || ueber) sc.error else sc.onSurface,
                                fontWeight = if (aus > a.menge) FontWeight.SemiBold else FontWeight.Normal,
                            )
                        }
                    }
                }
            }
        }
    }
    if (exportOffen) ExportAuswahl("${shown.size} angezeigte Gegenstände exportieren als:", export(shown, "angezeigte"), { exportOffen = false })
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false }, title = { Text("${gewaehlt.size} Gegenstände löschen?") },
            text = { Text("Die gewählten Gegenstände werden endgültig gelöscht. Gegenstände, die noch an Mitglieder ausgegeben sind, werden übersprungen.") },
            confirmButton = {
                TextButton(onClick = {
                    loeschen = false
                    model.artikelLoeschen(gewaehlt.toList()) { r, f ->
                        if (f != null) info = f
                        else if (r != null) {
                            info = "${r.geloescht} gelöscht." + if (r.gesperrt.isEmpty()) "" else
                                " Nicht gelöscht, weil noch ausgegeben: " + r.gesperrt.joinToString(", ") { (n, s) -> "$n ($s Stück)" } + ". Zuerst beim Mitglied zurücknehmen."
                            gewaehlt = emptySet()
                        }
                    }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
    if (sammel) {
        SammelDialog(model, gewaehlt.toList(), sparten, onDismiss = { sammel = false }) { n ->
            sammel = false
            info = "$n von ${gewaehlt.size} Gegenständen geändert."
            gewaehlt = emptySet()
        }
    }
}

// ---------------------------------------------------------------- Sammelbearbeitung

@Composable
private fun SammelDialog(model: AppModel, ids: List<String>, sparten: List<String>, onDismiss: () -> Unit, onDone: (Int) -> Unit) {
    var sparte by remember { mutableStateOf<String?>(null) }
    var art by remember { mutableStateOf<String?>(null) }
    var zustand by remember { mutableStateOf<String?>(null) }
    var standort by remember { mutableStateOf<String?>(null) }
    var zustaendig by remember { mutableStateOf<String?>(null) }
    var einsatz by remember { mutableStateOf<String?>(null) }
    var lieferant by remember { mutableStateOf<String?>(null) }
    var letzte by remember { mutableStateOf<String?>(null) }
    var naechste by remember { mutableStateOf<String?>(null) }
    var notiz by remember { mutableStateOf<String?>(null) }
    var anhaengen by remember { mutableStateOf(true) }
    var fehler by remember { mutableStateOf<String?>(null) }

    val aenderung = SammelAenderung(sparte, art, zustand, standort, zustaendig, einsatz, lieferant, letzte, naechste, notiz, anhaengen)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${ids.size} Gegenstände bearbeiten") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Nur Felder mit Haken werden geändert. Ein Feld mit Haken und ohne Eintrag wird geleert (außer dem Standort).", style = MaterialTheme.typography.bodySmall)
                Haken("Sparte", sparte != null, { sparte = if (it) sparten.first() else null }) { Auswahl("Sparte", sparten.associateWith { it }, sparte.orEmpty()) { sparte = it } }
                Haken("Art", art != null, { art = if (it) "sports_equipment" else null }) { Auswahl("Art", Inventar.ARTEN, art.orEmpty()) { art = it } }
                Haken("Zustand", zustand != null, { zustand = if (it) "good" else null }) { Auswahl("Zustand", Inventar.ZUSTAENDE, zustand.orEmpty()) { zustand = it } }
                Haken("Standort", standort != null, { standort = if (it) "" else null }) { Feld("Standort", standort.orEmpty(), { standort = it }, hinweis = "Darf nicht leer sein") }
                Haken("Zuständige Person", zustaendig != null, { zustaendig = if (it) "" else null }) { Feld("Zuständige Person", zustaendig.orEmpty(), { zustaendig = it }, hinweis = "Leer = Eintrag löschen") }
                Haken("Im Einsatz bei", einsatz != null, { einsatz = if (it) "" else null }) { Feld("Im Einsatz bei", einsatz.orEmpty(), { einsatz = it }, hinweis = "Leer = Eintrag löschen") }
                Haken("Lieferant / Hersteller", lieferant != null, { lieferant = if (it) "" else null }) { Feld("Lieferant / Hersteller", lieferant.orEmpty(), { lieferant = it }, hinweis = "Leer = Eintrag löschen") }
                Haken("Letzte Prüfung", letzte != null, { letzte = if (it) LocalDate.now().toString() else null }) { DatumFeld("Letzte Prüfung", letzte.orEmpty(), optional = true) { letzte = it } }
                Haken("Nächste Prüfung", naechste != null, { naechste = if (it) "" else null }) { DatumFeld("Nächste Prüfung", naechste.orEmpty(), optional = true) { naechste = it } }
                Haken("Notiz", notiz != null, { notiz = if (it) "" else null }) {
                    Feld("Notiz", notiz.orEmpty(), { notiz = it }, singleLine = false)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(anhaengen, { anhaengen = true }, { Text("Anhängen", maxLines = 1, softWrap = false) })
                        FilterChip(!anhaengen, { anhaengen = false }, { Text("Ersetzen", maxLines = 1, softWrap = false) })
                    }
                }
                if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(enabled = !model.busy, onClick = {
                fehler = Inventar.pruefenSammel(aenderung)
                if (fehler == null) model.artikelSammel(ids, aenderung) { n, e -> if (e == null) onDone(n ?: 0) else fehler = e }
            }) { Text("Übernehmen") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}
// ---------------------------------------------------------------- Detail

@Composable
fun InventarDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, onOpenMember: (String) -> Unit, modifier: Modifier = Modifier) {
    val a = model.inventar.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    // Rückgabe direkt aus der Detailansicht (wie Desktop): Ausgabe und Name für die Rückfrage
    var rueckgabe by remember { mutableStateOf<Pair<de.vereinsmanager.core.members.Ausgabe, String>?>(null) }
    if (a == null) { Text("Den Gegenstand gibt es nicht mehr.", modifier.padding(16.dp)); return }
    val heute = LocalDate.now()
    val aus = model.inventarAusgegeben[a.id] ?: 0
    // Wer den Gegenstand gerade hat (wie Desktop); neu gelesen, sobald sich Ausgaben ändern
    val bei = remember(a.id, model.inventarAusgegeben) { model.ausgabenVon(a.id) }
    val ueber = Inventar.ueberfaellig(a, heute)
    val sc = MaterialTheme.colorScheme
    val zeile: @Composable (String, String) -> Unit = { l, w -> DetailFeld(l, w) }
    fun betrag(v: java.math.BigDecimal?) = v?.let { Geld.euro(it) } ?: ""

    val menge = "${a.menge} ${a.einheit}"
    val wertText = if (a.stueckwert != null) Geld.euro(a.wert) else "–"
    val pruef = datumTagJahr(a.naechstePruefung)

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Marke(a.name.ifBlank { "?" }, (a.id.hashCode() and 0x7fffffff), 72.dp)
            Column(Modifier.weight(1f).padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(a.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    val (fl, tx) = when (a.zustand) {
                        "new", "good" -> sc.primaryContainer to sc.onPrimaryContainer
                        "damaged", "in_repair", "discarded" -> sc.errorContainer to sc.onErrorContainer
                        else -> sc.secondaryContainer to sc.onSecondaryContainer
                    }
                    Schild(zustandKurz(a.zustand), fl, tx)
                    if (a.nummer.isNotEmpty()) Text(a.nummer, style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            val gew = listOf(1f, 1.4f, 1f)
            val g = kachelSchrift(maxWidth, gew, listOf(menge.length, wertText.length, pruef.first.length), 26f)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatKachel("Menge", menge, null, sc.primaryContainer, sc.onPrimaryContainer, Modifier.weight(gew[0]).fillMaxHeight(), g)
                StatKachel("Wert gesamt", wertText, null, sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(gew[1]).fillMaxHeight(), g)
                if (ueber) StatKachel("Prüfung", pruef.first, pruef.second, sc.errorContainer, sc.onErrorContainer, Modifier.weight(gew[2]).fillMaxHeight(), g)
                else StatKachel("Prüfung", pruef.first, pruef.second, sc.tertiaryContainer, sc.onTertiaryContainer, Modifier.weight(gew[2]).fillMaxHeight(), g)
            }
        }
        val hinweise = listOfNotNull(
            if (a.ausgemustert) "Ausgemustert – zählt nicht in Summen und Prüfungen." else null,
            if (aus > 0) "Ausgegeben: $aus von ${a.menge} ${a.einheit}" + (if (aus > a.menge) " – mehr als vorhanden, bitte die Menge oder die Ausgaben prüfen." else "") else null,
            if (ueber) "Die Prüfung ist überfällig." else null,
        )
        if (hinweise.isNotEmpty()) {
            val warn = a.ausgemustert || aus > a.menge || ueber
            Surface(
                shape = RoundedCornerShape(20.dp), color = if (warn) sc.errorContainer else sc.surfaceContainer,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    hinweise.forEach { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (warn) sc.onErrorContainer else sc.onSurface, fontWeight = FontWeight.SemiBold) }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        if (a.foto.isNotEmpty()) DetailKarte("Foto") { FotoAnzeige(a.foto) }
        DetailKarte("Gegenstand") {
            zeile("Art", Inventar.ARTEN[a.art] ?: a.art)
            zeile("Sparte", a.sparte)
            zeile("Zustand", Inventar.ZUSTAENDE[a.zustand] ?: a.zustand)
            zeile("Seriennummer", a.seriennummer)
            zeile("Lieferant / Hersteller", a.lieferant)
        }
        if (listOf(a.standort, a.zustaendig, a.einsatz).any { it.isNotBlank() }) DetailKarte("Standort und Zuständigkeit") {
            zeile("Standort", a.standort)
            zeile("Zuständige Person", a.zustaendig)
            zeile("Im Einsatz bei", a.einsatz)
        }
        if (a.kaufdatum.isNotEmpty() || a.kaufpreis != null || a.zeitwert != null) DetailKarte("Anschaffung und Wert") {
            zeile("Anschaffungsdatum", if (a.kaufdatum.isNotEmpty()) deDate(a.kaufdatum) else "")
            zeile("Anschaffungspreis (je Stück)", betrag(a.kaufpreis))
            zeile("Zeitwert (je Stück)", betrag(a.zeitwert))
            if (a.stueckwert != null) zeile("Wert gesamt", "${betrag(a.wert)} (${a.menge} × ${betrag(a.stueckwert)})")
        }
        if (a.letztePruefung.isNotEmpty() || a.naechstePruefung.isNotEmpty()) DetailKarte("Prüfung") {
            zeile("Letzte Prüfung", if (a.letztePruefung.isNotEmpty()) deDate(a.letztePruefung) else "")
            zeile("Nächste Prüfung", if (a.naechstePruefung.isNotEmpty()) deDate(a.naechstePruefung) else "")
        }
        if (a.notizen.isNotBlank()) DetailKarte("Notizen") { zeile("", a.notizen) }
        DetailKarte(if (bei.isEmpty()) "Ausgegeben an" else "Ausgegeben an (${bei.size})") {
            if (bei.isEmpty()) Text("Derzeit an niemanden ausgegeben.", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
            bei.forEachIndexed { i, x ->
                if (i > 0) HorizontalDivider(Modifier.padding(vertical = 6.dp))
                val mitglied = model.members.firstOrNull { it.id == x.memberId }
                val name = (mitglied?.displayName ?: "Unbekanntes Mitglied") + (mitglied?.number?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: "")
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .then(if (mitglied != null) Modifier.clickable { onOpenMember(mitglied.id) } else Modifier).padding(vertical = 4.dp),
                ) {
                    Text(
                        name,
                        style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold,
                        color = if (mitglied != null) sc.primary else sc.onSurface,
                    )
                    Text(
                        listOf("${x.quantity} ${x.unit}".trim(), if (x.issueDate.isNotEmpty()) "Ausgabe ${deDate(x.issueDate)}" else "", MemberMaterial.eigenanteil(x))
                            .filter { it.isNotEmpty() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (x.notes.isNotBlank()) Text(x.notes, style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                }
                TextButton(onClick = { rueckgabe = x to name }, enabled = !model.busy) { Text("Zurückgeben") }
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Bearbeiten", onEdit, primaer = true), Aktion("Heute geprüft", {
                    model.artikelGeprueft(a.id) { f -> meldung = f ?: "Prüfung für heute eingetragen." }
                }, enabled = !model.busy)),
                listOf(Aktion("Löschen", { loeschen = true })),
            ),
            Modifier.padding(top = 12.dp, bottom = 16.dp),
        )
    }
    rueckgabe?.let { (x, name) ->
        AlertDialog(
            onDismissRequest = { rueckgabe = null }, title = { Text("Rückgabe eintragen?") },
            text = { Text("${x.quantity} ${x.unit} „${a.name}“ von $name als heute zurückgegeben eintragen?".replace("  ", " ")) },
            confirmButton = {
                TextButton(onClick = {
                    rueckgabe = null
                    meldung = model.ausgabeUmschalten(x.id) ?: "Rückgabe von $name eingetragen."
                }) { Text("Zurückgeben") }
            },
            dismissButton = { TextButton(onClick = { rueckgabe = null }) { Text("Abbrechen") } },
        )
    }
    if (loeschen) {
        if (aus > 0) {
            AlertDialog(
                onDismissRequest = { loeschen = false }, title = { Text("Löschen nicht möglich") },
                text = { Text("${a.name} ist noch an Mitglieder ausgegeben ($aus Stück). Bitte zuerst die Ausgaben beim Mitglied unter „Material“ als zurückgegeben eintragen.") },
                confirmButton = { TextButton(onClick = { loeschen = false }) { Text("OK") } },
            )
        } else {
            AlertDialog(
                onDismissRequest = { loeschen = false }, title = { Text("Gegenstand löschen?") },
                text = { Text("${a.name} wird endgültig gelöscht. Wenn er nur nicht mehr gebraucht wird, ist „Ausgemustert“ als Zustand meist die bessere Wahl: Der Gegenstand bleibt dann nachvollziehbar, zählt aber nicht mehr mit.") },
                confirmButton = {
                    TextButton(onClick = {
                        loeschen = false
                        model.artikelLoeschen(listOf(a.id)) { r, f -> if (f != null) meldung = f else if (r != null && r.gesperrt.isEmpty()) onDeleted() else meldung = "Der Gegenstand ist noch ausgegeben." }
                    }) { Text("Löschen") }
                },
                dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
            )
        }
    }
}

// ---------------------------------------------------------------- Formular

private val INVENTAR_SCHRITTE = listOf("Grunddaten", "Foto und Ort", "Wert und Prüfung")

/** In welchem Schritt eine Fehlermeldung steht (Schlüssel der Prüfung aus dem Kern). */
private fun inventarFehlerSchritt(schluessel: String): Int = when (schluessel) {
    "name", "nummer", "menge", "art", "zustand" -> 0
    "foto" -> 1
    else -> 2
}

@Composable
fun InventarFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.inventar.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf<ArtikelForm>(if (vorhanden != null) model.artikelFormular(vorhanden) else model.artikelNeu()) }
    var schritt by remember { mutableStateOf(0) }
    // Nach dem ersten Speichern-Versuch wird laufend neu geprüft: Behobene Fehler verschwinden sofort.
    var versucht by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val pruef = if (versucht) model.artikelPruefen(f) else emptyMap()
    val sparten = remember(model.inventar, model.departments, f.sparte) {
        Inventar.sparten(model.inventar, model.departments).let { if (f.sparte.isNotBlank() && f.sparte !in it) it + f.sparte else it }.associateWith { it }
    }
    val einheiten = remember(f.einheit) { (Inventar.EINHEITEN + f.einheit).filter { it.isNotBlank() }.distinct().associateWith { it } }
    val sc = MaterialTheme.colorScheme
    val fehlerNr = pruef.keys.minOfOrNull { inventarFehlerSchritt(it) }

    val kamera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        model.artikelFotoAufgenommen(ok) { url, fehl -> if (url != null) f = f.copy(foto = url) else fehler = fehl }
    }
    val galerie = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) model.artikelFotoGewaehlt(uri) { url, fehl -> if (url != null) f = f.copy(foto = url) else fehler = fehl }
    }

    // Alles scrollt zusammen: Die Knöpfe stehen am Ende der Seite und sind bei geöffneter Tastatur durch Hinunterscrollen erreichbar.
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        FormKopf(if (vorhanden == null) "Neuer Gegenstand" else "Gegenstand bearbeiten", INVENTAR_SCHRITTE, schritt, fehlerNr) { schritt = it }
        FormKarte {
            when (schritt) {
                0 -> {
                    Feld("Bezeichnung *", f.name, { f = f.copy(name = it) }, pruef["name"])
                    Feld("Inventarnummer *", f.nummer, { f = f.copy(nummer = it) }, pruef["nummer"], hinweis = "Wird vorgeschlagen; jede Nummer nur einmal")
                    Feld("Seriennummer", f.seriennummer, { f = f.copy(seriennummer = it) })
                    Auswahl("Art", Inventar.ARTEN, f.art) { f = f.copy(art = it) }
                    Auswahl("Sparte / Abteilung", sparten, f.sparte) { f = f.copy(sparte = it) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) { Feld("Menge *", f.menge, { f = f.copy(menge = it) }, pruef["menge"], keyboard = KeyboardType.Number) }
                        Column(Modifier.weight(1f)) { Auswahl("Einheit", einheiten, f.einheit) { f = f.copy(einheit = it) } }
                    }
                    Auswahl("Zustand", Inventar.ZUSTAENDE, f.zustand) { f = f.copy(zustand = it) }
                }
                1 -> {
                    Text("Foto", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary)
                    FotoAnzeige(f.foto, Modifier.padding(vertical = 6.dp))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KompaktKnopf("Foto aufnehmen", {
                            try { kamera.launch(model.artikelFotoZiel()) } catch (e: Exception) { fehler = "Die Kamera lässt sich nicht starten: ${e.message ?: "keine Kamera-App gefunden"}" }
                        }, enabled = !model.busy)
                        KompaktKnopf("Aus Galerie", {
                            try { galerie.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) } catch (e: Exception) { fehler = "Die Galerie lässt sich nicht öffnen." }
                        }, enabled = !model.busy)
                        if (f.foto.isNotEmpty()) KompaktKnopf("Foto entfernen", { f = f.copy(foto = "") })
                    }
                    pruef["foto"]?.let { Text(it, color = sc.error, style = MaterialTheme.typography.bodySmall) }
                    Text("Standort und Zuständigkeit", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 14.dp))
                    Feld("Standort", f.standort, { f = f.copy(standort = it) }, hinweis = "z. B. Geräteraum, Halle 2")
                    Feld("Zuständige Person", f.zustaendig, { f = f.copy(zustaendig = it) })
                    Feld("Im Einsatz bei", f.einsatz, { f = f.copy(einsatz = it) }, hinweis = "z. B. Team, Gruppe oder Veranstaltung")
                }
                else -> {
                    Text("Anschaffung und Wert", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary)
                    DatumFeld("Anschaffungsdatum", f.kaufdatum, pruef["kaufdatum"], optional = true) { f = f.copy(kaufdatum = it) }
                    Feld("Anschaffungspreis je Stück (€)", f.kaufpreis, { f = f.copy(kaufpreis = it) }, pruef["kaufpreis"], keyboard = KeyboardType.Decimal, hinweis = "z. B. 1.234,50")
                    Feld("Zeitwert je Stück (€)", f.zeitwert, { f = f.copy(zeitwert = it) }, pruef["zeitwert"], keyboard = KeyboardType.Decimal, hinweis = "Leer: es zählt der Anschaffungspreis")
                    Feld("Lieferant / Hersteller", f.lieferant, { f = f.copy(lieferant = it) })
                    Text("Prüfung und Notizen", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 14.dp))
                    DatumFeld("Letzte Prüfung", f.letztePruefung, pruef["letztePruefung"], optional = true) { f = f.copy(letztePruefung = it) }
                    DatumFeld("Nächste Prüfung", f.naechstePruefung, pruef["naechstePruefung"], optional = true) { f = f.copy(naechstePruefung = it) }
                    Feld("Notizen", f.notizen, { f = f.copy(notizen = it) }, singleLine = false)
                }
            }
        }
        if (fehler != null) Text(fehler!!, color = sc.error)
        if (pruef.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = sc.error)
        FormFuss(
            schritt, INVENTAR_SCHRITTE.size, { schritt = it }, onDone,
            {
                versucht = true
                val fm = model.artikelPruefen(f)
                if (fm.isNotEmpty()) schritt = fm.keys.minOf { inventarFehlerSchritt(it) }
                else { fehler = null; model.artikelSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e } }
            },
            !model.busy,
        )
    }
}
