package de.vereinsmanager.android.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.Exporter
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.invoice.BezahltAngaben
import de.vereinsmanager.core.invoice.PositionForm
import de.vereinsmanager.core.invoice.Rechnung
import de.vereinsmanager.core.invoice.RechnungOptionen
import de.vereinsmanager.core.invoice.Rechnungen
import de.vereinsmanager.core.invoice.RechnungsExport
import de.vereinsmanager.core.invoice.RechnungsRegeln
import de.vereinsmanager.core.skr42.Skr42
import java.math.BigDecimal
import java.time.LocalDate

private val ZAHLARTEN = linkedMapOf("transfer" to "Überweisung", "cash" to "Bar", "sepa" to "Lastschrift", "standing_order" to "Dauerauftrag")
private val STATI = linkedMapOf("draft" to "Entwurf", "open" to "Offen", "overdue" to "Überfällig", "paid" to "Bezahlt", "cancelled" to "Storniert")
private val SPHAEREN get() = FinanceLabels.SPHERE

private fun jahrVon(r: Rechnung) = r.datum.take(4)

/** Der angezeigte Status: „offen“ mit abgelaufener Frist heißt überfällig. */
private fun anzeigeStatus(r: Rechnung, heute: LocalDate): String =
    if (RechnungsRegeln.ueberfaellig(r, heute)) "overdue" else r.status

