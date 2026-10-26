package de.vereinsmanager.android.ui

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import kotlin.math.roundToInt

/**
 * Der Kopf über einer Liste schrumpft und verblasst im Takt des Scrollens (langsam beim Hinunterscrollen)
 * und kommt beim Hinaufscrollen mit doppelter Geschwindigkeit wieder. Gleiches Verhalten wie in der
 * Mitgliederliste; dort steht der Code noch einmal für sich.
 */
@Stable
class KopfZustand(private val liste: LazyListState) {
    internal val hoehe = IntArray(1)

    /** 0 = ganz sichtbar, -Höhe = ganz eingeklappt */
    internal var versatz by mutableFloatStateOf(0f)

    val verfolgung: NestedScrollConnection = object : NestedScrollConnection {
        override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
            val dy = available.y
            if (dy < 0f) {
                if (versatz <= -hoehe[0]) return Offset.Zero
                if (versatz == 0f && !liste.canScrollForward) return Offset.Zero
                val neu = (versatz + dy).coerceAtLeast(-hoehe[0].toFloat())
                val verbraucht = neu - versatz
                versatz = neu
                return Offset(0f, verbraucht)
            } else if (dy > 0f) {
                if (versatz >= 0f) return Offset.Zero
                val neu = (versatz + dy * 2f).coerceAtMost(0f)
                val verbraucht = (neu - versatz) / 2f
                versatz = neu
                return Offset(0f, verbraucht)
            }
            return Offset.Zero
        }
    }
}

@Composable
fun rememberKopfZustand(liste: LazyListState): KopfZustand = remember(liste) { KopfZustand(liste) }

fun Modifier.einklappbar(z: KopfZustand): Modifier = this
    .clipToBounds()
    .layout { measurable, constraints ->
        val p = measurable.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
        z.hoehe[0] = p.height
        val sichtbar = (p.height + z.versatz).roundToInt().coerceIn(0, p.height)
        layout(p.width, sichtbar) { p.placeRelative(0, z.versatz.roundToInt().coerceIn(-p.height, 0)) }
    }
    .graphicsLayer {
        val h = z.hoehe[0].coerceAtLeast(1)
        alpha = (1f + 1.5f * z.versatz / h).coerceIn(0f, 1f)
    }
