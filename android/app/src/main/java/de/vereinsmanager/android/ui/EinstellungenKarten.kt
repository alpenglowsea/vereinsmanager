package de.vereinsmanager.android.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.width
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.settings.Fehlerbericht
import de.vereinsmanager.core.settings.Vorstand
import de.vereinsmanager.core.settings.Vorstandsmitglied
import de.vereinsmanager.core.settings.Zuruecksetzen
import java.time.format.DateTimeFormatter

/** Die Vorstandsliste. Die Änderungen gelten erst mit „Speichern“ am Ende der Seite. */
@Composable
fun VorstandKarte(liste: List<Vorstandsmitglied>, onChange: (List<Vorstandsmitglied>) -> Unit, fehler: Map<String, String>) {
    fun aendere(id: String, neu: (Vorstandsmitglied) -> Vorstandsmitglied) = onChange(liste.map { if (it.id == id) neu(it) else it })
    fun schiebe(i: Int, schritt: Int) {
        val j = i + schritt
        if (j !in liste.indices) return
        onChange(liste.toMutableList().also { it.add(j, it.removeAt(i)) })
    }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Vorstand", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Wer als „Vorsitzende/r“ und „Kassenwart / Schatzmeister“ eingetragen ist, erscheint im Briefkopf der Rechnungen, im Lastschriftprotokoll und auf der Spendenbescheinigung. Die Funktion wird am Wortlaut erkannt, nicht an der Reihenfolge.",
                style = MaterialTheme.typography.bodySmall,
            )
            liste.forEachIndexed { i, m ->
                HorizontalDivider()
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Feld("Funktion", m.funktion, { v -> aendere(m.id) { it.copy(funktion = v) } })
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Vorstand.FUNKTIONEN.forEach { f ->
                            FilterChip(selected = m.funktion == f, onClick = { aendere(m.id) { it.copy(funktion = f) } }, label = { Text(f) })
                        }
                    }
                    Feld("Name", m.name, { v -> aendere(m.id) { it.copy(name = v) } }, error = fehler[m.id])
                    Feld("E-Mail", m.email, { v -> aendere(m.id) { it.copy(email = v) } }, keyboard = androidx.compose.ui.text.input.KeyboardType.Email)
                    Feld("Telefon", m.telefon, { v -> aendere(m.id) { it.copy(telefon = v) } }, keyboard = androidx.compose.ui.text.input.KeyboardType.Phone)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        KompaktKnopf("▲", { schiebe(i, -1) }, Modifier.width(44.dp), enabled = i > 0)
                        KompaktKnopf("▼", { schiebe(i, +1) }, Modifier.width(44.dp), enabled = i < liste.lastIndex)
                        TextButton(onClick = { onChange(liste.filter { it.id != m.id }) }) { Text("Entfernen") }
                    }
                }
            }
            OutlinedButton(onClick = { onChange(liste + Vorstandsmitglied(Vorstand.neueId(), "", "")) }) { Text("+ Person hinzufügen") }
            for (h in Vorstand.hinweise(liste)) Text(h, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
    }
}

