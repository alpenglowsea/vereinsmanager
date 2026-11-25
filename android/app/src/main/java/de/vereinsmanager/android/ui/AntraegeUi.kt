package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
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
import de.vereinsmanager.core.antrag.AntragEinstellungenStore
import de.vereinsmanager.core.antrag.AntragRegeln
import de.vereinsmanager.core.antrag.BeitragsVorgabe
import de.vereinsmanager.core.members.MitgliedsArt
import de.vereinsmanager.core.members.Mitgliedsarten
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.members.Iban
import java.time.LocalDate

private val BEZIEHUNGEN = linkedMapOf("Mutter" to "Mutter", "Vater" to "Vater", "Vormund" to "Vormund", "Sonstige" to "Sonstige/r")
private val GESCHLECHT = linkedMapOf("none" to "keine Angabe", "w" to "weiblich", "m" to "männlich", "d" to "divers")

private fun mitVerein(text: String, verein: String) = text.replace("{verein}", verein.ifBlank { "dem Verein" })

// ------------------------------------------------------------------ Ausfüllen durch das neue Mitglied

@Composable
private fun Ueberschrift(text: String) = Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp, bottom = 4.dp))

/** Weiche Karte (Wiese-Stil) um einen Abschnitt; mit [farbe] als eingefärbte Fläche statt umrandeter Karte. */
@Composable
private fun Karte(modifier: Modifier = Modifier, farbe: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val s = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(28.dp), color = farbe ?: s.surface, border = if (farbe == null) BorderStroke(1.5.dp, s.outlineVariant) else null,
        modifier = modifier.fillMaxWidth().padding(vertical = 5.dp),
    ) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp), content = content) }
}

