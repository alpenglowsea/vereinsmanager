package de.vereinsmanager.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import de.vereinsmanager.android.AppModel
import de.vereinsmanager.core.calendar.Kalender
import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.dashboard.Dashboard
import de.vereinsmanager.core.dashboard.Kachel
import de.vereinsmanager.core.dashboard.Vorlage
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Geld
import de.vereinsmanager.core.meeting.Sitzungen
import de.vereinsmanager.core.members.Zeit
import java.math.BigDecimal
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Die Schnellzugriffe des Dashboards. */
enum class Schnell(val text: String, val lang: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    MITGLIED("Mitglied", "Mitglied aufnehmen", Lucide.Users),
    BUCHUNG("Buchung", "Buchung erfassen", Lucide.Wallet),
    RECHNUNG("Rechnung", "Rechnung schreiben", Lucide.FileText),
    KONTAKT("Kontakt", "Kontakt anlegen", Lucide.Contact),
    TERMIN("Termin", "Termin anlegen", Lucide.CalendarDays),
    MATERIAL("Material", "Gegenstand erfassen", Lucide.Package),
    DOKUMENT("Dokument", "Dokument anlegen", Lucide.FolderArchive),
}

/**
 * Das Dashboard: die Kacheln der gewählten Anordnung untereinander, Kennzahlen zu zweit nebeneinander. Alle Zahlen kommen aus
 * `Dashboard` im Kern und damit aus denselben Rechnungen wie die Bereiche selbst; ein Tipp auf eine Kachel öffnet den Bereich.
 * Die Anordnung lässt sich anpassen und liegt im selben Bereich der Sicherung wie am Desktop.
 */
@Composable
fun DashboardScreen(
    model: AppModel, onZiel: (Ziel) -> Unit, onSchnell: (Schnell) -> Unit, modifier: Modifier = Modifier,
    /** Tippen auf einen Termin: Kalender an diesem Tag mit den Details (T-245, wie am Desktop). */
    onTermin: (String, String) -> Unit = { _, _ -> },
    /** Tippen auf einen Eintrag „Unterlagen laufen ab“: das Mitglied öffnen (Paket U). */
    onMitglied: (String) -> Unit = {},
) {
    var anpassen by remember { mutableStateOf(false) }
    BackHandler(enabled = anpassen) { anpassen = false }
    val heute = remember(model.stand) { LocalDate.now() }
    val daten = remember(model.stand, heute) { DashboardRechner(model, heute) }
    val kacheln = Dashboard.sichtbar(model.dashboard)
    val reihen = remember(kacheln) { gruppiere(kacheln) }

    if (anpassen) AnpassenAnsicht(model, onFertig = { anpassen = false }, modifier)
    else Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (model.clubName.isEmpty()) Text(
            "Noch keine Vereinsdaten – tragen Sie sie unter „Einstellungen“ ein oder spielen Sie dort eine Sicherung ein.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (kacheln.isEmpty()) Text("Noch keine Kacheln ausgewählt. Unten können Sie welche hinzufügen.", style = MaterialTheme.typography.bodyMedium)
        reihen.forEach { reihe ->
            if (reihe.size == 2) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    reihe.forEach { k -> Box(Modifier.weight(1f).fillMaxHeight()) { CompositionLocalProvider(LocalStil provides stilFuer(k.id)) { KachelInhalt(model, daten, k, onZiel, onSchnell, onTermin, onMitglied) } } }
                }
            } else CompositionLocalProvider(LocalStil provides stilFuer(reihe.first().id)) { KachelInhalt(model, daten, reihe.first(), onZiel, onSchnell, onTermin, onMitglied) }
        }
        FilledTonalButton(onClick = { anpassen = true }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) { Text("Dashboard anpassen") }
    }
}

