package de.vereinsmanager.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.finance.TeilForm
import de.vereinsmanager.core.skr42.Skr42
import java.math.BigDecimal

/** Anlegen (id == null) und Bearbeiten einer Buchung. Alle Regeln stecken im Kern ([BuchungRegeln]). */
@Composable
fun BuchungFormScreen(model: AppModel, id: String?, onDone: () -> Unit, modifier: Modifier = Modifier) {
    val vorhanden: Buchung? = remember(id) { id?.let { i -> model.buchungen.firstOrNull { it.id == i } } }
    var f by remember(id) { mutableStateOf(vorhanden?.let { BuchungRegeln.von(it) } ?: model.neueBuchung()) }
    var fehler by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var speicherFehler by remember { mutableStateOf<String?>(null) }
    val skr = Skr42.standard

    val kontoAuswahl = remember(model.konten) { model.konten.associate { it.id to it.name } }
    val sparten = remember(model.departments, f.sparte, f.teile) {
        val liste = linkedMapOf("" to "Keine Sparte")
        model.departments.forEach { liste[it] = it }
        (listOf(f.sparte) + f.teile.map { it.sparte }).filter { it.isNotEmpty() }.forEach { liste.putIfAbsent(it, it) }
        liste
    }
    val vorschlaege = remember(model.buchungen, model.members) {
        (model.buchungen.map { it.partner } + model.members.map { "${it.firstName} ${it.lastName}".trim() })
            .map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    }

    Column(modifier.padding(horizontal = 16.dp)) {
        Text(
            if (vorhanden == null) "Neue Buchung" else "Buchung bearbeiten",
            style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp),
        )
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
            Text("Buchungsart", style = MaterialTheme.typography.labelMedium)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FinanceLabels.KIND.forEach { (k, v) ->
                    FilterChip(f.art == k, { f = BuchungRegeln.mitArt(f, k, skr) }, { Text(v) })
                }
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
                Feld("Zahlungspartner *", f.partner, { f = f.copy(partner = it) }, fehler["partner"])
                val q = f.partner.trim()
                val treffer = if (q.length < 2) emptyList()
                else vorschlaege.filter { it.contains(q, ignoreCase = true) && !it.equals(q, ignoreCase = true) }.take(5)
                if (treffer.isNotEmpty()) {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        treffer.forEach { AssistChip(onClick = { f = f.copy(partner = it) }, label = { Text(it) }) }
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(f.aufgeteilt, { an -> f = if (an) BuchungRegeln.aufteilen(f, skr) else f.copy(aufgeteilt = false) })
                    Text("Splittbuchung (auf mehrere Konten aufteilen)")
                }
                if (!f.aufgeteilt) {
                    Zuordnung(
                        sphaere = f.sphaere, sparte = f.sparte, nummernkreis = f.nummernkreis, konto = f.konto, ust = f.ust,
                        art = f.art, sparten = sparten, skr = skr,
                        onSphaere = { f = f.copy(sphaere = it) }, onSparte = { f = f.copy(sparte = it) },
                        onNummernkreis = { f = BuchungRegeln.mitNummernkreis(f, it) },
                        onKonto = { f = BuchungRegeln.mitKonto(f, it) }, onUst = { f = f.copy(ust = it) },
                    )
                } else {
                    f.teile.forEachIndexed { i, t ->
                        Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            Column(Modifier.padding(12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Teil ${i + 1}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                                    if (f.teile.size > 2) {
                                        TextButton(onClick = { f = f.copy(teile = f.teile.filterIndexed { j, _ -> j != i }) }) { Text("Entfernen") }
                                    }
                                }
                                fun setze(neu: TeilForm) { f = f.copy(teile = f.teile.mapIndexed { j, x -> if (j == i) neu else x }) }
                                Feld("Teilbetrag (€)", t.betrag, { setze(t.copy(betrag = it)) }, keyboard = KeyboardType.Decimal)
                                Feld("Text", t.text, { setze(t.copy(text = it)) })
                                Zuordnung(
                                    sphaere = t.sphaere, sparte = t.sparte, nummernkreis = t.nummernkreis, konto = t.konto, ust = t.ust,
                                    art = f.art, sparten = sparten, skr = skr,
                                    onSphaere = { setze(t.copy(sphaere = it)) }, onSparte = { setze(t.copy(sparte = it)) },
                                    onNummernkreis = { setze(BuchungRegeln.teilMitNummernkreis(t, it)) },
                                    onKonto = { setze(BuchungRegeln.teilMitKonto(t, it)) }, onUst = { setze(t.copy(ust = it)) },
                                )
                            }
                        }
                    }
                    OutlinedButton(onClick = {
                        f = f.copy(teile = f.teile + BuchungRegeln.neuerTeil("split-${System.currentTimeMillis()}-${f.teile.size + 1}", f.sphaere, skr))
                    }) { Text("Teilbuchung hinzufügen") }
                    val gesamt = BuchungRegeln.parseBetrag(f.betrag) ?: BigDecimal.ZERO
                    val summe = BuchungRegeln.teilSumme(f)
                    Text(
                        "Summe der Teile ${Geld.euro(summe)} von ${Geld.euro(gesamt)}",
                        style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold,
                        color = if (summe.compareTo(gesamt) == 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    if (fehler["teile"] != null) Fehlertext(fehler["teile"]!!)
                }
            }
            Feld("Notiz", f.notiz, { f = f.copy(notiz = it) }, singleLine = false)
            if (vorhanden?.beleg != null) {
                Text("Der angehängte Beleg bleibt unverändert erhalten.", style = MaterialTheme.typography.bodySmall)
            }
        }
        if (speicherFehler != null) Text(speicherFehler!!, color = MaterialTheme.colorScheme.error)
        if (fehler.isNotEmpty()) Text("Bitte die markierten Angaben prüfen.", color = MaterialTheme.colorScheme.error)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                enabled = !model.busy,
                onClick = {
                    val e = BuchungRegeln.pruefen(f, model.konten)
                    fehler = e
                    if (e.isEmpty()) {
                        speicherFehler = null
                        model.saveBuchung(f) { err -> if (err == null) onDone() else speicherFehler = "Speichern fehlgeschlagen: $err" }
                    }
                },
            ) { Text("Speichern") }
            OutlinedButton(onClick = onDone) { Text("Abbrechen") }
        }
    }
}

@Composable
private fun Fehlertext(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
}

/** Sphäre, Sparte, Nummernkreis, Konto und Umsatzsteuer: gemeinsam für die Buchung und jede Teilbuchung. */
@Composable
private fun Zuordnung(
    sphaere: String, sparte: String, nummernkreis: String, konto: String, ust: Int, art: String,
    sparten: Map<String, String>, skr: List<de.vereinsmanager.core.skr42.Skr42Main>,
    onSphaere: (String) -> Unit, onSparte: (String) -> Unit,
    onNummernkreis: (de.vereinsmanager.core.skr42.Skr42Main) -> Unit,
    onKonto: (de.vereinsmanager.core.skr42.Skr42Sub) -> Unit, onUst: (Int) -> Unit,
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
    Text("Umsatzsteuer", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        BuchungRegeln.UST_SAETZE.forEach { FilterChip(ust == it, { onUst(it) }, { Text("$it %") }) }
    }
}
