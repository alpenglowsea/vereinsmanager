package de.vereinsmanager.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.contacts.Kontakt
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.finance.TeilForm
import java.math.BigDecimal

/** Anlegen (id == null) und Bearbeiten einer Buchung. Alle Regeln stecken im Kern ([BuchungRegeln]). */
@Composable
fun BuchungFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier, vorPartner: String? = null) {
    val vorhanden: Buchung? = remember(id) { id?.let { i -> model.buchungen.firstOrNull { it.id == i } } }
    var f by remember(id) { mutableStateOf(vorhanden?.let { BuchungRegeln.von(it) } ?: model.neueBuchung().let { n -> if (vorPartner.isNullOrBlank()) n else n.copy(partner = vorPartner) }) }
    var versucht by remember { mutableStateOf(false) }
    var schrittRoh by remember { mutableStateOf(0) }
    var speicherFehler by remember { mutableStateOf<String?>(null) }
    // C5: Zahlungspartner als neuen Kontakt anlegen (Dialog) und Hinweis nach der Vorbelegung
    var kontaktDialog by remember { mutableStateOf(false) }
    var vorbelegtHinweis by remember { mutableStateOf<String?>(null) }
    // Nach dem ersten Speichern-Versuch wird laufend neu geprüft: Behobene Fehler verschwinden sofort.
    val fehler = if (versucht) BuchungRegeln.pruefen(f, model.konten) else emptyMap()
    // Kontenrahmen des Vereins (mit eigenen Konten und Anpassungen); Ausgeblendetes fehlt, außer die Buchung trägt es schon.
    val skr = remember(model.kontenrahmen, f.nummernkreis, f.konto, f.skrKonto, f.teile) {
        de.vereinsmanager.core.skr42.Kontenrahmen.nurSichtbare(
            model.kontenrahmen,
            (listOf(f.nummernkreis) + f.teile.map { it.nummernkreis }).filter { it.isNotEmpty() }.toSet(),
            (listOf(f.konto, f.skrKonto) + f.teile.flatMap { listOf(it.konto, it.skrKonto) }).filter { it.isNotEmpty() }.toSet(),
        )
    }
    var neuesKonto by remember { mutableStateOf(false) }

    val kontoAuswahl = remember(model.konten) { model.konten.associate { it.id to it.name } }
    val sparten = remember(model.departments, f.sparte, f.teile) {
        val liste = linkedMapOf("" to "Keine Sparte")
        model.departments.forEach { liste[it] = it }
        (listOf(f.sparte) + f.teile.map { it.sparte }).filter { it.isNotEmpty() }.forEach { liste.putIfAbsent(it, it) }
        liste
    }
    val vorschlaege = remember(model.buchungen, model.members, model.kontakte) {
        (model.buchungen.map { it.partner } + model.members.map { "${it.firstName} ${it.lastName}".trim() } + model.kontakte.map { it.anzeigeName })
            .map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    }

    val namen = if (f.art == "transfer") listOf("Grunddaten", "Notiz") else listOf("Grunddaten", "Zuordnung", "Notiz")
    val schritt = schrittRoh.coerceAtMost(namen.lastIndex)
    val fehlerNr = fehler.keys.minOfOrNull { if (it == "teile" && f.art != "transfer") 1 else 0 }
    val sc = MaterialTheme.colorScheme

    // Alles scrollt zusammen: Die Knöpfe stehen am Ende der Seite und sind bei geöffneter Tastatur durch Hinunterscrollen erreichbar.
    Column(modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        FormKopf(if (vorhanden == null) "Neue Buchung" else "Buchung bearbeiten", namen, schritt, fehlerNr) { schrittRoh = it.coerceIn(0, namen.lastIndex) }
        FormKarte {
            when (namen[schritt]) {
                "Grunddaten" -> {
                    Text("Buchungsart", style = MaterialTheme.typography.labelMedium, color = sc.onSurfaceVariant)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FinanceLabels.KIND.forEach { (k, v) -> TabChip(v, f.art == k) { f = BuchungRegeln.mitArt(f, k, skr) } }
                    }
                    DatumFeld("Datum *", f.datum, fehler["datum"]) { f = f.copy(datum = it) }
                    Feld("Betrag (€) *", f.betrag, { f = f.copy(betrag = it) }, fehler["betrag"], keyboard = KeyboardType.Decimal)
                    Auswahl(if (f.art == "transfer") "Von Konto *" else "Konto *", kontoAuswahl, f.kontoId) { f = f.copy(kontoId = it) }
                    if (fehler["konto"] != null) Fehlertext(fehler["konto"]!!)
                    if (f.art == "transfer") {
                        Auswahl("Auf Konto *", kontoAuswahl, f.zielkontoId) { f = f.copy(zielkontoId = it) }
                        if (fehler["zielkonto"] != null) Fehlertext(fehler["zielkonto"]!!)
                    }
                    Feld("Belegnummer *", f.belegNummer, { f = f.copy(belegNummer = it) }, fehler["belegNummer"])
                    Feld("Buchungstext *", f.text, { f = f.copy(text = it) }, fehler["text"])
                    if (f.art != "transfer") {
                        Feld("Zahlungspartner *", f.partner, { f = f.copy(partner = it); vorbelegtHinweis = null }, fehler["partner"])
                        val q = f.partner.trim()
                        val treffer = if (q.length < 2) emptyList()
                        else vorschlaege.filter { it.contains(q, ignoreCase = true) && !it.equals(q, ignoreCase = true) }.take(5)
                        if (treffer.isNotEmpty()) {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                treffer.forEach { name ->
                                    AssistChip(onClick = {
                                        // Ein Kontakt als Spender oder Sponsor belegt bei Einnahmen Sphäre und Konto vor (wie Desktop)
                                        val k = model.kontakte.firstOrNull { it.anzeigeName.trim() == name }
                                        val neu = if (k == null) f.copy(partner = name) else BuchungRegeln.vorbelegung(f.copy(partner = name), k.typen, skr)
                                        vorbelegtHinweis = if (neu.skrKonto != f.skrKonto || neu.sphaere != f.sphaere)
                                            "Sphäre und Konto wurden für ${if ("donor" in k!!.typen) "den Spender" else "den Sponsor"} vorbelegt (Schritt „Zuordnung“)." else null
                                        f = neu
                                    }, label = { Text(name) })
                                }
                            }
                        }
                        vorbelegtHinweis?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = sc.primary) }
                        val bekannt = Kontakte.bekannt(model.kontakte, q) ||
                            model.members.any { "${it.firstName} ${it.lastName}".trim().equals(q, ignoreCase = true) }
                        if (q.length >= 3 && !bekannt) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("„$q“ ist noch nicht im Kontaktbuch.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant, modifier = Modifier.weight(1f))
                                TextButton(onClick = { kontaktDialog = true }, enabled = !model.busy) { Text("Als Kontakt anlegen") }
                            }
                        }
                    }
                }
                "Zuordnung" -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(f.aufgeteilt, { an -> f = if (an) BuchungRegeln.aufteilen(f, skr) else f.copy(aufgeteilt = false) })
                        Text("Splittbuchung (auf mehrere Konten aufteilen)", Modifier.weight(1f))
                    }
                    if (!f.aufgeteilt) {
                        Zuordnung(
                            sphaere = f.sphaere, sparte = f.sparte, nummernkreis = f.nummernkreis, konto = f.konto, ust = f.ust,
                            art = f.art, sparten = sparten, skr = skr,
                            onSphaere = { f = f.copy(sphaere = it) }, onSparte = { f = f.copy(sparte = it) },
                            onNummernkreis = { f = BuchungRegeln.mitNummernkreis(f, it) },
                            onKonto = { f = BuchungRegeln.mitKonto(f, it) }, onUst = { f = f.copy(ust = it) },
                            onNeuesKonto = { neuesKonto = true },
                        )
                    } else {
                        f.teile.forEachIndexed { i, t ->
                            if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = sc.outlineVariant)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Teil ${i + 1}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.ExtraBold, color = sc.primary, modifier = Modifier.weight(1f))
                                if (f.teile.size > 2) {
                                    TextButton(onClick = { f = f.copy(teile = f.teile.filterIndexed { j, _ -> j != i }) }) { Text("Entfernen") }
                                }
                            }
                            fun setze(neu: TeilForm) { f = f.copy(teile = f.teile.mapIndexed { j, x -> if (j == i) neu else x }) }
                            Feld("Teilbetrag (€)", t.betrag, { f = BuchungRegeln.teilBetragSetzen(f, i, it) }, keyboard = KeyboardType.Decimal)
                            Feld("Text", t.text, { setze(t.copy(text = it)) })
                            Zuordnung(
                                sphaere = t.sphaere, sparte = t.sparte, nummernkreis = t.nummernkreis, konto = t.konto, ust = t.ust,
                                art = f.art, sparten = sparten, skr = skr,
                                onSphaere = { setze(t.copy(sphaere = it)) }, onSparte = { setze(t.copy(sparte = it)) },
                                onNummernkreis = { setze(BuchungRegeln.teilMitNummernkreis(t, it)) },
                                onKonto = { setze(BuchungRegeln.teilMitKonto(t, it)) }, onUst = { setze(t.copy(ust = it)) },
                            )
                        }
                        OutlinedButton(onClick = {
                            f = f.copy(teile = f.teile + BuchungRegeln.neuerTeil("split-${System.currentTimeMillis()}-${f.teile.size + 1}", f.sphaere, skr))
                        }, modifier = Modifier.padding(top = 8.dp)) { Text("Teilbuchung hinzufügen") }
                        val gesamt = BuchungRegeln.parseBetrag(f.betrag) ?: BigDecimal.ZERO
                        val summe = BuchungRegeln.teilSumme(f)
                        Text(
                            "Summe der Teile ${Geld.euro(summe)} von ${Geld.euro(gesamt)}",
                            style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold,
                            color = if (summe.compareTo(gesamt) == 0) sc.onSurface else sc.error,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        if (fehler["teile"] != null) Fehlertext(fehler["teile"]!!)
                    }
                }
                else -> {
                    Feld("Notiz", f.notiz, { f = f.copy(notiz = it) }, singleLine = false)
                    if (vorhanden?.beleg != null) {
                        Text("Der angehängte Beleg bleibt unverändert erhalten.", style = MaterialTheme.typography.bodySmall, color = sc.onSurfaceVariant)
                    }
                }
            }
        }
        if (speicherFehler != null) Text(speicherFehler!!, color = sc.error)
        if (fehler.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = sc.error)
        FormFuss(schritt, namen.size, { schrittRoh = it.coerceIn(0, namen.lastIndex) }, onDone, {
            versucht = true
            val e = BuchungRegeln.pruefen(f, model.konten)
            if (e.isNotEmpty()) schrittRoh = e.keys.minOf { if (it == "teile" && f.art != "transfer") 1 else 0 }
            else {
                speicherFehler = null
                model.saveBuchung(f) { err -> if (err == null) onDone() else speicherFehler = "Speichern fehlgeschlagen: $err" }
            }
        }, !model.busy)
    }
    // Wie am Desktop: ein Konto direkt aus der Buchung anlegen; danach ist es samt Nummernkreis gewählt.
    if (neuesKonto) {
        val kreis = BuchungRegeln.hauptkonto(f.nummernkreis, f.konto, skr)?.code.orEmpty()
        KontoAnlegenDialog(model, kreis) { sub, _ ->
            neuesKonto = false
            if (sub != null) {
                val main = model.kontenrahmen.firstOrNull { m -> m.subCategories.any { it.code == sub.code } }
                f = BuchungRegeln.mitKonto(if (main != null) BuchungRegeln.mitNummernkreis(f, main) else f, sub)
            }
        }
    }
    if (kontaktDialog) {
        KontaktAusBuchungDialog(model, f.partner.trim(), if (f.art == "income") "sponsor" else "supplier", onDismiss = { kontaktDialog = false }) { k ->
            kontaktDialog = false
            f = f.copy(partner = k.anzeigeName)
        }
    }
}

