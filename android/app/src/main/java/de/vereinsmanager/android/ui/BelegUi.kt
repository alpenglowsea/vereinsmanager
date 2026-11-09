package de.vereinsmanager.android.ui

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.BildZuPdf
import de.vereinsmanager.android.SeitenEdit
import de.vereinsmanager.core.finance.Buchung
import java.io.File
import java.io.FileInputStream
import java.util.Locale
import kotlin.concurrent.thread

private fun groesse(bytes: Long): String = when {
    bytes >= 1024 * 1024 -> String.format(Locale.GERMANY, "%.1f MB", bytes / 1024.0 / 1024.0)
    bytes >= 1024 -> "${bytes / 1024} KB"
    else -> "$bytes Byte"
}

/** Der Beleg einer Buchung: anhängen (Datei oder Foto), anzeigen, ersetzen, entfernen. */
@Composable
fun BelegAbschnitt(model: AppModel, buchung: Buchung, onAnzeigen: () -> Unit) {
    var wahl by remember { mutableStateOf(false) }
    var entfernen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }

    fun ergebnis(r: de.vereinsmanager.core.finance.BelegErgebnis?, fehler: String?) {
        meldung = if (fehler != null) "Der Beleg konnte nicht angehängt werden: $fehler"
        else "Beleg angehängt.\nDatei: ${r!!.dateiName}\nOrdner im Dokumentenarchiv: Buchhaltungsbelege & Finanzen / ${r.ordnerName}"
    }

    val dateiLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.belegAusDatei(buchung.id, uri, ::ergebnis)
    }
    val kamera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> model.fotoAufgenommen(ok) }
    fun fotoMachen() {
        try {
            kamera.launch(model.neuesFotoZiel(buchung.id))
        } catch (e: Exception) {
            meldung = "Die Kamera lässt sich nicht starten: ${e.message ?: "keine Kamera-App gefunden"}"
        }
    }

    Column(Modifier.padding(top = 12.dp)) {
        Text("Beleg", style = MaterialTheme.typography.labelMedium)
        val beleg = buchung.beleg
        if (beleg != null) {
            Text("${beleg.name} (${groesse(beleg.groesse)})")
            Button(onClick = onAnzeigen, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("Anzeigen") }
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { wahl = true }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Ersetzen") }
                OutlinedButton(onClick = { entfernen = true }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Entfernen") }
            }
        } else if (!buchung.istUmbuchung) {
            Text("Kein Beleg angehängt.")
            Button(onClick = { wahl = true }, enabled = !model.busy, modifier = Modifier.padding(top = 8.dp)) { Text("Beleg anhängen") }
        }
    }

    if (wahl) {
        Aktionsdialog(
            titel = if (buchung.beleg != null) "Beleg ersetzen" else "Beleg anhängen",
            onDismiss = { wahl = false },
            inhalt = {
                Text("Eine PDF wird unverändert übernommen. Fotos und Bilder werden verkleinert und zu einer PDF gemacht.")
                if (buchung.beleg != null) Text("Der bisherige Beleg wird dabei ersetzt.", Modifier.padding(top = 8.dp))
            },
            aktionen = {
                Button(onClick = { wahl = false; model.fotosVerwerfen(); fotoMachen() }, modifier = Modifier.fillMaxWidth()) { Text("Foto aufnehmen") }
                OutlinedButton(
                    onClick = { wahl = false; dateiLauncher.launch(arrayOf("application/pdf", "image/*")) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Datei wählen (PDF oder Bild)") }
                TextButton(onClick = { wahl = false }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
            },
        )
    }

    // Solange aufgenommene Seiten da sind, bleibt dieses Fenster stehen (auch wenn die Kamera die App im Hintergrund lässt).
    val fotosHier = model.fotoSeiten.isNotEmpty() && model.fotoBuchungId == buchung.id && !model.busy
    if (fotosHier) {
        Aktionsdialog(
            titel = "Beleg fotografiert",
            onDismiss = null,
            inhalt = {
                model.fotoSeiten.forEachIndexed { i, s ->
                    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text(
                            "Seite ${i + 1}" + if (s.edit.istUnveraendert) "" else " (bearbeitet)",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { model.fotoBearbeiten = i }, modifier = Modifier.weight(1f)) { Text("Zuschneiden / Drehen") }
                            OutlinedButton(onClick = { model.fotoEntfernen(i) }) { Text("Entfernen") }
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = model.fotoGrau, onCheckedChange = { model.fotoGrau = it })
                    Text("Graustufen (kleinere Datei)")
                }
            },
            aktionen = {
                Button(onClick = { model.belegAusFotos(buchung.id, ::ergebnis) }, modifier = Modifier.fillMaxWidth()) { Text("Fertig – als PDF speichern") }
                OutlinedButton(onClick = { fotoMachen() }, modifier = Modifier.fillMaxWidth()) { Text("Weitere Seite aufnehmen") }
                TextButton(onClick = { model.fotosVerwerfen() }, modifier = Modifier.fillMaxWidth()) { Text("Alles verwerfen") }
            },
        )
        val nr = model.fotoBearbeiten
        val entwurf = if (nr != null) model.fotoSeiten.getOrNull(nr) else null
        if (nr != null && entwurf != null) {
            SeitenEditor(
                entwurf,
                onFertig = { model.fotoBearbeiten = null },
                onVerwerfen = { model.fotoEntfernen(nr) },
            )
        }
    }

    if (entfernen) {
        AlertDialog(
            onDismissRequest = { entfernen = false },
            title = { Text("Beleg entfernen?") },
            text = { Text("Der Beleg wird von der Buchung und aus dem Dokumentenarchiv entfernt. Die Buchung bleibt bestehen.") },
            confirmButton = {
                TextButton(onClick = {
                    entfernen = false
                    model.belegEntfernen(buchung.id) { f -> meldung = if (f == null) "Beleg entfernt." else "Entfernen fehlgeschlagen: $f" }
                }) { Text("Entfernen") }
            },
            dismissButton = { TextButton(onClick = { entfernen = false }) { Text("Abbrechen") } },
        )
    }

    val m = meldung
    if (m != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text(if (m.startsWith("Beleg angehängt") || m == "Beleg entfernt.") "Fertig" else "Fehler") },
            text = { Text(m) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}

/**
 * Ein Fenster mit Titel, Inhalt und Knöpfen, die untereinander in voller Breite stehen. Der Standard-Dialog legt mehrere
 * Knöpfe in seiner Knopfleiste übereinander; hier bestimmen wir den Aufbau selbst. [onDismiss] null: nur über die Knöpfe schließbar.
 */
@Composable
private fun Aktionsdialog(
    titel: String,
    onDismiss: (() -> Unit)?,
    inhalt: @Composable ColumnScope.() -> Unit,
    aktionen: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = { onDismiss?.invoke() },
        properties = DialogProperties(dismissOnBackPress = onDismiss != null, dismissOnClickOutside = onDismiss != null),
    ) {
        Surface(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.extraLarge, tonalElevation = 6.dp) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp)) {
                Text(titel, style = MaterialTheme.typography.headlineSmall)
                Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), content = inhalt)
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp), content = aktionen)
            }
        }
    }
}

