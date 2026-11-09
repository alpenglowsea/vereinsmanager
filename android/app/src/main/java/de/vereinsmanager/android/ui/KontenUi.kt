package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.finance.KontoForm
import de.vereinsmanager.core.finance.KontoStore
import de.vereinsmanager.core.members.Iban

/** Konten und Kassen: anlegen, bearbeiten, in der Reihenfolge verschieben, löschen. Die Regeln stecken im Kern ([KontoStore]). */
@Composable
fun KontenScreen(model: AppModel, modifier: Modifier = Modifier) {
    var form by remember { mutableStateOf<KontoForm?>(null) }
    var neu by remember { mutableStateOf(false) }
    var loeschen by remember { mutableStateOf<Konto?>(null) }
    var meldung by remember { mutableStateOf<String?>(null) }

    val konten = model.konten
    val staende = remember(konten, model.buchungen) { Finance.kontostaende(konten, model.buchungen) }

    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Button(onClick = { neu = true; form = KontoForm(KontoStore.neueId()) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) {
                Text("Neues Konto / Kasse")
            }
        }
        item { Text("${konten.size} Konten & Kassen", style = MaterialTheme.typography.bodySmall) }
        itemsIndexed(konten, key = { _, k -> k.id }) { i, k ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.size(14.dp).clip(CircleShape).background(kontoFarbe(k.farbe)))
                        Column(Modifier.weight(1f)) {
                            Text(k.name, fontWeight = FontWeight.SemiBold)
                            Text(k.artText, style = MaterialTheme.typography.bodySmall)
                            if (k.iban.isNotEmpty()) Text("IBAN: ${Iban.gruppiert(k.iban)}", style = MaterialTheme.typography.bodySmall)
                            if (k.beschreibung.isNotEmpty()) Text(k.beschreibung, style = MaterialTheme.typography.bodySmall)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Stand", style = MaterialTheme.typography.labelSmall)
                            Text(Geld.euro(staende[k.id] ?: k.anfangsbestand), fontWeight = FontWeight.Bold)
                            Text("Start: ${Geld.euro(k.anfangsbestand)}", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedButton(onClick = { model.kontoSchieben(k.id, -1) }, enabled = i > 0 && !model.busy, contentPadding = PaddingValues(horizontal = 14.dp)) { Text("↑") }
                        OutlinedButton(onClick = { model.kontoSchieben(k.id, 1) }, enabled = i < konten.lastIndex && !model.busy, contentPadding = PaddingValues(horizontal = 14.dp)) { Text("↓") }
                        OutlinedButton(onClick = { neu = false; form = KontoForm.von(k) }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Bearbeiten") }
                        OutlinedButton(onClick = { loeschen = k }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Löschen") }
                    }
                }
            }
        }
    }

    val f = form
    if (f != null) KontoDialog(model, f, neu, onDismiss = { form = null })

    val k = loeschen
    if (k != null) {
        KontoLoeschenDialog(model, k, onDismiss = { loeschen = null }, onErgebnis = { text -> loeschen = null; meldung = text })
    }

    val m = meldung
    if (m != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text(if (m == "Konto gelöscht.") "Fertig" else "Hinweis") },
            text = { Text(m) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}

@Composable
private fun KontoDialog(model: AppModel, start: KontoForm, neu: Boolean, onDismiss: () -> Unit) {
    var f by remember(start.id) { mutableStateOf(start) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var speicherFehler by remember { mutableStateOf<String?>(null) }
    val fehler = KontoStore.pruefen(f)
    fun fehlerFuer(k: String) = if (zeigeFehler) fehler[k] else null

    Aktionsdialog(
        titel = if (neu) "Neues Konto / Kasse" else "Konto bearbeiten",
        onDismiss = onDismiss,
        inhalt = {
            Feld("Bezeichnung *", f.name, { f = f.copy(name = it) }, error = fehlerFuer("name"))
            Auswahl("Kontoart", FinanceLabels.ACCOUNT_TYPE, f.art) { f = f.copy(art = it) }
            if (f.art == "bank") {
                Feld("IBAN", f.iban, { f = f.copy(iban = it) }, error = fehlerFuer("iban"), hinweis = if (zeigeFehler) null else "z. B. DE89 3704 0044 0532 0130 00")
                Feld("BIC (freiwillig)", f.bic, { f = f.copy(bic = it) }, error = fehlerFuer("bic"))
            }
            Feld(
                "Anfangsbestand in €", f.anfangsbestand, { f = f.copy(anfangsbestand = it) }, error = fehlerFuer("anfangsbestand"),
                hinweis = if (zeigeFehler && fehler["anfangsbestand"] != null) null else "Startguthaben; ein Minus ist möglich",
            )
            Text("Farbe", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KontoStore.FARBEN.forEach { c ->
                    Box(
                        Modifier.size(36.dp).clip(CircleShape).background(kontoFarbe(c))
                            .border(if (c == f.farbe) 3.dp else 0.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                            .clickable { f = f.copy(farbe = c) },
                    )
                }
            }
            Feld("Beschreibung (freiwillig)", f.beschreibung, { f = f.copy(beschreibung = it) })
            if (speicherFehler != null) Text(speicherFehler!!, color = MaterialTheme.colorScheme.error)
        },
        aktionen = {
            Button(
                onClick = {
                    if (fehler.isNotEmpty()) {
                        zeigeFehler = true
                    } else {
                        model.kontoSpeichern(f) { e -> if (e == null) onDismiss() else speicherFehler = e }
                    }
                },
                enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
            ) { Text("Speichern") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

@Composable
private fun KontoLoeschenDialog(model: AppModel, k: Konto, onDismiss: () -> Unit, onErgebnis: (String) -> Unit) {
    val andere = model.konten.filter { it.id != k.id }
    val anzahl = remember(k.id, model.buchungen) { KontoStore.buchungenAm(model.store, k.id) }
    var ziel by remember { mutableStateOf("") }

    fun loeschen() = model.kontoLoeschen(k.id, ziel.ifEmpty { null }) { e -> onErgebnis(e ?: "Konto gelöscht.") }

    Aktionsdialog(
        titel = "Konto „${k.name}“ löschen?",
        onDismiss = onDismiss,
        inhalt = {
            when {
                andere.isEmpty() -> Text("Es muss mindestens ein Konto bleiben. Dieses Konto lässt sich nicht löschen.")
                anzahl == 0 -> Text("Das Konto hat keine Buchungen. Sein Anfangsbestand (${Geld.euro(k.anfangsbestand)}) fällt damit weg.")
                else -> {
                    Text(
                        "An diesem Konto hängen $anzahl Buchungen. Sie werden auf das gewählte Konto übertragen, dessen Kontostand ändert sich dadurch. " +
                            "Der Anfangsbestand dieses Kontos (${Geld.euro(k.anfangsbestand)}) fällt weg.",
                    )
                    Auswahl("Buchungen übertragen auf", linkedMapOf("" to "– bitte wählen –").also { m -> andere.forEach { m[it.id] = it.name } }, ziel) { ziel = it }
                }
            }
            Text("Andere Verweise auf das Konto (SEPA-Läufe, Einstellungen) prüft die App noch nicht.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        },
        aktionen = {
            if (andere.isNotEmpty()) {
                Button(onClick = { loeschen() }, enabled = !model.busy && (anzahl == 0 || ziel.isNotEmpty()), modifier = Modifier.fillMaxWidth()) {
                    Text(if (anzahl == 0) "Löschen" else "Übertragen und löschen")
                }
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text(if (andere.isEmpty()) "OK" else "Abbrechen") }
        },
    )
}
