package de.vereinsmanager.core.inventory

import de.vereinsmanager.core.members.AusgabeForm
import de.vereinsmanager.core.members.MemberMaterial
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class InventarTest {
    private val heute = LocalDate.of(2026, 11, 12)
    private val jetzt = ZonedDateTime.of(2026, 11, 12, 20, 0, 0, 0, ZoneOffset.UTC)

    private fun form(name: String, nummer: String, vorlage: ArtikelForm = ArtikelForm()) = vorlage.copy(name = name, nummer = nummer)

    private fun store(vararg f: ArtikelForm): InMemoryDocumentStore {
        val s = InMemoryDocumentStore()
        f.forEach { Inventar.speichern(s, it, jetzt) }
        return s
    }

    private fun fehlerText(block: () -> Unit): String = try { block(); fail("erwartet: Fehler"); "" } catch (e: IllegalArgumentException) { e.message ?: "" }

    @Test fun naechsteNummerFolgtDemSchemaDesVereins() {
        assertEquals("INV-001", Inventar.naechsteNummer(emptyList()))
        val s = store(form("Ball", "INV-FB-001"), form("Tor", "INV-FB-002"))
        assertEquals("INV-FB-003", Inventar.naechsteNummer(Inventar.alle(s)))
        assertEquals("INV-FB-003", Inventar.neu(Inventar.alle(s)).nummer)
    }

    @Test fun pruefenMeldetPflichtfelderDoppelteNummerUndZahlen() {
        val s = store(form("Ball", "INV-1"))
        val vorhanden = Inventar.alle(s)
        val e = Inventar.pruefen(ArtikelForm(name = " ", nummer = "inv-1", menge = "0", kaufpreis = "abc", zeitwert = "-5", kaufdatum = "2026-13-01"), vorhanden)
        assertEquals(setOf("name", "nummer", "menge", "kaufpreis", "zeitwert", "kaufdatum"), e.keys)
        // Beim Bearbeiten ist die eigene Nummer erlaubt.
        val eigene = ArtikelForm.von(vorhanden.single())
        assertTrue(Inventar.pruefen(eigene, vorhanden).isEmpty())
        assertTrue(Inventar.pruefen(form("Tor", "INV-2", ArtikelForm(kaufpreis = "1.234,50", zeitwert = "0")), vorhanden).isEmpty())
    }

    @Test fun deutscheZahlenWerdenRichtigGespeichertUndNullIstEinWert() {
        val s = store(form("Tor", "INV-1", ArtikelForm(kaufpreis = "1.234,50", zeitwert = "0", standort = "")))
        val a = Inventar.alle(s).single()
        assertEquals(BigDecimal("1234.5"), a.kaufpreis)
        assertEquals(0, a.zeitwert!!.compareTo(BigDecimal.ZERO))
        assertEquals(0, a.wert.compareTo(BigDecimal.ZERO)) // Zeitwert 0 gilt, es wird nicht auf den Kaufpreis ausgewichen
        assertEquals("", a.standort) // kein erfundener Standort
        assertEquals("1234,5", ArtikelForm.von(a).kaufpreis)
    }

    @Test fun bearbeitenBehaeltUnbekannteFelderUndAnlegedatum() {
        val s = store(form("Tor", "INV-1"))
        val id = Inventar.alle(s).single().id
        val alt = s.get(Inventar.AREA, id)!!
        s.put(Inventar.AREA, id, JsonObject(alt + ("sonderfeld" to JsonPrimitive("bleibt"))))
        val spaeter = ZonedDateTime.of(2026, 11, 13, 9, 0, 0, 0, ZoneOffset.UTC)
        Inventar.speichern(s, ArtikelForm.von(Inventar.artikel(s, id)!!).copy(menge = "4", zustaendig = "Max"), spaeter)
        val neu = s.get(Inventar.AREA, id)!!
        assertEquals("bleibt", (neu["sonderfeld"] as JsonPrimitive).content)
        assertEquals((alt["createdAt"] as JsonPrimitive).content, (neu["createdAt"] as JsonPrimitive).content)
        assertTrue((neu["updatedAt"] as JsonPrimitive).content.startsWith("2026-11-13"))
        assertEquals(4, Inventar.artikel(s, id)!!.menge)
        assertEquals(1, Inventar.alle(s).size)
    }

    @Test fun speichernMitFehlerSchreibtNichts() {
        val s = store(form("Ball", "INV-1"))
        assertTrue(fehlerText { Inventar.speichern(s, form("Tor", "INV-1"), jetzt) }.contains("schon"))
        assertEquals(1, Inventar.alle(s).size)
    }

    @Test fun kennzahlenZaehlenAusgemustertesNichtUndRechnenMitMenge() {
        val s = store(
            form("Ball", "A", ArtikelForm(menge = "10", zeitwert = "5", kaufpreis = "9", sparte = "Fußball", naechstePruefung = "2026-11-01")),
            form("Tor", "B", ArtikelForm(menge = "2", kaufpreis = "100", zustand = "damaged", sparte = "Tennis")),
            form("Alt", "C", ArtikelForm(menge = "7", zeitwert = "50", zustand = "discarded", naechstePruefung = "2020-01-01")),
        )
        val k = Inventar.kennzahlen(Inventar.alle(s), heute)
        assertEquals(2, k.positionen)
        assertEquals(12, k.einheiten)
        assertEquals(0, k.wert.compareTo(BigDecimal("250"))) // 10*5 + 2*100
        assertEquals(2, k.sparten)
        assertEquals(1, k.reparatur)
        assertEquals(1, k.ueberfaellig)
    }

    @Test fun filternBlendetAusgemustertesStandardmaessigAus() {
        val s = store(
            form("Ball", "A", ArtikelForm(sparte = "Fußball", standort = "Keller", naechstePruefung = "2026-11-30")),
            form("Tor", "B", ArtikelForm(sparte = "Tennis", art = "facility", zustand = "in_repair", naechstePruefung = "2027-05-01")),
            form("Alt", "C", ArtikelForm(zustand = "discarded", naechstePruefung = "2020-01-01")),
        )
        val alle = Inventar.alle(s)
        assertEquals(listOf("Ball", "Tor"), Inventar.filtern(alle, InventarFilter(), heute = heute).map { it.name })
        assertEquals(listOf("Alt"), Inventar.filtern(alle, InventarFilter(zustand = "discarded"), heute = heute).map { it.name })
        assertEquals(listOf("Ball"), Inventar.filtern(alle, InventarFilter(suche = "kell"), heute = heute).map { it.name })
        assertEquals(listOf("Tor"), Inventar.filtern(alle, InventarFilter(sparte = "Tennis"), heute = heute).map { it.name })
        assertEquals(listOf("Tor"), Inventar.filtern(alle, InventarFilter(art = "facility"), heute = heute).map { it.name })
        // Prüfung in 30 Tagen oder überfällig; Ausgemustertes nie
        assertEquals(listOf("Ball"), Inventar.filtern(alle, InventarFilter(nurPruefung = true), heute = heute).map { it.name })
    }

    @Test fun sortierenNachWertUndName() {
        val s = store(form("Zelt", "A", ArtikelForm(zeitwert = "10")), form("Ärmel", "B", ArtikelForm(zeitwert = "30")), form("Mütze", "C", ArtikelForm(zeitwert = "20")))
        val alle = Inventar.alle(s)
        assertEquals(listOf("Ärmel", "Mütze", "Zelt"), Inventar.filtern(alle, InventarFilter(), InventarSort.NAME).map { it.name })
        assertEquals(listOf("Ärmel", "Mütze", "Zelt"), Inventar.filtern(alle, InventarFilter(), InventarSort.WERT, aufsteigend = false).map { it.name })
        assertEquals(listOf("Zelt", "Mütze", "Ärmel"), Inventar.filtern(alle, InventarFilter(), InventarSort.WERT).map { it.name })
    }

    @Test fun loeschenSperrtNochAusgegebeneGegenstaende() {
        val s = store(form("Trikot", "A", ArtikelForm(menge = "5")), form("Ball", "B"), form("Tor", "C"))
        val trikot = Inventar.alle(s).first { it.name == "Trikot" }
        val ausgabe = MemberMaterial.speichern(s, "m1", AusgabeForm(itemId = trikot.id, quantity = "3"), heute, jetzt)
        assertEquals(mapOf(trikot.id to 3), Inventar.ausgegeben(s))
        val r = Inventar.loeschen(s, Inventar.alle(s).map { it.id })
        assertEquals(2, r.geloescht)
        assertEquals(listOf("Trikot" to 3), r.gesperrt)
        assertEquals(listOf("Trikot"), Inventar.alle(s).map { it.name })
        // Nach der Rückgabe darf es weg.
        MemberMaterial.umschalten(s, (ausgabe["id"] as JsonPrimitive).content, heute, jetzt)
        assertTrue(Inventar.ausgegeben(s).isEmpty())
        assertEquals(1, Inventar.loeschen(s, listOf(trikot.id)).geloescht)
        assertTrue(Inventar.alle(s).isEmpty())
    }

    @Test fun ausgemusterteGegenstaendeWerdenNichtMehrZurAusgabeAngeboten() {
        val s = store(form("Ball", "A"), form("Alt", "B", ArtikelForm(zustand = "discarded")))
        assertEquals(listOf("Ball"), MemberMaterial.gegenstaende(s).map { it.name })
    }

    @Test fun sammelAenderungLeertFreiwilligeFelderHaeltStandortUndZaehltEchteAenderungen() {
        val s = store(
            form("Ball", "A", ArtikelForm(zustaendig = "Max", einsatz = "U15", notizen = "alt")),
            form("Tor", "B", ArtikelForm(zustaendig = "", einsatz = "")),
        )
        val ids = Inventar.alle(s).map { it.id }
        assertEquals(1, Inventar.sammelAendern(s, ids, SammelAenderung(zustaendig = "")))
        assertEquals("", Inventar.alle(s).first { it.name == "Ball" }.zustaendig)
        assertEquals("Bitte mindestens eine Änderung wählen.", fehlerText { Inventar.sammelAendern(s, ids, SammelAenderung()) })
        assertEquals("Der Standort darf nicht leer sein.", fehlerText { Inventar.sammelAendern(s, ids, SammelAenderung(standort = " ")) })
        assertEquals(2, Inventar.sammelAendern(s, ids, SammelAenderung(zustand = "used", standort = "Halle")))
        assertEquals(setOf("used"), Inventar.alle(s).map { it.zustand }.toSet())
        assertEquals(0, Inventar.sammelAendern(s, ids, SammelAenderung(zustand = "used")))
        Inventar.sammelAendern(s, ids, SammelAenderung(notizText = "neu"))
        assertEquals("alt\nneu", Inventar.alle(s).first { it.name == "Ball" }.notizen)
        assertEquals("neu", Inventar.alle(s).first { it.name == "Tor" }.notizen)
        Inventar.sammelAendern(s, ids, SammelAenderung(notizText = "nur", notizAnhaengen = false))
        assertEquals(setOf("nur"), Inventar.alle(s).map { it.notizen }.toSet())
    }

    @Test fun geprueftSetztNurDasPruefdatum() {
        val s = store(form("Ball", "A", ArtikelForm(naechstePruefung = "2026-12-01")))
        val id = Inventar.alle(s).single().id
        Inventar.geprueft(s, id, heute, jetzt)
        val a = Inventar.artikel(s, id)!!
        assertEquals("2026-11-12", a.letztePruefung)
        assertEquals("2026-12-01", a.naechstePruefung)
    }

    @Test fun csvUndPdfRechnenEinheitlichMitMenge() {
        val s = store(
            form("Ball", "A", ArtikelForm(menge = "10", zeitwert = "5", kaufpreis = "9")),
            form("Alt", "B", ArtikelForm(menge = "3", zeitwert = "100", zustand = "discarded")),
        )
        val liste = Inventar.alle(s).sortedBy { it.name }
        val zeilen = Inventar.csv(liste).trimStart('﻿').split("\r\n")
        assertEquals(3, zeilen.size)
        assertEquals(Inventar.CSV_KOPF.size, zeilen[1].split(";").size)
        val p = Inventar.pdf(liste, "TSV", "Inventarliste", heute)
        assertEquals(269, p.breiten.sum())
        assertEquals(p.spalten.size, p.breiten.size)
        p.zeilen.forEach { assertEquals(p.spalten.size, it.size) }
        assertEquals(setOf(p.zeilen.lastIndex), p.fett)
        assertEquals("50,00", p.zeilen.last()[6]) // nur der Ball: 10 × 5, Ausgemustertes nicht
        assertNull(p.zeilen.last().getOrNull(9))
        assertFalse(Inventar.WERT_HINWEIS.isEmpty())
    }

    @Test fun ausgemustertAmWieAmDesktop() {
        // Ausmustern ohne Datum: heute; mit Datum: dieses
        val s = store(form("Mäher", "A", ArtikelForm(zustand = "discarded")), form("Netz", "B", ArtikelForm(zustand = "discarded", ausgemustertAm = "2024-05-05")))
        val (maeher, netz) = Inventar.alle(s).sortedBy { it.nummer }
        assertEquals("2026-11-12", maeher.ausgemustertAm)
        assertEquals("2024-05-05", netz.ausgemustertAm)
        // Unverändert gespeichert: das Datum bleibt; zurück in Gebrauch: es verschwindet
        Inventar.speichern(s, ArtikelForm.von(netz).copy(ausgemustertAm = ""), jetzt)
        assertEquals("2024-05-05", Inventar.artikel(s, netz.id)!!.ausgemustertAm)
        Inventar.speichern(s, ArtikelForm.von(netz).copy(zustand = "used"), jetzt)
        assertFalse(Inventar.artikel(s, netz.id)!!.raw.containsKey("retiredAt"))
        // Sammelbearbeitung setzt und entfernt es ebenso
        Inventar.sammelAendern(s, listOf(netz.id), SammelAenderung(zustand = "discarded"), jetzt)
        assertEquals("2026-11-12", Inventar.artikel(s, netz.id)!!.ausgemustertAm)
        Inventar.sammelAendern(s, listOf(maeher.id), SammelAenderung(zustand = "good"), jetzt)
        assertFalse(Inventar.artikel(s, maeher.id)!!.raw.containsKey("retiredAt"))
    }

    @Test fun ausgemustertAmWirdGeprueft() {
        val f = ArtikelForm(name = "Alt", nummer = "X", zustand = "discarded", kaufdatum = "2020-01-01")
        assertEquals("Das Datum liegt in der Zukunft.", Inventar.pruefen(f.copy(ausgemustertAm = "2026-11-13"), emptyList(), heute)["ausgemustertAm"])
        assertEquals("Ausgemustert vor dem Kaufdatum?", Inventar.pruefen(f.copy(ausgemustertAm = "2019-12-31"), emptyList(), heute)["ausgemustertAm"])
        assertEquals("Datum ist ungültig.", Inventar.pruefen(f.copy(ausgemustertAm = "2026-13-01"), emptyList(), heute)["ausgemustertAm"])
        assertTrue(Inventar.pruefen(f.copy(ausgemustertAm = "2024-06-30"), emptyList(), heute).isEmpty())
        assertTrue(Inventar.pruefen(f.copy(zustand = "used", ausgemustertAm = "quatsch"), emptyList(), heute).isEmpty())
    }
}
