package de.vereinsmanager.android.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
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
fun HomeScreen(model: AppModel, onMembers: () -> Unit, onProbes: () -> Unit, modifier: Modifier = Modifier) {
    var pending by remember { mutableStateOf<Uri?>(null) }
    var pendingEncrypted by remember { mutableStateOf(false) }
    var importPassword by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(ImportMode.REPLACE) }
    var exportPassword by remember { mutableStateOf("") }
    var exportDialog by remember { mutableStateOf(false) }

    val openLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            pendingEncrypted = try { model.isEncrypted(uri) } catch (e: Exception) { false }
            importPassword = ""
            pending = uri
        }
    }
    val saveLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) model.exportBackup(uri, exportPassword)
        exportPassword = ""
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text("VereinsManager", style = MaterialTheme.typography.headlineMedium)
        Text(if (model.clubName.isEmpty()) "Noch keine Vereinsdaten – spielen Sie zuerst eine Sicherung ein." else model.clubName)
        HorizontalDivider(Modifier.padding(vertical = 12.dp))

        Button(onClick = onMembers, modifier = Modifier.fillMaxWidth()) { Text("Mitglieder (${model.members.size})") }

        HorizontalDivider(Modifier.padding(vertical = 12.dp))
        Text("Datensicherung", style = MaterialTheme.typography.titleMedium)
        Button(onClick = { openLauncher.launch(arrayOf("*/*")) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Text("Sicherung einspielen")
        }
        OutlinedButton(onClick = { exportDialog = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Text("Sicherung ausgeben")
        }
        if (model.message.isNotEmpty()) Text(model.message, Modifier.padding(top = 12.dp))

        HorizontalDivider(Modifier.padding(vertical = 12.dp))
        TextButton(onClick = onProbes) { Text("Proben (Entwicklung)") }
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
                    Text("Mit Passwort (mindestens 8 Zeichen) wird die Datei verschlüsselt. Ohne Passwort liegt sie im Klartext vor.")
                    OutlinedTextField(
                        exportPassword, { exportPassword = it }, label = { Text("Passwort (optional)") },
                        visualTransformation = PasswordVisualTransformation(), singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { exportDialog = false; saveLauncher.launch(model.suggestedFileName()) },
                    enabled = exportPassword.isEmpty() || exportPassword.length >= 8,
                ) { Text("Weiter") }
            },
            dismissButton = { TextButton(onClick = { exportDialog = false; exportPassword = "" }) { Text("Abbrechen") } },
        )
    }
}
