package de.vereinsmanager.android.ui

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.AppModel.SitzungsPdf
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.meeting.AnwesenderForm
import de.vereinsmanager.core.meeting.Beschluss
import de.vereinsmanager.core.meeting.BeschlussForm
import de.vereinsmanager.core.meeting.Sitzung
import de.vereinsmanager.core.meeting.SitzungForm
import de.vereinsmanager.core.meeting.Sitzungen
import de.vereinsmanager.core.meeting.TopForm
import de.vereinsmanager.core.members.Zeit
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

private fun dd(iso: String) = if (iso.isBlank()) "" else Zeit.deutsch(iso)
private fun zeitraum(s: Sitzung) = listOf(dd(s.datum), if (s.beginn.isNotBlank()) "${s.beginn}${if (s.ende.isNotBlank()) "–${s.ende}" else ""} Uhr" else "").filter { it.isNotEmpty() }.joinToString(", ")
private fun stimmen(b: Beschluss) = "Ja ${b.ja} · Nein ${b.nein} · Enthaltungen ${b.enthaltung}"
private fun signiertText(zeit: String): String = try {
    ZonedDateTime.parse(zeit).withZoneSameInstant(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))
} catch (e: Exception) { dd(zeit.take(10)) }

// ---------------------------------------------------------------- Liste und Beschlussbuch

