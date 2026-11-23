package de.vereinsmanager.core.members

import de.vereinsmanager.core.documents.Dokument
import de.vereinsmanager.core.documents.DokumentForm
import de.vereinsmanager.core.documents.DokumentStore
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

/** Gleiche Fälle wie src/utils/unterlagen.test.ts (Desktop). */
class UnterlagenTest {
    private val heute = LocalDate.of(2026, 11, 23)
    private val jetzt = ZonedDateTime.of(2026, 11, 23, 10, 0, 0, 0, ZoneOffset.UTC)

    private fun obj(vararg p: Pair<String, Any?>): JsonObject = JsonObject(
        p.filter { it.second != null }.associate { (k, v) ->
            k to when (v) {
                is JsonElement -> v
                is Boolean -> JsonPrimitive(v)
                else -> JsonPrimitive(v.toString())
            }
        },
    )

    private fun mitglied(id: String, vorname: String, status: String = "active", fz: Fuehrungszeugnis? = null) =
        obj("id" to id, "firstName" to vorname, "lastName" to "Test", "status" to status, "policeCertificate" to fz?.json())

    private fun dok(id: String, memberId: String?, art: String? = null, bis: String? = null) =
        obj("id" to id, "title" to id, "memberId" to memberId, "date" to "2026-01-01", "memberDocType" to art, "validUntil" to bis)

    @Test fun datenUndFristen() {
        assertTrue(Unterlagen.istDatum("2024-02-29"))
        assertFalse(Unterlagen.istDatum("2025-02-29"))
        assertFalse(Unterlagen.istDatum("2026-13-01"))
        assertFalse(Unterlagen.istDatum("26-01-01"))
        assertFalse(Unterlagen.istDatum(null))
        assertEquals("2029-02-28", Unterlagen.faellig(Fuehrungszeugnis("", "2024-02-29", false)))
        assertEquals("2027-01-03", Unterlagen.faellig(Fuehrungszeugnis("2022-01-10", "2022-01-03", false)))
        assertNull(Unterlagen.faellig(null))
        assertNull(Unterlagen.faellig(Fuehrungszeugnis("", "x", false)))
        assertEquals(Unterlagen.Ablauf.OHNE, Unterlagen.ablauf(null, heute))
        assertEquals(Unterlagen.Ablauf.OHNE, Unterlagen.ablauf("", heute))
        assertEquals(Unterlagen.Ablauf.ABGELAUFEN, Unterlagen.ablauf("2026-11-22", heute))
        assertEquals(Unterlagen.Ablauf.BALD, Unterlagen.ablauf("2026-11-23", heute))
        assertEquals(Unterlagen.Ablauf.BALD, Unterlagen.ablauf("2027-02-21", heute))
        assertEquals(Unterlagen.Ablauf.GUELTIG, Unterlagen.ablauf("2027-02-22", heute))
    }

    @Test fun pruefungen() {
        assertNull(Unterlagen.pruefeUnterlage("trainerlizenz", "C-Lizenz", "2024-03-01", "2027-03-01"))
        assertEquals("Bitte eine Art wählen.", Unterlagen.pruefeUnterlage("xyz", "C-Lizenz", "2024-03-01", "2027-03-01"))
        assertEquals("Bitte eine Bezeichnung eingeben.", Unterlagen.pruefeUnterlage("trainerlizenz", "  ", "2024-03-01", "2027-03-01"))
        assertEquals("„Gültig bis“ liegt vor „Ausgestellt am“.", Unterlagen.pruefeUnterlage("trainerlizenz", "C", "2024-03-01", "2023-01-01"))
        assertEquals("„Ausgestellt am“ ist kein gültiges Datum.", Unterlagen.pruefeUnterlage("trainerlizenz", "C", "2024-02-30", "2027-03-01"))
        assertNull(Unterlagen.pruefeUnterlage("trainerlizenz", "C", "", ""))

        val ok = Fuehrungszeugnis("2026-11-01", "2026-10-20", false)
        assertNull(Unterlagen.pruefeFuehrungszeugnis(ok, heute))
        assertEquals("Bitte das Datum des Führungszeugnisses eingeben.", Unterlagen.pruefeFuehrungszeugnis(ok.copy(datum = ""), heute))
        assertEquals("Die Einsichtnahme liegt vor dem Datum des Führungszeugnisses.", Unterlagen.pruefeFuehrungszeugnis(ok.copy(eingesehenAm = "2026-10-01"), heute))
        assertEquals("Die Einsichtnahme liegt in der Zukunft.", Unterlagen.pruefeFuehrungszeugnis(ok.copy(eingesehenAm = "2026-12-01"), heute))
        assertEquals("Das Datum des Führungszeugnisses liegt in der Zukunft.", Unterlagen.pruefeFuehrungszeugnis(ok.copy(datum = "2026-12-01", eingesehenAm = "2026-12-02"), heute))
    }

