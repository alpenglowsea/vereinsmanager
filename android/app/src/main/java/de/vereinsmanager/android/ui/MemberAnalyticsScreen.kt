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
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.TextUnit
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
    DetailKarte(titel) { Column(Modifier.padding(top = 4.dp)) { inhalt() } }
}

/** Farbige Kennzahl-Kachel; alle Kacheln einer Zeile werden gleich hoch ([fillMaxHeight] in einer Zeile mit IntrinsicSize.Min). */
@Composable
private fun Kennzahl(titel: String, wert: String, unten: String, flaeche: Color, text: Color, modifier: Modifier = Modifier, groesse: TextUnit = 28.sp, mitte: Boolean = false) {
    val ausrichtung = if (mitte) androidx.compose.ui.text.style.TextAlign.Center else androidx.compose.ui.text.style.TextAlign.Start
    Column(
        modifier.clip(RoundedCornerShape(22.dp)).background(flaeche).padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalAlignment = if (mitte) Alignment.CenterHorizontally else Alignment.Start,
        verticalArrangement = if (mitte) Arrangement.Center else Arrangement.Top,
    ) {
        Text(titel, color = text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, maxLines = 2, textAlign = ausrichtung)
        Text(wert, color = text, fontSize = groesse, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false, textAlign = ausrichtung)
        if (unten.isNotEmpty()) Text(unten, color = text.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall, maxLines = 2, textAlign = ausrichtung)
    }
}

