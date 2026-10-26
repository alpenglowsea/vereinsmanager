package de.vereinsmanager.core.members

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class MemberBulkTest {
    private val heute = LocalDate.of(2026, 10, 26)
    private val jetzt = ZonedDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.UTC)

    private fun demoStore(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }

    private fun neu() = MemberRules.neu("M-0001", listOf("Fußball"), heute)
    private fun s(o: JsonObject, k: String) = (o[k] as JsonPrimitive).content
    private fun doc(json: String) = Json.parseToJsonElement(json).jsonObject

    @Test fun leereAenderung() {
        assertTrue(BulkEdit().isEmpty)
        assertTrue(BulkEdit(notes = NotesEdit.Append("   ")).isEmpty)
        assertTrue(BulkEdit(entryDate = "").isEmpty)
        assertFalse(BulkEdit(exitDate = "").isEmpty)
        assertFalse(BulkEdit(dataPrivacyConsent = false).isEmpty)
    }

    @Test fun statusGekuendigtWendetDieFormularregelnAn() {
        val store = demoStore()
        val r = MemberStore.sammelAendern(store, listOf("mem-1", "mem-2"), BulkEdit(status = "terminated"), jetzt)
        assertEquals(BulkReport(2, 0, 0), r)
        for (id in listOf("mem-1", "mem-2")) {
            val m = store.get("members", id)!!
            assertEquals("terminated", s(m, "status"))
            assertEquals("ausgetreten", s(m, "membershipType"))
            assertEquals("exempt", s(m, "paymentMethod"))
            assertEquals("none", s(m, "feePeriod"))
            assertEquals("0", m["feeAmount"].toString())
            assertEquals("2026-10-26", s(m, "exitDate"))
        }
        val log = store.all("auditLogs").last()
        assertTrue(s(log, "summary").startsWith("Sammeländerung Stammdaten: "))
        val labels = (log["changes"] as JsonArray).map { s(it as JsonObject, "label") }
        assertTrue(labels.containsAll(listOf("Mitgliedsstatus", "Mitgliedschaftstyp", "Zahlungsmethode", "Zahlungsweise", "Beitragshöhe", "Austrittsdatum")))
    }

    @Test fun nurGeaenderteMitgliederBekommenEintragUndZeitstempel() {
        val store = demoStore()
        val vorher = store.count("auditLogs")
        val stempel2 = s(store.get("members", "mem-2")!!, "updatedAt")
        // mem-1 hat Fälligkeitstag 1, mem-2 schon 15.
        val r = MemberStore.sammelAendern(store, listOf("mem-1", "mem-2"), BulkEdit(monthlyDueDay = 15), jetzt)
        assertEquals(BulkReport(1, 1, 0), r)
        assertEquals(vorher + 1, store.count("auditLogs"))
        assertEquals(stempel2, s(store.get("members", "mem-2")!!, "updatedAt"))
        assertEquals("2026-10-26T08:30:00.000Z", s(store.get("members", "mem-1")!!, "updatedAt"))
        val ch = (store.all("auditLogs").last()["changes"] as JsonArray).map { it as JsonObject }.single()
        assertEquals("Fälligkeitstag (monatlicher Einzug)", s(ch, "label"))
        assertEquals("1. des Monats", s(ch, "oldValue"))
        assertEquals("15. des Monats", s(ch, "newValue"))
        // Bankdaten sonst unverändert
        val bank = store.get("members", "mem-1")!!["bankDetails"] as JsonObject
        assertEquals("DE12370501980000123456", s(bank, "iban"))
        assertEquals("15", bank["monthlyDueDay"].toString())
    }

    @Test fun spartenwechselZaehltNurWirkliche() {
        val store = demoStore()
        val r = MemberStore.sammelAendern(store, listOf("mem-1", "mem-8", "mem-2"), BulkEdit(department = "Fußball"), jetzt)
        assertEquals(BulkReport(1, 2, 0), r)
        assertEquals("Fußball", s(store.get("members", "mem-2")!!, "department"))
    }

    @Test fun beitragWirdGesetztWennNichtGesperrt() {
        val r = MemberBulk.anwenden(neu(), BulkEdit(fee = BigDecimal("50")), heute)
        assertFalse(r.feeSkipped)
        assertEquals("50", r.form.fee)
    }

    @Test fun beitragBeiGesperrtemMitgliedWirdUebersprungen() {
        val frei = neu().copy(feePeriod = "none", fee = "0", paymentMethod = "exempt")
        val r = MemberBulk.anwenden(frei, BulkEdit(fee = BigDecimal("50")), heute)
        assertTrue(r.feeSkipped)
        assertEquals("0", r.form.fee)
    }

    @Test fun statusGekuendigtUndBeitragZusammen() {
        val r = MemberBulk.anwenden(neu(), BulkEdit(status = "terminated", fee = BigDecimal("50")), heute)
        assertTrue(r.feeSkipped)
        assertEquals("0", r.form.fee)
    }

    @Test fun zahlungsartBeitragsfreiMachtZahlweiseKeine() {
        val r = MemberBulk.anwenden(neu(), BulkEdit(paymentMethod = "exempt"), heute)
        assertEquals("none", r.form.feePeriod)
        assertEquals("0", r.form.fee)
    }

    @Test fun notizenAnhaengenUndErsetzen() {
        assertEquals("neu", MemberBulk.anwenden(neu(), BulkEdit(notes = NotesEdit.Append(" neu ")), heute).form.notes)
        assertEquals("alt\nneu", MemberBulk.anwenden(neu().copy(notes = "alt"), BulkEdit(notes = NotesEdit.Append("neu")), heute).form.notes)
        assertEquals("neu", MemberBulk.anwenden(neu().copy(notes = "alt"), BulkEdit(notes = NotesEdit.Replace("neu")), heute).form.notes)
        assertEquals("alt", MemberBulk.anwenden(neu().copy(notes = "alt"), BulkEdit(notes = NotesEdit.Replace("")), heute).form.notes)
        assertEquals("alt", MemberBulk.anwenden(neu().copy(notes = "alt"), BulkEdit(notes = NotesEdit.Append("  ")), heute).form.notes)
    }

    @Test fun datenLeerUndGesetzt() {
        val f = neu().copy(exitDate = "2026-01-01", entryDate = "2020-01-01")
        assertEquals("", MemberBulk.anwenden(f, BulkEdit(exitDate = ""), heute).form.exitDate)
        assertEquals("2026-01-01", MemberBulk.anwenden(f, BulkEdit(entryDate = ""), heute).form.exitDate)
        assertEquals("2020-01-01", MemberBulk.anwenden(f, BulkEdit(entryDate = ""), heute).form.entryDate)
        assertEquals("2021-05-05", MemberBulk.anwenden(f, BulkEdit(entryDate = "2021-05-05"), heute).form.entryDate)
        assertEquals("2026-01-01", MemberBulk.anwenden(f, BulkEdit(), heute).form.exitDate)
    }

    @Test fun ausdruecklichesAustrittsdatumGewinntGegenDieAutomatik() {
        val r = MemberBulk.anwenden(neu(), BulkEdit(status = "terminated", exitDate = "2026-12-31"), heute)
        assertEquals("2026-12-31", r.form.exitDate)
    }

    @Test fun datenschutzEinwilligungWirdProtokolliert() {
        val store = demoStore()
        MemberStore.sammelAendern(store, listOf("mem-1"), BulkEdit(dataPrivacyConsent = false), jetzt)
        assertEquals("false", store.get("members", "mem-1")!!["dataPrivacyConsent"].toString())
        val ch = (store.all("auditLogs").last()["changes"] as JsonArray).map { it as JsonObject }.single()
        assertEquals("Datenschutz-Einwilligung", s(ch, "label"))
        assertEquals("Zugestimmt", s(ch, "oldValue"))
        assertEquals("Nicht erteilt", s(ch, "newValue"))
    }

    @Test fun unbekannteKennungBrichtAllesAb() {
        val store = demoStore()
        val vorher = store.count("auditLogs")
        try {
            MemberStore.sammelAendern(store, listOf("mem-1", "nein"), BulkEdit(status = "passive"), jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertEquals("active", s(store.get("members", "mem-1")!!, "status"))
            assertEquals(vorher, store.count("auditLogs"))
        }
    }

    // ---- Sammellöschen ----

    @Test fun sammelLoeschenSchreibtEinenEintragJeMitglied() {
        val store = demoStore()
        val vorher = store.count("auditLogs")
        val r = MemberStore.sammelLoeschen(store, listOf("mem-7", "mem-8"), DocumentChoice.KEEP, MaterialChoice.Return, jetzt)
        assertEquals(DeleteReport(0, 0, 0), r)
        assertEquals(7, store.count("members"))
        assertNull(store.get("members", "mem-7"))
        assertEquals(vorher + 2, store.count("auditLogs"))
        val sums = store.all("auditLogs").takeLast(2).map { s(it, "summary") }
        assertEquals(
            listOf(
                "Sammellöschung: Mitglied (MG-007 - Sophie Becker) gelöscht",
                "Sammellöschung: Mitglied (MG-008 - Jonas Richter) gelöscht",
            ),
            sums,
        )
    }

    @Test fun sammelLoeschenMaterialUebertragenAufAnderesMitglied() {
        val store = demoStore()
        store.put("memberInventory", "a1", doc("""{"id":"a1","memberId":"mem-7","status":"issued"}"""))
        store.put("memberInventory", "a2", doc("""{"id":"a2","memberId":"mem-8","status":"issued"}"""))
        val r = MemberStore.sammelLoeschen(store, listOf("mem-7", "mem-8"), DocumentChoice.KEEP, MaterialChoice.Transfer("mem-1"), jetzt)
        assertEquals(DeleteReport(0, 0, 2), r)
        assertEquals("mem-1", s(store.get("memberInventory", "a1")!!, "memberId"))
        assertEquals("mem-1", s(store.get("memberInventory", "a2")!!, "memberId"))
    }

    @Test fun sammelLoeschenZielImselbenSatzWirdAbgelehnt() {
        val store = demoStore()
        try {
            MemberStore.sammelLoeschen(store, listOf("mem-7", "mem-8"), DocumentChoice.KEEP, MaterialChoice.Transfer("mem-8"), jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertNotNull(store.get("members", "mem-7"))
            assertEquals(9, store.count("members"))
        }
    }

    @Test fun sammelLoeschenUnbekannteKennungLaesstAllesStehen() {
        val store = demoStore()
        try {
            MemberStore.sammelLoeschen(store, listOf("mem-7", "nein"), DocumentChoice.KEEP, MaterialChoice.Return, jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertEquals(9, store.count("members"))
        }
    }

    @Test fun protokollanzeigeIstDeutsch() {
        val store = demoStore()
        MemberStore.sammelAendern(store, listOf("mem-5"), BulkEdit(status = "active", paymentMethod = "sepa", fee = BigDecimal("42.5")), jetzt)
        val ch = (store.all("auditLogs").last()["changes"] as JsonArray).map { it as JsonObject }.associateBy { s(it, "field") }
        assertEquals("Passiv", s(ch.getValue("status"), "oldValue"))
        assertEquals("Aktiv", s(ch.getValue("status"), "newValue"))
        assertEquals("Überweisung", s(ch.getValue("paymentMethod"), "oldValue"))
        assertEquals("SEPA-Lastschrift", s(ch.getValue("paymentMethod"), "newValue"))
        assertEquals("42,50 €", s(ch.getValue("feeAmount"), "newValue"))
    }
}