/** Zwei aufeinanderfolgende Kennzahl-Kacheln stehen nebeneinander; eine einzelne bekommt die volle Breite. */
private fun gruppiere(liste: List<Kachel>): List<List<Kachel>> {
    val out = ArrayList<List<Kachel>>()
    var i = 0
    while (i < liste.size) {
        val k = liste[i]
        if (k.kompakt && i + 1 < liste.size && liste[i + 1].kompakt) { out += listOf(k, liste[i + 1]); i += 2 } else { out += listOf(k); i += 1 }
    }
    return out
}

/** Rechnet jede Kennzahl erst, wenn eine angezeigte Kachel sie braucht, und dann nur einmal je Stand der Daten. */
private class DashboardRechner(val model: AppModel, val heute: LocalDate) {
    val mitglieder by lazy { Dashboard.mitglieder(model.members, heute) }
    val finanzen by lazy { Dashboard.finanzen(model.konten, model.buchungen, heute, model.spendenkreis) }
    val sepa by lazy { Dashboard.sepa(model.members, model.vereinsdaten) }
    val spenden by lazy { Dashboard.spenden(model.spenden, heute) }
    val rechnungen by lazy { Dashboard.rechnungen(model.rechnungen, heute) }
    val kontakte by lazy { Dashboard.kontakte(model.kontakte, Kontakte.TYPEN.keys) }
    val termine by lazy { Dashboard.termine(model.termine, heute) }
    val sitzungen by lazy { Dashboard.sitzungen(model.sitzungen, heute) }
    val inventar by lazy { Dashboard.inventar(model.inventar, heute).kennzahlen }
    val dokumente by lazy { Dashboard.dokumente(model.dokumente) }
    val unterlagen by lazy { model.unterlagenErinnerungen(heute) }
}

// ---------------------------------------------------------------- Bausteine

/** Wie eine Kachel eingefärbt ist: kräftige Flächen für Kennzahlen, ruhige Karten mit Rand für Listen. */
private enum class Stil { HELD, GELB, SALBEI, HELL, FLAECHE, RAND }

private val LocalStil = compositionLocalOf { Stil.RAND }

/** Welche Kachel welche Farbe bekommt (nur Optik; Inhalt und Anordnung bleiben unberührt). */
private fun stilFuer(id: String): Stil = when (id) {
    "total_liquidity" -> Stil.HELD
    "members_kpi", "contacts_kpi", "documents_archive_kpi" -> Stil.GELB
    "annual_balance", "invoices_kpi", "inventory_overview" -> Stil.SALBEI
    "donations_summary", "meetings_kpi" -> Stil.HELL
    "wgb_limit_monitor", "quick_actions" -> Stil.FLAECHE
    else -> Stil.RAND
}

@Composable
private fun Rahmen(titel: String, ziel: Ziel?, onZiel: (Ziel) -> Unit, inhalt: @Composable ColumnScope.() -> Unit) {
    val stil = LocalStil.current
    val s = MaterialTheme.colorScheme
    val (flaeche, text) = when (stil) {
        Stil.HELD -> s.primary to s.onPrimary
        Stil.GELB -> s.tertiaryContainer to s.onTertiaryContainer
        Stil.SALBEI -> s.secondaryContainer to s.onSecondaryContainer
        Stil.HELL -> s.primaryContainer to s.onPrimaryContainer
        Stil.FLAECHE -> s.surfaceContainer to s.onSurface
        Stil.RAND -> s.surfaceContainerLowest to s.onSurface
    }
    val gross = 32.dp
    val spitz = 10.dp
    val form = when (stil) {
        Stil.HELD -> RoundedCornerShape(gross, gross, gross, spitz)
        Stil.GELB -> RoundedCornerShape(spitz, gross, gross, gross)
        Stil.SALBEI -> RoundedCornerShape(gross, spitz, gross, gross)
        Stil.HELL -> RoundedCornerShape(gross)
        Stil.FLAECHE -> RoundedCornerShape(28.dp)
        Stil.RAND -> RoundedCornerShape(28.dp)
    }
    Card(
        Modifier.fillMaxSize().let { if (ziel != null) it.clickable { onZiel(ziel) } else it },
        shape = form,
        colors = CardDefaults.cardColors(containerColor = flaeche, contentColor = text),
        border = if (stil == Stil.RAND) BorderStroke(1.5.dp, s.outlineVariant) else null,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(titel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            inhalt()
        }
    }
}

