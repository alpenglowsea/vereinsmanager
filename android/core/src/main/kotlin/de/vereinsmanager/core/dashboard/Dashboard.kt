package de.vereinsmanager.core.dashboard

import de.vereinsmanager.core.backup.SingleIds
import de.vereinsmanager.core.calendar.Besonderes
import de.vereinsmanager.core.calendar.Kalender
import de.vereinsmanager.core.calendar.Termin
import de.vereinsmanager.core.calendar.Vorkommen
import de.vereinsmanager.core.contacts.Kontakt
import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.finance.Berichte
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.Euer
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Finanzauswertung
import de.vereinsmanager.core.finance.AuswFilter
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.finance.MonatsSumme
import de.vereinsmanager.core.inventory.Artikel
import de.vereinsmanager.core.inventory.Inventar
import de.vereinsmanager.core.inventory.InventarKennzahlen
import de.vereinsmanager.core.invoice.Rechnung
import de.vereinsmanager.core.invoice.RechnungsRegeln
import de.vereinsmanager.core.donation.DonationReceipt
import de.vereinsmanager.core.meeting.Sitzung
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberAnalytics
import de.vereinsmanager.core.members.MemberAnalytics.Anteil
import de.vereinsmanager.core.members.MemberAnalytics.GeschlechtFilter
import de.vereinsmanager.core.members.MemberAnalytics.SpartenZeile
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZonedDateTime

/** Eine Kachel, die das Dashboard zeigen kann. Die Kennungen sind dieselben wie am Desktop. */
data class Kachel(
    val id: String,
    val titel: String,
    val kurzTitel: String,
    val beschreibung: String,
    val gruppe: String,
    /** Auf dem Handy zwei nebeneinander (Kennzahlen); sonst volle Breite. */
    val kompakt: Boolean,
    val standardAn: Boolean,
    val standardReihenfolge: Int,
    val standardBreite: Int,
)

/** Eine Zeile der gespeicherten Anordnung; [breite] (1–4 Spalten) kennt nur der Desktop und bleibt unverändert erhalten. */
data class KachelEintrag(val id: String, val an: Boolean, val reihenfolge: Int, val breite: Int)

enum class Vorlage(val titel: String) {
    STANDARD("Standard"), FINANZEN("Finanzen"), MITGLIEDER("Mitglieder"), KOMPAKT("Kompakt"), ALLE("Alle Kacheln"),
}

/** Die Anordnung des Dashboards: Liste der Kacheln mit Sichtbarkeit und Reihenfolge, wie `dashboardConfig` in der Sicherung. */
data class Anordnung(val eintraege: List<KachelEintrag>, val roh: JsonObject? = null)

object Dashboard {
    const val AREA = "dashboardConfig"
    const val ID = SingleIds.DASHBOARD
    /** Mitgliedsjubiläen, die das Dashboard hervorhebt. */
    val JUBILAEEN = setOf(10, 25, 40, 50)
    const val VORSCHAU_TAGE = 30L

    private fun k(id: String, titel: String, kurz: String, text: String, gruppe: String, kompakt: Boolean, an: Boolean, nr: Int, breite: Int) =
        Kachel(id, titel, kurz, text, gruppe, kompakt, an, nr, breite)

    val GRUPPEN: Map<String, String> = linkedMapOf(
        "overview" to "Übersicht & Aktionen", "members" to "Mitglieder", "finance" to "Finanzen & Steuern", "invoices" to "Rechnungen",
        "contacts" to "Kontakte", "calendar" to "Kalender & Termine", "meetings" to "Sitzungsdienst", "inventory" to "Inventar", "documents" to "Dokumente",
    )

