package de.vereinsmanager.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Gemeinsame Bausteine der Listen- und Detailseiten (Rechnungen, Spenden …) im Wiese-Stil. */

/** Rundes Suchfeld, wie in Mitglieder- und Buchungsliste. */
@Composable
internal fun SuchFeld(wert: String, onChange: (String) -> Unit, platzhalter: String, modifier: Modifier = Modifier) {
    val sc = MaterialTheme.colorScheme
    TextField(
        wert, onChange, placeholder = { Text(platzhalter) }, singleLine = true, shape = RoundedCornerShape(28.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = sc.surfaceContainer, unfocusedContainerColor = sc.surfaceContainer,
            focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
        ),
        modifier = modifier.fillMaxWidth(),
    )
}

/** Beschriftung (grau) über dem Wert; leere Werte entfallen. Ein leeres [label] zeigt nur den Wert. */
@Composable
internal fun DetailFeld(label: String, wert: String) {
    if (wert.isBlank()) return
    Column(Modifier.padding(vertical = 4.dp)) {
        if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(wert, style = MaterialTheme.typography.bodyLarge)
    }
}

/**
 * Gemeinsame Schriftgröße für eine Reihe Kacheln unterschiedlicher Breite ([gewichte]): so groß, wie der längste Wert
 * (Zeichenzahl je Kachel in [laengen]) noch in seine Kachel passt, höchstens [hoechstens] sp.
 */
internal fun kachelSchrift(breite: Dp, gewichte: List<Float>, laengen: List<Int>, hoechstens: Float): TextUnit {
    val summe = gewichte.sum()
    val kleinste = gewichte.indices.minOf { i ->
        val innen = (breite - 8.dp * (gewichte.size - 1)) * (gewichte[i] / summe) - 20.dp
        innen.value / (maxOf(laengen[i], 3) * 0.62f)
    }
    return kleinste.coerceIn(12f, hoechstens).sp
}

/** „15.03.2026“ → („15.03.“, „2026“); ohne Datum („–“, null). */
internal fun datumTagJahr(iso: String): Pair<String, String?> {
    val d = if (iso.isNotEmpty()) deDate(iso) else ""
    return if (d.length >= 10) d.take(6) to d.takeLast(4) else d.ifEmpty { "–" } to null
}

/** Eine Zeile der Karten-Liste: dicht gestapelt, nur die erste und die letzte Karte haben große Rundungen. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ListenKarte(erste: Boolean, letzte: Boolean, angehakt: Boolean, onClick: () -> Unit, onLongClick: () -> Unit, inhalt: @Composable RowScope.() -> Unit) {
    val s = MaterialTheme.colorScheme
    val form = RoundedCornerShape(topStart = if (erste) 28.dp else 10.dp, topEnd = if (erste) 28.dp else 10.dp, bottomStart = if (letzte) 28.dp else 10.dp, bottomEnd = if (letzte) 28.dp else 10.dp)
    Surface(
        shape = form, color = if (angehakt) s.primaryContainer.copy(alpha = 0.45f) else s.surface,
        border = BorderStroke(1.5.dp, if (angehakt) s.primary else s.outlineVariant),
        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp).clip(form).combinedClickable(onClick = onClick, onLongClick = onLongClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, content = inhalt)
    }
}

/** Auswahlfenster für den Export: je Eintrag ein Knopf. */
@Composable
internal fun ExportAuswahl(text: String, punkte: List<Pair<String, () -> Unit>>, onDismiss: () -> Unit) {
    Aktionsdialog(
        titel = "Exportieren", onDismiss = onDismiss,
        inhalt = { Text(text) },
        aktionen = {
            punkte.forEach { (t, a) -> OutlinedButton(onClick = { onDismiss(); a() }, modifier = Modifier.fillMaxWidth()) { Text(t) } }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}
