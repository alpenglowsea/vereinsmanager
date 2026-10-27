package de.vereinsmanager.core.backup

import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.files.readBytes
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.zip.ZipEntry

class BackupPaketTest {
    private val jetzt = ZonedDateTime.of(2026, 10, 27, 12, 0, 0, 0, ZoneOffset.UTC)

    private fun o(vararg kv: Pair<String, Any>): JsonObject = JsonObject(
        kv.associate { (k, v) -> k to (if (v is JsonElement) v else if (v is Number) JsonPrimitive(v) else JsonPrimitive(v.toString())) },
    )

    private fun pdf(s: String) = "%PDF-1.4 $s".toByteArray()
    private val jpg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte(), 1, 2, 3)
    private val png = byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 1, 2, 3)
    private val gross = ByteArray(300_000) { ((it * 7919) xor (it shr 3)).toByte() }

    private class Bestand(val store: InMemoryDocumentStore, val files: InMemoryFileStore)

    private fun bestand(): Bestand {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        files.putBytes("idA", pdf("Satzung"))
        files.putBytes("idB", pdf("Satzung zwei"))
        files.putBytes("idC", gross) // groß, ohne Endung im Namen
        files.putBytes("idD", pdf("im Kreis"))
        files.putBytes("idE", jpg)
        files.putBytes("idF", jpg + byteArrayOf(9))
        files.putBytes("idG", png)

        fun put(area: String, vararg docs: JsonObject) = docs.forEach { store.put(area, (it["id"] as JsonPrimitive).content, it) }
        put("accounts", o("id" to "a1", "name" to "Giro", "initialBalance" to 0))
        put(
            "folders",
            o("id" to "f1", "name" to "Buchhaltungsbelege & Finanzen"),
            o("id" to "f2", "name" to "Belege 2026", "parentId" to "f1"),
            o("id" to "f3", "name" to "Satzung / Ordnungen"),
            o("id" to "f4", "name" to "Zyklus A", "parentId" to "f5"),
            o("id" to "f5", "name" to "Zyklus B", "parentId" to "f4"),
        )
        put(
            "documents",
            o("id" to "d1", "title" to "Satzung", "fileName" to "Satzung.pdf", "fileType" to "application/pdf", "folderId" to "f3", "fileId" to "idA", "zukunft" to "bleibt"),
            o("id" to "d2", "title" to "Satzung", "fileName" to "Satzung.pdf", "fileType" to "application/pdf", "folderId" to "f3", "fileId" to "idB"),
            o("id" to "d3", "title" to "Protokoll", "fileName" to "Protokoll", "fileType" to "application/pdf", "fileId" to "idC"),
            o("id" to "d4", "title" to "Kreis", "fileName" to "kreis.pdf", "fileType" to "application/pdf", "folderId" to "f4", "fileId" to "idD"),
            o("id" to "d5", "title" to "Weg", "fileName" to "weg.pdf", "fileType" to "application/pdf", "fileId" to "gibtEsNicht"),
        )
        put(
            "transactions",
            o("id" to "t1", "date" to "2026-03-01", "partner" to "Sportshop Franke", "documentNumber" to "BE-2026-010", "amount" to -10,
                "receipt" to o("name" to "scan.pdf", "type" to "application/pdf", "size" to 5, "uploadedAt" to "x", "fileId" to "idA")),
            o("id" to "t2", "date" to "2026-03-02", "partner" to "Bäckerei Ö", "documentNumber" to "BE-2026-011", "amount" to -5,
                "receipt" to o("name" to "foto.jpg", "type" to "image/jpeg", "size" to 5, "uploadedAt" to "x", "fileId" to "idE")),
            o("id" to "t3", "date" to "2026-03-03", "amount" to -1),
        )
        put("members", o("id" to "m1", "memberNumber" to "M-0012", "lastName" to "Müller", "firstName" to "Jörg", "avatarFileId" to "idF"))
        put("inventory", o("id" to "i1", "name" to "Trikotsatz", "photoFileId" to "idG"))
        return Bestand(store, files)
    }

    private fun schreiben(b: Bestand, pw: String? = null): Pair<ByteArray, PaketBericht> {
        val out = ByteArrayOutputStream()
        val bericht = BackupPaket.schreiben(b.store, b.files, out, pw?.toCharArray(), jetzt)
        return out.toByteArray() to bericht
    }

    private fun namenImZip(zip: ByteArray): List<String> {
        val z = java.util.zip.ZipInputStream(ByteArrayInputStream(zip))
        val namen = mutableListOf<String>()
        var e: ZipEntry? = z.nextEntry
        while (e != null) { namen.add(e.name); e = z.nextEntry }
        return namen
    }

    private fun zaehler(): () -> String { var n = 0; return { "n${++n}" } }

    private fun str(o: JsonObject?, k: String) = (o?.get(k) as? JsonPrimitive)?.content

    @Test
    fun zipHatLesbareOrdnerUndSicherungJsonZuerst() {
        val (zip, bericht) = schreiben(bestand())
        assertTrue(BackupPaket.istPaket(zip))
        val namen = namenImZip(zip)
        assertEquals(
            listOf(
                "sicherung.json",
                "dokumente/Satzung - Ordnungen/Satzung.pdf",
                "dokumente/Satzung - Ordnungen/Satzung (2).pdf",
                "dokumente/(ohne Ordner)/Protokoll.pdf",
            ),
            namen.take(4),
        )
        assertTrue(namen.any { it.startsWith("dokumente/Zyklus") && it.endsWith("/kreis.pdf") || it == "dokumente/Zyklus B/Zyklus A/kreis.pdf" || it == "dokumente/Zyklus A/kreis.pdf" })
        assertTrue(namen.contains("dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/2026-03-02 Bäckerei Ö BE-2026-011.jpg"))
        assertTrue(namen.contains("mitglieder-fotos/M-0012 Müller Jörg.jpg"))
        assertTrue(namen.contains("inventar-fotos/Trikotsatz.png"))
        assertEquals(8, namen.size) // json + 7 Dateien; der gemeinsame Beleg (idA) steht nur einmal drin
        assertEquals(7, bericht.dateien)
        assertEquals(listOf("documents/d5"), bericht.fehlend)
    }

    @Test
    fun sicherungJsonNenntPfadeStattKennungen() {
        val (zip, _) = schreiben(bestand())
        val z = java.util.zip.ZipInputStream(ByteArrayInputStream(zip))
        z.nextEntry
        val datei = BackupFile.parse(String(z.readBytes(), Charsets.UTF_8))
        assertEquals("1.3.0", datei.version)
        val d1 = datei.list("documents")!!.first { str(it, "id") == "d1" }
        assertEquals("dokumente/Satzung - Ordnungen/Satzung.pdf", str(d1, "file"))
        assertNull(d1["fileId"])
        assertEquals("bleibt", str(d1, "zukunft"))
        val t1 = datei.list("transactions")!!.first { str(it, "id") == "t1" }
        assertEquals("dokumente/Satzung - Ordnungen/Satzung.pdf", str(t1["receipt"] as JsonObject, "file")) // gleiche Datei, gleicher Pfad
        assertEquals("scan.pdf", str(t1["receipt"] as JsonObject, "name"))
        val d5 = datei.list("documents")!!.first { str(it, "id") == "d5" }
        assertNull(d5["file"])
        assertNull(d5["fileId"])
        assertNull(datei.list("transactions")!!.first { str(it, "id") == "t3" }["receipt"])
    }

    @Test
    fun hinUndZurueckOhnePasswort() {
        val b = bestand()
        val (zip, _) = schreiben(b)
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        val r = PaketImport.paket(ByteArrayInputStream(zip), null, store, files, ImportMode.REPLACE, zaehler())
        assertTrue(r.import.ok)
        assertEquals(0, r.entfernteDateien)
        assertEquals(5, store.count("documents"))
        assertEquals(7, files.ids().size)
        val d1 = store.get("documents", "d1")!!
        val t1 = store.get("transactions", "t1")!!
        val id = str(d1, "fileId")!!
        assertEquals(id, str(t1["receipt"] as JsonObject, "fileId"))
        assertArrayEquals(pdf("Satzung"), files.readBytes(id))
        assertNull(d1["file"])
        assertEquals("bleibt", str(d1, "zukunft"))
        assertArrayEquals(gross, files.readBytes(str(store.get("documents", "d3"), "fileId")!!))
        assertArrayEquals(jpg + byteArrayOf(9), files.readBytes(str(store.get("members", "m1"), "avatarFileId")!!))
        assertArrayEquals(png, files.readBytes(str(store.get("inventory", "i1"), "photoFileId")!!))
        assertNull(store.get("documents", "d5")!!["fileId"]) // fehlende Datei: Verweis wurde schon beim Schreiben weggelassen
    }

    @Test
    fun mitPasswortIstDerInhaltUnlesbarUndEsGehtNurMitDemRichtigen() {
        val b = bestand()
        val (zip, _) = schreiben(b, "geheim-123")
        val text = String(zip, Charsets.ISO_8859_1)
        assertFalse("Klartext im Paket gefunden", text.contains("%PDF-1.4"))
        assertFalse("Klartext im Paket gefunden", text.contains("\"members\""))
        // Dateinamen bleiben lesbar (ZIP-Standard), der Inhalt nicht
        assertTrue(text.contains("sicherung.json"))
        assertTrue(text.contains("mitglieder-fotos/M-0012 M"))

        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        val r = PaketImport.paket(ByteArrayInputStream(zip), "geheim-123".toCharArray(), store, files, ImportMode.REPLACE, zaehler())
        assertTrue(r.import.ok)
        assertEquals(7, files.ids().size)
        assertArrayEquals(gross, files.readBytes(str(store.get("documents", "d3"), "fileId")!!))

        val leer = InMemoryFileStore()
        try {
            BackupPaket.lesen(ByteArrayInputStream(zip), "falsch-1234".toCharArray(), leer, zaehler())
            fail("Falsches Passwort hätte scheitern müssen")
        } catch (e: BackupPasswortException) {
            assertFalse(e.fehlt)
        }
        try {
            BackupPaket.lesen(ByteArrayInputStream(zip), null, leer, zaehler())
            fail("Fehlendes Passwort hätte auffallen müssen")
        } catch (e: BackupPasswortException) {
            assertTrue(e.fehlt)
        }
        assertTrue(leer.ids().isEmpty())
    }

    @Test
    fun veraenderteDatenFallenAufUndHinterlassenKeineDateien() {
        val (zip, _) = schreiben(bestand(), "geheim-123")
        val kaputt = zip.copyOf()
        val pos = (kaputt.size * 0.6).toInt() // mitten in den Daten der großen Datei
        kaputt[pos] = (kaputt[pos].toInt() xor 0x55).toByte()
        val files = InMemoryFileStore()
        try {
            BackupPaket.lesen(ByteArrayInputStream(kaputt), "geheim-123".toCharArray(), files, zaehler())
            fail("Veränderung nicht bemerkt")
        } catch (e: BackupPasswortException) {
            // erwartet: Prüfwert stimmt nicht
        } catch (e: BackupFormatException) {
            // ebenfalls in Ordnung
        }
        assertTrue(files.ids().isEmpty())
    }

    @Test
    fun abgeschnittenesPaketWirdAbgelehntUndRaeumtAuf() {
        val (zip, _) = schreiben(bestand())
        val files = InMemoryFileStore()
        try {
            BackupPaket.lesen(ByteArrayInputStream(zip.copyOf(zip.size / 2)), null, files, zaehler())
            fail("Abgeschnittenes Paket nicht bemerkt")
        } catch (e: BackupFormatException) {
            // erwartet
        } catch (e: java.io.IOException) {
            // je nach Schnittstelle auch möglich, Hauptsache kein halber Bestand
        }
        assertTrue(files.ids().isEmpty())
    }

    private fun zip(vararg eintraege: Pair<String, ByteArray>): ByteArray {
        val out = ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(out).use { z ->
            for ((n, d) in eintraege) { z.putNextEntry(ZipEntry(n)); z.write(d); z.closeEntry() }
        }
        return out.toByteArray()
    }

    @Test
    fun fremdeZipDateienUndMuellWerdenAbgelehnt() {
        val files = InMemoryFileStore()
        for (bytes in listOf(zip("x.txt" to byteArrayOf(1)), ByteArray(100) { 7 }, ByteArray(0))) {
            try {
                BackupPaket.lesen(ByteArrayInputStream(bytes), null, files, zaehler())
                fail("Hätte abgelehnt werden müssen")
            } catch (e: BackupFormatException) {
                // erwartet
            }
        }
        assertTrue(files.ids().isEmpty())
    }

    @Test
    fun nurDieInDerJsonGenanntenEintraegeWerdenGelesenKeinPfadWirdVerwendet() {
        val json = """{"app":"x","version":"1.3.0","exportedAt":"","data":{"documents":[
            {"id":"d1","file":"dokumente/a.pdf"},{"id":"d2","file":"dokumente/fehlt.pdf"}]}}"""
        val files = InMemoryFileStore()
        val store = InMemoryDocumentStore()
        val z = zip(
            "sicherung.json" to json.toByteArray(),
            "../evil.txt" to byteArrayOf(1),
            "dokumente/a.pdf" to pdf("a"),
            "dokumente/unbekannt.pdf" to byteArrayOf(2),
        )
        val r = PaketImport.paket(ByteArrayInputStream(z), null, store, files, ImportMode.REPLACE, zaehler())
        assertEquals(listOf("n1"), files.ids())
        assertEquals("n1", str(store.get("documents", "d1"), "fileId"))
        assertNull(store.get("documents", "d2")!!["fileId"])
        assertEquals(listOf("dokumente/fehlt.pdf"), r.fehlend)
    }

    @Test
    fun beimZusammenfuehrenGewinntDerBestandUndUeberzaehligeDateienGehenWeg() {
        val (zip, _) = schreiben(bestand())
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        files.putBytes("alt1", pdf("alt"))
        store.put("documents", "d2", o("id" to "d2", "title" to "vorhanden", "fileId" to "alt1"))
        val r = PaketImport.paket(ByteArrayInputStream(zip), null, store, files, ImportMode.MERGE, zaehler())
        assertTrue(r.import.ok)
        assertEquals("vorhanden", str(store.get("documents", "d2"), "title"))
        assertEquals("alt1", str(store.get("documents", "d2"), "fileId"))
        assertTrue(files.ids().contains("alt1"))
        // Die Datei des übersprungenen d2 (idB) wurde mit eingelesen, aber von keinem Eintrag benutzt: sie ist wieder weg.
        // Die Datei von d1 bleibt, weil auch die Buchung t1 sie benutzt.
        assertEquals(files.ids().toSet(), Dateiverwaltung.referenziert(store))
        assertEquals(1, r.entfernteDateien)
        assertEquals(7, files.ids().size) // 6 aus dem Paket (7 minus idB) plus alt1
    }

    private val alt = """{"app":"VereinsManager Lokal","version":"1.2.3","exportedAt":"","data":{
        "documents":[{"id":"d1","fileName":"a.pdf","dataUrl":"data:application/pdf;base64,SGFsbG8=","extra":"bleibt"},
                     {"id":"d2","fileName":"b.txt","dataUrl":"data:text/plain,hello"}],
        "transactions":[{"id":"t1","receipt":{"name":"a.pdf","type":"application/pdf","size":5,"dataUrl":"data:application/pdf;base64,SGFsbG8="}}],
        "members":[{"id":"m1","avatarUrl":"data:image/png;base64,iVBORw0KGgo="}],
        "settings":{"clubName":"X","clubLogoUrl":"data:image/png;base64,iVBORw0KGgo="}}}"""

    @Test
    fun alteSicherungWirdBeimEinspielenAusgelagertUndDoppeltesNurEinmalAbgelegt() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        val r = PaketImport.alt(BackupFile.parse(alt), store, files, ImportMode.REPLACE, zaehler())
        assertTrue(r.import.ok)
        val d1 = store.get("documents", "d1")!!
        assertNull(d1["dataUrl"])
        assertEquals("bleibt", str(d1, "extra"))
        val id = str(d1, "fileId")!!
        assertEquals(id, str(store.get("transactions", "t1")!!["receipt"] as JsonObject, "fileId"))
        assertArrayEquals("Hallo".toByteArray(), files.readBytes(id))
        assertNull((store.get("transactions", "t1")!!["receipt"] as JsonObject)["dataUrl"])
        assertNotNull(str(store.get("members", "m1"), "avatarFileId"))
        assertNull(store.get("members", "m1")!!["avatarUrl"])
        assertEquals(2, files.ids().size) // Hallo (einmal) + PNG
        // keine Base64-Data-URL: bleibt im Eintrag; das Logo in den Einstellungen ist keine auszulagernde Stelle
        assertEquals("data:text/plain,hello", str(store.get("documents", "d2"), "dataUrl"))
        assertEquals("data:image/png;base64,iVBORw0KGgo=", str(store.get("settings", "main"), "clubLogoUrl"))
    }

    @Test
    fun aufraeumenLoeschtNurDateienOhneEintrag() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        files.putBytes("a", byteArrayOf(1)); files.putBytes("b", byteArrayOf(2)); files.putBytes("c", byteArrayOf(3)); files.putBytes("d", byteArrayOf(4))
        store.put("documents", "d1", o("id" to "d1", "fileId" to "a"))
        store.put("transactions", "t1", o("id" to "t1", "receipt" to o("fileId" to "b")))
        store.put("members", "m1", o("id" to "m1", "avatarFileId" to "c"))
        assertEquals(setOf("a", "b", "c"), Dateiverwaltung.referenziert(store))
        assertEquals(listOf("d"), Dateiverwaltung.aufraeumen(store, files))
        assertEquals(listOf("a", "b", "c"), files.ids())
    }

    @Test
    fun dateitypenWerdenErkannt() {
        assertEquals("pdf", Dateityp.erkennen("%PDF-1.7".toByteArray()))
        assertEquals("jpg", Dateityp.erkennen(jpg))
        assertEquals("png", Dateityp.erkennen(png))
        assertEquals("webp", Dateityp.erkennen("RIFF....WEBPxxxx".toByteArray()))
        assertNull(Dateityp.erkennen(byteArrayOf(1, 2)))
        assertEquals("pdf", Dateityp.endungZu("application/pdf; charset=binary"))
        assertNull(Dateityp.endungZu("application/x-unbekannt"))
    }

    @Test
    fun verschluesselungDesPaketsLaesstSichVorabErkennen() {
        val (offen, _) = schreiben(bestand())
        val (zu, _) = schreiben(bestand(), "geheim-123")
        assertTrue(BackupPaket.istPaket(offen) && !BackupPaket.istVerschluesselt(offen))
        assertTrue(BackupPaket.istPaket(zu) && BackupPaket.istVerschluesselt(zu))
        assertFalse(BackupPaket.istVerschluesselt("{\"a\":1}".toByteArray()))
        assertFalse(BackupPaket.istVerschluesselt(byteArrayOf(0x50, 0x4B, 3, 4)))
    }

    @Test
    fun vorEinspielenLaeuftNachDemLesenUndEinFehlerLaesstDenBestandUnangetastet() {
        val (zip, _) = schreiben(bestand())
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        store.put("documents", "alt", o("id" to "alt"))
        var aufgerufen = 0
        try {
            PaketImport.paket(ByteArrayInputStream(zip), null, store, files, ImportMode.REPLACE, zaehler()) {
                aufgerufen++
                assertTrue(store.get("documents", "alt") != null) // noch nichts verändert
                throw IllegalStateException("Kopie ging schief")
            }
            fail("Fehler erwartet")
        } catch (e: IllegalStateException) {
            // erwartet
        }
        assertEquals(1, aufgerufen)
        assertEquals(listOf("alt"), store.ids("documents"))
        assertTrue(files.ids().isEmpty())

        // Falsches Passwort: der Hook wird gar nicht erst aufgerufen
        val (zu, _) = schreiben(bestand(), "geheim-123")
        try {
            PaketImport.paket(ByteArrayInputStream(zu), "nein-nein-1".toCharArray(), store, files, ImportMode.REPLACE, zaehler()) { aufgerufen++ }
            fail("Fehler erwartet")
        } catch (e: BackupPasswortException) {
            // erwartet
        }
        assertEquals(1, aufgerufen)
    }

    @Test
    fun einlagernMachtAusDateiverweisenWiederDataUrlsUndAuslagernFindetSieWieder() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        PaketImport.alt(BackupFile.parse(alt), store, files, ImportMode.REPLACE, zaehler())
        val export = BackupExporter.export(store, jetzt)
        // je Verweis gezählt, weil jede Data-URL den Inhalt noch einmal trägt: Hallo (5) am Dokument + Hallo (5) am Beleg + PNG-Kopf (8)
        assertEquals(18L, Einlagerung.gesamtgroesse(export.data, files))
        val zurueck = Einlagerung.einlagern(export.data, files)
        val d1 = (zurueck["documents"] as JsonArray).map { it as JsonObject }.first { str(it, "id") == "d1" }
        assertEquals("data:application/octet-stream;base64,SGFsbG8=", str(d1, "dataUrl"))
        assertNull(d1["fileId"])
        assertEquals("bleibt", str(d1, "extra"))
        val t1 = ((zurueck["transactions"] as JsonArray)[0] as JsonObject)["receipt"] as JsonObject
        assertEquals("data:application/pdf;base64,SGFsbG8=", str(t1, "dataUrl"))
        val m1 = (zurueck["members"] as JsonArray)[0] as JsonObject
        assertEquals("data:image/png;base64,iVBORw0KGgo=", str(m1, "avatarUrl"))
        assertNull(m1["avatarFileId"])
        // und wieder hinein: gleicher Bestand an Dateien
        val files2 = InMemoryFileStore()
        val noch = Auslagerung.auslagern(zurueck, files2, zaehler())
        assertEquals(2, noch.angelegt.size)
    }
}