@Composable
private fun Abschnitt(titel: String, content: @Composable ColumnScope.() -> Unit) = Karte {
    Text(titel, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 4.dp))
    content()
}

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
    Abschnitt("Person") {
        Zeile("Name", a.name)
        Zeile("Geburtsdatum", if (a.geburtsdatum.isNotBlank()) deDate(a.geburtsdatum) else "")
        Zeile("Anschrift", "${a.strasse} ${a.hausnummer}, ${a.plz} ${a.ort}")
        Zeile("Telefon", a.telefon)
        Zeile("E-Mail", a.email)
    }
    if (minder) Abschnitt("Gesetzlicher Vertreter") {
        Zeile("Name", a.vertreterName)
        Zeile("Beziehung", a.vertreterBeziehung)
        Zeile("Telefon", a.vertreterTelefon)
        Zeile("E-Mail", a.vertreterEmail)
    }
    Abschnitt("Mitgliedschaft") {
        Zeile("Sparte", a.sparte)
        Zeile("Mitgliedsart", e.artName(a.mitgliedsart))
        Zeile("Beitrag", AntragLayout.beitragText(e.beitrag(a.mitgliedsart)))
        Zeile("Eintritt", if (a.eintritt.isNotBlank()) deDate(a.eintritt) else "")
        Zeile("Frühere Vereine", a.vorverein)
        Zeile("Anmerkung", a.notiz)
    }
    Abschnitt("Zahlung") {
        if (a.sepa) {
            Zeile("Zahlungsart", "Lastschrift (SEPA)")
            Zeile("Kontoinhaber", a.kontoinhaber)
            Zeile("IBAN", Iban.gruppiert(a.iban))
            Zeile("BIC", a.bic)
            Zeile("Bank", a.bankname)
        } else Zeile("Zahlungsart", "Überweisung")
    }
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
    var a by remember { mutableStateOf(Antrag(eintritt = heute.toString(), sparte = sparten.singleOrNull() ?: "", mitgliedsart = einst.startArt)) }
    var seite by remember { mutableStateOf(AntragRegeln.SEITE_PERSON) }
    // Kontoinhaber von Hand geändert? Bis dahin folgt das Feld dem Vorschlag (T-265)
    var inhaberVonHand by remember { mutableStateOf(false) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var abgegeben by remember { mutableStateOf(false) }
    var abbrechenFrage by remember { mutableStateOf(false) }
    var ansicht by remember { mutableStateOf<Pair<String, String>?>(null) } // Titel und Dokument-Kennung der gerade gezeigten Beilage

    // Gesperrt: Die Zurück-Geste tut nichts.
    BackHandler(enabled = true) { if (ansicht != null) ansicht = null }

    val fehler = if (zeigeFehler) AntragRegeln.fehler(seite, a, heute, sparten, einst.arten) else emptyMap()
    val minder = AntragRegeln.minderjaehrig(a, heute)
    val satzungDok = remember(model.dokumente, model.stand) { model.antragBeilage(AntragEinstellungenStore.Beilage.SATZUNG) }
    val datenschutzDok = remember(model.dokumente, model.stand) { model.antragBeilage(AntragEinstellungenStore.Beilage.DATENSCHUTZ) }

    Surface(Modifier.fillMaxSize()) {
        val gezeigt = ansicht
        if (gezeigt != null) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(gezeigt.first, Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                    Button(onClick = { ansicht = null }) { Text("Schließen") }
                }
                DokumentAnsichtScreen(model, gezeigt.second, Modifier.weight(1f))
            }
            return@Surface
        }
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (abgegeben) "Antrag abgegeben" else "Aufnahmeantrag",
                    Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false,
                )
                if (!abgegeben) TextButton(onClick = { abbrechenFrage = true }) {
                    Text("Abbrechen\n(Vereinsvertreter)", style = MaterialTheme.typography.labelMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
            if (!abgegeben) Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (i in AntragRegeln.SEITE_PERSON..AntragRegeln.SEITE_ZUSAMMENFASSUNG) {
                        val farbe = when {
                            i < seite -> MaterialTheme.colorScheme.primary
                            i == seite -> MaterialTheme.colorScheme.tertiaryContainer
                            else -> MaterialTheme.colorScheme.outlineVariant
                        }
                        Box(Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)).background(farbe))
                    }
                }
                Text(
                    "Schritt $seite von ${AntragRegeln.SEITE_ZUSAMMENFASSUNG} · " + when (seite) {
                        AntragRegeln.SEITE_PERSON -> "Person"; AntragRegeln.SEITE_MITGLIEDSCHAFT -> "Mitgliedschaft"
                        AntragRegeln.SEITE_ZAHLUNG -> "Zahlung"; AntragRegeln.SEITE_ERKLAERUNG -> "Erklärungen"; else -> "Prüfen"
                    },
                    style = MaterialTheme.typography.titleSmall, maxLines = 1, softWrap = false, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier.widthIn(max = 640.dp).fillMaxSize().verticalScroll(rememberScrollState(), enabled = true).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    if (abgegeben) Karte(farbe = MaterialTheme.colorScheme.primaryContainer) {
                        Text("Vielen Dank!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(
                            "Ihr Antrag ist ausgefüllt und unterschrieben. Bitte geben Sie das Gerät jetzt an den Vereinsvertreter zurück. " +
                                "Er prüft den Antrag und nimmt Sie als Mitglied auf.",
                            style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    } else if (seite == AntragRegeln.SEITE_ZUSAMMENFASSUNG) {
                        Ueberschrift("Bitte alles noch einmal prüfen")
                        AntragUebersicht(a, einst, heute)
                        Text(
                            "Stimmt etwas nicht, gehen Sie mit „Zurück“ zu der Seite und ändern es. Mit „Antrag abgeben“ ist der Antrag fertig.",
                            style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp),
                        )
                    } else Karte { when (seite) {
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
                            Auswahl("Mitgliedsart *", einst.artenAuswahl, a.mitgliedsart) { a = a.copy(mitgliedsart = it) }
                            if (fehler["mitgliedsart"] != null) Text(fehler["mitgliedsart"]!!, color = MaterialTheme.colorScheme.error)
                            val vorschlag = AntragRegeln.vorschlagArt(AntragRegeln.alter(a.geburtsdatum, heute), einst.arten)
                            if (vorschlag != null && a.mitgliedsart != vorschlag) {
                                Text(
                                    "Hinweis: Für Personen unter 18 Jahren gibt es die Art „${einst.artName(vorschlag)}“.",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                TextButton(onClick = { a = a.copy(mitgliedsart = vorschlag) }) { Text("Diese Art übernehmen") }
                            }
                            Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.tertiaryContainer).padding(16.dp)) {
                                Text("Ihr Beitrag", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onTertiaryContainer)
                                Text(AntragLayout.beitragText(einst.beitrag(a.mitgliedsart)), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onTertiaryContainer)
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
                                Feld("Kontoinhaber *", a.kontoinhaber, { inhaberVonHand = true; a = a.copy(kontoinhaber = it) }, error = fehler["kontoinhaber"],
                                    hinweis = if (minder) "Meist der gesetzliche Vertreter; bitte ändern, wenn das Konto einer anderen Person gehört" else "Name der Person, von deren Konto abgebucht wird")
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
                            if (datenschutzDok != null) TextButton(onClick = { ansicht = "Datenschutz" to datenschutzDok.id }) { Text("Datenschutz-Vordruck ansehen") }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(a.datenschutz, { a = a.copy(datenschutz = it) })
                                Text("Ich willige ein.", style = MaterialTheme.typography.bodyLarge)
                            }
                            if (fehler["datenschutz"] != null) Text(fehler["datenschutz"]!!, color = MaterialTheme.colorScheme.error)
                            Text(mitVerein(einst.satzung, verein), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                            if (satzungDok != null) TextButton(onClick = { ansicht = "Satzung" to satzungDok.id }) { Text("Satzung ansehen") }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(a.satzung, { a = a.copy(satzung = it) })
                                Text("Ich erkenne die Satzung an.", style = MaterialTheme.typography.bodyLarge)
                            }
                            if (fehler["satzung"] != null) Text(fehler["satzung"]!!, color = MaterialTheme.colorScheme.error)
                            Ueberschrift("Unterschriften")
                            // Unter 18 unterschreibt allein der gesetzliche Vertreter
                            if (minder) Unterschriftsfeld(
                                "Unterschrift gesetzlicher Vertreter (${a.vertreterName})", a.vertreterUnterschrift, fehler["vertreterUnterschrift"],
                            ) { a = a.copy(vertreterUnterschrift = it) }
                            else Unterschriftsfeld("Unterschrift ${a.name.ifBlank { "Antragsteller" }}", a.unterschrift, fehler["unterschrift"]) { a = a.copy(unterschrift = it) }
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
                    } }
                }
            }
            HorizontalDivider()
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (abgegeben) {
                    Button(onClick = onFertig, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Weiter (Vereinsvertreter)") }
                } else {
                    OutlinedButton(
                        onClick = { zeigeFehler = false; seite -= 1 }, enabled = seite > AntragRegeln.SEITE_PERSON, modifier = Modifier.weight(1f).height(52.dp),
                    ) { Text("Zurück") }
                    Button(
                        onClick = {
                            val f = AntragRegeln.fehler(seite, a, heute, sparten, einst.arten)
                            if (f.isNotEmpty()) { zeigeFehler = true; return@Button }
                            zeigeFehler = false
                            if (seite == AntragRegeln.SEITE_ZUSAMMENFASSUNG) {
                                model.antragWartet = a
                                abgegeben = true
                            } else {
                                if (seite == AntragRegeln.SEITE_PERSON && a.mitgliedsart == einst.startArt) {
                                    AntragRegeln.vorschlagArt(AntragRegeln.alter(a.geburtsdatum, heute), einst.arten)?.let { a = a.copy(mitgliedsart = it) }
                                }
                                // Vorschlag bei jedem Weg auf die Zahlungsseite neu, solange nicht von Hand geändert
                                // (oder das Feld leer ist); bei unter 18 der Vertreter (T-258, T-265)
                                if (seite == AntragRegeln.SEITE_ZAHLUNG - 1 && a.sepa && (!inhaberVonHand || a.kontoinhaber.isBlank()))
                                    a = a.copy(kontoinhaber = AntragRegeln.kontoinhaberVorschlag(a, heute))
                                seite += 1
                            }
                        },
                        modifier = Modifier.weight(1f).height(52.dp),
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
    val offen = AntragRegeln.fehler(AntragRegeln.SEITE_ZUSAMMENFASSUNG, a, heute, sparten, einst.arten)

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Antrag prüfen", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 4.dp))
        Text(
            "Die Angaben des Antragstellers sind hier nicht änderbar. Stimmt etwas nicht, nehmen Sie die Person auf und korrigieren sie " +
                "danach im normalen Mitgliedsformular. Bei groben Fehlern: Antrag verwerfen und neu ausfüllen lassen.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 6.dp),
        )
        if (dubletten.isNotEmpty()) {
            Karte(farbe = MaterialTheme.colorScheme.errorContainer) {
                Text("Achtung: möglicherweise schon Mitglied", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onErrorContainer)
                dubletten.forEach { Text("${it.firstName} ${it.lastName} (Nr. ${it.number})", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onErrorContainer) }
            }
        }
        if (offen.isNotEmpty()) {
            Karte(farbe = MaterialTheme.colorScheme.errorContainer) {
                Text("Der Antrag ist unvollständig: ${offen.values.first()}", color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }
        AntragUebersicht(a, einst, heute)
        if (a.unterschrift != null || a.vertreterUnterschrift != null || a.kontoinhaberUnterschrift != null) Abschnitt("Unterschriften") {
            a.unterschrift?.let { Text("Antragsteller", style = MaterialTheme.typography.labelLarge); UnterschriftVorschau(it) }
            a.vertreterUnterschrift?.let { Text("Gesetzlicher Vertreter", style = MaterialTheme.typography.labelLarge); UnterschriftVorschau(it) }
            a.kontoinhaberUnterschrift?.let { Text("Kontoinhaber", style = MaterialTheme.typography.labelLarge); UnterschriftVorschau(it) }
        }
        Abschnitt("Aufnahme") {
            Feld("Mitgliedsnummer", nummer, { nummer = it }, hinweis = "Vorschlag der App; Sie können sie ändern.")
        }
        Button(
            onClick = {
                model.antragAufnehmen(a, nummer) { r, f ->
                    if (r != null) onAufgenommen(r.mitgliedId) else meldung = f ?: "Die Aufnahme ist fehlgeschlagen."
                }
            },
            enabled = !model.busy && offen.isEmpty(), modifier = Modifier.fillMaxWidth().height(52.dp).padding(top = 0.dp),
        ) { Text("Als Mitglied aufnehmen") }
        OutlinedButton(onClick = { verwerfenFrage = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Antrag verwerfen") }
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

/**
 * Entwurf der Beiträge und Antragstexte. Liegt im Einstellungsbildschirm, damit dessen feste Speichern-Leiste
 * unten (sichtbar, sobald etwas geändert ist) ihn speichern kann; vorher stand der Knopf mitten in der Seite
 * und wurde übersehen (T-376).
 */
class AntragEntwurf(start: AntragEinstellungen) {
    var start: AntragEinstellungen by mutableStateOf(start)
    var beitraege: Map<String, BeitragsVorgabe> by mutableStateOf(start.beitraege)
    var datenschutz: String by mutableStateOf(start.datenschutz)
    var satzung: String by mutableStateOf(start.satzung)
    /** Mitgliedsarten (seit 25.11.2026 bearbeitbar) */
    var arten: List<MitgliedsArt> by mutableStateOf(start.arten)
    /** Beim Löschen einer Art vorgemerkte Umzüge (von → nach); ausgeführt beim Speichern. */
    var verschiebungen: Map<String, String> by mutableStateOf(emptyMap())
    var zeigeFehler: Boolean by mutableStateOf(false)
    var meldung: String? by mutableStateOf(null)
    /** Vorgaben nur für nicht gelöschte, nicht beitragsfreie Arten (wie Desktop). */
    val aktuell: AntragEinstellungen get() {
        val mitVorgabe = Mitgliedsarten.aktive(arten).filter { !it.beitragsfrei }.map { it.id }
        return start.copy(
            beitraege = mitVorgabe.associateWith { beitraege[it] ?: BeitragsVorgabe("0", "monthly") },
            datenschutz = datenschutz, satzung = satzung, arten = arten,
        )
    }
    val fehler: Map<String, String> get() = AntragEinstellungenStore.pruefen(aktuell) + Mitgliedsarten.pruefen(arten)
    val geaendert: Boolean get() = aktuell.beitraege != start.beitraege || datenschutz != start.datenschutz || satzung != start.satzung ||
        arten != start.arten || verschiebungen.isNotEmpty()

    fun speichern(model: AppModel) {
        if (fehler.isNotEmpty()) { zeigeFehler = true; meldung = "Bitte die markierten Angaben prüfen."; return }
        val neu = aktuell
        model.mitgliedsartenSpeichern(neu, verschiebungen) { f ->
            if (f == null) { start = neu; beitraege = neu.beitraege; verschiebungen = emptyMap(); zeigeFehler = false; meldung = "Gespeichert." } else meldung = f
        }
    }
}

@Composable
fun rememberAntragEntwurf(model: AppModel): AntragEntwurf = remember { AntragEntwurf(model.antragEinstellungen()) }

/** Beiträge je Mitgliedsart, Texte im Antrag und das leere Formular – als Karten in den Einstellungen. Gespeichert wird über die Leiste unten. */
@Composable
fun AntragEinstellungenKarten(model: AppModel, e: AntragEntwurf) {
    var meldung by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        MitgliedsartenKarte(model, e)
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Texte im Antrag", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                Text(
                    "„{verein}“ wird durch den Vereinsnamen ersetzt. Ich bin kein Rechtsanwalt: Bitte lassen Sie die Texte " +
                        "von jemandem prüfen, der sich mit Vereins- und Datenschutzrecht auskennt.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Feld("Einwilligung zur Datenverarbeitung", e.datenschutz, { e.datenschutz = it }, singleLine = false)
                TextButton(onClick = { e.datenschutz = AntragEinstellungen.STANDARD_DATENSCHUTZ }) { Text("Standardtext wiederherstellen") }
                Feld("Anerkennung der Satzung", e.satzung, { e.satzung = it }, singleLine = false)
                TextButton(onClick = { e.satzung = AntragEinstellungen.STANDARD_SATZUNG }) { Text("Standardtext wiederherstellen") }
            }
        }
        BeilagenKarte(model, onMeldung = { meldung = it })
        WieseKarte(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Leeres Antragsformular", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                Text(
                    "Zum Ausdrucken, wenn jemand den Antrag lieber auf Papier ausfüllt. Mit Ihrem Briefpapier, falls oben hinterlegt.",
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedButton(
                    onClick = { exporter.pdfSchreiber("Aufnahmeantrag-leer.pdf") { out -> model.antragLeerSchreiben(out) } },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Leeres Antragsformular als PDF speichern") }
            }
        }
    }
    (meldung ?: info)?.let { text ->
        Aktionsdialog(titel = "Hinweis", onDismiss = { meldung = null; info = null }, inhalt = { Text(text) }, aktionen = { TextButton(onClick = { meldung = null; info = null }) { Text("OK") } })
    }
}

/** Satzung und Datenschutz-Vordruck als PDF hinterlegen; das neue Mitglied öffnet sie in Schritt 4 des Antrags. */
@Composable
private fun BeilagenKarte(model: AppModel, onMeldung: (String) -> Unit) {
    var waehle by remember { mutableStateOf<AntragEinstellungenStore.Beilage?>(null) }
    var zeige by remember { mutableStateOf<Pair<String, String>?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val b = waehle
        if (uri != null && b != null) model.antragBeilageHochladen(b, uri) { f -> onMeldung(if (f == null) "${b.titel} hinterlegt." else "Die Datei lässt sich nicht übernehmen: $f") }
        waehle = null
    }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Satzung und Datenschutz-Vordruck", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Beides als PDF (höchstens 10 MB). Das neue Mitglied kann die Dateien in Schritt 4 des Aufnahmeantrags öffnen. " +
                    "Ein neuer Upload legt eine neue Fassung mit Datum im Titel im Dokumentenarchiv ab; frühere Fassungen bleiben dort erhalten.",
                style = MaterialTheme.typography.bodySmall,
            )
            AntragEinstellungenStore.Beilage.entries.forEach { b ->
                val dok = remember(model.dokumente, model.stand) { model.antragBeilage(b) }
                Text(b.titel, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                Text(
                    if (dok == null) "Noch nichts hinterlegt." else "Aktuell: ${dok.titel} (${dok.dateiName})",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                KompaktKnopf(
                    if (dok == null) "PDF hochladen" else "Neue Fassung hochladen",
                    { waehle = b; launcher.launch(arrayOf("application/pdf")) }, Modifier.fillMaxWidth(), enabled = !model.busy,
                )
                if (dok != null) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        KompaktKnopf("Ansehen", { zeige = b.titel to dok.id }, Modifier.weight(1f))
                        KompaktKnopf("Entfernen", { model.antragBeilageEntfernen(b) { f -> onMeldung(f ?: "${b.titel} entfernt.") } }, Modifier.weight(1f), enabled = !model.busy)
                    }
                }
            }
        }
    }
    val z = zeige
    if (z != null) {
        androidx.compose.ui.window.Dialog(
            onDismissRequest = { zeige = null },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
        ) {
            Surface(Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                    Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(z.first, Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                        Button(onClick = { zeige = null }) { Text("Schließen") }
                    }
                    DokumentAnsichtScreen(model, z.second, Modifier.weight(1f))
                }
            }
        }
    }
}

