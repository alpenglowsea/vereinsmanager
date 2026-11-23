package de.vereinsmanager.android.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.backup.ArchivArt
import de.vereinsmanager.core.backup.ArchivJahr
import de.vereinsmanager.core.backup.ArchivKopf
import de.vereinsmanager.core.backup.ArchivPlan
import de.vereinsmanager.core.backup.ArchivPruefung
import de.vereinsmanager.core.backup.ArchivVermerk
import de.vereinsmanager.core.backup.Jahresarchiv

/*
 * Jahresarchiv am Handy (R4c), gleicher Ablauf wie am Desktop (R4b):
 *   1. Jahr wählen – erst ab dem Vorvorjahr; das Vorjahr steht mit Begründung da.
 *   2. Vorschau und Passwort (vorgewählt, abwählbar) – Archiv speichern.
 *   3. Die gespeicherte Datei noch einmal auswählen; die App prüft jede Datei darin.
 *   4. Erst danach werden die Dateien aus dem Bestand genommen (vorher ein Schnappschuss).
 * Wer nach Schritt 2 abbricht, verliert nichts; „Gespeichertes Archiv prüfen und auslagern“ macht später bei Schritt 3 weiter.
 */

private const val PASSWORT_MIN = 8

/** Fragt nach dem Passwort eines Jahresarchivs. */
@Composable
private fun ArchivPasswortDialog(fehler: String?, busy: Boolean, onOk: (String) -> Unit, onAbbrechen: () -> Unit) {
    var pw by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onAbbrechen,
        title = { Text("Verschlüsseltes Jahresarchiv") },
        text = {
            Column {
                Text("Dieses Jahresarchiv ist mit einem Passwort geschützt.")
                OutlinedTextField(
                    pw, { pw = it }, label = { Text("Passwort des Archivs") },
                    visualTransformation = PasswordVisualTransformation(), singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                if (fehler != null) Text(fehler, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 6.dp))
            }
        },
        confirmButton = { TextButton(onClick = { onOk(pw) }, enabled = pw.isNotEmpty() && !busy) { Text("Öffnen") } },
        dismissButton = { TextButton(onClick = onAbbrechen) { Text("Abbrechen") } },
    )
}

/**
 * Hinweis an einem Eintrag, dessen Datei im Jahresarchiv liegt, mit „Aus Archiv anzeigen“. Ist das Archiv in dieser
 * Sitzung schon geöffnet, geht es gleich weiter; sonst wird es gewählt (und bei Bedarf das Passwort abgefragt).
 * [onGeoeffnet] zeigt die Datei an (die Anzeige holt sie dann aus dem geöffneten Archiv).
 */
@Composable
fun ArchivHinweis(model: AppModel, vermerk: ArchivVermerk, was: String, onGeoeffnet: () -> Unit, modifier: Modifier = Modifier) {
    var gewaehlt by remember { mutableStateOf<Uri?>(null) }
    var passwortFrage by remember { mutableStateOf(false) }
    var passwortFehler by remember { mutableStateOf<String?>(null) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val waehlen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            gewaehlt = uri
            fehler = null
            model.archivOeffnen(uri, "", vermerk) { f, pw ->
                when {
                    pw -> { passwortFehler = null; passwortFrage = true }
                    f != null -> fehler = f
                    else -> onGeoeffnet()
                }
            }
        }
    }
    val sc = MaterialTheme.colorScheme
    Surface(shape = RoundedCornerShape(20.dp), color = sc.tertiaryContainer, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("$was liegt im Jahresarchiv ${vermerk.jahr}.", fontWeight = FontWeight.SemiBold, color = sc.onTertiaryContainer)
            Text(vermerk.datei, style = MaterialTheme.typography.bodySmall, color = sc.onTertiaryContainer)
            Button(
                onClick = { if (model.archivOffen(vermerk.kennung)) onGeoeffnet() else waehlen.launch(arrayOf("*/*")) },
                enabled = !model.busy,
            ) { Text("Aus Archiv anzeigen …") }
            if (fehler != null) Text(fehler!!, color = sc.error, style = MaterialTheme.typography.bodySmall)
        }
    }
    val uri = gewaehlt
    if (passwortFrage && uri != null) {
        ArchivPasswortDialog(passwortFehler, model.busy, onOk = { pw ->
            model.archivOeffnen(uri, pw, vermerk) { f, noetig ->
                when {
                    f == null && !noetig -> { passwortFrage = false; onGeoeffnet() }
                    noetig -> passwortFehler = f ?: "Bitte das Passwort eingeben."
                    else -> { passwortFrage = false; fehler = f }
                }
            }
        }, onAbbrechen = { passwortFrage = false })
    }
}