/** Die Sparten; Änderungen wirken sofort (anders als der Rest der Seite). */
@Composable
fun SpartenKarte(model: AppModel) {
    var neu by remember { mutableStateOf("") }
    var meldung by remember { mutableStateOf<String?>(null) }
    var umbenennen by remember { mutableStateOf<String?>(null) }
    var neuerName by remember { mutableStateOf("") }
    var dialogFehler by remember { mutableStateOf<String?>(null) }
    val liste = model.departments

    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Sparten / Abteilungen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Änderungen hier gelten sofort. Eine Sparte, in der es noch Mitglieder, Buchungen oder Inventar gibt, lässt sich nicht löschen. „Umbenennen“ ändert den Namen überall mit. Es bleibt immer mindestens eine Sparte; bei einem Verein ohne Abteilungen z. B. „Hauptverein“.",
                style = MaterialTheme.typography.bodySmall,
            )
            if (liste.isEmpty()) Text("Noch keine Sparte angelegt.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            liste.forEachIndexed { i, name ->
                val v = remember(model.stand, name) { model.spartenVerwendung(name) }
                HorizontalDivider()
                Column {
                    Text(name, fontWeight = FontWeight.Medium)
                    if (v.gesamt > 0) Text("In Verwendung: ${v.text()}. Löschen ist erst möglich, wenn nichts mehr diese Sparte nutzt.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
                    else if (liste.size == 1) Text("Die letzte Sparte lässt sich nicht löschen.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        KompaktKnopf("▲", { model.spartenVerschieben(name, -1) }, Modifier.width(44.dp), enabled = i > 0 && !model.busy)
                        KompaktKnopf("▼", { model.spartenVerschieben(name, +1) }, Modifier.width(44.dp), enabled = i < liste.lastIndex && !model.busy)
                        TextButton(onClick = { umbenennen = name; neuerName = name; dialogFehler = null }, enabled = !model.busy) { Text("Umbenennen") }
                        TextButton(onClick = { model.spartenLoeschen(name) { e -> meldung = e ?: "„$name“ gelöscht." } }, enabled = !model.busy) { Text("Löschen") }
                    }
                }
            }
            HorizontalDivider()
            Feld("Neue Sparte", neu, { neu = it })
            Button(onClick = { model.spartenHinzufuegen(neu) { e -> if (e == null) { neu = ""; meldung = "Sparte angelegt." } else { meldung = e } } }, enabled = !model.busy && neu.isNotBlank()) { Text("Sparte anlegen") }
        }
    }
    // Rückmeldung als Fenster: Sie steht sonst weit unten am Ende der Karte und wird übersehen.
    meldung?.let { m ->
        Aktionsdialog(titel = "Hinweis", onDismiss = { meldung = null }, inhalt = { Text(m) }, aktionen = { TextButton(onClick = { meldung = null }, modifier = Modifier.fillMaxWidth()) { Text("OK") } })
    }
    val alt = umbenennen
    if (alt != null) {
        AlertDialog(
            onDismissRequest = { umbenennen = null },
            title = { Text("Sparte umbenennen") },
            text = {
                Column {
                    Feld("Neuer Name", neuerName, { neuerName = it }, error = dialogFehler)
                    Text("Der Name wird bei allen Mitgliedern, Buchungen und Inventargegenständen mit „$alt“ geändert.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(enabled = !model.busy, onClick = {
                    model.spartenUmbenennen(alt, neuerName) { e -> if (e == null) { umbenennen = null; meldung = "Umbenannt." } else { dialogFehler = e } }
                }) { Text("Umbenennen") }
            },
            dismissButton = { TextButton(onClick = { umbenennen = null }) { Text("Abbrechen") } },
        )
    }
}

private val ZEIT = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")

