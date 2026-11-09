package de.vereinsmanager.core.documents

import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.finance.Belege
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class DokumenteTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 9, 10, 0, 0, 0, ZoneOffset.UTC)
    private val pdf = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n".toByteArray()

    private fun ordner(id: String, name: String, parent: String? = null) = Ordner(id, name, parent, "", "#3b82f6", "")
    private fun dok(
        id: String, titel: String = id, ordner: String? = null, datum: String = "2026-01-01", typ: String = "application/pdf",
        name: String = "$id.pdf", groesse: Long = 10, tags: List<String> = emptyList(), notiz: String = "",
    ) = Dokument(id, titel, name, typ, groesse, null, "sonstiges", ordner, datum, tags, notiz, "", "", "", "", false, "")

    private val baum = listOf(ordner("a", "Alpha"), ordner("b", "Beta", "a"), ordner("c", "Gamma", "b"), ordner("z", "Zeta"))

    @Test
    fun unterordnerNachfahrenUndPfad() {
        assertEquals(listOf("a", "z"), Dokumente.unterordner(baum, null).map { it.id })
        assertEquals(listOf("b"), Dokumente.unterordner(baum, "a").map { it.id })
        assertEquals(setOf("a", "b", "c"), Dokumente.nachfahren(baum, "a"))
        assertEquals("Alpha › Beta › Gamma", Dokumente.pfadText(baum, "c"))
        assertEquals("", Dokumente.pfadText(baum, "gibtsnicht"))
        // Ordner mit unbekanntem Eltern-Ordner zählt als oberster
        assertTrue(Dokumente.unterordner(baum + ordner("w", "Waise", "weg"), null).any { it.id == "w" })
    }

    @Test
    fun anzahlIstRekursivUndDirektNicht() {
        val d = listOf(dok("1", ordner = "a"), dok("2", ordner = "c"), dok("3", ordner = "z"), dok("4"), dok("5", ordner = "weg"))
        assertEquals(2, Dokumente.anzahl(d, baum, "a"))
        assertEquals(1, Dokumente.anzahl(d, baum, "c"))
        assertEquals(listOf("1"), Dokumente.direkt(d, baum, "a").map { it.id })
        assertEquals(setOf("4", "5"), Dokumente.direkt(d, baum, null).map { it.id }.toSet())
    }

    @Test
    fun formatFilter() {
        val d = listOf(
            dok("pdf"), dok("bild", typ = "image/jpeg", name = "x.jpg"), dok("doc", typ = "", name = "Brief.DOCX"),
            dok("txt", typ = "text/plain", name = "a.txt"), dok("leer", typ = "", name = "ohne"),
        )
        fun ids(f: DateiFormat) = Dokumente.suchen(d, baum, null, DokFilter(format = f, sortierung = DokSortierung.TITEL)).map { it.id }
        assertEquals(listOf("pdf"), ids(DateiFormat.PDF))
        assertEquals(listOf("bild"), ids(DateiFormat.BILDER))
        assertEquals(listOf("doc"), ids(DateiFormat.OFFICE))
        assertEquals(listOf("txt"), ids(DateiFormat.TEXT))
        assertEquals(5, ids(DateiFormat.ALLE).size)
    }

    @Test
    fun jahrSucheUndSortierung() {
        val d = listOf(
            dok("1", titel = "Bravo", datum = "2025-05-01", groesse = 5),
            dok("2", titel = "alpha", datum = "2026-02-01", groesse = 50, tags = listOf("Versicherung")),
            dok("3", titel = "Charlie", datum = "2026-09-01", groesse = 20, notiz = "Hallenmiete"),
        )
        assertEquals(listOf("2026", "2025"), Dokumente.jahre(d))
        assertEquals(listOf("3", "2"), Dokumente.suchen(d, baum, null, DokFilter(jahr = "2026")).map { it.id })
        assertEquals(listOf("2"), Dokumente.suchen(d, baum, null, DokFilter(text = "versich")).map { it.id })
        assertEquals(listOf("3"), Dokumente.suchen(d, baum, null, DokFilter(text = "HALLEN")).map { it.id })
        assertEquals(listOf("2", "1", "3"), Dokumente.suchen(d, baum, null, DokFilter(sortierung = DokSortierung.TITEL)).map { it.id })
        assertEquals(listOf("1", "2", "3"), Dokumente.suchen(d, baum, null, DokFilter(sortierung = DokSortierung.DATUM_ALT)).map { it.id })
        assertEquals(listOf("2", "3", "1"), Dokumente.suchen(d, baum, null, DokFilter(sortierung = DokSortierung.GROESSE)).map { it.id })
        assertFalse(DokFilter(sortierung = DokSortierung.TITEL).aktiv)
        assertTrue(DokFilter(text = "x").aktiv)
    }

    @Test
    fun sucheBleibtImOrdnerBaum() {
        val d = listOf(dok("1", ordner = "c"), dok("2", ordner = "z"), dok("3", ordner = "b"))
        assertEquals(setOf("1", "3"), Dokumente.suchen(d, baum, "a", DokFilter()).map { it.id }.toSet())
    }

    private fun form(id: String = "doc-1", titel: String = "Mietvertrag") = DokumentForm(id, titel, "vertraege", "a", "2026-03-01", "Miete, Halle", "Notiz")

    @Test
    fun neuLegtDokumentUndDateiAn() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        val d = DokumentStore.neu(store, files, pdf, "Vertrag.pdf", "application/pdf", form(), jetzt)
        assertEquals("Mietvertrag", d.titel)
        assertEquals(pdf.size.toLong(), d.groesse)
        assertEquals(listOf("Miete", "Halle"), d.tags)
        assertNotNull(d.dateiId)
        assertTrue(files.size(d.dateiId!!) == pdf.size.toLong())
        assertEquals(1, Dokumente.dokumente(store).size)
        assertFalse(d.istBeleg)
    }

    @Test
    fun neuLehntSchlechtesAb() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        for ((f, b) in listOf(form(titel = " ") to pdf, form() to ByteArray(0), form().copy(datum = "kein Datum") to pdf, form().copy(kategorie = "x") to pdf)) {
            try { DokumentStore.neu(store, files, b, "a.pdf", "", f, jetzt); fail() } catch (e: DokumentException) { assertNotNull(e.message) }
        }
        try { DokumentStore.neu(store, files, ByteArray((DokumentStore.MAX_GROESSE + 1).toInt()), "a.bin", "", form(), jetzt); fail() } catch (e: DokumentException) { assertTrue(e.message!!.contains("zu groß")) }
        assertEquals(0, Dokumente.dokumente(store).size)
        assertTrue(files.ids().isEmpty())
    }

    @Test
    fun aendernBehaeltUnbekannteFelderUndDatei() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        val d = DokumentStore.neu(store, files, pdf, "V.pdf", "application/pdf", form(), jetzt)
        val roh = store.get("documents", "doc-1")!!
        store.put("documents", "doc-1", kotlinx.serialization.json.JsonObject(roh + ("desktopFeld" to JsonPrimitive("bleibt"))))
        val neu = DokumentStore.aendern(store, DokumentForm.von(d).copy(titel = "Neu", notiz = "", mitgliedId = "m1", mitgliedName = "Anna"), jetzt)
        assertEquals("Neu", neu.titel)
        assertEquals("", neu.notiz)
        assertEquals("Anna", neu.mitgliedName)
        assertEquals(d.dateiId, neu.dateiId)
        assertEquals("bleibt", (store.get("documents", "doc-1")!!["desktopFeld"] as JsonPrimitive).content)
        try { DokumentStore.aendern(store, form(id = "nix"), jetzt); fail() } catch (e: DokumentException) { }
    }

    @Test
    fun verschiebenSetztOrdnerUndKategorie() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        DokumentStore.neu(store, files, pdf, "V.pdf", "", form("d1"), jetzt)
        DokumentStore.neu(store, files, pdf + byteArrayOf(1), "W.pdf", "", form("d2"), jetzt)
        assertEquals(2, DokumentStore.verschieben(store, listOf("d1", "d2", "fehlt"), null, "protokolle", jetzt))
        val alle = Dokumente.dokumente(store)
        assertTrue(alle.all { it.ordnerId == null && it.kategorie == "protokolle" })
        DokumentStore.verschieben(store, listOf("d1"), "b", null, jetzt)
        assertEquals("b", Dokumente.dokumente(store).first { it.id == "d1" }.ordnerId)
    }

    @Test
    fun loeschenRaeumtDateiAufAberNichtWennGeteilt() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        val a = DokumentStore.neu(store, files, pdf, "A.pdf", "", form("d1"), jetzt)
        val b = DokumentStore.neu(store, files, pdf + byteArrayOf(2), "B.pdf", "", form("d2"), jetzt)
        // d3 teilt die Datei von d2
        store.put("documents", "d3", kotlinx.serialization.json.JsonObject(store.get("documents", "d2")!! + ("id" to JsonPrimitive("d3"))))
        val r = DokumentStore.loeschen(store, files, listOf("d1", "d2"), jetzt)
        assertEquals(2, r.geloescht)
        assertTrue(files.ids().none { it == a.dateiId })
        assertTrue(files.ids().any { it == b.dateiId })
    }

    @Test
    fun loeschenNimmtBelegVonDerBuchung() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        store.put("transactions", "tx-1", buildJsonObject {
            put("id", "tx-1"); put("date", "2026-03-01"); put("amount", -5.0); put("documentNumber", "BE-1"); put("partner", "X")
        })
        Belege.anhaengen(store, files, "tx-1", pdf, jetzt)
        val datei = Belege.dateiId(store.get("transactions", "tx-1"))!!
        val r = DokumentStore.loeschen(store, files, listOf(Belege.dokumentId("tx-1")), jetzt)
        assertEquals(1, r.geloescht)
        assertEquals(1, r.buchungenBetroffen)
        assertNull(store.get("transactions", "tx-1")!!["receipt"])
        assertNotNull(store.get("transactions", "tx-1"))
        assertFalse(files.ids().contains(datei))
    }

    @Test
    fun ordnerSpeichernPruefenUndKreise() {
        val store = InMemoryDocumentStore()
        val a = DokumentStore.ordnerSpeichern(store, OrdnerForm("a", "Alpha"), jetzt)
        DokumentStore.ordnerSpeichern(store, OrdnerForm("b", "Beta", parentId = "a"), jetzt)
        assertEquals("Alpha", a.name)
        for (f in listOf(OrdnerForm("x", " "), OrdnerForm("x", "X", parentId = "fehlt"), OrdnerForm("a", "Alpha", parentId = "b"), OrdnerForm("a", "Alpha", parentId = "a"))) {
            try { DokumentStore.ordnerSpeichern(store, f, jetzt); fail() } catch (e: DokumentException) { assertNotNull(e.message) }
        }
        val umbenannt = DokumentStore.ordnerSpeichern(store, OrdnerForm.von(a).copy(name = "Alpha 2"), jetzt)
        assertEquals("Alpha 2", umbenannt.name)
        assertEquals(2, Dokumente.ordner(store).size)
    }

    @Test
    fun ordnerLoeschenBehaeltDokumente() {
        val store = InMemoryDocumentStore(); val files = InMemoryFileStore()
        DokumentStore.ordnerSpeichern(store, OrdnerForm("a", "Alpha"), jetzt)
        DokumentStore.ordnerSpeichern(store, OrdnerForm("b", "Beta", parentId = "a"), jetzt)
        DokumentStore.ordnerSpeichern(store, OrdnerForm("z", "Zeta"), jetzt)
        DokumentStore.neu(store, files, pdf, "V.pdf", "", form("d1").copy(ordnerId = "b"), jetzt)
        assertEquals(1 to 1, DokumentStore.ordnerInhalt(store, "a"))
        DokumentStore.ordnerLoeschen(store, "a", jetzt)
        assertEquals(listOf("z"), Dokumente.ordner(store).map { it.id })
        val d = Dokumente.dokumente(store).single()
        assertNull(d.ordnerId)
    }

    @Test
    fun standardOrdnerSindVollstaendigUndIdempotent() {
        assertEquals(17, StandardOrdner.ALLE.size)
        val store = InMemoryDocumentStore()
        assertEquals(17, StandardOrdner.anlegenFehlende(store, jetzt))
        assertEquals(0, StandardOrdner.anlegenFehlende(store, jetzt))
        val alle = Dokumente.ordner(store)
        assertTrue(alle.all { it.parentId == null || alle.any { o -> o.id == it.parentId } })
    }

    @Test
    fun standardOrdnerNutztGleichnamigeVorhandene() {
        val store = InMemoryDocumentStore()
        val haupt = StandardOrdner.ALLE.first { it.parentId == null }
        DokumentStore.ordnerSpeichern(store, OrdnerForm("eigene-id", haupt.name), jetzt)
        val n = StandardOrdner.anlegenFehlende(store, jetzt)
        assertEquals(StandardOrdner.ALLE.size - 1, n)
        assertEquals(1, Dokumente.ordner(store).count { it.name == haupt.name })
        val alle = Dokumente.ordner(store)
        assertTrue(alle.all { it.parentId == null || alle.any { o -> o.id == it.parentId } })
    }
}