// ---------------------------------------------------------------- Anzeige

private interface Seitenquelle {
    val anzahl: Int

    /** Zeichnet Seite [index] mit der Breite [breitePx]; null, wenn schon geschlossen. */
    fun zeichnen(index: Int, breitePx: Int): Bitmap?
    fun schliessen()
}

private class PdfQuelle(datei: File) : Seitenquelle {
    private val pfd = ParcelFileDescriptor.open(datei, ParcelFileDescriptor.MODE_READ_ONLY)
    private val renderer = try { PdfRenderer(pfd) } catch (e: Exception) { pfd.close(); throw e }
    private var zu = false
    override val anzahl: Int = renderer.pageCount

    override fun zeichnen(index: Int, breitePx: Int): Bitmap? = synchronized(this) {
        if (zu) return null
        val seite = renderer.openPage(index)
        try {
            val h = (breitePx.toLong() * seite.height / seite.width).toInt().coerceAtLeast(1)
            val bild = Bitmap.createBitmap(breitePx, h, Bitmap.Config.ARGB_8888)
            bild.eraseColor(android.graphics.Color.WHITE)
            seite.render(bild, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            bild
        } finally {
            seite.close()
        }
    }

    override fun schliessen() {
        synchronized(this) {
            if (!zu) {
                zu = true
                renderer.close()
                pfd.close()
            }
        }
    }
}

private class BildQuelle(private val datei: File) : Seitenquelle {
    override val anzahl = 1
    override fun zeichnen(index: Int, breitePx: Int): Bitmap? {
        val rand = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(datei.path, rand)
        if (rand.outWidth <= 0) return null
        var teiler = 1
        while (rand.outWidth / (teiler * 2) >= breitePx) teiler *= 2
        val roh = BitmapFactory.decodeFile(datei.path, BitmapFactory.Options().apply { inSampleSize = teiler }) ?: return null
        val h = (breitePx.toLong() * roh.height / roh.width).toInt().coerceAtLeast(1)
        val skaliert = Bitmap.createScaledBitmap(roh, breitePx, h, true)
        if (skaliert !== roh) roh.recycle()
        return skaliert
    }
    override fun schliessen() {}
}

private sealed interface Ansicht {
    object Laedt : Ansicht
    class Fehler(val text: String) : Ansicht
    class Bereit(val quelle: Seitenquelle, val datei: AppModel.BelegDatei) : Ansicht
}

private val handler = Handler(Looper.getMainLooper())

/** Zeigt den Beleg einer Buchung im Programm an (PDF seitenweise, Bilder als Ganzes) – mit Vergrößern und „Öffnen mit …". */
@Composable
fun BelegAnsichtScreen(model: AppModel, buchungId: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var ansicht by remember(buchungId) { mutableStateOf<Ansicht>(Ansicht.Laedt) }
    val halter = remember(buchungId) { arrayOfNulls<Seitenquelle>(1) }

    DisposableEffect(buchungId) {
        var aktiv = true
        thread {
            val ergebnis: Ansicht = try {
                val d = model.belegDatei(buchungId) ?: throw IllegalStateException("Der Beleg ist nicht mehr vorhanden.")
                val q: Seitenquelle = if (d.mime == "application/pdf") PdfQuelle(d.datei) else BildQuelle(d.datei)
                Ansicht.Bereit(q, d)
            } catch (e: SecurityException) {
                Ansicht.Fehler("Die PDF ist passwortgeschützt und lässt sich hier nicht anzeigen. „Öffnen mit …“ ist nicht möglich, solange sie nicht lesbar ist.")
            } catch (e: Exception) {
                Ansicht.Fehler("Der Beleg lässt sich hier nicht anzeigen (${e.message ?: e::class.simpleName}).")
            }
            handler.post {
                if (aktiv) {
                    (ergebnis as? Ansicht.Bereit)?.let { halter[0] = it.quelle }
                    ansicht = ergebnis
                } else {
                    (ergebnis as? Ansicht.Bereit)?.quelle?.schliessen()
                }
            }
        }
        onDispose {
            aktiv = false
            halter[0]?.schliessen()
            halter[0] = null
        }
    }

    when (val a = ansicht) {
        Ansicht.Laedt -> Text("Beleg wird geladen …", modifier.padding(16.dp))
        is Ansicht.Fehler -> Text(a.text, modifier.padding(16.dp))
        is Ansicht.Bereit -> {
            var stufe by remember { mutableStateOf(1f) }
            var hinweis by remember { mutableStateOf<String?>(null) }
            BoxWithConstraints(modifier.fillMaxSize()) {
                val breiteDp = maxWidth
                val breitePx = with(LocalDensity.current) { breiteDp.roundToPx() }
                Column(Modifier.fillMaxSize()) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(a.datei.name, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        OutlinedButton(onClick = { stufe = (stufe - 0.5f).coerceAtLeast(1f) }, enabled = stufe > 1f) { Text("−") }
                        OutlinedButton(onClick = { stufe = (stufe + 0.5f).coerceAtMost(2.5f) }, enabled = stufe < 2.5f) { Text("+") }
                        OutlinedButton(onClick = {
                            try {
                                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", a.datei.datei)
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW).setDataAndType(uri, a.datei.mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                                )
                            } catch (e: Exception) {
                                hinweis = "Keine App zum Öffnen gefunden."
                            }
                        }) { Text("Öffnen mit …") }
                    }
                    if (hinweis != null) Text(hinweis!!, Modifier.padding(horizontal = 8.dp), color = MaterialTheme.colorScheme.error)
                    Box(Modifier.weight(1f).fillMaxWidth().horizontalScroll(rememberScrollState())) {
                        LazyColumn(Modifier.width(breiteDp * stufe)) {
                            items(count = a.quelle.anzahl) { i ->
                                SeitenBild(a.quelle, i, (breitePx * stufe).toInt().coerceAtMost(2400))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SeitenBild(quelle: Seitenquelle, index: Int, breitePx: Int) {
    var bild by remember(quelle, index, breitePx) { mutableStateOf<Bitmap?>(null) }
    DisposableEffect(quelle, index, breitePx) {
        var aktiv = true
        thread {
            val b = try { quelle.zeichnen(index, breitePx) } catch (e: Exception) { null }
            handler.post { if (aktiv) bild = b }
        }
        onDispose { aktiv = false }
    }
    val b = bild
    if (b != null) {
        Image(
            bitmap = b.asImageBitmap(), contentDescription = "Seite ${index + 1}",
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp), contentScale = ContentScale.FillWidth,
        )
    } else {
        Box(Modifier.fillMaxWidth().height(300.dp), contentAlignment = Alignment.Center) { Text("Seite ${index + 1} wird geladen …") }
    }
}

// ---------------------------------------------------------------- Zuschneiden und Drehen

/** Vollbild-Fenster: das Foto drehen und den Ausschnitt mit den vier Ecken (oder durch Verschieben) festlegen. */
@Composable
private fun SeitenEditor(entwurf: AppModel.FotoEntwurf, onFertig: () -> Unit, onVerwerfen: () -> Unit) {
    var basis by remember(entwurf) { mutableStateOf<Bitmap?>(null) }
    var fehler by remember(entwurf) { mutableStateOf<String?>(null) }
    var grad by remember(entwurf) { mutableStateOf(entwurf.edit.grad) }
    var links by remember(entwurf) { mutableStateOf(entwurf.edit.links) }
    var oben by remember(entwurf) { mutableStateOf(entwurf.edit.oben) }
    var rechts by remember(entwurf) { mutableStateOf(entwurf.edit.rechts) }
    var unten by remember(entwurf) { mutableStateOf(entwurf.edit.unten) }

    DisposableEffect(entwurf) {
        var aktiv = true
        thread {
            var b: Bitmap? = null
            var f: String? = null
            try {
                b = BildZuPdf.vorschau({ FileInputStream(entwurf.datei) }, 1400)
            } catch (e: Exception) {
                f = e.message ?: "Das Foto lässt sich nicht anzeigen."
            }
            handler.post { if (aktiv) { basis = b; fehler = f } }
        }
        onDispose { aktiv = false }
    }
    val anzeige = remember(basis, grad) { basis?.let { BildZuPdf.drehen(it, grad) } }

    Dialog(onDismissRequest = { }, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = false, dismissOnClickOutside = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().padding(8.dp)) {
                Text("Foto zuschneiden: Ecken ziehen oder den Rahmen verschieben.", style = MaterialTheme.typography.bodyMedium)
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().padding(vertical = 8.dp)) {
                    val maxB = maxWidth
                    val maxH = maxHeight
                    val dichte = LocalDensity.current
                    val bild = anzeige
                    if (bild == null) {
                        Text(fehler ?: "Foto wird geladen …", Modifier.align(Alignment.Center))
                    } else {
                        val faktor = minOf(with(dichte) { maxB.toPx() } / bild.width, with(dichte) { maxH.toPx() } / bild.height)
                        val breite = with(dichte) { (bild.width * faktor).toDp() }
                        val hoehe = with(dichte) { (bild.height * faktor).toDp() }
                        Box(Modifier.size(breite, hoehe).align(Alignment.Center)) {
                            Image(bitmap = bild.asImageBitmap(), contentDescription = "Foto", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
                            Canvas(
                                Modifier.fillMaxSize().pointerInput(bild) {
                                    var modus = 0 // 1 bis 4: Ecke links oben, rechts oben, links unten, rechts unten; 5: verschieben
                                    val fang = 44.dp.toPx()
                                    val mind = 0.08f
                                    detectDragGestures(
                                        onDragStart = { p ->
                                            val w = size.width.toFloat()
                                            val h = size.height.toFloat()
                                            val ecken = listOf(Offset(links * w, oben * h), Offset(rechts * w, oben * h), Offset(links * w, unten * h), Offset(rechts * w, unten * h))
                                            var best = 0
                                            for (i in 1..3) if ((ecken[i] - p).getDistance() < (ecken[best] - p).getDistance()) best = i
                                            modus = when {
                                                (ecken[best] - p).getDistance() <= fang -> best + 1
                                                p.x in (links * w)..(rechts * w) && p.y in (oben * h)..(unten * h) -> 5
                                                else -> 0
                                            }
                                        },
                                        onDrag = { change, d ->
                                            change.consume()
                                            val dx = d.x / size.width
                                            val dy = d.y / size.height
                                            when (modus) {
                                                1 -> { links = (links + dx).coerceIn(0f, rechts - mind); oben = (oben + dy).coerceIn(0f, unten - mind) }
                                                2 -> { rechts = (rechts + dx).coerceIn(links + mind, 1f); oben = (oben + dy).coerceIn(0f, unten - mind) }
                                                3 -> { links = (links + dx).coerceIn(0f, rechts - mind); unten = (unten + dy).coerceIn(oben + mind, 1f) }
                                                4 -> { rechts = (rechts + dx).coerceIn(links + mind, 1f); unten = (unten + dy).coerceIn(oben + mind, 1f) }
                                                5 -> {
                                                    val bb = rechts - links
                                                    val hh = unten - oben
                                                    val nl = (links + dx).coerceIn(0f, 1f - bb)
                                                    val no = (oben + dy).coerceIn(0f, 1f - hh)
                                                    links = nl; rechts = nl + bb; oben = no; unten = no + hh
                                                }
                                            }
                                        },
                                        onDragEnd = { modus = 0 },
                                        onDragCancel = { modus = 0 },
                                    )
                                },
                            ) {
                                val w = size.width
                                val h = size.height
                                val abdunkeln = Color(0x99000000)
                                drawRect(abdunkeln, Offset(0f, 0f), Size(w, oben * h))
                                drawRect(abdunkeln, Offset(0f, unten * h), Size(w, h - unten * h))
                                drawRect(abdunkeln, Offset(0f, oben * h), Size(links * w, (unten - oben) * h))
                                drawRect(abdunkeln, Offset(rechts * w, oben * h), Size(w - rechts * w, (unten - oben) * h))
                                drawRect(Color.White, Offset(links * w, oben * h), Size((rechts - links) * w, (unten - oben) * h), style = Stroke(width = 3.dp.toPx()))
                                for (ecke in listOf(Offset(links * w, oben * h), Offset(rechts * w, oben * h), Offset(links * w, unten * h), Offset(rechts * w, unten * h))) {
                                    drawCircle(Color.White, radius = 10.dp.toPx(), center = ecke)
                                    drawCircle(Color(0xFF1976D2), radius = 7.dp.toPx(), center = ecke)
                                }
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedButton(
                        onClick = { grad = (grad + 270) % 360; links = 0f; oben = 0f; rechts = 1f; unten = 1f },
                        enabled = basis != null, modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 8.dp),
                    ) { Text("Links drehen", maxLines = 1) }
                    OutlinedButton(
                        onClick = { grad = (grad + 90) % 360; links = 0f; oben = 0f; rechts = 1f; unten = 1f },
                        enabled = basis != null, modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 8.dp),
                    ) { Text("Rechts drehen", maxLines = 1) }
                    OutlinedButton(
                        onClick = { links = 0f; oben = 0f; rechts = 1f; unten = 1f },
                        enabled = basis != null, modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 8.dp),
                    ) { Text("Ganz", maxLines = 1) }
                }
                Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Button(
                        onClick = { entwurf.edit = SeitenEdit(grad, links, oben, rechts, unten); onFertig() },
                        enabled = basis != null,
                    ) { Text("Übernehmen") }
                    TextButton(onClick = onVerwerfen) { Text("Seite verwerfen") }
                }
            }
        }
    }
}
