package de.vereinsmanager.android.export

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.export.PdfTabelle

/** Öffnet den Speicherdialog des Systems und schreibt danach die Datei. Das Ergebnis meldet [onResult] auf dem Hauptfaden. */
class Exporter(
    val csv: (dateiname: String, inhalt: () -> String) -> Unit,
    val pdfSchreiber: (dateiname: String, schreiber: (java.io.OutputStream) -> Unit) -> Unit,
    val xml: (dateiname: String, inhalt: () -> String) -> Unit,
    val zipSchreiber: (dateiname: String, schreiber: (java.io.OutputStream) -> Unit) -> Unit = { _, _ -> },
    val ics: (dateiname: String, inhalt: () -> String) -> Unit = { _, _ -> },
) {
    fun pdf(dateiname: String, tabelle: () -> PdfTabelle) = pdfSchreiber(dateiname) { out -> PdfWriter.schreiben(tabelle(), out) }
}

@Composable
fun rememberExporter(model: AppModel, onResult: (String) -> Unit): Exporter {
    var wartendCsv by remember { mutableStateOf<(() -> String)?>(null) }
    var wartendXml by remember { mutableStateOf<(() -> String)?>(null) }
    var wartendPdf by remember { mutableStateOf<((java.io.OutputStream) -> Unit)?>(null) }
    var wartendZip by remember { mutableStateOf<((java.io.OutputStream) -> Unit)?>(null) }
    var wartendIcs by remember { mutableStateOf<(() -> String)?>(null) }
    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val p = wartendCsv
        wartendCsv = null
        if (uri != null && p != null) model.exportiere(uri, { out -> out.write(p().toByteArray(Charsets.UTF_8)) }, "CSV-Datei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    val pdfLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val p = wartendPdf
        wartendPdf = null
        if (uri != null && p != null) model.exportiere(uri, p, "PDF-Datei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    val zipLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        val p = wartendZip
        wartendZip = null
        if (uri != null && p != null) model.exportiere(uri, p, "ZIP-Datei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    val xmlLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/xml")) { uri ->
        val p = wartendXml
        wartendXml = null
        if (uri != null && p != null) model.exportiere(uri, { out -> out.write(p().toByteArray(Charsets.UTF_8)) }, "Datei gespeichert.", onResult)
        else onResult("Speichern abgebrochen.")
    }
    val icsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/calendar")) { uri ->
        val p = wartendIcs
        wartendIcs = null
        if (uri != null && p != null) model.exportiere(uri, { out -> out.write(p().toByteArray(Charsets.UTF_8)) }, "Kalenderdatei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    return remember(csvLauncher, pdfLauncher, xmlLauncher, zipLauncher, icsLauncher) {
        Exporter(
            csv = { name, f -> wartendCsv = f; csvLauncher.launch(name) },
            pdfSchreiber = { name, f -> wartendPdf = f; pdfLauncher.launch(name) },
            xml = { name, f -> wartendXml = f; xmlLauncher.launch(name) },
            zipSchreiber = { name, f -> wartendZip = f; zipLauncher.launch(name) },
            ics = { name, f -> wartendIcs = f; icsLauncher.launch(name) },
        )
    }
}
