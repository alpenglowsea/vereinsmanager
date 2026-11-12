package de.vereinsmanager.android.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.antrag.Antrag
import de.vereinsmanager.core.antrag.AntragEinstellungen
import de.vereinsmanager.core.antrag.AntragLayout
import de.vereinsmanager.core.antrag.AntragRegeln
import de.vereinsmanager.core.antrag.BeitragsVorgabe
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.members.Iban
import java.time.LocalDate

private val BEZIEHUNGEN = linkedMapOf("Mutter" to "Mutter", "Vater" to "Vater", "Vormund" to "Vormund", "Sonstige" to "Sonstige/r")
private val GESCHLECHT = linkedMapOf("none" to "keine Angabe", "w" to "weiblich", "m" to "männlich", "d" to "divers")

private fun mitVerein(text: String, verein: String) = text.replace("{verein}", verein.ifBlank { "dem Verein" })

// ------------------------------------------------------------------ Startseite

/**
 * Einstieg für die Vereinsvertreter: neuen Antrag am Gerät aufnehmen lassen, das leere Formular zum Ausdrucken holen,
 * einen wartenden Antrag prüfen und die Einstellungen (Beiträge, Texte, eigene Vorlage) öffnen.
 */
@Composable
fun AntraegeScreen(
    model: AppModel, onNeu: () -> Unit, onPruefen: () -> Unit, onEinstellungen: () -> Unit, modifier: Modifier = Modifier,
) {
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val wartet = model.antragWartet
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Das neue Mitglied füllt den Antrag selbst auf diesem Gerät aus und unterschreibt am Ende mit dem Finger – " +
                "im Beisein eines Vereinsvertreters. Danach prüfen Sie den Antrag und nehmen die Person als Mitglied auf.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (wartet != null) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Ein Antrag wartet auf Ihre Prüfung", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(wartet.name, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Der Antrag liegt nur im Arbeitsspeicher. Wird die App vorher beendet, geht er verloren und muss neu ausgefüllt werden.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Button(onClick = onPruefen, modifier = Modifier.fillMaxWidth()) { Text("Prüfen und aufnehmen") }
                }
            }
        }
        Button(onClick = onNeu, modifier = Modifier.fillMaxWidth(), enabled = wartet == null) { Text("Neuen Antrag aufnehmen") }
        if (wartet != null) Text("Bitte zuerst den wartenden Antrag aufnehmen oder verwerfen.", style = MaterialTheme.typography.bodySmall)
        OutlinedButton(
            onClick = { exporter.pdfSchreiber("Aufnahmeantrag-leer.pdf") { out -> model.antragLeerSchreiben(out) } },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Leeres Antragsformular als PDF speichern") }
        Text(
            if (model.antragVorlageName() != null) "Es wird Ihre eigene Vorlage „${model.antragVorlageName()}“ gespeichert."
            else "Es wird das von der App erzeugte Formular gespeichert. Eine eigene Vorlage können Sie in den Einstellungen für Anträge hinterlegen.",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedButton(onClick = onEinstellungen, modifier = Modifier.fillMaxWidth()) { Text("Einstellungen für Anträge") }
        Text(
            "Aufgenommene Anträge liegen als PDF in den Dokumenten (Ordner „Digitale Aufnahmeanträge“) und am Mitglied. " +
                "Abgelehnte Anträge werden nicht aufbewahrt.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    info?.let { text ->
        Aktionsdialog(titel = "Hinweis", onDismiss = { info = null }, inhalt = { Text(text) }, aktionen = { TextButton(onClick = { info = null }) { Text("OK") } })
    }
}

// ------------------------------------------------------------------ Ausfüllen durch das neue Mitglied

@Composable
private fun Ueberschrift(text: String) = Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))

