package de.vereinsmanager.core.calendar

import de.vereinsmanager.core.backup.BackupFile
import de.vereinsmanager.core.backup.BackupImporter
import de.vereinsmanager.core.backup.ImportMode
import de.vereinsmanager.core.importe.Tabellen
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
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

class KalenderTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 12, 20, 0, 0, 0, ZoneOffset.UTC)
    private fun d(s: String) = LocalDate.parse(s)

    private fun speichere(s: InMemoryDocumentStore, f: TerminForm) = Termin.from(Kalender.speichern(s, f, jetzt))
    private fun basis(titel: String, beginn: String, ende: String = beginn) = Kalender.neu(d(beginn)).copy(titel = titel, ende = ende)
    private fun fehlerText(block: () -> Unit): String = try { block(); fail("erwartet: Fehler"); "" } catch (e: IllegalArgumentException) { e.message ?: "" }
    private fun termine(vararg f: TerminForm): List<Termin> { val s = InMemoryDocumentStore(); return f.map { speichere(s, it) } }
    private fun demo(): InMemoryDocumentStore {
        val text = javaClass.getResourceAsStream("/demo/demo_klartext.json")!!.readBytes().toString(Charsets.UTF_8)
        return InMemoryDocumentStore().also { BackupImporter.import(BackupFile.parse(text), it, ImportMode.REPLACE) }
    }
    private fun mitglied(id: String, geb: String = "", ein: String = "", status: String = "active") = Member.from(
        JsonObject(mapOf("id" to JsonPrimitive(id), "firstName" to JsonPrimitive("Vor$id"), "lastName" to JsonPrimitive("Nach$id"), "birthDate" to JsonPrimitive(geb), "entryDate" to JsonPrimitive(ein), "status" to JsonPrimitive(status), "department" to JsonPrimitive("Fußball"), "email" to JsonPrimitive("$id@x.de"))),
    )

    // ---- Serien ----

    @Test fun monatlicheSerieAbDem31ErsetztNichtDenFolgemonat() {
        val t = termine(basis("Monatsende", "2026-01-31").copy(serie = true, frequenz = "monthly"))
        val v = Kalender.vorkommen(t, d("2026-01-01"), d("2026-05-31")).map { it.datum.toString() }
        assertEquals(listOf("2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"), v)
    }

    @Test fun wochentageMitIntervallZweiLaufenImZweiWochenTakt() {
        val t = termine(basis("Training", "2026-11-02").copy(serie = true, frequenz = "weekly", intervall = "2", wochentage = setOf(1, 3)))
        val v = Kalender.vorkommen(t, d("2026-11-01"), d("2026-12-06")).map { it.datum.toString() }
        assertEquals(listOf("2026-11-02", "2026-11-04", "2026-11-16", "2026-11-18", "2026-11-30", "2026-12-02"), v)
    }

    @Test fun serienEndeNachAnzahlUndNachDatum() {
        val s = InMemoryDocumentStore()
        val a = speichere(s, basis("A", "2026-11-12").copy(serie = true, frequenz = "daily", endeArt = "count", anzahl = "3"))
        val b = speichere(s, basis("B", "2026-11-12").copy(serie = true, frequenz = "daily", endeArt = "until_date", bis = "2026-11-14"))
        assertEquals(3, Kalender.vorkommen(listOf(a), d("2026-11-01"), d("2026-12-31")).size)
        assertEquals(listOf("2026-11-12", "2026-11-13", "2026-11-14"), Kalender.vorkommen(listOf(b), d("2026-11-01"), d("2026-12-31")).map { it.datum.toString() })
        // Die Anzahl zählt ab dem ersten Termin, auch wenn der Zeitraum später beginnt.
        assertEquals(listOf("2026-11-14"), Kalender.vorkommen(listOf(a), d("2026-11-14"), d("2026-12-31")).map { it.datum.toString() })
    }

    @Test fun mehrtaegigeTermineErscheinenAnJedemTag() {
        val t = termine(basis("Lager", "2026-11-10", "2026-11-12"))
        val v = Kalender.vorkommen(t, d("2026-11-11"), d("2026-11-11"))
        assertEquals(1, v.size)
        assertEquals(1, Kalender.amTag(v, d("2026-11-11")).size)
        assertEquals(1, Kalender.amTag(Kalender.vorkommen(t, d("2026-11-01"), d("2026-11-30")), d("2026-11-12")).size)
        assertEquals(0, Kalender.amTag(Kalender.vorkommen(t, d("2026-11-01"), d("2026-11-30")), d("2026-11-13")).size)
    }

    @Test fun mehrtaegigeSerieDieVorDemZeitraumBeginntWirdGezeigt() {
        val t = termine(basis("Wochenende", "2026-11-02", "2026-11-04").copy(serie = true, frequenz = "weekly", wochentage = setOf(1)))
        val v = Kalender.vorkommen(t, d("2026-11-10"), d("2026-11-10"))
        assertEquals(listOf("2026-11-09"), v.map { it.datum.toString() })
        assertEquals("2026-11-11", v.single().ende.toString())
    }

    // ---- Geburtstage und Jubiläen ----

    @Test fun geburtstagAm29FebruarGiltInNormalenJahrenAm28() {
        val b = Kalender.besondere(listOf(mitglied("a", geb = "2000-02-29")), d("2027-02-01"), d("2027-03-01"))
        assertEquals(1, b.size)
        assertEquals("2027-02-28", b.single().datum.toString())
        assertEquals(27, b.single().jahre)
    }

    @Test fun geburtstagImNeuenJahrErscheintInDerDezemberAnsicht() {
        val b = Kalender.besondere(listOf(mitglied("a", geb = "1990-01-05")), d("2026-12-20"), d("2027-01-10"))
        assertEquals(listOf("2027-01-05"), b.map { it.datum.toString() })
        assertEquals(37, b.single().jahre)
    }

    @Test fun jubilaeenOhneFestenVereinsnamenUndAusgetreteneFehlen() {
        val m = listOf(mitglied("a", ein = "2001-06-01"), mitglied("b", ein = "2016-06-01"), mitglied("c", ein = "2019-06-01"), mitglied("d", ein = "2001-06-01", status = "terminated"))
        val b = Kalender.besondere(m, d("2026-06-01"), d("2026-06-01"))
        assertEquals(3, b.size)
        assertTrue(b.any { it.titel.contains("Silbernes Jubiläum") })
        assertTrue(b.any { it.titel.contains("10 Jahre Jubiläum") })
        assertTrue(b.any { it.titel.contains("7 Jahre im Verein") })
        assertFalse(b.any { it.titel.contains("TSV") })
    }

    // ---- Prüfen und Speichern ----

    @Test fun pruefenMeldetEndeVorBeginnUndSerienfehler() {
        val e = Kalender.pruefen(basis(" ", "2026-11-12", "2026-11-11").copy(beginnZeit = "25:00", serie = true, intervall = "0", wochentage = emptySet(), endeArt = "count", anzahl = "0"))
        assertEquals(setOf("titel", "ende", "beginnZeit", "intervall", "wochentage", "anzahl"), e.keys)
        val gleicherTag = Kalender.pruefen(basis("X", "2026-11-12").copy(beginnZeit = "19:00", endeZeit = "18:00"))
        assertEquals(setOf("endeZeit"), gleicherTag.keys)
        assertTrue(Kalender.pruefen(basis("X", "2026-11-12").copy(ganztaegig = true, beginnZeit = "", endeZeit = "")).isEmpty())
        assertEquals(setOf("bis"), Kalender.pruefen(basis("X", "2026-11-12").copy(serie = true, endeArt = "until_date", bis = "2026-11-01")).keys)
    }

    @Test fun speichernBehaeltUnbekanntesUndAnlegedatumUndEntferntKoordinatenBeiNeuemOrt() {
        val s = InMemoryDocumentStore()
        val t = speichere(s, basis("Fest", "2026-11-20").copy(ort = "Halle"))
        val alt = s.get(Kalender.AREA, t.id)!!
        s.put(Kalender.AREA, t.id, JsonObject(alt + mapOf("sonder" to JsonPrimitive("bleibt"), "locationLat" to JsonPrimitive(52.5), "locationLng" to JsonPrimitive(13.4))))
        val gleich = Termin.from(Kalender.speichern(s, TerminForm.von(Kalender.termin(s, t.id)!!).copy(titel = "Fest 2"), jetzt.plusDays(1)))
        assertEquals("bleibt", (gleich.raw["sonder"] as JsonPrimitive).content)
        assertTrue(gleich.raw.containsKey("locationLat")) // Ort unverändert: Koordinaten bleiben
        val anders = Termin.from(Kalender.speichern(s, TerminForm.von(gleich).copy(ort = "Platz"), jetzt.plusDays(2)))
        assertFalse(anders.raw.containsKey("locationLat"))
        assertEquals((alt["createdAt"] as JsonPrimitive).content, (anders.raw["createdAt"] as JsonPrimitive).content)
        assertEquals(1, Kalender.alle(s).size)
        assertTrue(fehlerText { Kalender.speichern(s, basis("", "2026-11-20"), jetzt) }.isNotEmpty())
    }

    @Test fun ganztaegigEntferntUhrzeitenUndDesktopBiweeklyWirdWochenIntervall() {
        val s = InMemoryDocumentStore()
        val t = speichere(s, basis("Tag", "2026-11-20").copy(ganztaegig = true))
        assertFalse(t.raw.containsKey("startTime"))
        val desktop = Termin.from(JsonObject(mapOf("id" to JsonPrimitive("x"), "startDate" to JsonPrimitive("2026-11-02"), "recurrence" to JsonObject(mapOf("frequency" to JsonPrimitive("biweekly"), "interval" to JsonPrimitive(1), "daysOfWeek" to JsonArray(listOf(JsonPrimitive(1))), "endType" to JsonPrimitive("never"))))))
        assertEquals("weekly", desktop.serie!!.frequenz)
        assertEquals(2, desktop.serie!!.intervall)
    }

    // ---- Terminarten ----

    @Test fun terminartenStandardUndLoeschschutz() {
        val s = InMemoryDocumentStore()
        assertEquals(8, Kalender.arten(s).size)
        val neu = Kalender.artSpeichern(s, null, "Wandern", 2, "", jetzt)
        assertEquals(9, Kalender.arten(s).size) // Standardarten wurden dabei mitgespeichert
        assertTrue(fehlerText { Kalender.artSpeichern(s, null, "wandern", 1, "") }.contains("schon"))
        assertTrue(fehlerText { Kalender.artLoeschen(s, "cat-general") }.contains("Standardarten"))
        val t = speichere(s, basis("Tour", "2026-11-20").copy(art = neu.id))
        assertTrue(fehlerText { Kalender.artLoeschen(s, neu.id) }.contains("1 Termin"))
        Kalender.loeschen(s, t.id)
        Kalender.artLoeschen(s, neu.id)
        assertEquals(8, Kalender.arten(s).size)
    }

    // ---- Teilnehmer und Einladung ----

    @Test fun teilnehmerOhneDoppelteUndNachSparte() {
        val m = listOf(mitglied("a"), mitglied("b"))
        val l1 = Kalender.teilnehmerHinzu(emptyList(), m[0])
        assertEquals(l1, Kalender.teilnehmerHinzu(l1, m[0]))
        assertEquals(2, Kalender.teilnehmerSparte(l1, m, "Fußball").size)
        assertEquals(0, Kalender.teilnehmerSparte(emptyList(), m, "Tennis").size)
    }

    @Test fun einladungNenntKeineTeilnehmerUndSammeltAdressen() {
        val s = InMemoryDocumentStore()
        val mm = listOf(mitglied("a"), mitglied("b"))
        val tn = Kalender.teilnehmerHinzu(Kalender.teilnehmerHinzu(emptyList(), mm[0]), mm[1]).map { if (it.memberId == "a") it.copy(status = "confirmed") else it.copy(email = "") }
        val t = speichere(s, basis("Fest", "2026-11-12").copy(ort = "Halle", teilnehmer = tn, beschreibung = "Bringt Kuchen"))
        assertEquals(listOf("a@x.de"), Kalender.empfaenger(t))
        val text = Kalender.einladungsText(t, "TSV Beispiel")
        assertTrue(text.contains("Do, 12.11.2026, 18:00–19:30 Uhr"))
        assertTrue(text.contains("Bringt Kuchen"))
        assertFalse(text.contains("Vora"))
        assertEquals("Einladung: Fest [TSV Beispiel]", Kalender.betreff(t, "TSV Beispiel"))
        assertEquals("1 zugesagt · 1 offen", Kalender.zusagen(t))
    }

    // ---- iCal und CSV ----

    @Test fun icsRoundtripOhneUngueltigeRegelUndOhneVerschobeneGanztagstermine() {
        val s = InMemoryDocumentStore()
        val a = speichere(s, basis("Training", "2026-11-02").copy(serie = true, frequenz = "weekly", intervall = "2", wochentage = setOf(1, 3), endeArt = "count", anzahl = "8", ort = "Halle, Raum 2"))
        val b = speichere(s, basis("Lager", "2026-11-10", "2026-11-12").copy(ganztaegig = true, beschreibung = "Zeile1\nZeile2; ok"))
        val ics = Austausch.icsSchreiben(listOf(a, b), Kalender.arten(s), "Verein", jetzt)
        assertTrue(ics.contains("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=8"))
        assertFalse(ics.contains("BIWEEKLY"))
        assertTrue(ics.contains("DTEND;VALUE=DATE:20261113"))
        assertFalse(ics.contains("ATTENDEE"))
        val l = Austausch.icsLesen(ics, Kalender.arten(s), jetzt)
        assertTrue(l.hinweise.isEmpty())
        val neu = l.termine.map { Termin.from(it) }
        assertEquals(listOf(a.id, b.id), neu.map { it.id })
        assertEquals(a.serie, neu[0].serie)
        assertEquals("Halle, Raum 2", neu[0].ort)
        assertEquals("2026-11-12", neu[1].ende)
        assertTrue(neu[1].ganztaegig)
        assertEquals("Zeile1\nZeile2; ok", neu[1].beschreibung)
    }

    @Test fun langeIcsZeilenWerdenGefaltet() {
        val s = InMemoryDocumentStore()
        val t = speichere(s, basis("Äpfel und Birnen für die Jugendabteilung ".repeat(4), "2026-11-12"))
        val ics = Austausch.icsSchreiben(listOf(t), Kalender.arten(s), "V", jetzt)
        ics.split("\r\n").forEach { assertTrue(it.toByteArray(Charsets.UTF_8).size <= 75) }
        assertEquals(t.titel, Termin.from(Austausch.icsLesen(ics, Kalender.arten(s), jetzt).termine.single()).titel)
    }

    @Test fun icsLesenRechnetUtcInOrtszeitUndMeldetNichtAbbildbaresUndTeilnehmer() {
        val text = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1\r\nSUMMARY:Test\r\nDTSTART:20261112T170000Z\r\nDTEND:20261112T183000Z\r\n" +
            "RRULE:FREQ=MONTHLY;BYDAY=1MO\r\nEXDATE:20261201T170000Z\r\nATTENDEE;CN=Max:mailto:max@x.de\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
        val l = Austausch.icsLesen(text, Kalender.STANDARD_ARTEN, jetzt)
        val t = Termin.from(l.termine.single())
        assertEquals("18:00", t.beginnZeit)
        assertEquals("19:30", t.endeZeit)
        assertNull(t.serie)
        assertTrue(l.hinweise.any { it.contains("Wiederholung") })
        assertTrue(l.hinweise.any { it.contains("EXDATE") })
        assertTrue(l.hinweise.any { it.contains("Teilnehmerlisten") })
        assertTrue(t.teilnehmer.isEmpty())
    }

    @Test fun importUeberspringtVorhandene() {
        val s = InMemoryDocumentStore()
        val a = speichere(s, basis("Training", "2026-11-12"))
        val ics = Austausch.icsSchreiben(listOf(a, speichere(InMemoryDocumentStore(), basis("Neu", "2026-11-13"))), Kalender.arten(s), "V", jetzt)
        val r = Austausch.importieren(s, Austausch.icsLesen(ics, Kalender.arten(s), jetzt))
        assertEquals(1, r.neu)
        assertEquals(1, r.uebersprungen)
        assertEquals(2, Kalender.alle(s).size)
        assertEquals(0, Austausch.importieren(s, Austausch.icsLesen(ics, Kalender.arten(s), jetzt)).neu)
    }

    @Test fun csvLesenMitDesktopSpaltenUndAlternativnamen() {
        val kopf = listOf("Titel", "Kategorie", "Abteilung", "Startdatum", "Startzeit", "Enddatum", "Endzeit", "Ganztägig", "Ort", "Wiederholung", "Teilnehmer", "Beschreibung")
        val z = listOf("Training", "Training & Kurse", "Alle Abteilungen", "2026-11-12", "18:00", "2026-11-12", "19:30", "Nein", "Halle", "Keine", "", "Text")
        val l = Austausch.csvLesen(Tabellen.tabelle(listOf(kopf, z)), Kalender.STANDARD_ARTEN, jetzt)
        val t = Termin.from(l.termine.single())
        assertEquals("cat-training", t.art)
        assertEquals("all", t.sparte)
        assertEquals("18:00", t.beginnZeit)
        assertEquals("Halle", t.ort)
        val l2 = Austausch.csvLesen(Tabellen.tabelle(listOf(listOf("Betreff", "Datum", "Uhrzeit"), listOf("Sitzung", "12.11.2026", "19.30 Uhr"), listOf("", "12.11.2026", ""), listOf("Falsch", "gestern", ""))), Kalender.STANDARD_ARTEN, jetzt)
        assertEquals(1, l2.termine.size)
        assertEquals("19:30", Termin.from(l2.termine.single()).beginnZeit)
        assertEquals(2, l2.hinweise.size)
        assertTrue(Austausch.csvLesen(Tabellen.tabelle(listOf(listOf("Foo"), listOf("x"))), Kalender.STANDARD_ARTEN).hinweise.single().contains("Titel"))
    }

    @Test fun csvSchreibenHatDieDesktopSpalten() {
        val s = InMemoryDocumentStore()
        val t = speichere(s, basis("Training", "2026-11-12").copy(serie = true, frequenz = "weekly", wochentage = setOf(4)))
        val zeilen = Austausch.csvSchreiben(listOf(t), Kalender.arten(s)).trimStart('﻿').split("\r\n")
        assertEquals(Austausch.CSV_KOPF.joinToString(";"), zeilen[0])
        assertEquals(Austausch.CSV_KOPF.size, zeilen[1].split(";").size)
        assertTrue(zeilen[1].contains("wöchentlich (Do)"))
    }

    // ---- Demo-Daten ----

    @Test fun demoDatenLassenSichLesenUndExpandieren() {
        val s = demo()
        assertEquals(7, Kalender.alle(s).size)
        assertEquals(8, Kalender.arten(s).size)
        val v = Kalender.vorkommen(Kalender.alle(s), d("2026-08-01"), d("2026-09-30"))
        assertTrue(v.size > 7)
        assertTrue(v.none { it.datum.isBefore(d("2026-08-01")) })
        assertEquals(v, v.sortedWith(compareBy<Vorkommen>({ it.datum }, { !it.termin.ganztaegig }, { it.termin.beginnZeit }, { it.termin.titel.lowercase() })))
    }
}