/**
 * Kurzer Dialog: den Zahlungspartner als Kontakt anlegen, ohne die Buchung zu verlassen (C5). Vorgewählt wie am
 * Desktop: Sponsor bei Einnahmen, Lieferant bei Ausgaben. Weitere Angaben (Adresse, Bank …) später unter Kontakte.
 */
@Composable
private fun KontaktAusBuchungDialog(model: AppModel, name: String, typ: String, onDismiss: () -> Unit, onSaved: (Kontakt) -> Unit) {
    var art by remember { mutableStateOf("legal") }
    var text by remember { mutableStateOf(name) }
    var typen by remember { mutableStateOf(listOf(typ)) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val basis = remember { model.kontaktNeu() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Als Kontakt anlegen") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TabChip("Firma / Organisation", art == "legal") { art = "legal" }
                    TabChip("Privatperson", art == "natural") { art = "natural" }
                }
                Feld(if (art == "legal") "Firmen- oder Organisationsname *" else "Vor- und Nachname *", text, { text = it; fehler = null })
                Text("Kontakttypen *", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                Kontakte.TYPEN.forEach { (k, v) ->
                    val an = k in typen
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(an, { typen = if (an) typen - k else typen + k; fehler = null })
                        Text(v)
                    }
                }
                Text("Adresse, Bankverbindung und weitere Angaben später unter Kontakte.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                fehler?.let { Fehlertext(it) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val form = Kontakte.mitName(basis.copy(typen = typen), art, text)
                val e = model.kontaktPruefen(form)
                if (e.isNotEmpty()) fehler = e.values.first()
                else model.kontaktSpeichern(form) { k, err -> if (k != null) onSaved(k) else fehler = "Speichern fehlgeschlagen: $err" }
            }, enabled = !model.busy) { Text("Anlegen") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Abbrechen") } },
    )
}