    /**
     * Alle Kacheln der App. Die Kachel „Online-Mitgliedsanträge“ des Desktops gibt es hier nicht (Entscheidung 25.10.2026);
     * steht sie in einer eingespielten Anordnung, bleibt der Eintrag unverändert erhalten und wird nur nicht angezeigt.
     */
    val KACHELN: List<Kachel> = listOf(
        k("quick_actions", "Schnellzugriff", "Schnellzugriff", "Direkt neue Mitglieder, Buchungen, Rechnungen, Termine, Inventar und Dokumente anlegen.", "overview", false, true, 1, 4),
        k("club_header", "Vereinsstammdaten & Status", "Vereinskopf", "Vereinsname, Registernummer, Gemeinnützigkeit und Leitung.", "overview", false, true, 2, 4),
        k("members_kpi", "Mitglieder-Kennzahlen", "Mitgliederbestand", "Mitglieder insgesamt, passive und neue in diesem Jahr.", "members", true, true, 3, 1),
        k("departments_distribution", "Abteilungen & Sparten", "Spartenverteilung", "Verteilung der Mitglieder auf die Sparten.", "members", false, true, 5, 1),
        k("upcoming_birthdays", "Geburtstage & Jubiläen", "Geburtstage", "Geburtstage und Mitgliedsjubiläen der nächsten 30 Tage.", "members", false, true, 6, 1),
        k("recent_members", "Neueste Mitgliederzugänge", "Neue Mitglieder", "Die zuletzt eingetretenen Mitglieder.", "members", false, false, 7, 2),
        k("demographics_distribution", "Alters- & Demografiestruktur", "Altersstruktur", "Altersgruppen und Geschlechter der aktuellen Mitglieder.", "members", false, false, 8, 2),
        k("total_liquidity", "Gesamtliquidität & Kontensalden", "Liquidität", "Aktuelle Bank- und Kassenstände mit Gesamtsaldo.", "finance", true, true, 9, 1),
        k("annual_balance", "Jahres-Saldo (EÜR)", "Jahres-Saldo", "Einnahmen, Ausgaben und Ergebnis des laufenden Jahres.", "finance", true, true, 10, 1),
        k("wgb_limit_monitor", "Freigrenze wirtschaftlicher Geschäftsbetrieb (§ 64 AO)", "§ 64 AO Grenze", "Einnahmen im wirtschaftlichen Geschäftsbetrieb gegen die Grenze, mit Puffer.", "finance", true, true, 11, 1),
        k("tax_spheres_overview", "4 Steuerliche Sphären (SKR 42)", "4 Sphären", "Einnahmen und Ausgaben nach den vier steuerlichen Bereichen.", "finance", false, true, 12, 2),
        k("sepa_debit_monitor", "Beitragslauf & SEPA-Monitor", "SEPA-Beitragslauf", "SEPA-Mandate, Jahres-Soll und unvollständige Mandate.", "finance", false, true, 13, 2),
        k("recent_journal_transactions", "Letzte Buchungen im Journal", "Letzte Buchungen", "Die fünf neuesten Buchungen.", "finance", false, true, 14, 2),
        k("donations_summary", "Spenden & Zuwendungen", "Spenden", "Spenden und ausgestellte Bestätigungen im laufenden Jahr.", "finance", true, true, 15, 1),
        k("cashflow_chart", "Monatlicher Cashflow", "Cashflow", "Einnahmen und Ausgaben je Monat im laufenden Jahr.", "finance", false, false, 16, 2),
        k("invoices_overview", "Rechnungen & Offene Posten", "Rechnungen", "Forderungen, Überfälliges und die neuesten Rechnungen.", "invoices", false, true, 17, 2),
        k("invoices_kpi", "Offene Forderungen", "Forderungen", "Noch offene und überfällige Rechnungsbeträge.", "invoices", true, false, 18, 1),
        k("contacts_summary", "Kontakt- & Partnerverzeichnis", "Kontakte & Partner", "Kontakte nach Art und die zuletzt geänderten.", "contacts", false, true, 19, 2),
        k("contacts_kpi", "Kontaktbestand", "Kontaktbestand", "Zahl der Kontakte, Sponsoren und Partner.", "contacts", true, false, 20, 1),
        k("upcoming_events", "Nächste Termine", "Terminkalender", "Die nächsten drei Termine, auch aus Serien.", "calendar", false, true, 21, 2),
        k("meetings_summary", "Sitzungen & Beschlussdienst", "Sitzungsdienst", "Nächste Sitzungen und Protokolle in Arbeit.", "meetings", false, true, 22, 2),
        k("meetings_kpi", "Sitzungsstatus", "Sitzungsstatus", "Anstehende Sitzungen und offene Protokolle.", "meetings", true, false, 23, 1),
        k("inventory_overview", "Inventar & Materialbestand", "Inventar", "Wert des Bestands, Stückzahl und Reparaturbedarf.", "inventory", true, true, 24, 1),
        k("documents_archive_kpi", "Dokumentenarchiv", "Dokumentenarchiv", "Dokumente nach Belegen, Verträgen und Protokollen.", "documents", true, true, 25, 1),
        k("member_documents_expiry", "Unterlagen laufen ab", "Unterlagen", "Lizenzen und Nachweise, die in 90 Tagen ablaufen oder abgelaufen sind, dazu fällige Führungszeugnisse.", "members", false, true, 26, 2),
    )

