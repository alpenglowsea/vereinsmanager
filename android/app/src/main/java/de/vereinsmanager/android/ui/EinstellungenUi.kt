package de.vereinsmanager.android.ui

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
fun EinstellungenScreen(model: AppModel, onProbes: () -> Unit, modifier: Modifier = Modifier) {
    var f by remember(model.vereinsdaten) { mutableStateOf(model.vereinsdaten) }
    var vorstand by remember(model.vorstand) { mutableStateOf(model.vorstand) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var unterschreiben by remember { mutableStateOf(false) }
    var sigMeldung by remember { mutableStateOf<String?>(null) }
    val fehler = Vereinsdaten.pruefen(f)
    fun fehlerFuer(k: String) = if (zeigeFehler) fehler[k] else null
    val vorstandFehler = Vorstand.pruefen(vorstand)
    val geaendert = f != model.vereinsdaten || vorstand != model.vorstand

    var tab by rememberSaveable { mutableIntStateOf(0) }
    val tabs = listOf("Allgemein", "Verein" + if (geaendert) " •" else "", "Datensicherung", "Unterstützen", "Fehler melden")
    Column(modifier.fillMaxSize()) {
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 8.dp) {
            tabs.forEachIndexed { i, t -> Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) }) }
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (tab) {
                0 -> {
                BriefpapierKarte(model)
                AntragEinstellungenKarten(model)
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Unterschrift für Zuwendungsbestätigungen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
                }
                1 -> {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Verein", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Lastschrifteinzug (SEPA)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Feld("Gläubiger-ID", f.glaeubigerId, { f = f.copy(glaeubigerId = it) }, hinweis = "z. B. DE98ZZZ09999999999 – bekommt man bei der Bundesbank")
                        Feld("Vereinskonto IBAN", f.iban, { f = f.copy(iban = it) }, error = fehlerFuer("iban"))
                        Feld("Vereinskonto BIC", f.bic, { f = f.copy(bic = it) }, error = fehlerFuer("bic"))
                        val fehlt = model.lastschriftFehlt
                        if (fehlt != null) Text("Für den Beitragslauf noch nötig: $fehlt", style = MaterialTheme.typography.bodySmall)
                    }
                }
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Zuwendungsbestätigung (Spendenquittung)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Feld("Finanzamt", f.finanzamt, { f = f.copy(finanzamt = it) })
                        Feld("Steuernummer", f.steuernummer, { f = f.copy(steuernummer = it) })
                        DatumFeld("Freistellungsbescheid vom", f.freistellungsDatum, optional = true) { f = f.copy(freistellungsDatum = it) }
                        DatumFeld("Feststellung der Satzungszwecke vom", f.feststellungsDatum, optional = true) { f = f.copy(feststellungsDatum = it) }
                        Feld("Veranlagungszeitraum", f.veranlagungszeitraum, { f = f.copy(veranlagungszeitraum = it) }, hinweis = "z. B. 2022 bis 2024")
                        Feld("Gemeinnützige Zwecke", f.zweck, { f = f.copy(zweck = it) }, singleLine = false, hinweis = "Steht so auf der Bestätigung")
                    }
                }
                if (meldung != null) Text(meldung!!, color = if (meldung == "Gespeichert.") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                Button(
                    onClick = {
                        if (fehler.isNotEmpty() || vorstandFehler.isNotEmpty()) { zeigeFehler = true; meldung = null }
                        else model.vereinSpeichern(f, vorstand.takeIf { it != model.vorstand }) { e -> meldung = e ?: "Gespeichert." }
                    },
                    enabled = !model.busy && geaendert, modifier = Modifier.fillMaxWidth(),
                ) { Text("Speichern") }
                }
                2 -> {
                    SicherungKarte(model, onProbes)
                    SchnappschussKarte(model)
                    LoeschenKarte(model)
                }
                3 -> UnterstuetzenKarte()
                else -> FehlerMeldenKarte()
            }
        }
    }
    if (unterschreiben) {
        UnterschriftDialog(
            onDismiss = { unterschreiben = false },
            onFertig = { u -> unterschreiben = false; model.unterschriftSpeichern(u) { e -> sigMeldung = e ?: "Unterschrift gespeichert." } },
        )
    }
}