/** Große Zahl einer Kennzahl-Kachel; wird bei langen Beträgen kleiner, damit sie nie abgeschnitten wird oder umbricht. */
@Composable
private fun Zahl(text: String) {
    val groesse = (244f / text.length.coerceAtLeast(1)).coerceIn(16f, 32f)
    Text(text, style = MaterialTheme.typography.titleLarge, fontSize = groesse.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false)
}

@Composable
private fun Klein(text: String, farbe: Color = Color.Unspecified) = Text(text, style = MaterialTheme.typography.bodySmall, color = farbe)

@Composable
private fun Zeile(links: String, rechts: String, farbe: Color = Color.Unspecified) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(links, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 2)
        Text(rechts, style = MaterialTheme.typography.bodyMedium, color = farbe, modifier = Modifier.padding(start = 8.dp), maxLines = 1)
    }
}

@Composable
private fun Balken(anteil: Float, farbe: Color) {
    Box(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)).background(MaterialTheme.colorScheme.outlineVariant)) {
        Box(Modifier.fillMaxWidth(anteil.coerceIn(0f, 1f)).height(10.dp).clip(RoundedCornerShape(5.dp)).background(farbe))
    }
}

/** Runde Marke mit den Anfangsbuchstaben eines Namens, in wechselnden Farben und weichen Kieselformen. */
@Composable
internal fun Marke(name: String, nr: Int, groesse: androidx.compose.ui.unit.Dp = 40.dp) {
    val s = MaterialTheme.colorScheme
    val (flaeche, text) = when (nr % 3) {
        0 -> s.primaryContainer to s.onPrimaryContainer
        1 -> s.tertiaryContainer to s.onTertiaryContainer
        else -> s.secondaryContainer to s.onSecondaryContainer
    }
    val form = when (nr % 3) {
        0 -> RoundedCornerShape(topStartPercent = 58, topEndPercent = 42, bottomEndPercent = 55, bottomStartPercent = 45)
        1 -> RoundedCornerShape(topStartPercent = 45, topEndPercent = 55, bottomEndPercent = 42, bottomStartPercent = 58)
        else -> RoundedCornerShape(topStartPercent = 55, topEndPercent = 45, bottomEndPercent = 58, bottomStartPercent = 42)
    }
    val buchstaben = name.trim().split(' ').filter { it.isNotEmpty() }.let { w -> (w.firstOrNull()?.take(1).orEmpty() + (if (w.size > 1) w.last().take(1) else "")).uppercase() }
    Box(Modifier.size(groesse).clip(form).background(flaeche), contentAlignment = Alignment.Center) {
        Text(buchstaben, color = text, fontWeight = FontWeight.ExtraBold, fontSize = (groesse.value * 0.375f).sp)
    }
}

/** Ein Eintrag in einer Listen-Kachel: Trennlinie, links Titel mit grauer Nebenzeile, rechts der Betrag in Fettdruck. */
@Composable
private fun Eintrag(
    titel: String,
    unter: String? = null,
    rechts: String? = null,
    rechtsFarbe: Color = Color.Unspecified,
    rechtsUnten: String? = null,
    rechtsUntenFarbe: Color = Color.Unspecified,
    erster: Boolean = false,
    vorn: (@Composable () -> Unit)? = null,
    unten: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    val grau = MaterialTheme.colorScheme.onSurfaceVariant
    Column(Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }) {
        if (!erster) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            vorn?.invoke()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(titel, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2)
                if (!unter.isNullOrBlank()) Text(unter, style = MaterialTheme.typography.bodySmall, color = grau, maxLines = 3)
                unten?.invoke()
            }
            if (rechts != null) Column(horizontalAlignment = Alignment.End) {
                Text(rechts, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = rechtsFarbe, maxLines = 1, softWrap = false)
                if (rechtsUnten != null) Text(rechtsUnten, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = rechtsUntenFarbe, maxLines = 1)
            }
        }
    }
}