    /**
     * Kacheln, die nach dem Speichern einer Anordnung neu dazugekommen sind und trotzdem gleich angezeigt werden, weil sie
     * auf Fristen hinweisen (Paket U). Gleiche Liste am Desktop (NEU_SICHTBAR in src/data/defaultDashboard.ts).
     */
    val NEU_SICHTBAR = setOf("member_documents_expiry")

    private val BEKANNT = KACHELN.associateBy { it.id }
    fun kachel(id: String): Kachel? = BEKANNT[id]

    // ---------- Anordnung lesen, ändern, speichern

    private fun standardEintraege(): List<KachelEintrag> = KACHELN.map { KachelEintrag(it.id, it.standardAn, it.standardReihenfolge, it.standardBreite) }

    fun standard(): Anordnung = Anordnung(standardEintraege())

    fun lesen(store: DocumentStore): Anordnung = lesen(store.get(AREA, ID))

    fun lesen(doc: JsonObject?): Anordnung {
        val liste = doc?.get("widgets") as? JsonArray ?: return standard()
        val e = liste.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            val id = (o["id"] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            KachelEintrag(
                id, (o["enabled"] as? JsonPrimitive)?.booleanOrNull ?: false,
                (o["order"] as? JsonPrimitive)?.intOrNull ?: 999, (o["colSpan"] as? JsonPrimitive)?.intOrNull ?: BEKANNT[id]?.standardBreite ?: 1,
            )
        }.distinctBy { it.id }
        // Kacheln, die in einer älteren Anordnung fehlen, kommen ans Ende: ausgeblendet, außer denen aus NEU_SICHTBAR.
        val fehlend = KACHELN.filter { k -> e.none { it.id == k.id } }
        val ende = (e.maxOfOrNull { it.reihenfolge } ?: 0)
        return Anordnung(e + fehlend.mapIndexed { i, k -> KachelEintrag(k.id, k.id in NEU_SICHTBAR && k.standardAn, ende + (i + 1) * 10, k.standardBreite) }, doc)
    }

    fun speichern(store: DocumentStore, a: Anordnung, now: ZonedDateTime = ZonedDateTime.now()) {
        val m = LinkedHashMap<String, JsonElement>(a.roh ?: JsonObject(emptyMap()))
        m["id"] = JsonPrimitive(ID)
        m["version"] = JsonPrimitive(1)
        m["widgets"] = JsonArray(a.eintraege.map {
            JsonObject(mapOf("id" to JsonPrimitive(it.id), "enabled" to JsonPrimitive(it.an), "order" to JsonPrimitive(it.reihenfolge), "colSpan" to JsonPrimitive(it.breite)))
        })
        m["updatedAt"] = JsonPrimitive(now.toInstant().toString())
        store.put(AREA, ID, JsonObject(m))
    }

