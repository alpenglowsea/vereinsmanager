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
    val pdf: (dateiname: String, tabelle: () -> PdfTabelle) -> Unit,
)

@Composable
fun rememberExporter(model: AppModel, onResult: (String) -> Unit): Exporter {
    var wartendCsv by remember { mutableStateOf<(() -> String)?>(null) }
    var wartendPdf by remember { mutableStateOf<(() -> PdfTabelle)?>(null) }
    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val p = wartendCsv
        wartendCsv = null
        if (uri != null && p != null) model.exportiere(uri, { out -> out.write(p().toByteArray(Charsets.UTF_8)) }, "CSV-Datei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    val pdfLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val p = wartendPdf
        wartendPdf = null
        if (uri != null && p != null) model.exportiere(uri, { out -> PdfWriter.schreiben(p(), out) }, "PDF-Datei gespeichert.", onResult)
        else onResult("Export abgebrochen.")
    }
    return remember(csvLauncher, pdfLauncher) {
        Exporter(
            csv = { name, f -> wartendCsv = f; csvLauncher.launch(name) },
            pdf = { name, f -> wartendPdf = f; pdfLauncher.launch(name) },
        )
    }
}
