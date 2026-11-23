package de.vereinsmanager.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.members.Fuehrungszeugnis
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.Unterlagen
import java.time.LocalDate

/*
 * Unterlagen am Mitglied und Führungszeugnis-Vermerk (Paket U), gleiche Regeln wie am Desktop
 * (core/.../members/Unterlagen.kt bzw. src/utils/unterlagen.ts).
 */

/** „gültig bis 31.01.2027“ in Rot (abgelaufen), Orange (bald) oder Grau. [faellig]: Text für das Führungszeugnis. */
@Composable
private fun FristText(bis: String, faellig: Boolean = false) {
    val s = Unterlagen.ablauf(bis, LocalDate.now())
    if (s == Unterlagen.Ablauf.OHNE) return
    val sc = MaterialTheme.colorScheme
    val farbe = when (s) {
        Unterlagen.Ablauf.ABGELAUFEN -> sc.error
        Unterlagen.Ablauf.BALD -> Color(0xFFC2410C)
        else -> sc.onSurfaceVariant
    }
    val text = when {
        faellig && s == Unterlagen.Ablauf.ABGELAUFEN -> "überfällig seit ${deDate(bis)}"
        faellig -> "am ${deDate(bis)}"
        s == Unterlagen.Ablauf.ABGELAUFEN -> "abgelaufen am ${deDate(bis)}"
        else -> "gültig bis ${deDate(bis)}"
    }
    Text(text, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = farbe)
}

/** Reiter „Unterlagen“ im Mitglied: Liste, „Unterlage hinzufügen“ und der Führungszeugnis-Vermerk. */
@Composable
fun MemberUnterlagenTab(model: AppModel, m: Member, onOpenDoc: (String) -> Unit, onUnterlage: (String?) -> Unit) {
    val sc = MaterialTheme.colorScheme
    val docs = model.unterlagenVon(m.id)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("Unterlagen (${docs.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
        Button(onClick = { onUnterlage(null) }, enabled = !model.busy) { Text("Hinzufügen") }
    }
    Text("Lizenzen, Nachweise und Einverständnisse, als PDF oder Foto.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
    if (docs.isEmpty()) Text("Zu diesem Mitglied sind keine Unterlagen abgelegt.", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
    docs.forEach { d -> UnterlageZeile(d, onOpen = { onOpenDoc(d.id) }, onBearbeiten = { onUnterlage(d.id) }) }
    FuehrungszeugnisKarte(model, m)
}

@Composable
private fun UnterlageZeile(d: Dokument, onOpen: () -> Unit, onBearbeiten: () -> Unit) {
    val sc = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(20.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(20.dp)).clickable(onClick = onOpen),
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(d.titel.ifEmpty { d.dateiName }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(
                    listOf(Unterlagen.artText(Unterlagen.artVon(d)), if (d.ausgestelltAm.isNotEmpty()) "ausgestellt ${deDate(d.ausgestelltAm)}" else "")
                        .filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant,
                )
                FristText(d.gueltigBis)
            }
            TextButton(onClick = onBearbeiten) { Text("Bearbeiten") }
        }
    }
}

