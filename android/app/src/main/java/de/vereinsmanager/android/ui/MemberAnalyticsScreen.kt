package de.vereinsmanager.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.members.MemberAnalytics
import de.vereinsmanager.core.members.MemberAnalytics.Art
import de.vereinsmanager.core.members.MemberAnalytics.GeschlechtFilter
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

@Composable
private fun Kachel(titel: String, inhalt: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(titel, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Column(Modifier.padding(top = 10.dp)) { inhalt() }
        }
    }
}

@Composable
private fun Kennzahl(titel: String, wert: String, unten: String, modifier: Modifier = Modifier, hoehe: Dp = 104.dp) {
    Card(modifier.height(hoehe)) {
        Column(Modifier.padding(12.dp)) {
            Text(titel, style = MaterialTheme.typography.labelMedium, maxLines = 1)
            Text(wert, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(unten, style = MaterialTheme.typography.bodySmall, maxLines = 2)
        }
    }
}

@Composable
private fun BalkenZeile(links: String, rechts: String, anteil: Int, farbe: Color) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row {
            Text(links, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            Text(rechts, style = MaterialTheme.typography.bodySmall)
        }
        Box(Modifier.fillMaxWidth().height(8.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(4.dp))) {
            Box(Modifier.fillMaxWidth(anteil.coerceIn(0, 100) / 100f).fillMaxHeight().background(farbe, RoundedCornerShape(4.dp)))
        }
    }
}

