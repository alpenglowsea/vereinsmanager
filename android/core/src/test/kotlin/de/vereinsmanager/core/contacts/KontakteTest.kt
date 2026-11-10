package de.vereinsmanager.core.contacts

import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime

class KontakteTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 10, 12, 0, 0, 0, ZoneOffset.UTC)
    private val gueltigeIban = "DE89370400440532013000"

    private fun firma(store: InMemoryDocumentStore, name: String = "Sport Schmitt GmbH", nummer: String = "") =
        Kontakte.speichern(
            store,
            Kontakte.neu(store, "supplier").copy(
                id = "c-" + name.hashCode(), nummer = nummer.ifEmpty { Kontakte.naechsteNummer(Kontakte.alle(store)) },
                firma = name, rechtsform = "GmbH", ort = "Neustrelitz", plz = "17235", email = "info@schmitt.de",
            ),
            jetzt,
        )

    private fun buchung(partner: String, betrag: String, art: String = "income", text: String = "", notiz: String = "", datum: String = "2026-03-01") =
        Buchung.from(buildJsonObject {
            put("id", "b-" + partner + datum + text); put("date", datum); put("amount", betrag.toDouble()); put("type", art)
            put("partner", partner); put("bookingText", text); put("notes", notiz)
        })

    // ---- Nummern

    @Test fun ersteNummerIstK1001() = assertEquals("K-1001", Kontakte.naechsteNummer(emptyList()))

    @Test fun naechsteNummerIstHoechstePlusEins() {
        val s = InMemoryDocumentStore()
        firma(s, "A", "K-1005"); firma(s, "B", "K-1002")
        assertEquals("K-1006", Kontakte.naechsteNummer(Kontakte.alle(s)))
    }

    @Test fun nummernNachLoeschenWerdenNichtDoppeltVergeben() {
        val s = InMemoryDocumentStore()
        firma(s, "A"); val b = firma(s, "B"); firma(s, "C")
        Kontakte.loeschen(s, b.id)
        val neu = firma(s, "D")
        assertEquals("K-1004", neu.nummer)
    }

    // ---- Prüfen

    @Test fun pflichtfelderUndTypen() {
        val s = InMemoryDocumentStore()
        val f = Kontakte.neu(s)
        val e = Kontakte.pruefen(s, f)
        assertTrue(e.containsKey("firma")); assertTrue(e.containsKey("typen"))
        val privat = Kontakte.pruefen(s, f.copy(art = "natural", typen = listOf("donor")))
        assertTrue(privat.containsKey("nachname")); assertFalse(privat.containsKey("typen"))
    }

    @Test fun doppelteNummerWirdAbgelehnt() {
        val s = InMemoryDocumentStore()
        val a = firma(s, "A")
        val f = Kontakte.neu(s, "other").copy(firma = "B", nummer = a.nummer.lowercase())
        assertTrue(Kontakte.pruefen(s, f).containsKey("nummer"))
        // der Kontakt selbst darf seine Nummer behalten
        assertFalse(Kontakte.pruefen(s, Kontakte.von(a)).containsKey("nummer"))
    }

    @Test fun ibanBicUndMail() {
        val s = InMemoryDocumentStore()
        val f = Kontakte.neu(s, "other").copy(firma = "X")
        assertTrue(Kontakte.pruefen(s, f.copy(iban = "DE00 1234")).containsKey("iban"))
        assertFalse(Kontakte.pruefen(s, f.copy(iban = "DE89 3704 0044 0532 0130 00")).containsKey("iban"))
        assertTrue(Kontakte.pruefen(s, f.copy(bic = "ABC")).containsKey("bic"))
        assertFalse(Kontakte.pruefen(s, f.copy(bic = "cobadeffxxx")).containsKey("bic"))
        assertTrue(Kontakte.pruefen(s, f.copy(email = "keine mail")).containsKey("email"))
        assertTrue(Kontakte.pruefen(s, f.copy(apEmail = "a@b")).containsKey("apEmail"))
    }

    @Test fun speichernWirftBeiFehler() {
        val s = InMemoryDocumentStore()
        try { Kontakte.speichern(s, Kontakte.neu(s), jetzt); fail() } catch (e: IllegalArgumentException) { assertEquals(0, s.count("contacts")) }
    }

    // ---- Speichern

    @Test fun firmaWirdWieAmDesktopGespeichert() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(
            s, Kontakte.neu(s, "sponsor").copy(
                firma = " Sport Schmitt GmbH ", rechtsform = "GmbH", steuernummer = "12/345", apNachname = "Schmitt", apVorname = "Thomas",
                apFunktion = "Geschäftsführer", iban = "DE89 3704 0044 0532 0130 00", tagsText = "Bande, Trikot ,",
            ),
            jetzt,
        )
        assertEquals("K-1001", k.nummer)
        assertEquals("Sport Schmitt GmbH", k.anzeigeName)
        assertEquals("legal", k.art)
        assertEquals(gueltigeIban, k.iban)
        assertEquals("Sport Schmitt GmbH", k.inhaber) // Kontoinhaber = Name, wenn leer
        assertEquals(listOf("Bande", "Trikot"), k.tags)
        assertEquals("Thomas Schmitt", k.ansprech!!.name)
        assertEquals("Deutschland", k.adresse.land)
        assertEquals("2026-11-10T12:00:00Z", k.erstellt)
    }

    @Test fun privatpersonAnzeigenameMitAnrede() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(s, Kontakte.neu(s, "donor").copy(art = "natural", anrede = "Dr.", vorname = "Markus", nachname = "Weber"), jetzt)
        assertEquals("Dr. Markus Weber", k.anzeigeName)
        assertEquals("", k.firma)
    }

    @Test fun unbekannteFelderBleibenErhalten() {
        val s = InMemoryDocumentStore()
        val k = firma(s)
        val mitExtra = JsonObject(k.roh + mapOf("desktopFeld" to JsonPrimitive("bleibt"), "address" to JsonObject((k.roh["address"] as JsonObject) + mapOf("extra" to JsonPrimitive("x")))))
        s.put("contacts", k.id, mitExtra)
        val f = Kontakte.von(Kontakte.alle(s).first()).copy(telefon = "0171 1")
        val neu = Kontakte.speichern(s, f, jetzt.plusDays(1))
        assertEquals("bleibt", (neu.roh["desktopFeld"] as JsonPrimitive).content)
        assertEquals("x", ((neu.roh["address"] as JsonObject)["extra"] as JsonPrimitive).content)
        assertEquals(k.erstellt, neu.erstellt)
        assertEquals("2026-11-11T12:00:00Z", neu.geaendert)
    }

    @Test fun artWechselEntferntNichtPassendeFelder() {
        val s = InMemoryDocumentStore()
        val k = firma(s)
        val neu = Kontakte.speichern(s, Kontakte.von(k).copy(art = "natural", nachname = "Schmitt"), jetzt)
        assertFalse(neu.roh.containsKey("companyName")); assertFalse(neu.roh.containsKey("legalForm"))
        assertEquals("Schmitt", neu.anzeigeName)
    }

    @Test fun leereOptionaleFelderFehlen() {
        val s = InMemoryDocumentStore()
        val k = firma(s)
        assertFalse(k.roh.containsKey("mobile")); assertFalse(k.roh.containsKey("tags")); assertFalse(k.roh.containsKey("bankDetails"))
        assertFalse(k.roh.containsKey("contactPerson"))
    }

    @Test fun eigeneRechtsformUeberSonstige() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(s, Kontakte.neu(s, "other").copy(firma = "Bund", rechtsform = "Sonstige", rechtsformFrei = "Verein bürgerlichen Rechts"), jetzt)
        assertEquals("Verein bürgerlichen Rechts", k.rechtsform)
        val f = Kontakte.von(k)
        assertEquals("Sonstige", f.rechtsform); assertEquals("Verein bürgerlichen Rechts", f.rechtsformFrei)
    }

    @Test fun sammelLoeschen() {
        val s = InMemoryDocumentStore()
        val a = firma(s, "A"); val b = firma(s, "B"); firma(s, "C")
        Kontakte.sammelLoeschen(s, listOf(a.id, b.id))
        assertEquals(listOf("C"), Kontakte.alle(s).map { it.anzeigeName })
    }

    // ---- Suche und Sortierung

    @Test fun sucheFindetOrtMailTagUndAnsprechpartner() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(s, Kontakte.neu(s, "service").copy(firma = "Farbenfroh", ort = "Waren", tagsText = "Maler", apNachname = "Meier", apFunktion = "Chefin"), jetzt)
        for (q in listOf("waren", "MALER", "meier", "chefin", "k-1001", "farben")) assertTrue(q, Kontakte.passt(k, q))
        assertFalse(Kontakte.passt(k, "xyz"))
        assertTrue(Kontakte.passt(k, "  "))
    }

    @Test fun sortierenNachNummerZaehltNumerisch() {
        val s = InMemoryDocumentStore()
        firma(s, "Zeta", "K-1010"); firma(s, "Alpha", "K-1002"); firma(s, "Mitte", "K-1100")
        assertEquals(listOf("Alpha", "Zeta", "Mitte"), Kontakte.sortieren(Kontakte.alle(s), "number").map { it.anzeigeName })
        assertEquals(listOf("Alpha", "Mitte", "Zeta"), Kontakte.sortieren(Kontakte.alle(s), "name").map { it.anzeigeName })
    }

    // ---- Buchungen

    @Test fun buchungenNurBeiGenauemNamenOderNummer() {
        val s = InMemoryDocumentStore()
        val k = firma(s, "Müller")
        val liste = listOf(
            buchung("müller ", "100", datum = "2026-01-01"),            // Name, Schreibweise egal
            buchung("Müller Bau GmbH", "50"),                           // nur ähnlich: nicht dazu
            buchung("Frau Müller", "20"),                                // nur ähnlich: nicht dazu
            buchung("Sonstiger", "30", text = "Rechnung ${k.nummer}", datum = "2026-02-01"), // Nummer im Text
            buchung("Sonstiger", "40", text = "${k.nummer}9"),          // andere Nummer: nicht dazu
            buchung(k.nummer, "10", datum = "2026-03-01"),               // Nummer als Partner
        )
        val treffer = Kontakte.buchungenVon(k, liste)
        assertEquals(3, treffer.size)
        assertEquals(listOf("2026-03-01", "2026-02-01", "2026-01-01"), treffer.map { it.datum })
    }

    @Test fun bilanzUeberAlleBuchungen() {
        val s = InMemoryDocumentStore()
        val k = firma(s, "Lieferant AG")
        val liste = (1..12).map { buchung("Lieferant AG", "10", art = "expense", datum = "2026-01-%02d".format(it), text = "t$it") } +
            buchung("Lieferant AG", "200", datum = "2026-02-01") +
            buchung("Lieferant AG", "999", art = "transfer", datum = "2026-02-02")
        val b = Kontakte.bilanz(Kontakte.buchungenVon(k, liste))
        assertEquals(13, b.anzahl) // Umbuchung zählt nicht
        assertEquals("200", b.einnahmen.toPlainString().removeSuffix(".0"))
        assertEquals(0, b.ausgaben.compareTo(java.math.BigDecimal(120)))
    }

    // ---- Export

    @Test fun csvHat24SpaltenUndEineZeile() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(s, Kontakte.neu(s, "sponsor").copy(firma = "=Böse;Firma", rechtsform = "GmbH", notizen = "a\nb"), jetzt)
        val zeilen = Kontakte.csvDateiInhalt(listOf(k)).removePrefix("﻿").split("\r\n")
        assertEquals(2, zeilen.size)
        assertEquals(24, Kontakte.CSV_SPALTEN.size)
        assertEquals(Kontakte.CSV_SPALTEN.joinToString(";"), zeilen[0])
        assertTrue(zeilen[1].contains("\"'=Böse;Firma\"")) // Formel entschärft und gequotet
        assertTrue(zeilen[1].contains(";a b;")) // Zeilenumbruch -> Leerzeichen
        assertTrue(zeilen[1].startsWith("K-1001;Juristische Person (Firma / Organisation);"))
    }

    @Test fun csvOhneKontakteIstLeer() = assertEquals("﻿", Kontakte.csvDateiInhalt(emptyList()))

    @Test fun pdfTabelleSpaltenUndBreiten() {
        val s = InMemoryDocumentStore()
        val k = Kontakte.speichern(s, Kontakte.neu(s, "supplier").copy(firma = "Schmitt", rechtsform = "GmbH", iban = gueltigeIban, apNachname = "S", apVorname = "T"), jetzt)
        val t = Kontakte.pdfTabelle(listOf(k), "TSV", LocalDate.of(2026, 11, 10))
        assertEquals(269, t.breiten.sum())
        assertEquals(t.spalten.size, t.zeilen.first().size)
        assertEquals("Schmitt (GmbH)", t.zeilen.first()[1])
        assertEquals("DE893704...", t.zeilen.first().last())
        assertEquals("Stand: 10.11.2026 | Gesamt: 1 Kontakte", t.kopfRechts)
    }

    @Test fun dateinamen() {
        assertEquals("kontakte_TSV_Muster_2026-11-10.csv", Kontakte.csvDateiname("TSV Muster", LocalDate.of(2026, 11, 10)))
    }

    @Test fun leerDefaultsNull() = assertNull(Kontakte.von(buildJsonObject { put("id", "x") }).ansprech)
}
