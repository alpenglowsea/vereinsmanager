package de.vereinsmanager.core.backup

import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.files.putBytes
import de.vereinsmanager.core.files.readBytes
import de.vereinsmanager.core.finance.Belege
import de.vereinsmanager.core.inventory.ArtikelForm
import de.vereinsmanager.core.inventory.Inventar
import de.vereinsmanager.core.store.DocumentStore
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.Base64

/**
 * Jahresarchiv am Handy (R4c). Die Prüfdateien in resources/jahresarchiv hat die Desktop-Fassung erzeugt
 * (src/services/jahresarchiv.ts aus dem Testverein): ein Teilbestand mit den Einträgen des Jahres 2024 und das
 * Archiv 2024 dazu. So ist geprüft, dass beide Fassungen dasselbe auswählen und die Archive der anderen lesen.
 */
class JahresarchivTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 22, 10, 0, 0, 0, ZoneOffset.UTC)
    private val heute = LocalDate.of(2026, 11, 22)

    private fun res(name: String) = javaClass.getResourceAsStream("/jahresarchiv/$name")!!.use { it.readBytes() }

    private class Bestand(val store: DocumentStore, val files: FileStore)

    /** Der Teilbestand des Desktops, eingespielt wie eine alte JSON-Sicherung (Dateien kommen in den Dateispeicher). */
    private fun desktopBestand(): Bestand {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        PaketImport.alt(BackupFile.parse(String(res("desktop-bestand.json"), Charsets.UTF_8)), store, files, ImportMode.REPLACE)
        return Bestand(store, files)
    }

    private val desktopZip by lazy { res("desktop-2024.zip") }

    private fun sha(b: ByteArray) = MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

    private fun JsonObject.t(k: String) = (this[k] as? JsonPrimitive)?.contentOrNull

    // ---------------------------------------------------------------- Auswahl

    @Test fun waehltDasselbeAusWieDerDesktop() {
        val b = desktopBestand()
        val kopf = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        val desktop = kopf.eintraege.map { Triple(it.art, it.bereich, it.id) }.toSet()
        val android = Jahresarchiv.plan(b.store, b.files, 2024).kandidaten.map { Triple(it.art, it.bereich, it.id) }.toSet()
        assertEquals(desktop, android)
        assertEquals(39, desktop.size)
    }

    @Test fun jahreErstAbDemVorvorjahr() {
        val b = desktopBestand()
        val jahre = Jahresarchiv.jahre(b.store, b.files, heute).associateBy { it.jahr }
        assertEquals(setOf(2025, 2024, 2023), jahre.keys)
        assertTrue(jahre[2024]!!.erlaubt)
        assertTrue(jahre[2023]!!.erlaubt)
        assertFalse(jahre[2025]!!.erlaubt)
        assertEquals(Jahresarchiv.GRUND_VORJAHR, jahre[2025]!!.grund)
        // Am Handy liegt ein Beleg an Buchung und Dokument nur einmal im Speicher: so viele Dateien wie im Desktop-Archiv
        val kopf = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        assertEquals(kopf.dateien.size, jahre[2024]!!.dateien)
        assertEquals(kopf.dateien.sumOf { it.groesse }, jahre[2024]!!.groesse)
        assertEquals(LocalDate.of(2026, 1, 1).year - 2, Jahresarchiv.juengstesJahr(LocalDate.of(2026, 1, 1)))
    }

    @Test fun fristenUndDateiname() {
        val b = desktopBestand()
        val p = Jahresarchiv.plan(b.store, b.files, 2024)
        assertEquals("2032-12-31", p.aufbewahrung.first { it.art == ArchivArt.BELEG }.bis)
        assertEquals("2034-12-31", p.aufbewahrung.first { it.art == ArchivArt.SPENDE }.bis)
        assertNull(p.aufbewahrung.first { it.art == ArchivArt.INVENTARFOTO }.bis)
        assertEquals("2034-12-31", Jahresarchiv.aufbewahrenBis(p.aufbewahrung))
        assertEquals("VereinsManager_Archiv_TSV_Testhausen_1921_e.V._2024.zip", Jahresarchiv.dateiname("TSV Testhausen 1921 e.V.", 2024))
    }

    // ---------------------------------------------------------------- Desktop-Archiv am Handy

    @Test fun desktopArchivPruefenAnwendenAnzeigenZurueckholen() {
        val b = desktopBestand()
        val vorher = Bestand(InMemoryDocumentStore().also { s -> listOf("transactions", "documents", "inventory").forEach { a -> b.store.all(a).forEach { s.put(a, it.t("id")!!, it) } } }, b.files)
        val originale = Jahresarchiv.plan(b.store, b.files, 2024).kandidaten.associate { "${it.bereich}|${it.id}" to it }
            .mapValues { (_, k) -> sha((k.quelle as Quelle.Datei).let { b.files.readBytes(it.id)!! }) }

        val (kopf, pruefung) = Jahresarchiv.pruefen(ByteArrayInputStream(desktopZip), null)
        assertTrue(pruefung.fehler.toString(), pruefung.ok)
        assertEquals(kopf.dateien.size, pruefung.geprueft)

        val dateienVorher = b.files.ids().size
        val r = Jahresarchiv.anwenden(b.store, b.files, kopf, jetzt)
        assertEquals(emptyList<String>(), r.uebersprungen)
        assertEquals(39, r.geaendert)
        assertTrue(Jahresarchiv.plan(b.store, b.files, 2024).kandidaten.isEmpty())
        assertEquals(2, Jahresarchiv.kandidaten(b.store, b.files).size) // die Belege 2023 und 2025 bleiben
        assertEquals(dateienVorher - kopf.dateien.size, b.files.ids().size) // Dateien wirklich weg
        assertEquals(39, Jahresarchiv.verweise(b.store, kopf.kennung))

        // Darstellung wie am Desktop: dataUrl leer, Vermerk daneben, keine Datei-Kennung
        val t = b.store.all("transactions").first { Jahresarchiv.vermerk("transactions", it) != null }
        val beleg = t["receipt"] as JsonObject
        assertEquals("", beleg.t("dataUrl"))
        assertNull(beleg["fileId"])
        val v = Jahresarchiv.vermerk("transactions", t)!!
        assertEquals(2024, v.jahr)
        assertEquals("desktop-test-2024", v.kennung)
        assertEquals("VereinsManager_Archiv_TSV_Testhausen_1921_e.V._2024.zip", v.datei)
        val foto = b.store.all("inventory").single()
        assertNull(foto["photoFileId"]); assertNull(foto["photoUrl"]); assertNotNull(foto["photoArchiv"])

        // Einzeln ansehen: genau die ursprüngliche Datei
        val out = ByteArrayOutputStream()
        Jahresarchiv.dateiLesen(ByteArrayInputStream(desktopZip), null, v, out)
        assertEquals(originale["transactions|${t.t("id")}"], sha(out.toByteArray()))

        // Sicherung danach: Vermerk reist mit (JSON und Paket), keine Dateien mehr
        val roh = BackupExporter.export(b.store, jetzt)
        val txs = (roh.data["transactions"] as kotlinx.serialization.json.JsonArray).map { it as JsonObject }
        assertTrue(txs.any { (it["receipt"] as? JsonObject)?.get("archiv") is JsonObject })
        val paket = ByteArrayOutputStream()
        BackupPaket.schreiben(b.store, b.files, paket, now = jetzt)
        val neu = Bestand(InMemoryDocumentStore(), InMemoryFileStore())
        PaketImport.paket(ByteArrayInputStream(paket.toByteArray()), null, neu.store, neu.files, ImportMode.REPLACE)
        assertEquals(39, Jahresarchiv.verweise(neu.store, kopf.kennung))

        // Zurückholen: alles wie vorher
        val (k2, z) = Jahresarchiv.zurueckholen(b.store, b.files, ByteArrayInputStream(desktopZip), null, jetzt)
        assertEquals(kopf.kennung, k2.kennung)
        assertEquals(emptyList<String>(), z.uebersprungen)
        assertEquals(39, z.geaendert)
        assertEquals(0, Jahresarchiv.verweise(b.store, kopf.kennung))
        val wieder = Jahresarchiv.plan(b.store, b.files, 2024).kandidaten
        assertEquals(39, wieder.size)
        for (k in wieder) assertEquals(k.bezeichnung, originale["${k.bereich}|${k.id}"], sha(b.files.readBytes((k.quelle as Quelle.Datei).id)!!))
        // Belege an Buchung und Dokument teilen sich wieder eine Datei
        assertEquals(dateienVorher, b.files.ids().size)
        // Übrige Felder unverändert
        for (a in listOf("transactions", "documents", "inventory")) for (alt in vorher.store.all(a)) {
            val jetzt = b.store.get(a, alt.t("id")!!)!!
            fun ohne(o: JsonObject): Map<String, JsonElement> = o.filterKeys { it !in setOf("updatedAt", "fileId", "photoFileId", "receipt") }
            assertEquals(ohne(alt), ohne(jetzt))
            (alt["receipt"] as? JsonObject)?.let { assertEquals(it.filterKeys { k -> k != "fileId" }, (jetzt["receipt"] as JsonObject).filterKeys { k -> k != "fileId" }) }
        }
    }

    @Test fun falschesArchivWirdAbgelehnt() {
        val b = desktopBestand()
        val kopf = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        Jahresarchiv.anwenden(b.store, b.files, kopf, jetzt)
        val v = Jahresarchiv.vermerk("transactions", b.store.all("transactions").first { Jahresarchiv.vermerk("transactions", it) != null })!!
        try {
            Jahresarchiv.dateiLesen(ByteArrayInputStream(desktopZip), null, v.copy(kennung = "anderes"), ByteArrayOutputStream())
            fail()
        } catch (e: ArchivFehler) {
            assertTrue(e.message!!, e.message!!.contains("nicht das passende Archiv"))
        }
        try {
            Jahresarchiv.dateiLesen(ByteArrayInputStream(desktopZip), null, v.copy(sha256 = "0".repeat(64)), ByteArrayOutputStream())
            fail()
        } catch (e: ArchivFehler) {
            assertTrue(e.message!!, e.message!!.contains("verändert"))
        }
        // Eine Sicherung ist kein Jahresarchiv
        val paket = ByteArrayOutputStream().also { BackupPaket.schreiben(b.store, b.files, it, now = jetzt) }.toByteArray()
        try {
            Jahresarchiv.kopfLesen(ByteArrayInputStream(paket), null)
            fail()
        } catch (e: ArchivFehler) {
            assertTrue(e.message!!.contains("kein Jahresarchiv"))
        }
    }

    @Test fun geaenderteDateiBleibtImBestand() {
        val b = desktopBestand()
        val kopf = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        val t = b.store.all("transactions").first { it.t("date")!!.startsWith("2024") && it["receipt"] is JsonObject }
        Belege.anhaengen(b.store, b.files, t.t("id")!!, TestPdf.klein, jetzt) // ersetzt Beleg (und Dokument)
        val r = Jahresarchiv.anwenden(b.store, b.files, kopf, jetzt)
        assertEquals(2, r.uebersprungen.count { it.contains("inzwischen geändert") }) // Buchung und Dokument
        assertNull(Jahresarchiv.vermerk("transactions", b.store.get("transactions", t.t("id")!!)))
        assertEquals(37, r.geaendert)
        // Zweites Anwenden: alles schon archiviert
        val r2 = Jahresarchiv.anwenden(b.store, b.files, kopf, jetzt)
        assertEquals(0, r2.geaendert)
        assertEquals(37, r2.uebersprungen.count { it.endsWith("schon archiviert.") })
    }

    // ---------------------------------------------------------------- Archiv vom Handy

    @Test fun handyArchivWieDesktop() {
        val b = desktopBestand()
        val out = ByteArrayOutputStream()
        val kopf = Jahresarchiv.erstellen(b.store, b.files, 2024, "TSV Testhausen 1921 e.V.", "handy-2024", out, now = jetzt)
        val desktop = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        // Gleiche Einträge, gleiche Dateien (Pfad und Prüfsumme) wie das Archiv des Desktops
        assertEquals(desktop.eintraege.map { it.copy(betrag = it.betrag?.stripTrailingZeros()) }.toSet(), kopf.eintraege.map { it.copy(betrag = it.betrag?.stripTrailingZeros()) }.toSet())
        assertEquals(desktop.dateien.map { it.pfad to it.sha256 }.toSet(), kopf.dateien.map { it.pfad to it.sha256 }.toSet())
        assertEquals(desktop.aufbewahrung, kopf.aufbewahrung)

        val zip = out.toByteArray()
        // archiv.json steht vorne, das Inhaltsverzeichnis gleich danach
        val namen = java.util.zip.ZipInputStream(ByteArrayInputStream(zip)).let { z -> generateSequence { z.nextEntry?.name }.toList() }
        assertEquals(listOf(Jahresarchiv.JSON_NAME, Jahresarchiv.CSV_NAME), namen.take(2))
        assertEquals(kopf.dateien.size + 2, namen.size)
        val (k2, p) = Jahresarchiv.pruefen(ByteArrayInputStream(zip), null)
        assertTrue(p.fehler.toString(), p.ok)
        assertEquals(kopf, k2)

        // Inhaltsverzeichnis gleich wie am Desktop
        val csvDesktop = java.util.zip.ZipInputStream(ByteArrayInputStream(desktopZip)).let { z ->
            while (z.nextEntry!!.name != Jahresarchiv.CSV_NAME) { /* weiter */ }
            z.readBytes().toString(Charsets.UTF_8)
        }
        val csv = Jahresarchiv.inhaltsverzeichnis(kopf)
        assertTrue(csv.startsWith("\uFEFFArt;Datum;Belegnummer;Betrag (EUR);Bezeichnung;Datei im Archiv;SHA-256\r\n"))
        assertEquals(csvDesktop.split("\r\n").toSet(), csv.split("\r\n").toSet())

        // Am Bestand ändert erstellen nichts
        assertEquals(39, Jahresarchiv.plan(b.store, b.files, 2024).kandidaten.size)
    }

    @Test fun mitPasswort() {
        val b = desktopBestand()
        val out = ByteArrayOutputStream()
        Jahresarchiv.erstellen(b.store, b.files, 2024, "TSV", "pw-2024", out, "geheim1234".toCharArray(), jetzt)
        val zip = out.toByteArray()
        try { Jahresarchiv.kopfLesen(ByteArrayInputStream(zip), null); fail() } catch (e: BackupPasswortException) { assertTrue(e.fehlt) }
        try { Jahresarchiv.kopfLesen(ByteArrayInputStream(zip), "falsch12345".toCharArray()); fail() } catch (e: BackupPasswortException) { assertFalse(e.fehlt) }
        val (k, p) = Jahresarchiv.pruefen(ByteArrayInputStream(zip), "geheim1234".toCharArray())
        assertTrue(p.ok)
        Jahresarchiv.anwenden(b.store, b.files, k, jetzt)
        val (_, z) = Jahresarchiv.zurueckholen(b.store, b.files, ByteArrayInputStream(zip), "geheim1234".toCharArray(), jetzt)
        assertEquals(39, z.geaendert)
    }

    @Test fun ohneDateienKeinArchiv() {
        val b = desktopBestand()
        try {
            Jahresarchiv.erstellen(b.store, b.files, 2022, "TSV", "x", ByteArrayOutputStream(), now = jetzt)
            fail()
        } catch (e: ArchivFehler) {
            assertTrue(e.message!!.contains("keine Dateien"))
        }
    }

    // ---------------------------------------------------------------- Fotos und Vermerke

    @Test fun amHandyAufgenommenesFotoInsArchivUndZurueck() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        val url = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(TestPdf.jpeg)
        store.put(
            "inventory", "inv-1",
            JsonObject(
                mapOf(
                    "id" to JsonPrimitive("inv-1"), "name" to JsonPrimitive("Alte Matte"), "itemNumber" to JsonPrimitive("INV-001"),
                    "condition" to JsonPrimitive("discarded"), "retiredAt" to JsonPrimitive("2023-05-02"), "photoUrl" to JsonPrimitive(url),
                    "updatedAt" to JsonPrimitive("2025-01-01T00:00:00.000Z"),
                ),
            ),
        )
        val p = Jahresarchiv.plan(store, files, 2023)
        assertEquals(1, p.kandidaten.size)
        assertEquals("image/jpeg", p.kandidaten.single().typ)
        val out = ByteArrayOutputStream()
        val kopf = Jahresarchiv.erstellen(store, files, 2023, "TSV", "f-2023", out, now = jetzt)
        assertEquals("inventar-fotos/Alte Matte.jpg", kopf.dateien.single().pfad)
        Jahresarchiv.anwenden(store, files, kopf, jetzt)
        assertNull(store.get("inventory", "inv-1")!!["photoUrl"])
        val (_, z) = Jahresarchiv.zurueckholen(store, files, ByteArrayInputStream(out.toByteArray()), null, jetzt)
        assertEquals(1, z.geaendert)
        val a = store.get("inventory", "inv-1")!!
        assertEquals(sha(TestPdf.jpeg), sha(files.readBytes(a.t("photoFileId")!!)!!))
        assertNull(a["photoArchiv"])
    }

    @Test fun neueDateiHebtVermerkAuf() {
        val b = desktopBestand()
        val kopf = Jahresarchiv.kopfLesen(ByteArrayInputStream(desktopZip), null)
        Jahresarchiv.anwenden(b.store, b.files, kopf, jetzt)

        // Beleg ersetzen: Buchung und Beleg-Dokument ohne Vermerk
        val t = b.store.all("transactions").first { Jahresarchiv.vermerk("transactions", it) != null }
        val id = t.t("id")!!
        Belege.anhaengen(b.store, b.files, id, TestPdf.klein, jetzt)
        assertNull(Jahresarchiv.vermerk("transactions", b.store.get("transactions", id)))
        assertNull(Jahresarchiv.vermerk("documents", b.store.get("documents", Belege.dokumentId(id))))
        assertNotNull(Belege.dateiId(b.store.get("transactions", id)))

        // Gegenstand ohne neues Foto speichern: Vermerk bleibt; mit neuem Foto: Vermerk weg
        val a = de.vereinsmanager.core.inventory.Artikel.from(b.store.all("inventory").single())
        assertNotNull(a.fotoArchiv)
        Inventar.speichern(b.store, ArtikelForm.von(a).copy(notizen = "geändert"), jetzt)
        assertNotNull(b.store.get("inventory", a.id)!!["photoArchiv"])
        val neu = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(TestPdf.jpeg)
        Inventar.speichern(b.store, ArtikelForm.von(a).copy(foto = neu), jetzt)
        val g = b.store.get("inventory", a.id)!!
        assertNull(g["photoArchiv"])
        assertEquals(neu, g.t("photoUrl"))
    }

    @Test fun fotoAusSicherungBleibtBeimSpeichernUndLaesstSichErsetzen() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        files.putBytes("f-foto", TestPdf.jpeg)
        store.put(
            "inventory", "inv-2",
            JsonObject(mapOf("id" to JsonPrimitive("inv-2"), "name" to JsonPrimitive("Ball"), "itemNumber" to JsonPrimitive("INV-002"), "photoFileId" to JsonPrimitive("f-foto"))),
        )
        val a = de.vereinsmanager.core.inventory.Artikel.from(store.get("inventory", "inv-2")!!)
        assertEquals("f-foto", a.fotoDatei)
        assertEquals("", a.foto)
        // unverändert speichern: Datei bleibt
        Inventar.speichern(store, ArtikelForm.von(a), jetzt)
        assertEquals("f-foto", store.get("inventory", "inv-2")!!.t("photoFileId"))
        // neues Foto: alte Datei-Kennung weg (sonst überschriebe sie beim Ausgeben das neue Foto)
        val neu = "data:image/jpeg;base64,AAAA"
        Inventar.speichern(store, ArtikelForm.von(a).copy(foto = neu), jetzt)
        assertNull(store.get("inventory", "inv-2")!!["photoFileId"])
        // Foto entfernt (Formular ohne Foto und ohne Datei)
        val b2 = de.vereinsmanager.core.inventory.Artikel.from(store.get("inventory", "inv-2")!!)
        Inventar.speichern(store, ArtikelForm.von(b2).copy(foto = "", fotoDatei = ""), jetzt)
        val g = store.get("inventory", "inv-2")!!
        assertNull(g["photoUrl"]); assertNull(g["photoFileId"])
    }

    @Test fun vermerkLesenUndSchreiben() {
        val v = ArchivVermerk(2024, "k", "a.zip", "p/x.pdf", "ab".repeat(32), 12, "application/pdf", "2026-11-22T10:00:00.000Z")
        assertEquals(v, ArchivVermerk.aus(v.json()))
        assertNull(ArchivVermerk.aus(JsonObject(mapOf("jahr" to JsonPrimitive(2024)))))
        assertNull(ArchivVermerk.aus(null))
        assertEquals("Im Jahresarchiv 2024 (a.zip)", v.text)
    }
}

/** Kleine Testdateien (gültige Köpfe, damit der Dateityp erkannt wird). */
internal object TestPdf {
    val klein: ByteArray = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n".toByteArray(Charsets.US_ASCII)
    val jpeg: ByteArray = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte(), 0, 16, 'J'.code.toByte(), 'F'.code.toByte(), 'I'.code.toByte(), 'F'.code.toByte(), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF.toByte(), 0xD9.toByte())
}
