package de.vereinsmanager.core.settings

import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.files.putBytes
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
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime

class EinstellungenTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 14, 9, 30, 0, 0, ZoneOffset.UTC)

    private fun speicher(vararg sparten: String) = InMemoryDocumentStore().also {
        it.put("settings", "main", buildJsonObject {
            put("id", "main"); put("clubName", "TSV"); put("taxNumber", "12/345")
            put("departments", JsonArray(sparten.map { s -> JsonPrimitive(s) }))
        })
    }

    private fun fehler(block: () -> Unit): String = try { block(); fail("Es hätte eine Ausnahme geben müssen"); "" } catch (e: IllegalArgumentException) { e.message.orEmpty() }

    // ---------------------------------------------------------------- Sparten

    @Test
    fun spartenAnlegenPruefenUndFremdesBleibt() {
        val s = speicher("Fußball")
        assertEquals(listOf("Fußball", "Tennis"), Sparten.hinzufuegen(s, "  Tennis ", jetzt))
        assertTrue(fehler { Sparten.hinzufuegen(s, "tennis", jetzt) }.contains("gibt es schon"))
        assertTrue(fehler { Sparten.hinzufuegen(s, "   ", jetzt) }.contains("Namen"))
        assertTrue(fehler { Sparten.hinzufuegen(s, "x".repeat(61), jetzt) }.contains("zu lang"))
        val d = s.get("settings", "main")!!
        assertEquals("12/345", (d["taxNumber"] as JsonPrimitive).content)
        assertEquals("TSV", (d["clubName"] as JsonPrimitive).content)
    }

    @Test
    fun spartenLegtEinenNeuenVereinOhneEinstellungenAn() {
        val s = InMemoryDocumentStore()
        assertEquals(listOf("Fußball"), Sparten.hinzufuegen(s, "Fußball", jetzt))
        assertEquals("main", (s.get("settings", "main")!!["id"] as JsonPrimitive).content)
    }

    @Test
    fun spartenLoeschenNurWennNirgendsGebraucht() {
        val s = speicher("Fußball", "Tennis", "Chor")
        s.put("members", "m1", buildJsonObject { put("id", "m1"); put("department", "Tennis") })
        s.put("transactions", "t1", buildJsonObject { put("id", "t1"); put("department", "Tennis") })
        s.put("transactions", "t2", buildJsonObject { put("id", "t2"); put("department", "Tennis") })
        s.put("inventory", "i1", buildJsonObject { put("id", "i1"); put("department", "Tennis") })
        val v = Sparten.verwendung(s, "Tennis")
        assertEquals(1, v.mitglieder); assertEquals(2, v.buchungen); assertEquals(1, v.inventar)
        assertEquals("1 Mitglied, 2 Buchungen, 1 Inventargegenstand", v.text())
        val msg = fehler { Sparten.loeschen(s, "Tennis", jetzt) }
        assertTrue(msg, msg.contains("noch verwendet") && msg.contains("1 Mitglied"))
        assertEquals(listOf("Fußball", "Tennis", "Chor"), Sparten.lesen(s))
        assertEquals(listOf("Fußball", "Tennis"), Sparten.loeschen(s, "Chor", jetzt))
    }

    @Test
    fun spartenLetzteBleibt() {
        val s = speicher("Hauptverein")
        assertTrue(fehler { Sparten.loeschen(s, "Hauptverein", jetzt) }.contains("Mindestens eine"))
    }

    @Test
    fun spartenUmbenennenZiehtAllesMit() {
        val s = speicher("Fußball", "Tennis")
        s.put("members", "m1", buildJsonObject { put("id", "m1"); put("department", "Tennis"); put("lastName", "A") })
        s.put("members", "m2", buildJsonObject { put("id", "m2"); put("department", "Fußball") })
        s.put("transactions", "t1", buildJsonObject { put("id", "t1"); put("department", "Tennis"); put("amount", 5) })
        s.put("inventory", "i1", buildJsonObject { put("id", "i1"); put("department", "Tennis") })
        assertEquals(listOf("Fußball", "Tischtennis"), Sparten.umbenennen(s, "Tennis", "Tischtennis", jetzt))
        assertEquals("Tischtennis", (s.get("members", "m1")!!["department"] as JsonPrimitive).content)
        assertEquals("A", (s.get("members", "m1")!!["lastName"] as JsonPrimitive).content)
        assertEquals("Fußball", (s.get("members", "m2")!!["department"] as JsonPrimitive).content)
        assertEquals("Tischtennis", (s.get("transactions", "t1")!!["department"] as JsonPrimitive).content)
        assertEquals("Tischtennis", (s.get("inventory", "i1")!!["department"] as JsonPrimitive).content)
        assertTrue(fehler { Sparten.umbenennen(s, "Tischtennis", "fußball", jetzt) }.contains("gibt es schon"))
        // Nur Groß-/Kleinschreibung ändern ist erlaubt
        assertEquals(listOf("Fußball", "TischTennis"), Sparten.umbenennen(s, "Tischtennis", "TischTennis", jetzt))
    }

    @Test
    fun spartenUmbenennenScheitertGanzOderGarNicht() {
        val s = speicher("A", "B")
        s.put("members", "m1", buildJsonObject { put("id", "m1"); put("department", "A") })
        fehler { Sparten.umbenennen(s, "A", "B", jetzt) }
        assertEquals("A", (s.get("members", "m1")!!["department"] as JsonPrimitive).content)
        assertEquals(listOf("A", "B"), Sparten.lesen(s))
    }

    @Test
    fun spartenVerschieben() {
        val s = speicher("A", "B", "C")
        assertEquals(listOf("B", "A", "C"), Sparten.verschieben(s, "A", +1, jetzt))
        assertEquals(listOf("B", "A", "C"), Sparten.verschieben(s, "B", -1, jetzt)) // schon oben
        assertEquals(listOf("B", "A", "C"), Sparten.verschieben(s, "C", +1, jetzt)) // schon unten
        assertEquals(listOf("B", "C", "A"), Sparten.verschieben(s, "C", -1, jetzt))
    }

    // ---------------------------------------------------------------- Vorstand

    @Test
    fun vorstandFunktionWirdAmWortlautErkannt() {
        assertTrue(Vorstand.istVorsitz("1. Vorsitzender"))
        assertTrue(Vorstand.istVorsitz("Vorsitzende"))
        assertTrue(Vorstand.istVorsitz("Präsidentin"))
        assertFalse(Vorstand.istVorsitz("2. Vorsitzender"))
        assertFalse(Vorstand.istVorsitz("Stellv. Vorsitzende"))
        assertFalse(Vorstand.istVorsitz("Jugendvorsitzender"))
        assertFalse(Vorstand.istVorsitz("Schriftführer"))
        assertTrue(Vorstand.istKasse("Schatzmeisterin / Kassenwart"))
        assertTrue(Vorstand.istKasse("Kassier"))
        assertFalse(Vorstand.istKasse("Kassenprüfer/in"))
        assertFalse(Vorstand.istKasse("Stellv. Kassenwart"))
        assertFalse(Vorstand.istKasse("Beisitzer"))
        for (f in Vorstand.FUNKTIONEN) assertFalse(f, Vorstand.istVorsitz(f) && Vorstand.istKasse(f))
    }

    @Test
    fun vorstandPositionInDerListeSpieltKeineRolle() {
        // Am Desktop würde hier der Kassenprüfer (Platz 2) zum Kassenwart und der Stellvertreter (Platz 1) zum Vorsitzenden.
        val liste = listOf(
            Vorstandsmitglied("a", "Stellv. Vorsitzender", "Stefan Stellv"),
            Vorstandsmitglied("b", "Kassenprüferin", "Petra Prüf"),
            Vorstandsmitglied("c", "1. Vorsitzende", "Vera Vorsitz"),
            Vorstandsmitglied("d", "Schatzmeister", "Kurt Kasse"),
        )
        assertEquals("Vera Vorsitz", Vorstand.vorsitz(liste))
        assertEquals("Kurt Kasse", Vorstand.kasse(liste))
    }

    @Test
    fun vorstandSpeichernLeitetAbUndBehaeltFremdes() {
        val s = speicher("Fußball")
        val liste = listOf(
            Vorstandsmitglied("a", " 1. Vorsitzende/r ", " Vera Vorsitz ", email = "vera@x.de"),
            Vorstandsmitglied("b", "Kassenwart / Schatzmeister", "Kurt Kasse", telefon = "0123"),
            Vorstandsmitglied("leer", "", ""),
        )
        val gelesen = Vorstand.speichern(s, liste, jetzt)
        assertEquals(2, gelesen.size)
        assertEquals("Vera Vorsitz", gelesen[0].name)
        assertEquals("vera@x.de", gelesen[0].email)
        assertEquals("0123", gelesen[1].telefon)
        val d = s.get("settings", "main")!!
        assertEquals("Vera Vorsitz", (d["chairman"] as JsonPrimitive).content)
        assertEquals("Kurt Kasse", (d["treasurer"] as JsonPrimitive).content)
        assertEquals("12/345", (d["taxNumber"] as JsonPrimitive).content)
        assertEquals("Fußball", Sparten.lesen(s).single())
        // Vereinsdaten lesen dieselben Namen
        val f = Vereinsdaten.lesen(s)
        assertEquals("Vera Vorsitz", f.vorsitzender); assertEquals("Kurt Kasse", f.kassenwart)
    }

    @Test
    fun vorstandOhneKassenwartLeertDasFeldUndWarnt() {
        val s = speicher()
        Vorstand.speichern(s, listOf(Vorstandsmitglied("a", "Vorsitzender", "Vera"), Vorstandsmitglied("b", "Kassenwart", "Kurt")), jetzt)
        val ohne = listOf(Vorstandsmitglied("a", "Vorsitzender", "Vera"))
        assertEquals(1, Vorstand.hinweise(ohne).size)
        Vorstand.speichern(s, ohne, jetzt)
        assertEquals("", (s.get("settings", "main")!!["treasurer"] as JsonPrimitive).content)
        assertEquals(2, Vorstand.hinweise(emptyList()).size)
    }

    @Test
    fun vorstandPruefen() {
        val e = Vorstand.pruefen(listOf(
            Vorstandsmitglied("a", "Beisitzer", ""),
            Vorstandsmitglied("b", "", "Hans"),
            Vorstandsmitglied("c", "Beisitzer", "Eva", email = "keine-mail"),
            Vorstandsmitglied("d", "Beisitzer", "Ida", email = "ida@x.de"),
            Vorstandsmitglied("e", "", ""),
        ))
        assertEquals(setOf("a", "b", "c"), e.keys)
        assertTrue(fehler { Vorstand.speichern(speicher(), listOf(Vorstandsmitglied("a", "Beisitzer", "")), jetzt) }.contains("Namen"))
    }

    @Test
    fun vorstandAusAltemBestandOhneListe() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", buildJsonObject { put("id", "main"); put("chairman", "Dr. Sommer"); put("treasurer", "Sabine Weber") })
        val liste = Vorstand.lesen(s)
        assertEquals(listOf("Dr. Sommer" to "1. Vorsitzende/r", "Sabine Weber" to "Kassenwart / Schatzmeister"), liste.map { it.name to it.funktion })
        // Erst-Speichern der abgeleiteten Liste ändert Vorsitz und Kasse nicht
        Vorstand.speichern(s, liste, jetzt)
        assertEquals("Dr. Sommer", Vereinsdaten.lesen(s).vorsitzender)
        assertEquals("Sabine Weber", Vereinsdaten.lesen(s).kassenwart)
        assertTrue(Vorstand.lesen(InMemoryDocumentStore()).isEmpty())
    }

    @Test
    fun vorstandVomDesktopWirdGelesen() {
        val s = InMemoryDocumentStore()
        s.put("settings", "main", buildJsonObject {
            put("id", "main")
            put("boardMembers", JsonArray(listOf(
                buildJsonObject { put("id", "bm-1"); put("role", "1. Vorsitzender"); put("name", "Dr. Michael Sommer"); put("email", "v@x.de") },
                buildJsonObject { put("id", "bm-4"); put("role", "Schriftführerin"); put("name", "Claudia Schmidt"); put("phone", "555") },
            )))
        })
        val l = Vorstand.lesen(s)
        assertEquals(2, l.size)
        assertEquals("v@x.de", l[0].email); assertEquals("555", l[1].telefon)
    }

    // ---------------------------------------------------------------- Telefon / Webseite

    @Test
    fun telefonUndWebseiteWerdenGespeichertUndGelesen() {
        val s = speicher("A")
        val f = Vereinsdaten.speichern(s, Vereinsdaten.lesen(s).copy(telefon = " 0381 123 ", webseite = "https://tsv.example"), jetzt)
        assertEquals("0381 123", f.telefon); assertEquals("https://tsv.example", f.webseite)
        assertEquals("A", Sparten.lesen(s).single())
    }

    // ---------------------------------------------------------------- Schnappschüsse

    @Test
    fun schnappschussNamenSindUmkehrbar() {
        for (g in SchnappGrund.values()) {
            val n = Schnappschuesse.dateiname(jetzt, g)
            val e = Schnappschuesse.lesen(n)!!
            assertEquals(g, e.grund)
            assertEquals(LocalDateTime.of(2026, 11, 14, 9, 30, 0), e.zeit)
        }
        assertEquals("schnappschuss_2026-11-14_09-30-00_auto.zip", Schnappschuesse.dateiname(jetzt, SchnappGrund.AUTOMATISCH))
        assertNull(Schnappschuesse.lesen("irgendwas.zip"))
        assertNull(Schnappschuesse.lesen("schnappschuss_2026-13-40_99-99-99_auto.zip"))
        assertNull(Schnappschuesse.lesen("schnappschuss_2026-11-14_09-30-00_unbekannt.zip"))
    }

    @Test
    fun schnappschussAlterNameWirdUebernommen() {
        assertEquals("schnappschuss_2026-11-09_10-00-00_import.zip", Schnappschuesse.ausAltemNamen("vor_import_2026-11-09_10-00-00.zip"))
        assertNull(Schnappschuesse.ausAltemNamen("foto.zip"))
        assertEquals(SchnappGrund.VOR_IMPORT, Schnappschuesse.lesen(Schnappschuesse.ausAltemNamen("vor_import_2026-11-09_10-00-00.zip")!!)!!.grund)
    }

    @Test
    fun schnappschussAufraeumenTrenntAutomatischUndAndere() {
        val auto = (1..10).map { Schnappschuesse.dateiname(jetzt.minusDays(it.toLong()), SchnappGrund.AUTOMATISCH) }
        val vorImport = Schnappschuesse.dateiname(jetzt.minusDays(30), SchnappGrund.VOR_IMPORT) // uralt, muss trotzdem bleiben
        val weg = Schnappschuesse.ueberzaehlige(auto + vorImport)
        assertEquals(3, weg.size)
        assertEquals(auto.takeLast(3).toSet(), weg.toSet())
        assertFalse(vorImport in weg)
        val viele = (1..7).map { Schnappschuesse.dateiname(jetzt.minusHours(it.toLong()), SchnappGrund.MANUELL) }
        assertEquals(setOf(viele[5], viele[6]), Schnappschuesse.ueberzaehlige(viele).toSet())
        assertTrue(Schnappschuesse.ueberzaehlige(listOf("fremd.zip")).isEmpty())
    }

    @Test
    fun schnappschussFaelligNachEinemTag() {
        val jetztL = jetzt.toLocalDateTime()
        assertTrue(Schnappschuesse.faellig(emptyList(), jetztL))
        val vor5h = Schnappschuesse.dateiname(jetzt.minusHours(5), SchnappGrund.AUTOMATISCH)
        val vor21h = Schnappschuesse.dateiname(jetzt.minusHours(21), SchnappGrund.AUTOMATISCH)
        assertFalse(Schnappschuesse.faellig(listOf(vor5h), jetztL))
        assertTrue(Schnappschuesse.faellig(listOf(vor21h), jetztL))
        // Ein Schnappschuss vor einem Import zählt nicht als Tagessicherung
        assertTrue(Schnappschuesse.faellig(listOf(Schnappschuesse.dateiname(jetzt.minusHours(1), SchnappGrund.VOR_IMPORT)), jetztL))
        // Von Hand angelegt zählt
        assertFalse(Schnappschuesse.faellig(listOf(Schnappschuesse.dateiname(jetzt.minusHours(1), SchnappGrund.MANUELL), vor21h), jetztL))
    }

    // ---------------------------------------------------------------- Alles löschen

    @Test
    fun alleDatenLoeschenLeertBestandUndDateien() {
        val s = speicher("A")
        s.put("members", "m1", buildJsonObject { put("id", "m1") })
        s.put("documents", "d1", buildJsonObject { put("id", "d1") })
        s.put("dashboardConfig", "main_dashboard", buildJsonObject { put("id", "main_dashboard") })
        val f = InMemoryFileStore().also { it.putBytes("f1", byteArrayOf(1, 2, 3)) }
        Zuruecksetzen.alles(s, f)
        assertEquals(0, s.count("members")); assertEquals(0, s.count("documents")); assertEquals(0, s.count("settings"))
        assertEquals(0, s.count("dashboardConfig"))
        assertTrue(f.ids().isEmpty())
    }

    @Test
    fun loeschenBrauchtDasBestaetigungswort() {
        assertTrue(Zuruecksetzen.bestaetigt("LÖSCHEN"))
        assertTrue(Zuruecksetzen.bestaetigt("  löschen "))
        assertFalse(Zuruecksetzen.bestaetigt("loeschen"))
        assertFalse(Zuruecksetzen.bestaetigt(""))
    }

    // ---------------------------------------------------------------- Fehlerbericht

    @Test
    fun fehlerberichtPruefenUndText() {
        val e = Fehlerbericht.Eingabe("Finanzen", " Betrag falsch ", "Daten sind falsch oder fehlen", "  Beim Buchen ... ")
        assertNull(Fehlerbericht.pruefen(e))
        assertTrue(Fehlerbericht.pruefen(e.copy(betreff = " ")) != null)
        assertTrue(Fehlerbericht.pruefen(e.copy(beschreibung = "")) != null)
        assertEquals("[Bugreport Android - Finanzen] Betrag falsch", Fehlerbericht.betreff(e))
        val t = Fehlerbericht.text(e, "App 1.0, Android 15")
        assertTrue(t.startsWith("Bereich: Finanzen"))
        assertTrue(t.contains("System: App 1.0, Android 15"))
        assertTrue(t.endsWith("Beim Buchen ..."))
        assertTrue("@" in Fehlerbericht.EMPFAENGER)
    }
}