    /** Die angezeigten Kacheln in ihrer Reihenfolge; Unbekanntes (z. B. die Online-Anträge des Desktops) bleibt weg. */
    fun sichtbar(a: Anordnung): List<Kachel> =
        a.eintraege.withIndex().filter { it.value.an && it.value.id in BEKANNT }.sortedWith(compareBy({ it.value.reihenfolge }, { it.index })).map { BEKANNT.getValue(it.value.id) }

    /** Alle Kacheln dieser App: erst die angezeigten in Reihenfolge, dann die ausgeblendeten in der Reihenfolge des Desktops. */
    fun alle(a: Anordnung): List<Pair<Kachel, Boolean>> {
        val an = sichtbar(a).map { it to true }
        val rest = KACHELN.filter { k -> an.none { it.first.id == k.id } }.sortedBy { k -> a.eintraege.firstOrNull { it.id == k.id }?.reihenfolge ?: k.standardReihenfolge }
        return an + rest.map { it to false }
    }

    private fun mitEintrag(a: Anordnung, id: String, f: (KachelEintrag) -> KachelEintrag): Anordnung {
        val vorhanden = a.eintraege.any { it.id == id }
        val basis = if (vorhanden) a.eintraege else a.eintraege + KachelEintrag(id, false, (a.eintraege.maxOfOrNull { it.reihenfolge } ?: 0) + 10, BEKANNT[id]?.standardBreite ?: 1)
        return a.copy(eintraege = basis.map { if (it.id == id) f(it) else it })
    }

    /** Blendet eine Kachel ein (ans Ende) oder aus. */
    fun umschalten(a: Anordnung, id: String, an: Boolean): Anordnung {
        if (id !in BEKANNT) return a
        val ende = (a.eintraege.filter { it.an }.maxOfOrNull { it.reihenfolge } ?: 0) + 10
        return mitEintrag(a, id) { if (an && !it.an) it.copy(an = true, reihenfolge = ende) else if (!an) it.copy(an = false) else it }
    }

    /** Verschiebt eine angezeigte Kachel um [schritt] Plätze (−1 nach oben, +1 nach unten) und nummeriert die angezeigten neu. */
    fun verschieben(a: Anordnung, id: String, schritt: Int): Anordnung {
        val reihe = sichtbar(a).map { it.id }.toMutableList()
        val von = reihe.indexOf(id)
        if (von < 0) return a
        val nach = (von + schritt).coerceIn(0, reihe.size - 1)
        if (nach == von) return a
        reihe.add(nach, reihe.removeAt(von))
        val nummer = reihe.withIndex().associate { it.value to (it.index + 1) * 10 }
        return a.copy(eintraege = a.eintraege.map { e -> nummer[e.id]?.let { e.copy(reihenfolge = it) } ?: e })
    }

    private val FINANZEN = listOf(
        "quick_actions", "total_liquidity", "annual_balance", "invoices_overview", "wgb_limit_monitor", "donations_summary",
        "tax_spheres_overview", "sepa_debit_monitor", "recent_journal_transactions", "cashflow_chart", "documents_archive_kpi",
    )
    private val MITGLIEDER = listOf(
        "quick_actions", "members_kpi", "contacts_summary", "departments_distribution", "upcoming_birthdays", "recent_members",
        "demographics_distribution", "upcoming_events", "meetings_summary",
    )
    private val KOMPAKT = listOf(
        "members_kpi", "total_liquidity", "annual_balance", "invoices_kpi", "contacts_kpi", "meetings_kpi", "wgb_limit_monitor",
        "tax_spheres_overview", "sepa_debit_monitor", "recent_journal_transactions",
    )