/** Automatische und von Hand angelegte Sicherungen im geschützten App-Ordner, mit Wiederherstellung. */
@Composable
fun SchnappschussKarte(model: AppModel) {
    var meldung by remember { mutableStateOf<String?>(null) }
    var einspielen by remember { mutableStateOf<String?>(null) }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Schnappschüsse (automatische Sicherung)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Die App legt beim Start höchstens einmal am Tag eine vollständige Sicherung im geschützten App-Speicher an (die letzten 7 bleiben). " +
                    "Dazu kommen die Sicherungen, die vor dem Einspielen einer Sicherung, vor dem Löschen aller Daten und von Hand entstehen (die letzten 5 bleiben). " +
                    "Sie ersetzen keine Sicherung auf einem anderen Gerät: Wird die App deinstalliert oder das Handy zurückgesetzt, sind sie weg. Sie sind nicht verschlüsselt.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(onClick = { model.schnappschussAnlegen { e -> meldung = e ?: "Schnappschuss angelegt." } }, enabled = !model.busy) { Text("Jetzt einen Schnappschuss anlegen") }
            if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
            val liste = model.schnappschuesse
            if (liste.isEmpty()) Text("Noch keine Schnappschüsse.", style = MaterialTheme.typography.bodySmall)
            else Text("${liste.size} Schnappschüsse, zusammen ${groesse(liste.sumOf { it.bytes })}", style = MaterialTheme.typography.labelMedium)
            for (s in liste) {
                HorizontalDivider()
                Column {
                    Text(s.eintrag.zeit.format(ZEIT) + " Uhr", fontWeight = FontWeight.Medium)
                    Text("${s.eintrag.grund.text} · ${groesse(s.bytes)}", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { einspielen = s.eintrag.name }, enabled = !model.busy) { Text("Wiederherstellen") }
                        TextButton(onClick = { model.schnappschussLoeschen(s.eintrag.name) }, enabled = !model.busy) { Text("Löschen") }
                    }
                }
            }
        }
    }
    val name = einspielen
    if (name != null) {
        val e = model.schnappschuesse.firstOrNull { it.eintrag.name == name }?.eintrag
        AlertDialog(
            onDismissRequest = { einspielen = null },
            title = { Text("Schnappschuss wiederherstellen?") },
            text = {
                Text(
                    "Der gesamte heutige Bestand wird durch den Stand vom ${e?.zeit?.format(ZEIT) ?: "?"} Uhr ersetzt. " +
                        "Was seitdem eingetragen wurde, fehlt danach. Vorher wird der heutige Stand als neuer Schnappschuss abgelegt.",
                )
            },
            confirmButton = { TextButton(onClick = { einspielen = null; model.schnappschussWiederherstellen(name) }) { Text("Wiederherstellen") } },
            dismissButton = { TextButton(onClick = { einspielen = null }) { Text("Abbrechen") } },
        )
    }
}

/** Hinweis auf die Gerätesperre: Die App hat bewusst keine eigene Sperre. */
@Composable
fun SchutzKarte() {
    val context = LocalContext.current
    var meldung by remember { mutableStateOf<String?>(null) }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Schutz der Daten", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Die App hat keine eigene Sperre. Die Daten liegen im geschützten Speicher der App, den andere Apps nicht lesen können. " +
                    "Wer das entsperrte Handy in der Hand hat, kann die App aber öffnen. Richten Sie deshalb eine Bildschirmsperre (PIN, Muster oder Fingerabdruck) ein. " +
                    "Die Daten selbst sind nicht verschlüsselt, ebenso wenig Sicherungen ohne Passwort.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(onClick = {
                try { context.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) } catch (e: Exception) { meldung = "Die Android-Einstellungen ließen sich nicht öffnen." }
            }) { Text("Android-Sicherheitseinstellungen öffnen") }
            if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** „Alle Daten löschen“ mit Bestätigungswort; vorher wird ein Schnappschuss angelegt. */
@Composable
fun LoeschenKarte(model: AppModel) {
    var dialog by remember { mutableStateOf(false) }
    var eingabe by remember { mutableStateOf("") }
    var meldung by remember { mutableStateOf<String?>(null) }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Alle Daten löschen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
            Text(
                "Entfernt Mitglieder, Finanzen, Belege, Dokumente, Einstellungen und alles andere von diesem Gerät. " +
                    "Vorher entsteht ein Schnappschuss, mit dem sich der Stand wiederherstellen lässt – solange die App installiert bleibt.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(onClick = { eingabe = ""; dialog = true }, enabled = !model.busy) { Text("Alle Daten löschen …") }
            if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
        }
    }
    if (dialog) {
        AlertDialog(
            onDismissRequest = { dialog = false },
            title = { Text("Wirklich alles löschen?") },
            text = {
                Column {
                    Text("Das lässt sich nur über den Schnappschuss rückgängig machen, den die App vorher anlegt. Zur Bestätigung bitte ${Zuruecksetzen.BESTAETIGUNG} eintippen.")
                    Feld("Bestätigung", eingabe, { eingabe = it })
                }
            },
            confirmButton = {
                TextButton(enabled = Zuruecksetzen.bestaetigt(eingabe) && !model.busy, onClick = {
                    dialog = false
                    model.alleDatenLoeschen { e -> meldung = e?.let { "Nicht gelöscht: $it" } ?: "Alle Daten wurden gelöscht. Der Stand davor liegt unter „Schnappschüsse“." }
                }) { Text("Endgültig löschen", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { dialog = false }) { Text("Abbrechen") } },
        )
    }
}