@Composable
fun SitzungenScreen(model: AppModel, onOpen: (String) -> Unit, onNeu: () -> Unit, modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(0) }
    var suche by remember { mutableStateOf("") }
    var art by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var kennz by remember { mutableStateOf<String?>(null) }
    val st = remember(model.sitzungen) { Sitzungen.statistik(model.sitzungen) }
    val liste = remember(model.sitzungen, suche, art, status) { Sitzungen.filtern(model.sitzungen, suche, art, status) }
    val buch = remember(model.sitzungen, suche, kennz) { Sitzungen.beschlussbuch(model.sitzungen, kennz, suche) }
    val sc = MaterialTheme.colorScheme
    val lazy = rememberLazyListState()
    val kopf = rememberKopfZustand(lazy)

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp).nestedScroll(kopf.verfolgung)) {
        Column(Modifier.einklappbar(kopf)) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp)) { KopfKnopf("Neue Sitzung", onNeu, Modifier.weight(1f), primaer = true) }
            Text("Sitzungen", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
            val werte = listOf(st.gesamt.toString(), st.angenommen.toString(), (st.abgelehnt + st.vertagt).toString())
            BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                val g = kachelSchrift(maxWidth, listOf(1f, 1f, 1f), werte.map { maxOf(it.length, 3) }, 40f)
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    StatKachel("Sitzungen", werte[0], null, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                    StatKachel("Beschlüsse", werte[1], null, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                    StatKachel("Offen", werte[2], null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
                }
            }
            Text(
                "${st.vorstand} Vorstand · ${st.versammlungen} Versammlungen. Beschlüsse = angenommen; Offen = abgelehnt (${st.abgelehnt}) oder vertagt (${st.vertagt}). " +
                    "Angenommen mit Finanzamt-Kennzeichen: ${st.steuer}, mit Registerkennzeichen: ${st.register}.",
                style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp),
            )
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TabChip("Sitzungen", tab == 0) { tab = 0 }
                TabChip("Beschlussbuch (${st.angenommen + st.abgelehnt + st.vertagt})", tab == 1) { tab = 1 }
            }
            SuchFeld(suche, { suche = it }, if (tab == 0) "Sitzung suchen …" else "Beschluss suchen …", Modifier.padding(top = 10.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (tab == 0) {
                    FilterMenu("Art", Sitzungen.ARTEN, art) { art = it }
                    FilterMenu("Status", Sitzungen.STATUS, status) { status = it }
                } else {
                    FilterChip(kennz == null, { kennz = null }, { Text("Alle", maxLines = 1, softWrap = false) })
                    FilterChip(kennz == "tax", { kennz = "tax" }, { Text("Finanzamt", maxLines = 1, softWrap = false) })
                    FilterChip(kennz == "register", { kennz = "register" }, { Text("Vereinsregister", maxLines = 1, softWrap = false) })
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        if (tab == 0) {
            if (model.sitzungen.isEmpty()) Text("Noch keine Sitzungen. Legen Sie mit „Neue Sitzung“ die erste an.", Modifier.padding(top = 12.dp))
            else if (liste.isEmpty()) Text("Keine Sitzung passt zu Suche und Filter.", Modifier.padding(top = 12.dp))
        } else if (buch.isEmpty()) Text("Keine Beschlüsse gefunden.", Modifier.padding(top = 12.dp))
        LazyColumn(state = lazy, contentPadding = PaddingValues(bottom = 96.dp)) {
            if (tab == 0) {
                itemsIndexed(liste, key = { _, s -> s.id }) { i, s ->
                    ListenKarte(erste = i == 0, letzte = i == liste.lastIndex, angehakt = false, onClick = { onOpen(s.id) }, onLongClick = {}) {
                        Marke(s.titel.ifBlank { "?" }, i, 44.dp)
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Text(s.titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("${Sitzungen.artName(s.art)} · ${Sitzungen.statusName(s.status)}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(listOf(zeitraum(s), s.ort).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val hinweise = listOfNotNull(
                                "${s.tops.size} TOPs", s.beschluesse.size.takeIf { it > 0 }?.let { "$it Beschlüsse" },
                                if (s.gesperrt) "${s.signaturen.size}/2 unterschrieben" else null,
                            )
                            Text(hinweise.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            } else {
                itemsIndexed(buch, key = { i, e -> "${e.sitzung.id}/${e.beschluss.id}/$i" }) { i, e ->
                    val b = e.beschluss
                    val farbe = when (b.ergebnis) { "accepted" -> sc.primary; "rejected" -> sc.error; else -> sc.outline }
                    ListenKarte(erste = i == 0, letzte = i == buch.lastIndex, angehakt = false, onClick = { onOpen(e.sitzung.id) }, onLongClick = {}) {
                        Box(Modifier.width(6.dp).height(64.dp).background(farbe, RoundedCornerShape(3.dp)))
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Text("${dd(e.sitzung.datum)} · ${e.sitzung.titel} · ${e.top.nummer}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(b.titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(b.antrag, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("${stimmen(b)} → ${Sitzungen.ERGEBNISSE[b.ergebnis] ?: b.ergebnis}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = farbe, modifier = Modifier.padding(top = 2.dp))
                            val z = listOfNotNull(if (b.steuer) "Finanzamt" else null, if (b.register) "Vereinsregister" else null,
                                (b.verantwortlich + if (b.frist.isNotBlank()) " bis ${dd(b.frist)}" else "").trim().takeIf { it.isNotEmpty() })
                            if (z.isNotEmpty()) Text(z.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Sitzung ansehen

@Composable
fun SitzungDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    val s = model.sitzungen.firstOrNull { it.id == id }
    val context = LocalContext.current
    var meldung by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { meldung = it }
    var loeschen by remember { mutableStateOf(false) }
    var entsperren by remember { mutableStateOf(false) }
    var mail by remember { mutableStateOf(false) }
    var pdfWahl by remember { mutableStateOf<SitzungsPdf?>(null) }
    var unterschreibt by remember { mutableStateOf<String?>(null) }
    if (s == null) { Text("Die Sitzung gibt es nicht mehr.", modifier.padding(16.dp)); return }

    fun pdf(art: SitzungsPdf, mit: Boolean) {
        exporter.pdfSchreiber(model.sitzungDateiname(s, art)) { out -> model.sitzungPdfSchreiben(s.id, art, mit, out) }
    }
    fun pdfWaehlen(art: SitzungsPdf) {
        if (art == SitzungsPdf.EINLADUNG) { pdf(art, false); return }
        if (s.gesperrt) pdfWahl = art else pdf(art, false)
    }
    val fehltEinladung = Sitzungen.einladungFehlt(s)
    val auszugFehlt = Sitzungen.auszugFehlt(s)
    val imArchiv = model.sitzungImArchiv(s)

    val sc = MaterialTheme.colorScheme
    val zeile: @Composable (String, String) -> Unit = { l, w -> DetailFeld(l, w) }
    val datum = datumTagJahr(s.datum)
    val uhr = s.beginn.ifBlank { "–" }
    val uhrUnter = if (s.beginn.isNotBlank() && s.ende.isNotBlank()) "bis ${s.ende}" else null
    val bescheide = s.beschluesse.size.toString()
    val (stFl, stTx) = when (s.status) {
        "approved" -> sc.primaryContainer to sc.onPrimaryContainer
        "cancelled" -> sc.errorContainer to sc.onErrorContainer
        else -> sc.secondaryContainer to sc.onSecondaryContainer
    }

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Marke(s.titel.ifBlank { "?" }, (s.id.hashCode() and 0x7fffffff), 72.dp)
            Column(Modifier.weight(1f).padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(s.titel, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Schild(Sitzungen.statusName(s.status), stFl, stTx)
                    Text(Sitzungen.artName(s.art), style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            val g = kachelSchrift(maxWidth, listOf(1f, 1f, 1f), listOf(datum.first.length, uhr.length, bescheide.length), 26f)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                StatKachel("Datum", datum.first, datum.second, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                StatKachel("Beginn", uhr, uhrUnter, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                StatKachel("Beschlüsse", bescheide, null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
            }
        }
        Spacer(Modifier.height(8.dp))
        DetailKarte("Eckdaten") {
            zeile("Wann", zeitraum(s)); zeile("Ort", s.ort); zeile("Leitung", s.leitung); zeile("Protokoll", s.schrift)
            zeile("Protokollart", Sitzungen.PROTOKOLLARTEN[s.protokollart].orEmpty())
            zeile("Einladung", if (s.einladungOk) "form- und fristgerecht" + listOf(dd(s.einladungsDatum), s.einladungsWeg).filter { it.isNotBlank() }.let { if (it.isEmpty()) "" else " (" + it.joinToString(", ") + ")" } else "nicht als ordnungsgemäß bestätigt")
            zeile("Beschlussfähigkeit", if (s.beschlussfaehig) "festgestellt" + (s.stimmberechtigteWirksam?.let { " ($it stimmberechtigte Anwesende)" } ?: "") else "nicht festgestellt")
        }
        if (s.teilnehmer.isNotEmpty()) DetailKarte("Teilnehmer (${s.teilnehmer.count { it.anwesend }} anwesend von ${s.teilnehmer.size})") {
            s.teilnehmer.forEach { a ->
                Text("• ${a.name}" + listOfNotNull(a.rolle.takeIf { it.isNotBlank() }, if (!a.anwesend) "nicht anwesend" else null, if (a.anwesend && !a.stimmrecht) "ohne Stimmrecht" else null).let { if (it.isEmpty()) "" else " (" + it.joinToString(", ") + ")" }, style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (s.tops.isNotEmpty()) DetailKarte("Tagesordnung") {
            s.tops.forEachIndexed { i, t ->
                if (i > 0) HorizontalDivider(Modifier.padding(top = 8.dp), color = sc.outlineVariant)
                Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Schild(t.nummer.ifBlank { "TOP ${i + 1}" }, sc.tertiaryContainer, sc.onTertiaryContainer)
                    Text(t.titel, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
                }
                if (t.berichterstatter.isNotBlank()) Text("Berichterstatter: ${t.berichterstatter}", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                if (t.notizen.isNotBlank()) Text(t.notizen, style = MaterialTheme.typography.bodyMedium)
                t.beschluesse.forEach { b ->
                    Surface(shape = RoundedCornerShape(16.dp), color = sc.surfaceContainer, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                        Column(Modifier.padding(12.dp)) {
                            Text("Beschluss: ${b.titel}", fontWeight = FontWeight.Bold)
                            Text(b.antrag, style = MaterialTheme.typography.bodyMedium)
                            Text("${stimmen(b)} → ${Sitzungen.ERGEBNISSE[b.ergebnis] ?: b.ergebnis}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                            val z = listOfNotNull(if (b.steuer) "Finanzamt" else null, if (b.register) "Vereinsregister" else null,
                                (b.verantwortlich + if (b.frist.isNotBlank()) " bis ${dd(b.frist)}" else "").trim().takeIf { it.isNotEmpty() })
                            if (z.isNotEmpty()) Text(z.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                        }
                    }
                }
            }
        }
        if (s.notizen.isNotBlank()) DetailKarte("Allgemeine Anmerkungen") { zeile("", s.notizen) }

        DetailKarte("Unterschriften") {
            for ((rolle, titel, name) in listOf(Triple(Sitzungen.ROLLE_LEITUNG, "Versammlungsleitung", s.leitung), Triple(Sitzungen.ROLLE_SCHRIFT, "Protokollführung", s.schrift))) {
                val sig = s.signaturen.firstOrNull { if (rolle == Sitzungen.ROLLE_LEITUNG) it.istLeitung else it.istSchrift }
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("$titel: ${name.ifBlank { "(Name fehlt)" }}", fontWeight = FontWeight.Bold)
                        if (sig != null) {
                            val p = Sitzungen.pruefung(s, sig)
                            Text(
                                "unterschrieben ${signiertText(sig.zeit)}" + when (p) {
                                    Sitzungen.Pruefung.GUELTIG -> " · Text seither unverändert"
                                    Sitzungen.Pruefung.GEAENDERT -> " · ACHTUNG: Text seither geändert"
                                    Sitzungen.Pruefung.UNBEKANNT -> " · Fingerabdruck unbekannt (am Desktop erfasst)"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = if (p == Sitzungen.Pruefung.GEAENDERT) sc.error else sc.onSurfaceVariant,
                            )
                        } else Text("noch nicht unterschrieben", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                    if (sig == null) TextButton(onClick = { unterschreibt = rolle }, enabled = !model.busy && name.isNotBlank() && s.status != "cancelled") { Text("Unterschreiben") }
                }
            }
            if (s.gesperrt) {
                Text("Das Protokoll ist unterschrieben und gesperrt. Zum Ändern müssen die Unterschriften erst entfernt werden.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                TextButton(onClick = { entsperren = true }, enabled = !model.busy) { Text("Unterschriften entfernen …") }
            } else Text("Mit der Unterschrift beider Personen wird das Protokoll „Genehmigt“ und gesperrt.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
            if (s.vollstaendigUnterschrieben) {
                if (imArchiv) Text("Liegt im Dokumentenarchiv (Protokolle & Versammlungen).", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                else TextButton(onClick = { model.sitzungArchivieren(s.id) { _, f -> meldung = f ?: "Das Protokoll liegt jetzt im Dokumentenarchiv." } }, enabled = !model.busy) { Text("Im Archiv ablegen") }
            }
        }

        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        if (fehltEinladung.isNotEmpty()) Text("Für die Einladung fehlt noch: ${fehltEinladung.joinToString(", ")}.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        if (auszugFehlt != null) Text("Registerauszug nicht möglich: $auszugFehlt", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Einladung (PDF)", { if (fehltEinladung.isEmpty()) pdfWaehlen(SitzungsPdf.EINLADUNG) else meldung = "Für die Einladung fehlt noch: ${fehltEinladung.joinToString(", ")}." }, enabled = !model.busy), Aktion("Protokoll (PDF)", { pdfWaehlen(SitzungsPdf.PROTOKOLL) }, enabled = !model.busy)),
                listOf(Aktion("Registerauszug (PDF)", { if (auszugFehlt == null) pdfWaehlen(SitzungsPdf.AUSZUG) else meldung = "Registerauszug nicht möglich: $auszugFehlt" }, enabled = !model.busy), Aktion("Per E-Mail …", { mail = true }, enabled = !model.busy)),
                listOf(Aktion("Bearbeiten", onEdit, primaer = true, enabled = !s.gesperrt), Aktion("Löschen", { loeschen = true })),
            ),
            Modifier.padding(top = 12.dp, bottom = 16.dp),
        )
    }

    unterschreibt?.let { rolle ->
        UnterschriftDialog(onDismiss = { unterschreibt = null }) { u: Unterschrift ->
            unterschreibt = null
            model.sitzungUnterschreiben(s.id, rolle, u) { f -> meldung = f ?: "Unterschrift gespeichert." }
        }
    }
    pdfWahl?.let { art ->
        AlertDialog(
            onDismissRequest = { pdfWahl = null }, title = { Text("PDF mit Unterschriften?") },
            text = { Text("Das Protokoll ist unterschrieben. Mit Unterschriften erscheinen die gespeicherten Unterschriften, ohne bleiben die Zeilen leer (zum Unterschreiben auf Papier).") },
            confirmButton = { TextButton(onClick = { pdfWahl = null; pdf(art, true) }) { Text("Mit Unterschriften") } },
            dismissButton = { TextButton(onClick = { pdfWahl = null; pdf(art, false) }) { Text("Ohne Unterschriften") } },
        )
    }
    if (entsperren) {
        AlertDialog(
            onDismissRequest = { entsperren = false }, title = { Text("Unterschriften entfernen?") },
            text = { Text("Alle Unterschriften werden gelöscht, das Protokoll wird änderbar" + (if (s.status == "approved") " und geht auf „In Vorprüfung“ zurück" else "") + ". " + (if (s.dokumentId.isNotEmpty()) "Das archivierte PDF bleibt im Dokumentenarchiv, wird aber nicht mehr mit der Sitzung verbunden. " else "") + "Danach muss neu unterschrieben werden.") },
            confirmButton = { TextButton(onClick = { entsperren = false; model.sitzungEntsperren(s.id) { f -> meldung = f ?: "Unterschriften entfernt." } }) { Text("Entfernen", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { entsperren = false }) { Text("Abbrechen") } },
        )
    }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false }, title = { Text("Sitzung löschen?") },
            text = { Text("„${s.titel}“ wird endgültig gelöscht." + if (s.dokumentId.isNotEmpty()) " Das archivierte Protokoll-PDF bleibt im Dokumentenarchiv." else "") },
            confirmButton = { TextButton(onClick = { loeschen = false; model.sitzungLoeschen(s.id) { f -> if (f == null) onDeleted() else meldung = f } }) { Text("Löschen", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
    if (mail) MailDialog(model, s, onDismiss = { mail = false }, onFehler = { meldung = it }, context = context)
}

/** E-Mail an Teilnehmer oder alle Mitglieder: alle als Blindkopie, optional mit PDF-Anhang. */
@Composable
private fun MailDialog(model: AppModel, s: Sitzung, onDismiss: () -> Unit, onFehler: (String) -> Unit, context: android.content.Context) {
    var art by remember { mutableStateOf(if (s.status == "approved") Sitzungen.MailArt.PROTOKOLL else Sitzungen.MailArt.EINLADUNG) }
    val alle = remember(s, model.members) { Sitzungen.empfaenger(s, model.members) }
    val nurTeilnehmer = alle.filter { it.teilnehmer }
    var anTeilnehmer by remember { mutableStateOf(nurTeilnehmer.isNotEmpty()) }
    var mitPdf by remember { mutableStateOf(true) }
    val an = if (anTeilnehmer) nurTeilnehmer else alle
    val einladungOk = Sitzungen.einladungFehlt(s).isEmpty()

    fun senden(datei: java.io.File?) {
        val verein = model.vereinsnameOderLeer()
        val intent = Intent(if (datei != null) Intent.ACTION_SEND else Intent.ACTION_SENDTO).apply {
            if (datei == null) data = android.net.Uri.parse("mailto:")
            else {
                type = "message/rfc822"
                putExtra(Intent.EXTRA_STREAM, FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", datei))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            putExtra(Intent.EXTRA_BCC, an.map { it.email }.toTypedArray())
            putExtra(Intent.EXTRA_SUBJECT, Sitzungen.mailBetreff(s, art))
            putExtra(Intent.EXTRA_TEXT, Sitzungen.mailText(s, art, verein))
        }
        try { context.startActivity(if (datei != null) Intent.createChooser(intent, "E-Mail senden") else intent) } catch (e: Exception) { onFehler("Kein Mailprogramm gefunden.") }
    }

    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Per E-Mail verschicken") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Alle Empfänger stehen als Blindkopie (BCC), die Adressen sind füreinander unsichtbar.", style = MaterialTheme.typography.bodySmall)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    RadioButton(art == Sitzungen.MailArt.EINLADUNG, { art = Sitzungen.MailArt.EINLADUNG }); Text("Einladung")
                    RadioButton(art == Sitzungen.MailArt.PROTOKOLL, { art = Sitzungen.MailArt.PROTOKOLL }); Text("Protokoll")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(anTeilnehmer, { anTeilnehmer = true }, enabled = nurTeilnehmer.isNotEmpty()); Text("Teilnehmer der Sitzung (${nurTeilnehmer.size})")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(!anTeilnehmer, { anTeilnehmer = false }); Text("Teilnehmer und alle aktiven Mitglieder (${alle.size})")
                }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(mitPdf, { mitPdf = it }); Text("PDF anhängen") }
                if (art == Sitzungen.MailArt.EINLADUNG && mitPdf && !einladungOk) Text("Für das Einladungs-PDF fehlt noch: ${Sitzungen.einladungFehlt(s).joinToString(", ")}.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                if (an.isEmpty()) Text("Keine E-Mail-Adresse vorhanden.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = {
            TextButton(
                enabled = an.isNotEmpty() && !model.busy && !(mitPdf && art == Sitzungen.MailArt.EINLADUNG && !einladungOk),
                onClick = {
                    onDismiss()
                    if (!mitPdf) senden(null) else {
                        val pdfArt = if (art == Sitzungen.MailArt.EINLADUNG) SitzungsPdf.EINLADUNG else SitzungsPdf.PROTOKOLL
                        model.sitzungPdfDatei(s.id, pdfArt, s.gesperrt) { f, fehler -> if (f != null) senden(f) else onFehler("PDF nicht möglich: $fehler") }
                    }
                },
            ) { Text("E-Mail öffnen") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}

// ---------------------------------------------------------------- Sitzung anlegen / ändern

/** In welchem Schritt eine Fehlermeldung steht (Schlüssel der Prüfung aus dem Kern). */
private fun sitzungFehlerSchritt(schluessel: String): Int = when {
    schluessel.startsWith("top") || schluessel.startsWith("beschluss") -> 1
    schluessel == "einladungsDatum" || schluessel == "stimmberechtigte" -> 2
    schluessel.startsWith("teilnehmer") -> 3
    else -> 0
}

@Composable
fun SitzungFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.sitzungen.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf<SitzungForm>(if (vorhanden != null) model.sitzungFormular(vorhanden) else model.sitzungNeu("board")) }
    var tab by remember { mutableStateOf(0) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var mitglieder by remember { mutableStateOf(false) }
    var gast by remember { mutableStateOf("") }
    val pruef = if (zeigeFehler) model.sitzungPruefen(f) else emptyMap()
    val sc = MaterialTheme.colorScheme
    val fehlerNr = pruef.keys.minOfOrNull { sitzungFehlerSchritt(it) }
    val gesperrt = vorhanden?.gesperrt == true
    val statusWahl = remember(f.status) { LinkedHashMap(Sitzungen.STATUS_WAHL).also { it.putIfAbsent(f.status, Sitzungen.statusName(f.status)) } }
    val stimmenZaehlung = f.teilnehmer.count { it.anwesend && it.stimmrecht }

    fun artWechseln(neu: String) {
        // Titel und Tagesordnung nur ersetzen, solange sie noch unverändert die Vorgabe der bisherigen Art sind.
        val alt = f.art
        val titelVorgabe = model.sitzungNeu(alt).titel
        val topsVorgabe = Sitzungen.standardTagesordnung(alt).map { it.titel }
        val neuVorgabe = model.sitzungNeu(neu)
        f = f.copy(
            art = neu,
            titel = if (vorhanden == null && f.titel == titelVorgabe) neuVorgabe.titel else f.titel,
            tops = if (vorhanden == null && f.tops.map { it.titel } == topsVorgabe && f.tops.all { it.beschluesse.isEmpty() && it.notizen.isBlank() }) neuVorgabe.tops else f.tops,
        )
    }
    fun top(i: Int, neu: TopForm) { f = f.copy(tops = f.tops.mapIndexed { k, t -> if (k == i) neu else t }) }
    fun beschluss(i: Int, j: Int, neu: BeschlussForm) { top(i, f.tops[i].copy(beschluesse = f.tops[i].beschluesse.mapIndexed { k, b -> if (k == j) neu else b })) }
    fun stimme(i: Int, j: Int, b: BeschlussForm) {
        // Das Ergebnis folgt den Stimmen (einfache Mehrheit), solange es nicht „Vertagt“ ist; es bleibt von Hand änderbar.
        val ja = b.ja.toIntOrNull() ?: 0; val nein = b.nein.toIntOrNull() ?: 0
        val erg = if (b.ergebnis != "deferred" && ja + nein + (b.enthaltung.toIntOrNull() ?: 0) > 0) Sitzungen.ergebnisVorschlag(ja, nein) else b.ergebnis
        beschluss(i, j, b.copy(ergebnis = erg))
    }
    fun ziffern(t: String) = t.filter { it.isDigit() }.take(5)

    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        FormKopf(if (vorhanden == null) "Neue Sitzung" else "Sitzung bearbeiten", listOf("Stammdaten", "Tagesordnung", "Nachweise", "Teilnehmer"), tab, fehlerNr) { tab = it }
        if (gesperrt) Text(Sitzungen.GESPERRT, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 4.dp))
        FormKarte {
            when (tab) {
                0 -> {
                    Auswahl("Art der Sitzung", Sitzungen.ARTEN, f.art, enabled = !gesperrt) { artWechseln(it) }
                    Feld("Titel *", f.titel, { f = f.copy(titel = it) }, pruef["titel"], enabled = !gesperrt)
                    Auswahl("Status", statusWahl, f.status, enabled = !gesperrt) { f = f.copy(status = it) }
                    pruef["status"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    Auswahl("Protokollart", Sitzungen.PROTOKOLLARTEN, f.protokollart, enabled = !gesperrt) { f = f.copy(protokollart = it) }
                    DatumFeld("Datum *", f.datum, pruef["datum"]) { f = f.copy(datum = it) }
                    ZeitFeld("Beginn", f.beginn, pruef["beginn"], optional = true) { f = f.copy(beginn = it) }
                    ZeitFeld("Ende", f.ende, pruef["ende"], optional = true) { f = f.copy(ende = it) }
                    Feld("Ort", f.ort, { f = f.copy(ort = it) }, enabled = !gesperrt)
                    Feld("Versammlungsleitung", f.leitung, { f = f.copy(leitung = it) }, enabled = !gesperrt)
                    Feld("Protokollführung", f.schrift, { f = f.copy(schrift = it) }, enabled = !gesperrt)
                }
                1 -> {
                    f.tops.forEachIndexed { i, t ->
                        Surface(shape = RoundedCornerShape(20.dp), color = sc.surfaceContainer, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            Column(Modifier.padding(10.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("TOP ${i + 1}", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                    KompaktKnopf("↑", { f = f.copy(tops = f.tops.toMutableList().also { l -> val x = l.removeAt(i); l.add(i - 1, x) }) }, Modifier.width(44.dp), enabled = !gesperrt && i > 0)
                                    KompaktKnopf("↓", { f = f.copy(tops = f.tops.toMutableList().also { l -> val x = l.removeAt(i); l.add(i + 1, x) }) }, Modifier.width(44.dp), enabled = !gesperrt && i < f.tops.lastIndex)
                                }
                                Feld("Titel *", t.titel, { top(i, t.copy(titel = it)) }, pruef["top$i"], enabled = !gesperrt)
                                Feld("Berichterstatter", t.berichterstatter, { top(i, t.copy(berichterstatter = it)) }, enabled = !gesperrt)
                                Feld("Besprechung / Verlauf", t.notizen, { top(i, t.copy(notizen = it)) }, singleLine = false, enabled = !gesperrt)
                                t.beschluesse.forEachIndexed { j, b ->
                                    HorizontalDivider(Modifier.padding(vertical = 6.dp))
                                    Text("Beschluss ${j + 1}", fontWeight = FontWeight.SemiBold)
                                    pruef["beschluss$i.$j"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                                    Feld("Kurztitel *", b.titel, { beschluss(i, j, b.copy(titel = it)) }, enabled = !gesperrt)
                                    Feld("Wortlaut des Antrags *", b.antrag, { beschluss(i, j, b.copy(antrag = it)) }, singleLine = false, enabled = !gesperrt)
                                    Feld("Antragsteller", b.antragsteller, { beschluss(i, j, b.copy(antragsteller = it)) }, enabled = !gesperrt)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Column(Modifier.weight(1f)) { Feld("Ja", b.ja, { stimme(i, j, b.copy(ja = ziffern(it))) }, keyboard = KeyboardType.Number, enabled = !gesperrt) }
                                        Column(Modifier.weight(1f)) { Feld("Nein", b.nein, { stimme(i, j, b.copy(nein = ziffern(it))) }, keyboard = KeyboardType.Number, enabled = !gesperrt) }
                                        Column(Modifier.weight(1f)) { Feld("Enth.", b.enthaltung, { stimme(i, j, b.copy(enthaltung = ziffern(it))) }, keyboard = KeyboardType.Number, enabled = !gesperrt) }
                                    }
                                    Auswahl("Ergebnis", Sitzungen.ERGEBNISSE, b.ergebnis, enabled = !gesperrt) { beschluss(i, j, b.copy(ergebnis = it)) }
                                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(b.steuer, { beschluss(i, j, b.copy(steuer = it)) }, enabled = !gesperrt); Text("Finanzamt-relevant") }
                                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(b.register, { beschluss(i, j, b.copy(register = it)) }, enabled = !gesperrt); Text("Vereinsregister / Notar (z. B. Vorstandswahl, Satzungsänderung)") }
                                    Feld("Verantwortlich für die Umsetzung", b.verantwortlich, { beschluss(i, j, b.copy(verantwortlich = it)) }, enabled = !gesperrt)
                                    DatumFeld("Frist", b.frist, null, optional = true) { beschluss(i, j, b.copy(frist = it)) }
                                    Feld("Notiz", b.notiz, { beschluss(i, j, b.copy(notiz = it)) }, singleLine = false, enabled = !gesperrt)
                                    TextButton(onClick = { top(i, t.copy(beschluesse = t.beschluesse.filterIndexed { k, _ -> k != j })) }, enabled = !gesperrt) { Text("Beschluss entfernen", color = MaterialTheme.colorScheme.error) }
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    KompaktKnopf("Beschluss hinzufügen", { top(i, t.copy(beschluesse = t.beschluesse + BeschlussForm("res-${System.currentTimeMillis()}-${t.beschluesse.size}"))) }, enabled = !gesperrt)
                                    KompaktKnopf("Entfernen", { f = f.copy(tops = f.tops.filterIndexed { k, _ -> k != i }) }, enabled = !gesperrt)
                                }
                            }
                        }
                    }
                    KompaktKnopf("TOP hinzufügen", { f = f.copy(tops = f.tops + TopForm("top-${System.currentTimeMillis()}-${f.tops.size}")) }, enabled = !gesperrt, modifier = Modifier.padding(top = 8.dp))
                }
                2 -> {
                    Text("Rechtliche Voraussetzungen für gültige Beschlüsse. Angekreuzt wird nur, was tatsächlich zutrifft; die Angaben erscheinen so im Protokoll.", style = MaterialTheme.typography.bodySmall)
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) { Checkbox(f.einladungOk, { f = f.copy(einladungOk = it) }, enabled = !gesperrt); Text("Form- und fristgerecht eingeladen (laut Satzung)") }
                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(f.beschlussfaehig, { f = f.copy(beschlussfaehig = it) }, enabled = !gesperrt); Text("Beschlussfähigkeit festgestellt") }
                    DatumFeld("Datum der Einladung", f.einladungsDatum, pruef["einladungsDatum"], optional = true) { f = f.copy(einladungsDatum = it) }
                    Feld("Art der Einladung", f.einladungsWeg, { f = f.copy(einladungsWeg = it) }, hinweis = "z. B. schriftlich per E-Mail gemäß Satzung", enabled = !gesperrt)
                    Feld(
                        "Anwesende Stimmberechtigte", f.stimmberechtigte, { f = f.copy(stimmberechtigte = ziffern(it)) }, pruef["stimmberechtigte"], keyboard = KeyboardType.Number,
                        hinweis = if (stimmenZaehlung > 0) "Leer = aus der Teilnehmerliste gezählt ($stimmenZaehlung)" else "Leer = unbekannt; die Stimmen werden dann nicht begrenzt", enabled = !gesperrt,
                    )
                    Feld("Allgemeine Anmerkungen", f.notizen, { f = f.copy(notizen = it) }, singleLine = false, enabled = !gesperrt)
                }
                else -> {
                    f.teilnehmer.forEachIndexed { i, a ->
                        Surface(shape = RoundedCornerShape(20.dp), color = sc.surfaceContainer, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Column(Modifier.padding(10.dp)) {
                                Text(a.name, fontWeight = FontWeight.SemiBold)
                                pruef["teilnehmer$i"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                                Feld("Rolle", a.rolle, { r -> f = f.copy(teilnehmer = f.teilnehmer.mapIndexed { k, x -> if (k == i) x.copy(rolle = r) else x }) }, enabled = !gesperrt)
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(a.anwesend, { v -> f = f.copy(teilnehmer = f.teilnehmer.mapIndexed { k, x -> if (k == i) x.copy(anwesend = v) else x }) }, enabled = !gesperrt); Text("anwesend")
                                    Checkbox(a.stimmrecht, { v -> f = f.copy(teilnehmer = f.teilnehmer.mapIndexed { k, x -> if (k == i) x.copy(stimmrecht = v) else x }) }, enabled = !gesperrt); Text("stimmberechtigt")
                                }
                                TextButton(onClick = { f = f.copy(teilnehmer = f.teilnehmer.filterIndexed { k, _ -> k != i }) }, enabled = !gesperrt) { Text("Entfernen") }
                            }
                        }
                    }
                    KompaktKnopf("Mitglieder hinzufügen", { mitglieder = true }, enabled = !gesperrt, modifier = Modifier.padding(top = 8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                        Column(Modifier.weight(1f)) { Feld("Gast oder Nichtmitglied (Name)", gast, { gast = it }, enabled = !gesperrt) }
                        TextButton(
                            enabled = gast.isNotBlank() && !gesperrt,
                            onClick = { f = f.copy(teilnehmer = f.teilnehmer + AnwesenderForm("att-${System.currentTimeMillis()}-${f.teilnehmer.size}", name = gast.trim(), rolle = "Gast", stimmrecht = false)); gast = "" },
                        ) { Text("Hinzufügen") }
                    }
                }
            }
        }
        if (zeigeFehler && pruef.isNotEmpty()) Text("Bitte die markierten Angaben prüfen (${pruef.size}); sie stehen in den Abschnitten 1 bis 4.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        FormFuss(
            tab, 4, { tab = it }, onDone,
            {
                zeigeFehler = true
                val fm = model.sitzungPruefen(f)
                if (fm.isNotEmpty()) tab = fm.keys.minOf { sitzungFehlerSchritt(it) }
                else { fehler = null; model.sitzungSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e } }
            },
            !model.busy && !gesperrt,
        )
    }

    if (mitglieder) {
        var suche by remember { mutableStateOf("") }
        val rolleVorgabe = if (f.art == "board") "Vorstandsmitglied" else "Mitglied"
        val treffer = remember(model.members, suche) {
            val q = suche.trim().lowercase()
            model.members.filter { it.status != "terminated" && (q.isEmpty() || "${it.firstName} ${it.lastName} ${it.number}".lowercase().contains(q)) }.sortedBy { it.displayName.lowercase() }.take(40)
        }
        AlertDialog(
            onDismissRequest = { mitglieder = false }, title = { Text("Mitglieder hinzufügen") },
            text = {
                Column {
                    SuchFeld(suche, { suche = it }, "Name oder Nummer", Modifier.fillMaxWidth())
                    Text("Rolle: $rolleVorgabe (änderbar in der Liste)", style = MaterialTheme.typography.bodySmall)
                    Column(Modifier.height(280.dp).verticalScroll(rememberScrollState())) {
                        treffer.forEach { m ->
                            val dabei = f.teilnehmer.any { it.memberId == m.id }
                            TextButton(
                                enabled = !dabei, modifier = Modifier.fillMaxWidth(),
                                onClick = { f = f.copy(teilnehmer = f.teilnehmer + AnwesenderForm("att-${System.currentTimeMillis()}-${f.teilnehmer.size}", memberId = m.id, name = "${m.firstName} ${m.lastName}".trim(), email = m.email, rolle = rolleVorgabe)) },
                            ) { Text(m.displayName + if (dabei) " (dabei)" else "", maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        }
                        if (treffer.isEmpty()) Text("Kein Mitglied gefunden.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
            confirmButton = { TextButton(onClick = { mitglieder = false }) { Text("Fertig") } },
        )
    }
}
