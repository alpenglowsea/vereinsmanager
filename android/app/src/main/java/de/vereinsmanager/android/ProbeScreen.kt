package de.vereinsmanager.android

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import de.vereinsmanager.core.backup.BackupCrypto
import de.vereinsmanager.core.backup.BackupFile
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File
import kotlin.concurrent.thread

private fun Context.readText(uri: Uri): String =
    contentResolver.openInputStream(uri)!!.use { it.readBytes() }.toString(Charsets.UTF_8)

private fun Context.writeText(uri: Uri, text: String) {
    contentResolver.openOutputStream(uri, "wt")!!.use { it.write(text.toByteArray(Charsets.UTF_8)) }
}

private fun heapMb(): Long {
    val r = Runtime.getRuntime()
    return (r.totalMemory() - r.freeMemory()) / (1024 * 1024)
}

private fun maxHeapMb(): Long = Runtime.getRuntime().maxMemory() / (1024 * 1024)

/** Probe A: Sicherung einlesen (auch verschlüsselt), zurückschreiben, erneut einlesen, vergleichen. */
private fun probeA(ctx: Context, input: Uri, password: String, out: Uri?, log: (String) -> Unit) {
    val t0 = System.nanoTime()
    val raw = ctx.readText(input)
    log("Datei gelesen: ${raw.length} Zeichen")
    val encrypted = BackupFile.isEncrypted(raw)
    log("Verschlüsselt: ${if (encrypted) "ja" else "nein"}")
    val plain = if (encrypted) {
        val t = System.nanoTime()
        val p = BackupCrypto.decrypt(raw, password)
        log("Entschlüsselt in ${(System.nanoTime() - t) / 1_000_000} ms")
        p
    } else raw
    val b = BackupFile.parse(plain)
    log("Kopf: ${b.app} / ${b.version} / ${b.exportedAt}")
    for ((k, n) in b.counts()) log("  $k: $n")
    val text = b.toJsonText()
    val again = BackupFile.parse(text)
    log("Hin und zurück identisch: ${again.data == b.data}")
    if (out != null) {
        val t = System.nanoTime()
        val wrap = if (encrypted) BackupCrypto.encrypt(text, password) else text
        ctx.writeText(out, wrap)
        log("Geschrieben (${if (encrypted) "verschlüsselt" else "Klartext"}), ${(System.nanoTime() - t) / 1_000_000} ms: ${wrap.length} Zeichen")
        val back = ctx.readText(out)
        val back2 = BackupFile.parse(if (BackupFile.isEncrypted(back)) BackupCrypto.decrypt(back, password) else back)
        log("Zurückgelesene Datei identisch: ${back2.data == b.data}")
    }
    log("Gesamt: ${(System.nanoTime() - t0) / 1_000_000} ms")
}

/** Probe C: große Sicherung selbst erzeugen und Zeit/Speicher messen. */
private fun probeC(megabytes: Int, password: String, log: (String) -> Unit) {
    log("Erlaubter Speicher der App: ${maxHeapMb()} MB, aktuell belegt: ${heapMb()} MB")
    val blockChars = 512 * 1024
    val block = "A".repeat(blockChars) // Platzhalter für Dokumentinhalt (Data-URL)
    val docs = (megabytes * 2).coerceAtLeast(1)
    val members = (1..3000).map { i ->
        JsonObject(mapOf("id" to JsonPrimitive("m$i"), "firstName" to JsonPrimitive("Vorname $i"),
            "lastName" to JsonPrimitive("Nachname Ä$i"), "iban" to JsonPrimitive("DE00 0000 0000 0000 0000 00")))
    }
    val documents = (1..docs).map { i ->
        JsonObject(mapOf("id" to JsonPrimitive("d$i"), "name" to JsonPrimitive("Dokument $i.pdf"),
            "content" to JsonPrimitive("data:application/pdf;base64,$block")))
    }
    val file = BackupFile("VereinsManager Lokal", "1.2.3", "test",
        mapOf("members" to JsonArray(members), "documents" to JsonArray(documents)))
    var t = System.nanoTime()
    val text = file.toJsonText()
    log("Erzeugt+geschrieben: ${text.length / 1024 / 1024} MB Text in ${(System.nanoTime() - t) / 1_000_000} ms, Speicher ${heapMb()} MB")
    t = System.nanoTime()
    val enc = BackupCrypto.encrypt(text, password)
    log("Verschlüsselt in ${(System.nanoTime() - t) / 1_000_000} ms, Speicher ${heapMb()} MB")
    t = System.nanoTime()
    val dec = BackupCrypto.decrypt(enc, password)
    log("Entschlüsselt in ${(System.nanoTime() - t) / 1_000_000} ms, Speicher ${heapMb()} MB")
    t = System.nanoTime()
    val back = BackupFile.parse(dec)
    log("Eingelesen in ${(System.nanoTime() - t) / 1_000_000} ms, Speicher ${heapMb()} MB")
    log("Identisch: ${back.data == file.data}")
}

