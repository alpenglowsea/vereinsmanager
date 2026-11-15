package de.vereinsmanager.android.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.lazy.LazyListState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
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
import androidx.compose.ui.unit.Velocity
import kotlin.math.roundToInt

/**
 * Der Kopf über einer Liste schrumpft und verblasst im Takt des Scrollens (langsam beim Hinunterscrollen).
 * Beim Hinaufscrollen entscheidet die Geschwindigkeit: Wer langsam nach oben scrollt, will die Liste durchsehen –
 * der Kopf bleibt eingeklappt. Wer deutlich schneller nach oben wischt, bekommt den Kopf zurück (mit doppelter Geschwindigkeit).
 * Ist das Listenanfang erreicht, kommt der Kopf immer zurück. Die Schwelle steht in [SCHNELL_DP_PRO_SEKUNDE].
 * Das Verhalten ist für alle Listen mit einklappbarem Kopf (Mitglieder, Buchungen) dasselbe.
 */
@Stable
class KopfZustand(private val liste: LazyListState, private val dichte: Float = 1f, private val scope: CoroutineScope? = null) {
    internal val hoehe = IntArray(1)

    /** 0 = ganz sichtbar, -Höhe = ganz eingeklappt */
    internal var versatz by mutableFloatStateOf(0f)

    private var letzteZeit = 0L
    private var tempo = 0f           // geglättete Geschwindigkeit nach oben in Pixel pro Sekunde (nur bei Wischen mit dem Finger)
    private var schnellerWurf = false // ob der laufende Auslauf (Fling) mit hoher Anfangsgeschwindigkeit begann

    private var anim: Job? = null

    /** Klappt den Kopf weich auf (Einschieben und Einblenden über knapp eine halbe Sekunde) statt ihn springen zu lassen. */
    private fun ausklappenWeich() {
        if (anim?.isActive == true) return
        val sc = scope
        if (sc == null) { versatz = 0f; return }
        anim = sc.launch { animate(versatz, 0f, animationSpec = tween(420, easing = FastOutSlowInEasing)) { v, _ -> versatz = v } }
    }

    private val schwelle get() = SCHNELL_DP_PRO_SEKUNDE * dichte

    val verfolgung: NestedScrollConnection = object : NestedScrollConnection {
        override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
            val dy = available.y
            if (dy < 0f) {
                anim?.cancel()
                tempo = 0f; letzteZeit = 0L
                if (versatz <= -hoehe[0]) return Offset.Zero
                if (versatz == 0f && !liste.canScrollForward) return Offset.Zero
                val neu = (versatz + dy).coerceAtLeast(-hoehe[0].toFloat())
                val verbraucht = neu - versatz
                versatz = neu
                return Offset(0f, verbraucht)
            } else if (dy > 0f) {
                if (versatz >= 0f) return Offset.Zero
                val jetzt = System.nanoTime()
                if (source == NestedScrollSource.UserInput) {
                    if (letzteZeit != 0L) {
                        val dt = (jetzt - letzteZeit) / 1_000_000_000f
                        if (dt > 0.0005f) tempo = 0.6f * tempo + 0.4f * (dy / dt)
                    }
                    letzteZeit = jetzt
                }
                val schnell = if (source == NestedScrollSource.UserInput) tempo > schwelle else schnellerWurf
                if (anim?.isActive == true) return Offset.Zero
                if (schnell) { ausklappenWeich(); return Offset.Zero }
                if (liste.canScrollBackward) return Offset.Zero // langsam: Kopf bleibt eingeklappt, die Liste scrollt
                val neu = (versatz + dy * 2f).coerceAtMost(0f)
                val verbraucht = (neu - versatz) / 2f
                versatz = neu
                return Offset(0f, verbraucht)
            }
            return Offset.Zero
        }

        override suspend fun onPreFling(available: Velocity): Velocity {
            schnellerWurf = available.y > schwelle * 1.5f
            tempo = 0f; letzteZeit = 0L
            return Velocity.Zero
        }
    }

    companion object {
        /** Ab dieser Geschwindigkeit nach oben (dp pro Sekunde) gilt ein Wischen als „deutlich schneller“ und holt den Kopf zurück. */
        const val SCHNELL_DP_PRO_SEKUNDE = 900f
    }
}

@Composable
fun rememberKopfZustand(liste: LazyListState): KopfZustand {
    val dichte = androidx.compose.ui.platform.LocalDensity.current.density
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    return remember(liste) { KopfZustand(liste, dichte, scope) }
}

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
