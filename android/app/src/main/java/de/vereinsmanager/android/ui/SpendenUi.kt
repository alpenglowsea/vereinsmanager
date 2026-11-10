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
import de.vereinsmanager.core.donation.DonationExport
import de.vereinsmanager.core.donation.DonationReceipt
import de.vereinsmanager.core.donation.SpendeForm
import de.vereinsmanager.core.donation.SpendeOptionen
import de.vereinsmanager.core.donation.Spenden
import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Geld
import java.math.BigDecimal
import java.time.LocalDate

private val ART = linkedMapOf("money" to "Geldzuwendung", "goods" to "Sachzuwendung")

private fun jahrVon(r: DonationReceipt) = r.date.take(4)

// ---------------------------------------------------------------- Liste

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SpendenScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, modifier: Modifier = Modifier) {
    val alle = model.spenden
    var suche by remember { mutableStateOf("") }
    var art by remember { mutableStateOf<String?>(null) }
    var jahr by remember { mutableStateOf<String?>(null) }
    var gewaehlt by remember { mutableStateOf(setOf<String>()) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val jahre = remember(alle) { alle.map { jahrVon(it) }.filter { it.isNotEmpty() }.distinct().sortedDescending() }
    val shown = remember(alle, suche, art, jahr) {
        val q = suche.trim()
        alle.filter { r ->
            (art == null || r.type == art) && (jahr == null || jahrVon(r) == jahr) &&
                (q.isEmpty() || listOf(r.donorName, r.receiptNumber, r.notes.orEmpty(), r.goodsDescription.orEmpty()).any { it.contains(q, ignoreCase = true) })
        }
    }
    val waehlt = gewaehlt.isNotEmpty()
    fun summe(l: List<DonationReceipt>) = l.fold(BigDecimal.ZERO) { a, r -> a + r.amount }
    val geld = shown.filter { it.type == "money" }
    val sach = shown.filter { it.type == "goods" }
    val verzicht = shown.filter { it.isWaiverOfRefund }

    Column(modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiKachel("Gesamt", Geld.euro(summe(shown)), "${shown.size} Bestätigungen", Modifier.weight(1f))
            KpiKachel("Geldspenden", Geld.euro(summe(geld)), "${geld.size} Stück", Modifier.weight(1f))
        }
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiKachel("Sachspenden", Geld.euro(summe(sach)), "${sach.size} Stück", Modifier.weight(1f))
            KpiKachel("Aufwandsverzicht", Geld.euro(summe(verzicht)), "${verzicht.size} Stück", Modifier.weight(1f))
        }
        OutlinedTextField(
            suche, { suche = it }, label = { Text("Spender, Nummer oder Notiz suchen") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Art", ART, art) { art = it }
            FilterMenu("Jahr", jahre.associateWith { it }, jahr) { jahr = it }
            Button(onClick = onNew, modifier = Modifier.height(32.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 0.dp)) {
                Text("Neue Bestätigung", style = MaterialTheme.typography.labelMedium, maxLines = 1, softWrap = false)
            }
            ExportMenue("Exportieren", spendenExport(model, exporter, shown, "angezeigte"), kompakt = false)
        }
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                ExportMenue("Exportieren", spendenExport(model, exporter, shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
        Text("${shown.size} von ${alle.size} Bestätigungen", style = MaterialTheme.typography.bodySmall)
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (alle.isEmpty()) Text("Noch keine Zuwendungsbestätigungen. Legen Sie mit „Neue Bestätigung“ die erste an.", Modifier.padding(top = 16.dp))
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
                        Text(r.donorName.ifBlank { "(ohne Name)" }, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                        Text(
                            listOf(r.receiptNumber, if (r.date.isNotEmpty()) deDate(r.date) else "", ART[r.type] ?: r.type).filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Text(Geld.euro(r.amount), fontWeight = FontWeight.SemiBold)
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
internal fun KpiKachel(titel: String, wert: String, unten: String, modifier: Modifier) {
    Card(modifier) {
        Column(Modifier.padding(10.dp)) {
            Text(titel, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(unten, style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun spendenExport(model: AppModel, exporter: Exporter, liste: List<DonationReceipt>, wort: String): List<Pair<String, () -> Unit>> {
    val heute = LocalDate.now()
    val verein = Export.dateiname(model.vereinsname())
    return listOf(
        "CSV – ${liste.size} $wort Bestätigungen" to { exporter.csv("zuwendungen_${verein}_$heute.csv") { DonationExport.csvDateiInhalt(liste) } },
        "ZIP mit PDFs – ${liste.size} $wort Bestätigungen" to {
            exporter.zipSchreiber(DonationExport.zipDateiname(model.vereinsname(), liste.size)) { out -> model.spendenZipSchreiben(liste, out) }
        },
    )
}

// ---------------------------------------------------------------- Detail

@Composable
fun SpendeDetailScreen(model: AppModel, id: String, onEdit: () -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier) {
    val r = model.spenden.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { meldung = it }
    if (r == null) { Text("Die Bestätigung gibt es nicht mehr.", modifier.padding(16.dp)); return }
    val buchung = r.transactionId?.let { tid -> model.buchungen.firstOrNull { it.id == tid } }

    @Composable
    fun Zeile(label: String, wert: String) {
        if (wert.isBlank()) return
        Column(Modifier.padding(vertical = 4.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.bodyLarge)
        }
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(Geld.euro(r.amount), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineMedium)
        Text("${ART[r.type] ?: r.type} · ${r.receiptNumber}", style = MaterialTheme.typography.titleMedium)
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Zeile("Datum der Zuwendung", if (r.date.isNotEmpty()) deDate(r.date) else "")
        Zeile("Spender", r.donorName + if (r.donorType == "member") " (Mitglied)" else "")
        Zeile("Anschrift", listOf("${r.donorAddress.street} ${r.donorAddress.houseNumber}".trim(), "${r.donorAddress.zip} ${r.donorAddress.city}".trim(), r.donorAddress.country).filter { it.isNotBlank() }.joinToString(", "))
        Zeile("Betrag in Worten", r.amountInWords)
        if (r.type == "money") Zeile("Verzicht auf Erstattung von Aufwendungen", if (r.isWaiverOfRefund) "Ja" else "Nein")
        if (r.type == "goods") {
            Zeile("Sachspende", r.goodsDescription.orEmpty())
            Zeile("Herkunft", if (r.goodsOrigin == "business") "Betriebsvermögen" else "Privatvermögen")
            Zeile("Wertermittlung", r.goodsValuationBasis.orEmpty())
        }
        Zeile("Finanzamt", r.taxOffice)
        Zeile("Steuernummer", r.taxNumber)
        Zeile("Freistellungsbescheid vom", if (r.exemptionDate.isNotEmpty()) deDate(r.exemptionDate) else "")
        Zeile("Veranlagungszeitraum", r.assessmentPeriod)
        Zeile("Zweck", r.promotedPurpose)
        Zeile("Ausgestellt von", r.issuedBy)
        Zeile("Ort und Datum", r.cityAndDate)
        Zeile("Notiz", r.notes.orEmpty())
        Zeile("Unterschrift im PDF", if (r.signed) (if (model.unterschrift != null) "Ja" else "Ja, aber es ist keine Unterschrift mehr hinterlegt") else "Nein")
        Zeile("Verknüpfte Buchung", if (r.transactionId == null) "Keine" else buchung?.let { "${it.belegNummer} · ${Geld.euro(it.betrag.abs())}" } ?: "Die Buchung gibt es nicht mehr")
        Zeile("PDF im Dokumentenarchiv", if (r.documentId == null) "Nicht abgelegt" else "Abgelegt (Belege ${jahrVon(r)} → Spendenbescheinigungen)")
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onEdit) { Text("Bearbeiten") }
            OutlinedButton(onClick = {
                exporter.pdfSchreiber(DonationExport.pdfDateinamen(listOf(r)).first()) { out -> model.spendePdfSchreiben(r, out) }
            }, enabled = !model.busy) { Text("PDF speichern") }
            OutlinedButton(onClick = { loeschen = true }) { Text("Löschen") }
        }
    }
    if (loeschen) {
        if (buchung != null) {
            Aktionsdialog(
                titel = "Bestätigung löschen?", onDismiss = { loeschen = false },
                inhalt = {
                    Text("Zu ${r.receiptNumber} gehört die Buchung ${buchung.belegNummer} über ${Geld.euro(buchung.betrag.abs())}. Was soll mit der Buchung geschehen? Ein abgelegtes PDF wird mit der Bestätigung gelöscht.")
                },
                aktionen = {
                    Button(onClick = { loeschen = false; model.spendeLoeschen(r.id, true) { f -> if (f == null) onDeleted() else meldung = f } }, Modifier.fillMaxWidth()) { Text("Bestätigung und Buchung löschen") }
                    OutlinedButton(onClick = { loeschen = false; model.spendeLoeschen(r.id, false) { f -> if (f == null) onDeleted() else meldung = f } }, Modifier.fillMaxWidth()) { Text("Nur die Bestätigung löschen") }
                    TextButton(onClick = { loeschen = false }, Modifier.fillMaxWidth()) { Text("Abbrechen") }
                },
            )
        } else {
            AlertDialog(
                onDismissRequest = { loeschen = false }, title = { Text("Bestätigung löschen?") },
                text = { Text("${r.receiptNumber} über ${Geld.euro(r.amount)} wird endgültig gelöscht, ebenso ein abgelegtes PDF.") },
                confirmButton = { TextButton(onClick = { loeschen = false; model.spendeLoeschen(r.id, false) { f -> if (f == null) onDeleted() else meldung = f } }) { Text("Löschen") } },
                dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
            )
        }
    }
}

// ---------------------------------------------------------------- Formular

@Composable
fun SpendeFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.spenden.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf(if (vorhanden != null) model.spendeFormular(vorhanden) else model.spendeNeu()) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var pdfAblegen by remember { mutableStateOf(vorhanden?.documentId != null || vorhanden == null) }
    var buchungAnlegen by remember { mutableStateOf(false) }
    var kontoId by remember { mutableStateOf(model.konten.firstOrNull()?.id.orEmpty()) }
    var mitgliedWahl by remember { mutableStateOf(false) }
    var rueckfrage by remember { mutableStateOf(false) }
    var nachricht by remember { mutableStateOf<String?>(null) }
    val verknuepft = vorhanden?.transactionId != null && model.buchungen.any { it.id == vorhanden.transactionId }
    val geld = f.art == "money"
    val pruef = if (zeigeFehler) model.spendePruefen(f) else null
    val fehlend = remember(model.vereinsdaten) { model.spendeFehlendeAngaben() }

    fun speichern(angleichen: Boolean) {
        val opt = SpendeOptionen(
            buchungAnlegen = geld && !verknuepft && buchungAnlegen, kontoId = kontoId,
            pdfAblegen = pdfAblegen, buchungAnpassen = angleichen,
        )
        model.spendeSpeichern(f, opt) { erg, e ->
            if (e != null || erg == null) fehler = e ?: "Das Speichern ist fehlgeschlagen."
            else if (erg.pdfFehler != null) nachricht = "Die Bestätigung ist gespeichert, das PDF konnte aber nicht abgelegt werden: ${erg.pdfFehler}"
            else onDone()
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (fehlend.isNotEmpty()) Text("In den Einstellungen fehlt noch: ${fehlend.joinToString(", ")}. Die Angaben können hier trotzdem ergänzt werden.", style = MaterialTheme.typography.bodySmall)
        Auswahl("Art der Zuwendung", ART, f.art) { f = f.copy(art = it) }
        Feld("Nummer", f.nummer, { f = f.copy(nummer = it) })
        DatumFeld("Datum der Zuwendung *", f.datum) { f = f.copy(datum = it) }

        Text("Spender", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        Auswahl("Spender ist", mapOf("external" to "Externe Person", "member" to "Mitglied"), f.quelle) { f = f.copy(quelle = it, mitgliedId = if (it == "member") f.mitgliedId else "") }
        if (f.quelle == "member") {
            OutlinedButton(onClick = { mitgliedWahl = true }) { Text(if (f.mitgliedId.isEmpty()) "Mitglied wählen" else "Anderes Mitglied wählen") }
        }
        Feld("Name *", f.name, { f = f.copy(name = it) })
        Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
        Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
        Feld("PLZ", f.plz, { f = f.copy(plz = it) })
        Feld("Ort", f.ort, { f = f.copy(ort = it) })
        Feld("Land", f.land, { f = f.copy(land = it) })

        Text(if (geld) "Betrag" else "Wert", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        Feld("Betrag in € *", f.betrag, { f = f.copy(betrag = it, inWorten = Spenden.inWorten(it)) }, keyboard = KeyboardType.Decimal)
        Feld("Betrag in Worten", f.inWorten, { f = f.copy(inWorten = it) })
        if (geld) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(f.verzicht, { f = f.copy(verzicht = it) })
                Text("  Verzicht auf Erstattung von Aufwendungen", Modifier.weight(1f))
            }
        } else {
            Feld("Genaue Bezeichnung der Sachspende *", f.sachBeschreibung, { f = f.copy(sachBeschreibung = it) }, singleLine = false)
            Auswahl("Herkunft", mapOf("private" to "Privatvermögen", "business" to "Betriebsvermögen"), f.sachHerkunft) { f = f.copy(sachHerkunft = it) }
            Feld("Unterlagen zur Wertermittlung", f.sachUnterlagen, { f = f.copy(sachUnterlagen = it) })
        }

        Text("Angaben des Vereins", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        Feld("Finanzamt", f.finanzamt, { f = f.copy(finanzamt = it) })
        Feld("Steuernummer", f.steuernummer, { f = f.copy(steuernummer = it) })
        DatumFeld("Freistellungsbescheid vom", f.freistellung, optional = true) { f = f.copy(freistellung = it) }
        DatumFeld("Feststellung der Satzungszwecke vom", f.feststellung, optional = true) { f = f.copy(feststellung = it) }
        Feld("Veranlagungszeitraum", f.veranlagung, { f = f.copy(veranlagung = it) })
        Feld("Gemeinnütziger Zweck", f.zweck, { f = f.copy(zweck = it) }, singleLine = false)
        Feld("Ausgestellt von", f.aussteller, { f = f.copy(aussteller = it) })
        Feld("Ort und Datum der Ausstellung", f.ortDatum, { f = f.copy(ortDatum = it) })
        Feld("Notiz (erscheint nicht im PDF)", f.notiz, { f = f.copy(notiz = it) }, singleLine = false)

        Text("Beim Speichern", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(pdfAblegen, { pdfAblegen = it })
            Text("  PDF im Dokumentenarchiv ablegen (Belege ${f.datum.take(4).ifEmpty { "…" }} → Spendenbescheinigungen)", Modifier.weight(1f))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(f.unterschrift && model.unterschrift != null, { f = f.copy(unterschrift = it) }, enabled = model.unterschrift != null)
            Text("  Unterschrift ins PDF setzen", Modifier.weight(1f))
        }
        if (model.unterschrift == null) Text("Dafür zuerst in den Einstellungen unterschreiben.", style = MaterialTheme.typography.bodySmall)
        if (geld && !verknuepft) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(buchungAnlegen, { buchungAnlegen = it }, enabled = model.konten.isNotEmpty())
                Text("  Einnahme auf Konto 40450 Geldspenden buchen", Modifier.weight(1f))
            }
            if (buchungAnlegen) Auswahl("Eingegangen auf", model.konten.associate { it.id to it.name }, kontoId) { kontoId = it }
            if (model.konten.isEmpty()) Text("Es gibt noch kein Konto oder keine Kasse, auf die gebucht werden könnte.", style = MaterialTheme.typography.bodySmall)
        }
        if (verknuepft) Text("Zu dieser Bestätigung gehört schon eine Buchung.", style = MaterialTheme.typography.bodySmall)

        val anzeige = pruef ?: fehler
        if (anzeige != null) Text(anzeige, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
        Button(
            onClick = {
                fehler = null
                if (model.spendePruefen(f) != null) zeigeFehler = true
                else if (model.spendeBuchungBetroffen(f)) rueckfrage = true
                else speichern(false)
            },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        ) { Text("Speichern") }
    }

    if (mitgliedWahl) {
        WahlDialog(
            "Mitglied wählen",
            model.members.sortedBy { "${it.lastName} ${it.firstName}" }.map { it.id to "${it.lastName}, ${it.firstName}" },
            onDismiss = { mitgliedWahl = false },
        ) { mid ->
            mitgliedWahl = false
            model.members.firstOrNull { it.id == mid }?.let { f = Spenden.mitMitglied(f, it) }
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
