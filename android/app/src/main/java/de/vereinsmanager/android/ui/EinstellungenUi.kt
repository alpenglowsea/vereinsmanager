package de.vereinsmanager.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.layout.layout
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
    // Sprung aus dem Beitragslauf: zum Reiter „Verein“ wechseln; das gesuchte Feld holt sich selbst den Cursor.
    val sprung = model.einstellungenFokus
    androidx.compose.runtime.LaunchedEffect(sprung) {
        if (sprung != null) {
            tab = 1
            kotlinx.coroutines.delay(1500)
            model.einstellungenFokus = null
        }
    }
    // Jeder Reiter wird beim ersten Besuch aufgebaut und danach behalten (nur unsichtbar), statt bei jedem Wechsel neu.
    // „Allgemein“ und „Verein“ haben je rund 20 Eingabefelder; das Aufbauen dauert spürbar. So geschieht es einmal je
    // Öffnen der Einstellungen. Den ersten Aufbau schieben wir um ein Bild nach hinten, damit der angetippte Reiter sofort
    // als gewählt erscheint und erst danach der Inhalt kommt.
    val besucht = remember { androidx.compose.runtime.mutableStateListOf<Int>() }
    val rollen = remember { List(5) { androidx.compose.foundation.ScrollState(0) } }
    androidx.compose.runtime.LaunchedEffect(tab) {
        if (tab !in besucht) {
            androidx.compose.runtime.withFrameNanos { }
            besucht.add(tab)
        }
    }
    val fokusVerwalter = androidx.compose.ui.platform.LocalFocusManager.current
    val tabs = listOf("Allgemein" + if (antrag.geaendert) " •" else "", "Verein" + if (geaendert) " •" else "", "Datensicherung", "Unterstützen", "Fehler melden")
    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // Beim Wechsel den Cursor aus dem alten Reiter nehmen, sonst bliebe er in einem unsichtbaren Feld (Tastatur offen).
            tabs.forEachIndexed { i, t -> TabChip(t, tab == i, { if (tab != i) { fokusVerwalter.clearFocus(); tab = i } }) }
        }
        androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().weight(1f)) {
            besucht.forEach { reiter ->
                androidx.compose.runtime.key(reiter) {
                    Column(
                        Modifier.nurSichtbarWenn(reiter == tab).fillMaxSize().verticalScroll(rollen[reiter]).padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        when (reiter) {
                            0 -> {
                            LeisteAnpassenKarte(model)
                            BriefpapierKarte(model)
                            AntragEinstellungenKarten(model, antrag)
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
                                SchutzKarte()
                                VersionKarte()
                            }
                            1 -> {
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
                            VorstandKarte(vorstand, { vorstand = it }, if (zeigeFehler) vorstandFehler else emptyMap())
                            SpartenKarte(model)
                            WieseKarte(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("Lastschrifteinzug (SEPA)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                    Feld("Gläubiger-ID", f.glaeubigerId, { f = f.copy(glaeubigerId = it) }, fokus = sprung == "creditorId" && tab == 1, hinweis = "z. B. DE98ZZZ09999999999 – bekommt man bei der Bundesbank")
                                    Feld("Vereinskonto IBAN", f.iban, { f = f.copy(iban = it) }, error = fehlerFuer("iban"), fokus = sprung == "creditorIban" && tab == 1)
                                    Feld("Vereinskonto BIC", f.bic, { f = f.copy(bic = it) }, error = fehlerFuer("bic"), fokus = sprung == "creditorBic" && tab == 1)
                                    val fehlt = model.lastschriftFehlt
                                    if (fehlt != null) Text("Für den Beitragslauf noch nötig: $fehlt", style = MaterialTheme.typography.bodySmall)
                                }
                            }
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
                            2 -> {
                                SicherungKarte(model, exportAnfrage = sicherungAnfrage, onExportAnfrage = { sicherungAnfrage = false })
                                JahresarchivKarte(model)
                                SchnappschussKarte(model)
                                LoeschenKarte(model, onSicherung = { sicherungAnfrage = true })
                            }
                            3 -> UnterstuetzenKarte()
                            else -> FehlerMeldenKarte()
                        }
                    }
                }
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

/**
 * Für die behaltenen Reiter: Der unsichtbare wird zwar vermessen (das merkt sich Compose, solange sich nichts ändert),
 * aber nicht gezeigt und nimmt keinen Platz ein. So bleibt er aufgebaut, mit allen Eingaben und der Bildlaufposition.
 */
private fun Modifier.nurSichtbarWenn(sichtbar: Boolean): Modifier = this.then(
    Modifier.layout { messbar, grenzen ->
        val p = messbar.measure(grenzen)
        if (sichtbar) layout(p.width, p.height) { p.place(0, 0) } else layout(0, 0) {}
    }
)
