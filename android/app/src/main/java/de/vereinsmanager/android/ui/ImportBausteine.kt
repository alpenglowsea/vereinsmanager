package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** Gemeinsame Bausteine der drei Import-Seiten (Mitglieder, Buchungen, Kontakte): gleicher Aufbau wie die Formulare. */

/** Überschrift und Fortschrittsbalken; zurück springen darf man, vor nicht. */
@Composable
internal fun ImportKopf(titel: String, schritt: Int, onSchritt: (Int) -> Unit) {
    FormKopf(titel, listOf("Datei", "Spalten", "Vorschau"), schritt, null) { if (it < schritt) onSchritt(it) }
}

/** Titel einer Karte: grün und fett wie in den Einstellungen. */
@Composable
internal fun KartenTitel(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 6.dp))
}

/** Drei (oder zwei) gleich hohe Kennzahlen-Kacheln: (Titel, Wert, Farbe 0 grün, 1 blau, 2 gelb, 3 rot). */
@Composable
internal fun ImportKacheln(werte: List<Triple<String, String, Int>>) {
    val sc = MaterialTheme.colorScheme
    BoxWithConstraints(Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
        val gew = werte.map { 1f }
        val g = kachelSchrift(maxWidth, gew, werte.map { it.second.length }, 30f)
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            werte.forEach { (titel, zahl, farbe) ->
                val (f, t) = when (farbe) {
                    0 -> sc.primaryContainer to sc.onPrimaryContainer
                    1 -> sc.secondaryContainer to sc.onSecondaryContainer
                    2 -> sc.tertiaryContainer to sc.onTertiaryContainer
                    else -> sc.errorContainer to sc.onErrorContainer
                }
                StatKachel(titel, zahl, null, f, t, Modifier.weight(1f).fillMaxHeight(), g)
            }
        }
    }
}

/** Zwei gleich große Knöpfe nebeneinander: links Zurück, rechts die Hauptaktion. */
@Composable
internal fun ZweiKnoepfe(links: String, onLinks: () -> Unit, rechts: String, onRechts: () -> Unit, rechtsAktiv: Boolean = true, linksAktiv: Boolean = true, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onLinks, enabled = linksAktiv, modifier = Modifier.weight(1f).height(52.dp)) { Text(links, maxLines = 1) }
        Button(onClick = onRechts, enabled = rechtsAktiv, modifier = Modifier.weight(1f).height(52.dp)) { Text(rechts, maxLines = 1) }
    }
}

/**
 * Die feste Knopfleiste unter der Vorschau-Liste. Solange die Tastatur offen ist, verschwindet sie,
 * damit die Liste nicht auf einen schmalen Streifen zusammenschrumpft.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ImportLeiste(fehler: String, inhalt: @Composable () -> Unit) {
    if (WindowInsets.isImeVisible) return
    Column(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 10.dp)) {
        if (fehler.isNotEmpty()) Text(fehler, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 4.dp))
        inhalt()
    }
}

/** Das Ergebnis nach dem Import. */
@Composable
internal fun ImportErgebnis(text: String, onDone: () -> Unit) {
    FormKarte {
        KartenTitel("Fertig")
        Text(text, style = MaterialTheme.typography.bodyLarge)
        Button(onClick = onDone, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(52.dp)) { Text("Zurück zur Übersicht") }
    }
}
