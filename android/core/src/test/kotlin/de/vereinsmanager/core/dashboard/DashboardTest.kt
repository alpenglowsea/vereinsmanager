package de.vereinsmanager.core.dashboard

import de.vereinsmanager.core.finance.Berichte
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class DashboardTest {
    private val heute = LocalDate.of(2026, 11, 14)
    private fun bd(s: String) = BigDecimal(s)

    private fun mitglied(
        id: String, status: String = "active", geb: String = "", eintritt: String = "2020-01-01", sparte: String = "Fußball",
        zahlart: String = "sepa", beitrag: Int = 10, periode: String = "monthly", iban: String = "DE89370400440532013000", mandat: String = "MR-1",
    ) = Member.from(buildJsonObject {
        put("id", id); put("memberNumber", id); put("firstName", "V$id"); put("lastName", "N$id"); put("status", status)
        put("membershipType", "full"); put("department", sparte); put("entryDate", eintritt); put("birthDate", geb); put("gender", "m")
        put("paymentMethod", zahlart); put("feeAmount", beitrag); put("feePeriod", periode)
        put("bankDetails", buildJsonObject { put("iban", iban); put("mandateReference", mandat) })
    })

    private fun buchung(id: String, datum: String, betrag: String, sphaere: String = "ideell", art: String = "income") = Buchung.from(JsonObject(mapOf(
        "id" to JsonPrimitive(id), "date" to JsonPrimitive(datum), "amount" to JsonPrimitive(betrag), "type" to JsonPrimitive(art),
        "accountId" to JsonPrimitive("k1"), "sphere" to JsonPrimitive(sphaere), "vatRate" to JsonPrimitive(0),
    )))

    private val konten = listOf(Konto("k1", "Giro", "bank", "", "", bd("100"), "blue", "", null))

    // ---------- Freigrenze

    @Test fun freigrenzeJeNachJahr() {
        assertEquals(0, bd("45000").compareTo(Berichte.wgbGrenze("2025")))
        assertEquals(0, bd("50000").compareTo(Berichte.wgbGrenze("2026")))
        assertEquals(0, bd("50000").compareTo(Berichte.wgbGrenze("2031")))
        val b = listOf(buchung("1", "2026-03-01", "47000", "wirtschaftlich"))
        assertFalse(Berichte.euer(b, "2026").grenze!!.ueberschritten)
        assertTrue(Berichte.euer(listOf(buchung("1", "2025-03-01", "47000", "wirtschaftlich")), "2025").grenze!!.ueberschritten)
        assertTrue(Berichte.euer(listOf(buchung("1", "2026-03-01", "50000.01", "wirtschaftlich")), "2026").grenze!!.ueberschritten)
        assertFalse(Berichte.euer(listOf(buchung("1", "2026-03-01", "50000.00", "wirtschaftlich")), "2026").grenze!!.ueberschritten)
    }

    // ---------- Anordnung

    @Test fun standardAnordnungUndSichtbarkeit() {
        val a = Dashboard.standard()
        val s = Dashboard.sichtbar(a)
        assertEquals("quick_actions", s.first().id)
        assertTrue(s.none { it.id == "cashflow_chart" })
        assertEquals(Dashboard.KACHELN.count { it.standardAn }, s.size)
        assertEquals(Dashboard.KACHELN.size, Dashboard.alle(a).size)
        assertEquals(s.size, Dashboard.alle(a).count { it.second })
    }

    @Test fun ausblendenEinblendenVerschieben() {
        var a = Dashboard.standard()
        a = Dashboard.umschalten(a, "club_header", false)
        assertFalse(Dashboard.sichtbar(a).any { it.id == "club_header" })
        a = Dashboard.umschalten(a, "cashflow_chart", true)
        assertEquals("cashflow_chart", Dashboard.sichtbar(a).last().id)
        a = Dashboard.verschieben(a, "cashflow_chart", -1)
        val ids = Dashboard.sichtbar(a).map { it.id }
        assertEquals("cashflow_chart", ids[ids.size - 2])
        a = Dashboard.verschieben(a, "quick_actions", -1) // schon oben: bleibt
        assertEquals("quick_actions", Dashboard.sichtbar(a).first().id)
        a = Dashboard.verschieben(a, "quick_actions", 1)
        assertEquals("members_kpi", Dashboard.sichtbar(a).first().id)
        assertEquals(a, Dashboard.verschieben(a, "club_header", 1)) // ausgeblendet: nichts geschieht
        assertEquals(a, Dashboard.umschalten(a, "gibt_es_nicht", true))
    }

    @Test fun speichernLesenBehaeltFremdesUndBreite() {
        val s = InMemoryDocumentStore()
        val desktop = JsonObject(mapOf(
            "id" to JsonPrimitive("main_dashboard"), "version" to JsonPrimitive(1), "extra" to JsonPrimitive("bleibt"),
            "widgets" to JsonArray(listOf(
                JsonObject(mapOf("id" to JsonPrimitive("online_applications_kpi"), "enabled" to JsonPrimitive(true), "order" to JsonPrimitive(1), "colSpan" to JsonPrimitive(2))),
                JsonObject(mapOf("id" to JsonPrimitive("members_kpi"), "enabled" to JsonPrimitive(true), "order" to JsonPrimitive(2), "colSpan" to JsonPrimitive(2))),
                JsonObject(mapOf("id" to JsonPrimitive("total_liquidity"), "enabled" to JsonPrimitive(false), "order" to JsonPrimitive(3), "colSpan" to JsonPrimitive(1))),
            )),
        ))
        s.put(Dashboard.AREA, Dashboard.ID, desktop)
        var a = Dashboard.lesen(s)
        // Online-Anträge gibt es hier nicht; neu ergänzt und gleich angezeigt wird nur „Unterlagen laufen ab“ (Paket U)
        assertEquals(listOf("members_kpi", "member_documents_expiry"), Dashboard.sichtbar(a).map { it.id })
        // alle anderen Kacheln der App sind ergänzt und ausgeblendet
        assertEquals(Dashboard.KACHELN.size, Dashboard.alle(a).size)
        a = Dashboard.umschalten(a, "total_liquidity", true)
        Dashboard.speichern(s, a, ZonedDateTime.of(2026, 11, 14, 10, 0, 0, 0, ZoneOffset.UTC))
        val danach = s.get(Dashboard.AREA, Dashboard.ID)!!
        assertEquals("bleibt", (danach["extra"] as JsonPrimitive).content)
        val w = (danach["widgets"] as JsonArray).map { it as JsonObject }
        assertTrue(w.any { (it["id"] as JsonPrimitive).content == "online_applications_kpi" && (it["colSpan"] as JsonPrimitive).content == "2" })
        assertEquals(listOf("members_kpi", "member_documents_expiry", "total_liquidity"), Dashboard.sichtbar(Dashboard.lesen(s)).map { it.id }) // eingeblendete Kachel kommt ans Ende
    }

    @Test fun vorlagenWieAmDesktop() {
        val a = Dashboard.standard()
        val f = Dashboard.sichtbar(Dashboard.vorlage(a, Vorlage.FINANZEN)).map { it.id }
        assertEquals(listOf("quick_actions", "total_liquidity", "annual_balance", "invoices_overview", "wgb_limit_monitor", "donations_summary",
            "tax_spheres_overview", "sepa_debit_monitor", "recent_journal_transactions", "cashflow_chart", "documents_archive_kpi"), f)
        val k = Dashboard.sichtbar(Dashboard.vorlage(a, Vorlage.KOMPAKT)).map { it.id }
        assertEquals("members_kpi", k.first()); assertEquals(10, k.size)
        val m = Dashboard.sichtbar(Dashboard.vorlage(a, Vorlage.MITGLIEDER)).map { it.id }
        assertEquals(9, m.size) // die zehnte Kachel des Desktops, die Online-Anträge, gibt es hier nicht
        assertEquals(Dashboard.KACHELN.size, Dashboard.sichtbar(Dashboard.vorlage(a, Vorlage.ALLE)).size)
        assertEquals(Dashboard.sichtbar(a).map { it.id }, Dashboard.sichtbar(Dashboard.vorlage(Dashboard.vorlage(a, Vorlage.ALLE), Vorlage.STANDARD)).map { it.id })
    }

    // ---------- Mitglieder

    @Test fun geburtstagHeuteUndJubilaeen() {
        val liste = listOf(
            mitglied("1", geb = "1990-11-14"),                    // heute, wird 36
            mitglied("2", geb = "1980-11-20"),                    // in 6 Tagen, 46
            mitglied("3", geb = "1980-12-20"),                    // in 36 Tagen: nicht dabei
            mitglied("4", eintritt = "2001-11-18"),               // 25 Jahre
            mitglied("5", eintritt = "2013-11-18"),               // 13 Jahre: kein Jubiläum
            mitglied("6", status = "terminated", geb = "1990-11-15"),
        )
        val d = Dashboard.mitglieder(liste, heute)
        assertEquals(listOf("1", "4", "2"), d.anstehend.map { it.memberId }) // nach Datum: 14., 18., 20. November
        assertEquals(heute, d.anstehend.first().datum)
        assertEquals("anniversary", d.anstehend[1].art)
        assertEquals(25, d.anstehend[1].jahre)
    }

    @Test fun jahreswechselUndSchalttag() {
        val ende = LocalDate.of(2026, 12, 28)
        val d = Dashboard.mitglieder(listOf(mitglied("1", geb = "1990-01-05"), mitglied("2", geb = "2000-02-29")), ende)
        assertEquals(listOf("1"), d.anstehend.map { it.memberId }) // 5.1.2027 liegt in 8 Tagen
        val feb = Dashboard.mitglieder(listOf(mitglied("2", geb = "2000-02-29")), LocalDate.of(2027, 2, 27))
        assertEquals(LocalDate.of(2027, 2, 28), feb.anstehend.single().datum) // ohne Schalttag am 28.2.
    }

    @Test fun mitgliederZahlenNurAktuelle() {
        val liste = listOf(
            mitglied("1", sparte = "Fußball", eintritt = "2026-02-01"), mitglied("2", status = "passive", sparte = "Fußball"),
            mitglied("3", status = "terminated", sparte = "Tennis", eintritt = "2026-03-01"), mitglied("4", sparte = "Tennis", eintritt = "2025-05-01"),
        )
        val d = Dashboard.mitglieder(liste, heute)
        assertEquals(3, d.bestand); assertEquals(1, d.passiv); assertEquals(1, d.neuImJahr)
        assertEquals(2, d.spartenAnzahl); assertEquals(2, d.sparten.first { it.name == "Fußball" }.anzahl); assertEquals(1, d.sparten.first { it.name == "Tennis" }.anzahl)
        assertEquals(3, d.maenner)
        assertEquals("1", d.neueste.first().id) // jüngstes Eintrittsdatum unter den Aktuellen
    }

    // ---------- Finanzen, SEPA, Rechnungen, Sitzungen

    @Test fun finanzenNutztEuerUndLiquiditaet() {
        val b = listOf(
            buchung("1", "2026-03-01", "300"), buchung("2", "2026-04-01", "-50", art = "expense"), buchung("3", "2025-04-01", "1000"),
            buchung("4", "2026-05-01", "20000", "wirtschaftlich"),
        )
        val f = Dashboard.finanzen(konten, b, heute)
        assertEquals(0, bd("21350").compareTo(f.liquiditaet)) // Anfangsbestand 100 + 300 − 50 + 1000 + 20000
        assertEquals(0, bd("20300").compareTo(f.euer.einnahmen)); assertEquals(0, bd("50").compareTo(f.euer.ausgaben))
        assertEquals(0, bd("50000").compareTo(f.euer.grenze!!.grenze))
        assertEquals(12, f.monate.size)
        assertEquals("4", f.letzte.first().id)
    }

    @Test fun sepaZaehltLueckenUndJahresSoll() {
        val l = listOf(
            mitglied("1", beitrag = 10), mitglied("2", iban = "", beitrag = 20), mitglied("3", mandat = ""), mitglied("4", zahlart = "transfer"),
            mitglied("5", status = "passive"),
        )
        val d = Dashboard.sepa(l, VereinsForm(glaeubigerId = "DE98ZZZ0"))
        assertEquals(4, d.aktive); assertEquals(3, d.sepa); assertEquals(2, d.unvollstaendig); assertEquals("DE98ZZZ0", d.glaeubigerId)
        // Jahres-Soll rechnet jeden Beitrag mit seinem Rhythmus (monatlich × 12), nicht als Summe der Einzelbeträge
        assertTrue(d.jahresSoll > bd("100"))
    }

    private fun rechnung(s: InMemoryDocumentStore, id: String, status: String, betrag: String, faellig: String, datum: String = "2026-10-01") =
        s.put("invoices", id, buildJsonObject {
            put("id", id); put("invoiceNumber", "R-$id"); put("status", status); put("totalAmount", betrag.toDouble()); put("date", datum); put("dueDate", faellig)
        })

    @Test fun rechnungenEntwuerfeUndStornosZaehlenNichtAlsForderung() {
        val s = InMemoryDocumentStore()
        rechnung(s, "1", "open", "100", "2026-11-01")   // überfällig
        rechnung(s, "2", "open", "50", "2026-12-01")    // offen, nicht fällig
        rechnung(s, "3", "paid", "200", "2026-10-15")
        rechnung(s, "4", "draft", "999", "2026-10-01")
        rechnung(s, "5", "cancelled", "888", "2026-10-01")
        val d = Dashboard.rechnungen(de.vereinsmanager.core.invoice.Rechnungen.alle(s), heute)
        assertEquals(0, bd("150").compareTo(d.offen)); assertEquals(2, d.offenAnzahl); assertEquals(1, d.ueberfaellig)
        assertEquals(0, bd("350").compareTo(d.abgerechnet)); assertEquals(1, d.bezahlt); assertEquals(1, d.entwuerfe); assertEquals(5, d.gesamt)
        assertEquals(4, d.neueste.size)
        // am Fälligkeitstag selbst ist noch nichts überfällig
        assertEquals(0, Dashboard.rechnungen(de.vereinsmanager.core.invoice.Rechnungen.alle(s), LocalDate.of(2026, 11, 1)).ueberfaellig)
    }

    @Test fun dokumenteZaehlenNachKategorie() {
        val mk = { k: String -> de.vereinsmanager.core.documents.Dokument.from(buildJsonObject { put("id", k + "1"); put("category", k) }) }
        val d = Dashboard.dokumente(listOf(mk("belege"), mk("belege"), mk("vertraege"), mk("protokolle"), mk("sonstiges")))
        assertEquals(5, d.gesamt); assertEquals(2, d.belege); assertEquals(1, d.vertraege); assertEquals(1, d.protokolle)
    }

    @Test fun naechsteTermineAuchAusSerien() {
        val s = InMemoryDocumentStore()
        fun t(id: String, beginn: String, ende: String = beginn, serie: Boolean = false) = s.put("calendarEvents", id, buildJsonObject {
            put("id", id); put("title", "T$id"); put("startDate", beginn); put("endDate", ende); put("isAllDay", true)
            if (serie) put("recurrence", buildJsonObject { put("frequency", "weekly"); put("interval", 1); put("endType", "never") })
        })
        t("a", "2026-11-10", "2026-11-15")        // läuft noch
        t("b", "2026-11-01")                        // vorbei
        t("c", "2026-10-01", serie = true)          // wöchentlich seit Oktober
        val v = Dashboard.termine(de.vereinsmanager.core.calendar.Kalender.alle(s), heute)
        assertEquals(3, v.size)
        assertEquals("a", v.first().termin.id)
        assertTrue(v.drop(1).all { it.termin.id == "c" })
    }
}
