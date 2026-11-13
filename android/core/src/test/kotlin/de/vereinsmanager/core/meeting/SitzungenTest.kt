package de.vereinsmanager.core.meeting

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.invoice.Mass
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class SitzungenTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 13, 12, 0, 0, 0, ZoneOffset.UTC)
    private val mass = Mass { t, g, _ -> t.length * g * 0.19 }
    private val unterschrift = Unterschrift(2.0, listOf(listOf(0.1 to 0.5, 0.5 to 0.2, 0.9 to 0.6)))
    private val verein = VereinsForm(name = "TSV Beispiel e.V.", strasse = "Hauptstr.", hausnummer = "1", plz = "12345", ort = "Beispielstadt")

    private fun fehlerText(block: () -> Unit): String = try { block(); fail("erwartet: Fehler"); "" } catch (e: SitzungException) { e.message ?: "" }

    private fun beschluss(id: String = "b1", ja: String = "7", nein: String = "1", enth: String = "0", ergebnis: String = "accepted", register: Boolean = false, steuer: Boolean = false) =
        BeschlussForm(id, "Kassenprüfer", "Der Verein wählt X zum Kassenprüfer.", "", ja, nein, enth, ergebnis, steuer, register)

    private fun form(tops: List<TopForm> = listOf(TopForm("t1", "Begrüßung"), TopForm("t2", "Wahlen", beschluesse = listOf(beschluss(register = true)))), stimmen: String = "10") =
        Sitzungen.neu("board", LocalDate.of(2026, 11, 13)).copy(
            titel = "Vorstandssitzung November", beginn = "19:00", ende = "21:00", ort = "Vereinsheim", leitung = "Anna Alt", schrift = "Bernd Bau",
            einladungOk = true, beschlussfaehig = true, stimmberechtigte = stimmen, tops = tops,
            teilnehmer = listOf(AnwesenderForm("a1", name = "Anna Alt", rolle = "1. Vorsitzende"), AnwesenderForm("a2", name = "Bernd Bau", anwesend = false)),
        )

    private fun speichere(s: InMemoryDocumentStore, f: SitzungForm = form()) = Sitzungen.speichern(s, f, jetzt)

    @Test fun neueSitzungHatKeineMusterdaten() {
        val f = Sitzungen.neu("general_assembly", LocalDate.of(2026, 11, 13))
        assertEquals("Mitgliederversammlung 2026", f.titel)
        assertEquals("", f.ort); assertEquals("", f.leitung); assertEquals("", f.schrift); assertEquals("", f.stimmberechtigte)
        assertFalse(f.einladungOk); assertFalse(f.beschlussfaehig)
        assertEquals(6, f.tops.size)
        assertTrue(f.teilnehmer.isEmpty())
        assertEquals(4, Sitzungen.neu("board", LocalDate.of(2027, 1, 5)).tops.size)
        assertTrue(Sitzungen.neu("other", LocalDate.of(2027, 1, 5)).tops.isEmpty())
    }

    @Test fun pflichtangabenUndZeitenWerdenGeprueft() {
        val e = Sitzungen.pruefen(form().copy(titel = " ", datum = "13.11.2026", beginn = "25:00"))
        assertTrue("titel" in e && "datum" in e && "beginn" in e)
        assertEquals("Das Ende muss nach dem Beginn liegen.", Sitzungen.pruefen(form().copy(beginn = "20:00", ende = "19:00"))["ende"])
        assertTrue("einladungsDatum" in Sitzungen.pruefen(form().copy(einladungsDatum = "2026-12-01")))
        assertTrue("stimmberechtigte" in Sitzungen.pruefen(form().copy(stimmberechtigte = "-3")))
        assertTrue("top0" in Sitzungen.pruefen(form(tops = listOf(TopForm("t", " ")))))
        assertTrue("status" in Sitzungen.pruefen(form().copy(status = "approved")))
        assertTrue(Sitzungen.pruefen(form()).isEmpty())
    }

    @Test fun stimmenWerdenGegenDieAnwesendenGeprueft() {
        fun fehler(b: BeschlussForm, grenze: String = "10") = Sitzungen.pruefen(form(listOf(TopForm("t", "X", beschluesse = listOf(b))), grenze))["beschluss0.0"]
        assertNull(fehler(beschluss()))
        assertTrue(fehler(beschluss(ja = "9", nein = "2"))!!.contains("11 Stimmen"))
        assertTrue(fehler(beschluss(ja = "3", nein = "3"))!!.contains("nicht angenommen"))
        assertTrue(fehler(beschluss(ja = "", nein = "", enth = ""))!!.contains("Stimmen eintragen"))
        assertNull(fehler(beschluss(ja = "", nein = "", enth = "", ergebnis = "deferred")))
        assertNull(fehler(beschluss(ja = "2", nein = "6", ergebnis = "rejected")))
        // ohne eingetragene Zahl gilt die Zählung aus der Teilnehmerliste (hier 1 stimmberechtigte/r Anwesende/r)
        assertTrue(fehler(beschluss(), grenze = "")!!.contains("nur 1"))
        assertEquals("accepted", Sitzungen.ergebnisVorschlag(5, 4)); assertEquals("rejected", Sitzungen.ergebnisVorschlag(4, 4))
    }

    @Test fun speichernBehaeltUnbekannteFelderUndNummeriertNeu() {
        val s = InMemoryDocumentStore()
        val a = speichere(s)
        // am Desktop gesetzte Felder, die das Formular nicht kennt
        val roh = s.get(Sitzungen.AREA, a.id)!!.toMutableMap().also { it["customTemplateUsed"] = JsonPrimitive(true); it["zusatz"] = JsonPrimitive("bleibt") }
        s.put(Sitzungen.AREA, a.id, JsonObject(roh))
        val f = SitzungForm.von(Sitzungen.sitzung(s, a.id)!!)
        val b = Sitzungen.speichern(s, f.copy(tops = listOf(f.tops[1]), titel = "Neu"), jetzt) // TOP 1 gelöscht
        assertEquals("Neu", b.titel)
        assertEquals("TOP 1", b.tops.single().nummer)
        assertEquals("TOP 1", b.tops.single().beschluesse.single().nummer)
        val raw = s.get(Sitzungen.AREA, a.id)!!
        assertEquals("bleibt", (raw["zusatz"] as JsonPrimitive).content)
        assertEquals("true", (raw["customTemplateUsed"] as JsonPrimitive).content)
    }

    @Test fun unterschriftSperrtUndDieZweiteGenehmigt() {
        val s = InMemoryDocumentStore()
        val a = speichere(s)
        assertFalse(a.gesperrt)
        val l = Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "data:image/png;base64,AAAA", now = jetzt)
        assertTrue(l.gesperrt); assertTrue(l.leitungSigniert); assertFalse(l.schriftSigniert)
        assertEquals("scheduled", l.status)
        assertEquals(Sitzungen.GESPERRT, fehlerText { Sitzungen.speichern(s, SitzungForm.von(l), jetzt) })
        val fertig = Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_SCHRIFT, unterschrift, "data:image/png;base64,BBBB", now = jetzt)
        assertEquals("approved", fertig.status); assertEquals("2026-11-13", fertig.signiertAm)
        assertTrue(fertig.vollstaendigUnterschrieben)
        assertEquals(2, fertig.signaturen.size)
        assertEquals(unterschrift.striche, fertig.signaturen[0].unterschrift!!.striche.map { st -> st.map { (x, y) -> Math.round(x * 10) / 10.0 to Math.round(y * 10) / 10.0 } })
        // Entfernen entsperrt; aus „Genehmigt“ wird „In Vorprüfung“
        val offen = Sitzungen.unterschriftenEntfernen(s, a.id, jetzt)
        assertFalse(offen.gesperrt); assertEquals("review", offen.status); assertEquals("", offen.signiertAm)
        assertEquals("Neu", Sitzungen.speichern(s, SitzungForm.von(offen).copy(titel = "Neu"), jetzt).titel)
    }

    @Test fun unterschreibenBrauchtNamenUndUnterschrift() {
        val s = InMemoryDocumentStore()
        val a = speichere(s, form().copy(schrift = ""))
        assertTrue(fehlerText { Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_SCHRIFT, unterschrift, "x", now = jetzt) }.contains("Namen"))
        assertTrue(fehlerText { Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_LEITUNG, Unterschrift(2.0, emptyList()), "x", now = jetzt) }.contains("unterschreiben"))
        val ab = speichere(s, form().copy(id = null, status = "cancelled"))
        assertTrue(fehlerText { Sitzungen.unterschreiben(s, ab.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "x", now = jetzt) }.contains("abgesagt"))
    }

    @Test fun aenderungNachDerUnterschriftWirdErkannt() {
        val s = InMemoryDocumentStore()
        val a = speichere(s)
        val u = Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "x", now = jetzt)
        assertEquals(Sitzungen.Pruefung.GUELTIG, Sitzungen.pruefung(u, u.signaturen.single()))
        // jemand ändert den Text am Desktop (der die Sperre nicht kennt)
        s.put(Sitzungen.AREA, a.id, JsonObject(s.get(Sitzungen.AREA, a.id)!!.toMutableMap().also { it["location"] = JsonPrimitive("Anderswo") }))
        val g = Sitzungen.sitzung(s, a.id)!!
        assertEquals(Sitzungen.Pruefung.GEAENDERT, Sitzungen.pruefung(g, g.signaturen.single()))
        assertTrue(SitzungsLayout.protokoll(g, verein, mass, true).flatten().any { it is Zeichnung.Text && it.text.contains("nach einer Unterschrift geändert") })
        // Desktop-Unterschrift ohne Fingerabdruck: nicht prüfbar
        val ohne = g.signaturen.single().copy(inhalt = "")
        assertEquals(Sitzungen.Pruefung.UNBEKANNT, Sitzungen.pruefung(g, ohne))
    }

    @Test fun archivierenNurMitBeidenUnterschriftenUndNurEinmal() {
        val s = InMemoryDocumentStore(); val files = InMemoryFileStore()
        val a = speichere(s)
        assertTrue(fehlerText { Sitzungen.archivieren(s, files, a.id, byteArrayOf(1, 2, 3), jetzt) }.contains("beiden Unterschriften"))
        Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "x", now = jetzt)
        val fertig = Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_SCHRIFT, unterschrift, "x", now = jetzt)
        val d = Sitzungen.archivieren(s, files, a.id, byteArrayOf(1, 2, 3), jetzt)
        assertEquals("protokolle", d.kategorie); assertEquals("application/pdf", d.dateiTyp)
        assertTrue(d.titel.startsWith("Protokoll: Vorstandssitzung November vom 13.11.2026"))
        val danach = Sitzungen.sitzung(s, a.id)!!
        assertEquals(d.id, danach.dokumentId); assertTrue(Sitzungen.imArchiv(s, danach))
        assertTrue(fehlerText { Sitzungen.archivieren(s, files, a.id, byteArrayOf(1), jetzt) }.contains("schon im Archiv"))
        assertEquals("Protokoll_2026-11-13_Vorstandssitzung_November.pdf", Sitzungen.dateiname("Protokoll", fertig))
        // Sitzung löschen lässt das Dokument stehen
        Sitzungen.loeschen(s, a.id)
        assertEquals(1, s.count(Dokumente.DOKUMENTE))
        // Entfernen der Unterschriften löst den Verweis
        val b = speichere(s, form().copy(id = null))
        Sitzungen.unterschreiben(s, b.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "x", now = jetzt)
        Sitzungen.unterschreiben(s, b.id, Sitzungen.ROLLE_SCHRIFT, unterschrift, "x", now = jetzt)
        Sitzungen.archivieren(s, files, b.id, byteArrayOf(9), jetzt)
        assertEquals("", Sitzungen.unterschriftenEntfernen(s, b.id, jetzt).dokumentId)
        assertEquals(2, s.count(Dokumente.DOKUMENTE))
    }

    @Test fun statistikUndBeschlussbuch() {
        val s = InMemoryDocumentStore()
        speichere(s, form(listOf(TopForm("t1", "A", beschluesse = listOf(beschluss("b1", register = true), beschluss("b2", ja = "2", nein = "6", ergebnis = "rejected", steuer = true), beschluss("b3", ja = "", nein = "", enth = "", ergebnis = "deferred"))))))
        speichere(s, form(listOf(TopForm("t1", "B", beschluesse = listOf(beschluss("b4", steuer = true)))), "10").copy(titel = "Zweite", datum = "2026-12-01", art = "general_assembly"))
        val alle = Sitzungen.alle(s)
        assertEquals("Zweite", alle.first().titel) // neueste zuerst
        val st = Sitzungen.statistik(alle)
        assertEquals(2, st.gesamt); assertEquals(1, st.versammlungen); assertEquals(1, st.vorstand)
        assertEquals(2, st.angenommen); assertEquals(1, st.abgelehnt); assertEquals(1, st.vertagt)
        assertEquals(1, st.steuer) // der abgelehnte steuerrelevante zählt nicht
        assertEquals(1, st.register)
        assertEquals(4, Sitzungen.beschlussbuch(alle, null, "").size)
        assertEquals("Zweite", Sitzungen.beschlussbuch(alle, null, "").first().sitzung.titel)
        assertEquals(2, Sitzungen.beschlussbuch(alle, "tax", "").size)
        assertEquals(1, Sitzungen.beschlussbuch(alle, "register", "").size)
        assertEquals(1, Sitzungen.filtern(alle, "zweite", null, null).size)
        assertEquals(1, Sitzungen.filtern(alle, "", "general_assembly", null).size)
        assertEquals(2, Sitzungen.filtern(alle, "kassenprüfer", null, "scheduled").size)
    }

    @Test fun mailEmpfaengerUndTextOhneErfundenes() {
        val m1 = Member.from(JsonObject(mapOf("id" to JsonPrimitive("m1"), "firstName" to JsonPrimitive("Anna"), "lastName" to JsonPrimitive("Alt"), "status" to JsonPrimitive("active"), "email" to JsonPrimitive("anna@x.de"))))
        val m2 = Member.from(JsonObject(mapOf("id" to JsonPrimitive("m2"), "firstName" to JsonPrimitive("Carl"), "lastName" to JsonPrimitive("Cora"), "status" to JsonPrimitive("active"), "email" to JsonPrimitive("ANNA@x.de"))))
        val m3 = Member.from(JsonObject(mapOf("id" to JsonPrimitive("m3"), "firstName" to JsonPrimitive("Dora"), "lastName" to JsonPrimitive("Dach"), "status" to JsonPrimitive("terminated"), "email" to JsonPrimitive("dora@x.de"))))
        val m4 = Member.from(JsonObject(mapOf("id" to JsonPrimitive("m4"), "firstName" to JsonPrimitive("Eva"), "lastName" to JsonPrimitive("Eck"), "status" to JsonPrimitive("active"), "email" to JsonPrimitive("eva@x.de"))))
        val s = Sitzung.from(JsonObject(mapOf("id" to JsonPrimitive("x"), "title" to JsonPrimitive("T"), "date" to JsonPrimitive("2026-11-13"))))
            .copy(teilnehmer = listOf(Anwesender.from(JsonObject(mapOf("id" to JsonPrimitive("a"), "memberId" to JsonPrimitive("m1"), "name" to JsonPrimitive("Anna Alt"))))))
        val e = Sitzungen.empfaenger(s, listOf(m1, m2, m3, m4))
        assertEquals(listOf("anna@x.de", "eva@x.de"), e.map { it.email })
        assertTrue(e[0].teilnehmer); assertFalse(e[1].teilnehmer)
        val text = Sitzungen.mailText(s, Sitzungen.MailArt.EINLADUNG, "")
        assertFalse(text.contains("Mit freundlichen Grüßen")); assertFalse(text.contains("Verein"))
        assertTrue(Sitzungen.mailText(s, Sitzungen.MailArt.EINLADUNG, "TSV Beispiel").endsWith("TSV Beispiel"))
        assertEquals("Einladung: T am 13.11.2026", Sitzungen.mailBetreff(s, Sitzungen.MailArt.EINLADUNG))
        assertTrue(Sitzungen.mailText(s, Sitzungen.MailArt.PROTOKOLL, "").contains("noch nicht genehmigt"))
    }

    @Test fun einladungUndAuszugBrauchenAngaben() {
        val s = InMemoryDocumentStore()
        val leer = speichere(s, form().copy(beginn = "", ort = "", tops = emptyList()))
        assertEquals(listOf("Uhrzeit", "Ort", "Tagesordnung"), Sitzungen.einladungFehlt(leer))
        assertTrue(Sitzungen.einladungFehlt(speichere(s, form().copy(id = null))).isEmpty())
        assertTrue(Sitzungen.auszugFehlt(leer) != null)
        val ok = speichere(s, form().copy(id = null))
        assertNull(Sitzungen.auszugFehlt(ok))
        assertTrue(Sitzungen.auszugFehlt(speichere(s, form().copy(id = null, beschlussfaehig = false)))!!.contains("Beschlussfähigkeit"))
    }

    private fun texte(seiten: List<List<Zeichnung>>) = seiten.flatten().filterIsInstance<Zeichnung.Text>().map { it.text }

    @Test fun protokollNenntNurDasWasEingetragenIst() {
        val s = InMemoryDocumentStore()
        val a = speichere(s, form().copy(einladungOk = false, beschlussfaehig = false))
        val t = texte(SitzungsLayout.protokoll(a, verein, mass, mitUnterschriften = false))
        assertTrue(t.any { it.contains("Entwurf – noch nicht genehmigt") })
        assertTrue(t.any { it == "nicht festgestellt" })
        assertTrue(t.any { it.contains("nicht bestätigt") })
        assertTrue(t.any { it.contains("Beschluss: Kassenprüfer") })
        assertTrue(t.any { it.contains("Abstimmung: Ja 7, Nein 1, Enthaltungen 0 – Ergebnis: Angenommen") })
        assertTrue(t.any { it.contains("Nicht anwesend: Bernd Bau") })
        assertTrue(t.contains("TSV Beispiel e.V."))
        assertFalse(t.any { it.contains("Musterstadt") || it.contains("Sommer") })
        // mit Briefpapier kein eigener Kopf
        assertFalse(texte(SitzungsLayout.protokoll(a, verein, mass, false, briefpapier = true, randOben = 50.0)).contains("TSV Beispiel e.V."))
    }

    @Test fun unterschriftenImProtokollNurWennGewuenscht() {
        val s = InMemoryDocumentStore()
        val a = speichere(s)
        Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_LEITUNG, unterschrift, "x", now = jetzt)
        val g = Sitzungen.unterschreiben(s, a.id, Sitzungen.ROLLE_SCHRIFT, unterschrift, "x", now = jetzt)
        fun striche(mit: Boolean) = SitzungsLayout.protokoll(g, verein, mass, mit).flatten().count { it is Zeichnung.Linienzug }
        assertEquals(2, striche(true)); assertEquals(0, striche(false))
        assertFalse(texte(SitzungsLayout.protokoll(g, verein, mass, true)).any { it.contains("Entwurf") })
    }

    @Test fun auszugUndEinladungKommenAusDenEingaben() {
        val s = InMemoryDocumentStore()
        val a = speichere(s)
        val auszug = texte(SitzungsLayout.auszug(a, verein, mass, false))
        assertTrue(auszug.any { it.contains("Die Beschlussfähigkeit wurde festgestellt; es waren 10 stimmberechtigte Mitglieder anwesend") })
        assertTrue(auszug.any { it.contains("TOP 2: Kassenprüfer") })
        val einl = texte(SitzungsLayout.einladung(a.copy(einladungsDatum = "2026-10-01"), verein, mass))
        assertTrue(einl.any { it == "EINLADUNG" }); assertTrue(einl.any { it.contains("Freitag, 13.11.2026, 19:00 Uhr bis ca. 21:00 Uhr") })
        assertTrue(einl.any { it.contains("Einladung vom 01.10.2026") }); assertTrue(einl.any { it == "TOP 2" })
        assertTrue(einl.contains("Anna Alt"))
    }

    @Test fun demoSitzungenLassenSichLesenUndOhneVerlustSpeichern() {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        val s = InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
        val alle = Sitzungen.alle(s)
        assertEquals(2, alle.size)
        alle.forEach { m ->
            val roh = s.get(Sitzungen.AREA, m.id)!!
            assertEquals(m.tops.size, ((roh["agenda"] as kotlinx.serialization.json.JsonArray)).size)
            if (Sitzungen.pruefen(SitzungForm.von(m)).isEmpty() && !m.gesperrt) {
                val neu = Sitzungen.speichern(s, SitzungForm.von(m), jetzt)
                assertEquals(m.tops.map { it.titel }, neu.tops.map { it.titel })
                assertEquals(m.beschluesse.size, neu.beschluesse.size)
            }
        }
    }
}
