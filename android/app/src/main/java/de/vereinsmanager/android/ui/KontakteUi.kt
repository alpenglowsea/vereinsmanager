package de.vereinsmanager.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.draw.clip
import androidx.compose.material3.Button
import androidx.compose.material3.Surface
import androidx.compose.material3.OutlinedButton
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
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
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

    var exportOffen by remember { mutableStateOf(false) }
    val sc = MaterialTheme.colorScheme
    val liste = rememberLazyListState()
    val kopf = rememberKopfZustand(liste)

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp).nestedScroll(kopf.verfolgung)) {
        Column(Modifier.einklappbar(kopf)) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KopfKnopf("Neuer Kontakt", onNew, Modifier.weight(1f), primaer = true)
                KopfKnopf("Import", onImport, Modifier.weight(1f))
                KopfKnopf("Export", { exportOffen = true }, Modifier.weight(1f), enabled = !waehlt)
            }
            Text("Kontakte", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp))
            val werte = listOf(alle.size.toString(), firmen.toString(), (alle.size - firmen).toString())
            BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                val g = kachelSchrift(maxWidth, listOf(1f, 1f, 1f), werte.map { maxOf(it.length, 3) }, 40f)
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    StatKachel("Gesamt", werte[0], null, sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                    StatKachel("Firmen", werte[1], null, sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                    StatKachel("Privat", werte[2], null, sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
                }
            }
            SuchFeld(suche, { suche = it }, "Kontakt suchen …", Modifier.padding(top = 12.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FilterMenu("Art", ART_FILTER, art) { art = it }
                FilterMenu("Typ", Kontakte.TYPEN, typ) { typ = it }
                FilterMenu("Sortierung", Kontakte.SORTIERUNG, sortierung.takeIf { it != "name" }) { sortierung = it ?: "name" }
            }
        }
        if (info != null) Text(info!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp))
        Text("${shown.size} von ${alle.size} Kontakten", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        if (waehlt) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${gewaehlt.size} gewählt", style = MaterialTheme.typography.labelLarge)
                KompaktKnopf("Alle angezeigten", { gewaehlt = shown.map { it.id }.toSet() })
                KompaktKnopf("Keine", { gewaehlt = emptySet() })
                KompaktKnopf("Löschen", { loeschen = true }, enabled = !model.busy)
                ExportMenue("Exportieren", export(shown.filter { it.id in gewaehlt }, "gewählte"), kompakt = true)
            }
        }
        Spacer(Modifier.height(6.dp))
        if (alle.isEmpty()) Text("Noch keine Kontakte. Legen Sie mit „Neuer Kontakt“ den ersten an.", Modifier.padding(top = 16.dp))
        LazyColumn(state = liste, contentPadding = PaddingValues(bottom = 96.dp)) {
            itemsIndexed(shown, key = { _, k -> k.id }) { i, k ->
                val an = k.id in gewaehlt
                ListenKarte(
                    erste = i == 0, letzte = i == shown.lastIndex, angehakt = an,
                    onClick = { if (waehlt) gewaehlt = if (an) gewaehlt - k.id else gewaehlt + k.id else onOpen(k.id) },
                    onLongClick = { if (!an) gewaehlt = gewaehlt + k.id; info = null },
                ) {
                    if (waehlt) Checkbox(an, { gewaehlt = if (an) gewaehlt - k.id else gewaehlt + k.id })
                    else Marke(k.anzeigeName.ifBlank { "?" }, (k.id.hashCode() and 0x7fffffff), 44.dp)
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(k.anzeigeName.ifBlank { "(ohne Name)" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            listOf(k.nummer, Kontakte.typenText(k)).filter { it.isNotEmpty() }.joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        val unten = listOf(k.adresse.ort, k.telefon.ifEmpty { k.mobil }, k.email).filter { it.isNotEmpty() }.joinToString(" · ")
                        if (unten.isNotEmpty()) Text(unten, style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
    if (exportOffen) ExportAuswahl("${shown.size} angezeigte Kontakte exportieren als:", export(shown, "angezeigte"), { exportOffen = false })
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

    val sc = MaterialTheme.colorScheme
    val zeile: @Composable (String, String) -> Unit = { l, w -> DetailFeld(l, w) }
    val einn = Geld.euro(bilanz.einnahmen)
    val ausg = Geld.euro(bilanz.ausgaben)

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Marke(k.anzeigeName.ifBlank { "?" }, (k.id.hashCode() and 0x7fffffff), 72.dp)
            Column(Modifier.weight(1f).padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(k.anzeigeName.ifBlank { "(ohne Namen)" }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (k.istFirma) Schild("Firma", sc.secondaryContainer, sc.onSecondaryContainer) else Schild("Privatperson", sc.tertiaryContainer, sc.onTertiaryContainer)
                    if (k.nummer.isNotEmpty()) Text(k.nummer, style = MaterialTheme.typography.bodyMedium, color = sc.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
            val g = kachelSchrift(maxWidth, listOf(0.8f, 1.2f, 1.2f), listOf(bilanz.anzahl.toString().length, einn.length, ausg.length), 26f)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatKachel("Buchungen", bilanz.anzahl.toString(), null, sc.secondaryContainer, sc.onSecondaryContainer, Modifier.weight(0.8f).fillMaxHeight(), g)
                StatKachel("Einnahmen", einn, null, sc.primaryContainer, sc.onPrimaryContainer, Modifier.weight(1.2f).fillMaxHeight(), g)
                StatKachel("Ausgaben", ausg, null, sc.errorContainer, sc.onErrorContainer, Modifier.weight(1.2f).fillMaxHeight(), g)
            }
        }
        Spacer(Modifier.height(8.dp))
        DetailKarte(if (k.istFirma) "Firma / Organisation" else "Person") {
            zeile("Kontakttypen", Kontakte.typenText(k))
            zeile("Rechtsform", k.rechtsform)
            zeile("Geburtsdatum", if (k.geburtsdatum.isNotEmpty()) deDate(k.geburtsdatum) else "")
            zeile("Steuernummer / USt-IdNr.", k.steuernummer)
            zeile("Handelsregister", k.handelsregister)
        }
        k.ansprech?.takeIf { k.istFirma && (it.name.isNotBlank() || it.email.isNotBlank() || it.telefon.isNotBlank()) }?.let { a ->
            DetailKarte("Ansprechpartner") {
                zeile("Name", listOf(a.name, a.funktion.takeIf { it.isNotBlank() }?.let { "($it)" }.orEmpty()).filter { it.isNotBlank() }.joinToString(" "))
                KontaktLink("Telefon", a.telefon, LinkArt.TELEFON)
                KontaktLink("E-Mail", a.email, LinkArt.MAIL)
            }
        }
        val anschrift = listOf("${k.adresse.strasse} ${k.adresse.hausnummer}".trim(), "${k.adresse.plz} ${k.adresse.ort}".trim(), k.adresse.land).filter { it.isNotBlank() }.joinToString("\n")
        if (anschrift.isNotBlank() || listOf(k.telefon, k.mobil, k.email, k.web).any { it.isNotBlank() }) DetailKarte("Anschrift und Erreichbarkeit") {
            zeile("Anschrift", anschrift)
            KontaktLink("Telefon", k.telefon, LinkArt.TELEFON)
            KontaktLink("Mobil", k.mobil, LinkArt.TELEFON)
            KontaktLink("E-Mail", k.email, LinkArt.MAIL)
            KontaktLink("Webseite", k.web, LinkArt.WEB)
        }
        if (listOf(k.iban, k.bic, k.bank, k.inhaber, k.debKred).any { it.isNotBlank() }) DetailKarte("Bank und Buchhaltung") {
            zeile("IBAN", if (k.iban.isNotEmpty()) Iban.gruppiert(k.iban) else "")
            zeile("BIC", k.bic)
            zeile("Kreditinstitut", k.bank)
            zeile("Kontoinhaber", k.inhaber)
            zeile("Debitoren-/Kreditorennummer", k.debKred)
        }
        if (k.tags.isNotEmpty() || k.notizen.isNotBlank()) DetailKarte("Notizen") {
            zeile("Schlagwörter", k.tags.joinToString(", "))
            zeile("", k.notizen)
        }

        DetailKarte("Zugeordnete Buchungen (${bilanz.anzahl})") {
            if (buchungen.isEmpty()) Text("Keine. Zugeordnet wird eine Buchung, wenn ihr Zahlungspartner genau dem Namen oder der Kontaktnummer entspricht oder die Kontaktnummer im Buchungstext steht.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
            else {
                buchungen.take(10).forEachIndexed { i, b ->
                    if (i > 0) HorizontalDivider(color = sc.outlineVariant)
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { onOpenBuchung(b.id) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(Finance.titel(b), fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(listOf(if (b.datum.isNotEmpty()) deDate(b.datum) else "", b.belegNummer).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                        }
                        Text(Geld.euro(if (b.istAusgabe) b.betrag.abs().negate() else b.betrag), fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false, modifier = Modifier.padding(start = 8.dp))
                    }
                }
                if (buchungen.size > 10) Text("Die neuesten 10 von ${buchungen.size} Buchungen. Die Summen gelten für alle.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
            }
        }
        if (rechnungen.isNotEmpty()) DetailKarte("Rechnungen (${rechnungen.size})") {
            rechnungen.forEachIndexed { i, r ->
                if (i > 0) HorizontalDivider(color = sc.outlineVariant)
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { onOpenRechnung(r.id) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.nummer, fontWeight = FontWeight.Bold, maxLines = 1)
                        Text(listOf(if (r.datum.isNotEmpty()) deDate(r.datum) else "", de.vereinsmanager.core.invoice.RechnungsExport.statusText(r.status)).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                    Text(Geld.euro(r.brutto), fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false, modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
        if (meldung != null) Text(meldung!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        AktionsZeilen(
            listOf(
                listOf(Aktion("Bearbeiten", onEdit, primaer = true), Aktion("Löschen", { loeschen = true })),
                listOf(Aktion("Buchung erfassen", { onBuchung(k.anzeigeName) }), Aktion("Rechnung schreiben", { onRechnung(k.id) })),
            ),
            Modifier.padding(top = 12.dp, bottom = 16.dp),
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

private val KONTAKT_SCHRITTE_FIRMA = listOf("Basis", "Firma", "Erreichbarkeit", "Bank und mehr")
private val KONTAKT_SCHRITTE_PERSON = listOf("Basis", "Person", "Erreichbarkeit", "Bank und mehr")

/** In welchem Schritt eine Fehlermeldung steht (Schlüssel der Prüfung aus dem Kern). */
private fun fehlerSchritt(schluessel: String): Int = when (schluessel) {
    "typen", "nummer" -> 0
    "firma", "nachname", "apEmail" -> 1
    "email" -> 2
    "iban", "bic" -> 3
    else -> 0
}

/** Anlegen (id == null) und Bearbeiten eines Kontakts in vier Schritten, wie beim Mitglied. */
@Composable
fun KontaktFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden = id?.let { i -> model.kontakte.firstOrNull { it.id == i } }
    var f by remember { mutableStateOf<KontaktForm>(if (vorhanden != null) model.kontaktFormular(vorhanden) else model.kontaktNeu()) }
    var schritt by remember { mutableStateOf(0) }
    // Nach dem ersten Speichern-Versuch wird laufend neu geprüft: Behobene Fehler verschwinden sofort.
    var versucht by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val pruef = if (versucht) model.kontaktPruefen(f) else emptyMap()
    val anreden = remember(f.anrede, f.apAnrede) {
        linkedMapOf("" to "–").also { m -> Kontakte.ANREDEN.forEach { m[it] = it }; listOf(f.anrede, f.apAnrede).filter { it.isNotEmpty() }.forEach { m.putIfAbsent(it, it) } }
    }
    val rechtsformen = remember { linkedMapOf("" to "–").also { m -> Kontakte.RECHTSFORMEN.forEach { m[it] = it } } }
    val sc = MaterialTheme.colorScheme
    val namen = if (f.art == "legal") KONTAKT_SCHRITTE_FIRMA else KONTAKT_SCHRITTE_PERSON
    val fehlerNr = pruef.keys.minOfOrNull { fehlerSchritt(it) }

    // Alles scrollt zusammen: Die Knöpfe stehen am Ende der Seite und sind bei geöffneter Tastatur durch Hinunterscrollen erreichbar.
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Text(
            if (vorhanden == null) "Neuer Kontakt" else "Kontakt bearbeiten",
            style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            namen.forEachIndexed { i, _ ->
                val farbe = when {
                    i == fehlerNr -> sc.error
                    i < schritt -> sc.primary
                    i == schritt -> sc.tertiaryContainer
                    else -> sc.outlineVariant
                }
                Box(Modifier.weight(1f).height(28.dp).clickable { schritt = i }, contentAlignment = Alignment.Center) {
                    Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(farbe))
                }
            }
        }
        val mitFehler = fehlerNr != null && fehlerNr != schritt
        Text(
            "Schritt ${schritt + 1} von ${namen.size} · ${namen[schritt]}" + if (mitFehler) " · Angaben fehlen bei „${namen[fehlerNr!!]}“" else "",
            style = MaterialTheme.typography.titleSmall, color = if (mitFehler) sc.error else sc.onSurfaceVariant,
            modifier = Modifier.padding(top = 2.dp, bottom = 6.dp),
        )
        Surface(shape = RoundedCornerShape(28.dp), color = sc.surface, border = BorderStroke(1.5.dp, sc.outlineVariant), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
            Column(Modifier.padding(16.dp)) {
                when (schritt) {
                    0 -> {
                        Text("Art des Kontakts", style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TabChip("Firma / Organisation", f.art == "legal") { f = f.copy(art = "legal") }
                            TabChip("Privatperson", f.art == "natural") { f = f.copy(art = "natural") }
                        }
                        Text("Kontakttypen *", style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
                        Kontakte.TYPEN.forEach { (k, v) ->
                            val an = k in f.typen
                            Row(Modifier.fillMaxWidth().clickable { f = f.copy(typen = if (an) f.typen - k else f.typen + k) }, verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(an, { f = f.copy(typen = if (an) f.typen - k else f.typen + k) })
                                Text(v)
                            }
                        }
                        pruef["typen"]?.let { Text(it, color = sc.error, style = MaterialTheme.typography.bodySmall) }
                        Feld("Kontaktnummer *", f.nummer, { f = f.copy(nummer = it) }, pruef["nummer"])
                    }
                    1 -> if (f.art == "legal") {
                        Feld("Firmen- oder Organisationsname *", f.firma, { f = f.copy(firma = it) }, pruef["firma"])
                        Auswahl("Rechtsform", rechtsformen, f.rechtsform) { f = f.copy(rechtsform = it) }
                        if (f.rechtsform == "Sonstige") Feld("Rechtsform (eigene Angabe)", f.rechtsformFrei, { f = f.copy(rechtsformFrei = it) })
                        Feld("Steuernummer / USt-IdNr.", f.steuernummer, { f = f.copy(steuernummer = it) })
                        Feld("Handelsregister", f.handelsregister, { f = f.copy(handelsregister = it) }, hinweis = "z. B. HRB 12345 (Amtsgericht Musterstadt)")
                        Text("Ansprechpartner", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.padding(top = 12.dp))
                        Auswahl("Anrede", anreden, f.apAnrede) { f = f.copy(apAnrede = it) }
                        Feld("Vorname", f.apVorname, { f = f.copy(apVorname = it) })
                        Feld("Nachname", f.apNachname, { f = f.copy(apNachname = it) })
                        Feld("Funktion", f.apFunktion, { f = f.copy(apFunktion = it) }, hinweis = "z. B. Geschäftsführer, Trainer")
                        Feld("E-Mail Ansprechpartner", f.apEmail, { f = f.copy(apEmail = it) }, pruef["apEmail"], keyboard = KeyboardType.Email)
                        Feld("Telefon Ansprechpartner", f.apTelefon, { f = f.copy(apTelefon = it) }, keyboard = KeyboardType.Phone)
                    } else {
                        Auswahl("Anrede", anreden, f.anrede) { f = f.copy(anrede = it) }
                        Feld("Vorname", f.vorname, { f = f.copy(vorname = it) })
                        Feld("Nachname *", f.nachname, { f = f.copy(nachname = it) }, pruef["nachname"])
                        DatumFeld("Geburtsdatum", f.geburtsdatum, optional = true) { f = f.copy(geburtsdatum = it) }
                    }
                    2 -> {
                        Feld("Straße", f.strasse, { f = f.copy(strasse = it) })
                        Feld("Hausnummer", f.hausnummer, { f = f.copy(hausnummer = it) })
                        Feld("PLZ", f.plz, { f = f.copy(plz = it) }, keyboard = KeyboardType.Number)
                        Feld("Ort", f.ort, { f = f.copy(ort = it) })
                        Feld("Land", f.land, { f = f.copy(land = it) })
                        Feld("E-Mail", f.email, { f = f.copy(email = it) }, pruef["email"], keyboard = KeyboardType.Email)
                        Feld("Telefon", f.telefon, { f = f.copy(telefon = it) }, keyboard = KeyboardType.Phone)
                        Feld("Mobil", f.mobil, { f = f.copy(mobil = it) }, keyboard = KeyboardType.Phone)
                        Feld("Webseite", f.web, { f = f.copy(web = it) }, keyboard = KeyboardType.Uri)
                    }
                    else -> {
                        Feld("IBAN", f.iban, { f = f.copy(iban = it) }, pruef["iban"])
                        Feld("BIC", f.bic, { f = f.copy(bic = it) }, pruef["bic"])
                        Feld("Kreditinstitut", f.bank, { f = f.copy(bank = it) })
                        Feld("Kontoinhaber", f.inhaber, { f = f.copy(inhaber = it) }, hinweis = "Leer lassen: der Name des Kontakts")
                        Feld("Debitoren-/Kreditorennummer", f.debKred, { f = f.copy(debKred = it) }, hinweis = "z. B. KRED-7001 oder DEB-1001")
                        Feld("Schlagwörter", f.tagsText, { f = f.copy(tagsText = it) }, hinweis = "Mit Komma trennen")
                        Feld("Notizen", f.notizen, { f = f.copy(notizen = it) }, singleLine = false)
                    }
                }
            }
        }
        if (fehler != null) Text(fehler!!, color = sc.error)
        if (pruef.isNotEmpty()) Text("Bitte die markierten Angaben ergänzen.", color = sc.error)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { if (schritt > 0) schritt-- }, enabled = schritt > 0, modifier = Modifier.weight(1f).height(48.dp)) { Text("Zurück") }
            OutlinedButton(onClick = { if (schritt < namen.size - 1) schritt++ }, enabled = schritt < namen.size - 1, modifier = Modifier.weight(1f).height(48.dp)) { Text("Weiter") }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onDone, modifier = Modifier.weight(1f).height(52.dp)) { Text("Abbrechen") }
            Button(
                enabled = !model.busy, modifier = Modifier.weight(1f).height(52.dp),
                onClick = {
                    versucht = true
                    val fehlerMap = model.kontaktPruefen(f)
                    if (fehlerMap.isNotEmpty()) schritt = fehlerMap.keys.minOf { fehlerSchritt(it) }
                    else { fehler = null; model.kontaktSpeichern(f) { _, e -> if (e == null) onDone() else fehler = e } }
                },
            ) { Text("Speichern") }
        }
    }
}
