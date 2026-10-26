package de.vereinsmanager.core.members

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime

class MemberMaterialTest {
    private val heute = LocalDate.of(2026, 10, 26)
    private val jetzt = ZonedDateTime.of(2026, 10, 26, 8, 30, 0, 0, ZoneOffset.UTC)

    private fun demo(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }

    private fun s(o: JsonObject, k: String) = (o[k] as JsonPrimitive).content

    @Test fun gegenstaendeSindSortiertUndKopierenNameNummerEinheit() {
        val g = MemberMaterial.gegenstaende(demo())
        assertEquals(15, g.size)
        assertEquals(g.map { it.name }.sortedBy { it.lowercase() }.size, g.size)
        val ball = g.first { it.id == "inv-1" }
        assertEquals("INV-FB-001", ball.nummer)
        assertEquals("Set", ball.einheit)
    }

    @Test fun neueAusgabe() {
        val st = demo()
        val d = MemberMaterial.speichern(
            st, "mem-1", AusgabeForm(itemId = "inv-7", quantity = "2", issueDate = "2026-10-20", hasContribution = true, contribution = "12,5", notes = " Größe L "),
            heute, jetzt,
        )
        assertEquals(1, st.count(MemberMaterial.AREA))
        assertTrue(s(d, "id").startsWith("mia_"))
        assertEquals("mem-1", s(d, "memberId"))
        assertEquals("inv-7", s(d, "inventoryItemId"))
        assertEquals("INV-BE-001", s(d, "itemNumber"))
        assertEquals("Set", s(d, "unit"))
        assertEquals("2", d["quantity"].toString())
        assertEquals("12.5", d["contributionAmount"].toString())
        assertEquals("issued", s(d, "status"))
        assertEquals("Größe L", s(d, "notes"))
        assertEquals("2026-10-26T08:30:00.000Z", s(d, "createdAt"))
        assertFalse(d.containsKey("returnDate"))
    }

    @Test fun ganzerEigenanteilOhneKommaUndOhneEigenanteilOhneFeld() {
        val st = demo()
        val a = MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-8", hasContribution = true, contribution = "10"), heute, jetzt)
        assertEquals("10", a["contributionAmount"].toString())
        val b = MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-8", hasContribution = false, contribution = "10"), heute, jetzt)
        assertFalse(b.containsKey("contributionAmount"))
        assertFalse(b.containsKey("notes"))
        assertEquals("2026-10-26", s(b, "issueDate"))
    }

    @Test fun pruefung() {
        val g = MemberMaterial.gegenstaende(demo())
        assertTrue(MemberMaterial.validate(AusgabeForm(itemId = "inv-1"), g).isEmpty())
        assertTrue("item" in MemberMaterial.validate(AusgabeForm(), g))
        assertTrue("item" in MemberMaterial.validate(AusgabeForm(itemId = "gibtsnicht"), g))
        assertTrue("quantity" in MemberMaterial.validate(AusgabeForm(itemId = "inv-1", quantity = "0"), g))
        assertTrue("quantity" in MemberMaterial.validate(AusgabeForm(itemId = "inv-1", quantity = "x"), g))
        assertTrue("issueDate" in MemberMaterial.validate(AusgabeForm(itemId = "inv-1", issueDate = "31.02.2026"), g))
    }

    @Test fun aendernBehaeltUnbekannteFelderUndErsteAnlage() {
        val st = demo()
        val a = MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-1"), heute, jetzt)
        val id = s(a, "id")
        st.put(MemberMaterial.AREA, id, JsonObject(a + ("extra" to JsonPrimitive("bleibt"))))
        val spaeter = ZonedDateTime.of(2026, 10, 27, 9, 0, 0, 0, ZoneOffset.UTC)
        val neu = MemberMaterial.speichern(st, "mem-1", AusgabeForm.von(Ausgabe.from(st.get(MemberMaterial.AREA, id)!!)).copy(itemId = "inv-2", quantity = "4"), heute, spaeter)
        assertEquals(1, st.count(MemberMaterial.AREA))
        assertEquals("bleibt", s(neu, "extra"))
        assertEquals("INV-FB-002", s(neu, "itemNumber"))
        assertEquals("4", neu["quantity"].toString())
        assertEquals(s(a, "createdAt"), s(neu, "createdAt"))
        assertEquals("2026-10-27T09:00:00.000Z", s(neu, "updatedAt"))
    }

