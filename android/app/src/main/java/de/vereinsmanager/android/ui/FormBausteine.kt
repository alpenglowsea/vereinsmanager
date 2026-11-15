package de.vereinsmanager.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Bausteine der mehrstufigen Formulare (Buchung, Rechnung, Spende) – derselbe Aufbau wie beim Mitgliedsformular:
 * Überschrift, antippbarer Fortschrittsbalken, Karte mit den Feldern, Zurück/Weiter, Abbrechen/Speichern am Seitenende.
 */

/** Überschrift und Fortschrittsbalken. Rot = in diesem Schritt fehlt etwas ([fehlerSchritt]). */
@Composable
internal fun FormKopf(titel: String, schritte: List<String>, schritt: Int, fehlerSchritt: Int?, onSchritt: (Int) -> Unit) {
    val sc = MaterialTheme.colorScheme
    Text(titel, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp, bottom = 8.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        schritte.forEachIndexed { i, _ ->
            val farbe = when {
                i == fehlerSchritt -> sc.error
                i < schritt -> sc.primary
                i == schritt -> sc.tertiaryContainer
                else -> sc.outlineVariant
            }
            Box(Modifier.weight(1f).height(28.dp).clickable { onSchritt(i) }, contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(farbe))
            }
        }
    }
    val mitFehler = fehlerSchritt != null && fehlerSchritt != schritt
    Text(
        "Schritt ${schritt + 1} von ${schritte.size} · ${schritte[schritt]}" + if (mitFehler) " · Angaben fehlen bei „${schritte[fehlerSchritt!!]}“" else "",
        style = MaterialTheme.typography.titleSmall, color = if (mitFehler) sc.error else sc.onSurfaceVariant,
        modifier = Modifier.padding(top = 2.dp, bottom = 6.dp),
    )
}

/** Die weiche, umrandete Karte um die Felder eines Schritts. */
@Composable
internal fun FormKarte(inhalt: @Composable ColumnScope.() -> Unit) {
    val sc = MaterialTheme.colorScheme
    Surface(shape = RoundedCornerShape(28.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Column(Modifier.padding(16.dp), content = inhalt)
    }
}

/** Zurück/Weiter und darunter Abbrechen/Speichern. */
@Composable
internal fun FormFuss(schritt: Int, anzahl: Int, onSchritt: (Int) -> Unit, onAbbrechen: () -> Unit, onSpeichern: () -> Unit, enabled: Boolean) {
    Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { onSchritt(schritt - 1) }, enabled = schritt > 0, modifier = Modifier.weight(1f).height(48.dp)) { Text("Zurück") }
        OutlinedButton(onClick = { onSchritt(schritt + 1) }, enabled = schritt < anzahl - 1, modifier = Modifier.weight(1f).height(48.dp)) { Text("Weiter") }
    }
    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onAbbrechen, modifier = Modifier.weight(1f).height(52.dp)) { Text("Abbrechen") }
        Button(onClick = onSpeichern, enabled = enabled, modifier = Modifier.weight(1f).height(52.dp)) { Text("Speichern") }
    }
}