@Composable
private fun BalkenZeile(links: String, rechts: String, anteil: Int, farbe: Color) {
    Column(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Row {
            Text(links, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text(rechts, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Box(Modifier.fillMaxWidth().height(10.dp).background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(5.dp))) {
            Box(Modifier.fillMaxWidth(anteil.coerceIn(0, 100) / 100f).fillMaxHeight().background(farbe, RoundedCornerShape(5.dp)))
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
    var jahr by model.gemerkt("mitgliederstatistik", "jahr", MemberAnalytics.vorgabeJahr(jahre, heute.year).toString())
    var abteilung by model.gemerkt("mitgliederstatistik", "abteilung", "")
    var tab by remember { mutableStateOf(0) }
    var suche by model.gemerkt("mitgliederstatistik", "suche", "")
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
        Text("Auswertung", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
        if (members.isEmpty()) Text("Keine Mitglieder vorhanden.")

        val sc = MaterialTheme.colorScheme
        val werte = listOf("${k.gesamt}", euro(k.jahresSoll), "${k.sepaProzent} %", "${k.sparten}")
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            // Eine gemeinsame Schriftgröße, so groß wie der längste Wert (meist die Jahresbeiträge) noch in die Kachel passt.
            val innen = (maxWidth - 8.dp) / 2 - 24.dp
            val g = minOf(30f, innen.value / (werte.maxOf { it.length } * 0.62f)).coerceAtLeast(16f).sp
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    Kennzahl("Mitglieder gesamt", werte[0], "${k.aktiv} aktiv · ${k.passiv} passiv", sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                    Kennzahl("Jahresbeiträge (Soll)", werte[1], "Beitragsaufkommen pro Jahr", sc.tertiaryContainer, sc.onTertiaryContainer, gleich, g)
                }
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val gleich = Modifier.weight(1f).fillMaxHeight()
                    Kennzahl("SEPA-Quote", werte[2], "${k.sepa} von ${k.gesamt} per Lastschrift", sc.primaryContainer, sc.onPrimaryContainer, gleich, g)
                    Kennzahl("Sparten", werte[3], "Größte: ${k.groessteSparte ?: "–"} (${k.groessteSparteAnzahl})", sc.secondaryContainer, sc.onSecondaryContainer, gleich, g)
                }
            }
        }

        Kachel("Zu- und Abgänge") {
            Auswahl("Jahr", jahrOptionen, jahr) { jahr = it; limit = 5 }
            Auswahl("Abteilung", abtOptionen, abteilung) { abteilung = it; limit = 5 }
            FilterZuruecksetzen(model, "mitgliederstatistik")
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val gleich = Modifier.weight(1f).fillMaxHeight()
                Kennzahl("Zugänge", "$zu", "", sc.primaryContainer, sc.onPrimaryContainer, gleich, mitte = true)
                Kennzahl("Abgänge", "$ab", "", sc.errorContainer, sc.onErrorContainer, gleich, mitte = true)
                Kennzahl("Netto", if (zu - ab > 0) "+${zu - ab}" else "${zu - ab}", "", sc.secondaryContainer, sc.onSecondaryContainer, gleich, mitte = true)
            }
            Text(if (jahr == "all") "Verlauf je Monat (alle Jahre zusammen)" else "Verlauf je Monat $jahr", style = MaterialTheme.typography.labelLarge)
            val maxWert = maxOf(1, monate.maxOf { maxOf(it.zugaenge, it.abgaenge) })
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                monate.forEach { mo ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(Modifier.height(70.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            Box(Modifier.width(7.dp).height((70f * mo.zugaenge / maxWert).dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)))
                            Box(Modifier.width(7.dp).height((70f * mo.abgaenge / maxWert).dp).background(MaterialTheme.colorScheme.error, RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)))
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
                @Composable fun spalten(a: String, b: String, c: String, d: String, fett: Boolean = false, farbeB: Color = Color.Unspecified, farbeC: Color = Color.Unspecified, mod: Modifier = Modifier) {
                    val w = if (fett) FontWeight.Bold else FontWeight.Normal
                    Row(mod.fillMaxWidth().padding(vertical = 6.dp)) {
                        Text(a, Modifier.width(52.dp), fontWeight = w)
                        Text(b, Modifier.weight(1f), color = farbeB, fontWeight = w, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                        Text(c, Modifier.weight(1f), color = farbeC, fontWeight = w, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                        Text(d, Modifier.weight(1.3f), fontWeight = w, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
                    val k2 = MaterialTheme.typography.labelMedium
                    Text("Jahr", Modifier.width(52.dp), style = k2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Zugänge", Modifier.weight(1f), style = k2, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                    Text("Abgänge", Modifier.weight(1f), style = k2, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                    Text("Saldo", Modifier.weight(1.3f), style = k2, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                }
                HorizontalDivider()
                mehrjahr.forEach { y ->
                    spalten(
                        "${y.jahr}", "+${y.zugaenge}", "−${y.abgaenge}", if (y.saldo > 0) "+${y.saldo}" else "${y.saldo}", fett = jahr == y.jahr.toString(),
                        farbeB = MaterialTheme.colorScheme.primary, farbeC = MaterialTheme.colorScheme.error,
                        mod = Modifier.clickable { jahr = y.jahr.toString(); limit = 5 },
                    )
                    HorizontalDivider()
                }
            }
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TabChip("Alle", tab == 0) { tab = 0; limit = 5 }
                TabChip("Eintritte", tab == 1) { tab = 1; limit = 5 }
                TabChip("Austritte", tab == 2) { tab = 2; limit = 5 }
            }
            OutlinedTextField(suche, { suche = it; limit = 5 }, label = { Text("Suchen (Name, Nr., Sparte)") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
            FilterZuruecksetzen(model, "mitgliederstatistik", Modifier.padding(top = 4.dp))
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
                    TabChip("${beschriftung[g]} $n", geschlecht == g) { geschlecht = if (geschlecht == g) GeschlechtFilter.ALLE else g }
                }
            }
            val farben = listOf(MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.outline)
            MemberAnalytics.altersgruppen(members, geschlecht, heute).forEachIndexed { i, a ->
                BalkenZeile(a.bezeichnung, "${a.anzahl} (${a.prozent} %)", a.prozent, farben[i])
            }
        }

        Kachel("Verteilung nach Mitgliedschaftstyp") {
            MemberAnalytics.typen(members, model.arten).forEach { a -> BalkenZeile(a.bezeichnung, "${a.anzahl} (${a.prozent} %)", a.prozent, MaterialTheme.colorScheme.secondary) }
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
