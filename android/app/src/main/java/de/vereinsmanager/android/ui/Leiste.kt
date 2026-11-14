package de.vereinsmanager.android.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.android.ui.theme.leistenAktivText
import de.vereinsmanager.android.ui.theme.leistenFarbe
import de.vereinsmanager.android.ui.theme.leistenText
import de.vereinsmanager.core.settings.Leiste

/** Die vier Plätze der Leiste als Ziele; kaputte oder fehlende Speicherung ergibt die Voreinstellung. */
fun leistenZiele(model: AppModel): List<Ziel> {
    val namen = Ziel.entries.filter { it.fertig }.map { it.name }.toSet()
    return Leiste.lesen(model.leisteRoh, namen).map { Ziel.valueOf(it) }
}

private val ScrimFarbe = Color(0xFF1A2A1B).copy(alpha = 0.55f)

/**
 * Die Navigationsleiste unten: zwei frei wählbare Ziele links, der Mittelknopf „Neu“, zwei Ziele rechts.
 * Der Mittelknopf ragt aus der Leiste heraus; bei geöffnetem Menü dreht sich sein Plus zum Kreuz, und der Streifen
 * neben ihm wird abgedunkelt wie der Inhalt darüber.
 */
@Composable
fun NavigationsLeiste(
    plaetze: List<Ziel>,
    aktiv: Ziel?,
    menueOffen: Boolean,
    onZiel: (Ziel) -> Unit,
    onMitte: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val leiste = leistenFarbe()
    val text = leistenText()
    val dreh by animateFloatAsState(if (menueOffen) 45f else 0f, label = "plus")
    val oben = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)
    Box(modifier.fillMaxWidth().background(if (menueOffen) ScrimFarbe else Color.Transparent)) {
        Row(
            Modifier.fillMaxWidth().padding(top = 26.dp).background(leiste, oben).windowInsetsPadding(WindowInsets.navigationBars)
                .height(72.dp).padding(horizontal = 4.dp),
            verticalAlignment = Alignment.Top,
        ) {
            plaetze.take(2).forEach { z -> LeistenPlatz(z, z == aktiv, text, onZiel, Modifier.weight(1f)) }
            Spacer(Modifier.weight(1f))
            plaetze.drop(2).forEach { z -> LeistenPlatz(z, z == aktiv, text, onZiel, Modifier.weight(1f)) }
        }
        val knopf: Shape = RoundedCornerShape(22.dp)
        Box(
            Modifier.align(Alignment.TopCenter).size(64.dp).shadow(6.dp, knopf).background(MaterialTheme.colorScheme.tertiaryContainer, knopf)
                .clickable(role = Role.Button, onClick = onMitte)
                .semantics { contentDescription = if (menueOffen) "Menü schließen" else "Neu anlegen" },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.Plus, null, Modifier.size(30.dp).rotate(dreh), tint = MaterialTheme.colorScheme.onTertiaryContainer)
        }
    }
}