    @Test fun erinnerungenWieAmDesktop() {
        val members = listOf(
            mitglied("m1", "Anna"),
            mitglied("m2", "Bernd", fz = Fuehrungszeugnis("2021-12-10", "2021-12-01", false)),
            mitglied("m3", "Clara", "terminated", Fuehrungszeugnis("2020-01-10", "2020-01-01", false)),
            mitglied("m4", "Dora", "passive", Fuehrungszeugnis("2025-01-10", "2025-01-01", false)),
        )
        val docs = listOf(
            dok("lizenz-abgelaufen", "m1", "trainerlizenz", "2026-10-31"),
            dok("erste-hilfe-bald", "m1", "erste_hilfe", "2027-01-15"),
            dok("weit-weg", "m1", "schiedsrichter", "2028-01-01"),
            dok("ohne-datum", "m1", "einverstaendnis"),
            dok("ausgetreten", "m3", "trainerlizenz", "2026-01-01"),
            dok("ohne-mitglied", null, null, "2026-01-01"),
            dok("alt-ohne-art", "m4", null, "2026-12-24"),
        )
        val e = Unterlagen.erinnerungen(members, docs, heute)
        assertEquals(
            listOf(
                listOf("m1", "unterlage", "2026-10-31", true, "lizenz-abgelaufen"),
                listOf("m2", "fuehrungszeugnis", "2026-12-01", false, ""),
                listOf("m4", "unterlage", "2026-12-24", false, "alt-ohne-art"),
                listOf("m1", "unterlage", "2027-01-15", false, "erste-hilfe-bald"),
            ),
            e.map { listOf(it.memberId, it.art, it.datum, it.abgelaufen, it.documentId.orEmpty()) },
        )
        assertEquals("Trainer-/Übungsleiterlizenz: lizenz-abgelaufen", e[0].text)
        assertEquals("Sonstiges: alt-ohne-art", e[2].text)
        assertEquals("Bernd Test", e[1].memberName)
        assertEquals(5, Unterlagen.anzahl(listOf("m1", "m3"), docs))
        assertEquals("Erste-Hilfe-Nachweis", Unterlagen.artText("erste_hilfe"))
        assertEquals("Sonstiges", Unterlagen.artText(null))
        assertEquals("aufnahmeantrag", Unterlagen.artVon("doc-antrag-M-0001", null, emptyList()))
        assertEquals("aufnahmeantrag", Unterlagen.artVon("x", null, listOf("Aufnahmeantrag")))
        assertEquals("erste_hilfe", Unterlagen.artVon("x", "erste_hilfe", emptyList()))
        assertEquals("sonstiges", Unterlagen.artVon("x", "", emptyList()))
    }

    @Test fun unterlageAnlegenAendernUndFuehrungszeugnis() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        store.put(MemberStore.AREA, "m1", mitglied("m1", "Anna"))
        val pdf = "%PDF-1.4\n%%EOF\n".toByteArray()
        val d = Unterlagen.neu(store, files, pdf, "lizenz.pdf", "application/pdf", "m1", "Anna Test", "trainerlizenz", " C-Lizenz ", "2024-03-01", "2027-03-01", jetzt)
        assertEquals("C-Lizenz", d.titel)
        assertEquals("trainerlizenz", d.unterlagenArt)
        assertEquals("2027-03-01", d.gueltigBis)
        assertEquals(Unterlagen.ORDNER_ID, d.ordnerId)
        assertEquals("mitglieder", d.kategorie)
        assertEquals("2024-03-01", d.datum)
        assertNotNull(store.get(Dokumente.ORDNER, Unterlagen.ORDNER_ID))
        // ohne Elternordner liegt „Mitgliederunterlagen“ oben
        assertNull(store.get(Dokumente.ORDNER, Unterlagen.ORDNER_ID)!!["parentId"])

        val g = Unterlagen.aendern(store, d.id, "erste_hilfe", "EH", "", "2026-12-01", jetzt)
        assertEquals("erste_hilfe", g.unterlagenArt)
        assertEquals("", g.ausgestelltAm)
        assertNull(store.get(Dokumente.DOKUMENTE, d.id)!!["issuedAt"])
        assertEquals(d.dateiId, g.dateiId)

        // Allgemeines Bearbeiten im Dokumentenarchiv behält die Angaben
        val h = DokumentStore.aendern(store, DokumentForm.von(g).copy(notiz = "neu"), jetzt)
        assertEquals("2026-12-01", h.gueltigBis)
        // Mitglied entfernt: Unterlagen-Angaben entfallen
        val k = DokumentStore.aendern(store, DokumentForm.von(h).copy(mitgliedId = "", mitgliedName = ""), jetzt)
        assertEquals("", k.unterlagenArt)