/** Auswahlfeld, das wie ein Textfeld aussieht (gleiche Höhe, schwebende Beschriftung) – damit es neben einem [Feld] gleich groß ist. */
@Composable
private fun AuswahlFeld(label: String, options: Map<String, String>, value: String, onChange: (String) -> Unit) {
    var offen by remember { mutableStateOf(false) }
    Box {
        androidx.compose.material3.OutlinedTextField(
            value = options[value] ?: value, onValueChange = {}, readOnly = true, singleLine = true, label = { Text(label) },
            trailingIcon = { androidx.compose.material3.Icon(Lucide.ChevronDown, null, Modifier.size(18.dp)) },
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f),
            ),
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        )
        Box(Modifier.matchParentSize().clickable { offen = true })
        androidx.compose.material3.DropdownMenu(offen, { offen = false }) {
            options.forEach { (k, v) -> androidx.compose.material3.DropdownMenuItem(text = { Text(v) }, onClick = { onChange(k); offen = false }) }
        }
    }
}

/**
 * Mitgliedsarten bearbeiten (Wunsch Johannes, 25.11.2026), wie am Desktop: Name, Beitragsvorgabe, drei Schalter, Reihenfolge,
 * neue Art, löschen mit Vorschlag zum Verschieben. Gilt erst mit „Speichern“ in der Leiste unten.
 */