// ---------------------------------------------------------------- Einstellungen → Datensicherung

private enum class Modus { ARCHIVIEREN, AUSLAGERN, ZURUECKHOLEN }

private sealed interface Schritt {
    object Aus : Schritt
    class Jahre(val liste: List<ArchivJahr>) : Schritt
    class Vorschau(val plan: ArchivPlan) : Schritt
    /** Archiv gespeichert; jetzt die Datei erneut wählen. */
    class Gespeichert(val kopf: ArchivKopf) : Schritt
    /** Datei wählen (Wiedereinstieg oder Zurückholen). */
    object Waehlen : Schritt
    class Bereit(val uri: Uri, val kopf: ArchivKopf, val pruefung: ArchivPruefung, val betroffen: Int) : Schritt
    class Fertig(val text: String, val uebersprungen: List<String>) : Schritt
}

private fun groesseText(b: Long) = groesse(b)
private fun deDatumKurz(iso: String) = if (iso.length >= 10) "${iso.substring(8, 10)}.${iso.substring(5, 7)}.${iso.take(4)}" else iso

/** Die Karte „Jahresarchiv“ unter Einstellungen → Datensicherung. */
@Composable
fun JahresarchivKarte(model: AppModel, modifier: Modifier = Modifier) {
    var schritt by remember { mutableStateOf<Schritt>(Schritt.Aus) }
    var modus by remember { mutableStateOf(Modus.ARCHIVIEREN) }
    var jahr by remember { mutableStateOf<Int?>(null) }
    var mitPasswort by remember { mutableStateOf(true) }
    var passwort by remember { mutableStateOf("") }
    var wiederholung by remember { mutableStateOf("") }
    var verstanden by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    // Für die Passwortabfrage beim Prüfen eines gewählten Archivs
    var pruefUri by remember { mutableStateOf<Uri?>(null) }
    var passwortFrage by remember { mutableStateOf(false) }
    var passwortFehler by remember { mutableStateOf<String?>(null) }
    // Passwort, mit dem das gewählte Archiv geprüft wurde (wird zum Zurückholen wieder gebraucht)
    var pruefPasswort by remember { mutableStateOf("") }
    // Kennung des eben gespeicherten Archivs (Schritt 3 muss genau dieses sein)
    var erwartet by remember { mutableStateOf<String?>(null) }

    fun schliessen() {
        schritt = Schritt.Aus
        passwort = ""; wiederholung = ""; verstanden = false; fehler = null; erwartet = null
        passwortFrage = false; pruefUri = null; pruefPasswort = ""
    }

    fun gepruefteAuswahl(uri: Uri, pw: String) {
        fehler = null
        model.archivPruefen(uri, pw) { r, f, noetig ->
            when {
                noetig -> { pruefUri = uri; passwortFehler = if (passwortFrage) (f ?: "Bitte das Passwort eingeben.") else null; passwortFrage = true }
                f != null -> { passwortFrage = false; fehler = f }
                r != null -> {
                    passwortFrage = false
                    pruefPasswort = pw
                    val (kopf, p) = r
                    when {
                        erwartet != null && kopf.kennung != erwartet ->
                            fehler = "Das ist nicht das eben gespeicherte Archiv (gewählt: Jahr ${kopf.jahr} von „${kopf.verein}“). Bitte die eben gespeicherte Datei wählen."
                        !p.ok -> fehler = "Das Archiv ist nicht in Ordnung, es wird nichts verändert. " +
                            p.fehler.take(3).joinToString(" ") + if (p.fehler.size > 3) " (und ${p.fehler.size - 3} weitere)" else ""
                        else -> schritt = Schritt.Bereit(
                            uri, kopf, p,
                            if (modus == Modus.ZURUECKHOLEN) model.archivVerweise(kopf.kennung) else kopf.eintraege.size,
                        )
                    }
                }
            }
        }
    }

    val speichern = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        val j = jahr
        if (uri != null && j != null) {
            fehler = null
            model.archivSchreiben(uri, j, if (mitPasswort) passwort else "") { kopf, f ->
                if (kopf != null) { erwartet = kopf.kennung; schritt = Schritt.Gespeichert(kopf) } else fehler = f
            }
        }
    }
    val waehlen = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) gepruefteAuswahl(uri, if (modus == Modus.ARCHIVIEREN && mitPasswort) passwort else "")
    }

    WieseKarte(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Jahresarchiv", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Nimmt die Dateien eines abgeschlossenen Jahres (Belege, Rechnungs- und Spenden-PDFs, Fotos ausgemusterter Gegenstände) " +
                    "aus dem Bestand und legt sie in einer eigenen Archivdatei ab. Buchungen, Rechnungen und Spenden bleiben vollständig; " +
                    "die Sicherung wird dauerhaft kleiner. Einzelne Dateien lassen sich jederzeit aus dem Archiv anzeigen oder alle zurückholen. " +
                    "Das Archiv lässt sich auch am Desktop öffnen und umgekehrt.",
                style = MaterialTheme.typography.bodySmall,
            )
            Button(onClick = {
                schliessen(); modus = Modus.ARCHIVIEREN; jahr = null; mitPasswort = true
                model.archivJahre { liste, f -> if (liste != null) schritt = Schritt.Jahre(liste) else fehler = f }
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Jahr archivieren …") }
            OutlinedButton(onClick = {
                schliessen(); modus = Modus.ZURUECKHOLEN; schritt = Schritt.Waehlen
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Jahresarchiv zurückholen …") }
            if (schritt == Schritt.Aus && fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }

    val fehlerText: @Composable () -> Unit = {
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
    }

    when (val s = schritt) {
        Schritt.Aus -> {}

        is Schritt.Jahre -> Aktionsdialog(
            titel = "Jahresarchiv anlegen (1 von 4)",
            onDismiss = { schliessen() },
            inhalt = {
                Text("Die Einträge selbst bleiben vollständig; an ihnen steht danach „im Jahresarchiv“.")
                if (s.liste.isEmpty()) Text("Im Bestand liegen keine Dateien, die ins Jahresarchiv gehören.", Modifier.padding(top = 8.dp))
                for (j in s.liste) {
                    Column(Modifier.padding(top = 8.dp)) {
                        TextButton(onClick = { jahr = j.jahr }, enabled = j.erlaubt) {
                            Text((if (jahr == j.jahr) "● " else "○ ") + "${j.jahr} · ${j.dateien} Dateien · ${groesseText(j.groesse)}", Modifier.fillMaxWidth())
                        }
                        if (!j.erlaubt && j.grund != null) Text(j.grund!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 12.dp))
                    }
                }
                fehlerText()
            },
            aktionen = {
                Button(
                    onClick = { jahr?.let { j -> model.archivPlan(j) { p, f -> if (p != null) { fehler = null; schritt = Schritt.Vorschau(p) } else fehler = f } } },
                    enabled = s.liste.any { it.jahr == jahr && it.erlaubt } && !model.busy, modifier = Modifier.fillMaxWidth(),
                ) { Text("Weiter") }
                OutlinedButton(onClick = { modus = Modus.AUSLAGERN; erwartet = null; fehler = null; schritt = Schritt.Waehlen }, modifier = Modifier.fillMaxWidth()) {
                    Text("Gespeichertes Archiv prüfen und auslagern …")
                }
                TextButton(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
            },
        )

        is Schritt.Vorschau -> {
            val p = s.plan
            val pwOk = !mitPasswort || (passwort.length >= PASSWORT_MIN && passwort == wiederholung && verstanden)
            Aktionsdialog(
                titel = "Jahresarchiv ${p.jahr} (2 von 4)",
                onDismiss = { schliessen() },
                inhalt = {
                    for ((art, n) in p.jeArt) Text("${art.name1Plural()}: $n")
                    Text("Der Bestand wird um etwa ${groesseText(p.groesse)} kleiner.", Modifier.padding(top = 4.dp))
                    Text("Aufbewahren", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    for (a in p.aufbewahrung) Text("${a.bezeichnung}: " + (a.bis?.let { "bis ${deDatumKurz(it)}" } ?: "keine gesetzliche Pflicht"), style = MaterialTheme.typography.bodySmall)
                    Jahresarchiv.aufbewahrenBis(p.aufbewahrung)?.let {
                        Text(
                            "Die Archivdatei also mindestens bis ${deDatumKurz(it)} aufheben, am besten in zwei Kopien an verschiedenen Orten. Angaben ohne Gewähr; im Zweifel Steuerberatung fragen.",
                            style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                        Checkbox(mitPasswort, { mitPasswort = it })
                        Text("Archiv mit Passwort schützen (empfohlen)", fontWeight = FontWeight.SemiBold)
                    }
                    Text(
                        "Die Belege enthalten Namen, Beträge und oft Bankverbindungen. Die Dateinamen im Archiv bleiben auch mit Passwort lesbar (so ist das ZIP-Format).",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (mitPasswort) {
                        OutlinedTextField(
                            passwort, { passwort = it }, label = { Text("Passwort (mindestens $PASSWORT_MIN Zeichen)") },
                            visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        )
                        OutlinedTextField(
                            wiederholung, { wiederholung = it }, label = { Text("Passwort wiederholen") },
                            visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth(),
                        )
                        if (passwort.isNotEmpty() && passwort.length < PASSWORT_MIN) Text("Mindestens $PASSWORT_MIN Zeichen.", color = MaterialTheme.colorScheme.error)
                        if (wiederholung.isNotEmpty() && passwort != wiederholung) Text("Die Passwörter stimmen nicht überein.", color = MaterialTheme.colorScheme.error)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(verstanden, { verstanden = it })
                            Text("Ohne dieses Passwort lässt sich das Archiv nie wieder öffnen, auch nicht mit dieser App. Ich bewahre es sicher auf.", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    fehlerText()
                },
                aktionen = {
                    Button(onClick = { speichern.launch(model.archivDateiname(p.jahr)) }, enabled = pwOk && !model.busy, modifier = Modifier.fillMaxWidth()) {
                        Text(if (model.busy) "Archiv wird geschrieben …" else "Archiv speichern …")
                    }
                    TextButton(onClick = { model.archivJahre { l, _ -> if (l != null) schritt = Schritt.Jahre(l) } }, modifier = Modifier.fillMaxWidth()) { Text("Zurück") }
                    TextButton(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
                },
            )
        }

        is Schritt.Gespeichert -> Aktionsdialog(
            titel = "Archiv gespeichert (3 von 4)",
            onDismiss = null,
            inhalt = {
                Text("Bitte wählen Sie die eben gespeicherte Datei jetzt noch einmal aus. Erst damit ist sicher, dass sie wirklich lesbar gespeichert ist; die App prüft dann jede Datei darin.")
                Text("Bis dahin bleibt im Bestand alles, wie es ist.", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
                Text("Empfehlung: eine zweite Kopie an einem anderen Ort ablegen (Rechner, USB-Stick, Cloud des Vereins).", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                fehlerText()
            },
            aktionen = {
                Button(onClick = { waehlen.launch(arrayOf("*/*")) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (model.busy) "Wird geprüft …" else "Gespeichertes Archiv auswählen …")
                }
                TextButton(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Später (nichts wird verändert)") }
            },
        )

        Schritt.Waehlen -> Aktionsdialog(
            titel = if (modus == Modus.ZURUECKHOLEN) "Jahresarchiv zurückholen" else "Gespeichertes Archiv auslagern",
            onDismiss = { schliessen() },
            inhalt = {
                Text(
                    if (modus == Modus.ZURUECKHOLEN)
                        "Wählen Sie das Jahresarchiv, dessen Dateien wieder in den Bestand sollen (z. B. für eine Betriebsprüfung). Die App prüft jede Datei; die Archivdatei bleibt unverändert."
                    else
                        "Wählen Sie ein schon gespeichertes Jahresarchiv. Die App prüft jede Datei und nimmt danach die Dateien aus dem Bestand, die im Archiv liegen und im Bestand noch unverändert sind.",
                )
                fehlerText()
            },
            aktionen = {
                Button(onClick = { waehlen.launch(arrayOf("*/*")) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (model.busy) "Wird geprüft …" else "Archiv auswählen …")
                }
                TextButton(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
            },
        )

        is Schritt.Bereit -> Aktionsdialog(
            titel = if (modus == Modus.ZURUECKHOLEN) "Jahresarchiv zurückholen" else "Dateien auslagern (4 von 4)",
            onDismiss = { schliessen() },
            inhalt = {
                Text("Archiv ${s.kopf.jahr} von „${s.kopf.verein}“ geprüft: ${s.pruefung.geprueft} Dateien lesbar und unverändert.")
                Text(
                    when {
                        modus != Modus.ZURUECKHOLEN ->
                            "Jetzt werden die Dateien von ${s.betroffen} Einträgen aus dem Bestand genommen. Vorher legt die App einen Schnappschuss des ganzen Bestands an. " +
                                "An Buchungen, Dokumenten und Gegenständen steht danach „im Jahresarchiv ${s.kopf.jahr}“; ansehen lassen sie sich mit „Aus Archiv anzeigen“."
                        s.betroffen == 0 -> "Im Bestand verweist kein Eintrag auf dieses Archiv. Es gibt nichts zurückzuholen."
                        else -> "${s.betroffen} Einträge verweisen auf dieses Archiv. Ihre Dateien werden wieder in den Bestand geschrieben; die Sicherung wird entsprechend größer."
                    },
                    Modifier.padding(top = 8.dp),
                )
                fehlerText()
            },
            aktionen = {
                if (modus != Modus.ZURUECKHOLEN) {
                    Button(onClick = {
                        model.archivAnwenden(s.kopf) { e, f ->
                            if (e != null) schritt = Schritt.Fertig(
                                "${e.geaendert} Einträge verweisen jetzt auf das Jahresarchiv ${s.kopf.jahr}; ihre Dateien sind aus dem Bestand genommen. Die Einträge selbst bleiben vollständig.\n\n" +
                                    "Hinweis: Die Schnappschüsse der App enthalten die Dateien noch, bis sie durch neuere ersetzt werden. Geben Sie jetzt eine neue Sicherung aus; sie ist kleiner als die bisherige.",
                                e.uebersprungen,
                            ) else fehler = f
                        }
                    }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text(if (model.busy) "Läuft …" else "Dateien jetzt aus dem Bestand nehmen") }
                } else if (s.betroffen > 0) {
                    Button(onClick = {
                        model.archivZurueckholen(s.uri, pruefPasswort) { r, f, _ ->
                            if (r != null) schritt = Schritt.Fertig(
                                "Die Dateien von ${r.second.geaendert} Einträgen aus dem Jahresarchiv ${r.first.jahr} sind wieder im Bestand. Die Archivdatei bleibt unverändert.",
                                r.second.uebersprungen,
                            ) else fehler = f ?: "Das Passwort fehlt."
                        }
                    }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text(if (model.busy) "Läuft …" else "Dateien zurückholen") }
                }
                TextButton(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
            },
        )

        is Schritt.Fertig -> Aktionsdialog(
            titel = "Fertig",
            onDismiss = { schliessen() },
            inhalt = {
                Text(s.text)
                if (s.uebersprungen.isNotEmpty()) {
                    Text("Übergangen (${s.uebersprungen.size}):", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    for (u in s.uebersprungen.take(20)) Text("• $u", style = MaterialTheme.typography.bodySmall)
                    if (s.uebersprungen.size > 20) Text("… und ${s.uebersprungen.size - 20} weitere.", style = MaterialTheme.typography.bodySmall)
                }
            },
            aktionen = { Button(onClick = { schliessen() }, modifier = Modifier.fillMaxWidth()) { Text("Schließen") } },
        )
    }

    val uri = pruefUri
    if (passwortFrage && uri != null) {
        ArchivPasswortDialog(passwortFehler, model.busy, onOk = { pw -> gepruefteAuswahl(uri, pw) }, onAbbrechen = { passwortFrage = false })
    }
}

/** Mehrzahl für die Vorschau. */
private fun ArchivArt.name1Plural(): String = when (this) {
    ArchivArt.BELEG -> "Belege"
    ArchivArt.RECHNUNG -> "Rechnungs-PDFs"
    ArchivArt.SPENDE -> "PDFs der Zuwendungsbestätigungen"
    ArchivArt.INVENTARFOTO -> "Fotos ausgemusterter Gegenstände"
}
