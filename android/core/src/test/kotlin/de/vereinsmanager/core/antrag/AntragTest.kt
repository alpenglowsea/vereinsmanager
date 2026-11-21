package de.vereinsmanager.core.antrag

import de.vereinsmanager.core.documents.Dokumente
import de.vereinsmanager.core.donation.Unterschrift
import de.vereinsmanager.core.donation.Zeichnung
import de.vereinsmanager.core.files.InMemoryFileStore
import de.vereinsmanager.core.invoice.Mass
import de.vereinsmanager.core.members.Member
import de.vereinsmanager.core.members.MemberStore
import de.vereinsmanager.core.settings.VereinsForm
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AntragTest {
    private val heute = LocalDate.of(2026, 11, 12)
    private val sparten = listOf("Fußball", "Tennis")
    private val unterschrift = Unterschrift(2.0, listOf(listOf(0.1 to 0.5, 0.5 to 0.2, 0.9 to 0.6)))
    private val mass = Mass { text, pt, _ -> text.length * pt * 0.19 }
    private val verein = VereinsForm(name = "TSV Test e.V.", strasse = "Sportweg", hausnummer = "1", plz = "12345", ort = "Testheim", glaeubigerId = "DE98ZZZ09999999999")

    private fun erwachsener(sepa: Boolean = true) = Antrag(
        vorname = "Anna", nachname = "Muster", geschlecht = "w", geburtsdatum = "1990-05-01", strasse = "Weg", hausnummer = "3", plz = "11111", ort = "Ort",
        sparte = "Fußball", mitgliedsart = "full", eintritt = "2026-11-12",
        zahlungsart = if (sepa) "sepa" else "transfer", iban = if (sepa) "DE89 3704 0044 0532 0130 00" else "", kontoinhaber = if (sepa) "Anna Muster" else "",
        datenschutz = true, satzung = true, unterschrift = unterschrift,
    )

    private fun fehler(seite: Int, a: Antrag) = AntragRegeln.fehler(seite, a, heute, sparten)

    // ---------- Regeln

    @Test fun vollstaendigerAntragHatKeineFehler() {
        for (s in 1..5) assertEquals("Seite $s", emptyMap<String, String>(), fehler(s, erwachsener()))
        assertNull(AntragRegeln.ersteFehlerSeite(erwachsener(), heute, sparten))
    }

    @Test fun leererAntragMeldetPflichtfelderAberEmailUndTelefonSindFreiwillig() {
        val f = fehler(1, Antrag())
        assertEquals(setOf("vorname", "nachname", "geburtsdatum", "strasse", "hausnummer", "plz", "ort"), f.keys)
        assertTrue(fehler(1, erwachsener().copy(email = "", telefon = "")).isEmpty())
        assertTrue(fehler(1, erwachsener().copy(email = "keine-mail")).containsKey("email"))
        assertTrue(fehler(1, erwachsener().copy(email = "a@b.de")).isEmpty())
    }

    @Test fun alterUndMinderjaehrigkeit() {
        assertEquals(36, AntragRegeln.alter("1990-05-01", heute))
        assertEquals(17, AntragRegeln.alter("2009-11-12", heute))
        assertEquals(18, AntragRegeln.alter("2008-11-12", heute))
        assertNull(AntragRegeln.alter("2030-01-01", heute)); assertNull(AntragRegeln.alter("kaputt", heute))
        assertTrue(AntragRegeln.minderjaehrig(erwachsener().copy(geburtsdatum = "2012-01-01"), heute))
        assertFalse(AntragRegeln.minderjaehrig(erwachsener().copy(geburtsdatum = "2008-11-12"), heute))
        assertEquals("youth", AntragRegeln.vorschlagArt(12)); assertNull(AntragRegeln.vorschlagArt(30)); assertNull(AntragRegeln.vorschlagArt(null))
    }

    @Test fun minderjaehrigeBrauchenVertreterUndDessenUnterschrift() {
        val kind = erwachsener().copy(geburtsdatum = "2012-01-01", zahlungsart = "transfer", iban = "", kontoinhaber = "")
        assertTrue(fehler(1, kind).containsKey("vertreterName"))
        assertTrue(fehler(4, kind.copy(vertreterName = "Eva Muster")).containsKey("vertreterUnterschrift"))
        val ok = kind.copy(vertreterName = "Eva Muster", vertreterUnterschrift = unterschrift)
        assertTrue(fehler(1, ok).isEmpty()); assertTrue(fehler(4, ok).isEmpty())
        // Unter 18 unterschreibt allein der Vertreter, das Kind nicht
        assertTrue(fehler(4, ok.copy(unterschrift = null)).isEmpty())
        assertTrue(fehler(4, erwachsener().copy(unterschrift = null)).containsKey("unterschrift"))
    }

    @Test fun kontoinhaberVorschlagBeiMinderjaehrigenDerVertreter() {
        assertEquals("Anna Muster", AntragRegeln.kontoinhaberVorschlag(erwachsener(), heute))
        assertEquals("Eva Muster", AntragRegeln.kontoinhaberVorschlag(erwachsener().copy(geburtsdatum = "2012-01-01", vertreterName = " Eva Muster "), heute))
        assertEquals("Anna Muster", AntragRegeln.kontoinhaberVorschlag(erwachsener().copy(geburtsdatum = "2012-01-01"), heute))
    }

    @Test fun lastschriftBrauchtGueltigeIbanUndKontoinhaber() {
        assertTrue(fehler(3, erwachsener().copy(iban = "")).containsKey("iban"))
        assertTrue(fehler(3, erwachsener().copy(iban = "DE89 3704 0044 0532 0130 01")).containsKey("iban")) // falsche Prüfziffer
        assertTrue(fehler(3, erwachsener().copy(kontoinhaber = " ")).containsKey("kontoinhaber"))
        assertTrue(fehler(3, erwachsener().copy(bic = "XX")).containsKey("bic"))
        assertTrue(fehler(3, erwachsener(sepa = false)).isEmpty())
    }

    @Test fun erklaerungenUndUnterschriftSindPflicht() {
        val f = fehler(4, erwachsener().copy(datenschutz = false, satzung = false, unterschrift = null))
        assertEquals(setOf("datenschutz", "satzung", "unterschrift"), f.keys)
        assertTrue(fehler(4, erwachsener().copy(unterschrift = Unterschrift(2.0, emptyList()))).containsKey("unterschrift"))
    }

    @Test fun sparteMussZurListeGehoeren() {
        assertTrue(fehler(2, erwachsener().copy(sparte = "Golf")).containsKey("sparte"))
        assertTrue(fehler(2, erwachsener().copy(eintritt = "")).containsKey("eintritt"))
        assertTrue(fehler(2, erwachsener().copy(mitgliedsart = "honorary")).containsKey("mitgliedsart"))
    }

    @Test fun kontoinhaberUnterschriftNurWennAbweichend() {
        val a = erwachsener()
        assertFalse(AntragRegeln.kontoinhaberAbweichend(a))
        assertFalse(AntragRegeln.kontoinhaberAbweichend(a.copy(kontoinhaber = "  muster,  ANNA ")))
        assertFalse(AntragRegeln.kontoinhaberMussUnterschreiben(a, heute))
        val fremd = a.copy(kontoinhaber = "Peter Muster")
        assertTrue(AntragRegeln.kontoinhaberMussUnterschreiben(fremd, heute))
        assertTrue(fehler(4, fremd).containsKey("kontoinhaberUnterschrift"))
        assertTrue(fehler(4, fremd.copy(kontoinhaberUnterschrift = unterschrift)).isEmpty())
        // Elternteil als Kontoinhaber eines Kindes: dessen Vertreter-Unterschrift genügt
        val kind = a.copy(geburtsdatum = "2012-01-01", vertreterName = "Eva Muster", kontoinhaber = "Eva Muster", vertreterUnterschrift = unterschrift)
        assertFalse(AntragRegeln.kontoinhaberMussUnterschreiben(kind, heute)); assertTrue(fehler(4, kind).isEmpty())
        assertFalse(AntragRegeln.kontoinhaberMussUnterschreiben(fremd.copy(zahlungsart = "transfer"), heute))
    }

    @Test fun dublettenNachNameOderEmail() {
        fun m(v: String, n: String, mail: String) = Member.from(JsonObject(mapOf(
            "id" to JsonPrimitive("x$v$n"), "firstName" to JsonPrimitive(v), "lastName" to JsonPrimitive(n), "email" to JsonPrimitive(mail),
        )))
        val liste = listOf(m("anna", " MUSTER", ""), m("Bert", "Zahl", "a@b.de"), m("Cäcilie", "Fremd", "x@y.de"))
        assertEquals(1, AntragRegeln.dubletten(erwachsener(), liste).size)
        assertEquals(2, AntragRegeln.dubletten(erwachsener().copy(email = "A@B.de"), liste).size)
        assertEquals(0, AntragRegeln.dubletten(erwachsener().copy(vorname = "Zoe"), liste).size)
    }

    // ---------- Einstellungen

    @Test fun einstellungenStandardUndRoundtrip() {
        val st = InMemoryDocumentStore()
        st.put("settings", "main", JsonObject(mapOf("id" to JsonPrimitive("main"), "clubName" to JsonPrimitive("TSV"))))
        val std = AntragEinstellungenStore.lesen(st)
        assertEquals("18", std.beitrag("full").betrag); assertEquals("monthly", std.beitrag("youth").periode)
        assertTrue(std.datenschutz.contains("{verein}"))
        val neu = std.copy(beitraege = std.beitraege + ("full" to BeitragsVorgabe("120,50", "yearly")), satzung = "Eigene Satzungsformel {verein}.")
        AntragEinstellungenStore.speichern(st, neu)
        val gelesen = AntragEinstellungenStore.lesen(st)
        assertEquals("120.50", gelesen.beitrag("full").betrag); assertEquals(java.math.BigDecimal("120.50"), gelesen.beitrag("full").wert)
        assertEquals("yearly", gelesen.beitrag("full").periode); assertEquals("Eigene Satzungsformel {verein}.", gelesen.satzung)
        assertEquals("TSV", (st.get("settings", "main")!!["clubName"] as JsonPrimitive).content) // anderes bleibt
        // Standardtext wird nicht gespeichert
        AntragEinstellungenStore.speichern(st, gelesen.copy(satzung = AntragEinstellungen.STANDARD_SATZUNG))
        assertNull(st.get("settings", "main")!![AntragEinstellungenStore.K_SATZUNG])
    }

    @Test fun ungueltigerBeitragWirdAbgelehnt() {
        val e = AntragEinstellungen.standard().let { it.copy(beitraege = it.beitraege + ("youth" to BeitragsVorgabe("abc", "monthly"))) }
        assertTrue(AntragEinstellungenStore.pruefen(e).containsKey("beitrag.youth"))
        try { AntragEinstellungenStore.speichern(InMemoryDocumentStore(), e); fail() } catch (x: IllegalArgumentException) { assertTrue(x.message!!.contains("Betrag")) }
    }

    private val pdfBytes = "%PDF-1.4\nbeispiel\n%%EOF".toByteArray()

    @Test fun eigeneVorlageHinterlegenErsetzenEntfernen() {
        val st = InMemoryDocumentStore(); val fs = InMemoryFileStore()
        assertNull(AntragEinstellungenStore.vorlageBytes(st, fs))
        val d1 = AntragEinstellungenStore.vorlageSetzen(st, fs, pdfBytes, "mein-antrag.pdf", heute)
        assertEquals("folder-aufnahmeantraege", d1.ordnerId)
        assertEquals(pdfBytes.toList(), AntragEinstellungenStore.vorlageBytes(st, fs)!!.toList())
        val zweite = "%PDF-1.7\nzweite".toByteArray()
        AntragEinstellungenStore.vorlageSetzen(st, fs, zweite, "neu.pdf", heute)
        assertEquals(zweite.toList(), AntragEinstellungenStore.vorlageBytes(st, fs)!!.toList())
        assertEquals(1, Dokumente.dokumente(st).size) // die alte ist weg
        AntragEinstellungenStore.vorlageEntfernen(st, fs)
        assertNull(AntragEinstellungenStore.vorlageBytes(st, fs)); assertEquals(0, Dokumente.dokumente(st).size)
        try { AntragEinstellungenStore.vorlageSetzen(st, fs, "kein pdf".toByteArray(), "x.pdf", heute); fail() } catch (x: Exception) { assertTrue(x.message!!.contains("PDF")) }
        assertEquals(0, Dokumente.dokumente(st).size)
    }

    @Test fun zweiteFassungAmSelbenTagWirdGezaehlt() {
        val st = InMemoryDocumentStore(); val fs = InMemoryFileStore()
        val sa = AntragEinstellungenStore.Beilage.SATZUNG; val ds = AntragEinstellungenStore.Beilage.DATENSCHUTZ
        val t1 = AntragEinstellungenStore.beilageSetzen(st, fs, sa, pdfBytes, "a.pdf", heute).titel
        val t2 = AntragEinstellungenStore.beilageSetzen(st, fs, sa, pdfBytes, "a.pdf", heute).titel
        val t3 = AntragEinstellungenStore.beilageSetzen(st, fs, sa, pdfBytes, "a.pdf", heute).titel
        val d = AntragEinstellungenStore.beilageSetzen(st, fs, ds, pdfBytes, "d.pdf", heute).titel
        assertEquals("Satzung vom 12.11.2026", t1); assertEquals("Satzung vom 12.11.2026 (2)", t2); assertEquals("Satzung vom 12.11.2026 (3)", t3)
        assertEquals("Datenschutz-Vordruck vom 12.11.2026", d) // die andere Beilage zählt für sich
    }

    @Test fun satzungUndDatenschutzHinterlegenNeueFassungBehaeltAlte() {
        val st = InMemoryDocumentStore(); val fs = InMemoryFileStore()
        val sa = AntragEinstellungenStore.Beilage.SATZUNG; val ds = AntragEinstellungenStore.Beilage.DATENSCHUTZ
        assertNull(AntragEinstellungenStore.beilage(st, sa)); assertEquals("", AntragEinstellungenStore.lesen(st).satzungDokId)
        val d1 = AntragEinstellungenStore.beilageSetzen(st, fs, sa, pdfBytes, "satzung-2026.pdf", heute)
        assertEquals("satzung", d1.kategorie); assertEquals("folder-satzung", d1.ordnerId); assertEquals("Satzung vom 12.11.2026", d1.titel)
        assertEquals(d1.id, AntragEinstellungenStore.lesen(st).satzungDokId)
        val d2 = AntragEinstellungenStore.beilageSetzen(st, fs, ds, pdfBytes, "ds.pdf", heute)
        assertEquals("folder-aufnahmeantraege", d2.ordnerId); assertEquals("Datenschutz-Vordruck vom 12.11.2026", d2.titel)
        assertEquals(d2.id, AntragEinstellungenStore.lesen(st).datenschutzDokId)
        assertEquals(d1.id, AntragEinstellungenStore.beilage(st, sa)!!.id) // die zweite Beilage berührt die erste nicht
        val zweite = "%PDF-1.7\nneu".toByteArray()
        val d3 = AntragEinstellungenStore.beilageSetzen(st, fs, sa, zweite, "", heute.plusDays(30))
        assertEquals("Satzung.pdf", d3.dateiName); assertEquals("Satzung vom 12.12.2026", d3.titel)
        assertEquals(d3.id, AntragEinstellungenStore.beilage(st, sa)!!.id) // die neue Fassung gilt
        assertEquals(3, Dokumente.dokumente(st).size)                       // die alte bleibt im Archiv
        assertEquals(pdfBytes.toList(), fs.open(d1.dateiId!!)!!.use { it.readBytes() }.toList())
        AntragEinstellungenStore.beilageEntfernen(st, sa)
        assertNull(AntragEinstellungenStore.beilage(st, sa)); assertEquals(3, Dokumente.dokumente(st).size) // nichts gelöscht
        assertEquals(d2.id, AntragEinstellungenStore.beilage(st, ds)!!.id)
        try { AntragEinstellungenStore.beilageSetzen(st, fs, sa, "kein pdf".toByteArray(), "x.pdf", heute); fail() } catch (x: Exception) { assertTrue(x.message!!.contains("PDF")) }
        assertEquals(3, Dokumente.dokumente(st).size)
    }

    // ---------- Aufnahme

    private val vorgabe = BeitragsVorgabe("18", "monthly")

    @Test fun mitgliedFormErfindetNichts() {
        val f = Aufnahme.mitgliedForm(erwachsener().copy(vorverein = "SV Alt", notiz = "Torwart"), "M-0007", vorgabe, heute, "mem-1")
        assertEquals("sepa", f.paymentMethod); assertEquals("DE89370400440532013000", f.iban)
        assertEquals("", f.bic); assertEquals("", f.bankName) // keine erfundenen Bankdaten
        assertEquals("FRST", f.mandateSequenceType); assertEquals("MANDAT-M-0007-2026", f.mandateReference); assertEquals("2026-11-12", f.mandateDate)
        assertEquals("18", f.fee); assertEquals("monthly", f.feePeriod)
        assertEquals("Vorverein: SV Alt | Torwart", f.notes); assertFalse(f.isMinor); assertEquals("", f.guardianName)
        val kind = Aufnahme.mitgliedForm(erwachsener(false).copy(geburtsdatum = "2012-01-01", vertreterName = "Eva", vertreterTelefon = ""), "M-0008", vorgabe, heute, "mem-2")
        assertTrue(kind.isMinor); assertEquals("Eva", kind.guardianName); assertEquals("", kind.guardianPhone) // nichts stillschweigend übernommen
        assertEquals("transfer", kind.paymentMethod); assertEquals("", kind.mandateReference)
    }

    @Test fun aufnehmenLegtMitgliedUndPdfAn() {
        val st = InMemoryDocumentStore(); val fs = InMemoryFileStore()
        val r = Aufnahme.aufnehmen(st, fs, erwachsener(), "M-0001", vorgabe, pdfBytes, sparten, heute)
        val m = Member.from(st.get(MemberStore.AREA, r.mitgliedId)!!)
        assertEquals("Anna", m.firstName); assertEquals("M-0001", m.number); assertEquals("Fußball", m.department)
        val doks = Dokumente.dokumente(st)
        assertEquals(1, doks.size)
        assertEquals(r.mitgliedId, doks[0].mitgliedId); assertEquals("folder-aufnahmeantraege", doks[0].ordnerId)
        assertTrue(doks[0].titel.startsWith("Aufnahmeantrag: Muster, Anna (M-0001)"))
        assertEquals("Aufnahmeantrag_Muster_Anna_M-0001.pdf", doks[0].dateiName)
        assertEquals(pdfBytes.toList(), fs.open(doks[0].dateiId!!)!!.use { it.readBytes() }.toList())
        assertEquals(1, st.all("auditLogs").size)
    }

    @Test fun unvollstaendigerOderDoppelterAntragSchreibtNichts() {
        val st = InMemoryDocumentStore(); val fs = InMemoryFileStore()
        try { Aufnahme.aufnehmen(st, fs, erwachsener().copy(unterschrift = null), "M-0001", vorgabe, pdfBytes, sparten, heute); fail() } catch (e: IllegalArgumentException) {}
        assertEquals(0, st.all(MemberStore.AREA).size); assertEquals(0, Dokumente.dokumente(st).size); assertTrue(fs.ids().isEmpty())
        Aufnahme.aufnehmen(st, fs, erwachsener(), "M-0001", vorgabe, pdfBytes, sparten, heute)
        try { Aufnahme.aufnehmen(st, fs, erwachsener().copy(vorname = "Bert", kontoinhaber = "Bert Muster"), "m-0001", vorgabe, pdfBytes, sparten, heute); fail() } catch (e: IllegalArgumentException) {
            assertTrue(e.message, e.message!!.contains("vergeben"))
        }
        assertEquals(1, st.all(MemberStore.AREA).size); assertEquals(1, Dokumente.dokumente(st).size); assertEquals(1, fs.ids().size)
    }

    // ---------- PDF-Aufbau

    private fun texte(seiten: List<List<Zeichnung>>) = seiten.flatten().filterIsInstance<Zeichnung.Text>().map { it.text }

    private fun imRahmen(seiten: List<List<Zeichnung>>) {
        for (s in seiten) for (z in s) when (z) {
            is Zeichnung.Text -> { assertTrue(z.text, z.x in 0.0..210.0 && z.y in 0.0..297.0); assertTrue(z.text + " zu breit", z.aus != Zeichnung.Aus.LINKS || z.x + mass.breite(z.text, z.groesse, z.fett) <= 196.0) }
            is Zeichnung.Rechteck -> assertTrue(z.x >= 0 && z.y >= 0 && z.x + z.b <= 210.01 && z.y + z.h <= 297.01)
            is Zeichnung.Linie -> assertTrue(z.x1 in 0.0..210.0 && z.x2 in 0.0..210.0 && z.y1 in 0.0..297.0)
            is Zeichnung.Linienzug -> z.punkte.forEach { assertTrue(it.first in 0.0..210.0 && it.second in 0.0..297.0) }
            else -> {}
        }
    }

    @Test fun ausgefuellterAntragEnthaeltDatenUndUnterschriften() {
        val e = AntragEinstellungen.standard()
        val kind = erwachsener().copy(
            geburtsdatum = "2012-01-01", vertreterName = "Peter Muster", kontoinhaber = "Peter Muster", vertreterUnterschrift = unterschrift,
            unterschrift = null, vorverein = "SV Alt", notiz = "Torwart",
        )
        val seiten = AntragLayout.bauen(kind, verein, e, "M-0007", heute, mass)
        imRahmen(seiten)
        val t = texte(seiten)
        assertTrue(t.contains("TSV Test e.V.")); assertTrue(t.contains("Muster")); assertTrue(t.contains("Anna")); assertTrue(t.contains("12.11.2026"))
        assertTrue(t.contains("DE89 3704 0044 0532 0130 00")); assertTrue(t.contains("MANDAT-M-0007-2026")); assertTrue(t.contains("DE98ZZZ09999999999"))
        assertTrue(t.contains("18,00 € monatlich"))
        assertTrue(t.any { it.startsWith("2. Gesetzlicher Vertreter") }) // minderjährig
        assertEquals(1, seiten.flatten().count { it is Zeichnung.Linienzug }) // nur der Vertreter; Kontoinhaber = Vertreter, keine weitere
        assertTrue(t.contains("Unterschrift gesetzlicher Vertreter")); assertFalse(t.contains("Unterschrift Antragsteller/in"))
        assertFalse(t.any { it.startsWith("Seite ") }) // keine Seitenzahl (stört das Briefpapier)
        assertFalse(t.any { it.contains("{verein}") })
        assertTrue(t.any { it.contains("TSV Test e.V.") && it.startsWith("Satzung") || it.contains("Satzung") })
    }

    @Test fun volljaehrigerOhneVertreterAbschnittUndFremdesKontoMitDritterUnterschrift() {
        val e = AntragEinstellungen.standard()
        val ohne = AntragLayout.bauen(erwachsener(), verein, e, "M-1", heute, mass)
        assertFalse(texte(ohne).any { it.startsWith("2. Gesetzlicher Vertreter") })
        assertEquals(1, ohne.flatten().count { it is Zeichnung.Linienzug })
        val fremd = AntragLayout.bauen(erwachsener().copy(kontoinhaber = "Peter Muster", kontoinhaberUnterschrift = unterschrift), verein, e, "M-1", heute, mass)
        assertEquals(2, fremd.flatten().count { it is Zeichnung.Linienzug }); imRahmen(fremd)
        assertTrue(texte(fremd).any { it.startsWith("Unterschrift Kontoinhaber") })
    }

    @Test fun mitBriefpapierKeinEigenerKopfUndTextUnterDemRand() {
        val e = AntragEinstellungen.standard()
        for (a in listOf(erwachsener(), null)) {
            val s = AntragLayout.bauen(a, verein, e, "M-1", heute, mass, briefpapier = true, randOben = 50.0)
            assertFalse(s.flatten().any { it is Zeichnung.Rechteck && it.fuellung != null && it.y < 50.0 && it.h > 15.0 })
            assertFalse(texte(s).any { it == verein.name })
            s.forEach { seite -> assertTrue(seite.filterIsInstance<Zeichnung.Text>().filter { !it.text.startsWith("Seite ") }.all { it.y >= 50.0 }) }
            imRahmen(s)
        }
        // Ohne Briefpapier bleibt der eigene Kopf.
        assertTrue(texte(AntragLayout.bauen(erwachsener(), verein, e, "M-1", heute, mass)).any { it == verein.name })
        // Unsinnig großer Rand führt nicht zu endlosen Seiten.
        assertTrue(AntragLayout.bauen(erwachsener(), verein, e, "M-1", heute, mass, briefpapier = true, randOben = 900.0).size < 10)
    }

    @Test fun fehlendeGlaeubigerIdWirdNichtErfunden() {
        val t = texte(AntragLayout.bauen(erwachsener(), verein.copy(glaeubigerId = ""), AntragEinstellungen.standard(), "M-1", heute, mass))
        assertTrue(t.contains("nicht hinterlegt")); assertFalse(t.any { it.contains("ZZZ0999") })
    }

    @Test fun ueberweisungHatKeinenSepaAbschnitt() {
        val t = texte(AntragLayout.bauen(erwachsener(sepa = false), verein, AntragEinstellungen.standard(), "M-1", heute, mass))
        assertTrue(t.contains("Überweisung (Selbstzahler)")); assertFalse(t.any { it.startsWith("Mandatsreferenz") })
    }

    @Test fun leeresFormularZeigtAlleMitgliedsartenMitBeitraegen() {
        val e = AntragEinstellungen.standard().let { it.copy(beitraege = it.beitraege + ("youth" to BeitragsVorgabe("7,5", "quarterly"))) }
        val seiten = AntragLayout.bauen(null, verein, e, "", heute, mass)
        imRahmen(seiten)
        val t = texte(seiten)
        assertTrue(t.any { it.startsWith("Kinder und Jugendliche") && it.endsWith("7,50 € vierteljährlich") })
        assertTrue(t.any { it.startsWith("Vollmitglied") && it.endsWith("18,00 € monatlich") })
        assertTrue(t.any { it.startsWith("2. Gesetzlicher Vertreter (nur bei Minderjährigen") })
        assertTrue(t.contains("Bitte in Druckbuchstaben ausfüllen und unterschreiben."))
        assertEquals(0, seiten.flatten().count { it is Zeichnung.Linienzug })
        assertTrue(t.any { it.startsWith("Unterschrift Kontoinhaber") })
        assertTrue(t.contains("Unterschrift Antragsteller/in (ab 18 Jahren)")); assertTrue(t.contains("Unterschrift gesetzlicher Vertreter (bei unter 18)"))
        assertFalse(t.any { it.startsWith("Seite ") })
        assertFalse(t.contains("Anna"))
    }

    @Test fun langeTexteBrechenUmUndBleibenAufDerSeite() {
        val e = AntragEinstellungen.standard().copy(datenschutz = "Sehr langer Text. ".repeat(80))
        val seiten = AntragLayout.bauen(erwachsener().copy(notiz = "x".repeat(300)), verein, e, "M-1", heute, mass)
        imRahmen(seiten); assertTrue(seiten.size >= 2)
    }
}
