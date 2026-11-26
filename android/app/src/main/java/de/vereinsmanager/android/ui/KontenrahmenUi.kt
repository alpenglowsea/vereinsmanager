package de.vereinsmanager.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.skr42.Kontenrahmen
import de.vereinsmanager.core.skr42.Skr42Main
import de.vereinsmanager.core.skr42.Skr42Sub

/**
 * Kontenrahmen am Handy (Einstellungen → Verein → „Kontenrahmen“): Nummernkreise und Konten ansehen, anlegen,
 * umbenennen, umnummerieren, Steuersatz-Vorgabe ändern, aus- und einblenden, selbst angelegte löschen. Gleicher Umfang und gleiche
 * Texte wie am Desktop (KontenrahmenKarte.tsx); Regeln im Kern (Kontenrahmen.kt).
 */
@Composable
fun KontenrahmenKarte(model: AppModel) {
    var offen by remember { mutableStateOf(false) }
    val k = model.kontenrahmen
    val anzahl = k.sumOf { it.subCategories.size }
    val angepasst = k.count { it.originalName != null || it.originalCode != null } +
        k.sumOf { m -> m.subCategories.count { it.originalName != null || it.originalVatRate != null || it.originalCode != null } }
    val eigene = k.count { it.isCustom } + k.sumOf { m -> m.subCategories.count { it.isCustom && !m.isCustom } }
    val aus = k.count { it.ausgeblendet } + k.sumOf { m -> m.subCategories.count { it.ausgeblendet } }
    WieseKarte(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Kontenrahmen (SKR 42)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            Text(
                "${k.size} Nummernkreise mit $anzahl Konten, aufsteigend nach Nummer." +
                    (if (eigene + angepasst + aus > 0) " Davon $eigene selbst angelegt, $angepasst angepasst, $aus ausgeblendet." else ""),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "Nummer, Bezeichnung und Steuersatz-Vorgabe lassen sich ändern, auch bei den mitgelieferten Konten. Eine neue Nummer oder Bezeichnung geht auf alle Buchungen über; bekommt ein Nummernkreis eine neue Nummer, ziehen seine Konten mit. Ausgeblendetes erscheint nicht mehr in der Auswahl; Buchungen darauf bleiben, wie sie sind.",
                style = MaterialTheme.typography.bodySmall,
            )
            Button(onClick = { offen = true }, modifier = Modifier.fillMaxWidth()) { Text("Kontenrahmen bearbeiten") }
        }
    }
    if (offen) KontenrahmenAnsicht(model) { offen = false }
}

private sealed interface Wahl {
    data class Kreis(val m: Skr42Main) : Wahl
    data class Konto(val m: Skr42Main, val s: Skr42Sub) : Wahl
}