@Composable
private fun LeistenPlatz(z: Ziel, aktiv: Boolean, textFarbe: Color, onZiel: (Ziel) -> Unit, modifier: Modifier) {
    val scheme = MaterialTheme.colorScheme
    Column(
        modifier.padding(top = 10.dp).clickable(role = Role.Tab, onClick = { onZiel(z) }).semantics { selected = aktiv },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(width = 56.dp, height = 30.dp).background(if (aktiv) scheme.primaryContainer else Color.Transparent, RoundedCornerShape(15.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(z.icon, null, Modifier.size(22.dp), tint = if (aktiv) scheme.onPrimaryContainer else textFarbe)
        }
        Text(
            z.kurz, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
            fontWeight = if (aktiv) FontWeight.Bold else FontWeight.Medium,
            color = if (aktiv) leistenAktivText() else textFarbe,
        )
    }
}

/**
 * Das Menü des Mittelknopfs: alle Schnellzugriffe des Dashboards (Mitglied, Buchung, Rechnung, Kontakt, Termin, Material, Dokument).
 * Liegt über dem Inhalt; ein Tipp daneben schließt es.
 */
@Composable
fun SchnellMenue(onWahl: (Schnell) -> Unit, onZu: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxSize().background(ScrimFarbe)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onZu),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(Modifier.padding(bottom = 36.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Schnell.entries.reversed().forEachIndexed { i, a ->
                val gelb = i % 2 == 1
                Row(
                    Modifier.clickable { onWahl(a) },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) {
                        Text(a.lang, Modifier.padding(horizontal = 16.dp, vertical = 10.dp), style = MaterialTheme.typography.titleSmall)
                    }
                    Box(
                        Modifier.size(52.dp).background(
                            if (gelb) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.primaryContainer,
                            RoundedCornerShape(18.dp),
                        ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(a.icon, null, Modifier.size(24.dp), tint = if (gelb) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
        }
    }
}

/** Weiche, leicht unterschiedliche Kieselformen für die Kachel-Symbole. */
private val Kiesel = listOf(
    RoundedCornerShape(topStartPercent = 58, topEndPercent = 42, bottomEndPercent = 55, bottomStartPercent = 45),
    RoundedCornerShape(topStartPercent = 45, topEndPercent = 55, bottomEndPercent = 42, bottomStartPercent = 58),
    RoundedCornerShape(topStartPercent = 55, topEndPercent = 45, bottomEndPercent = 58, bottomStartPercent = 42),
)

private class Gruppe(val titel: String, val ziele: List<Ziel>)

private val Gruppen = listOf(
    Gruppe("Übersicht", listOf(Ziel.START)),
    Gruppe("Mitglieder", listOf(Ziel.MITGLIEDER, Ziel.ANTRAEGE, Ziel.MITGLIEDER_AUSWERTUNG)),
    Gruppe("Finanzen", listOf(Ziel.BUCHUNGEN, Ziel.BEITRAGSLAUF, Ziel.EUER, Ziel.RECHNUNGEN, Ziel.SPENDEN, Ziel.FINANZ_AUSWERTUNG)),
    Gruppe("Verein", listOf(Ziel.KONTAKTE, Ziel.KALENDER, Ziel.SITZUNGEN, Ziel.INVENTAR, Ziel.DOKUMENTE, Ziel.EINSTELLUNGEN)),
)

/** Alle Bereiche der App als Kacheln (am Handy ersetzt das die ausklappbare Menüleiste von links). */
@Composable
fun BereicheRaster(vereinsname: String, aktiv: Ziel?, onWahl: (Ziel) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Alle Bereiche", style = MaterialTheme.typography.headlineMedium)
        Text(vereinsname.ifEmpty { "VereinsManager" }, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        var nr = 0
        Gruppen.forEach { g ->
            Text(g.titel, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            g.ziele.chunked(2).forEach { paar ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    paar.forEach { z -> Box(Modifier.weight(1f)) { Kachel(z, nr++, z == aktiv, onWahl) } }
                    if (paar.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Kachel(z: Ziel, nr: Int, aktiv: Boolean, onWahl: (Ziel) -> Unit) {
    val s = MaterialTheme.colorScheme
    val (flaeche, inhalt) = when (nr % 3) {
        0 -> s.primaryContainer to s.onPrimaryContainer
        1 -> s.tertiaryContainer to s.onTertiaryContainer
        else -> s.secondaryContainer to s.onSecondaryContainer
    }
    Card(
        onClick = { onWahl(z) },
        modifier = Modifier.fillMaxWidth().semantics { selected = aktiv },
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = s.surfaceContainerLowest),
        border = BorderStroke(if (aktiv) 2.dp else 1.5.dp, if (aktiv) s.primary else s.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(48.dp).background(flaeche, Kiesel[nr % Kiesel.size]), contentAlignment = Alignment.Center) {
                Icon(z.icon, null, Modifier.size(24.dp), tint = inhalt)
            }
            Text(z.titel, style = MaterialTheme.typography.titleSmall, maxLines = 2, minLines = 2)
        }
    }
}

/** Einstellungen → Allgemein: welche vier Ziele neben dem Mittelknopf stehen. Gilt nur für dieses Gerät. */
@Composable
fun LeisteAnpassenKarte(model: AppModel) {
    val ziele = leistenZiele(model)
    val namen = listOf("Links außen", "Links innen", "Rechts innen", "Rechts außen")
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Navigationsleiste", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "Wählen Sie die vier Bereiche, die am Handy unten in der Leiste stehen (auf dem Tablet steht stattdessen das Menü links). Alle anderen finden Sie über das Menü oben links. " +
                    "Wählen Sie einen Bereich, der schon in der Leiste steht, tauschen beide die Plätze. Die Wahl gilt nur für dieses Gerät und steht nicht in der Datensicherung.",
                style = MaterialTheme.typography.bodySmall,
            )
            ziele.forEachIndexed { platz, z ->
                var offen by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(namen[platz], Modifier.weight(0.4f), style = MaterialTheme.typography.bodyMedium)
                    Box(Modifier.weight(0.6f)) {
                        OutlinedButton(onClick = { offen = true }, modifier = Modifier.fillMaxWidth()) {
                            Icon(z.icon, null, Modifier.size(18.dp))
                            Text(z.kurz, Modifier.padding(start = 8.dp), maxLines = 1)
                        }
                        DropdownMenu(expanded = offen, onDismissRequest = { offen = false }) {
                            Ziel.entries.filter { it.fertig }.forEach { w ->
                                DropdownMenuItem(
                                    text = { Text(w.titel, fontWeight = if (w == z) FontWeight.Bold else FontWeight.Normal) },
                                    leadingIcon = { Icon(w.icon, null, Modifier.size(20.dp)) },
                                    onClick = {
                                        offen = false
                                        model.leisteSpeichern(Leiste.setzen(ziele.map { it.name }, platz, w.name))
                                    },
                                )
                            }
                        }
                    }
                }
            }
            TextButton(onClick = { model.leisteSpeichern(null) }, enabled = model.leisteRoh.isNotEmpty()) { Text("Auf Voreinstellung zurücksetzen") }
        }
    }
}
