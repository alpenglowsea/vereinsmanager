package de.vereinsmanager.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.settings.Vorstand

/**
 * Einstellungen: Vereinsdaten, Vorstand, Sparten, Briefpapier, Aufnahmeantrag, Unterschrift, Datensicherung, Schnappschüsse,
 * Löschen, Spenden-Link und Fehlerbericht. Die Vereinsdaten stehen im selben Dokument wie am Desktop und gehen mit der Sicherung mit.
 * Vereinsdaten und Vorstand gelten erst mit „Speichern“; Sparten, Schnappschüsse und Löschen wirken sofort.
 */
@Composable
fun EinstellungenScreen(model: AppModel, modifier: Modifier = Modifier) {
    var f by remember(model.vereinsdaten) { mutableStateOf(model.vereinsdaten) }
    var vorstand by remember(model.vorstand) { mutableStateOf(model.vorstand) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var unterschreiben by remember { mutableStateOf(false) }
    var sigMeldung by remember { mutableStateOf<String?>(null) }
    var sicherungAnfrage by remember { mutableStateOf(false) }
    val fehler = Vereinsdaten.pruefen(f)
    fun fehlerFuer(k: String) = if (zeigeFehler) fehler[k] else null
    val vorstandFehler = Vorstand.pruefen(vorstand)
    val geaendert = f != model.vereinsdaten || vorstand != model.vorstand
    val antrag = rememberAntragEntwurf(model)
    fun vereinSpeichern() {
        if (fehler.isNotEmpty() || vorstandFehler.isNotEmpty()) { zeigeFehler = true; meldung = "Bitte die markierten Felder prüfen." }
        else model.vereinSpeichern(f, vorstand.takeIf { it != model.vorstand }) { e -> meldung = e ?: "Gespeichert." }
    }

    var tab by rememberSaveable { mutableIntStateOf(0) }
    // Je Reiter eine eigene Listenposition: Wer zurückkommt, steht wieder dort, wo er war.
    val listen = remember { List(5) { LazyListState() } }
    // Sprung aus dem Beitragslauf: zum Reiter „Verein“ wechseln und zur Karte „Lastschrifteinzug“ blättern; das gesuchte
    // Feld holt sich dann selbst den Cursor. (Die Liste zeichnet nur sichtbare Karten, deshalb erst hinblättern.)
    val sprung = model.einstellungenFokus
    androidx.compose.runtime.LaunchedEffect(sprung) {
        if (sprung != null) {
            tab = 1
            listen[1].scrollToItem(SEPA_INDEX)
            kotlinx.coroutines.delay(1500)
            model.einstellungenFokus = null
        }
    }
    val tabs = listOf("Allgemein" + if (antrag.geaendert) " •" else "", "Verein" + if (geaendert) " •" else "", "Datensicherung", "Unterstützen", "Fehler melden")
    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tabs.forEachIndexed { i, t -> TabChip(t, tab == i, { tab = i }) }
        }
        // Eine Liste, die nur die sichtbaren Karten zeichnet. Vorher wurden beim Wechsel alle Karten eines Reiters auf einmal
        // aufgebaut – in „Allgemein“ und „Verein“ je rund 20 Eingabefelder; der Reiter erschien erst, wenn alle fertig waren.
        // „Datensicherung“, „Unterstützen“ und „Fehler melden“ bleiben je ein Eintrag: Dort greifen Karten ineinander
        // (Löschen-Rückfrage öffnet das Sicherungsfenster der ersten Karte), und sie öffneten sich schon sofort.
        LazyColumn(
            Modifier.fillMaxWidth().weight(1f),
            state = listen[tab],
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            when (tab) {
                0 -> {
                    item(key = "leiste") { LeisteAnpassenKarte(model) }
                    item(key = "briefpapier") { BriefpapierKarte(model) }
                    antragEinstellungenKarten(model, antrag)
                    item(key = "unterschrift") {
                        WieseKarte(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Unterschrift für Zuwendungsbestätigungen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                val u = model.unterschrift
                                if (u != null) UnterschriftVorschau(u) else Text("Noch keine Unterschrift hinterlegt.", style = MaterialTheme.typography.bodySmall)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(onClick = { unterschreiben = true }, enabled = !model.busy) { Text(if (u == null) "Unterschreiben" else "Neu unterschreiben") }
                                    if (u != null) OutlinedButton(onClick = { model.unterschriftSpeichern(null) { e -> sigMeldung = e ?: "Unterschrift gelöscht." } }, enabled = !model.busy) { Text("Löschen") }
                                }
                                Text(
                                    "Die Unterschrift wird mit den Vereinsdaten gespeichert und steht damit auch in jeder Datensicherung. Sie kommt nur ins PDF, wenn Sie das beim jeweiligen Beleg einschalten.",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                if (sigMeldung != null) Text(sigMeldung!!, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                    item(key = "schutz") { SchutzKarte() }
                }
                1 -> {
                    item(key = "verein") {
                        WieseKarte(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Verein", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                Feld("Vereinsname *", f.name, { f = f.copy(name = it) }, error = fehlerFuer("name"))
                                Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
                                Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
                                Feld("PLZ", f.plz, { f = f.copy(plz = it) })
                                Feld("Ort", f.ort, { f = f.copy(ort = it) })
                                Feld("E-Mail", f.email, { f = f.copy(email = it) }, keyboard = androidx.compose.ui.text.input.KeyboardType.Email, hinweis = "Steht im Briefkopf der Rechnungen")
                                Feld("Telefon", f.telefon, { f = f.copy(telefon = it) }, keyboard = androidx.compose.ui.text.input.KeyboardType.Phone, hinweis = "Wird nur hier gepflegt (wie am Desktop), die App druckt es nirgends")
                                Feld("Webseite", f.webseite, { f = f.copy(webseite = it) }, keyboard = androidx.compose.ui.text.input.KeyboardType.Uri, hinweis = "Wird nur hier gepflegt (wie am Desktop), die App druckt es nirgends")
                                Feld("Vereinsregister-Nr.", f.registernummer, { f = f.copy(registernummer = it) }, hinweis = "z. B. VR 12345 – steht in der Fußzeile der Rechnungen")
                            }
                        }
                    }
                    item(key = "vorstand") { VorstandKarte(vorstand, { vorstand = it }, if (zeigeFehler) vorstandFehler else emptyMap()) }
                    item(key = "sparten") { SpartenKarte(model) }
                    item(key = "sepa") {
                        WieseKarte(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Lastschrifteinzug (SEPA)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                Feld("Gläubiger-ID", f.glaeubigerId, { f = f.copy(glaeubigerId = it) }, fokus = sprung == "creditorId", hinweis = "z. B. DE98ZZZ09999999999 – bekommt man bei der Bundesbank")
                                Feld("Vereinskonto IBAN", f.iban, { f = f.copy(iban = it) }, error = fehlerFuer("iban"), fokus = sprung == "creditorIban")
                                Feld("Vereinskonto BIC", f.bic, { f = f.copy(bic = it) }, error = fehlerFuer("bic"), fokus = sprung == "creditorBic")
                                val fehlt = model.lastschriftFehlt
                                if (fehlt != null) Text("Für den Beitragslauf noch nötig: $fehlt", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                    item(key = "zuwendung") {
                        WieseKarte(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Zuwendungsbestätigung (Spendenquittung)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                Feld("Finanzamt", f.finanzamt, { f = f.copy(finanzamt = it) })
                                Feld("Steuernummer", f.steuernummer, { f = f.copy(steuernummer = it) })
                                DatumFeld("Freistellungsbescheid vom", f.freistellungsDatum, optional = true) { f = f.copy(freistellungsDatum = it) }
                                DatumFeld("Feststellung der Satzungszwecke vom", f.feststellungsDatum, optional = true) { f = f.copy(feststellungsDatum = it) }
                                Feld("Veranlagungszeitraum", f.veranlagungszeitraum, { f = f.copy(veranlagungszeitraum = it) }, hinweis = "z. B. 2022 bis 2024")
                                Feld("Gemeinnützige Zwecke", f.zweck, { f = f.copy(zweck = it) }, singleLine = false, hinweis = "Steht so auf der Bestätigung")
                            }
                        }
                    }
                }
                2 -> item(key = "sicherung") {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        SicherungKarte(model, exportAnfrage = sicherungAnfrage, onExportAnfrage = { sicherungAnfrage = false })
                        JahresarchivKarte(model)
                        SchnappschussKarte(model)
                        LoeschenKarte(model, onSicherung = { sicherungAnfrage = true })
                    }
                }
                3 -> item(key = "unterstuetzen") { UnterstuetzenKarte() }
                else -> item(key = "fehler") { FehlerMeldenKarte() }
            }
        }
        // Feste Leiste unten: erscheint, sobald im Reiter etwas geändert ist, und bleibt beim Blättern stehen.
        // Danach kurz die Meldung („Gespeichert.“ oder Fehler).
        when (tab) {
            0 -> SpeichernLeiste(antrag.geaendert, antrag.meldung, !model.busy, { antrag.meldung = null }) { antrag.speichern(model) }
            1 -> SpeichernLeiste(geaendert, meldung, !model.busy, { meldung = null }) { vereinSpeichern() }
        }
    }
    if (unterschreiben) {
        UnterschriftDialog(
            onDismiss = { unterschreiben = false },
            onFertig = { u -> unterschreiben = false; model.unterschriftSpeichern(u) { e -> sigMeldung = e ?: "Unterschrift gespeichert." } },
        )
    }
}

/** Leiste am unteren Rand der Einstellungen: „Ungespeicherte Änderungen“ mit Speichern, oder die letzte Meldung. */
@Composable
private fun SpeichernLeiste(geaendert: Boolean, meldung: String?, aktiv: Boolean, onMeldungWeg: () -> Unit, onSpeichern: () -> Unit) {
    if (!geaendert && meldung == null) return
    val sc = MaterialTheme.colorScheme
    androidx.compose.material3.Surface(color = sc.surfaceContainerHigh, tonalElevation = 3.dp, shadowElevation = 6.dp, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            val ok = meldung == "Gespeichert."
            Text(
                meldung ?: "Ungespeicherte Änderungen",
                style = MaterialTheme.typography.bodyMedium,
                color = when { meldung == null -> sc.onSurface; ok -> sc.primary; else -> sc.error },
                modifier = Modifier.weight(1f),
            )
            if (geaendert) Button(onClick = onSpeichern, enabled = aktiv) { Text("Speichern") }
            else androidx.compose.material3.TextButton(onClick = onMeldungWeg) { Text("OK") }
        }
    }
}

/** Stelle der Karte „Lastschrifteinzug“ im Reiter „Verein“ (Verein, Vorstand, Sparten, Lastschrifteinzug, …). */
private const val SEPA_INDEX = 3