    /** Eine der fünf Vorlagen des Desktops; Einträge, die diese App nicht kennt, bleiben wie sie waren. */
    fun vorlage(a: Anordnung, v: Vorlage): Anordnung {
        val fremd = a.eintraege.filter { it.id !in BEKANNT }
        val neu = when (v) {
            Vorlage.STANDARD -> standardEintraege()
            Vorlage.ALLE -> KACHELN.mapIndexed { i, k -> KachelEintrag(k.id, true, i + 1, k.standardBreite) }
            else -> {
                val liste = when (v) { Vorlage.FINANZEN -> FINANZEN; Vorlage.MITGLIEDER -> MITGLIEDER; else -> KOMPAKT }
                KACHELN.mapIndexed { i, k ->
                    val pos = liste.indexOf(k.id)
                    KachelEintrag(k.id, pos >= 0, if (pos >= 0) pos + 1 else i + 50, if (v == Vorlage.FINANZEN && k.id == "cashflow_chart") 4 else k.standardBreite)
                }
            }
        }
        return a.copy(eintraege = neu + fremd)
    }

    // ---------- Kennzahlen

    data class MitgliederDaten(
        val bestand: Int, val passiv: Int, val neuImJahr: Int,
        val sparten: List<SpartenZeile>, val spartenAnzahl: Int,
        val altersgruppen: List<Anteil>, val maenner: Int, val frauen: Int, val divers: Int,
        val neueste: List<Member>,
        /** Geburtstage und hervorgehobene Mitgliedsjubiläen der nächsten [VORSCHAU_TAGE] Tage; der erste Eintrag mit Datum heute ist „heute“. */
        val anstehend: List<Besonderes>,
    )

    fun mitglieder(members: List<Member>, heute: LocalDate): MitgliederDaten {
        val k = MemberAnalytics.kennzahlen(members)
        val sp = MemberAnalytics.sparten(members)
        val g = MemberAnalytics.geschlechter(members).toMap()
        val jahr = heute.year.toString()
        val neu = members.count { it.status != "terminated" && it.entryDate.startsWith(jahr) }
        val neueste = MemberAnalytics.aktuelle(members).filter { it.entryDate.isNotEmpty() }.sortedByDescending { it.entryDate }.take(4)
        val anstehend = Kalender.besondere(members, heute, heute.plusDays(VORSCHAU_TAGE))
            .filter { it.art == "birthday" || it.jahre in JUBILAEEN }.take(6)
        return MitgliederDaten(
            k.gesamt, k.passiv, neu, sp.take(4), sp.size, MemberAnalytics.altersgruppen(members, GeschlechtFilter.ALLE, heute),
            g[GeschlechtFilter.M] ?: 0, g[GeschlechtFilter.W] ?: 0, g[GeschlechtFilter.D] ?: 0, neueste, anstehend,
        )
    }

    data class FinanzDaten(
        val kontenAnzahl: Int, val liquiditaet: BigDecimal, val jahr: String, val euer: Euer, val monate: List<MonatsSumme>, val letzte: List<Buchung>,
    )

    fun finanzen(konten: List<Konto>, buchungen: List<Buchung>, heute: LocalDate): FinanzDaten {
        val jahr = heute.year.toString()
        val staende = Finance.kontostaende(konten, buchungen)
        val aus = Finanzauswertung.berechne(buchungen, konten, AuswFilter(jahr = jahr), emptyList(), heute)
        val letzte = buchungen.sortedWith(compareByDescending<Buchung> { it.datum }.thenByDescending { it.id }).take(5)
        return FinanzDaten(konten.size, Finance.gesamtLiquiditaet(staende), jahr, Berichte.euer(buchungen, jahr), aus.monate, letzte)
    }

    data class SepaDaten(val aktive: Int, val sepa: Int, val unvollstaendig: Int, val glaeubigerId: String, val jahresSoll: BigDecimal)

    private fun bank(m: Member, feld: String) = ((m.raw["bankDetails"] as? JsonObject)?.get(feld) as? JsonPrimitive)?.contentOrNull.orEmpty().trim()

    fun sepa(members: List<Member>, verein: VereinsForm): SepaDaten {
        val aktiv = members.filter { it.status == "active" }
        val sepa = aktiv.filter { it.paymentMethod == "sepa" }
        val luecke = sepa.count { bank(it, "iban").isEmpty() || bank(it, "mandateReference").isEmpty() }
        return SepaDaten(aktiv.size, sepa.size, luecke, verein.glaeubigerId, MemberAnalytics.kennzahlen(members).jahresSoll)
    }