@Composable
private fun Unterschriftsfeld(titel: String, u: Unterschrift?, fehler: String?, onNeu: (Unterschrift) -> Unit) {
    var offen by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(titel, style = MaterialTheme.typography.titleMedium)
        if (u != null && !u.leer) UnterschriftVorschau(u)
        OutlinedButton(onClick = { offen = true }, modifier = Modifier.fillMaxWidth()) {
            Text(if (u != null && !u.leer) "Neu unterschreiben" else "Hier unterschreiben")
        }
        if (fehler != null) Text(fehler, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
    }
    if (offen) UnterschriftDialog(onDismiss = { offen = false }, onFertig = { onNeu(it); offen = false })
}

@Composable
private fun Zeile(name: String, wert: String) {
    if (wert.isBlank()) return
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(name, Modifier.weight(0.4f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(wert, Modifier.weight(0.6f), style = MaterialTheme.typography.bodyLarge)
    }
}

/** Die Angaben des Antrags zum Durchlesen (für das neue Mitglied und für die Prüfung durch den Verein). */
@Composable
private fun AntragUebersicht(a: Antrag, e: AntragEinstellungen, heute: LocalDate) {
    val minder = AntragRegeln.minderjaehrig(a, heute)
    Ueberschrift("Person")
    Zeile("Name", a.name)
    Zeile("Geburtsdatum", if (a.geburtsdatum.isNotBlank()) deDate(a.geburtsdatum) else "")
    Zeile("Anschrift", "${a.strasse} ${a.hausnummer}, ${a.plz} ${a.ort}")
    Zeile("Telefon", a.telefon)
    Zeile("E-Mail", a.email)
    if (minder) {
        Ueberschrift("Gesetzlicher Vertreter")
        Zeile("Name", a.vertreterName)
        Zeile("Beziehung", a.vertreterBeziehung)
        Zeile("Telefon", a.vertreterTelefon)
        Zeile("E-Mail", a.vertreterEmail)
    }
    Ueberschrift("Mitgliedschaft")
    Zeile("Sparte", a.sparte)
    Zeile("Mitgliedsart", AntragEinstellungen.ARTEN[a.mitgliedsart] ?: a.mitgliedsart)
    Zeile("Beitrag", AntragLayout.beitragText(e.beitrag(a.mitgliedsart)))
    Zeile("Eintritt", if (a.eintritt.isNotBlank()) deDate(a.eintritt) else "")
    Zeile("Frühere Vereine", a.vorverein)
    Zeile("Anmerkung", a.notiz)
    Ueberschrift("Zahlung")
    if (a.sepa) {
        Zeile("Zahlungsart", "Lastschrift (SEPA)")
        Zeile("Kontoinhaber", a.kontoinhaber)
        Zeile("IBAN", Iban.gruppiert(a.iban))
        Zeile("BIC", a.bic)
        Zeile("Bank", a.bankname)
    } else Zeile("Zahlungsart", "Überweisung")
}

/**
 * Der Antrag in fünf Schritten, mit großer Schrift für das neue Mitglied. Während des Ausfüllens sind Menü und Zurück-Taste gesperrt;
 * verlassen geht nur über „Abbrechen (Vereinsvertreter)“. [onFertig] wird aufgerufen, wenn der Antrag abgegeben und das Gerät
 * an den Verein zurückgegeben wurde; der Antrag liegt dann in [AppModel.antragWartet].
 */
@Composable
fun AntragAusfuellenScreen(model: AppModel, onFertig: () -> Unit, onAbbruch: () -> Unit) {
    val heute = remember { LocalDate.now() }
    val einst = remember { model.antragEinstellungen() }
    val sparten = remember(model.departments) { model.departments.ifEmpty { listOf("Hauptverein") } }
    val verein = model.vereinsname()
    var a by remember { mutableStateOf(Antrag(eintritt = heute.toString(), sparte = sparten.singleOrNull() ?: "")) }
    var seite by remember { mutableStateOf(AntragRegeln.SEITE_PERSON) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var abgegeben by remember { mutableStateOf(false) }
    var abbrechenFrage by remember { mutableStateOf(false) }
    var satzungAnsicht by remember { mutableStateOf<String?>(null) }

    // Gesperrt: Die Zurück-Geste tut nichts.
    BackHandler(enabled = true) { if (satzungAnsicht != null) satzungAnsicht = null }

    val fehler = if (zeigeFehler) AntragRegeln.fehler(seite, a, heute, sparten) else emptyMap()
    val minder = AntragRegeln.minderjaehrig(a, heute)
    val satzungDok = remember(model.dokumente) {
        model.dokumente.firstOrNull { it.kategorie == "satzung" && it.dateiId != null && it.titel.contains("satzung", ignoreCase = true) }
    }

    Surface(Modifier.fillMaxSize()) {
        val sd = satzungAnsicht
        if (sd != null) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Satzung", Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.titleLarge)
                    Button(onClick = { satzungAnsicht = null }) { Text("Schließen") }
                }
                DokumentAnsichtScreen(model, sd, Modifier.weight(1f))
            }
            return@Surface
        }
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (abgegeben) "Antrag abgegeben" else "Aufnahmeantrag – Schritt $seite von ${AntragRegeln.SEITE_ZUSAMMENFASSUNG}",
                    Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold,
                )
                if (!abgegeben) TextButton(onClick = { abbrechenFrage = true }) { Text("Abbrechen (Vereinsvertreter)") }
            }
            HorizontalDivider()
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier.widthIn(max = 640.dp).fillMaxSize().verticalScroll(rememberScrollState(), enabled = true).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    if (abgegeben) {
                        Text("Vielen Dank!", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Ihr Antrag ist ausgefüllt und unterschrieben. Bitte geben Sie das Gerät jetzt an den Vereinsvertreter zurück. " +
                                "Er prüft den Antrag und nimmt Sie als Mitglied auf.",
                            style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp),
                        )
                    } else when (seite) {
                        AntragRegeln.SEITE_PERSON -> {
                            Ueberschrift("Angaben zur Person")
                            Text("Felder mit * sind Pflicht.", style = MaterialTheme.typography.bodyMedium)
                            Feld("Vorname *", a.vorname, { a = a.copy(vorname = it) }, error = fehler["vorname"])
                            Feld("Nachname *", a.nachname, { a = a.copy(nachname = it) }, error = fehler["nachname"])
                            Auswahl("Geschlecht", GESCHLECHT, a.geschlecht) { a = a.copy(geschlecht = it) }
                            DatumFeld("Geburtsdatum *", a.geburtsdatum, error = fehler["geburtsdatum"]) { a = a.copy(geburtsdatum = it) }
                            Feld("Staatsangehörigkeit", a.staatsangehoerigkeit, { a = a.copy(staatsangehoerigkeit = it) })
                            Feld("Straße *", a.strasse, { a = a.copy(strasse = it) }, error = fehler["strasse"])
                            Feld("Hausnummer *", a.hausnummer, { a = a.copy(hausnummer = it) }, error = fehler["hausnummer"])
                            Feld("Postleitzahl *", a.plz, { a = a.copy(plz = it) }, error = fehler["plz"], keyboard = KeyboardType.Number)
                            Feld("Ort *", a.ort, { a = a.copy(ort = it) }, error = fehler["ort"])
                            Feld("Land", a.land, { a = a.copy(land = it) })
                            Feld("Telefon (freiwillig)", a.telefon, { a = a.copy(telefon = it) }, keyboard = KeyboardType.Phone)
                            Feld("E-Mail (freiwillig)", a.email, { a = a.copy(email = it) }, error = fehler["email"], keyboard = KeyboardType.Email)
                            if (minder && AntragRegeln.datum(a.geburtsdatum) != null) {
                                Ueberschrift("Gesetzlicher Vertreter")
                                Text(
                                    "Da Sie noch nicht 18 Jahre alt sind, muss ein Elternteil oder gesetzlicher Vertreter den Antrag mit unterschreiben.",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Feld("Name des Vertreters *", a.vertreterName, { a = a.copy(vertreterName = it) }, error = fehler["vertreterName"])
                                Auswahl("Beziehung", BEZIEHUNGEN, a.vertreterBeziehung) { a = a.copy(vertreterBeziehung = it) }
                                Feld("Telefon des Vertreters (freiwillig)", a.vertreterTelefon, { a = a.copy(vertreterTelefon = it) }, keyboard = KeyboardType.Phone)
                                Feld("E-Mail des Vertreters (freiwillig)", a.vertreterEmail, { a = a.copy(vertreterEmail = it) }, error = fehler["vertreterEmail"], keyboard = KeyboardType.Email)
                            }
                        }
                        AntragRegeln.SEITE_MITGLIEDSCHAFT -> {
                            Ueberschrift("Mitgliedschaft")
                            Auswahl("Sparte *", sparten.associateWith { it }, a.sparte) { a = a.copy(sparte = it) }
                            if (fehler["sparte"] != null) Text(fehler["sparte"]!!, color = MaterialTheme.colorScheme.error)
                            Auswahl("Mitgliedsart *", AntragEinstellungen.ARTEN, a.mitgliedsart) { a = a.copy(mitgliedsart = it) }
                            if (fehler["mitgliedsart"] != null) Text(fehler["mitgliedsart"]!!, color = MaterialTheme.colorScheme.error)
                            val vorschlag = AntragRegeln.vorschlagArt(AntragRegeln.alter(a.geburtsdatum, heute))
                            if (vorschlag != null && a.mitgliedsart != vorschlag) {
                                Text(
                                    "Hinweis: Für Personen unter 18 Jahren gibt es die Art „${AntragEinstellungen.ARTEN[vorschlag]}“.",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                TextButton(onClick = { a = a.copy(mitgliedsart = vorschlag) }) { Text("Diese Art übernehmen") }
                            }
                            Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                                Column(Modifier.padding(12.dp)) {
                                    Text("Ihr Beitrag", style = MaterialTheme.typography.labelLarge)
                                    Text(AntragLayout.beitragText(einst.beitrag(a.mitgliedsart)), style = MaterialTheme.typography.titleLarge)
                                }
                            }
                            DatumFeld("Eintrittsdatum *", a.eintritt, error = fehler["eintritt"]) { a = a.copy(eintritt = it) }
                            Feld("Frühere Vereine (freiwillig)", a.vorverein, { a = a.copy(vorverein = it) })
                            Feld("Anmerkungen (freiwillig)", a.notiz, { a = a.copy(notiz = it) }, singleLine = false)
                        }
                        AntragRegeln.SEITE_ZAHLUNG -> {
                            Ueberschrift("Zahlung des Beitrags")
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(selected = a.sepa, onClick = { a = a.copy(zahlungsart = "sepa") }, label = { Text("Lastschrift (SEPA)") })
                                FilterChip(selected = !a.sepa, onClick = { a = a.copy(zahlungsart = "transfer") }, label = { Text("Überweisung") })
                            }
                            if (a.sepa) {
                                Feld("Kontoinhaber *", a.kontoinhaber, { a = a.copy(kontoinhaber = it) }, error = fehler["kontoinhaber"],
                                    hinweis = "Name der Person, von deren Konto abgebucht wird")
                                Feld("IBAN *", a.iban, { a = a.copy(iban = it) }, error = fehler["iban"], hinweis = "z. B. DE89 3704 0044 0532 0130 00")
                                Feld("BIC (freiwillig)", a.bic, { a = a.copy(bic = it) }, error = fehler["bic"])
                                Feld("Name der Bank (freiwillig)", a.bankname, { a = a.copy(bankname = it) })
                                Text(mitVerein(AntragEinstellungen.SEPA_TEXT, verein), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                            } else {
                                Text(
                                    "Bitte überweisen Sie den Beitrag nach Aufforderung durch den Verein. Es wird kein Lastschriftmandat erteilt.",
                                    style = MaterialTheme.typography.bodyLarge,
                                )
                            }
                        }
                        AntragRegeln.SEITE_ERKLAERUNG -> {
                            Ueberschrift("Einwilligung und Satzung")
                            Text(mitVerein(einst.datenschutz, verein), style = MaterialTheme.typography.bodyMedium)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(a.datenschutz, { a = a.copy(datenschutz = it) })
                                Text("Ich willige ein.", style = MaterialTheme.typography.bodyLarge)
                            }
                            if (fehler["datenschutz"] != null) Text(fehler["datenschutz"]!!, color = MaterialTheme.colorScheme.error)
                            Text(mitVerein(einst.satzung, verein), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                            if (satzungDok != null) TextButton(onClick = { satzungAnsicht = satzungDok.id }) { Text("Satzung ansehen") }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(a.satzung, { a = a.copy(satzung = it) })
                                Text("Ich erkenne die Satzung an.", style = MaterialTheme.typography.bodyLarge)
                            }
                            if (fehler["satzung"] != null) Text(fehler["satzung"]!!, color = MaterialTheme.colorScheme.error)
                            Ueberschrift("Unterschriften")
                            Unterschriftsfeld("Unterschrift ${a.name.ifBlank { "Antragsteller" }}", a.unterschrift, fehler["unterschrift"]) { a = a.copy(unterschrift = it) }
                            if (minder) Unterschriftsfeld(
                                "Unterschrift gesetzlicher Vertreter (${a.vertreterName})", a.vertreterUnterschrift, fehler["vertreterUnterschrift"],
                            ) { a = a.copy(vertreterUnterschrift = it) }
                            if (AntragRegeln.kontoinhaberMussUnterschreiben(a, heute)) {
                                Text(
                                    "Das Konto gehört einer anderen Person. Der Kontoinhaber unterschreibt das Lastschriftmandat selbst.",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Unterschriftsfeld(
                                    "Unterschrift Kontoinhaber (${a.kontoinhaber})", a.kontoinhaberUnterschrift, fehler["kontoinhaberUnterschrift"],
                                ) { a = a.copy(kontoinhaberUnterschrift = it) }
                            }
                        }
                        else -> {
                            Ueberschrift("Bitte alles noch einmal prüfen")
                            AntragUebersicht(a, einst, heute)
                            Text(
                                "Stimmt etwas nicht, gehen Sie mit „Zurück“ zu der Seite und ändern es. Mit „Antrag abgeben“ ist der Antrag fertig.",
                                style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp),
                            )
                        }
                    }
                }
            }
            HorizontalDivider()
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (abgegeben) {
                    Button(onClick = onFertig, modifier = Modifier.fillMaxWidth()) { Text("Weiter (Vereinsvertreter)") }
                } else {
                    OutlinedButton(
                        onClick = { zeigeFehler = false; seite -= 1 }, enabled = seite > AntragRegeln.SEITE_PERSON, modifier = Modifier.weight(1f),
                    ) { Text("Zurück") }
                    Button(
                        onClick = {
                            val f = AntragRegeln.fehler(seite, a, heute, sparten)
                            if (f.isNotEmpty()) { zeigeFehler = true; return@Button }
                            zeigeFehler = false
                            if (seite == AntragRegeln.SEITE_ZUSAMMENFASSUNG) {
                                model.antragWartet = a
                                abgegeben = true
                            } else {
                                if (seite == AntragRegeln.SEITE_ZAHLUNG - 1 && a.sepa && a.kontoinhaber.isBlank()) a = a.copy(kontoinhaber = a.name)
                                seite += 1
                            }
                        },
                        modifier = Modifier.weight(1f),
                    ) { Text(if (seite == AntragRegeln.SEITE_ZUSAMMENFASSUNG) "Antrag abgeben" else "Weiter") }
                }
            }
        }
    }
    if (abbrechenFrage) {
        Aktionsdialog(
            titel = "Antrag abbrechen?", onDismiss = { abbrechenFrage = false },
            inhalt = { Text("Alle bisherigen Eingaben gehen verloren. Dies ist nur für Vereinsvertreter gedacht.") },
            aktionen = {
                TextButton(onClick = { abbrechenFrage = false }) { Text("Weiter ausfüllen") }
                TextButton(onClick = { abbrechenFrage = false; onAbbruch() }) { Text("Abbrechen (Vereinsvertreter)") }
            },
        )
    }
}

