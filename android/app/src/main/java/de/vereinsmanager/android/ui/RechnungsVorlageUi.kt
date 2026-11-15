package de.vereinsmanager.android.ui

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.invoice.Vorlagen

/** Die Rechnungsvorlage: Texte, Zahlungsziel, Briefpapier-Bild, Akzentfarbe und § 19-Hinweis. */
@Composable
fun RechnungsVorlageScreen(model: AppModel, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var v by remember { mutableStateOf(model.vorlage) }
    var tage by remember { mutableStateOf(model.vorlage.zahlungszielTage.toString()) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var zeigeFehler by remember { mutableStateOf(false) }
    val exporter = rememberExporter(model) { meldung = it }

    val aktuell = v.copy(zahlungszielTage = tage.toIntOrNull() ?: -1)
    val fehlerMap = if (zeigeFehler) Vorlagen.pruefen(aktuell) else emptyMap()

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Das Briefpapier (Bild oder PDF und oberer Rand) gilt für Rechnungen und Aufnahmeanträge und steht jetzt in den Einstellungen.",
            style = MaterialTheme.typography.bodySmall,
        )
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Texte und Zahlungsziel", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                Text("Diese Vorgaben bekommt jede neue Rechnung; bestehende ändern sich nicht.", style = MaterialTheme.typography.bodySmall)
                Feld("Zahlungsziel in Tagen", tage, { tage = it.filter { c -> c.isDigit() }.take(3) }, error = fehlerMap["tage"], keyboard = KeyboardType.Number)
                Feld("Einleitungstext", v.einleitung, { v = v.copy(einleitung = it) }, singleLine = false)
                Feld("Schlusstext", v.schluss, { v = v.copy(schluss = it) }, singleLine = false)
                Feld("Hinweis für Kleinunternehmer (§ 19 UStG)", v.kleinunternehmerHinweis, { v = v.copy(kleinunternehmerHinweis = it) }, singleLine = false)
            }
        }
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Aussehen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                Feld("Akzentfarbe", v.akzent, { v = v.copy(akzent = it) }, error = fehlerMap["akzent"], hinweis = "Als #rrggbb, z. B. #1e40af (Überschriften und Linien)")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(v.faltmarken, { v = v.copy(faltmarken = it) })
                    Text("  Falz- und Lochmarken drucken", Modifier.weight(1f))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(v.giroCode, { v = v.copy(giroCode = it) })
                    Text("  GiroCode (QR-Code für die Überweisung) drucken", Modifier.weight(1f))
                }
                Text("Der GiroCode erscheint nur, wenn in den Einstellungen eine IBAN steht.", style = MaterialTheme.typography.bodySmall)
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium)
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error)
        Button(
            onClick = {
                fehler = null
                if (Vorlagen.pruefen(aktuell).isNotEmpty()) zeigeFehler = true
                else model.vorlageSpeichern(aktuell) { f -> if (f == null) onDone() else fehler = f }
            },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
        ) { Text("Speichern") }
        OutlinedButton(
            onClick = {
                if (Vorlagen.pruefen(aktuell).isNotEmpty()) { zeigeFehler = true; return@OutlinedButton }
                exporter.pdfSchreiber("Beispielrechnung.pdf") { out -> model.vorlagePdfSchreiben(aktuell, out) }
            },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth(),
        ) { Text("Beispiel-PDF mit diesen Einstellungen") }
    }
}


/**
 * Das Briefpapier des Vereins für Rechnungen und Aufnahmeanträge: ein Bild (PNG/JPEG) oder die erste Seite einer PDF, dazu der obere Rand
 * in Millimetern. Mit Briefpapier druckt die App keinen eigenen Briefkopf. Speichert sofort, die übrigen Vorlagenwerte bleiben unverändert.
 */
@Composable
fun BriefpapierKarte(model: AppModel) {
    val ctx = LocalContext.current
    val v = model.vorlage
    var rand by remember(v.randOben) { mutableStateOf(v.randOben.toString()) }
    var meldung by remember { mutableStateOf<String?>(null) }
    val randZahl = rand.toIntOrNull()
    val randFehler = if (randZahl == null || randZahl !in 0..200) "Bitte eine Zahl von 0 bis 200 eingeben." else null

    val waehler = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val name = try {
                ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
            } catch (e: Exception) { null } ?: "Briefpapier"
            model.briefpapierLaden(uri) { url, f ->
                if (url == null) { meldung = f ?: "Die Datei konnte nicht gelesen werden."; return@briefpapierLaden }
                model.vorlageSpeichern(model.vorlage.copy(briefpapier = url, briefpapierName = name, briefpapierDatum = "")) { e -> meldung = e ?: "Briefpapier gespeichert." }
            }
        }
    }
    val vorschau = remember(v.briefpapier) {
        if (!v.hatBriefpapier) null else try {
            val bytes = android.util.Base64.decode(v.briefpapier.substringAfter("base64,", ""), android.util.Base64.DEFAULT)
            val o = android.graphics.BitmapFactory.Options().apply { inSampleSize = 4 }
            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)?.asImageBitmap()
        } catch (e: Exception) { null }
    }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Briefpapier (Rechnungen und Anträge)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Mit eigenem Briefpapier (Bild oder PDF, am besten A4 hochkant) druckt die App keinen eigenen Briefkopf – er steht schon auf dem Papier, " +
                    "und der Text beginnt unter dem oberen Rand. Ohne Briefpapier druckt die App einen einfachen Briefkopf aus den Vereinsdaten. " +
                    "Bei einer PDF wird die erste Seite verwendet.",
                style = MaterialTheme.typography.bodySmall,
            )
            if (vorschau != null) {
                Image(vorschau, contentDescription = "Vorschau des Briefpapiers", modifier = Modifier.width(140.dp).padding(vertical = 4.dp))
                Text(v.briefpapierName.ifEmpty { "Briefpapier" }, style = MaterialTheme.typography.bodySmall)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { waehler.launch(arrayOf("image/*", "application/pdf")) }, enabled = !model.busy) {
                    Text(if (v.hatBriefpapier) "Anderes wählen" else "Bild oder PDF wählen")
                }
                if (v.hatBriefpapier) OutlinedButton(
                    onClick = { model.vorlageSpeichern(model.vorlage.copy(briefpapier = "", briefpapierName = "", briefpapierDatum = "")) { e -> meldung = e ?: "Briefpapier entfernt." } },
                    enabled = !model.busy,
                ) { Text("Entfernen") }
            }
            Feld("Oberer Rand in mm (Platz für den Briefkopf auf dem Papier)", rand, { rand = it.filter { c -> c.isDigit() }.take(3) }, error = randFehler, keyboard = KeyboardType.Number)
            OutlinedButton(
                onClick = { model.vorlageSpeichern(model.vorlage.copy(randOben = randZahl ?: 45)) { e -> meldung = e ?: "Rand gespeichert." } },
                enabled = !model.busy && randFehler == null && randZahl != v.randOben,
            ) { Text("Rand speichern") }
            if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
        }
    }
}