    @Test fun zurueckgebenUndWiederAusgeben() {
        val st = demo()
        val id = s(MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-1"), heute, jetzt), "id")
        val r = MemberMaterial.umschalten(st, id, heute, jetzt)
        assertEquals("returned", s(r, "status"))
        assertEquals("2026-10-26", s(r, "returnDate"))
        assertTrue(Ausgabe.from(r).returned)
        val w = MemberMaterial.umschalten(st, id, heute, jetzt)
        assertEquals("issued", s(w, "status"))
        assertFalse(w.containsKey("returnDate"))
    }

    @Test fun entfernenUndFehlendeAusgabe() {
        val st = demo()
        val id = s(MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-1"), heute, jetzt), "id")
        MemberMaterial.entfernen(st, id)
        assertEquals(0, st.count(MemberMaterial.AREA))
        var fehler = false
        try { MemberMaterial.umschalten(st, id, heute, jetzt) } catch (e: IllegalArgumentException) { fehler = true }
        assertTrue(fehler)
    }

    @Test fun listeNurDesMitgliedsNeuesteZuerst() {
        val st = demo()
        MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-1", issueDate = "2026-01-01"), heute, jetzt)
        MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-2", issueDate = "2026-05-01"), heute, jetzt)
        MemberMaterial.speichern(st, "mem-2", AusgabeForm(itemId = "inv-3"), heute, jetzt)
        val l = MemberMaterial.ausgaben(st, "mem-1")
        assertEquals(listOf("inv-2", "inv-1"), l.map { it.itemId })
        assertEquals(1, MemberMaterial.ausgaben(st, "mem-2").size)
        assertTrue(MemberMaterial.ausgaben(st, "mem-3").isEmpty())
    }

    @Test fun abhaengigkeitenZaehlenNurAusgegebenes() {
        val st = demo()
        val id = s(MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-1"), heute, jetzt), "id")
        MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-2"), heute, jetzt)
        assertEquals(2, MemberStore.abhaengigkeiten(st, "mem-1").first)
        MemberMaterial.umschalten(st, id, heute, jetzt)
        assertEquals(1, MemberStore.abhaengigkeiten(st, "mem-1").first)
    }

    @Test fun eigenanteilText() {
        val a = Ausgabe.from(JsonObject(mapOf("id" to JsonPrimitive("x"), "hasContribution" to JsonPrimitive(true), "contributionAmount" to JsonPrimitive(12.5))))
        assertEquals("Eigenanteil: 12,50 €", MemberMaterial.eigenanteil(a))
        val b = Ausgabe.from(JsonObject(mapOf("id" to JsonPrimitive("x"), "hasContribution" to JsonPrimitive(true), "contributionAmount" to JsonPrimitive(0))))
        assertEquals("Kein Eigenanteil", MemberMaterial.eigenanteil(b))
        assertEquals(1, Ausgabe.from(JsonObject(emptyMap())).quantity)
        assertNull(Ausgabe.from(JsonObject(emptyMap())).contribution)
    }

    // ---- Historie ----

    @Test fun historieNurDesMitgliedsMitWerten() {
        val st = demo()
        val h = MemberHistory.fuer(st, "mem-2")
        assertEquals(1, h.size)
        assertEquals("Vorstand (Dr. Sommer)", h[0].author)
        assertEquals("Notizen", h[0].changes[0].first)
        assertEquals("Tennisspielerin", h[0].changes[0].second)
        assertTrue(MemberHistory.fuer(st, "mem-3").isEmpty())
    }

    @Test fun historieNeuesteZuerst() {
        val st = demo()
        val alt = st.get(MemberStore.LOG, "log-2")!!
        st.put(MemberStore.LOG, "log-9", JsonObject(alt + mapOf("id" to JsonPrimitive("log-9"), "timestamp" to JsonPrimitive("2026-01-01T10:00:00.000Z"))))
        assertEquals(listOf("log-9", "log-2"), MemberHistory.fuer(st, "mem-2").map { it.id })
    }

    @Test fun werteWieAmDesktop() {
        assertEquals("–", MemberHistory.wert(null))
        assertEquals("–", MemberHistory.wert(JsonNull))
        assertEquals("–", MemberHistory.wert(JsonPrimitive("")))
        assertEquals("–", MemberHistory.wert(JsonPrimitive(0)))
        assertEquals("–", MemberHistory.wert(JsonPrimitive(false)))
        assertEquals("true", MemberHistory.wert(JsonPrimitive(true)))
        assertEquals("15", MemberHistory.wert(JsonPrimitive(15)))
        assertEquals("Ja", MemberHistory.wert(JsonPrimitive("Ja")))
    }

    @Test fun zeitInOrtszeit() {
        assertEquals("26.10.2026, 09:30:00", MemberHistory.zeit("2026-10-26T08:30:00.000Z", ZoneId.of("Europe/Berlin")))
        assertEquals("27.03.2026, 14:00:00", MemberHistory.zeit("2026-03-27T13:00:00.000Z", ZoneId.of("Europe/Berlin")))
        assertEquals("kaputt", MemberHistory.zeit("kaputt"))
    }

    // ---- Protokoll der Materialvorgänge ----

    private fun logs(st: InMemoryDocumentStore, memberId: String) = MemberHistory.fuer(st, memberId).map { it.summary }

    @Test fun vorgaengeStehenInDerHistorie() {
        val st = demo()
        val a = MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-7", quantity = "2"), heute, jetzt)
        val id = s(a, "id")
        assertTrue("Material ausgegeben: Trikotsatz ERIMA Squad (16 Trikots + Hosen + Stutzen) (2 Set)" in logs(st, "mem-1"))
        MemberMaterial.speichern(st, "mem-1", AusgabeForm.von(Ausgabe.from(a)).copy(quantity = "3", notes = "neu"), heute, jetzt)
        val bearbeitet = MemberHistory.fuer(st, "mem-1").first { it.summary.startsWith("Material bearbeitet") }
        assertEquals(listOf("Menge", "Notiz"), bearbeitet.changes.map { it.first })
        assertEquals("2", bearbeitet.changes[0].second)
        assertEquals("3", bearbeitet.changes[0].third)
        MemberMaterial.umschalten(st, id, heute, jetzt)
        MemberMaterial.umschalten(st, id, heute, jetzt)
        MemberMaterial.entfernen(st, id, jetzt)
        val l = logs(st, "mem-1")
        assertTrue(l.any { it.startsWith("Material zurückgegeben") })
        assertTrue(l.any { it.startsWith("Material wieder ausgegeben") })
        assertTrue(l.any { it.startsWith("Material-Verknüpfung entfernt") })
        // Ohne Änderung kein Eintrag.
        val st2 = demo()
        val b = MemberMaterial.speichern(st2, "mem-1", AusgabeForm(itemId = "inv-7"), heute, jetzt)
        val n = st2.count(MemberStore.LOG)
        MemberMaterial.speichern(st2, "mem-1", AusgabeForm.von(Ausgabe.from(b)), heute, jetzt)
        assertEquals(n, st2.count(MemberStore.LOG))
    }

    @Test fun uebertragungStehtBeimZielMitglied() {
        val st = demo()
        MemberMaterial.speichern(st, "mem-1", AusgabeForm(itemId = "inv-7"), heute, jetzt)
        MemberStore.loeschen(st, "mem-1", DocumentChoice.KEEP, MaterialChoice.Transfer("mem-2"), jetzt)
        assertTrue(logs(st, "mem-2").any { it.startsWith("Material übernommen von Maximilian Müller (MG-001): 1 Gegenstand") })
    }
}