@Composable
private fun Fehlertext(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
}

/** Sphäre, Sparte, Nummernkreis, Konto und Umsatzsteuer: gemeinsam für die Buchung und jede Teilbuchung. */
@Composable
internal fun Zuordnung(
    sphaere: String, sparte: String, nummernkreis: String, konto: String, ust: Int, art: String,
    sparten: Map<String, String>, skr: List<de.vereinsmanager.core.skr42.Skr42Main>,
    onSphaere: (String) -> Unit, onSparte: (String) -> Unit,
    onNummernkreis: (de.vereinsmanager.core.skr42.Skr42Main) -> Unit,
    onKonto: (de.vereinsmanager.core.skr42.Skr42Sub) -> Unit, onUst: (Int) -> Unit,
    onNeuesKonto: (() -> Unit)? = null,
) {
    val haupt = BuchungRegeln.hauptkonto(nummernkreis, konto, skr)
    // Passende Nummernkreise zuerst; ein gespeicherter Wert, den der Kontenrahmen nicht kennt, bleibt wählbar.
    val kreise = remember(skr, art, nummernkreis) {
        val m = linkedMapOf<String, String>()
        if (haupt == null && nummernkreis.isNotEmpty()) m[nummernkreis] = nummernkreis
        skr.sortedBy { it.type != art }.forEach { m[it.id] = BuchungRegeln.nummernkreisText(it) }
        m
    }
    val subs = haupt?.subCategories ?: emptyList()
    val kontoMap = linkedMapOf<String, String>()
    if (konto.isNotEmpty() && subs.none { it.label == konto }) kontoMap[konto] = konto
    subs.forEach { kontoMap[it.label] = it.label }
    Auswahl("Steuerlicher Bereich (Sphäre)", FinanceLabels.SPHERE, sphaere, onChange = onSphaere)
    Auswahl("Sparte", sparten, sparte, onChange = onSparte)
    Auswahl("Nummernkreis (SKR 42)", kreise, haupt?.id ?: nummernkreis) { k -> skr.firstOrNull { it.id == k }?.let(onNummernkreis) }
    Auswahl("Konto (SKR 42)", kontoMap, konto) { k -> subs.firstOrNull { it.label == k }?.let(onKonto) }
    if (onNeuesKonto != null) TextButton(onClick = onNeuesKonto) { Text("+ Neues Konto anlegen") }
    Text("Umsatzsteuer", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        BuchungRegeln.UST_SAETZE.forEach { FilterChip(ust == it, { onUst(it) }, { Text("$it %") }) }
    }
}