/** Probe B: PDF zeichnen (Umlaute, €, Tabelle) und mit PdfRenderer wieder anzeigen. */
private fun probeB1(ctx: Context): Pair<File, Bitmap> {
    val doc = PdfDocument()
    val page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
    val c = page.canvas
    val p = Paint().apply { isAntiAlias = true; color = Color.BLACK }
    p.textSize = 18f; p.isFakeBoldText = true
    c.drawText("Testrechnung – Größe, Übung, Maß, 12,50 €", 40f, 60f, p)
    p.isFakeBoldText = false; p.textSize = 11f
    val rows = listOf("Mitgliedsbeitrag 2026" to "60,00 €", "Spende (steuerbefreit) ÄÖÜäöüß" to "25,00 €", "Summe" to "85,00 €")
    var y = 100f
    for ((a, b) in rows) { c.drawText(a, 40f, y, p); c.drawText(b, 480f, y, p); c.drawLine(40f, y + 6, 555f, y + 6, p); y += 24f }
    doc.finishPage(page)
    val f = File(ctx.cacheDir, "probe_b.pdf")
    f.outputStream().use { doc.writeTo(it) }
    doc.close()
    ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
        PdfRenderer(pfd).use { r ->
            r.openPage(0).use { pg ->
                val bmp = Bitmap.createBitmap(pg.width * 2, pg.height * 2, Bitmap.Config.ARGB_8888)
                bmp.eraseColor(Color.WHITE)
                pg.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                return f to bmp
            }
        }
    }
}

/** Probe B2: GiroCode (EPC-QR). Testdaten, keine echte IBAN. */
private fun probeB2(): Bitmap {
    val epc = listOf("BCD", "002", "1", "SCT", "", "TSV Musterstadt 1890 e.V.",
        "DE02120300000000202051", "EUR60.00", "", "", "Mitgliedsbeitrag 2026").joinToString("\n")
    val hints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.CHARACTER_SET to "UTF-8", EncodeHintType.MARGIN to 2)
    val m = QRCodeWriter().encode(epc, BarcodeFormat.QR_CODE, 600, 600, hints)
    val bmp = Bitmap.createBitmap(600, 600, Bitmap.Config.ARGB_8888)
    for (x in 0 until 600) for (y in 0 until 600) bmp.setPixel(x, y, if (m[x, y]) Color.BLACK else Color.WHITE)
    return bmp
}

@Composable
fun ProbeScreen(modifier: Modifier = Modifier) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var password by remember { mutableStateOf("") }
    var logText by remember { mutableStateOf("Bereit.\n") }
    var pdfBmp by remember { mutableStateOf<Bitmap?>(null) }
    var qrBmp by remember { mutableStateOf<Bitmap?>(null) }
    var picked by remember { mutableStateOf<Uri?>(null) }
    val handler = remember { android.os.Handler(android.os.Looper.getMainLooper()) }
    fun log(s: String) { handler.post { logText += s + "\n" } }
    fun run(name: String, block: () -> Unit) {
        log("— $name —")
        thread {
            try { block() } catch (e: Throwable) { log("FEHLER: ${e::class.simpleName}: ${e.message}") }
        }
    }

    val openLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) { picked = uri; run("Probe A (nur lesen)") { probeA(ctx, uri, password, null, ::log) } }
    }
    val saveLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { out ->
        val inp = picked
        if (out != null && inp != null) run("Probe A (lesen und zurückschreiben)") { probeA(ctx, inp, password, out, ::log) }
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text("Phase-0-Proben")
        OutlinedTextField(password, { password = it }, label = { Text("Passwort (nur bei verschlüsselter Sicherung)") },
            modifier = Modifier.fillMaxWidth())
        Row {
            Button(onClick = { openLauncher.launch(arrayOf("*/*")) }) { Text("A: Sicherung öffnen") }
        }
        Button(onClick = { saveLauncher.launch("probe_zurueck.json") }, enabled = picked != null) {
            Text("A: dieselbe Datei zurückschreiben")
        }
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Button(onClick = {
            run("Probe B (PDF)") {
                val (f, bmp) = probeB1(ctx)
                log("PDF erzeugt: ${f.length()} Bytes"); handler.post { pdfBmp = bmp }
            }
        }) { Text("B: PDF erzeugen und anzeigen") }
        Button(onClick = { run("Probe B2 (GiroCode)") { val b = probeB2(); handler.post { qrBmp = b }; log("QR erzeugt – bitte mit Banking-App scannen") } }) {
            Text("B2: GiroCode anzeigen")
        }
        pdfBmp?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxWidth()) }
        qrBmp?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxWidth()) }
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Row {
            Button(onClick = { run("Probe C (25 MB)") { probeC(25, "probe-passwort", ::log) } }) { Text("C: 25 MB") }
            Button(onClick = { run("Probe C (100 MB)") { probeC(100, "probe-passwort", ::log) } }, modifier = Modifier.padding(start = 8.dp)) { Text("C: 100 MB") }
        }
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        SelectionContainer { Text(logText) }
    }
}