// ---------------------------------------------------------------- Liste

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun RechnungenScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, onVorlage: () -> Unit, modifier: Modifier = Modifier) {
    val alle = model.rechnungen
    val heute = remember { LocalDate.now() }
    var suche by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    var jahr by remember { mutableStateOf<String?>(null) }
    var gewaehlt by remember { mutableStateOf(setOf<String>()) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val jahre = remember(alle) { alle.map { jahrVon(it) }.filter { it.isNotEmpty() }.distinct().sortedDescending() }
    val shown = remember(alle, suche, status, jahr) {
        val q = suche.trim()
        alle.filter { r ->
            (status == null || anzeigeStatus(r, heute) == status) && (jahr == null || jahrVon(r) == jahr) &&
                (q.isEmpty() || listOf(r.nummer, r.name, r.firma, r.betreff, r.notiz).any { it.contains(q, ignoreCase = true) })
        }
    }
    val waehlt = gewaehlt.isNotEmpty()
    fun summe(l: List<Rechnung>) = l.fold(BigDecimal.ZERO) { a, r -> a + r.brutto }
    val offen = alle.filter { it.status == "open" }
    val ueber = alle.filter { RechnungsRegeln.ueberfaellig(it, heute) }
    val bezahlt = alle.filter { it.status == "paid" }

    Column(modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiKachel("Offen", Geld.euro(summe(offen)), "${offen.size} Rechnungen", Modifier.weight(1f))
            KpiKachel("Überfällig", Geld.euro(summe(ueber)), "${ueber.size} Rechnungen", Modifier.weight(1f))
            KpiKachel("Bezahlt", Geld.euro(summe(bezahlt)), "${bezahlt.size} Rechnungen", Modifier.weight(1f))
        }
        OutlinedTextField(
            suche, { suche = it }, label = { Text("Nummer, Empfänger oder Betreff suchen") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Status", STATI, status) { status = it }
            FilterMenu("Jahr", jahre.associateWith { it }, jahr) { jahr = it }
            KompaktKnopf("Neue Rechnung", onNew, primaer = true)
            KompaktKnopf("Vorlage", onVorlage)
            ExportMenue("Exportieren", rechnungenExport(model, exporter, shown, "angezeigte"), kompakt = false)
        }
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                ExportMenue("Exportieren", rechnungenExport(model, exporter, shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
        Text("${shown.size} von ${alle.size} Rechnungen", style = MaterialTheme.typography.bodySmall)
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (alle.isEmpty()) Text("Noch keine Rechnungen. Legen Sie mit „Neue Rechnung“ die erste an.", Modifier.padding(top = 16.dp))
        LazyColumn {
            items(shown, key = { it.id }) { r ->
                val an = r.id in gewaehlt
                Row(
                    Modifier.fillMaxWidth().combinedClickable(
                        onClick = { if (waehlt) gewaehlt = if (an) gewaehlt - r.id else gewaehlt + r.id else onOpen(r.id) },
                        onLongClick = { if (!an) gewaehlt = gewaehlt + r.id; info = null },
                    ).padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (waehlt) Checkbox(an, { gewaehlt = if (an) gewaehlt - r.id else gewaehlt + r.id })
                    Column(Modifier.weight(1f)) {
                        Text(r.anzeigeName.ifBlank { "(ohne Empfänger)" }, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                        Text(
                            listOf(r.nummer, if (r.datum.isNotEmpty()) deDate(r.datum) else "", STATI[anzeigeStatus(r, heute)] ?: r.status).filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (anzeigeStatus(r, heute) == "overdue") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    Text(Geld.euro(r.brutto), fontWeight = FontWeight.SemiBold)
                }
                HorizontalDivider()
            }
        }
    }
}

private fun rechnungenExport(model: AppModel, exporter: Exporter, liste: List<Rechnung>, wort: String): List<Pair<String, () -> Unit>> {
    val verein = Export.dateiname(model.vereinsname())
    return listOf("CSV – ${liste.size} $wort Rechnungen" to { exporter.csv("rechnungen_${verein}_${LocalDate.now()}.csv") { RechnungsExport.csvDateiInhalt(liste) } })
}

// ---------------------------------------------------------------- Detail

@Composable
fun RechnungDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onAnsehen: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    val r = model.rechnungen.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var bezahlen by remember { mutableStateOf(false) }
    var zurueck by remember { mutableStateOf(false) }
    var stornieren by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { meldung = it }
    if (r == null) { Text("Die Rechnung gibt es nicht mehr.", modifier.padding(16.dp)); return }
    val heute = LocalDate.now()
    val buchung = r.buchungId?.let { bid -> model.buchungen.firstOrNull { it.id == bid } }
    val st = anzeigeStatus(r, heute)

    @Composable
    fun Zeile(label: String, wert: String) {
        if (wert.isBlank()) return
        Column(Modifier.padding(vertical = 4.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.bodyLarge)
        }
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(Geld.euro(r.brutto), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
        Text("${r.nummer} · ${STATI[st] ?: r.status}", style = MaterialTheme.typography.titleMedium, color = if (st == "overdue") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Zeile("Empfänger", listOf(r.firma, r.name, r.ansprechpartner).filter { it.isNotBlank() }.joinToString("\n"))
        Zeile("Anschrift", listOf("${r.adresse.street} ${r.adresse.houseNumber}".trim(), "${r.adresse.zip} ${r.adresse.city}".trim(), r.adresse.country).filter { it.isNotBlank() }.joinToString(", "))
        Zeile("E-Mail / Telefon", listOf(r.email, r.telefon).filter { it.isNotBlank() }.joinToString(" · "))
        Zeile("Rechnungsdatum", if (r.datum.isNotEmpty()) deDate(r.datum) else "")
        Zeile("Leistungsdatum", if (r.leistungsdatum.isNotEmpty()) deDate(r.leistungsdatum) else "")
        Zeile("Fällig am", if (r.faellig.isNotEmpty()) deDate(r.faellig) else "")
        Zeile("Betreff", r.betreff)
        Zeile("Steuerlicher Bereich", SPHAEREN[r.sphaere] ?: r.sphaere)
        if (r.kleinunternehmer) Zeile("Umsatzsteuer", "Kleinunternehmer (§ 19 UStG): keine Umsatzsteuer")

        Text("Positionen", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        r.positionen.forEach { p ->
            Column(Modifier.padding(vertical = 4.dp)) {
                Text("${p.nummer}. ${p.text}")
                Text(
                    "${RechnungsRegeln.mengeText(p.menge)} ${p.einheit} × ${Geld.euro(p.preis)} · ${p.ust} % USt = ${Geld.euro(p.summe)}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        HorizontalDivider(Modifier.padding(vertical = 6.dp))
        Zeile("Netto", Geld.euro(r.netto))
        r.ustJeSatz.filter { it.key > 0 }.forEach { (satz, b) -> Zeile("Umsatzsteuer $satz %", Geld.euro(b)) }
        Zeile("Gesamtbetrag", Geld.euro(r.brutto))
        Zeile("Bezahlt am", r.bezahltAm?.let { deDate(it) + (r.zahlart?.let { z -> " (${ZAHLARTEN[z] ?: z})" } ?: "") }.orEmpty())
        Zeile("Verknüpfte Buchung", if (r.buchungId == null) "" else buchung?.let { "${it.belegNummer} · ${Geld.euro(it.betrag.abs())}" } ?: "Die Buchung gibt es nicht mehr")
        Zeile("PDF im Dokumentenarchiv", if (r.dokumentId == null) "Nicht abgelegt" else "Abgelegt (Belege ${jahrVon(r)} → Ausgangsrechnungen)")
        Zeile("Notiz", r.notiz)
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))

        val offen = r.status != "paid" && r.status != "cancelled"
        Aktionsleiste(
            listOfNotNull(
                if (offen) Aktion("Als bezahlt markieren", { bezahlen = true }, primaer = true, enabled = !model.busy) else null,
                if (r.status == "paid") Aktion("Auf offen zurücksetzen", { zurueck = true }, primaer = true, enabled = !model.busy) else null,
                Aktion("Bearbeiten", onEdit),
                Aktion("PDF ansehen", onAnsehen),
                Aktion("PDF speichern", { exporter.pdfSchreiber(RechnungsExport.pdfDateiname(r)) { out -> model.rechnungPdfSchreiben(r, out) } }, enabled = !model.busy),
                if (r.status == "draft" || r.status == "open") Aktion("Stornieren", { stornieren = true }, enabled = !model.busy) else null,
                Aktion("Löschen", { loeschen = true }, enabled = !model.busy),
            ),
            Modifier.padding(top = 16.dp),
        )
    }

    if (bezahlen) BezahltDialog(model, r, onDismiss = { bezahlen = false }) { f -> bezahlen = false; meldung = f }

    if (zurueck) {
        if (buchung != null) {
            Aktionsdialog(
                titel = "Auf offen zurücksetzen?", onDismiss = { zurueck = false },
                inhalt = { Text("Zu ${r.nummer} gehört die Buchung ${buchung.belegNummer} über ${Geld.euro(buchung.betrag.abs())}. Was soll mit ihr geschehen?") },
                aktionen = {
                    Button(onClick = { zurueck = false; model.rechnungZuruecksetzen(r.id, true) { f -> meldung = f } }, Modifier.fillMaxWidth()) { Text("Zurücksetzen und Buchung löschen") }
                    OutlinedButton(onClick = { zurueck = false; model.rechnungZuruecksetzen(r.id, false) { f -> meldung = f } }, Modifier.fillMaxWidth()) { Text("Zurücksetzen, Buchung behalten") }
                    TextButton(onClick = { zurueck = false }, Modifier.fillMaxWidth()) { Text("Abbrechen") }
                },
            )
        } else {
            AlertDialog(
                onDismissRequest = { zurueck = false }, title = { Text("Auf offen zurücksetzen?") },
                text = { Text("${r.nummer} gilt dann wieder als unbezahlt.") },
                confirmButton = { TextButton(onClick = { zurueck = false; model.rechnungZuruecksetzen(r.id, false) { f -> meldung = f } }) { Text("Zurücksetzen") } },
                dismissButton = { TextButton(onClick = { zurueck = false }) { Text("Abbrechen") } },
            )
        }
    }
    if (stornieren) {
        AlertDialog(
            onDismissRequest = { stornieren = false }, title = { Text("Rechnung stornieren?") },
            text = { Text("${r.nummer} wird als storniert gekennzeichnet. Sie bleibt mit ihrer Nummer erhalten, damit keine Nummer fehlt.") },
            confirmButton = { TextButton(onClick = { stornieren = false; model.rechnungStornieren(r.id) { f -> meldung = f } }) { Text("Stornieren") } },
            dismissButton = { TextButton(onClick = { stornieren = false }) { Text("Abbrechen") } },
        )
    }
    if (loeschen) {
        if (buchung != null) {
            Aktionsdialog(
                titel = "Rechnung löschen?", onDismiss = { loeschen = false },
                inhalt = { Text("Zu ${r.nummer} gehört die Buchung ${buchung.belegNummer} über ${Geld.euro(buchung.betrag.abs())}. Was soll mit der Buchung geschehen? Ein abgelegtes PDF wird mit der Rechnung gelöscht.") },
                aktionen = {
                    Button(onClick = { loeschen = false; model.rechnungLoeschen(r.id, true) { f -> if (f == null) onDeleted() else meldung = f } }, Modifier.fillMaxWidth()) { Text("Rechnung und Buchung löschen") }
                    OutlinedButton(onClick = { loeschen = false; model.rechnungLoeschen(r.id, false) { f -> if (f == null) onDeleted() else meldung = f } }, Modifier.fillMaxWidth()) { Text("Nur die Rechnung löschen") }
                    TextButton(onClick = { loeschen = false }, Modifier.fillMaxWidth()) { Text("Abbrechen") }
                },
            )
        } else {
            AlertDialog(
                onDismissRequest = { loeschen = false }, title = { Text("Rechnung löschen?") },
                text = { Text("${r.nummer} über ${Geld.euro(r.brutto)} wird endgültig gelöscht, ebenso ein abgelegtes PDF. Die Nummer kann danach erneut vergeben werden.") },
                confirmButton = { TextButton(onClick = { loeschen = false; model.rechnungLoeschen(r.id, false) { f -> if (f == null) onDeleted() else meldung = f } }) { Text("Löschen") } },
                dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
            )
        }
    }
}

/** Fragt Zahldatum, Zahlart und – auf Wunsch – die Einnahmebuchung ab. Der Konto-Vorschlag richtet sich nach der Sphäre. */
@Composable
private fun BezahltDialog(model: AppModel, r: Rechnung, onDismiss: () -> Unit, onFertig: (String?) -> Unit) {
    val vorschlag = remember(r.sphaere) { Rechnungen.kontoVorschlag(r.sphaere) }
    val skr = remember { Skr42.mains("income") }
    var datum by remember { mutableStateOf(LocalDate.now().toString()) }
    var zahlart by remember { mutableStateOf("transfer") }
    var buchen by remember { mutableStateOf(model.konten.isNotEmpty() && r.buchungId == null) }
    var kontoId by remember { mutableStateOf(model.konten.firstOrNull()?.id.orEmpty()) }
    var kreis by remember { mutableStateOf(vorschlag.nummernkreis) }
    var konto by remember { mutableStateOf(vorschlag.konto) }
    var skrKonto by remember { mutableStateOf(vorschlag.skrKonto) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val haupt = BuchungRegeln.hauptkonto(kreis, konto, skr)
    val subs = haupt?.subCategories.orEmpty()

    Aktionsdialog(
        titel = "Als bezahlt markieren", onDismiss = onDismiss,
        inhalt = {
            Column {
                Text("${r.nummer} · ${Geld.euro(r.brutto)}", style = MaterialTheme.typography.titleSmall)
                DatumFeld("Zahldatum", datum) { datum = it }
                Auswahl("Zahlart", ZAHLARTEN, zahlart) { zahlart = it }
                if (r.buchungId != null) {
                    Text("Zu dieser Rechnung gibt es schon eine Buchung; es wird keine weitere angelegt.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(buchen, { buchen = it }, enabled = model.konten.isNotEmpty())
                        Text("  Einnahme buchen", Modifier.weight(1f))
                    }
                    if (model.konten.isEmpty()) Text("Es gibt noch kein Konto oder keine Kasse, auf die gebucht werden könnte.", style = MaterialTheme.typography.bodySmall)
                    if (buchen) {
                        Auswahl("Eingegangen auf", model.konten.associate { it.id to it.name }, kontoId) { kontoId = it }
                        Auswahl("Nummernkreis (SKR 42)", skr.associate { it.id to BuchungRegeln.nummernkreisText(it) }, haupt?.id ?: kreis) { k ->
                            skr.firstOrNull { it.id == k }?.let { m -> kreis = BuchungRegeln.nummernkreisText(m); m.subCategories.firstOrNull()?.let { s -> konto = s.label; skrKonto = s.code } }
                        }
                        Auswahl("Konto (SKR 42)", subs.associate { it.label to it.label }, konto) { k -> subs.firstOrNull { it.label == k }?.let { s -> konto = s.label; skrKonto = s.code } }
                        Text("Vorschlag nach steuerlichem Bereich „${SPHAEREN[r.sphaere] ?: r.sphaere}“; Sie können ihn ändern.", style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error)
            }
        },
        aktionen = {
            Button(
                onClick = {
                    fehler = null
                    val a = BezahltAngaben(
                        datum = datum, zahlart = zahlart, buchungAnlegen = buchen && r.buchungId == null, kontoId = kontoId,
                        nummernkreis = kreis, konto = konto, skrKonto = skrKonto,
                    )
                    model.rechnungBezahlen(r.id, a) { f -> if (f == null) onFertig(null) else fehler = f }
                },
                enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
            ) { Text("Als bezahlt markieren") }
            TextButton(onClick = onDismiss, Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

// ---------------------------------------------------------------- Formular

@Composable
fun RechnungFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.rechnungen.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf(if (vorhanden != null) model.rechnungFormular(vorhanden) else model.rechnungNeu()) }
    var tageText by remember { mutableStateOf(f.zahlungszielTage.toString()) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var pdfAblegen by remember { mutableStateOf(vorhanden == null || vorhanden.dokumentId != null) }
    var mitgliedWahl by remember { mutableStateOf(false) }
    var kontaktWahl by remember { mutableStateOf(false) }
    var rueckfrage by remember { mutableStateOf(false) }
    var nachricht by remember { mutableStateOf<String?>(null) }
    val bezahlt = f.status == "paid"
    val pruef = if (zeigeFehler) model.rechnungPruefen(f) else null
    val summen = RechnungsRegeln.berechnen(f.positionen, f.kleinunternehmer)

    fun speichern(angleichen: Boolean) {
        model.rechnungSpeichern(f, RechnungOptionen(pdfAblegen = pdfAblegen, buchungAnpassen = angleichen)) { erg, e ->
            if (e != null || erg == null) fehler = e ?: "Das Speichern ist fehlgeschlagen."
            else if (erg.pdfFehler != null) nachricht = "Die Rechnung ist gespeichert, das PDF konnte aber nicht abgelegt werden: ${erg.pdfFehler}"
            else onDone()
        }
    }

    fun datumGeaendert(d: String) { f = f.copy(datum = d, faellig = RechnungsRegeln.faellig(d, f.zahlungszielTage).ifEmpty { f.faellig }) }
    fun position(i: Int, p: PositionForm) { f = f.copy(positionen = f.positionen.toMutableList().also { it[i] = p }) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Empfänger", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { mitgliedWahl = true }) { Text("Mitglied wählen") }
            OutlinedButton(onClick = { kontaktWahl = true }, enabled = model.rechnungKontakte().isNotEmpty()) { Text("Kontakt wählen") }
        }
        Feld("Name *", f.name, { f = f.copy(name = it, empfaengerArt = if (f.empfaengerId.isEmpty()) "custom" else f.empfaengerArt) })
        Feld("Firma / Organisation", f.firma, { f = f.copy(firma = it) })
        Feld("Ansprechpartner", f.ansprechpartner, { f = f.copy(ansprechpartner = it) })
        Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
        Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
        Feld("PLZ", f.plz, { f = f.copy(plz = it) })
        Feld("Ort", f.ort, { f = f.copy(ort = it) })
        Feld("Land", f.land, { f = f.copy(land = it) })
        Feld("E-Mail", f.email, { f = f.copy(email = it) }, keyboard = KeyboardType.Email)
        Feld("Telefon", f.telefon, { f = f.copy(telefon = it) }, keyboard = KeyboardType.Phone)

        Text("Rechnung", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        Feld("Rechnungsnummer", f.nummer, { f = f.copy(nummer = it) })
        DatumFeld("Rechnungsdatum *", f.datum) { datumGeaendert(it) }
        DatumFeld("Leistungsdatum", f.leistungsdatum, optional = true) { f = f.copy(leistungsdatum = it) }
        Feld("Zahlungsziel in Tagen", tageText, {
            tageText = it.filter { c -> c.isDigit() }.take(3)
            tageText.toIntOrNull()?.let { t -> f = f.copy(zahlungszielTage = t, faellig = RechnungsRegeln.faellig(f.datum, t).ifEmpty { f.faellig }) }
        }, keyboard = KeyboardType.Number)
        DatumFeld("Fällig am", f.faellig) { f = f.copy(faellig = it) }
        Auswahl("Steuerlicher Bereich (Sphäre)", SPHAEREN, f.sphaere) { f = f.copy(sphaere = it) }
        if (bezahlt) Text("Diese Rechnung ist bezahlt. Den Status ändern Sie in der Ansicht mit „Auf offen zurücksetzen“.", style = MaterialTheme.typography.bodySmall)
        else Auswahl("Status", linkedMapOf("draft" to "Entwurf", "open" to "Offen", "cancelled" to "Storniert"), f.status) { f = f.copy(status = it) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(f.kleinunternehmer, { an ->
                f = f.copy(
                    kleinunternehmer = an,
                    positionen = f.positionen.map { p -> if (an) p.copy(ust = 0) else if (p.ust == 0) p.copy(ust = 19) else p },
                )
            })
            Text("  Kleinunternehmer (§ 19 UStG): ohne Umsatzsteuer", Modifier.weight(1f))
        }
        if (f.kleinunternehmer) Text("Alle Positionen stehen auf 0 %. Auf der Rechnung erscheint der Hinweis aus der Vorlage.", style = MaterialTheme.typography.bodySmall)

        Feld("Überschrift", f.titel, { f = f.copy(titel = it) })
        Feld("Betreff", f.betreff, { f = f.copy(betreff = it) })
        Feld("Einleitung", f.einleitung, { f = f.copy(einleitung = it) }, singleLine = false)

        Text("Positionen", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        f.positionen.forEachIndexed { i, p ->
            Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Position ${i + 1}", style = MaterialTheme.typography.labelLarge)
                    Feld("Bezeichnung *", p.text, { position(i, p.copy(text = it)) }, singleLine = false)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) { Feld("Menge", p.menge, { position(i, p.copy(menge = it)) }, keyboard = KeyboardType.Decimal) }
                        Column(Modifier.weight(1f)) { Feld("Einheit", p.einheit, { position(i, p.copy(einheit = it)) }) }
                    }
                    Feld("Einzelpreis in € *", p.preis, { position(i, p.copy(preis = it)) }, keyboard = KeyboardType.Decimal)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("USt", style = MaterialTheme.typography.labelMedium)
                        RechnungsRegeln.UST_SAETZE.forEach { s ->
                            FilterChip((if (f.kleinunternehmer) 0 else p.ust) == s, { position(i, p.copy(ust = s)) }, { Text("$s %") }, enabled = !f.kleinunternehmer)
                        }
                    }
                    val summe = summen.positionen.getOrNull(i)?.summe
                    if (summe != null) Text("Summe: ${Geld.euro(summe)}", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        KompaktKnopf("Nach oben", {
                            if (i > 0) f = f.copy(positionen = f.positionen.toMutableList().also { l -> val t = l[i]; l[i] = l[i - 1]; l[i - 1] = t })
                        }, enabled = i > 0)
                        KompaktKnopf("Nach unten", {
                            if (i < f.positionen.size - 1) f = f.copy(positionen = f.positionen.toMutableList().also { l -> val t = l[i]; l[i] = l[i + 1]; l[i + 1] = t })
                        }, enabled = i < f.positionen.size - 1)
                        KompaktKnopf("Entfernen", { f = f.copy(positionen = f.positionen.filterIndexed { j, _ -> j != i }) }, enabled = f.positionen.size > 1)
                    }
                }
            }
        }
        OutlinedButton(onClick = { f = f.copy(positionen = f.positionen + Rechnungen.neuePositionFuer(f)) }) { Text("Position hinzufügen") }

        Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Column(Modifier.padding(10.dp)) {
                Text("Netto: ${Geld.euro(summen.netto)}")
                summen.ustJeSatz.filter { it.key > 0 }.forEach { (s, b) -> Text("Umsatzsteuer $s %: ${Geld.euro(b)}") }
                Text("Gesamtbetrag: ${Geld.euro(summen.brutto)}", fontWeight = FontWeight.Bold)
            }
        }

        Feld("Schlusstext", f.schluss, { f = f.copy(schluss = it) }, singleLine = false)
        Feld("Notiz (erscheint nicht im PDF)", f.notiz, { f = f.copy(notiz = it) }, singleLine = false)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(pdfAblegen, { pdfAblegen = it })
            Text("  PDF im Dokumentenarchiv ablegen (Belege ${f.datum.take(4).ifEmpty { "…" }} → Ausgangsrechnungen)", Modifier.weight(1f))
        }

        val anzeige = pruef ?: fehler
        if (anzeige != null) Text(anzeige, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
        Button(
            onClick = {
                fehler = null
                if (model.rechnungPruefen(f) != null) zeigeFehler = true
                else if (model.rechnungBuchungBetroffen(f)) rueckfrage = true
                else speichern(false)
            },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        ) { Text("Speichern") }
    }

    if (mitgliedWahl) {
        WahlDialog("Mitglied wählen", model.members.sortedBy { "${it.lastName} ${it.firstName}" }.map { it.id to "${it.lastName}, ${it.firstName}" }, onDismiss = { mitgliedWahl = false }) { mid ->
            mitgliedWahl = false
            model.members.firstOrNull { it.id == mid }?.let { f = Rechnungen.mitMitglied(f, it) }
        }
    }
    if (kontaktWahl) {
        WahlDialog("Kontakt wählen", model.rechnungKontakte(), onDismiss = { kontaktWahl = false }) { kid ->
            kontaktWahl = false
            model.rechnungKontakt(kid)?.let { f = Rechnungen.mitKontakt(f, it) }
        }
    }
    if (rueckfrage) {
        Aktionsdialog(
            titel = "Verknüpfte Buchung", onDismiss = { rueckfrage = false },
            inhalt = { Text("Betrag, Datum oder Name haben sich geändert. Soll die zugehörige Buchung angepasst werden?") },
            aktionen = {
                Button(onClick = { rueckfrage = false; speichern(true) }, Modifier.fillMaxWidth()) { Text("Buchung angleichen") }
                OutlinedButton(onClick = { rueckfrage = false; speichern(false) }, Modifier.fillMaxWidth()) { Text("Buchung unverändert lassen") }
                TextButton(onClick = { rueckfrage = false }, Modifier.fillMaxWidth()) { Text("Abbrechen") }
            },
        )
    }
    if (nachricht != null) {
        AlertDialog(
            onDismissRequest = {}, title = { Text("Gespeichert") }, text = { Text(nachricht!!) },
            confirmButton = { TextButton(onClick = { nachricht = null; onDone() }) { Text("OK") } },
        )
    }
}