/** Vollbild mit Suche und der ganzen Liste. Antippen eines Eintrags öffnet seine Aktionen. */
@Composable
private fun KontenrahmenAnsicht(model: AppModel, onClose: () -> Unit) {
    var suche by remember { mutableStateOf("") }
    var ausgeblendeteZeigen by remember { mutableStateOf(false) }
    var aufgeklappt by remember { mutableStateOf(setOf<String>()) }
    var wahl by remember { mutableStateOf<Wahl?>(null) }
    var meldung by remember { mutableStateOf<String?>(null) }
    var neuerKreis by remember { mutableStateOf(false) }
    var neuesKontoIn by remember { mutableStateOf<String?>(null) }

    val q = suche.trim().lowercase()
    val liste = model.kontenrahmen.mapNotNull { m ->
        val kreisPasst = q.isEmpty() || m.code.contains(q) || m.name.lowercase().contains(q)
        val konten = m.subCategories.filter { s ->
            (ausgeblendeteZeigen || !s.ausgeblendet) && (kreisPasst || s.code.contains(q) || Kontenrahmen.kontoBezeichnung(s).lowercase().contains(q))
        }
        if ((ausgeblendeteZeigen || !m.ausgeblendet) && (kreisPasst || konten.isNotEmpty())) m to konten else null
    }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Kontenrahmen", Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                    Button(onClick = onClose) { Text("Schließen") }
                }
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Feld("Suchen (Nummer oder Bezeichnung)", suche, { suche = it })
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(ausgeblendeteZeigen, { ausgeblendeteZeigen = it })
                        Text("Ausgeblendete zeigen", Modifier.clickable { ausgeblendeteZeigen = !ausgeblendeteZeigen })
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { neuerKreis = true }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Neuer Nummernkreis", maxLines = 1) }
                        Button(onClick = { neuesKontoIn = model.kontenrahmen.firstOrNull()?.code.orEmpty() }, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Neues Konto", maxLines = 1) }
                    }
                }
                HorizontalDivider(Modifier.padding(top = 8.dp))
                LazyColumn(Modifier.weight(1f)) {
                    if (liste.isEmpty()) item { Text("Nichts gefunden.", Modifier.padding(16.dp)) }
                    for ((m, konten) in liste) {
                        // nach der Kennung (bleibt beim Umnummerieren gleich), nicht nach der Nummer
                        val zeigen = m.id in aufgeklappt || q.isNotEmpty()
                        item(key = "k-${m.id}") {
                            Row(
                                Modifier.fillMaxWidth().clickable { aufgeklappt = if (m.id in aufgeklappt) aufgeklappt - m.id else aufgeklappt + m.id }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(if (zeigen) "▾" else "▸", Modifier.width(18.dp))
                                Text(m.code, Modifier.width(64.dp), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                Column(Modifier.weight(1f)) {
                                    Text(m.name, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        listOfNotNull(
                                            if (m.type == "income") "Einnahmen" else "Ausgaben",
                                            "${m.subCategories.size} ${if (m.subCategories.size == 1) "Konto" else "Konten"}",
                                            "eigen".takeIf { m.isCustom }, "angepasst".takeIf { m.originalName != null || m.originalCode != null },
                                            "ausgeblendet".takeIf { m.ausgeblendet },
                                        ).joinToString(" · "),
                                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                TextButton(onClick = { wahl = Wahl.Kreis(m) }) { Text("…", fontWeight = FontWeight.Bold) }
                            }
                        }
                        if (zeigen) {
                            items(konten, key = { "s-${m.id}-${it.code}" }) { s ->
                                Row(
                                    Modifier.fillMaxWidth().clickable { wahl = Wahl.Konto(m, s) }.padding(start = 34.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(s.code, Modifier.width(64.dp), fontFamily = FontFamily.Monospace)
                                    Column(Modifier.weight(1f)) {
                                        Text(Kontenrahmen.kontoBezeichnung(s), maxLines = 2, overflow = TextOverflow.Ellipsis,
                                            color = if (s.ausgeblendet) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                                        Text(
                                            listOfNotNull(
                                                "USt ${s.vatRateDefault} %", "eigen".takeIf { s.isCustom },
                                                "angepasst".takeIf { s.originalName != null || s.originalVatRate != null || s.originalCode != null },
                                                "ausgeblendet".takeIf { s.ausgeblendet },
                                            ).joinToString(" · "),
                                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                            if (konten.isEmpty()) item(key = "leer-${m.id}") { Text("Keine sichtbaren Konten.", Modifier.padding(start = 34.dp, bottom = 8.dp), style = MaterialTheme.typography.bodySmall) }
                        }
                        item(key = "t-${m.id}") { HorizontalDivider() }
                    }
                }
            }
        }
    }

    when (val w = wahl) {
        is Wahl.Kreis -> KreisAktionen(model, w.m, onNeuesKonto = { wahl = null; neuesKontoIn = w.m.code }, onFertig = { t -> wahl = null; if (t != null) meldung = t })
        is Wahl.Konto -> KontoAktionen(model, w.m, w.s, onFertig = { t -> wahl = null; if (t != null) meldung = t })
        null -> {}
    }
    if (neuerKreis) NummernkreisAnlegenDialog(model) { t -> neuerKreis = false; if (t != null) meldung = t }
    neuesKontoIn?.let { kreis -> KontoAnlegenDialog(model, kreis) { s, t -> neuesKontoIn = null; if (s != null) aufgeklappt = aufgeklappt + (model.kontenrahmen.firstOrNull { m -> m.subCategories.any { it.code == s.code } }?.id ?: ""); if (t != null) meldung = t } }
    meldung?.let { m ->
        Aktionsdialog(titel = "Kontenrahmen", onDismiss = { meldung = null }, inhalt = { Text(m) }, aktionen = { TextButton(onClick = { meldung = null }, modifier = Modifier.fillMaxWidth()) { Text("OK") } })
    }
}

private fun buchungenText(n: Int) = if (n == 1) "1 Buchung trägt" else "$n Buchungen tragen"
/** 9000 → „9.000“ (Tausenderpunkte wie am Desktop). */
private fun mitPunkten(n: Long): String = (if (n < 0) "-" else "") + kotlin.math.abs(n).toString().reversed().chunked(3).joinToString(".").reversed()
private fun angepasstText(n: Int) = when (n) { 0 -> ""; 1 -> " 1 Buchung angepasst."; else -> " $n Buchungen angepasst." }

/**
 * Neue Nummer für ein Konto oder einen Nummernkreis, in zwei Schritten wie am Desktop: erst prüfen (Fehler oder was
 * sich ändert: Buchungen, mitziehende Konten), dann übernehmen.
 */
@Composable
private fun NummerDialog(model: AppModel, konto: Boolean, code: String, was: String, onAbbrechen: () -> Unit, onFertig: (String?) -> Unit) {
    var nummer by remember { mutableStateOf(code) }
    var fehler by remember { mutableStateOf<String?>(null) }
    var vorschau by remember { mutableStateOf<Kontenrahmen.Vorschau?>(null) }
    val neu = nummer.trim()
    Aktionsdialog(titel = "$was: neue Nummer", onDismiss = onAbbrechen, inhalt = {
        Feld("Neue Nummer", nummer, { nummer = it.filter(Char::isDigit).take(6); vorschau = null; fehler = null }, keyboard = KeyboardType.Number, error = fehler)
        if (!konto) Text("Die Konten des Nummernkreises ziehen um denselben Abstand mit.", style = MaterialTheme.typography.bodySmall)
        vorschau?.let { v ->
            val abstand = (neu.toLongOrNull() ?: 0L) - (code.toLongOrNull() ?: 0L)
            Text(
                listOfNotNull(
                    "$was bekommt die Nummer $neu.",
                    if (!konto && v.konten > 0) (if (v.konten == 1) "Sein Konto zieht" else "Seine ${v.konten} Konten ziehen") +
                        " um ${if (abstand > 0) "+" else ""}${mitPunkten(abstand)} mit." else null,
                    if (v.buchungen > 0) "${v.buchungen} ${if (v.buchungen == 1) "Buchung bekommt" else "Buchungen bekommen"} die neue Nummer." else null,
                ).joinToString(" "),
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }, aktionen = {
        if (vorschau == null) {
            Button(onClick = {
                model.kontenrahmenVorschau(konto, code, nummer = neu) { v, e -> if (e != null || v?.fehler != null) fehler = e ?: v!!.fehler else vorschau = v }
            }, enabled = !model.busy && neu.isNotEmpty() && neu != code, modifier = Modifier.fillMaxWidth()) { Text("Prüfen") }
        } else {
            Button(onClick = {
                model.kontenrahmenAendern(konto, code, nummer = neu) { r, e ->
                    if (e != null) { fehler = e; vorschau = null }
                    else onFertig("$was hat jetzt die Nummer ${r!!.code}." +
                        (if (!konto && vorschau!!.konten > 0) " ${if (vorschau!!.konten == 1) "1 Konto" else "${vorschau!!.konten} Konten"} umnummeriert." else "") +
                        angepasstText(r.buchungen))
                }
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Übernehmen") }
        }
        TextButton(onClick = onAbbrechen, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

/** Aktionen für einen Nummernkreis. [onFertig] bekommt die Rückmeldung oder null (abgebrochen). */
@Composable
private fun KreisAktionen(model: AppModel, m: Skr42Main, onNeuesKonto: () -> Unit, onFertig: (String?) -> Unit) {
    var umbenennen by remember { mutableStateOf(false) }
    var nummer by remember { mutableStateOf(false) }
    if (nummer) {
        NummerDialog(model, konto = false, code = m.code, was = "Nummernkreis ${m.code}", onAbbrechen = { nummer = false }, onFertig = onFertig)
        return
    }
    var loeschen by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    if (umbenennen) {
        UmbenennenDialog(model, "Nummernkreis ${m.code}", m.name, model.kontoBuchungen(m.code, nummernkreis = true), fehler,
            onAbbrechen = { umbenennen = false; fehler = null },
        ) { name -> model.nummernkreisAendern(m.code, name = name) { n, e -> if (e != null) fehler = e else onFertig("${m.code} heißt jetzt „${name.trim()}“." + if ((n ?: 0) > 0) " ${buchungenText(n!!)} die neue Bezeichnung." else "") } }
        return
    }
    if (loeschen) {
        Bestaetigen("Nummernkreis löschen?", "Den selbst angelegten Nummernkreis ${m.code} „${m.name}“ mit allen seinen Konten löschen?", "Löschen", fehler, { loeschen = false; fehler = null }) {
            model.nummernkreisLoeschen(m.code) { e -> if (e != null) fehler = e else onFertig("Nummernkreis ${m.code} gelöscht.") }
        }
        return
    }
    Aktionsdialog(titel = "${m.code} ${m.name}", onDismiss = { onFertig(null) }, inhalt = {
        if (m.originalCode != null) Text("Ursprüngliche Nummer: ${m.originalCode}", style = MaterialTheme.typography.bodySmall)
        if (m.originalName != null) Text("Original: ${m.originalName}", style = MaterialTheme.typography.bodySmall)
    }, aktionen = {
        Button(onClick = onNeuesKonto, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Konto in diesem Nummernkreis anlegen") }
        OutlinedButton(onClick = { nummer = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Nummer ändern") }
        OutlinedButton(onClick = { umbenennen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Bezeichnung ändern") }
        if (m.originalName != null || m.originalCode != null) {
            // zurück auf Nummer und Bezeichnung des Originals; bei der Nummer ziehen die Konten wieder mit
            OutlinedButton(onClick = {
                model.kontenrahmenAendern(false, m.code, nummer = m.originalCode, name = m.originalName) { r, e ->
                    onFertig(e ?: ("Nummernkreis ${r!!.code} ist wieder im Original." + angepasstText(r.buchungen)))
                }
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Zurück auf das Original") }
        }
        OutlinedButton(onClick = { model.nummernkreisAendern(m.code, ausgeblendet = !m.ausgeblendet) { _, e -> onFertig(e ?: "Nummernkreis ${m.code} ${if (m.ausgeblendet) "wieder eingeblendet" else "ausgeblendet"}.") } },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text(if (m.ausgeblendet) "Wieder einblenden" else "Ausblenden") }
        if (m.isCustom) OutlinedButton(onClick = { loeschen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Löschen", color = MaterialTheme.colorScheme.error) }
        TextButton(onClick = { onFertig(null) }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

/** Aktionen für ein Konto. */
@Composable
private fun KontoAktionen(model: AppModel, m: Skr42Main, s: Skr42Sub, onFertig: (String?) -> Unit) {
    var umbenennen by remember { mutableStateOf(false) }
    var nummer by remember { mutableStateOf(false) }
    if (nummer) {
        NummerDialog(model, konto = true, code = s.code, was = "Konto ${s.code}", onAbbrechen = { nummer = false }, onFertig = onFertig)
        return
    }
    var loeschen by remember { mutableStateOf(false) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val bez = Kontenrahmen.kontoBezeichnung(s)
    if (umbenennen) {
        UmbenennenDialog(model, "Konto ${s.code}", bez, model.kontoBuchungen(s.code, nummernkreis = false), fehler,
            onAbbrechen = { umbenennen = false; fehler = null },
        ) { name -> model.kontoAendern(s.code, name = name) { n, e -> if (e != null) fehler = e else onFertig("${s.code} heißt jetzt „${name.trim()}“." + if ((n ?: 0) > 0) " ${buchungenText(n!!)} die neue Bezeichnung." else "") } }
        return
    }
    if (loeschen) {
        Bestaetigen("Konto löschen?", "Das selbst angelegte Konto ${s.code} „$bez“ löschen?", "Löschen", fehler, { loeschen = false; fehler = null }) {
            model.kontoLoeschen(s.code) { e -> if (e != null) fehler = e else onFertig("Konto ${s.code} gelöscht.") }
        }
        return
    }
    Aktionsdialog(titel = "${s.code} $bez", onDismiss = { onFertig(null) }, inhalt = {
        Text("Nummernkreis ${m.code} ${m.name}", style = MaterialTheme.typography.bodySmall)
        if (s.originalCode != null) Text("Ursprüngliche Nummer: ${s.originalCode}", style = MaterialTheme.typography.bodySmall)
        if (s.originalName != null) Text("Original: ${s.originalName}", style = MaterialTheme.typography.bodySmall)
        Text("Steuersatz-Vorgabe", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0, 7, 19).forEach { u ->
                FilterChip(s.vatRateDefault == u, {
                    if (u != s.vatRateDefault) model.kontoAendern(s.code, ust = u) { _, e -> onFertig(e ?: "Konto ${s.code}: Steuersatz-Vorgabe jetzt $u %. Bestehende Buchungen bleiben unverändert.") }
                }, { Text("$u %") }, enabled = !model.busy)
            }
        }
        s.originalVatRate?.let { Text("Original: $it %", style = MaterialTheme.typography.bodySmall) }
    }, aktionen = {
        OutlinedButton(onClick = { nummer = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Nummer ändern") }
        OutlinedButton(onClick = { umbenennen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Bezeichnung ändern") }
        if (s.originalName != null || s.originalVatRate != null || s.originalCode != null) {
            OutlinedButton(onClick = {
                model.kontenrahmenAendern(true, s.code, nummer = s.originalCode, name = s.originalName, ust = s.originalVatRate) { r, e ->
                    onFertig(e ?: ("Konto ${r!!.code} ist wieder im Original." + angepasstText(r.buchungen)))
                }
            }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Zurück auf das Original") }
        }
        OutlinedButton(onClick = { model.kontoAendern(s.code, ausgeblendet = !s.ausgeblendet) { _, e -> onFertig(e ?: "Konto ${s.code} ${if (s.ausgeblendet) "wieder eingeblendet" else "ausgeblendet"}.") } },
            enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text(if (s.ausgeblendet) "Wieder einblenden" else "Ausblenden") }
        if (s.isCustom) OutlinedButton(onClick = { loeschen = true }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Löschen", color = MaterialTheme.colorScheme.error) }
        TextButton(onClick = { onFertig(null) }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

@Composable
private fun UmbenennenDialog(
    model: AppModel, was: String, bisher: String, buchungen: Int, fehler: String?,
    onAbbrechen: () -> Unit, onSpeichern: (String) -> Unit,
) {
    var name by remember { mutableStateOf(bisher) }
    Aktionsdialog(titel = "$was umbenennen", onDismiss = onAbbrechen, inhalt = {
        Feld("Neue Bezeichnung", name, { name = it }, error = fehler)
        if (buchungen > 0) Text("$was steht in $buchungen ${if (buchungen == 1) "Buchung" else "Buchungen"}. Die neue Bezeichnung geht auf alle über.", style = MaterialTheme.typography.bodySmall)
    }, aktionen = {
        Button(onClick = { onSpeichern(name) }, enabled = !model.busy && name.isNotBlank() && name.trim() != bisher, modifier = Modifier.fillMaxWidth()) { Text("Übernehmen") }
        TextButton(onClick = onAbbrechen, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

@Composable
private fun Bestaetigen(titel: String, text: String, knopf: String, fehler: String?, onAbbrechen: () -> Unit, onJa: () -> Unit) {
    Aktionsdialog(titel = titel, onDismiss = onAbbrechen, inhalt = {
        Text(text)
        fehler?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
    }, aktionen = {
        Button(onClick = onJa, modifier = Modifier.fillMaxWidth()) { Text(knopf) }
        TextButton(onClick = onAbbrechen, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

/** Neuer Nummernkreis mit erstem Konto (gleiche Nummer und Bezeichnung, wie am Desktop). */
@Composable
internal fun NummernkreisAnlegenDialog(model: AppModel, typVorgabe: String = "income", onFertig: (String?) -> Unit) {
    var typ by remember { mutableStateOf(typVorgabe) }
    var nummer by remember { mutableStateOf(Kontenrahmen.vorschlagNummer(model.kontenrahmen, typVorgabe)) }
    var name by remember { mutableStateOf("") }
    var ust by remember { mutableStateOf(0) }
    var fehler by remember { mutableStateOf<String?>(null) }
    Aktionsdialog(titel = "Neuer Nummernkreis", onDismiss = { onFertig(null) }, inhalt = {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(typ == "income", { typ = "income"; nummer = Kontenrahmen.vorschlagNummer(model.kontenrahmen, "income") }, { Text("Einnahmen") })
            FilterChip(typ == "expense", { typ = "expense"; nummer = Kontenrahmen.vorschlagNummer(model.kontenrahmen, "expense") }, { Text("Ausgaben") })
        }
        Feld("Nummer", nummer, { nummer = it }, keyboard = KeyboardType.Number)
        Feld("Bezeichnung", name, { name = it })
        Text("Steuersatz-Vorgabe des ersten Kontos", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(0, 7, 19).forEach { u -> FilterChip(ust == u, { ust = u }, { Text("$u %") }) } }
        Text("Es entsteht zugleich ein erstes Konto mit derselben Nummer und Bezeichnung.", style = MaterialTheme.typography.bodySmall)
        fehler?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }, aktionen = {
        Button(onClick = {
            model.nummernkreisAnlegen(nummer, name, typ, ust) { m, e -> if (e != null) fehler = e else onFertig("Nummernkreis ${m!!.code} „${m.name}“ angelegt.") }
        }, enabled = !model.busy && nummer.isNotBlank() && name.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Anlegen") }
        TextButton(onClick = { onFertig(null) }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}

/**
 * Neues Konto in einem Nummernkreis; auch aus dem Buchungsformular erreichbar. [onFertig] bekommt das neue Konto (oder
 * null) und die Rückmeldung (null bei Abbruch).
 */
@Composable
internal fun KontoAnlegenDialog(model: AppModel, kreisVorgabe: String, onFertig: (Skr42Sub?, String?) -> Unit) {
    var kreis by remember { mutableStateOf(kreisVorgabe.ifEmpty { model.kontenrahmen.firstOrNull()?.code.orEmpty() }) }
    val typ = model.kontenrahmen.firstOrNull { it.code == kreis }?.type ?: "income"
    var nummer by remember { mutableStateOf(Kontenrahmen.vorschlagNummer(model.kontenrahmen, typ, kreis)) }
    var name by remember { mutableStateOf("") }
    var ust by remember { mutableStateOf(0) }
    var fehler by remember { mutableStateOf<String?>(null) }
    val kreise = remember(model.kontenrahmen) { model.kontenrahmen.associate { it.code to "${it.code} - ${it.name}" } }
    Aktionsdialog(titel = "Neues Konto", onDismiss = { onFertig(null, null) }, inhalt = {
        Auswahl("Nummernkreis", kreise, kreis) { k -> kreis = k; nummer = Kontenrahmen.vorschlagNummer(model.kontenrahmen, typ, k) }
        Feld("Nummer", nummer, { nummer = it }, keyboard = KeyboardType.Number)
        Feld("Bezeichnung", name, { name = it })
        Text("Steuersatz-Vorgabe", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(0, 7, 19).forEach { u -> FilterChip(ust == u, { ust = u }, { Text("$u %") }) } }
        fehler?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }, aktionen = {
        Button(onClick = {
            model.kontoAnlegen(kreis, nummer, name, ust) { s, e -> if (e != null) fehler = e else onFertig(s, "Konto ${s!!.code} „${s.name}“ in $kreis angelegt.") }
        }, enabled = !model.busy && nummer.isNotBlank() && name.isNotBlank() && kreis.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text("Anlegen") }
        TextButton(onClick = { onFertig(null, null) }, modifier = Modifier.fillMaxWidth()) { Text("Abbrechen") }
    })
}