/** Freiwillige Unterstützung des Projekts: Erklärung wie in der Desktop-Fassung, Link zur Spendenseite (öffnet im Browser). */
@Composable
fun UnterstuetzenKarte() {
    val context = LocalContext.current
    val zwischenablage = LocalClipboardManager.current
    val s = MaterialTheme.colorScheme
    var meldung by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Projekt und Weiterentwicklung unterstützen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = s.primary)
                Text(
                    "Der VereinsManager ist eine gemeinnützige Open-Source-Initiative. Er wurde gebaut, um Vereinen, Vorständen und Ehrenamtlichen eine moderne, " +
                        "DSGVO-konforme und kostenfreie Verwaltung an die Hand zu geben. Ihre freiwillige Unterstützung sichert die Pflege und künftige Erweiterungen.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                KompaktKnopf("Liberapay öffnen", {
                    try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Fehlerbericht.SPENDEN_URL))) } catch (e: Exception) { meldung = "Kein Browser gefunden. Adresse: ${Fehlerbericht.SPENDEN_URL}" }
                }, Modifier.fillMaxWidth(), primaer = true)
                KompaktKnopf("Adresse kopieren", {
                    zwischenablage.setText(AnnotatedString(Fehlerbericht.SPENDEN_URL)); meldung = "Adresse kopiert: ${Fehlerbericht.SPENDEN_URL}"
                }, Modifier.fillMaxWidth())
                Text(
                    "Die Seite öffnet im Browser; die App selbst überträgt nichts. Auf dem Desktop gibt es zusätzlich einen QR-Code zum Scannen mit dem Smartphone.",
                    style = MaterialTheme.typography.bodySmall, color = s.onSurfaceVariant,
                )
                if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
            }
        }
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Wofür wird Ihre Unterstützung verwendet?", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = s.primary)
                Text("Jeder Beitrag fließt in den Erhalt und die Weiterentwicklung der Software:", style = MaterialTheme.typography.bodySmall)
                val punkte = listOf(
                    Triple("Kontinuierliche Pflege", "Laufende Wartung, Fehlerbehebungen und Anpassungen an neue Systemstände.", s.primaryContainer to s.onPrimaryContainer),
                    Triple("Datensicherheit und Stabilität", "Strikter Schutz sensibler Vereinsdaten, zuverlässige Speicherkonzepte und moderne Sicherheitsstandards.", s.tertiaryContainer to s.onTertiaryContainer),
                    Triple("Infrastruktur und Bereitstellung", "Zuverlässige Bereitstellung, Vorlagen für Selbsthosting und praxisnahe Dokumentation für Administratoren.", s.secondaryContainer to s.onSecondaryContainer),
                    Triple("Freier Zugang fürs Ehrenamt", "Das Projekt dauerhaft unabhängig und ohne Abo-Hürden für gemeinnützige Vereine halten.", s.primaryContainer to s.onPrimaryContainer),
                )
                punkte.forEach { (titel, text, farbe) ->
                    androidx.compose.material3.Surface(Modifier.fillMaxWidth(), shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp), color = farbe.first) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = farbe.second)
                            Text(text, style = MaterialTheme.typography.bodySmall, color = farbe.second)
                        }
                    }
                }
            }
        }
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Ein herzliches Dankeschön!", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = s.primary)
                Text(
                    "Ob 5 €, 15 € oder ein regelmäßiger Kaffeebeitrag: Jeder Beitrag stärkt die ehrenamtliche Arbeit und hilft dabei, Vereinsverwaltung für alle einfacher und verlässlicher zu machen.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

/** Fehlerbericht: wird nicht übertragen, sondern als E-Mail vorbereitet, die der Absender selbst abschickt. */
@Composable
fun FehlerMeldenKarte() {
    val context = LocalContext.current
    val zwischenablage = LocalClipboardManager.current
    var bereich by remember { mutableStateOf(Fehlerbericht.BEREICHE.first()) }
    var betreff by remember { mutableStateOf("") }
    var schwere by remember { mutableStateOf(Fehlerbericht.SCHWEREGRADE.first()) }
    var text by remember { mutableStateOf("") }
    var meldung by remember { mutableStateOf<String?>(null) }
    val version = remember { try { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "?" } catch (e: Exception) { "?" } }
    val system = "VereinsManager Android $version, Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}), ${Build.MANUFACTURER} ${Build.MODEL}"
    val eingabe = Fehlerbericht.Eingabe(bereich, betreff, schwere, text)

    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Fehler melden", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Die App schickt nichts selbst ab. Sie bereitet eine E-Mail an ${Fehlerbericht.EMPFAENGER} vor, die Sie in Ihrem Mailprogramm prüfen und selbst senden. " +
                    "Bitte keine Namen oder Daten von Mitgliedern in den Text schreiben.",
                style = MaterialTheme.typography.bodySmall,
            )
            Auswahl("Bereich", Fehlerbericht.BEREICHE.associateWith { it }, bereich) { bereich = it }
            Auswahl("Schweregrad", Fehlerbericht.SCHWEREGRADE.associateWith { it }, schwere) { schwere = it }
            Feld("Betreff", betreff, { betreff = it })
            Feld("Beschreibung", text, { text = it }, singleLine = false)
            TextButton(onClick = { text = if (text.isBlank()) Fehlerbericht.VORLAGE else text + "\n\n" + Fehlerbericht.VORLAGE }) { Text("Gliederung einfügen") }
            Text("Wird mitgeschickt: $system", style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    val f = Fehlerbericht.pruefen(eingabe)
                    if (f != null) { meldung = f; return@Button }
                    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")).apply {
                        putExtra(Intent.EXTRA_EMAIL, arrayOf(Fehlerbericht.EMPFAENGER))
                        putExtra(Intent.EXTRA_SUBJECT, Fehlerbericht.betreff(eingabe))
                        putExtra(Intent.EXTRA_TEXT, Fehlerbericht.text(eingabe, system))
                    }
                    meldung = try { context.startActivity(intent); "Das Mailprogramm wurde geöffnet. Abgeschickt ist noch nichts." } catch (e: Exception) { "Kein Mailprogramm gefunden. Nehmen Sie „Text kopieren“." }
                }) { Text("E-Mail vorbereiten") }
                OutlinedButton(onClick = {
                    val f = Fehlerbericht.pruefen(eingabe)
                    if (f != null) { meldung = f; return@OutlinedButton }
                    zwischenablage.setText(AnnotatedString("An: ${Fehlerbericht.EMPFAENGER}\nBetreff: ${Fehlerbericht.betreff(eingabe)}\n\n${Fehlerbericht.text(eingabe, system)}"))
                    meldung = "Text kopiert."
                }) { Text("Text kopieren") }
            }
            if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** Die Karte der Einstellungen im Wiese-Stil: weiche Ecken, heller Grund, feiner Rand. */
@Composable
internal fun WieseKarte(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val s = MaterialTheme.colorScheme
    Surface(modifier, shape = RoundedCornerShape(24.dp), color = s.surfaceContainerLowest, border = BorderStroke(1.5.dp, s.outlineVariant)) {
        Column(content = content)
    }
}