/** Kleine Datumsmarke („15.11.“) vor einem Eintrag. */
@Composable
private fun Datumsmarke(text: String) {
    Box(Modifier.clip(RoundedCornerShape(50)).background(MaterialTheme.colorScheme.secondaryContainer).padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSecondaryContainer, maxLines = 1)
    }
}

/** Große Tageszahl mit Wochentag darunter, für Termine. */
@Composable
private fun Tagesblock(datum: LocalDate) {
    val wochentag = datum.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.GERMAN).uppercase().take(2)
    Column(Modifier.width(44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("${datum.dayOfMonth}", fontSize = 24.sp, lineHeight = 26.sp, fontWeight = FontWeight.ExtraBold)
        Text(wochentag, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Eingefärbte Kennzahl-Fläche (z. B. Offen / Überfällig / Abgerechnet). */
@Composable
private fun Chip(label: String, wert: String, flaeche: Color, text: Color, modifier: Modifier = Modifier) {
    // Drei Chips teilen sich die Breite; der Wert wird bei längeren Beträgen kleiner, damit „€“ nie abgeschnitten wird.
    val groesse = (125f / wert.length.coerceAtLeast(1)).coerceIn(10f, 15f)
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(flaeche).padding(horizontal = 8.dp, vertical = 9.dp)) {
        Text(label, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = text, maxLines = 1)
        Text(wert, fontSize = groesse.sp, fontWeight = FontWeight.ExtraBold, color = text, maxLines = 1, softWrap = false)
    }
}

private fun eur(v: BigDecimal) = Geld.euro(v)
private fun datumKurz(iso: String) = Zeit.deutsch(iso).take(6)

// ---------------------------------------------------------------- Kacheln

@Composable
private fun KachelInhalt(
    model: AppModel, d: DashboardRechner, k: Kachel, onZiel: (Ziel) -> Unit, onSchnell: (Schnell) -> Unit,
    onTermin: (String, String) -> Unit, onMitglied: (String) -> Unit,
) {
    val primaer = MaterialTheme.colorScheme.primary
    val fehler = MaterialTheme.colorScheme.error
    val warn = MaterialTheme.colorScheme.tertiary
    when (k.id) {
        "quick_actions" -> Rahmen("Schnellzugriff", null, onZiel) {
            Klein("Was möchten Sie heute im Verein erfassen?")
            Schnell.entries.chunked(2).forEach { paar ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    paar.forEach { a -> FilledTonalButton(onClick = { onSchnell(a) }, modifier = Modifier.weight(1f)) { Text(a.text, maxLines = 1) } }
                    if (paar.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
        "club_header" -> {
            val v = model.vereinsdaten
            Rahmen(v.name.ifEmpty { "Verein" }, Ziel.EINSTELLUNGEN, onZiel) {
                Klein(v.registernummer.ifEmpty { "Eingetragener Verein (e.V.)" })
                if (v.freistellungsDatum.isNotEmpty()) Klein("Gemeinnützig – Freistellungsbescheid vom ${Zeit.deutsch(v.freistellungsDatum)}", primaer)
                else Klein("Kein Freistellungsbescheid hinterlegt", warn)
                Klein("Vorstand: ${v.vorsitzender.ifEmpty { "unbekannt" }} · Kassenwart: ${v.kassenwart.ifEmpty { "unbekannt" }}")
            }
        }
        "members_kpi" -> {
            val m = d.mitglieder
            Rahmen("Mitglieder", Ziel.MITGLIEDER, onZiel) {
                Zahl("${m.bestand}")
                Klein("${m.passiv} passiv" + if (m.neuImJahr > 0) " · +${m.neuImJahr} in ${d.heute.year}" else "")
            }
        }
        "departments_distribution" -> {
            val m = d.mitglieder
            Rahmen("Abteilungen & Sparten", Ziel.MITGLIEDER_AUSWERTUNG, onZiel) {
                if (m.sparten.isEmpty()) Klein("Noch keine Mitglieder.")
                m.sparten.forEachIndexed { nr, sp ->
                    Eintrag(sp.name, rechts = "${sp.anzahl} (${sp.prozent} %)", erster = nr == 0, unten = { Balken(sp.prozent / 100f, primaer) })
                }
                Klein("${m.spartenAnzahl} Sparten")
            }
        }
        "upcoming_birthdays" -> {
            val a = d.mitglieder.anstehend
            Rahmen("Geburtstage & Jubiläen", Ziel.MITGLIEDER, onZiel) {
                if (a.isEmpty()) Klein("In den nächsten ${Dashboard.VORSCHAU_TAGE} Tagen steht nichts an.")
                a.forEachIndexed { nr, b ->
                    val tage = ChronoUnit.DAYS.between(d.heute, b.datum)
                    val wann = if (tage == 0L) "Heute!" else "in $tage T."
                    val was = if (b.art == "birthday") "wird ${b.jahre}" else "${b.jahre} Jahre im Verein"
                    Eintrag(b.name, "${datumKurz(b.datum.toString())} · $was", rechts = wann, rechtsFarbe = if (tage == 0L) primaer else Color.Unspecified, erster = nr == 0, vorn = { Marke(b.name, nr) })
                }
            }
        }
        "member_documents_expiry" -> Rahmen("Unterlagen laufen ab", Ziel.MITGLIEDER, onZiel) {
            val liste = d.unterlagen
            if (liste.isEmpty()) Klein("In den nächsten ${de.vereinsmanager.core.members.Unterlagen.WARN_TAGE} Tagen läuft nichts ab.")
            liste.take(8).forEachIndexed { nr, e ->
                val tage = ChronoUnit.DAYS.between(d.heute, LocalDate.parse(e.datum))
                Eintrag(
                    e.memberName, e.text,
                    rechts = if (e.abgelaufen) "abgelaufen" else if (tage == 0L) "heute" else "in $tage T.",
                    rechtsFarbe = if (e.abgelaufen) fehler else warn,
                    rechtsUnten = if (e.abgelaufen) Zeit.deutsch(e.datum) else null,
                    erster = nr == 0, onClick = { onMitglied(e.memberId) },
                )
            }
            if (liste.size > 8) Klein("… und ${liste.size - 8} weitere")
        }
        "recent_members" -> Rahmen("Neueste Mitglieder", Ziel.MITGLIEDER, onZiel) {
            val n = d.mitglieder.neueste
            if (n.isEmpty()) Klein("Noch keine Mitglieder.")
            n.forEachIndexed { nr, m -> Eintrag("${m.firstName} ${m.lastName}".trim(), m.department.ifEmpty { "Hauptverein" }, rechts = Zeit.deutsch(m.entryDate), erster = nr == 0) }
        }
        "demographics_distribution" -> Rahmen("Altersstruktur", Ziel.MITGLIEDER_AUSWERTUNG, onZiel) {
            val m = d.mitglieder
            m.altersgruppen.forEachIndexed { nr, g ->
                Eintrag(g.bezeichnung, rechts = "${g.anzahl} (${g.prozent} %)", erster = nr == 0, unten = { Balken(g.prozent / 100f, primaer) })
            }
            Klein("Männlich ${m.maenner} · Weiblich ${m.frauen}" + if (m.divers > 0) " · Divers ${m.divers}" else "")
        }
        "total_liquidity" -> {
            val f = d.finanzen
            Rahmen("Liquidität", Ziel.BUCHUNGEN, onZiel) { Zahl(eur(f.liquiditaet)); Klein("${f.kontenAnzahl} Konten & Kassen") }
        }
        "annual_balance" -> {
            val f = d.finanzen
            Rahmen("Jahres-Saldo ${f.jahr}", Ziel.EUER, onZiel) {
                Zahl(Geld.euroMitVorzeichen(f.euer.ergebnis))
                Klein("Einnahmen ${eur(f.euer.einnahmen)} · Ausgaben ${eur(f.euer.ausgaben)}")
            }
        }
        "wgb_limit_monitor" -> {
            val g = d.finanzen.euer.grenze
            Rahmen("§ 64 AO ${d.finanzen.jahr}", Ziel.EUER, onZiel) {
                if (g == null) Klein("Keine Daten") else {
                    val farbe = if (g.ueberschritten) fehler else if (g.warnung) warn else primaer
                    Zahl("${eur(g.einnahmen)}")
                    Klein("von ${eur(g.grenze)} im wirtschaftlichen Geschäftsbetrieb")
                    Balken((g.prozent / 100.0).toFloat(), farbe)
                    Klein(if (g.ueberschritten) "Grenze überschritten" else "${eur(g.puffer)} Puffer", farbe)
                }
            }
        }
        "tax_spheres_overview" -> Rahmen("4 Steuerliche Sphären ${d.finanzen.jahr}", Ziel.EUER, onZiel) {
            d.finanzen.euer.sphaeren.forEachIndexed { nr, sp ->
                Eintrag(
                    sp.name, "Einnahmen ${eur(sp.einnahmen)} · Ausgaben ${eur(sp.ausgaben)}",
                    rechts = Geld.euroMitVorzeichen(sp.ergebnis), rechtsFarbe = if (sp.ergebnis.signum() < 0) fehler else primaer, erster = nr == 0,
                )
            }
        }
        "sepa_debit_monitor" -> {
            val sp = d.sepa
            Rahmen("Beitragslauf (SEPA)", Ziel.BEITRAGSLAUF, onZiel) {
                Eintrag("Zahlen per SEPA", rechts = "${sp.sepa} von ${sp.aktive}", erster = true)
                Eintrag("Jahres-Soll aller Beiträge", rechts = eur(sp.jahresSoll))
                Eintrag("Gläubiger-ID", rechts = sp.glaeubigerId.ifEmpty { "nicht hinterlegt" }, rechtsFarbe = if (sp.glaeubigerId.isEmpty()) warn else Color.Unspecified)
                if (sp.unvollstaendig > 0) Klein("${sp.unvollstaendig} Mandat(e) unvollständig (IBAN oder Mandatsreferenz fehlt)", warn)
            }
        }
        "recent_journal_transactions" -> Rahmen("Letzte Buchungen", Ziel.BUCHUNGEN, onZiel) {
            val l = d.finanzen.letzte
            if (l.isEmpty()) Klein("Noch keine Buchungen.")
            l.forEachIndexed { nr, b ->
                val voll = Finance.titel(b)
                Eintrag(
                    voll.substringBefore(" – "), voll.substringAfter(" – ", ""),
                    rechts = Geld.euroMitVorzeichen(b.betrag), rechtsFarbe = if (b.betrag.signum() < 0) fehler else primaer,
                    erster = nr == 0, vorn = { Datumsmarke(datumKurz(b.datum)) },
                )
            }
        }
        "donations_summary" -> {
            val s = d.spenden
            Rahmen("Spenden ${s.jahr}", Ziel.SPENDEN, onZiel) { Zahl(eur(s.summe)); Klein("${s.geld} Geld- · ${s.sach} Sachspenden") }
        }
        "cashflow_chart" -> Rahmen("Cashflow ${d.finanzen.jahr}", Ziel.FINANZ_AUSWERTUNG, onZiel) {
            val m = d.finanzen.monate
            val hoechst = m.maxOfOrNull { maxOf((it.einnahmen + it.spenden).toDouble(), it.ausgaben.toDouble()) }?.coerceAtLeast(1000.0) ?: 1000.0
            Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
                m.forEach { x ->
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(1.dp), verticalAlignment = Alignment.Bottom) {
                        Box(Modifier.weight(1f).height((88 * (x.einnahmen + x.spenden).toDouble() / hoechst).dp).background(primaer))
                        Box(Modifier.weight(1f).height((88 * x.ausgaben.toDouble() / hoechst).dp).background(fehler))
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                m.forEach { x -> Text(x.name.take(1), style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f)) }
            }
            Klein("Blau: Einnahmen und Spenden · Rot: Ausgaben (Umbuchungen zählen nicht)")
        }
        "invoices_overview" -> {
            val r = d.rechnungen
            val sch = MaterialTheme.colorScheme
            Rahmen("Rechnungen", Ziel.RECHNUNGEN, onZiel) {
                Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Chip("Offen", eur(r.offen), sch.tertiaryContainer, sch.onTertiaryContainer, Modifier.weight(1f))
                    Chip("Überfällig", "${r.ueberfaellig} ${if (r.ueberfaellig == 1) "Beleg" else "Belege"}", sch.errorContainer, sch.onErrorContainer, Modifier.weight(1f))
                    Chip("Abgerechnet", eur(r.abgerechnet), sch.primaryContainer, sch.onPrimaryContainer, Modifier.weight(1f))
                }
                r.neueste.forEachIndexed { nr, x ->
                    val ueberfaellig = de.vereinsmanager.core.invoice.RechnungsRegeln.ueberfaellig(x.copy(status = "open"), d.heute)
                    val status = when {
                        x.status == "paid" -> "bezahlt"; x.status == "cancelled" -> "storniert"; x.status == "draft" -> "Entwurf"
                        ueberfaellig -> "überfällig"
                        else -> "offen"
                    }
                    Eintrag(x.nummer, x.anzeigeName, rechts = eur(x.brutto), rechtsUnten = status, rechtsUntenFarbe = if (status == "überfällig") fehler else MaterialTheme.colorScheme.onSurfaceVariant, erster = nr == 0)
                }
                Klein("${r.gesamt} Rechnungen, ${r.bezahlt} bezahlt" + if (r.entwuerfe > 0) ", ${r.entwuerfe} Entwurf" else "")
            }
        }
        "invoices_kpi" -> {
            val r = d.rechnungen
            Rahmen("Forderungen", Ziel.RECHNUNGEN, onZiel) {
                Zahl(eur(r.offen)); Klein("${r.offenAnzahl} offen" + if (r.ueberfaellig > 0) " · ${r.ueberfaellig} überfällig" else "", if (r.ueberfaellig > 0) fehler else Color.Unspecified)
            }
        }
        "contacts_summary" -> {
            val c = d.kontakte
            Rahmen("Kontakte & Partner", Ziel.KONTAKTE, onZiel) {
                val arten = c.nachArt.filter { it.second > 0 }.joinToString(" · ") { "${Kontakte.TYPEN[it.first] ?: it.first} ${it.second}" }
                if (arten.isNotEmpty()) Klein(arten)
                if (c.zuletzt.isEmpty()) Klein("Noch keine Kontakte.")
                c.zuletzt.forEachIndexed { nr, k2 -> Eintrag(k2.anzeigeName.ifEmpty { k2.firma }, k2.adresse.ort.ifEmpty { k2.email }, erster = nr == 0) }
                Klein("${c.gesamt} Kontakte insgesamt")
            }
        }
        "contacts_kpi" -> {
            val c = d.kontakte
            Rahmen("Kontakte", Ziel.KONTAKTE, onZiel) { Zahl("${c.gesamt}"); Klein("${c.sponsoren} Sponsoren · ${c.partner} Partner") }
        }
        "upcoming_events" -> Rahmen("Nächste Termine", Ziel.KALENDER, onZiel) {
            val t = d.termine
            if (t.isEmpty()) Klein("Keine anstehenden Termine.")
            t.forEachIndexed { nr, v ->
                val art = model.terminarten.firstOrNull { it.id == v.termin.art }?.name.orEmpty()
                val unter = listOf(art, Kalender.zeitText(v.datum.toString(), v.termin.beginnZeit, v.ende.toString(), v.termin.endeZeit, v.termin.ganztaegig), v.termin.ort).filter { it.isNotBlank() }.joinToString(" · ")
                val tag = v.datum.toString().take(10)
                Eintrag(v.termin.titel, unter, erster = nr == 0, vorn = { Tagesblock(LocalDate.parse(tag)) }, onClick = { onTermin(v.termin.id, tag) })
            }
        }
        "meetings_summary" -> {
            val sm = d.sitzungen
            Rahmen("Sitzungen & Beschlüsse", Ziel.SITZUNGEN, onZiel) {
                if (sm.anstehend.isEmpty()) Klein("Keine anstehenden Sitzungen.")
                sm.anstehend.forEachIndexed { nr, x ->
                    Eintrag(x.titel, "${Sitzungen.artName(x.art)} · ${Sitzungen.statusName(x.status)}", erster = nr == 0, vorn = { Datumsmarke(datumKurz(x.datum)) })
                }
                Klein("${sm.offeneProtokolle} Protokoll(e) in Arbeit", if (sm.offeneProtokolle > 0) warn else Color.Unspecified)
            }
        }
        "meetings_kpi" -> {
            val s = d.sitzungen
            Rahmen("Sitzungen", Ziel.SITZUNGEN, onZiel) { Zahl("${s.anstehendAnzahl}"); Klein("anstehend · ${s.offeneProtokolle} Protokolle in Arbeit") }
        }
        "inventory_overview" -> {
            val i = d.inventar
            Rahmen("Inventar", Ziel.INVENTAR, onZiel) {
                Zahl(eur(i.wert)); Klein("${i.einheiten} Stück in ${i.positionen} Positionen")
                if (i.reparatur > 0) Klein("${i.reparatur} mit Reparaturbedarf", warn)
            }
        }
        "documents_archive_kpi" -> {
            val x = d.dokumente
            Rahmen("Dokumentenarchiv", Ziel.DOKUMENTE, onZiel) { Zahl("${x.gesamt}"); Klein("${x.belege} Belege · ${x.vertraege} Verträge · ${x.protokolle} Protokolle") }
        }
    }
}

// ---------------------------------------------------------------- Anpassen

@Composable
private fun AnpassenAnsicht(model: AppModel, onFertig: () -> Unit, modifier: Modifier) {
    val a = model.dashboard
    val alle = Dashboard.alle(a)
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Dashboard anpassen", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Klein("Vorlage wählen oder einzelne Kacheln ein- und ausschalten und mit den Pfeilen verschieben. Änderungen gelten sofort und stehen auch in der Datensicherung.")
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Vorlage.entries.forEach { v -> FilterChip(selected = false, onClick = { model.dashboardSpeichern(Dashboard.vorlage(a, v)) }, label = { Text(v.titel, maxLines = 1) }) }
        }
        var gruppe = ""
        alle.forEach { (k, an) ->
            val titel = Dashboard.GRUPPEN[k.gruppe].orEmpty()
            if (titel != gruppe) { gruppe = titel; Text(titel, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp)) }
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(k.titel, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        Klein(k.beschreibung)
                    }
                    if (an) {
                        TextButton(onClick = { model.dashboardSpeichern(Dashboard.verschieben(a, k.id, -1)) }) { Text("▲") }
                        TextButton(onClick = { model.dashboardSpeichern(Dashboard.verschieben(a, k.id, 1)) }) { Text("▼") }
                    }
                    Switch(an, { model.dashboardSpeichern(Dashboard.umschalten(a, k.id, it)) })
                }
            }
        }
        Button(onClick = onFertig, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text("Fertig") }
    }
}
