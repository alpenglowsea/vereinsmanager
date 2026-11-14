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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
fun DashboardScreen(model: AppModel, onZiel: (Ziel) -> Unit, onSchnell: (Schnell) -> Unit, modifier: Modifier = Modifier) {
    var anpassen by remember { mutableStateOf(false) }
    BackHandler(enabled = anpassen) { anpassen = false }
    val heute = remember(model.stand) { LocalDate.now() }
    val daten = remember(model.stand, heute) { DashboardRechner(model, heute) }
    val kacheln = Dashboard.sichtbar(model.dashboard)
    val reihen = remember(kacheln) { gruppiere(kacheln) }

    if (anpassen) AnpassenAnsicht(model, onFertig = { anpassen = false }, modifier)
    else Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (model.clubName.isEmpty()) Text(
            "Noch keine Vereinsdaten – tragen Sie sie unter „Einstellungen“ ein oder spielen Sie dort eine Sicherung ein.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (kacheln.isEmpty()) Text("Noch keine Kacheln ausgewählt. Unten können Sie welche hinzufügen.", style = MaterialTheme.typography.bodyMedium)
        reihen.forEach { reihe ->
            if (reihe.size == 2) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    reihe.forEach { k -> Box(Modifier.weight(1f).fillMaxHeight()) { KachelInhalt(model, daten, k, onZiel, onSchnell) } }
                }
            } else KachelInhalt(model, daten, reihe.first(), onZiel, onSchnell)
        }
        OutlinedButton(onClick = { anpassen = true }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) { Text("Dashboard anpassen") }
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
    val finanzen by lazy { Dashboard.finanzen(model.konten, model.buchungen, heute) }
    val sepa by lazy { Dashboard.sepa(model.members, model.vereinsdaten) }
    val spenden by lazy { Dashboard.spenden(model.spenden, heute) }
    val rechnungen by lazy { Dashboard.rechnungen(model.rechnungen, heute) }
    val kontakte by lazy { Dashboard.kontakte(model.kontakte, Kontakte.TYPEN.keys) }
    val termine by lazy { Dashboard.termine(model.termine, heute) }
    val sitzungen by lazy { Dashboard.sitzungen(model.sitzungen, heute) }
    val inventar by lazy { Dashboard.inventar(model.inventar, heute).kennzahlen }
    val dokumente by lazy { Dashboard.dokumente(model.dokumente) }
}

// ---------------------------------------------------------------- Bausteine

@Composable
private fun Rahmen(titel: String, ziel: Ziel?, onZiel: (Ziel) -> Unit, inhalt: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxSize().let { if (ziel != null) it.clickable { onZiel(ziel) } else it }) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(titel, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            inhalt()
        }
    }
}

@Composable
private fun Zahl(text: String) = Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1)

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
    Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.outlineVariant)) {
        Box(Modifier.fillMaxWidth(anteil.coerceIn(0f, 1f)).height(8.dp).background(farbe))
    }
}

private fun eur(v: BigDecimal) = Geld.euro(v)
private fun datumKurz(iso: String) = Zeit.deutsch(iso).take(6)

// ---------------------------------------------------------------- Kacheln

