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
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class MemberEditTest {
    private val heute = LocalDate.of(2026, 10, 26)
    private val jetzt = ZonedDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.UTC)

    private fun demoStore(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }

    private fun neu() = MemberRules.neu("M-0001", listOf("Fußball", "Turnen"), heute)
    private fun doc(json: String) = Json.parseToJsonElement(json).jsonObject
    private fun s(o: JsonObject, k: String) = (o[k] as JsonPrimitive).content

    // ---- Verknüpfungsregeln ----

    @Test fun vorgabenBeimNeuanlegen() {
        val f = neu()
        assertEquals("Fußball", f.department)
        assertEquals("2026-10-26", f.entryDate)
        assertEquals("2026-10-26", f.mandateDate)
        assertEquals("MANDAT-M-0001-2026", f.mandateReference)
        assertEquals("sepa", f.paymentMethod)
        assertEquals("yearly", f.feePeriod)
        assertEquals("120", f.fee)
        assertEquals("Deutschland", f.country)
        assertTrue(f.dataPrivacyConsent)
    }

    @Test fun statusGekuendigtSetztAllesAufBeitragsfrei() {
        val f = MemberRules.setStatus(neu(), "terminated", heute)
        assertEquals("ausgetreten", f.type)
        assertEquals("0", f.fee)
        assertEquals("none", f.feePeriod)
        assertEquals("exempt", f.paymentMethod)
        assertEquals("2026-10-26", f.exitDate)
        assertTrue(f.isFeeLocked)
        assertTrue(f.isPeriodLocked)
    }

    @Test fun austrittsdatumBleibtWennSchonGesetzt() {
        val f = MemberRules.setStatus(neu().copy(exitDate = "2026-12-31"), "terminated", heute)
        assertEquals("2026-12-31", f.exitDate)
    }

    @Test fun andererStatusHebtAusgetretenAuf() {
        val k = MemberRules.setStatus(neu(), "terminated", heute)
        val f = MemberRules.setStatus(k, "active", heute)
        assertEquals("full", f.type)
        assertEquals("active", f.status)
        // Beitrag bleibt wie er ist (Desktop-Verhalten): frei, bis Zahlweise oder Zahlungsart geändert wird.
        assertEquals("none", f.feePeriod)
    }

    @Test fun typAusgetretenSetztStatusGekuendigt() {
        val f = MemberRules.setType(neu(), "ausgetreten", heute)
        assertEquals("terminated", f.status)
        assertEquals("exempt", f.paymentMethod)
        assertEquals("2026-10-26", f.exitDate)
    }

    @Test fun typEhrenmitgliedLaesstStatusStehen() {
        val f = MemberRules.setType(neu().copy(status = "passive"), "honorary", heute)
        assertEquals("passive", f.status)
        assertEquals("0", f.fee)
        assertEquals("none", f.feePeriod)
        assertEquals("exempt", f.paymentMethod)
    }

    @Test fun andererTypMachtGekuendigteWiederAktiv() {
        val k = MemberRules.setStatus(neu(), "terminated", heute)
        val f = MemberRules.setType(k, "youth", heute)
        assertEquals("active", f.status)
        assertEquals("youth", f.type)
    }

    @Test fun typNormalAendertStatusNichtWennNichtGekuendigt() {
        val f = MemberRules.setType(neu().copy(status = "suspended"), "family", heute)
        assertEquals("suspended", f.status)
    }

    @Test fun zahlweiseKeineMachtBeitragsfrei() {
        val f = MemberRules.setFeePeriod(neu(), "none")
        assertEquals("0", f.fee)
        assertEquals("exempt", f.paymentMethod)
        assertTrue(f.isFeeLocked)
        assertFalse(f.isPeriodLocked)
    }

    @Test fun andereZahlweiseNachBeitragsfreiHolt120UndSepaZurueck() {
        val frei = MemberRules.setFeePeriod(neu(), "none")
        val f = MemberRules.setFeePeriod(frei, "monthly")
        assertEquals("monthly", f.feePeriod)
        assertEquals("sepa", f.paymentMethod)
        assertEquals("120", f.fee)
    }

    @Test fun andereZahlweiseBehaeltEigenenBeitrag() {
        val f = MemberRules.setFeePeriod(neu().copy(fee = "35,5"), "quarterly")
        assertEquals("35,5", f.fee)
        assertEquals(0, f.feeValue.compareTo(java.math.BigDecimal("35.5")))
    }

    @Test fun zahlungsartBeitragsfreiSetztZahlweiseKeine() {
        val f = MemberRules.setPayment(neu(), "exempt")
        assertEquals("none", f.feePeriod)
        assertEquals("0", f.fee)
    }

    @Test fun andereZahlungsartNachBeitragsfreiHoltJaehrlichUnd120() {
        val frei = MemberRules.setPayment(neu(), "exempt")
        val f = MemberRules.setPayment(frei, "transfer")
        assertEquals("transfer", f.paymentMethod)
        assertEquals("yearly", f.feePeriod)
        assertEquals("120", f.fee)
    }

    @Test fun beitragLesen() {
        assertEquals(0, MemberRules.parseFee("12,50").compareTo(java.math.BigDecimal("12.5")))
        assertEquals(0, MemberRules.parseFee("12.5").compareTo(java.math.BigDecimal("12.5")))
        assertEquals(0, MemberRules.parseFee("abc").signum())
        assertEquals(0, MemberRules.parseFee("-5").signum())
        assertEquals("12,5", MemberRules.formatFee(java.math.BigDecimal("12.50")))
        assertEquals("100", MemberRules.formatFee(java.math.BigDecimal("100.00")))
        assertEquals("0", MemberRules.formatFee(java.math.BigDecimal("0.00")))
    }

    // ---- Kontoinhaber ----

    @Test fun kontoinhaberFolgtDemNamenBuchstabeFuerBuchstabe() {
        var f = neu()
        for (c in "Max") f = MemberRules.setFirstName(f, f.firstName + c)
        assertEquals("Max", f.accountHolder)
        for (c in "Müller") f = MemberRules.setLastName(f, f.lastName + c)
        assertEquals("Max Müller", f.accountHolder)
        f = MemberRules.setFirstName(f, "Maximilian")
        assertEquals("Maximilian Müller", f.accountHolder)
    }

    @Test fun kontoinhaberVonDenElternBleibtErhalten() {
        var f = neu().copy(firstName = "Lena", lastName = "Kind", accountHolder = "Eltern Kind")
        f = MemberRules.setFirstName(f, "Lena-Marie")
        assertEquals("Eltern Kind", f.accountHolder)
    }

    @Test fun elternkontoNachTippenImNamenNichtUeberschrieben() {
        var f = neu()
        for (c in "Lena") f = MemberRules.setFirstName(f, f.firstName + c)
        f = f.copy(accountHolder = "Eltern Kind")
        for (c in "Kind") f = MemberRules.setLastName(f, f.lastName + c)
        assertEquals("Eltern Kind", f.accountHolder)
    }

    @Test fun geleerterKontoinhaberFuelltSichBeimNaechstenTippenImNamen() {
        var f = neu().copy(firstName = "Max", lastName = "Müller", accountHolder = "")
        f = MemberRules.setLastName(f, "Mueller")
        assertEquals("Max Mueller", f.accountHolder)
    }

    @Test fun nameGeleertLeertAuchDenSelbstEingetragenenKontoinhaber() {
        var f = neu()
        f = MemberRules.setFirstName(f, "M")
        f = MemberRules.setFirstName(f, "")
        assertEquals("", f.accountHolder)
    }

    @Test fun ibanWirdGrossUndOhneLeerzeichen() {
        assertEquals("DE89370400440532013000", MemberRules.setIban(neu(), "de89 3704 0044 0532 0130 00").iban)
    }

    // ---- Prüfungen ----

    @Test fun pflichtfelder() {
        val e = MemberRules.validate(neu().copy(number = "", entryDate = ""), emptyList())
        assertEquals(setOf("memberNumber", "firstName", "lastName", "entryDate", "iban", "accountHolder"), e.keys)
    }

    @Test fun ohneSepaKeineBankpflicht() {
        val f = neu().copy(firstName = "A", lastName = "B", paymentMethod = "transfer")
        assertTrue(MemberRules.validate(f, emptyList()).isEmpty())
    }

    @Test fun ungueltigeIbanVerhindertSpeichernNicht() {
        val f = neu().copy(firstName = "A", lastName = "B", iban = "DE00", accountHolder = "A B")
        assertTrue(MemberRules.validate(f, emptyList()).isEmpty())
        assertNotNull(MemberRules.ibanHinweis("DE00"))
    }

    @Test fun gueltigeIbanWirdBestaetigt() {
        assertTrue(MemberRules.ibanHinweis("DE89370400440532013000")!!.startsWith("Gültige DE-IBAN"))
        assertNull(MemberRules.ibanHinweis(""))
    }

    @Test fun doppelteNummerWirdAbgelehnt() {
        val f = neu().copy(firstName = "A", lastName = "B", paymentMethod = "cash", number = "mg-001")
        assertEquals(setOf("memberNumber"), MemberRules.validate(f, listOf("MG-001")).keys)
    }

    @Test fun fehlerReiter() {
        assertEquals(FormTab.BASIS, MemberRules.ersterFehlerReiter(mapOf("lastName" to "x", "iban" to "y")))
        assertEquals(FormTab.MITGLIEDSCHAFT, MemberRules.ersterFehlerReiter(mapOf("entryDate" to "x")))
        assertEquals(FormTab.ZAHLUNG, MemberRules.ersterFehlerReiter(mapOf("iban" to "x")))
        assertNull(MemberRules.ersterFehlerReiter(emptyMap()))
    }

    // ---- Nächste Nummer ----

    @Test fun naechsteNummerLeererBestand() {
        assertEquals("M-0001", MemberRules.naechsteNummer(emptyList()))
    }

    @Test fun naechsteNummerImFormatDesBestands() {
        assertEquals("MG-010", MemberRules.naechsteNummer(listOf("MG-001", "MG-009", "MG-004")))
        assertEquals("M-0111", MemberRules.naechsteNummer(listOf("M-0101", "M-0110", "M-0102")))
    }

    @Test fun naechsteNummerNachLoeschenKeineWiederholung() {
        // Desktop: Anzahl + 101 würde hier M-0103 vorschlagen, das schon vergeben ist.
        assertEquals("M-0111", MemberRules.naechsteNummer(listOf("M-0101", "M-0110")))
    }

    @Test fun naechsteNummerHaeufigsteVorsilbe() {
        assertEquals("MG-011", MemberRules.naechsteNummer(listOf("MG-001", "MG-010", "X-99")))
    }

    @Test fun naechsteNummerOhneZiffernAmEnde() {
        assertEquals("M-0001", MemberRules.naechsteNummer(listOf("Ehrenvorsitz")))
    }

    // ---- Dokument ----

    @Test fun unbekannteFelderBleibenErhalten() {
        val base = doc("""{"id":"mem-1","memberNumber":"MG-001","firstName":"A","lastName":"B","avatarUrl":"data:image/jpeg;base64,AAA","zusatz":{"x":1},
            "address":{"street":"S","extra":"e"},"bankDetails":{"iban":"DE00","sonst":"y"},"createdAt":"2015-03-01T08:00:00.000Z"}""")
        val f = MemberRules.von(Member.from(base)).copy(firstName = "Anna")
        val out = MemberDocument.build(f, base, jetzt)
        assertEquals("data:image/jpeg;base64,AAA", s(out, "avatarUrl"))
        assertEquals("""{"x":1}""", out["zusatz"].toString())
        assertEquals("e", s(out["address"] as JsonObject, "extra"))
        assertEquals("y", s(out["bankDetails"] as JsonObject, "sonst"))
        assertEquals("Anna", s(out, "firstName"))
        assertEquals("2015-03-01T08:00:00.000Z", s(out, "createdAt"))
        assertEquals("2026-10-26T08:30:00.000Z", s(out, "updatedAt"))
    }

    @Test fun beitragWirdAlsZahlGeschrieben() {
        val a = MemberDocument.build(neu().copy(fee = "120"), null, jetzt)
        assertEquals("120", a["feeAmount"].toString())
        val b = MemberDocument.build(neu().copy(fee = "12,5"), null, jetzt)
        assertEquals("12.5", b["feeAmount"].toString())
        val c = MemberDocument.build(neu().copy(fee = "0"), null, jetzt)
        assertEquals("0", c["feeAmount"].toString())
    }

    @Test fun formularRundreiseOhneAenderung() {
        val store = demoStore()
        for (m in store.all("members")) {
            val f = MemberRules.von(Member.from(m))
            val out = MemberDocument.build(f, m, jetzt)
            assertNull("Keine Änderung, kein Protokoll: ${s(m, "memberNumber")}", MemberAudit.geaendert(m, out, jetzt))
        }
    }

    // ---- Speichern und Protokoll ----

    @Test fun neuesMitgliedWirdAngelegtMitProtokoll() {
        val store = InMemoryDocumentStore()
        val f = neu().copy(firstName = "Max", lastName = "Muster", paymentMethod = "cash")
        MemberStore.speichern(store, f, jetzt)
        assertEquals(1, store.count("members"))
        val log = store.all("auditLogs").single()
        assertEquals("create", s(log, "action"))
        assertEquals("Neues Mitglied (M-0001) angelegt", s(log, "summary"))
        assertEquals("Admin", s(log, "author"))
        assertEquals("Max Muster", s(log, "memberName"))
        assertEquals(0, (log["changes"] as JsonArray).size)
        assertEquals("2026-10-26T08:30:00.000Z", s(store.get("members", f.id)!!, "createdAt"))
    }

    @Test fun aenderungWirdProtokolliert() {
        val store = demoStore()
        val vorher = store.count("auditLogs")
        val m = store.get("members", "mem-1")!!
        val f = MemberRules.von(Member.from(m)).copy(phone = "0170 999", fee = "17,5")
        MemberStore.speichern(store, f, jetzt)
        assertEquals(vorher + 1, store.count("auditLogs"))
        val log = store.all("auditLogs").last()
        assertEquals("update", s(log, "action"))
        assertEquals("2 Feld(er) aktualisiert (Telefon, Beitragshöhe)", s(log, "summary"))
        val ch = (log["changes"] as JsonArray).map { it as JsonObject }
        assertEquals("0171 1234567", s(ch[0], "oldValue"))
        assertEquals("0170 999", s(ch[0], "newValue"))
        assertEquals("15,00\u00a0€", s(ch[1], "oldValue"))
        assertEquals("17,50\u00a0€", s(ch[1], "newValue"))
        assertEquals("0170 999", s(store.get("members", "mem-1")!!, "phone"))
    }

    @Test fun leereFeldAufLeerIstKeineAenderung() {
        val store = demoStore()
        val m = store.get("members", "mem-1")!!
        // exitDate fehlt im Dokument; im Formular ist es leer: darf nicht als "– → –" erscheinen (Auffälligkeit 15).
        val f = MemberRules.von(Member.from(m))
        assertEquals("", f.exitDate)
        val vorher = store.count("auditLogs")
        MemberStore.speichern(store, f, jetzt)
        assertEquals(vorher, store.count("auditLogs"))
    }

    @Test fun adresseUndIbanErscheinenAlsBloecke() {
        val store = demoStore()
        val m = store.get("members", "mem-1")!!
        val f = MemberRules.von(Member.from(m)).copy(city = "Neustadt", iban = "DE89370400440532013000")
        MemberStore.speichern(store, f, jetzt)
        val log = store.all("auditLogs").last()
        assertEquals("2 Feld(er) aktualisiert (Adresse, Bankverbindung / SEPA)", s(log, "summary"))
        val ch = (log["changes"] as JsonArray).map { it as JsonObject }
        assertEquals("Hauptstraße 42, 12345 Neustadt", s(ch[0], "newValue"))
        assertEquals("IBAN: DE12370501980000123456", s(ch[1], "oldValue"))
        assertEquals("IBAN: DE89370400440532013000", s(ch[1], "newValue"))
    }

    // ---- Löschen ----

    private fun material(store: InMemoryDocumentStore) {
        store.put("memberInventory", "a1", doc("""{"id":"a1","memberId":"mem-1","status":"issued","inventoryItemId":"i1","quantity":1}"""))
        store.put("memberInventory", "a2", doc("""{"id":"a2","memberId":"mem-1","status":"returned","returnDate":"2025-01-01","inventoryItemId":"i2","quantity":1}"""))
        store.put("memberInventory", "a3", doc("""{"id":"a3","memberId":"mem-2","status":"issued","inventoryItemId":"i3","quantity":1}"""))
        store.put("documents", "d1", doc("""{"id":"d1","memberId":"mem-1","title":"Antrag"}"""))
        store.put("documents", "d2", doc("""{"id":"d2","memberId":"mem-2","title":"Anderes"}"""))
    }

    @Test fun abhaengigkeitenZaehlen() {
        val store = demoStore(); material(store)
        assertEquals(1 to 1, MemberStore.abhaengigkeiten(store, "mem-1"))
        assertEquals(1 to 1, MemberStore.abhaengigkeiten(store, "mem-2"))
        assertEquals(0 to 0, MemberStore.abhaengigkeiten(store, "mem-5"))
    }

    @Test fun loeschenMitRueckgabeUndDokumentenBehalten() {
        val store = demoStore(); material(store)
        val r = MemberStore.loeschen(store, "mem-1", DocumentChoice.KEEP, MaterialChoice.Return, jetzt)
        assertEquals(DeleteReport(0, 1, 0), r)
        assertNull(store.get("members", "mem-1"))
        assertEquals("returned", s(store.get("memberInventory", "a1")!!, "status"))
        assertEquals("2026-10-26", s(store.get("memberInventory", "a1")!!, "returnDate"))
        assertEquals("2025-01-01", s(store.get("memberInventory", "a2")!!, "returnDate"))
        assertEquals("issued", s(store.get("memberInventory", "a3")!!, "status"))
        assertNotNull(store.get("documents", "d1"))
        val log = store.all("auditLogs").last()
        assertEquals("delete", s(log, "action"))
        assertEquals("Mitglied (MG-001 - Maximilian Müller) gelöscht", s(log, "summary"))
    }

    @Test fun loeschenMitUebertragungUndDokumenteLoeschen() {
        val store = demoStore(); material(store)
        val r = MemberStore.loeschen(store, "mem-1", DocumentChoice.DELETE, MaterialChoice.Transfer("mem-3"), jetzt)
        assertEquals(DeleteReport(1, 0, 1), r)
        assertEquals("mem-3", s(store.get("memberInventory", "a1")!!, "memberId"))
        assertEquals("issued", s(store.get("memberInventory", "a1")!!, "status"))
        assertEquals("mem-1", s(store.get("memberInventory", "a2")!!, "memberId"))
        assertNull(store.get("documents", "d1"))
        assertNotNull(store.get("documents", "d2"))
    }

    @Test fun uebertragungAufNichtvorhandenesMitgliedBricht_abUndLaesstAllesStehen() {
        val store = demoStore(); material(store)
        try {
            MemberStore.loeschen(store, "mem-1", DocumentChoice.DELETE, MaterialChoice.Transfer("gibt-es-nicht"), jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("Ziel-Mitglied"))
        }
        assertNotNull(store.get("members", "mem-1"))
        assertNotNull(store.get("documents", "d1"))
        assertEquals("issued", s(store.get("memberInventory", "a1")!!, "status"))
    }

    @Test fun uebertragungAufSichSelbstWirdAbgelehnt() {
        val store = demoStore(); material(store)
        try {
            MemberStore.loeschen(store, "mem-1", DocumentChoice.KEEP, MaterialChoice.Transfer("mem-1"), jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertNotNull(store.get("members", "mem-1"))
        }
    }

    @Test fun unbekanntesMitgliedLoeschen() {
        try {
            MemberStore.loeschen(demoStore(), "nein", DocumentChoice.KEEP, MaterialChoice.Return, jetzt)
            fail("Es hätte ein Fehler kommen müssen")
        } catch (e: IllegalArgumentException) {
            assertEquals("Mitglied nicht gefunden.", e.message)
        }
    }

    @Test fun ohneSparteBleibtDasFeldLeer() {
        assertEquals("", MemberRules.neu("M-0001", emptyList(), heute).department)
        assertEquals("Chor", MemberRules.neu("M-0001", listOf("Chor", "Orchester"), heute).department)
    }
}
