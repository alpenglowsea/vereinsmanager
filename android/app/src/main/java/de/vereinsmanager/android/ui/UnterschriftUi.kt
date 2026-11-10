package de.vereinsmanager.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import de.vereinsmanager.core.donation.Unterschrift

/** Zeigt eine gespeicherte Unterschrift (schwarz auf weiß, wie sie ins PDF kommt). */
@Composable
fun UnterschriftVorschau(u: Unterschrift, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxWidth().height(80.dp).background(Color.White).border(1.dp, MaterialTheme.colorScheme.outline)) {
        val hoehe = minOf(size.height, size.width / u.seitenverhaeltnis.toFloat())
        val breite = hoehe * u.seitenverhaeltnis.toFloat()
        val x0 = (size.width - breite) / 2f
        val y0 = (size.height - hoehe) / 2f
        for (st in u.striche) {
            val weg = Path()
            st.forEachIndexed { i, (x, y) ->
                val px = x0 + x.toFloat() * breite
                val py = y0 + y.toFloat() * hoehe
                if (i == 0) weg.moveTo(px, py) else weg.lineTo(px, py)
            }
            drawPath(weg, Color.Black, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/** Fläche zum Unterschreiben mit dem Finger. [onFertig] bekommt die Unterschrift mit Punkten bezogen auf die Fläche. */
@Composable
fun UnterschriftDialog(onDismiss: () -> Unit, onFertig: (Unterschrift) -> Unit) {
    var striche by remember { mutableStateOf(listOf<List<Offset>>()) }
    var groesse by remember { mutableStateOf(IntSize.Zero) }
    Aktionsdialog(
        titel = "Unterschrift", onDismiss = onDismiss,
        inhalt = {
            Text("Bitte mit dem Finger in das weiße Feld unterschreiben.", style = MaterialTheme.typography.bodyMedium)
            Box(
                Modifier.padding(top = 12.dp).fillMaxWidth().height(160.dp).background(Color.White).border(1.dp, MaterialTheme.colorScheme.outline)
                    .onSizeChanged { groesse = it }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { p -> striche = striche + listOf(listOf(p)) },
                            onDrag = { change, _ ->
                                change.consume()
                                val letzter = striche.lastOrNull()
                                if (letzter != null) striche = striche.dropLast(1) + listOf(letzter + change.position)
                            },
                        )
                    },
            ) {
                Canvas(Modifier.matchParentSize()) {
                    for (st in striche) {
                        val weg = Path()
                        st.forEachIndexed { i, p -> if (i == 0) weg.moveTo(p.x, p.y) else weg.lineTo(p.x, p.y) }
                        drawPath(weg, Color.Black, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                    }
                }
            }
        },
        aktionen = {
            val brauchbar = striche.any { it.size >= 2 } && groesse.width > 0 && groesse.height > 0
            Button(
                onClick = {
                    val b = groesse.width.toDouble()
                    val h = groesse.height.toDouble()
                    onFertig(
                        Unterschrift(
                            b / h,
                            striche.filter { it.size >= 2 }.map { st -> st.map { (it.x / b).coerceIn(0.0, 1.0) to (it.y / h).coerceIn(0.0, 1.0) } },
                        ),
                    )
                },
                enabled = brauchbar, modifier = Modifier.fillMaxWidth(),
            ) { Text("Übernehmen") }
            OutlinedButton(onClick = { striche = emptyList() }, modifier = Modifier.fillMaxWidth(), enabled = striche.isNotEmpty()) { Text("Neu beginnen") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}