// ------------------------------------------------------------------ Prüfen durch den Verein

/** Der Verein liest den abgegebenen Antrag, sieht Warnungen und nimmt das Mitglied auf oder verwirft den Antrag. */
@Composable
fun AntragPruefenScreen(model: AppModel, onAufgenommen: (String) -> Unit, onVerworfen: () -> Unit, modifier: Modifier = Modifier) {
    val a = model.antragWartet
    if (a == null) {
        Column(modifier.fillMaxSize().padding(16.dp)) {
            Text("Es wartet kein Antrag auf Prüfung.", style = MaterialTheme.typography.bodyLarge)
            TextButton(onClick = onVerworfen) { Text("Zurück") }
        }
        return
    }
    val heute = remember { LocalDate.now() }
    val einst = remember { model.antragEinstellungen() }
    val sparten = remember(model.departments) { model.departments.ifEmpty { listOf("Hauptverein") } }
    var nummer by remember { mutableStateOf(model.naechsteNummer()) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var verwerfenFrage by remember { mutableStateOf(false) }
    val dubletten = remember(a, model.members) { AntragRegeln.dubletten(a, model.members) }
    val offen = AntragRegeln.fehler(AntragRegeln.SEITE_ZUSAMMENFASSUNG, a, heute, sparten)

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Antrag prüfen", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(
            "Die Angaben des Antragstellers sind hier nicht änderbar. Stimmt etwas nicht, nehmen Sie die Person auf und korrigieren sie " +
                "danach im normalen Mitgliedsformular. Bei groben Fehlern: Antrag verwerfen und neu ausfüllen lassen.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (dubletten.isNotEmpty()) {
            Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text("Achtung: möglicherweise schon Mitglied", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
                    dubletten.forEach { Text("${it.firstName} ${it.lastName} (Nr. ${it.number})", style = MaterialTheme.typography.bodyMedium) }
                }
            }
        }
        if (offen.isNotEmpty()) {
            Text("Der Antrag ist unvollständig: ${offen.values.first()}", color = MaterialTheme.colorScheme.error)
        }
        AntragUebersicht(a, einst, heute)
        Ueberschrift("Unterschriften")
        a.unterschrift?.let { Text("Antragsteller"); UnterschriftVorschau(it) }
        a.vertreterUnterschrift?.let { Text("Gesetzlicher Vertreter"); UnterschriftVorschau(it) }
        a.kontoinhaberUnterschrift?.let { Text("Kontoinhaber"); UnterschriftVorschau(it) }
        Ueberschrift("Aufnahme")
        Feld("Mitgliedsnummer", nummer, { nummer = it }, hinweis = "Vorschlag der App; Sie können sie ändern.")
        Button(
            onClick = {
                model.antragAufnehmen(a, nummer) { r, f ->
                    if (r != null) onAufgenommen(r.mitgliedId) else meldung = f ?: "Die Aufnahme ist fehlgeschlagen."
                }
            },
            enabled = !model.busy && offen.isEmpty(), modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        ) { Text("Als Mitglied aufnehmen") }
        OutlinedButton(onClick = { verwerfenFrage = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Antrag verwerfen") }
    }
    meldung?.let { text ->
        Aktionsdialog(titel = "Aufnahme nicht möglich", onDismiss = { meldung = null }, inhalt = { Text(text) }, aktionen = { TextButton(onClick = { meldung = null }) { Text("OK") } })
    }
    if (verwerfenFrage) {
        Aktionsdialog(
            titel = "Antrag verwerfen?", onDismiss = { verwerfenFrage = false },
            inhalt = { Text("Der Antrag wird gelöscht und nirgends aufbewahrt.") },
            aktionen = {
                TextButton(onClick = { verwerfenFrage = false }) { Text("Abbrechen") }
                TextButton(onClick = { verwerfenFrage = false; model.antragWartet = null; onVerworfen() }) { Text("Verwerfen") }
            },
        )
    }
}

