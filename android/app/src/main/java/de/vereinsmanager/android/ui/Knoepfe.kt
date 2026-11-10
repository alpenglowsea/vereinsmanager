package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Der einheitliche Knopf für Werkzeugleisten und Reihen: immer 36 dp hoch, gleiche Form und gleicher Innenabstand, Beschriftung einzeilig.
 * [primaer]: gefüllt (die Hauptaktion der Leiste), sonst mit Rand.
 */
@Composable
internal fun KompaktKnopf(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, primaer: Boolean = false) {
    val rand = PaddingValues(horizontal = 12.dp, vertical = 0.dp)
    val inhalt: @Composable RowScope.() -> Unit = { Text(text, maxLines = 1, softWrap = false, style = MaterialTheme.typography.labelLarge) }
    if (primaer) Button(onClick = onClick, modifier = modifier.height(36.dp), enabled = enabled, contentPadding = rand, content = inhalt)
    else OutlinedButton(onClick = onClick, modifier = modifier.height(36.dp), enabled = enabled, contentPadding = rand, content = inhalt)
}

/** Eine Aktion der [Aktionsleiste]. */
internal class Aktion(val text: String, val onClick: () -> Unit, val primaer: Boolean = false, val enabled: Boolean = true)

/**
 * Die Knöpfe unter einer Detailansicht: immer zwei gleich breite je Zeile, Beschriftung darf auf zwei Zeilen umbrechen.
 * So bricht kein Wort mitten im Wort um und alle Detailansichten sehen gleich aus.
 */
@Composable
internal fun Aktionsleiste(aktionen: List<Aktion>, modifier: Modifier = Modifier) = AktionsZeilen(aktionen.chunked(2), modifier)

/** Wie [Aktionsleiste], aber mit festgelegten Zeilen (höchstens zwei Knöpfe je Zeile); leere Zeilen entfallen. */
@Composable
internal fun AktionsZeilen(zeilen: List<List<Aktion>>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        zeilen.filter { it.isNotEmpty() }.forEach { paar ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                paar.forEach { a ->
                    val m = Modifier.weight(1f).heightIn(min = 44.dp)
                    val inhalt: @Composable RowScope.() -> Unit = { Text(a.text, textAlign = TextAlign.Center, maxLines = 2) }
                    if (a.primaer) Button(onClick = a.onClick, modifier = m, enabled = a.enabled, content = inhalt)
                    else OutlinedButton(onClick = a.onClick, modifier = m, enabled = a.enabled, content = inhalt)
                }
                if (paar.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
