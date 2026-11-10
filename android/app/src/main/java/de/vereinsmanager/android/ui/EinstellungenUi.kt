package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.settings.Vereinsdaten

/**
 * Einstellungen. Fürs Erste nur die Vereinsdaten (Name, Anschrift, Vorstand, Gläubiger-ID, Vereinskonto);
 * sie stehen im selben Dokument wie am Desktop und gehen mit der Sicherung mit.
 */
@Composable
fun EinstellungenScreen(model: AppModel, modifier: Modifier = Modifier) {
    var f by remember(model.vereinsdaten) { mutableStateOf(model.vereinsdaten) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val fehler = Vereinsdaten.pruefen(f)
    fun fehlerFuer(k: String) = if (zeigeFehler) fehler[k] else null
    val geaendert = f != model.vereinsdaten

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Verein", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Feld("Vereinsname *", f.name, { f = f.copy(name = it) }, error = fehlerFuer("name"))
                Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
                Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
                Feld("PLZ", f.plz, { f = f.copy(plz = it) })
                Feld("Ort", f.ort, { f = f.copy(ort = it) })
                Feld("Vorsitzende/r", f.vorsitzender, { f = f.copy(vorsitzender = it) })
                Feld("Kassenwart / Schatzmeister", f.kassenwart, { f = f.copy(kassenwart = it) }, hinweis = "Steht im Prüfprotokoll beim Lastschrifteinzug")
            }
        }
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
                if (fehler.isNotEmpty()) { zeigeFehler = true; meldung = null }
                else model.vereinSpeichern(f) { e -> meldung = e ?: "Gespeichert." }
            },
            enabled = !model.busy && geaendert, modifier = Modifier.fillMaxWidth(),
        ) { Text("Speichern") }
    }
}