// ------------------------------------------------------------------ Einstellungen

/** Beiträge je Mitgliedsart, Texte und eigene Leervorlage. */
@Composable
fun AntragEinstellungenScreen(model: AppModel, modifier: Modifier = Modifier) {
    val start = remember { model.antragEinstellungen() }
    var beitraege by remember { mutableStateOf(start.beitraege) }
    var datenschutz by remember { mutableStateOf(start.datenschutz) }
    var satzung by remember { mutableStateOf(start.satzung) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var vorlageName by remember { mutableStateOf(model.antragVorlageName()) }
    val aktuell = start.copy(beitraege = beitraege, datenschutz = datenschutz, satzung = satzung)
    val fehler = de.vereinsmanager.core.antrag.AntragEinstellungenStore.pruefen(aktuell)
    val geaendert = beitraege != start.beitraege || datenschutz != start.datenschutz || satzung != start.satzung

    val waehler = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) model.antragVorlageWaehlen(uri) { f ->
            vorlageName = model.antragVorlageName()
            meldung = f ?: "Ihre Vorlage ist hinterlegt."
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Beiträge je Mitgliedsart", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "Diese Werte zeigt der Antrag dem neuen Mitglied und trägt sie beim Aufnehmen als Beitrag ein.",
                    style = MaterialTheme.typography.bodySmall,
                )
                AntragEinstellungen.ARTEN.forEach { (art, name) ->
                    val v = beitraege[art] ?: BeitragsVorgabe("", "monthly")
                    Text(name, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                        Box(Modifier.weight(1f)) {
                            Feld("Betrag in €", v.betrag, { beitraege = beitraege + (art to v.copy(betrag = it)) },
                                error = if (zeigeFehler) fehler["beitrag.$art"] else null, keyboard = KeyboardType.Decimal)
                        }
                        Box(Modifier.weight(1f)) {
                            Auswahl("Zahlweise", AntragEinstellungen.PERIODEN, v.periode) { beitraege = beitraege + (art to v.copy(periode = it)) }
                        }
                    }
                }
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Texte im Antrag", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "„{verein}“ wird durch den Vereinsnamen ersetzt. Ich bin kein Rechtsanwalt: Bitte lassen Sie die Texte " +
                        "von jemandem prüfen, der sich mit Vereins- und Datenschutzrecht auskennt.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Feld("Einwilligung zur Datenverarbeitung", datenschutz, { datenschutz = it }, singleLine = false)
                TextButton(onClick = { datenschutz = AntragEinstellungen.STANDARD_DATENSCHUTZ }) { Text("Standardtext wiederherstellen") }
                Feld("Anerkennung der Satzung", satzung, { satzung = it }, singleLine = false)
                TextButton(onClick = { satzung = AntragEinstellungen.STANDARD_SATZUNG }) { Text("Standardtext wiederherstellen") }
            }
        }
        Button(
            onClick = {
                if (fehler.isNotEmpty()) { zeigeFehler = true; return@Button }
                model.antragEinstellungenSpeichern(aktuell) { f -> meldung = f ?: "Gespeichert." }
            },
            enabled = geaendert && !model.busy, modifier = Modifier.fillMaxWidth(),
        ) { Text("Speichern") }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Eigene Leervorlage", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "Hier können Sie ein eigenes Antragsformular als PDF hinterlegen. Es ersetzt das von der App erzeugte leere Formular, " +
                        "wenn Sie „Leeres Antragsformular als PDF speichern“ wählen. Der am Gerät ausgefüllte Antrag wird weiterhin von der App erzeugt.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(vorlageName?.let { "Hinterlegt: $it" } ?: "Keine eigene Vorlage hinterlegt.", style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = { waehler.launch("application/pdf") }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (vorlageName == null) "PDF-Vorlage hochladen" else "Andere Vorlage hochladen")
                }
                if (vorlageName != null) {
                    TextButton(onClick = {
                        model.antragVorlageEntfernen { f -> vorlageName = model.antragVorlageName(); meldung = f ?: "Die eigene Vorlage wurde entfernt." }
                    }) { Text("Eigene Vorlage entfernen") }
                }
            }
        }
    }
    meldung?.let { text ->
        Aktionsdialog(titel = "Hinweis", onDismiss = { meldung = null }, inhalt = { Text(text) }, aktionen = { TextButton(onClick = { meldung = null }) { Text("OK") } })
    }
}