@Composable
private fun FuehrungszeugnisKarte(model: AppModel, m: Member) {
    val sc = MaterialTheme.colorScheme
    val v = remember(model.stand, m.id) { model.fuehrungszeugnis(m.id) }
    var bearbeiten by remember { mutableStateOf(false) }
    var loeschen by remember { mutableStateOf(false) }
    DetailKarte("Erweitertes Führungszeugnis", Modifier.padding(top = 8.dp)) {
        if (v == null) {
            Text("Kein Vermerk. Nur nötig für Personen, die mit Kindern und Jugendlichen arbeiten.", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
        } else {
            Text("Eingesehen am ${deDate(v.eingesehenAm)}, Zeugnis vom ${deDate(v.datum)}.", style = MaterialTheme.typography.bodyMedium)
            Text(
                if (v.einschlaegig) "Einschlägige Verurteilung eingetragen." else "Keine einschlägige Verurteilung eingetragen.",
                style = MaterialTheme.typography.bodyMedium, fontWeight = if (v.einschlaegig) FontWeight.Bold else FontWeight.Normal,
                color = if (v.einschlaegig) sc.error else Color.Unspecified,
            )
            Unterlagen.faellig(v)?.let { f ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Nächste Vorlage fällig ", style = MaterialTheme.typography.bodySmall)
                    FristText(f, faellig = true)
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf(if (v == null) "Vermerken" else "Ändern", { bearbeiten = true }, Modifier.weight(1f), enabled = !model.busy)
            if (v != null) KompaktKnopf("Löschen", { loeschen = true }, Modifier.weight(1f), enabled = !model.busy)
        }
        Text(
            "Keine Kopie des Zeugnisses ablegen: Nach § 72a Abs. 5 SGB VIII dürfen nur diese Angaben gespeichert werden. Nach Ende der " +
                "Tätigkeit den Vermerk löschen (spätestens drei Monate danach). Ein neues Zeugnis ist üblicherweise nach ${Unterlagen.FZ_JAHRE} Jahren fällig. Angaben ohne Gewähr.",
            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp),
        )
    }
    if (bearbeiten) FuehrungszeugnisDialog(model, m.id, v) { bearbeiten = false }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false },
            title = { Text("Vermerk löschen?") },
            text = { Text("Der Vermerk zum Führungszeugnis wird entfernt.") },
            confirmButton = { TextButton(onClick = { loeschen = false; model.fuehrungszeugnisSetzen(m.id, null) { } }) { Text("Löschen") } },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}

