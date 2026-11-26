package de.vereinsmanager.android.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.BuchungSammel
import de.vereinsmanager.core.finance.FinanceLabels
import de.vereinsmanager.core.finance.SammelBericht
import de.vereinsmanager.core.finance.SammelKategorie

internal fun berichtText(r: SammelBericht): String = buildString {
    append("${r.geaendert} Buchungen geändert")
    if (r.ohneAenderung > 0) append(", ${r.ohneAenderung} waren schon so")
    append(".")
    if (r.ohneZuordnung > 0) append(" Bei ${r.ohneZuordnung} Umbuchungen oder aufgeteilten Buchungen wurden Sphäre, Sparte, Konto (SKR) und Umsatzsteuer nicht geändert, weil sie keine einheitliche Zuordnung haben.")
    if (r.kontoUebersprungen > 0) append(" Bei ${r.kontoUebersprungen} Umbuchungen blieb das Konto, weil Quelle und Ziel sonst gleich wären.")
}

/** Sammelbearbeitung von Buchungen: nur Felder mit Haken werden geändert. */
@Composable
fun BuchungSammelDialog(model: AppModel, anzahl: Int, ids: List<String>, onDismiss: () -> Unit, onDone: (String) -> Unit) {
    val konten = remember(model.konten) { model.konten.associate { it.id to it.name } }
    // Kontenrahmen des Vereins ohne Ausgeblendetes (Einstellungen → Verein → Kontenrahmen)
    val skr = remember(model.kontenrahmen) { model.kontenAuswahl() }
    val hauptAuswahl = remember(skr) { skr.associate { it.code to BuchungRegeln.nummernkreisText(it) } }
    val sparten = remember(model.departments) { linkedMapOf("" to "Keine Sparte").also { m -> model.departments.forEach { m[it] = it } } }

    var kontoOn by remember { mutableStateOf(false) }
    var kontoId by remember { mutableStateOf(model.konten.firstOrNull()?.id.orEmpty()) }
    var sphaereOn by remember { mutableStateOf(false) }
    var sphaere by remember { mutableStateOf("ideell") }
    var sparteOn by remember { mutableStateOf(false) }
    var sparte by remember { mutableStateOf("") }
    var katOn by remember { mutableStateOf(false) }
    var haupt by remember { mutableStateOf(skr.first().code) }
    var unter by remember { mutableStateOf(skr.first().subCategories.firstOrNull()?.code.orEmpty()) }
    var ustOn by remember { mutableStateOf(false) }
    var ust by remember { mutableStateOf(0) }
    var partnerOn by remember { mutableStateOf(false) }
    var partner by remember { mutableStateOf("") }
    var datumOn by remember { mutableStateOf(false) }
    var datum by remember { mutableStateOf("") }
    var notizOn by remember { mutableStateOf(false) }
    var anhaengen by remember { mutableStateOf(true) }
    var notiz by remember { mutableStateOf("") }
    var fehler by remember { mutableStateOf<String?>(null) }

    val hauptKonto = skr.firstOrNull { it.code == haupt }
    val unterKonto = hauptKonto?.subCategories?.firstOrNull { it.code == unter }
    val edit = BuchungSammel(
        kontoId = if (kontoOn) kontoId else null,
        sphaere = if (sphaereOn) sphaere else null,
        sparte = if (sparteOn) sparte else null,
        kategorie = if (katOn && hauptKonto != null && unterKonto != null) SammelKategorie(BuchungRegeln.nummernkreisText(hauptKonto), unterKonto.label, unterKonto.code) else null,
        ust = if (ustOn) ust else null,
        partner = if (partnerOn) partner else null,
        datum = if (datumOn) datum else null,
        notizAnhaengen = if (notizOn && anhaengen) notiz else null,
        notizErsetzen = if (notizOn && !anhaengen) notiz else null,
    )

    Aktionsdialog(
        titel = "Sammelbearbeitung",
        onDismiss = onDismiss,
        inhalt = {
            Text("Betroffen: $anzahl Buchungen. Nur Felder mit Haken werden geändert.")
            Haken("Konto", kontoOn, { kontoOn = it }) { Auswahl("", konten, kontoId) { kontoId = it } }
            Haken("Steuerliche Sphäre", sphaereOn, { sphaereOn = it }) { Auswahl("", FinanceLabels.SPHERE, sphaere) { sphaere = it } }
            Haken("Sparte", sparteOn, { sparteOn = it }) { Auswahl("", sparten, sparte) { sparte = it } }
            Haken("Nummernkreis und Konto (SKR 42)", katOn, { katOn = it }) {
                Auswahl("Nummernkreis", hauptAuswahl, haupt) { h -> haupt = h; unter = skr.firstOrNull { it.code == h }?.subCategories?.firstOrNull()?.code.orEmpty() }
                Auswahl("Konto", hauptKonto?.subCategories?.associate { it.code to it.label }.orEmpty(), unter) { unter = it }
            }
            Haken("Umsatzsteuer", ustOn, { ustOn = it }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    BuchungRegeln.UST_SAETZE.forEach { s -> FilterChip(ust == s, { ust = s }, { Text("$s %") }) }
                }
            }
            Haken("Zahlungspartner", partnerOn, { partnerOn = it }) { Feld("Partner", partner, { partner = it }) }
            Haken("Datum", datumOn, { datumOn = it }) { DatumFeld("Buchungsdatum", datum) { datum = it } }
            Haken("Notiz", notizOn, { notizOn = it }) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(anhaengen, { anhaengen = true }, { Text("Anhängen") })
                    FilterChip(!anhaengen, { anhaengen = false }, { Text("Ersetzen") })
                }
                Feld("Text", notiz, { notiz = it }, singleLine = false, hinweis = if (!anhaengen) "Leer lassen löscht die Notiz" else null)
            }
            Text(
                "Umbuchungen und aufgeteilte Buchungen behalten Sphäre, Sparte, Konto (SKR) und Umsatzsteuer. Die Umsatzsteuer ändert sich beim Wechsel des Kontos nur, wenn sie eigens gewählt ist.",
                style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp),
            )
            if (fehler != null) Text(fehler!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        },
        aktionen = {
            Button(
                onClick = { model.buchungenSammel(ids, edit) { r, e -> if (r == null) fehler = e ?: "Das hat nicht geklappt." else onDone(berichtText(r)) } },
                enabled = !model.busy && !edit.leer && (!datumOn || datum.isNotEmpty()), modifier = Modifier.fillMaxWidth(),
            ) { Text("Übernehmen") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
        },
    )
}