@Composable
private fun KachelInhalt(model: AppModel, d: DashboardRechner, k: Kachel, onZiel: (Ziel) -> Unit, onSchnell: (Schnell) -> Unit) {
    val primaer = MaterialTheme.colorScheme.primary
    val fehler = MaterialTheme.colorScheme.error
    val warn = MaterialTheme.colorScheme.tertiary
    when (k.id) {
        "quick_actions" -> Rahmen("Schnellzugriff", null, onZiel) {
            Klein("Was möchten Sie heute im Verein erfassen?")
            Schnell.entries.chunked(2).forEach { paar ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    paar.forEach { a -> OutlinedButton(onClick = { onSchnell(a) }, modifier = Modifier.weight(1f)) { Text(a.text, maxLines = 1) } }
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
                m.sparten.forEach { s ->
                    Zeile(s.name, "${s.anzahl} (${s.prozent} %)")
                    Balken(s.prozent / 100f, primaer)
                }
                Klein("${m.spartenAnzahl} Sparten")
            }
        }
        "upcoming_birthdays" -> {
            val a = d.mitglieder.anstehend
            Rahmen("Geburtstage & Jubiläen", Ziel.MITGLIEDER, onZiel) {
                if (a.isEmpty()) Klein("In den nächsten ${Dashboard.VORSCHAU_TAGE} Tagen steht nichts an.")
                a.forEach { b ->
                    val tage = ChronoUnit.DAYS.between(d.heute, b.datum)
                    val wann = if (tage == 0L) "Heute!" else "in $tage T."
                    val was = if (b.art == "birthday") "${b.name} wird ${b.jahre}" else "${b.name}: ${b.jahre} Jahre im Verein"
                    Zeile("${datumKurz(b.datum.toString())} $was", wann, if (tage == 0L) primaer else Color.Unspecified)
                }
            }
        }
        "recent_members" -> Rahmen("Neueste Mitglieder", Ziel.MITGLIEDER, onZiel) {
            val n = d.mitglieder.neueste
            if (n.isEmpty()) Klein("Noch keine Mitglieder.")
            n.forEach { m -> Zeile("${m.firstName} ${m.lastName}".trim(), Zeit.deutsch(m.entryDate)); Klein(m.department.ifEmpty { "Hauptverein" }) }
        }
        "demographics_distribution" -> Rahmen("Altersstruktur", Ziel.MITGLIEDER_AUSWERTUNG, onZiel) {
            val m = d.mitglieder
            m.altersgruppen.forEach { g ->
                Zeile(g.bezeichnung, "${g.anzahl} (${g.prozent} %)")
                Balken(g.prozent / 100f, primaer)
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
            d.finanzen.euer.sphaeren.forEach { s ->
                Zeile(s.name, Geld.euroMitVorzeichen(s.ergebnis), if (s.ergebnis.signum() < 0) fehler else Color.Unspecified)
                Klein("Einnahmen ${eur(s.einnahmen)} · Ausgaben ${eur(s.ausgaben)}")
            }
        }
        "sepa_debit_monitor" -> {
            val s = d.sepa
            Rahmen("Beitragslauf (SEPA)", Ziel.BEITRAGSLAUF, onZiel) {
                Zeile("Zahlen per SEPA", "${s.sepa} von ${s.aktive}")
                Zeile("Jahres-Soll aller Beiträge", eur(s.jahresSoll))
                Zeile("Gläubiger-ID", s.glaeubigerId.ifEmpty { "nicht hinterlegt" }, if (s.glaeubigerId.isEmpty()) warn else Color.Unspecified)
                if (s.unvollstaendig > 0) Klein("${s.unvollstaendig} Mandat(e) unvollständig (IBAN oder Mandatsreferenz fehlt)", warn)
            }
        }
        "recent_journal_transactions" -> Rahmen("Letzte Buchungen", Ziel.BUCHUNGEN, onZiel) {
            val l = d.finanzen.letzte
            if (l.isEmpty()) Klein("Noch keine Buchungen.")
            l.forEach { b ->
                Zeile("${datumKurz(b.datum)} ${Finance.titel(b)}", Geld.euroMitVorzeichen(b.betrag), if (b.betrag.signum() < 0) fehler else primaer)
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
            Rahmen("Rechnungen", Ziel.RECHNUNGEN, onZiel) {
                Zeile("Offene Forderungen", eur(r.offen))
                Zeile("Überfällig", "${r.ueberfaellig} ${if (r.ueberfaellig == 1) "Beleg" else "Belege"}", if (r.ueberfaellig > 0) fehler else Color.Unspecified)
                Zeile("Abgerechnet", eur(r.abgerechnet))
                if (r.neueste.isNotEmpty()) HorizontalDivider(Modifier.padding(vertical = 4.dp))
                r.neueste.forEach { x ->
                    val status = when {
                        x.status == "paid" -> "bezahlt"; x.status == "cancelled" -> "storniert"; x.status == "draft" -> "Entwurf"
                        de.vereinsmanager.core.invoice.RechnungsRegeln.ueberfaellig(x.copy(status = "open"), d.heute) -> "überfällig"
                        else -> "offen"
                    }
                    Zeile("${x.nummer} ${x.anzeigeName}", "${eur(x.brutto)} · $status")
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
                c.zuletzt.forEach { k2 -> Zeile(k2.anzeigeName.ifEmpty { k2.firma }, k2.adresse.ort.ifEmpty { k2.email }) }
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
            t.forEach { v ->
                val art = model.terminarten.firstOrNull { it.id == v.termin.art }?.name.orEmpty()
                Zeile(v.termin.titel, Kalender.datumKurz(v.datum.toString()))
                Klein(listOf(art, Kalender.zeitText(v.datum.toString(), v.termin.beginnZeit, v.ende.toString(), v.termin.endeZeit, v.termin.ganztaegig), v.termin.ort).filter { it.isNotBlank() }.joinToString(" · "))
            }
        }
        "meetings_summary" -> {
            val s = d.sitzungen
            Rahmen("Sitzungen & Beschlüsse", Ziel.SITZUNGEN, onZiel) {
                if (s.anstehend.isEmpty()) Klein("Keine anstehenden Sitzungen.")
                s.anstehend.forEach { x -> Zeile(x.titel, datumKurz(x.datum)); Klein("${Sitzungen.artName(x.art)} · ${Sitzungen.statusName(x.status)}") }
                Klein("${s.offeneProtokolle} Protokoll(e) in Arbeit", if (s.offeneProtokolle > 0) warn else Color.Unspecified)
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