@Composable
private fun FuehrungszeugnisDialog(model: AppModel, memberId: String, alt: Fuehrungszeugnis?, onFertig: () -> Unit) {
    var e by remember { mutableStateOf(alt ?: Fuehrungszeugnis(LocalDate.now().toString(), "", false)) }
    var fehler by remember { mutableStateOf<String?>(null) }
    Aktionsdialog(
        titel = "Führungszeugnis vermerken",
        onDismiss = onFertig,
        inhalt = {
            DatumFeld("Datum des Zeugnisses", e.datum) { e = e.copy(datum = it) }
            DatumFeld("Eingesehen am", e.eingesehenAm) { e = e.copy(eingesehenAm = it) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = e.einschlaegig, onCheckedChange = { e = e.copy(einschlaegig = it) })
                Text("Einschlägige Verurteilung nach § 72a Abs. 1 SGB VIII eingetragen")
            }
            fehler?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        },
        aktionen = {
            Button(onClick = {
                val p = Unterlagen.pruefeFuehrungszeugnis(e, LocalDate.now())
                if (p != null) fehler = p else model.fuehrungszeugnisSetzen(memberId, e) { f -> if (f == null) onFertig() else fehler = f }
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Speichern") }
            TextButton(onClick = onFertig, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}

/**
 * id == null: neue Unterlage – zuerst Datei wählen oder Foto aufnehmen, dann die Angaben. Sonst: Angaben einer
 * vorhandenen Unterlage ändern (die Datei bleibt; ersetzen geht über Löschen und neu anlegen).
 */
@Composable
fun UnterlageFormScreen(model: AppModel, memberId: String, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var meldung by remember { mutableStateOf<String?>(null) }
    if (id == null) {
        DisposableEffect(Unit) { onDispose { model.dokEntwurf = null; model.fotosVerwerfen() } }
    }
    val vorhanden = id?.let { i -> model.dokumente.firstOrNull { it.id == i } }
    if (id != null && vorhanden == null) {
        Text("Die Unterlage gibt es nicht mehr.", modifier.padding(16.dp))
        return
    }
    val mitglied = model.members.firstOrNull { it.id == memberId }
    val entwurf = model.dokEntwurf

    if (id == null && entwurf == null) {
        DateiWahl(
            model, onAbbrechen = onDone, modifier = modifier, meldung = { meldung = it }, ziel = model.unterlagenFotoZiel,
            frage = "Welche Unterlage soll angehängt werden?",
            hinweis = "PDF oder Foto, z. B. eine Trainerlizenz. Fotos werden verkleinert und zu einer PDF gemacht.",
        )
    } else {
        var art by remember(id, entwurf) { mutableStateOf(vorhanden?.let { Unterlagen.artVon(it) } ?: "trainerlizenz") }
        var titel by remember(id, entwurf) { mutableStateOf(vorhanden?.titel ?: entwurf!!.name.substringBeforeLast('.', entwurf.name)) }
        var ausgestellt by remember(id, entwurf) { mutableStateOf(vorhanden?.ausgestelltAm ?: "") }
        var gueltig by remember(id, entwurf) { mutableStateOf(vorhanden?.gueltigBis ?: "") }
        var fehler by remember { mutableStateOf<String?>(null) }
        var loeschen by remember { mutableStateOf(false) }
        val sc = MaterialTheme.colorScheme
        val arten = remember { Unterlagen.ARTEN.associate { it.wert to it.text } }

        Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            FormKopf(if (vorhanden != null) "Unterlage bearbeiten" else "Neue Unterlage", listOf("Angaben"), 0, null) { }
            FormKarte {
                if (mitglied != null) Text("Für ${mitglied.firstName} ${mitglied.lastName}".trim(), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                if (entwurf != null) Text("Datei: ${entwurf.name} (${groesse(entwurf.bytes.size.toLong())})", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
                if (vorhanden != null) Text("Datei: ${vorhanden.dateiName} (${groesse(vorhanden.groesse)})", style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant)
                Auswahl("Art", arten, art) { art = it }
                Feld("Bezeichnung", titel, { titel = it }, hinweis = "z. B. C-Lizenz Fußball")
                DatumFeld("Ausgestellt am", ausgestellt, optional = true) { ausgestellt = it }
                DatumFeld("Gültig bis (freiwillig)", gueltig, optional = true) { gueltig = it }
                Text("Mit „Gültig bis“ erscheint die Unterlage 90 Tage vor Ablauf im Dashboard.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                fehler?.let { Text(it, color = sc.error, modifier = Modifier.padding(top = 6.dp)) }
                if (vorhanden != null) {
                    OutlinedButton(onClick = { loeschen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("Unterlage löschen") }
                }
            }
            FormFuss(0, 1, { }, onAbbrechen = onDone, onSpeichern = {
                val p = Unterlagen.pruefeUnterlage(art, titel, ausgestellt, gueltig)
                if (p != null) {
                    fehler = p
                } else if (vorhanden != null) {
                    model.unterlageAendern(vorhanden.id, art, titel, ausgestellt, gueltig) { f -> if (f == null) onDone() else fehler = f }
                } else {
                    model.unterlageSpeichern(memberId, art, titel, ausgestellt, gueltig) { f -> if (f == null) onDone() else fehler = f }
                }
            }, enabled = !model.busy)
        }
        if (loeschen && vorhanden != null) {
            AlertDialog(
                onDismissRequest = { loeschen = false },
                title = { Text("Unterlage löschen?") },
                text = { Text("„${vorhanden.titel}“ wird auch aus dem Dokumentenarchiv entfernt.") },
                confirmButton = {
                    TextButton(onClick = { loeschen = false; model.unterlageLoeschen(vorhanden.id) { f -> if (f == null) onDone() else fehler = f } }) { Text("Löschen") }
                },
                dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
            )
        }
    }
    val text = meldung
    if (text != null) {
        AlertDialog(
            onDismissRequest = { meldung = null },
            title = { Text("Hinweis") },
            text = { Text(text) },
            confirmButton = { TextButton(onClick = { meldung = null }) { Text("OK") } },
        )
    }
}
