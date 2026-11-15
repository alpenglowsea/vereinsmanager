package de.vereinsmanager.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.export.rememberExporter
import de.vereinsmanager.core.contacts.Kontakt
import de.vereinsmanager.core.contacts.KontaktForm
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.members.Iban
import java.time.LocalDate

/** Was ein antippbarer Wert öffnet. */
internal enum class LinkArt { TELEFON, MAIL, WEB }

/**
 * Ein Wert mit Beschriftung, der sich antippen lässt: Telefonnummer öffnet die Telefon-App (Nummer eingetragen, es wird nicht
 * selbst gewählt), E-Mail das Mailprogramm, Webseite den Browser. Findet das Gerät keine passende App, geschieht nichts.
 */
@Composable
internal fun KontaktLink(label: String, wert: String, art: LinkArt) {
    if (wert.isBlank()) return
    val context = LocalContext.current
    Column(Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(
            wert, color = MaterialTheme.colorScheme.primary, textDecoration = TextDecoration.Underline,
            modifier = Modifier.clickable {
                val intent = when (art) {
                    LinkArt.TELEFON -> Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(wert.filter { it.isDigit() || it == '+' || it == '*' || it == '#' })))
                    LinkArt.MAIL -> Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(wert.trim())))
                    LinkArt.WEB -> Intent(Intent.ACTION_VIEW, Uri.parse(wert.trim().let { if (it.contains("://")) it else "https://$it" }))
                }
                try { context.startActivity(intent) } catch (e: Exception) { /* keine passende App */ }
            }.padding(vertical = 2.dp),
        )
    }
}

private val ART_FILTER = linkedMapOf("legal" to "Firmen", "natural" to "Privatpersonen")

