package de.vereinsmanager.android.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.backup.ImportMode

@Composable
fun SicherungKarte(model: AppModel, onProbes: () -> Unit, modifier: Modifier = Modifier) {
    var pending by remember { mutableStateOf<Uri?>(null) }
    var pendingEncrypted by remember { mutableStateOf(false) }
    var importPassword by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(ImportMode.REPLACE) }
    var exportPassword by remember { mutableStateOf("") }
    var exportDialog by remember { mutableStateOf(false) }
    var exportPaket by remember { mutableStateOf(true) }

    val openLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            pendingEncrypted = try { model.eingabeArt(uri).geschuetzt } catch (e: Exception) { false }
            importPassword = ""
            pending = uri
        }
    }
    val saveZip = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        if (uri != null) model.exportBackup(uri, exportPassword, true)
        exportPassword = ""
    }
    val saveJson = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) model.exportBackup(uri, exportPassword, false)
        exportPassword = ""
    }

    // Jedes Ergebnis erscheint in einem Fenster, damit es nicht unten auf der Seite untergeht.
    var gesehen by remember { mutableStateOf(model.meldungNr) }
    if (!model.busy && model.meldungNr != gesehen && model.message.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = { gesehen = model.meldungNr },
            title = { Text(if (model.message.startsWith("Fehler")) "Fehler" else "Fertig") },
            text = { Text(model.message) },
            confirmButton = { TextButton(onClick = { gesehen = model.meldungNr }) { Text("OK") } },
        )
    }

    WieseKarte(modifier.fillMaxWidth()) {
      Column(Modifier.padding(16.dp)) {
        Text("Datensicherung", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
        Button(onClick = { openLauncher.launch(arrayOf("*/*")) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Text("Sicherung einspielen")
        }
        OutlinedButton(onClick = { exportDialog = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Text("Sicherung ausgeben")
        }
        if (model.dateiText.isNotEmpty()) Text("Gespeicherte Dateien (Belege, Dokumente, Fotos): ${model.dateiText}", Modifier.padding(top = 12.dp))
        if (model.message.isNotEmpty()) Text(model.message, Modifier.padding(top = 12.dp))

        HorizontalDivider(Modifier.padding(vertical = 12.dp))
        TextButton(onClick = onProbes) { Text("Proben (Entwicklung)") }
      }
    }

    val uri = pending
    if (uri != null) {
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text("Sicherung einspielen") },
            text = {
                Column {
                    if (pendingEncrypted) {
                        Text("Die Datei ist verschlüsselt.")
                        OutlinedTextField(
                            importPassword, { importPassword = it }, label = { Text("Passwort") },
                            visualTransformation = PasswordVisualTransformation(), singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Row {
                        TextButton(onClick = { mode = ImportMode.REPLACE }) {
                            Text((if (mode == ImportMode.REPLACE) "● " else "○ ") + "Ersetzen")
                        }
                        TextButton(onClick = { mode = ImportMode.MERGE }) {
                            Text((if (mode == ImportMode.MERGE) "● " else "○ ") + "Ergänzen")
                        }
                    }
                    Text(
                        if (mode == ImportMode.REPLACE)
                            "Ersetzen: Alle Bereiche, die in der Datei stehen, werden durch ihren Inhalt ersetzt. " +
                                "Vorher wird eine Kopie des bisherigen Bestands abgelegt."
                        else
                            "Ergänzen: Es kommen nur Einträge hinzu, die hier noch fehlen. Vorhandenes bleibt unverändert.",
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { model.importBackup(uri, importPassword, mode); pending = null },
                    enabled = !pendingEncrypted || importPassword.isNotEmpty(),
                ) { Text("Einspielen") }
            },
            dismissButton = { TextButton(onClick = { pending = null }) { Text("Abbrechen") } },
        )
    }

    if (exportDialog) {
        AlertDialog(
            onDismissRequest = { exportDialog = false },
            title = { Text("Sicherung ausgeben") },
            text = {
                Column {
                    Row {
                        TextButton(onClick = { exportPaket = true }) { Text((if (exportPaket) "● " else "○ ") + "Paket (ZIP)") }
                        TextButton(onClick = { exportPaket = false }) { Text((if (!exportPaket) "● " else "○ ") + "JSON (alt)") }
                    }
                    Text(
                        if (exportPaket)
                            "Paket: enthält alle Daten und alle Dateien (Belege, Dokumente, Fotos) in lesbaren Ordnern. " +
                                "Mit Passwort wird es als normales ZIP mit AES-256 gesichert; die Dateinamen bleiben dabei lesbar, der Inhalt nicht."
                        else
                            "JSON: das bisherige Format, das auch der Desktop liest. Dateien stehen darin als Text und machen die Datei groß; " +
                                "bei sehr vielen Dateien geht es nicht mehr, dann bitte das Paket nehmen.",
                    )
                    Text(
                        "Passwort mindestens 8 Zeichen; ohne Passwort liegt alles im Klartext vor.",
                        Modifier.padding(top = 8.dp),
                    )
                    OutlinedTextField(
                        exportPassword, { exportPassword = it }, label = { Text("Passwort (optional)") },
                        visualTransformation = PasswordVisualTransformation(), singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { exportDialog = false; (if (exportPaket) saveZip else saveJson).launch(model.suggestedFileName(exportPaket)) },
                    enabled = exportPassword.isEmpty() || exportPassword.length >= 8,
                ) { Text("Weiter") }
            },
            dismissButton = { TextButton(onClick = { exportDialog = false; exportPassword = "" }) { Text("Abbrechen") } },
        )
    }
}
