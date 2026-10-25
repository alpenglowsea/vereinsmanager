package de.vereinsmanager.core.backup

import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImporterTest {
    private fun demo(): BackupFile {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return BackupFile.parse(text)
    }

    private fun file(json: String) = BackupFile.parse(json)
    private fun doc(json: String) = Json.parseToJsonElement(json).jsonObject

    @Test fun neunzehnBereiche() {
        assertEquals(19, BackupAreas.ALL.size)
        assertEquals(15, BackupAreas.LISTS.size)
        assertEquals(4, BackupAreas.SINGLES.size)
        assertEquals(
            setOf(
                "members", "transactions", "accounts", "auditLogs", "inventory", "memberInventory", "sepaRuns",
                "documents", "folders", "donations", "contacts", "invoices", "meetings", "calendarEvents",
                "calendarCategories", "invoiceTemplate", "meetingTemplate", "dashboardConfig", "settings",
            ),
            BackupAreas.ALL.toSet(),
        )
    }

    @Test fun demoErsetzenInLeerenSpeicher() {
        val store = InMemoryDocumentStore()
        val r = BackupImporter.import(demo(), store, ImportMode.REPLACE)
        assertTrue(r.failed.toString(), r.ok)
        assertEquals(9, store.count("members"))
        assertEquals(10, store.count("transactions"))
        assertEquals(15, store.count("inventory"))
        assertEquals(4, store.count("invoices"))
        assertNotNull(store.get("settings", "main"))
        assertNotNull(store.get("invoiceTemplate", "main_template"))
        assertNotNull(store.get("dashboardConfig", "main_dashboard"))
        // Die Sitzungsvorlage liegt unter ihrer richtigen Kennung (anders als in der Desktop-Importroutine).
        assertNotNull(store.get("meetingTemplate", "main_meeting_template"))
        assertNull(store.get("meetingTemplate", "main_template"))
    }

    @Test fun ersetzenLeertDenBereich() {
        val store = InMemoryDocumentStore()
        store.put("members", "alt", doc("""{"id":"alt"}"""))
        BackupImporter.import(demo(), store, ImportMode.REPLACE)
        assertNull(store.get("members", "alt"))
        assertEquals(9, store.count("members"))
    }

    @Test fun fehlenderBereichBleibtUnveraendert() {
        val store = InMemoryDocumentStore()
        store.put("contacts", "c1", doc("""{"id":"c1"}"""))
        BackupImporter.import(file("""{"data":{"members":[{"id":"m1"}]}}"""), store, ImportMode.REPLACE)
        assertEquals(1, store.count("contacts"))
        assertEquals(1, store.count("members"))
    }

    @Test fun ausdruecklichLeereListeLeertDenBereich() {
        val store = InMemoryDocumentStore()
        store.put("contacts", "c1", doc("""{"id":"c1"}"""))
        BackupImporter.import(file("""{"data":{"contacts":[]}}"""), store, ImportMode.REPLACE)
        assertEquals(0, store.count("contacts"))
    }

    @Test fun nullBereichBleibtUnveraendert() {
        val store = InMemoryDocumentStore()
        store.put("contacts", "c1", doc("""{"id":"c1"}"""))
        BackupImporter.import(file("""{"data":{"members":[{"id":"m1"}],"contacts":null}}"""), store, ImportMode.REPLACE)
        assertEquals(1, store.count("contacts"))
    }

    @Test fun eintragOhneIdScheitertNurDiesenBereichUndAendertNichts() {
        val store = InMemoryDocumentStore()
        store.put("members", "alt", doc("""{"id":"alt"}"""))
        val r = BackupImporter.import(
            file("""{"data":{"members":[{"firstName":"ohne id"}],"contacts":[{"id":"c1"}]}}"""), store, ImportMode.REPLACE,
        )
        assertFalse(r.ok)
        assertEquals(1, r.failed.size)
        assertTrue(r.failed[0].startsWith("members"))
        assertNotNull(store.get("members", "alt")) // unverändert
        assertEquals(1, store.count("contacts"))   // die übrigen Bereiche wurden eingespielt
    }

    @Test fun doppelteKennungenErgebenEinenEintrag() {
        val store = InMemoryDocumentStore()
        val r = BackupImporter.import(
            file("""{"data":{"members":[{"id":"a","n":1},{"id":"a","n":2}]}}"""), store, ImportMode.REPLACE,
        )
        assertTrue(r.ok)
        assertEquals(1, store.count("members"))
    }

    @Test fun ergaenzenLaesstVorhandenesUnangetastet() {
        val store = InMemoryDocumentStore()
        store.put("members", "m1", doc("""{"id":"m1","name":"hier vorhanden"}"""))
        BackupImporter.import(
            file("""{"data":{"members":[{"id":"m1","name":"aus der Datei"},{"id":"m2","name":"neu"}]}}"""),
            store, ImportMode.MERGE,
        )
        assertEquals(2, store.count("members"))
        assertEquals(JsonPrimitive("hier vorhanden"), store.get("members", "m1")!!["name"])
        assertEquals(JsonPrimitive("neu"), store.get("members", "m2")!!["name"])
    }

    @Test fun ergaenzenMitLeererListeTutNichts() {
        val store = InMemoryDocumentStore()
        store.put("members", "m1", doc("""{"id":"m1"}"""))
        BackupImporter.import(file("""{"data":{"members":[]}}"""), store, ImportMode.MERGE)
        assertEquals(1, store.count("members"))
    }

    @Test fun ergaenzenBehaeltVorhandenesEinzelstueck() {
        val store = InMemoryDocumentStore()
        store.put("dashboardConfig", "main_dashboard", doc("""{"id":"main_dashboard","widgets":["a"]}"""))
        BackupImporter.import(file("""{"data":{"dashboardConfig":{"widgets":["b"]}}}"""), store, ImportMode.MERGE)
        assertEquals("""{"id":"main_dashboard","widgets":["a"]}""", store.get("dashboardConfig", "main_dashboard").toString())
    }

    @Test fun einzelstueckBekommtIdErgaenztUndEineVorhandeneHatVorrang() {
        val store = InMemoryDocumentStore()
        BackupImporter.import(file("""{"data":{"dashboardConfig":{"widgets":[]}}}"""), store, ImportMode.REPLACE)
        assertEquals(JsonPrimitive("main_dashboard"), store.get("dashboardConfig", "main_dashboard")!!["id"])
    }

    // --- Stammdaten ---
    @Test fun veralteteFelderWerdenVerworfen() {
        val store = InMemoryDocumentStore()
        BackupImporter.import(
            file("""{"data":{"settings":{"clubName":"SV Echt","smtpPassword":"geheim","geminiApiKey":"x"}}}"""),
            store, ImportMode.REPLACE,
        )
        val s = store.get("settings", "main")!!
        assertEquals(JsonPrimitive("SV Echt"), s["clubName"])
        assertFalse(s.containsKey("smtpPassword"))
        assertFalse(s.containsKey("geminiApiKey"))
        assertEquals(JsonPrimitive("main"), s["id"])
    }

    @Test fun ergaenzenErsetztMustertexteAberKeineEigenenAngaben() {
        val store = InMemoryDocumentStore()
        val platzhalter = BackupMerge.STAMMDATEN_PLATZHALTER
        // Frisches Gerät: Mustertexte, dazu eine selbst eingetragene Steuernummer.
        val vorhanden = JsonObject(platzhalter + mapOf("id" to JsonPrimitive("main"), "taxNumber" to JsonPrimitive("333")))
        store.put("settings", "main", vorhanden)
        BackupImporter.import(
            file("""{"data":{"settings":{"clubName":"SV Echt","taxNumber":"222","associationNumber":"VR 99","smtpPassword":"x"}}}"""),
            store, ImportMode.MERGE,
        )
        val s = store.get("settings", "main")!!
        assertEquals(JsonPrimitive("SV Echt"), s["clubName"])          // Mustertext ersetzt
        assertEquals(JsonPrimitive("VR 99"), s["associationNumber"])   // Mustertext ersetzt
        assertEquals(JsonPrimitive("333"), s["taxNumber"])             // eigener Wert bleibt
        assertFalse(s.containsKey("smtpPassword"))
    }

    @Test fun mustervorstandVerschwindetWennDateiKeinenHat() {
        val store = InMemoryDocumentStore()
        store.put("settings", "main", JsonObject(BackupMerge.STAMMDATEN_PLATZHALTER + mapOf("id" to JsonPrimitive("main"))))
        BackupImporter.import(file("""{"data":{"settings":{"clubName":"SV Echt","chairman":"Erika Echt"}}}"""), store, ImportMode.MERGE)
        assertFalse(store.get("settings", "main")!!.containsKey("boardMembers"))
    }

    @Test fun platzhalterStammenAusDerDesktopFassung() {
        assertEquals(17, BackupMerge.STAMMDATEN_PLATZHALTER.size)
        assertEquals(JsonPrimitive("TSV Musterstadt 1890 e.V."), BackupMerge.STAMMDATEN_PLATZHALTER["clubName"])
    }

    // --- Ausgabe ---
    @Test fun exportGibtDieListenUnveraendertZurueck() {
        val original = demo()
        val store = InMemoryDocumentStore()
        BackupImporter.import(original, store, ImportMode.REPLACE)
        val out = BackupExporter.export(store)
        for (area in BackupAreas.LISTS) {
            assertEquals(area, original.list(area) ?: emptyList<JsonObject>(), out.list(area))
        }
        assertEquals("1.2.3", out.version)
        assertEquals(original.single("settings")!!["clubName"], out.single("settings")!!["clubName"])
        assertEquals(JsonPrimitive("main_meeting_template"), out.single("meetingTemplate")!!["id"])
        assertTrue(out.exportedAt!!.matches(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")))
    }

    @Test fun ausgabeEnthaeltDieEntfallenenBereicheNicht() {
        val store = InMemoryDocumentStore()
        BackupImporter.import(demo(), store, ImportMode.REPLACE)
        val text = BackupExporter.export(store).toJsonText()
        assertFalse(text.contains("onlineApplications"))
        assertFalse(text.contains("applicationSettings"))
    }

    @Test fun ausgabeKannWiederEingespieltWerden() {
        val s1 = InMemoryDocumentStore()
        BackupImporter.import(demo(), s1, ImportMode.REPLACE)
        val text = BackupExporter.export(s1).toJsonText()
        val s2 = InMemoryDocumentStore()
        BackupImporter.import(BackupFile.parse(text), s2, ImportMode.REPLACE)
        for (area in BackupAreas.LISTS) assertEquals(area, s1.all(area), s2.all(area))
        assertEquals(s1.get("settings", "main"), s2.get("settings", "main"))
    }

    @Test fun fehlschlagRollbackImSpeicher() {
        val store = InMemoryDocumentStore()
        store.put("members", "a", doc("""{"id":"a"}"""))
        try {
            store.transaction { store.clear("members"); error("Absicht") }
        } catch (_: IllegalStateException) {}
        assertEquals(1, store.count("members"))
    }
}
