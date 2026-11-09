package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Schmaler Knopf für Reihen mit mehreren Knöpfen: wenig Innenabstand, Beschriftung immer einzeilig.
 * Der Standardknopf lässt 24 dp Rand links und rechts, dadurch brachen Wörter wie „Bearbeiten“ mitten im Wort um.
 */
@Composable
internal fun KompaktKnopf(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(onClick = onClick, modifier = modifier, enabled = enabled, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp)) {
        Text(text, maxLines = 1, softWrap = false, style = MaterialTheme.typography.labelLarge)
    }
}