        Unterlagen.fuehrungszeugnisSetzen(store, "m1", Fuehrungszeugnis("2026-11-01", "2026-10-20", false), heute, jetzt)
        assertEquals(Fuehrungszeugnis("2026-11-01", "2026-10-20", false), Fuehrungszeugnis.aus(store.get(MemberStore.AREA, "m1")!!["policeCertificate"]))
        Unterlagen.fuehrungszeugnisSetzen(store, "m1", null, heute, jetzt)
        assertNull(store.get(MemberStore.AREA, "m1")!!["policeCertificate"])
        try {
            Unterlagen.fuehrungszeugnisSetzen(store, "m1", Fuehrungszeugnis("", "", false), heute, jetzt)
            throw AssertionError("erwartet: Fehler")
        } catch (e: IllegalArgumentException) {
            assertEquals("Bitte das Datum des Führungszeugnisses eingeben.", e.message)
        }
        assertEquals(1, store.all(Dokumente.DOKUMENTE).size)
        Dokument.from(store.all(Dokumente.DOKUMENTE).single())
    }

    // ---- Änderungsprotokoll (T-346): gleiche Fälle wie src/utils/unterlagenProtokoll.test.ts

    private fun pd(vararg p: Pair<String, Any?>): Dokument {
        val basis = mapOf<String, Any?>(
            "id" to "doc-1", "title" to "C-Lizenz Fußball", "fileName" to "lizenz.pdf", "memberId" to "mem-1",
            "date" to "2026-01-01", "memberDocType" to "trainerlizenz",
        ) + p.toMap()
        return Dokument.from(obj(*basis.toList().toTypedArray()))
    }

    @Test fun protokollTexteWieAmDesktop() {
        assertEquals("Unterlage hinzugefügt: Trainer-/Übungsleiterlizenz: C-Lizenz Fußball", Unterlagen.textHinzugefuegt(pd()))
        assertEquals("Unterlage gelöscht: Trainer-/Übungsleiterlizenz: C-Lizenz Fußball", Unterlagen.textGeloescht(pd()))
        assertEquals(
            "Unterlage gelöscht: Aufnahmeantrag: Antrag",
            Unterlagen.textGeloescht(pd("id" to "doc-antrag-M-1", "memberDocType" to null, "title" to "Antrag")),
        )

        val a = Unterlagen.aenderungen(pd("validUntil" to "2027-01-31"), pd("memberDocType" to "erste_hilfe", "issuedAt" to "2026-11-20"))
        assertEquals(
            listOf(
                Triple("Art", "Trainer-/Übungsleiterlizenz", "Erste-Hilfe-Nachweis"),
                Triple("Ausgestellt am", "–", "20.11.2026"),
                Triple("Gültig bis", "31.01.2027", "–"),
            ),
            a,
        )
        assertEquals(listOf("Bezeichnung", "Datei"), Unterlagen.aenderungen(pd(), pd("title" to "B-Lizenz", "fileName" to "neu.jpg")).map { it.first })
        assertEquals("Unterlage bearbeitet: B-Lizenz", Unterlagen.textBearbeitet(pd("title" to "B-Lizenz")))
        assertTrue(Unterlagen.aenderungen(pd(), pd("updatedAt" to "x")).isEmpty())
        assertTrue(Unterlagen.aenderungen(pd("id" to "doc-antrag-M-1", "memberDocType" to null), pd("id" to "doc-antrag-M-1", "memberDocType" to "aufnahmeantrag")).isEmpty())
    }

    @Test fun anlegenAendernLoeschenSchreibenInsProtokoll() {
        val store = InMemoryDocumentStore()
        val files = InMemoryFileStore()
        store.put(MemberStore.AREA, "m1", mitglied("m1", "Anna"))
        val pdf = "%PDF-1.4\n%%EOF\n".toByteArray()
        fun eintraege() = store.all(MemberStore.LOG).filter { (it["memberId"] as JsonPrimitive).content == "m1" }
        fun text(o: JsonObject, k: String) = (o[k] as JsonPrimitive).content

        val d = Unterlagen.neu(store, files, pdf, "lizenz.pdf", "application/pdf", "m1", "Anna Test", "trainerlizenz", "C-Lizenz", "2024-03-01", "2027-03-01", jetzt)
        Unterlagen.aendern(store, d.id, "trainerlizenz", "C-Lizenz", "2024-03-01", "2027-03-01", jetzt) // unverändert: kein Eintrag
        Unterlagen.aendern(store, d.id, "trainerlizenz", "C-Lizenz", "2024-03-01", "2028-03-01", jetzt)
        Unterlagen.fuehrungszeugnisSetzen(store, "m1", Fuehrungszeugnis("2026-11-01", "2026-10-20", false), heute, jetzt) // nicht ins Protokoll
        Unterlagen.loeschen(store, files, d.id, jetzt)

        val l = eintraege()
        assertEquals(
            listOf(
                "Unterlage hinzugefügt: Trainer-/Übungsleiterlizenz: C-Lizenz",
                "Unterlage bearbeitet: C-Lizenz",
                "Unterlage gelöscht: Trainer-/Übungsleiterlizenz: C-Lizenz",
            ),
            l.map { text(it, "summary") },
        )
        assertTrue(l.all { text(it, "action") == "update" && text(it, "author") == "Admin" })
        val c = (l[1]["changes"] as kotlinx.serialization.json.JsonArray).single() as JsonObject
        assertEquals(listOf("unterlage0", "Gültig bis", "01.03.2027", "01.03.2028"), listOf("field", "label", "oldValue", "newValue").map { text(c, it) })
        assertTrue(store.all(Dokumente.DOKUMENTE).isEmpty())
        assertTrue(files.ids().isEmpty())
    }
}