/** Auswertung der Mitglieder: Kennzahlen, Zu- und Abgänge, Sparten, Alter, Typen, Zahlungswege. Rechnet live, speichert nichts. */
@Composable
fun MemberAnalyticsScreen(model: AppModel, modifier: Modifier = Modifier) {
    val members = model.members
    val zone = remember { ZoneId.systemDefault() }
    val heute = remember { LocalDate.now() }
    val jahre = remember(members) { MemberAnalytics.verfuegbareJahre(members, heute.year, zone) }
    var jahr by remember(jahre) { mutableStateOf(MemberAnalytics.vorgabeJahr(jahre, heute.year).toString()) }
    var abteilung by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf(0) }
    var suche by remember { mutableStateOf("") }
    var limit by remember { mutableStateOf(5) }
    var geschlecht by remember { mutableStateOf(GeschlechtFilter.ALLE) }

    val k = remember(members) { MemberAnalytics.kennzahlen(members) }
    val jahrWert = jahr.toIntOrNull()
    val abt = abteilung.ifEmpty { null }
    val zu = remember(members, jahr, abteilung) { MemberAnalytics.eintritte(members, jahrWert, abt, zone).size }
    val ab = remember(members, jahr, abteilung) { MemberAnalytics.austritte(members, jahrWert, abt, zone).size }
    val monate = remember(members, jahr, abteilung) { MemberAnalytics.monate(members, jahrWert, abt, zone) }
    val mehrjahr = remember(members, jahr, abteilung) { MemberAnalytics.mehrjahr(members, jahre, abt, zone) }
    val ereignisse = remember(members, jahr, abteilung, tab, suche) {
        MemberAnalytics.suchen(MemberAnalytics.ereignisse(members, jahrWert, abt, zone), suche, when (tab) { 1 -> Art.EINTRITT; 2 -> Art.AUSTRITT; else -> null })
    }
    val abteilungen = remember(members, model.departments) {
        (model.departments + members.map { it.department }).map { it.trim() }.filter { it.isNotEmpty() }.distinct()
            .sortedWith(compareBy(java.text.Collator.getInstance(Locale.GERMANY)) { it })
    }
    val jahrOptionen = remember(jahre) { linkedMapOf("all" to "Alle Jahre").also { m -> jahre.forEach { m[it.toString()] = it.toString() } } }
    val abtOptionen = remember(abteilungen) { linkedMapOf("" to "Alle Abteilungen").also { m -> abteilungen.forEach { m[it] = it } } }

    Column(modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
        Text("Mitglieder-Auswertung", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))
        if (members.isEmpty()) Text("Keine Mitglieder vorhanden.")

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kennzahl("Mitglieder gesamt", "${k.gesamt}", "${k.aktiv} aktiv · ${k.passiv} passiv", Modifier.weight(1f))
            Kennzahl("Jahresbeiträge (Soll)", euro(k.jahresSoll), "Beitragsaufkommen pro Jahr", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Kennzahl("SEPA-Quote", "${k.sepaProzent} %", "${k.sepa} von ${k.gesamt} per Lastschrift", Modifier.weight(1f))
            Kennzahl("Sparten", "${k.sparten}", "Größte: ${k.groessteSparte ?: "–"} (${k.groessteSparteAnzahl})", Modifier.weight(1f))
        }

        Kachel("Zu- und Abgänge") {
            Auswahl("Jahr", jahrOptionen, jahr) { jahr = it; limit = 5 }
            Auswahl("Abteilung", abtOptionen, abteilung) { abteilung = it; limit = 5 }
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Kennzahl("Zugänge", "$zu", "", Modifier.weight(1f), 80.dp)
                Kennzahl("Abgänge", "$ab", "", Modifier.weight(1f), 80.dp)
                Kennzahl("Netto", if (zu - ab > 0) "+${zu - ab}" else "${zu - ab}", "", Modifier.weight(1f), 80.dp)
            }
            Text(if (jahr == "all") "Verlauf je Monat (alle Jahre zusammen)" else "Verlauf je Monat $jahr", style = MaterialTheme.typography.labelLarge)
            val maxWert = maxOf(1, monate.maxOf { maxOf(it.zugaenge, it.abgaenge) })
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                monate.forEach { mo ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(Modifier.height(70.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            Box(Modifier.width(7.dp).height((70f * mo.zugaenge / maxWert).dp).background(MaterialTheme.colorScheme.primary))
                            Box(Modifier.width(7.dp).height((70f * mo.abgaenge / maxWert).dp).background(MaterialTheme.colorScheme.error))
                        }
                        Text(MemberAnalytics.MONATE[mo.index].take(2), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("■ Zugänge", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                Text("■ Abgänge", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
            }
            if (mehrjahr.isNotEmpty()) {
                Text("Entwicklung der letzten Jahre (antippen zum Filtern)", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 12.dp))
                mehrjahr.forEach { y ->
                    Row(Modifier.fillMaxWidth().clickable { jahr = y.jahr.toString(); limit = 5 }.padding(vertical = 6.dp)) {
                        Text("${y.jahr}", Modifier.width(56.dp), fontWeight = if (jahr == y.jahr.toString()) FontWeight.Bold else FontWeight.Normal)
                        Text("+${y.zugaenge}", Modifier.weight(1f), color = MaterialTheme.colorScheme.primary)
                        Text("−${y.abgaenge}", Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
                        Text(if (y.saldo > 0) "Saldo +${y.saldo}" else "Saldo ${y.saldo}")
                    }
                    HorizontalDivider()
                }
            }
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(tab == 0, { tab = 0; limit = 5 }, label = { Text("Alle") })
                FilterChip(tab == 1, { tab = 1; limit = 5 }, label = { Text("Eintritte") })
                FilterChip(tab == 2, { tab = 2; limit = 5 }, label = { Text("Austritte") })
            }
            OutlinedTextField(suche, { suche = it; limit = 5 }, label = { Text("Suchen (Name, Nr., Sparte)") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
            if (ereignisse.isEmpty()) Text("Keine Ereignisse.", Modifier.padding(top = 8.dp))
            ereignisse.take(limit).forEach { e ->
                Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Row {
                        Text(if (e.art == Art.EINTRITT) "Eintritt" else "Austritt", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f),
                            color = if (e.art == Art.EINTRITT) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                        Text(datumKurz(e.datum, zone), style = MaterialTheme.typography.bodySmall)
                    }
                    Text("${e.member.displayName} (${e.member.number})", style = MaterialTheme.typography.bodyMedium)
                    Text(listOf(e.member.department, de.vereinsmanager.core.members.MemberLabels.STATUS[e.member.status] ?: e.member.status).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                }
                HorizontalDivider()
            }
            if (ereignisse.size > limit) {
                OutlinedButton(onClick = { limit += 10 }, modifier = Modifier.padding(top = 8.dp)) { Text("Weitere anzeigen (${ereignisse.size - limit} übrig)") }
            }
        }

        Kachel("Mitglieder und Beitragsaufkommen nach Abteilung") {
            val s = remember(members) { MemberAnalytics.sparten(members) }
            if (s.isEmpty()) Text("Keine aktuellen Mitglieder.")
            s.forEach { z -> BalkenZeile(z.name, "${z.anzahl} (${z.prozent} %) · ${euro(z.jahresSoll)}/J.", z.prozent, MaterialTheme.colorScheme.primary) }
        }

        Kachel("Altersstruktur") {
            val gl = remember(members) { MemberAnalytics.geschlechter(members) }
            val beschriftung = mapOf(GeschlechtFilter.M to "Männlich", GeschlechtFilter.W to "Weiblich", GeschlechtFilter.D to "Divers", GeschlechtFilter.KEIN to "Keine Angabe")
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                gl.forEach { (g, n) ->
                    FilterChip(
                        geschlecht == g, { geschlecht = if (geschlecht == g) GeschlechtFilter.ALLE else g },
                        label = { Text("${beschriftung[g]} $n", maxLines = 1, softWrap = false) },
                    )
                }
            }
            val farben = listOf(MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.outline)
            MemberAnalytics.altersgruppen(members, geschlecht, heute).forEachIndexed { i, a ->
                BalkenZeile(a.bezeichnung, "${a.anzahl} (${a.prozent} %)", a.prozent, farben[i])
            }
        }

        Kachel("Verteilung nach Mitgliedschaftstyp") {
            MemberAnalytics.typen(members).forEach { a -> BalkenZeile(a.bezeichnung, "${a.anzahl} (${a.prozent} %)", a.prozent, MaterialTheme.colorScheme.secondary) }
        }

        Kachel("Zahlungswege und Lastschrifteinzug") {
            Text("${k.sepaProzent} % SEPA", style = MaterialTheme.typography.labelLarge)
            MemberAnalytics.zahlwege(members).forEach { a -> BalkenZeile(a.bezeichnung, "${a.anzahl} (${a.prozent} %)", a.prozent, MaterialTheme.colorScheme.primary) }
        }
        Text("Es zählen aktuelle Mitglieder (nicht gekündigt, nicht ausgetreten), außer bei den Zu- und Abgängen und der Typ-Verteilung.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 8.dp))
    }
}

private fun datumKurz(s: String, zone: ZoneId): String {
    val jm = MemberAnalytics.jahrMonat(s, zone)
    val t = s.trim()
    if (t.contains('T')) runCatching { java.time.Instant.parse(t).atZone(zone).toLocalDate() }.getOrNull()?.let { return deDate(it.toString()) }
    return if (jm != null && Regex("""^\d{4}-\d{2}-\d{2}$""").matches(t)) deDate(t) else t
}