@Composable
private fun MitgliedsartenKarte(model: AppModel, e: AntragEntwurf) {
    val aktiv = Mitgliedsarten.aktive(e.arten)
    val geloeschte = e.arten.filter { it.geloescht }
    val fehler = if (e.zeigeFehler) e.fehler else emptyMap()
    var neuName by remember { mutableStateOf("") }
    var loeschFrage by remember { mutableStateOf<Pair<String, String>?>(null) } // Art, Ziel
    fun anzahl(id: String): Int {
        var n = if (e.verschiebungen.containsKey(id)) 0 else Mitgliedsarten.anzahl(model.members, id)
        for ((von, nach) in e.verschiebungen) if (nach == id) n += Mitgliedsarten.anzahl(model.members, von)
        return n
    }
    fun aendern(id: String, f: (MitgliedsArt) -> MitgliedsArt) { e.arten = e.arten.map { if (it.id == id) f(it) else it } }
    fun loeschen(id: String, ziel: String?) {
        e.arten = Mitgliedsarten.loeschen(e.arten, id)
        if (ziel != null) e.verschiebungen = e.verschiebungen + (id to ziel)
        loeschFrage = null
    }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Mitgliedsarten", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "Die Arten, die Ihr Verein führt, mit ihrem Beitrag. Der Beitrag wird beim Anlegen eines neuen Mitglieds und im Aufnahmeantrag vorgeschlagen; " +
                    "bestehende Mitglieder bleiben unverändert. Die erste Art ist die Vorgabe für neue Mitglieder. Ein neuer Name gilt überall in der App.",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "beitragsfrei: zahlt keinen Beitrag (z. B. Ehrenmitglied) · unter 18 vorschlagen: wird Kindern und Jugendlichen vorgeschlagen (nur eine Art) · " +
                    "im Aufnahmeantrag: im Antrag wählbar",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            aktiv.forEachIndexed { i, a ->
                val n = anzahl(a.id)
                androidx.compose.material3.HorizontalDivider(Modifier.padding(vertical = 6.dp))
                Feld("Name", a.name, { t -> aendern(a.id) { it.copy(name = t.take(60)) } }, error = fehler["name.${a.id}"])
                Text(
                    (if (n == 1) "1 Mitglied" else "$n Mitglieder") + if (i == 0) " · Vorgabe für neue Mitglieder" else "",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (!a.beitragsfrei) {
                    val v = e.beitraege[a.id] ?: BeitragsVorgabe("0", "monthly")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                        Box(Modifier.weight(1f)) {
                            Feld("Betrag in €", v.betrag, { e.beitraege = e.beitraege + (a.id to v.copy(betrag = it)) },
                                error = fehler["beitrag.${a.id}"], keyboard = KeyboardType.Decimal)
                        }
                        Box(Modifier.weight(1f)) {
                            AuswahlFeld("Zahlweise", AntragEinstellungen.PERIODEN, v.periode) { e.beitraege = e.beitraege + (a.id to v.copy(periode = it)) }
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(a.beitragsfrei, { an -> aendern(a.id) { it.copy(beitragsfrei = an) } })
                    Text("beitragsfrei", style = MaterialTheme.typography.bodyMedium)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(a.unter18, { an -> e.arten = e.arten.map { x -> if (x.id == a.id) x.copy(unter18 = an) else if (an) x.copy(unter18 = false) else x } })
                    Text("unter 18 vorschlagen", style = MaterialTheme.typography.bodyMedium)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(a.imAntrag, { an -> aendern(a.id) { it.copy(imAntrag = an) } })
                    Text("im Aufnahmeantrag", style = MaterialTheme.typography.bodyMedium)
                }
                // Wie bei den Sparten: schmale Pfeilknöpfe, damit „Löschen“ in derselben Zeile Platz hat.
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    KompaktKnopf("▲", { e.arten = Mitgliedsarten.verschieben(e.arten, a.id, -1) }, Modifier.width(44.dp), enabled = i > 0)
                    KompaktKnopf("▼", { e.arten = Mitgliedsarten.verschieben(e.arten, a.id, 1) }, Modifier.width(44.dp), enabled = i < aktiv.lastIndex)
                    TextButton(
                        onClick = { if (n == 0) loeschen(a.id, null) else loeschFrage = a.id to (aktiv.firstOrNull { it.id != a.id }?.id ?: "") },
                        enabled = aktiv.size > 1,
                    ) { Text("Löschen", maxLines = 1, softWrap = false, color = if (aktiv.size > 1) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
            fehler["liste"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            androidx.compose.material3.HorizontalDivider(Modifier.padding(vertical = 6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) { Feld("Neue Art, z. B. Senioren", neuName, { neuName = it.take(60) }) }
                OutlinedButton(onClick = {
                    val n = Mitgliedsarten.neu(e.arten, neuName)
                    e.arten = e.arten + n
                    e.beitraege = e.beitraege + (n.id to BeitragsVorgabe("0", "monthly"))
                    neuName = ""
                }, enabled = neuName.isNotBlank()) { Text("Hinzufügen") }
            }
            if (geloeschte.isNotEmpty()) {
                Text("Gelöschte Arten", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 6.dp))
                geloeschte.forEach { a ->
                    val n = Mitgliedsarten.anzahl(model.members, a.id)
                    val ziel = e.verschiebungen[a.id]
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            a.name + when {
                                ziel != null -> " – ${if (n == 1) "1 Mitglied wird" else "$n Mitglieder werden"} beim Speichern nach „${Mitgliedsarten.name(e.arten, ziel)}“ verschoben"
                                n > 0 -> " – ${if (n == 1) "1 Mitglied" else "$n Mitglieder"} noch so eingetragen"
                                else -> ""
                            },
                            style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = {
                            e.arten = Mitgliedsarten.wiederherstellen(e.arten, a.id)
                            e.verschiebungen = e.verschiebungen - a.id
                        }) { Text("Wiederherstellen") }
                    }
                }
            }
        }
    }
    loeschFrage?.let { (id, ziel) ->
        val art = e.arten.firstOrNull { it.id == id } ?: return@let
        val n = anzahl(id)
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { loeschFrage = null },
            title = { Text("„${art.name}“ löschen?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        (if (n == 1) "Ein Mitglied ist" else "$n Mitglieder sind") + " als „${art.name}“ eingetragen. Sollen sie in eine andere Art verschoben werden? " +
                            "Ohne Verschieben behalten sie die Art; sie heißt dann „${art.name} (gelöscht)“. Das Verschieben geschieht beim Speichern.",
                    )
                    AuswahlFeld("Verschieben nach", Mitgliedsarten.aktive(e.arten).filter { it.id != id }.associate { it.id to it.name }, ziel) { loeschFrage = id to it }
                }
            },
            confirmButton = { TextButton(onClick = { loeschen(id, ziel) }) { Text("Verschieben und löschen") } },
            dismissButton = {
                Row {
                    TextButton(onClick = { loeschFrage = null }) { Text("Abbrechen") }
                    TextButton(onClick = { loeschen(id, null) }) { Text("Ohne Verschieben") }
                }
            },
        )
    }
}