    data class SpendenDaten(val jahr: String, val summe: BigDecimal, val geld: Int, val sach: Int)

    fun spenden(liste: List<DonationReceipt>, heute: LocalDate): SpendenDaten {
        val jahr = heute.year.toString()
        val d = liste.filter { it.date.startsWith(jahr) }
        return SpendenDaten(jahr, d.fold(BigDecimal.ZERO) { s, x -> s + x.amount }, d.count { it.type == "money" }, d.count { it.type != "money" })
    }

    data class RechnungsDaten(
        val offen: BigDecimal, val offenAnzahl: Int, val ueberfaellig: Int, val abgerechnet: BigDecimal, val bezahlt: Int, val entwuerfe: Int,
        val gesamt: Int, val neueste: List<Rechnung>,
    )

    /** Offen ist nur, was gestellt und noch nicht bezahlt ist; Entwürfe und Stornierte zählen weder als Forderung noch als abgerechnet. */
    fun rechnungen(liste: List<Rechnung>, heute: LocalDate): RechnungsDaten {
        val offen = liste.filter { it.status == "open" || it.status == "overdue" }
        val abger = liste.filter { it.status != "draft" && it.status != "cancelled" }
        return RechnungsDaten(
            offen.fold(BigDecimal.ZERO) { s, r -> s + r.brutto }, offen.size, offen.count { RechnungsRegeln.ueberfaellig(it.copy(status = "open"), heute) },
            abger.fold(BigDecimal.ZERO) { s, r -> s + r.brutto }, liste.count { it.status == "paid" }, liste.count { it.status == "draft" }, liste.size,
            liste.sortedByDescending { it.datum.ifEmpty { it.erstellt } }.take(4),
        )
    }

    data class KontaktDaten(val gesamt: Int, val nachArt: List<Pair<String, Int>>, val sponsoren: Int, val partner: Int, val zuletzt: List<Kontakt>)

    fun kontakte(liste: List<Kontakt>, arten: Collection<String>): KontaktDaten {
        val zahl = LinkedHashMap<String, Int>()
        for (k in liste) for (t in (k.typen.ifEmpty { listOf("other") })) zahl[t] = (zahl[t] ?: 0) + 1
        return KontaktDaten(
            liste.size, arten.map { it to (zahl[it] ?: 0) }, zahl["sponsor"] ?: 0, zahl["partner"] ?: 0,
            liste.sortedByDescending { it.geaendert.ifEmpty { it.erstellt } }.take(4),
        )
    }

    /** Die nächsten [max] Termine ab heute, auch aus Serien; mehrtägige zählen, solange sie laufen. */
    fun termine(liste: List<Termin>, heute: LocalDate, max: Int = 3): List<Vorkommen> =
        Kalender.vorkommen(liste, heute, heute.plusYears(1)).take(max)

    data class SitzungsDaten(val anstehend: List<Sitzung>, val anstehendAnzahl: Int, val offeneProtokolle: Int)

    fun sitzungen(liste: List<Sitzung>, heute: LocalDate): SitzungsDaten {
        val tag = heute.toString()
        val kommend = liste.filter { it.datum >= tag && it.status != "cancelled" }.sortedWith(compareBy({ it.datum }, { it.beginn }))
        return SitzungsDaten(kommend.take(3), kommend.size, liste.count { it.status == "draft" || it.status == "review" })
    }

    data class InventarDaten(val kennzahlen: InventarKennzahlen)

    fun inventar(liste: List<Artikel>, heute: LocalDate) = InventarDaten(Inventar.kennzahlen(liste, heute))

    data class DokumentDaten(val gesamt: Int, val belege: Int, val vertraege: Int, val protokolle: Int)

    fun dokumente(liste: List<Dokument>) = DokumentDaten(
        liste.size, liste.count { it.kategorie == "belege" }, liste.count { it.kategorie == "vertraege" }, liste.count { it.kategorie == "protokolle" },
    )
}