// ---------------------------------------------------------------- Liste

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun KontakteScreen(model: AppModel, onOpen: (String) -> Unit, onNew: () -> Unit, onImport: () -> Unit, modifier: Modifier = Modifier) {
    val alle = model.kontakte
    var suche by remember { mutableStateOf("") }
    var art by remember { mutableStateOf<String?>(null) }
    var typ by remember { mutableStateOf<String?>(null) }
    var sortierung by remember { mutableStateOf("name") }
    var gewaehlt by remember { mutableStateOf(setOf<String>()) }
    var loeschen by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<String?>(null) }
    val exporter = rememberExporter(model) { info = it }
    val waehlt = gewaehlt.isNotEmpty()
    BackHandler(enabled = waehlt) { gewaehlt = emptySet() }

    val shown = remember(alle, suche, art, typ, sortierung) {
        Kontakte.sortieren(alle.filter { k -> (art == null || k.art == art) && (typ == null || typ in k.typen) && Kontakte.passt(k, suche) }, sortierung)
    }
    val firmen = alle.count { it.istFirma }

    fun export(liste: List<Kontakt>, wort: String): List<Pair<String, () -> Unit>> {
        val heute = LocalDate.now()
        return listOf(
            "CSV – ${liste.size} $wort Kontakte" to { exporter.csv(Kontakte.csvDateiname(model.vereinsname(), heute)) { Kontakte.csvDateiInhalt(liste) } },
            "PDF – ${liste.size} $wort Kontakte" to { exporter.pdf(Kontakte.pdfDateiname(model.vereinsname(), heute)) { Kontakte.pdfTabelle(liste, model.vereinsname(), heute) } },
        )
    }

    Column(modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiKachel("Kontakte", alle.size.toString(), if (alle.isEmpty()) "noch keine" else "${firmen * 100 / alle.size} % Firmen", Modifier.weight(1f))
            KpiKachel("Firmen / Privat", "$firmen / ${alle.size - firmen}", "${shown.size} angezeigt", Modifier.weight(1f))
        }
        OutlinedTextField(
            suche, { suche = it }, label = { Text("Name, Nummer, Ort, E-Mail, Notiz … suchen") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterMenu("Art", ART_FILTER, art) { art = it }
            FilterMenu("Typ", Kontakte.TYPEN, typ) { typ = it }
            FilterMenu("Sortierung", Kontakte.SORTIERUNG, sortierung.takeIf { it != "name" }) { sortierung = it ?: "name" }
            KompaktKnopf("Neuer Kontakt", onNew, primaer = true)
            KompaktKnopf("Importieren", onImport)
            ExportMenue("Exportieren", export(shown, "angezeigte"), kompakt = false)
        }
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                KompaktKnopf("Löschen", { loeschen = true }, enabled = !model.busy)
                ExportMenue("Exportieren", export(shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
        Text("${shown.size} von ${alle.size} Kontakten", style = MaterialTheme.typography.bodySmall)
        HorizontalDivider(Modifier.padding(vertical = 4.dp))
        if (alle.isEmpty()) Text("Noch keine Kontakte. Legen Sie mit „Neuer Kontakt“ den ersten an.", Modifier.padding(top = 16.dp))
        LazyColumn {
            items(shown, key = { it.id }) { k ->
                val an = k.id in gewaehlt
                Row(
                    Modifier.fillMaxWidth().combinedClickable(
                        onClick = { if (waehlt) gewaehlt = if (an) gewaehlt - k.id else gewaehlt + k.id else onOpen(k.id) },
                        onLongClick = { if (!an) gewaehlt = gewaehlt + k.id; info = null },
                    ).padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (waehlt) Checkbox(an, { gewaehlt = if (an) gewaehlt - k.id else gewaehlt + k.id })
                    Column(Modifier.weight(1f)) {
                        Text(k.anzeigeName.ifBlank { "(ohne Name)" }, style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                        Text(listOf(k.nummer, Kontakte.typenText(k)).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        val unten = listOf(k.adresse.ort, k.telefon.ifEmpty { k.mobil }, k.email).filter { it.isNotEmpty() }.joinToString(" · ")
                        if (unten.isNotEmpty()) Text(unten, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    }
                }
                HorizontalDivider()
            }
        }
    }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false }, title = { Text("${gewaehlt.size} Kontakte löschen?") },
            text = { Text("Die gewählten Kontakte werden endgültig gelöscht. Rechnungen und Buchungen bleiben bestehen; sie enthalten eine Kopie der Angaben.") },
            confirmButton = {
                TextButton(onClick = {
                    loeschen = false
                    model.kontakteLoeschen(gewaehlt.toList()) { f -> if (f == null) { gewaehlt = emptySet() } else info = f }
                }) { Text("Löschen") }
            },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}

// ---------------------------------------------------------------- Detail

@Composable
fun KontaktDetailScreen(
    model: AppModel, id: String, onEdit: () -> Unit, onBuchung: (String) -> Unit, onRechnung: (String) -> Unit,
    onOpenBuchung: (String) -> Unit, onOpenRechnung: (String) -> Unit, onDeleted: () -> Unit, modifier: Modifier = Modifier,
) {
    val k = model.kontakte.firstOrNull { it.id == id }
    var loeschen by remember { mutableStateOf(false) }
    var meldung by remember { mutableStateOf<String?>(null) }
    if (k == null) { Text("Den Kontakt gibt es nicht mehr.", modifier.padding(16.dp)); return }
    val buchungen = remember(k, model.buchungen) { Kontakte.buchungenVon(k, model.buchungen) }
    val bilanz = remember(buchungen) { Kontakte.bilanz(buchungen) }
    val rechnungen = remember(k, model.rechnungen) { model.rechnungen.filter { it.empfaengerArt == "contact" && it.empfaengerId == k.id } }

    @Composable
    fun Zeile(label: String, wert: String) {
        if (wert.isBlank()) return
        Column(Modifier.padding(vertical = 4.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Text(wert, style = MaterialTheme.typography.bodyLarge)
        }
    }

    Column(modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(k.anzeigeName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
        Text(listOf(k.nummer, if (k.istFirma) "Firma / Organisation" else "Privatperson").filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.titleMedium)
        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Zeile("Kontakttypen", Kontakte.typenText(k))
        Zeile("Rechtsform", k.rechtsform)
        k.ansprech?.takeIf { k.istFirma && (it.name.isNotBlank() || it.email.isNotBlank() || it.telefon.isNotBlank()) }?.let { a ->
            Zeile("Ansprechpartner", listOf(a.name, a.funktion.takeIf { it.isNotBlank() }?.let { "($it)" }.orEmpty()).filter { it.isNotBlank() }.joinToString(" "))
            KontaktLink("Telefon Ansprechpartner", a.telefon, LinkArt.TELEFON)
            KontaktLink("E-Mail Ansprechpartner", a.email, LinkArt.MAIL)
        }
        Zeile("Anschrift", listOf("${k.adresse.strasse} ${k.adresse.hausnummer}".trim(), "${k.adresse.plz} ${k.adresse.ort}".trim(), k.adresse.land).filter { it.isNotBlank() }.joinToString("\n"))
        KontaktLink("Telefon", k.telefon, LinkArt.TELEFON)
        KontaktLink("Mobil", k.mobil, LinkArt.TELEFON)
        KontaktLink("E-Mail", k.email, LinkArt.MAIL)
        KontaktLink("Webseite", k.web, LinkArt.WEB)
        Zeile("Geburtsdatum", if (k.geburtsdatum.isNotEmpty()) deDate(k.geburtsdatum) else "")
        Zeile("Steuernummer / USt-IdNr.", k.steuernummer)
        Zeile("Handelsregister", k.handelsregister)
        Zeile("IBAN", if (k.iban.isNotEmpty()) Iban.gruppiert(k.iban) else "")
        Zeile("BIC", k.bic)
        Zeile("Kreditinstitut", k.bank)
        Zeile("Kontoinhaber", k.inhaber)
        Zeile("Debitoren-/Kreditorennummer", k.debKred)
        Zeile("Schlagwörter", k.tags.joinToString(", "))
        Zeile("Notizen", k.notizen)

        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Text("Zugeordnete Buchungen", style = MaterialTheme.typography.titleMedium)
        if (buchungen.isEmpty()) Text("Keine. Zugeordnet wird eine Buchung, wenn ihr Zahlungspartner genau dem Namen oder der Kontaktnummer entspricht oder die Kontaktnummer im Buchungstext steht.", style = MaterialTheme.typography.bodySmall)
        else {
            Text("${bilanz.anzahl} Buchungen · Einnahmen ${Geld.euro(bilanz.einnahmen)} · Ausgaben ${Geld.euro(bilanz.ausgaben)}", style = MaterialTheme.typography.bodyMedium)
            buchungen.take(10).forEach { b ->
                Row(Modifier.fillMaxWidth().clickable { onOpenBuchung(b.id) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(Finance.titel(b), maxLines = 1)
                        Text(listOf(if (b.datum.isNotEmpty()) deDate(b.datum) else "", b.belegNummer).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                    Text(Geld.euro(if (b.istAusgabe) b.betrag.abs().negate() else b.betrag), fontWeight = FontWeight.SemiBold)
                }
                HorizontalDivider()
            }
            if (buchungen.size > 10) Text("Die neuesten 10 von ${buchungen.size} Buchungen. Die Summen gelten für alle.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        }
        if (rechnungen.isNotEmpty()) {
            Text("Rechnungen", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            rechnungen.forEach { r ->
                Row(Modifier.fillMaxWidth().clickable { onOpenRechnung(r.id) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.nummer, maxLines = 1)
                        Text(listOf(if (r.datum.isNotEmpty()) deDate(r.datum) else "", de.vereinsmanager.core.invoice.RechnungsExport.statusText(r.status)).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    }
                    Text(Geld.euro(r.brutto), fontWeight = FontWeight.SemiBold)
                }
                HorizontalDivider()
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Bearbeiten", onEdit, primaer = true), Aktion("Löschen", { loeschen = true })),
                listOf(Aktion("Buchung erfassen", { onBuchung(k.anzeigeName) }), Aktion("Rechnung schreiben", { onRechnung(k.id) })),
            ),
            Modifier.padding(top = 16.dp),
        )
    }
    if (loeschen) {
        AlertDialog(
            onDismissRequest = { loeschen = false }, title = { Text("Kontakt löschen?") },
            text = {
                Text(
                    "${k.anzeigeName} wird endgültig gelöscht. Rechnungen und Buchungen bleiben bestehen; sie enthalten eine Kopie der Angaben " +
                        "und verlieren nur die Verknüpfung zu diesem Kontakt.",
                )
            },
            confirmButton = { TextButton(onClick = { loeschen = false; model.kontaktLoeschen(k.id) { f -> if (f == null) onDeleted() else meldung = f } }) { Text("Löschen") } },
            dismissButton = { TextButton(onClick = { loeschen = false }) { Text("Abbrechen") } },
        )
    }
}

// ---------------------------------------------------------------- Formular

@Composable
fun KontaktFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.kontakte.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf<KontaktForm>(if (vorhanden != null) model.kontaktFormular(vorhanden) else model.kontaktNeu()) }
    var zeigeFehler by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val pruef = if (zeigeFehler) model.kontaktPruefen(f) else emptyMap()
    val anreden = remember(f.anrede, f.apAnrede) {
        linkedMapOf("" to "–").also { m -> Kontakte.ANREDEN.forEach { m[it] = it }; listOf(f.anrede, f.apAnrede).filter { it.isNotEmpty() }.forEach { m.putIfAbsent(it, it) } }
    }
    val rechtsformen = remember { linkedMapOf("" to "–").also { m -> Kontakte.RECHTSFORMEN.forEach { m[it] = it } } }

    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Text(if (vorhanden == null) "Neuer Kontakt" else "Kontakt bearbeiten", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        Column(Modifier.padding(vertical = 8.dp)) {
            Text("Art des Kontakts", style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(f.art == "legal", { f = f.copy(art = "legal") }, { Text("Firma / Organisation") })
                FilterChip(f.art == "natural", { f = f.copy(art = "natural") }, { Text("Privatperson") })
            }
            Text("Kontakttypen *", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            Kontakte.TYPEN.forEach { (k, v) ->
                val an = k in f.typen
                Row(Modifier.fillMaxWidth().clickable { f = f.copy(typen = if (an) f.typen - k else f.typen + k) }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(an, { f = f.copy(typen = if (an) f.typen - k else f.typen + k) })
                    Text(v)
                }
            }
            pruef["typen"]?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Feld("Kontaktnummer *", f.nummer, { f = f.copy(nummer = it) }, pruef["nummer"])

            if (f.art == "legal") {
                Text("Firma / Organisation", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
                Feld("Firmen- oder Organisationsname *", f.firma, { f = f.copy(firma = it) }, pruef["firma"])
                Auswahl("Rechtsform", rechtsformen, f.rechtsform) { f = f.copy(rechtsform = it) }
                if (f.rechtsform == "Sonstige") Feld("Rechtsform (eigene Angabe)", f.rechtsformFrei, { f = f.copy(rechtsformFrei = it) })
                Feld("Steuernummer / USt-IdNr.", f.steuernummer, { f = f.copy(steuernummer = it) })
                Feld("Handelsregister", f.handelsregister, { f = f.copy(handelsregister = it) }, hinweis = "z. B. HRB 12345 (Amtsgericht Musterstadt)")
                Text("Ansprechpartner", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
                Auswahl("Anrede", anreden, f.apAnrede) { f = f.copy(apAnrede = it) }
                Feld("Vorname", f.apVorname, { f = f.copy(apVorname = it) })
                Feld("Nachname", f.apNachname, { f = f.copy(apNachname = it) })
                Feld("Funktion", f.apFunktion, { f = f.copy(apFunktion = it) }, hinweis = "z. B. Geschäftsführer, Trainer")
                Feld("E-Mail Ansprechpartner", f.apEmail, { f = f.copy(apEmail = it) }, pruef["apEmail"], keyboard = KeyboardType.Email)
                Feld("Telefon Ansprechpartner", f.apTelefon, { f = f.copy(apTelefon = it) }, keyboard = KeyboardType.Phone)
            } else {
                Text("Person", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
                Auswahl("Anrede", anreden, f.anrede) { f = f.copy(anrede = it) }
                Feld("Vorname", f.vorname, { f = f.copy(vorname = it) })
                Feld("Nachname *", f.nachname, { f = f.copy(nachname = it) }, pruef["nachname"])
                DatumFeld("Geburtsdatum", f.geburtsdatum, optional = true) { f = f.copy(geburtsdatum = it) }
            }

            Text("Anschrift und Erreichbarkeit", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
            Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
            Feld("PLZ", f.plz, { f = f.copy(plz = it) }, keyboard = KeyboardType.Number)
            Feld("Ort", f.ort, { f = f.copy(ort = it) })
            Feld("Land", f.land, { f = f.copy(land = it) })
            Feld("E-Mail", f.email, { f = f.copy(email = it) }, pruef["email"], keyboard = KeyboardType.Email)
            Feld("Telefon", f.telefon, { f = f.copy(telefon = it) }, keyboard = KeyboardType.Phone)
            Feld("Mobil", f.mobil, { f = f.copy(mobil = it) }, keyboard = KeyboardType.Phone)
            Feld("Webseite", f.web, { f = f.copy(web = it) }, keyboard = KeyboardType.Uri)

            Text("Bankverbindung und Buchhaltung", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            Feld("IBAN", f.iban, { f = f.copy(iban = it) }, pruef["iban"])
            Feld("BIC", f.bic, { f = f.copy(bic = it) }, pruef["bic"])
            Feld("Kreditinstitut", f.bank, { f = f.copy(bank = it) })
            Feld("Kontoinhaber", f.inhaber, { f = f.copy(inhaber = it) }, hinweis = "Leer lassen: der Name des Kontakts")
            Feld("Debitoren-/Kreditorennummer", f.debKred, { f = f.copy(debKred = it) }, hinweis = "z. B. KRED-7001 oder DEB-1001")
            Feld("Schlagwörter", f.tagsText, { f = f.copy(tagsText = it) }, hinweis = "Mit Komma trennen")
            Feld("Notizen", f.notizen, { f = f.copy(notizen = it) }, singleLine = false)
        }
        if (zeigeFehler && pruef.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KompaktKnopf("Speichern", {
                zeigeFehler = true
                if (model.kontaktPruefen(f).isEmpty()) model.kontaktSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e }
            }, primaer = true, enabled = !model.busy)
            KompaktKnopf("Abbrechen", onDone)
        }
    }
}
