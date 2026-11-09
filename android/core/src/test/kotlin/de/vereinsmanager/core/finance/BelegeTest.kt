package de.vereinsmanager.core.finance

import de.vereinsmanager.core.backup.BackupPaket
import de.vereinsmanager.core.backup.PaketImport
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.files.TestJpegs
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.zip.ZipInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BelegeTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)
    private val pdf = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n".toByteArray()

    private fun buchung(id: String = "tx-1", datum: String = "2026-03-01") = buildJsonObject {
        put("id", id); put("date", datum); put("amount", -42.5); put("type", "expense")
        put("documentNumber", "BE-2026-010"); put("bookingText", "Bälle"); put("partner", "Sportshop")
        put("sphere", "ideell"); put("category", "Sportgeräte"); put("extra", "bleibt")
    }

    private class Umgebung {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
    }

    private fun mitBuchung(vararg ids: String): Umgebung = Umgebung().also { u ->
        if (ids.isEmpty()) u.store.put("transactions", "tx-1", buchung()) else ids.forEach { u.store.put("transactions", it, buchung(it)) }
    }

    private fun str(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.content

    @Test
    fun pruefenErkenntDateitypAnDenBytes() {
        assertEquals("pdf", Belege.pruefen(pdf))
        assertEquals("jpg", Belege.pruefen(TestJpegs.farbe))
        for (schlecht in listOf(ByteArray(0), "nur Text".toByteArray(), byteArrayOf(0x50, 0x4B, 3, 4, 0, 0))) {
            try { Belege.pruefen(schlecht); fail() } catch (e: BelegException) { assertNotNull(e.message) }
        }
        try { Belege.pruefen(pdf + ByteArray((Belege.MAX_GROESSE).toInt())); fail() } catch (e: BelegException) { assertTrue(e.message!!.contains("zu groß")) }
    }

    @Test
    fun dateiNameFolgtDemSchemaDesPakets() {
        assertEquals("2026-03-01 Sportshop BE-2026-010.pdf", Belege.dateiName("2026-03-01", "Sportshop", "BE-2026-010", "pdf"))
        assertEquals("Beleg.jpg", Belege.dateiName("", " ", "", "jpg"))
        assertEquals("2026-03-01 A-B.pdf", Belege.dateiName("2026-03-01", "A/B", "", "pdf"))
    }

    @Test
    fun anhaengenLegtDateiBelegDokumentUndOrdnerAn() {
        val u = mitBuchung()
        val r = Belege.anhaengen(u.store, u.files, "tx-1", TestJpegs.farbe, jetzt)
        assertEquals("2026-03-01 Sportshop BE-2026-010.jpg", r.dateiName)
        assertEquals("Belege 2026", r.ordnerName)
        assertFalse(r.ersetzt)

        val b = u.store.get("transactions", "tx-1")!!
        val rec = b["receipt"] as JsonObject
        val fileId = str(rec, "fileId")!!
        assertEquals(TestJpegs.farbe.size.toLong(), u.files.size(fileId))
        assertEquals("image/jpeg", str(rec, "type"))
        assertEquals(TestJpegs.farbe.size.toString(), str(rec, "size"))
        assertEquals("bleibt", str(b, "extra"))
        assertEquals(TestJpegs.farbe.size.toLong(), Finance.buchungen(u.store).single().beleg!!.groesse)

        val d = u.store.get("documents", "doc-receipt-tx-1")!!
        assertEquals(fileId, str(d, "fileId"))
        assertEquals("belege", str(d, "category"))
        assertEquals("true", str(d, "isReceipt"))
        assertEquals("tx-1", str(d, "transactionId"))
        assertEquals("BE-2026-010", str(d, "transactionDocNumber"))
        assertEquals("Beleg: BE-2026-010 - Bälle", str(d, "title"))
        assertEquals("2026-03-01", str(d, "date"))
        assertNull(d["dataUrl"])

        val ordner = u.store.all("folders")
        assertEquals(listOf("Buchhaltungsbelege & Finanzen", "Belege 2026"), ordner.map { str(it, "name") })
        assertEquals(str(ordner[0], "id"), str(ordner[1], "parentId"))
        assertEquals(str(ordner[1], "id"), str(d, "folderId"))
        assertEquals(1, u.files.ids().size)
    }

    @Test
    fun ersetzenLoeschtDieAlteDateiUndBehaeltDenOrdner() {
        val u = mitBuchung()
        Belege.anhaengen(u.store, u.files, "tx-1", TestJpegs.farbe, jetzt)
        val erstes = str(u.store.get("documents", "doc-receipt-tx-1"), "createdAt")
        val r = Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt.plusDays(1))
        assertTrue(r.ersetzt)
        assertEquals("2026-03-01 Sportshop BE-2026-010.pdf", r.dateiName)
        assertEquals(1, u.files.ids().size)
        assertEquals(2, u.store.all("folders").size)
        assertEquals(1, u.store.all("documents").size)
        val d = u.store.get("documents", "doc-receipt-tx-1")!!
        assertEquals("application/pdf", str(d, "fileType"))
        assertEquals(erstes, str(d, "createdAt"))
        assertEquals(u.files.ids().single(), str(d, "fileId"))
    }

    @Test
    fun vorhandeneOrdnerDesDesktopsWerdenGenutzt() {
        val u = mitBuchung()
        u.store.put("folders", "folder-belege", buildJsonObject { put("id", "folder-belege"); put("name", "Buchhaltungsbelege & Finanzen") })
        u.store.put("folders", "folder-belege-2026", buildJsonObject { put("id", "folder-belege-2026"); put("name", "Belege 2026"); put("parentId", "folder-belege") })
        Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt)
        assertEquals(2, u.store.all("folders").size)
        assertEquals("folder-belege-2026", str(u.store.get("documents", "doc-receipt-tx-1"), "folderId"))
    }

    @Test
    fun hauptordnerMitAndererKennungWirdAmNamenGefunden() {
        val u = mitBuchung()
        u.store.put("folders", "zufall-17", buildJsonObject { put("id", "zufall-17"); put("name", "Buchhaltungsbelege & Finanzen") })
        Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt)
        val jahr = u.store.all("folders").single { str(it, "name") == "Belege 2026" }
        assertEquals("zufall-17", str(jahr, "parentId"))
        assertEquals(2, u.store.all("folders").size)
    }

    @Test
    fun jedesJahrBekommtSeinenOrdnerUndOhneDatumGehtEsInDenHauptordner() {
        val u = Umgebung()
        u.store.put("transactions", "a", buchung("a", "2025-12-31"))
        u.store.put("transactions", "b", buchung("b", "2026-01-02"))
        u.store.put("transactions", "c", buchung("c", ""))
        for (id in listOf("a", "b", "c")) Belege.anhaengen(u.store, u.files, id, pdf, jetzt)
        assertEquals(setOf("Buchhaltungsbelege & Finanzen", "Belege 2025", "Belege 2026"), u.store.all("folders").map { str(it, "name") }.toSet())
        val haupt = u.store.all("folders").single { str(it, "name") == "Buchhaltungsbelege & Finanzen" }
        assertEquals(str(haupt, "id"), str(u.store.get("documents", "doc-receipt-c"), "folderId"))
    }

    @Test
    fun unbekannteBuchungUndSchlechteDateiLassenAllesUnveraendert() {
        val u = mitBuchung()
        try { Belege.anhaengen(u.store, u.files, "gibt-es-nicht", pdf, jetzt); fail() } catch (e: BelegException) { assertTrue(e.message!!.contains("Buchung")) }
        try { Belege.anhaengen(u.store, u.files, "tx-1", "Text".toByteArray(), jetzt); fail() } catch (e: BelegException) { }
        assertTrue(u.files.ids().isEmpty())
        assertTrue(u.store.all("folders").isEmpty())
        assertTrue(u.store.all("documents").isEmpty())
        assertNull(u.store.get("transactions", "tx-1")!!["receipt"])
    }

    @Test
    fun entfernenNimmtBelegDokumentUndDateiWeg() {
        val u = mitBuchung()
        Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt)
        Belege.entfernen(u.store, u.files, "tx-1", jetzt)
        val b = u.store.get("transactions", "tx-1")!!
        assertNull(b["receipt"])
        assertEquals("bleibt", str(b, "extra"))
        assertEquals("Bälle", str(b, "bookingText"))
        assertTrue(u.store.all("documents").isEmpty())
        assertTrue(u.files.ids().isEmpty())
        Belege.entfernen(u.store, u.files, "tx-1", jetzt) // zweimal ist harmlos
    }

    @Test
    fun einGeteilteDateiBleibtErhalten() {
        val u = mitBuchung()
        Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt)
        val fileId = u.files.ids().single()
        u.store.put("documents", "d-andere", buildJsonObject { put("id", "d-andere"); put("fileId", fileId) })
        Belege.entfernen(u.store, u.files, "tx-1", jetzt)
        assertEquals(listOf(fileId), u.files.ids())
    }

    @Test
    fun buchungLoeschenRaeumtDenBelegMitAuf() {
        val u = mitBuchung("tx-1", "tx-2")
        Belege.anhaengen(u.store, u.files, "tx-1", pdf, jetzt)
        Belege.anhaengen(u.store, u.files, "tx-2", TestJpegs.grau, jetzt)
        Belege.buchungLoeschen(u.store, u.files, "tx-1")
        assertNull(u.store.get("transactions", "tx-1"))
        assertNull(u.store.get("documents", "doc-receipt-tx-1"))
        assertNotNull(u.store.get("documents", "doc-receipt-tx-2"))
        assertEquals(1, u.files.ids().size)
        Belege.buchungLoeschen(u.store, u.files, "gibt-es-nicht")
    }

    @Test
    fun belegLandetImPaketEinmalImJahresordnerUndKommtZurueck() {
        val u = mitBuchung()
        Belege.anhaengen(u.store, u.files, "tx-1", TestJpegs.farbe, jetzt)
        val out = ByteArrayOutputStream()
        val bericht = BackupPaket.schreiben(u.store, u.files, out)
        assertEquals(1, bericht.dateien)
        val namen = ArrayList<String>()
        ZipInputStream(ByteArrayInputStream(out.toByteArray())).use { z ->
            while (true) { val e = z.nextEntry ?: break; namen.add(e.name) }
        }
        assertEquals(
            listOf("sicherung.json", "dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-01 Sportshop BE-2026-010.jpg"),
            namen,
        )
        val store2 = InMemoryDocumentStore()
        val files2 = InMemoryFileStore()
        val r = PaketImport.paket(ByteArrayInputStream(out.toByteArray()), null, store2, files2, ImportMode.REPLACE)
        assertTrue(r.import.ok)
        assertEquals(1, files2.ids().size)
        val rec = store2.get("transactions", "tx-1")!!["receipt"] as JsonObject
        val doc = store2.get("documents", "doc-receipt-tx-1")!!
        assertEquals(str(rec, "fileId"), str(doc, "fileId"))
        assertEquals(TestJpegs.farbe.size.toLong(), files2.size(str(rec, "fileId")!!))
    }
}
