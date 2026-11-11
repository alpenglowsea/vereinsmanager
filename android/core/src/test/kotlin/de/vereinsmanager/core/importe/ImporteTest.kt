package de.vereinsmanager.core.importe

import de.vereinsmanager.core.contacts.Kontakte
import de.vereinsmanager.core.finance.Buchung
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.finance.Konto
import de.vereinsmanager.core.members.MemberCsv
import de.vereinsmanager.core.store.InMemoryDocumentStore
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ImporteTest {
    private val jetzt = ZonedDateTime.of(2026, 11, 11, 12, 0, 0, 0, ZoneOffset.UTC)
    private val konten = listOf(
        Konto("k1", "Girokonto", "bank", "DE89370400440532013000", "", BigDecimal.ZERO, "", "", null),
        Konto("k2", "Kasse", "cash", "", "", BigDecimal.ZERO, "", "", null),
    )

    private fun store(): InMemoryDocumentStore {
        val s = InMemoryDocumentStore()
        konten.forEach { k ->
            s.put("accounts", k.id, buildJsonObject { put("id", k.id); put("name", k.name); put("accountType", k.art); put("iban", k.iban); put("initialBalance", 0) })
        }
        return s
    }

    private fun alt(partner: String, datum: String, betrag: Double, nr: String = "", skr: String = "", text: String = "x") =
        Buchung.from(buildJsonObject {
            put("id", "alt-$partner-$datum"); put("date", datum); put("amount", betrag); put("type", if (betrag < 0) "expense" else "income")
            put("partner", partner); put("bookingText", text); put("documentNumber", nr); put("skrAccount", skr)
            put("mainCategory", if (skr.isEmpty()) "" else "40400 - Spenden"); put("subCategory", if (skr.isEmpty()) "" else "Geldspenden"); put("sphere", "ideell")
        })

    private fun zeilen(csv: String, quelle: ImportQuelle, vorhandene: List<Buchung> = emptyList()): List<BuchungsZeile> {
        val t = MemberCsv.parse(csv)
        return BuchungImport.umwandeln(t.rows, BuchungImport.erkenneSpalten(t.headers), quelle, konten, "k1", "ideell", vorhandene)
    }

    // ---- Beträge und Daten

    @Test fun betraegeInDeutscherUndEnglischerSchreibweise() {
        assertEquals(BigDecimal("1234.50"), Tabellen.betrag("1.234,50")!!.wert)
        assertEquals(BigDecimal("1234.50"), Tabellen.betrag("1,234.50")!!.wert)
        assertEquals(BigDecimal("-12.50"), Tabellen.betrag("-12,5")!!.wert)
        assertEquals(BigDecimal("-12.50"), Tabellen.betrag("12,50-")!!.wert)
        assertEquals(BigDecimal("-12.50"), Tabellen.betrag("(12,50)")!!.wert)
        assertEquals(BigDecimal("-12.50"), Tabellen.betrag("12,50 S")!!.wert)
        assertEquals(BigDecimal("12.50"), Tabellen.betrag("12,50 H")!!.wert)
        assertEquals(BigDecimal("15.00"), Tabellen.betrag("€ 15")!!.wert)
        assertNull(Tabellen.betrag("abc"))
        assertNull(Tabellen.betrag(""))
    }

    @Test fun tausenderPunktWirdGemeldet() {
        val z = Tabellen.betrag("1.250")!!
        assertEquals(BigDecimal("1250.00"), z.wert)
        assertTrue(z.mehrdeutig)
        assertFalse(Tabellen.betrag("1.250,00")!!.mehrdeutig)
        assertFalse(Tabellen.betrag("12,5")!!.mehrdeutig)
    }

    @Test fun datenInVielenSchreibweisen() {
        assertEquals("2026-01-31", Tabellen.datum("31.01.2026"))
        assertEquals("2026-01-31", Tabellen.datum("31.01.26"))
        assertEquals("2026-01-31", Tabellen.datum("2026-01-31"))
        assertEquals("2026-01-31", Tabellen.datum("2026-01-31T10:00:00Z"))
        assertEquals("2026-01-31", Tabellen.datum("31.01.2026 14:30"))
        assertEquals("2026-01-31", Tabellen.datum("20260131"))
        assertNull(Tabellen.datum("31.02.2026"))
        assertNull(Tabellen.datum("2026"))
        assertNull(Tabellen.datum("gestern"))
    }

    // ---- Spalten

    @Test fun sparkasseUeberschriftenWerdenErkannt() {
        val m = BuchungImport.erkenneSpalten(listOf("Auftragskonto", "Buchungstag", "Valutadatum", "Buchungstext", "Verwendungszweck", "Beguenstigter/Zahlungspflichtiger", "Kontonummer/IBAN", "BIC (SWIFT-Code)", "Betrag", "Waehrung"))
        assertEquals("Buchungstag", m[BuchungFeld.DATUM])
        assertEquals("Verwendungszweck", m[BuchungFeld.TEXT])
        assertEquals("Beguenstigter/Zahlungspflichtiger", m[BuchungFeld.PARTNER])
        assertEquals("Kontonummer/IBAN", m[BuchungFeld.IBAN])
        assertEquals("Betrag", m[BuchungFeld.BETRAG])
    }

    @Test fun kurzeUeberschriftenFangenNichtFalscheSpaltenEin() {
        // Der Desktop würde „Bank“ und „Art“ als Teiltreffer verwenden; hier zählt nur ein genauer Treffer.
        val m = BuchungImport.erkenneSpalten(listOf("Datum", "Betrag", "Bankverbindung", "Artikel", "Text"))
        assertNull(m[BuchungFeld.ART])
        assertEquals("Text", m[BuchungFeld.TEXT])
    }

    // ---- Zeilen umwandeln

    private val sparkasse = "Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;Betrag\n" +
        "15.01.2026;Mitgliedsbeitrag 2026;Max Mustermann;DE02120300000000202051;50,00\n" +
        "20.01.2026;Kontoführung Januar;Sparkasse;;-7,90\n" +
        "31.01.2026;Zinsgutschrift;Sparkasse;;1,20\n"

    @Test fun bankzeilenBekommenVorzeichenBereichUndHinweis() {
        val z = zeilen(sparkasse, ImportQuelle.BANK)
        assertEquals(3, z.size)
        assertEquals("income", z[0].form.art)
        assertEquals("50", z[0].form.betrag)
        assertEquals("expense", z[1].form.art)
        assertEquals("7,9", z[1].form.betrag)
        assertEquals("ideell", z[0].form.sphaere)
        assertEquals("vermoegen", z[2].form.sphaere)
        assertTrue(z[0].form.notiz.contains("IBAN: DE02120300000000202051"))
        assertTrue(z[0].form.notiz.contains("Import: Bankauszug"))
        assertEquals("k1", z[0].form.kontoId)
        assertTrue(z.all { BuchungImport.fehler(it.form, konten).isEmpty() })
        assertTrue(z.all { it.form.skrKonto.isEmpty() && BuchungImport.warnungen(it.form).isNotEmpty() })
    }

    @Test fun nichtLesbaresDatumBleibtAlsFehlerzeileStehen() {
        val z = zeilen("Datum;Betrag;Text;Partner\nkein Datum;10,00;Test;Ich\n", ImportQuelle.TABELLE)
        assertEquals(1, z.size)
        assertEquals("kein Datum", z[0].form.datum)
        val f = BuchungImport.fehler(z[0].form, konten)
        assertEquals(1, f.size)
        assertTrue(f[0].contains("Datum"))
        // nach der Korrektur ist die Zeile in Ordnung
        assertTrue(BuchungImport.fehler(z[0].form.copy(datum = "2026-02-01"), konten).isEmpty())
    }

    @Test fun fehlenderBetragUndFehlendesKontoSindFehler() {
        val z = zeilen("Datum;Betrag;Text;Partner\n01.02.2026;;Test;Ich\n", ImportQuelle.TABELLE)
        assertTrue(BuchungImport.fehler(z[0].form, konten).any { it.contains("Betrag") })
        assertTrue(BuchungImport.fehler(z[0].form.copy(betrag = "5", kontoId = "x"), konten).any { it.contains("Finanzkonto") })
    }

    @Test fun fehlenderPartnerWirdUnbekanntMitHinweis() {
        val z = zeilen("Datum;Betrag;Text\n01.02.2026;-5,00;Porto\n", ImportQuelle.TABELLE)
        assertEquals("Unbekannt", z[0].form.partner)
        assertTrue(z[0].hinweise.any { it.contains("artner") })
    }

    @Test fun artSpalteUndSollHabenEntscheiden() {
        val z = zeilen("Datum;Betrag;Art;Text;Partner\n01.02.2026;10,00;Ausgabe;A;P\n02.02.2026;10,00 H;;B;P\n03.02.2026;10,00 S;;C;P\n", ImportQuelle.TABELLE)
        assertEquals("expense", z[0].form.art)
        assertEquals("income", z[1].form.art)
        assertEquals("expense", z[2].form.art)
    }

    @Test fun umbuchungBrauchtZielkonto() {
        val z = zeilen("Datum;Betrag;Art;Text\n01.02.2026;10,00;Umbuchung;Bar auf Bank\n", ImportQuelle.TABELLE)
        assertEquals("transfer", z[0].form.art)
        assertTrue(BuchungImport.fehler(z[0].form, konten).any { it.contains("Zielkonto") })
        assertTrue(BuchungImport.fehler(z[0].form.copy(zielkontoId = "k2"), konten).isEmpty())
    }

    @Test fun kontoAusDerDateiWirdUebernommen() {
        val z = zeilen("Datum;Betrag;Partner;Text;Konto\n01.02.2026;50,00;Max;Spende;40450\n", ImportQuelle.TABELLE)
        assertEquals("40450", z[0].form.skrKonto)
        assertTrue(z[0].form.nummernkreis.startsWith("40400"))
        assertEquals("Konto", BuchungImport.erkenneSpalten(listOf("Datum", "Konto"))[BuchungFeld.SKR])
    }

    @Test fun finanzkontoNachNameOderIban() {
        val z = zeilen("Datum;Betrag;Partner;Text;Finanzkonto\n01.02.2026;5;A;B;Kasse\n02.02.2026;5;A;B;DE89 3704 0044 0532 0130 00\n03.02.2026;5;A;B;\n", ImportQuelle.TABELLE)
        assertEquals("k2", z[0].form.kontoId)
        assertEquals("k1", z[1].form.kontoId)
        assertEquals("k1", z[2].form.kontoId)
    }

    @Test fun kontoVorschlagAusFruehererBuchungDesselbenPartners() {
        val z = zeilen("Datum;Betrag;Partner;Text\n01.02.2026;50,00;Max Mustermann;Spende\n", ImportQuelle.TABELLE, listOf(alt("Max Mustermann", "2025-12-01", 20.0, "BE-2025-001", "40450")))
        assertTrue(z[0].kontoVorschlag)
        assertEquals("40450", z[0].form.skrKonto)
        // andere Richtung: kein Vorschlag
        val e = zeilen("Datum;Betrag;Partner;Text\n01.02.2026;-50,00;Max Mustermann;Rückzahlung\n", ImportQuelle.TABELLE, listOf(alt("Max Mustermann", "2025-12-01", 20.0, "BE-2025-001", "40450")))
        assertFalse(e[0].kontoVorschlag)
    }

    // ---- Duplikate und Belegnummern

    @Test fun dieselbeDateiZweimalErgibtDuplikate() {
        val s = store()
        val z1 = zeilen(sparkasse, ImportQuelle.BANK)
        BuchungImport.importieren(s, z1, ImportQuelle.BANK, jetzt)
        val z2 = zeilen(sparkasse, ImportQuelle.BANK, Finance.buchungen(s))
        assertTrue(z2.all { it.duplikat != null })
    }

    @Test fun anderesDatumOderBetragIstKeinDuplikat() {
        val v = listOf(alt("Max", "2026-01-15", 50.0, text = "Spende"))
        val z = zeilen("Datum;Betrag;Partner;Text\n16.01.2026;50,00;Max;Spende\n15.01.2026;51,00;Max;Spende\n15.01.2026;50,00;Max;Spende\n", ImportQuelle.TABELLE, v)
        assertNull(z[0].duplikat)
        assertNull(z[1].duplikat)
        assertNotNull(z[2].duplikat)
    }

    @Test fun belegnummernWerdenFortlaufendUndEindeutigVergeben() {
        val s = store()
        val z = zeilen(sparkasse, ImportQuelle.BANK)
        val b1 = BuchungImport.importieren(s, z, ImportQuelle.BANK, jetzt)
        assertEquals("BK-2026-001", b1.ersteNummer)
        assertEquals("BK-2026-003", b1.letzteNummer)
        // zweiter Import setzt fort (der Desktop beginnt wieder bei 1)
        val b2 = BuchungImport.importieren(s, zeilen(sparkasse, ImportQuelle.BANK), ImportQuelle.BANK, jetzt)
        assertEquals("BK-2026-004", b2.ersteNummer)
        val nummern = Finance.buchungen(s).map { it.belegNummer }
        assertEquals(nummern.size, nummern.toSet().size)
    }

    @Test fun belegnummerAusDerDateiWirdUebernommenWennFrei() {
        val v = listOf(alt("X", "2025-01-01", 1.0, nr = "R-5"))
        val z = zeilen("Datum;Beleg;Betrag;Partner;Text\n01.02.2026;R-7;5;A;B\n02.02.2026;R-5;5;A;B\n03.02.2026;R-7;5;A;B\n", ImportQuelle.TABELLE, v)
        assertEquals("R-7", z[0].form.belegNummer)
        assertEquals("", z[1].form.belegNummer)
        assertTrue(z[1].hinweise.any { it.contains("R-5") })
        assertEquals("", z[2].form.belegNummer)
    }

    @Test fun tabellenimportNutztBEPraefix() {
        val s = store()
        val r = BuchungImport.importieren(s, zeilen("Datum;Betrag;Partner;Text\n01.02.2026;5;A;B\n", ImportQuelle.TABELLE), ImportQuelle.TABELLE, jetzt)
        assertEquals("BE-2026-001", r.ersteNummer)
    }

    @Test fun importSchreibtAusgabenNegativUndHaeltNotiz() {
        val s = store()
        BuchungImport.importieren(s, zeilen(sparkasse, ImportQuelle.BANK), ImportQuelle.BANK, jetzt)
        val b = Finance.buchungen(s).sortedBy { it.datum }
        assertEquals(3, b.size)
        assertEquals(BigDecimal("50"), b[0].betrag.stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it })
        assertTrue(b[1].betrag.signum() < 0)
        assertEquals("expense", b[1].art)
        assertEquals("vermoegen", b[2].sphaere)
    }

    @Test fun zeileMitFehlerWirdBeimImportAbgelehntAllesOderNichts() {
        val s = store()
        val z = zeilen("Datum;Betrag;Partner;Text\n01.02.2026;5;A;B\nkaputt;5;A;B\n", ImportQuelle.TABELLE)
        try { BuchungImport.importieren(s, z, ImportQuelle.TABELLE, jetzt); fail() } catch (e: IllegalArgumentException) { assertTrue(e.message!!.contains("Zeile 3")) }
        assertEquals(0, Finance.buchungen(s).size)
    }

    // ---- Excel

    private fun xlsx(zeilenXml: String, shared: List<String> = emptyList(), styles: String? = null): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { z ->
            fun datei(name: String, inhalt: String) { z.putNextEntry(ZipEntry(name)); z.write(inhalt.toByteArray()); z.closeEntry() }
            datei("[Content_Types].xml", "<Types/>")
            datei("xl/workbook.xml", """<workbook xmlns:r="x"><sheets><sheet name="Buchungen" sheetId="1" r:id="rId7"/></sheets></workbook>""")
            datei("xl/_rels/workbook.xml.rels", """<Relationships><Relationship Id="rId7" Target="worksheets/tabelle1.xml"/></Relationships>""")
            datei("xl/sharedStrings.xml", "<sst>" + shared.joinToString("") { "<si><t>$it</t></si>" } + "</sst>")
            datei("xl/styles.xml", styles ?: """<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
                <cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>""")
            datei("xl/worksheets/tabelle1.xml", "<worksheet><sheetData>$zeilenXml</sheetData></worksheet>")
        }
        return out.toByteArray()
    }

    private fun serial(d: LocalDate) = ChronoUnit.DAYS.between(LocalDate.of(1899, 12, 30), d)

    @Test fun xlsxWirdErkanntUndGelesen() {
        val d = serial(LocalDate.of(2026, 1, 15))
        val bytes = xlsx(
            """<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
               <row r="2"><c r="A2" s="1"><v>$d</v></c><c r="B2" s="3"><v>-235.9</v></c><c r="C2" t="inlineStr"><is><t>Bälle &amp; Trikots</t></is></c><c r="D2" t="s"><v>4</v></c></row>
               <row r="3"><c r="A3" s="2"><v>$d</v></c><c r="B3"><v>1250.5000000000002</v></c><c r="D3" t="s"><v>4</v></c></row>""",
            listOf("Datum", "Betrag", "Text", "Partner", "Müller"),
        )
        assertTrue(Xlsx.istXlsx(bytes))
        val (t, hinweis) = Tabellen.ausDatei(bytes)
        assertEquals("", hinweis)
        assertEquals(listOf("Datum", "Betrag", "Text", "Partner"), t.headers)
        assertEquals(2, t.rows.size)
        assertEquals("2026-01-15", t.rows[0]["Datum"])
        assertEquals("2026-01-15", t.rows[1]["Datum"])
        assertEquals("-235,9", t.rows[0]["Betrag"])
        assertEquals("1250,5", t.rows[1]["Betrag"])
        assertEquals("Bälle & Trikots", t.rows[0]["Text"])
        assertEquals("", t.rows[1]["Text"])
        assertEquals("Müller", t.rows[0]["Partner"])
    }

    @Test fun xlsxMitLueckenUndLeerenZeilen() {
        val bytes = xlsx(
            """<row r="1"><c r="A1" t="inlineStr"><is><t>Datum</t></is></c><c r="C1" t="inlineStr"><is><t>Betrag</t></is></c></row>
               <row r="2"/>
               <row r="3"><c r="A3" t="inlineStr"><is><t>31.01.2026</t></is></c><c r="C3"><v>7.9</v></c></row>""",
        )
        val t = Tabellen.ausDatei(bytes).first
        assertEquals(listOf("Datum", "Spalte", "Betrag"), t.headers)
        assertEquals(1, t.rows.size)
        assertEquals("7,9", t.rows[0]["Betrag"])
    }

    @Test fun xlsxFliesstDurchDenBuchungsimport() {
        val d = serial(LocalDate.of(2026, 1, 15))
        val bytes = xlsx(
            """<row r="1"><c r="A1" t="inlineStr"><is><t>Datum</t></is></c><c r="B1" t="inlineStr"><is><t>Betrag</t></is></c><c r="C1" t="inlineStr"><is><t>Partner</t></is></c><c r="D1" t="inlineStr"><is><t>Text</t></is></c></row>
               <row r="2"><c r="A2" s="1"><v>$d</v></c><c r="B2"><v>-42.5</v></c><c r="C2" t="inlineStr"><is><t>Baumarkt</t></is></c><c r="D2" t="inlineStr"><is><t>Schrauben</t></is></c></row>""",
        )
        val t = Tabellen.ausDatei(bytes).first
        val z = BuchungImport.umwandeln(t.rows, BuchungImport.erkenneSpalten(t.headers), ImportQuelle.TABELLE, konten, "k1", "ideell", emptyList())
        assertEquals("2026-01-15", z[0].form.datum)
        assertEquals("expense", z[0].form.art)
        assertEquals("42,5", z[0].form.betrag)
    }

    @Test fun csvBleibtCsv() {
        assertFalse(Xlsx.istXlsx("Datum;Betrag\n1;2".toByteArray()))
        val t = Tabellen.ausDatei("Datum;Betrag\n01.02.2026;5".toByteArray()).first
        assertEquals(1, t.rows.size)
    }

    @Test fun kaputteZipDateiIstKeineXlsx() {
        assertFalse(Xlsx.istXlsx(byteArrayOf('P'.code.toByte(), 'K'.code.toByte(), 1, 2, 3, 4, 5)))
    }

    // ---- Kontakte

    private fun kz(csv: String, art: ArtVorgabe = ArtVorgabe.ERKENNEN, typ: String = "other", vorhandene: List<de.vereinsmanager.core.contacts.Kontakt> = emptyList()): List<KontaktZeile> {
        val t = MemberCsv.parse(csv)
        return KontaktImport.umwandeln(t.rows, KontaktImport.erkenneSpalten(t.headers), art, typ, vorhandene)
    }

    @Test fun firmaWirdAnRechtsformWortErkanntNichtAnBuchstabenfolge() {
        val z = kz("Name;Kontakttyp\nSport Schmitt GmbH;Lieferant\nEvangelische Kirche;Spender\nZeugwart Hans Müller;Sonstige\n")
        assertEquals("legal", z[0].form.art)
        assertEquals("natural", z[1].form.art)   // der Desktop hielt „Evangelisch…“ wegen „ev“ für eine Firma
        assertEquals("natural", z[2].form.art)   // und „Zeug…“ wegen „ug“
    }

    @Test fun alleNeunKontakttypenWerdenErkannt() {
        val alle = Kontakte.TYPEN.values.joinToString(";")
        val (typen, unbekannt) = KontaktImport.typen(alle.replace(";", ","))
        assertEquals(Kontakte.TYPEN.keys.toList(), typen)
        assertTrue(unbekannt.isEmpty())
        assertEquals(listOf("sponsor", "supplier"), KontaktImport.typen("Hauptsponsor / Lieferant").first)
        assertEquals(listOf("authority"), KontaktImport.typen("Gemeinde").first)
        assertEquals(listOf("member_contact"), KontaktImport.typen("Mitgliedsbezug").first)
    }

    @Test fun nichtErkannterTypFaelltAufVorgabeMitHinweis() {
        val z = kz("Name;Kontakttyp\nFirma X GmbH;Blabla\n", typ = "partner")
        assertEquals(listOf("partner"), z[0].form.typen)
        assertTrue(z[0].hinweise.any { it.contains("Blabla") })
    }

    @Test fun privatpersonNameWirdGeteilt() {
        val z = kz("Name\n\"Mustermann, Erika\"\nMax Müller\n")
        assertEquals("Erika", z[0].form.vorname); assertEquals("Mustermann", z[0].form.nachname)
        assertEquals("Max", z[1].form.vorname); assertEquals("Müller", z[1].form.nachname)
    }

    @Test fun ohneNamenIstFehlerzeile() {
        val z = kz("Name;Ort\n;Berlin\n")
        assertTrue(z[0].fehler.isNotEmpty())
    }

    @Test fun ungueltigeIbanUndMailWerdenNichtUebernommenAberGemeldet() {
        val z = kz("Name;Art;IBAN;E-Mail\nFirma Y GmbH;Firma;DE00123;keine-mail\n")
        assertEquals("", z[0].form.iban)
        assertEquals("", z[0].form.email)
        assertEquals(2, z[0].hinweise.size)
        assertTrue(z[0].fehler.isEmpty())
    }

    @Test fun steuernummerRegisterUndGeburtsdatumWerdenImportiert() {
        val z = kz("Name;Vorname;Nachname;Art;Steuernummer;Handelsregister;Geburtsdatum\n;Erika;Mustermann;Privat;12/345/67890;;01.02.1980\nFirma Z AG;;;Firma;98/765;HRB 123;\n")
        assertEquals("1980-02-01", z[0].form.geburtsdatum)
        assertEquals("12/345/67890", z[0].form.steuernummer)
        assertEquals("HRB 123", z[1].form.handelsregister)
    }

    @Test fun ansprechpartnerOhneFesteAnrede() {
        val z = kz("Name;Art;Ansprechpartner\nFirma Q GmbH;Firma;Erika Mustermann\n")
        assertEquals("Erika", z[0].form.apVorname)
        assertEquals("Mustermann", z[0].form.apNachname)
        assertEquals("", z[0].form.apAnrede)
        assertEquals("", z[0].form.apFunktion)
    }

    @Test fun duplikateWerdenNachNummerOderNamenErkannt() {
        val s = InMemoryDocumentStore()
        val a = Kontakte.speichern(s, Kontakte.neu(s, "supplier").copy(id = "c1", firma = "Sport Schmitt GmbH"), jetzt)
        val z = kz("Name;Art\nSPORT  Schmitt gmbh;Firma\nAndere GmbH;Firma\n", vorhandene = Kontakte.alle(s))
        assertNotNull(z[0].duplikat)
        assertNull(z[1].duplikat)
        assertTrue(z[0].duplikat!!.contains(a.nummer))
    }

    @Test fun kontaktNummernWerdenAusDerHoechstenFortgezaehlt() {
        val s = InMemoryDocumentStore()
        Kontakte.speichern(s, Kontakte.neu(s, "supplier").copy(id = "c1", nummer = "K-1005", firma = "Alt GmbH"), jetzt)
        Kontakte.speichern(s, Kontakte.neu(s, "supplier").copy(id = "c2", nummer = "K-1006", firma = "Alt2 GmbH"), jetzt)
        Kontakte.loeschen(s, "c1")           // Lücke: der Desktop würde über die Anzahl zählen und K-1002+… doppelt vergeben
        val z = kz("Name;Art\nNeu A GmbH;Firma\nNeu B GmbH;Firma\n")
        val r = KontaktImport.importieren(s, z, jetzt)
        assertEquals("K-1007", r.ersteNummer)
        assertEquals("K-1008", r.letzteNummer)
        val nummern = Kontakte.alle(s).map { it.nummer }
        assertEquals(nummern.size, nummern.toSet().size)
    }

    @Test fun nummerAusDateiNurWennFrei() {
        val s = InMemoryDocumentStore()
        Kontakte.speichern(s, Kontakte.neu(s, "supplier").copy(id = "c1", nummer = "K-1001", firma = "Alt GmbH"), jetzt)
        val z = kz("Nummer;Name;Art\nK-1001;Neu GmbH;Firma\nK-2000;Neu2 GmbH;Firma\n", vorhandene = Kontakte.alle(s))
        assertEquals("", z[0].form.nummer)
        assertEquals("K-2000", z[1].form.nummer)
    }

    @Test fun artWechselOrdnetNamenNeu() {
        val z = kz("Name\nErika Mustermann\n")[0]
        val f = KontaktImport.mitArt(z, "legal")
        assertEquals("Erika Mustermann", f.form.firma)
        assertEquals("", f.form.nachname)
        val p = KontaktImport.mitArt(f, "natural")
        assertEquals("Mustermann", p.form.nachname)
    }

    @Test fun importiertenKontaktGibtEsHinterher() {
        val s = InMemoryDocumentStore()
        KontaktImport.importieren(s, kz("Name;Art;Kontakttyp;Straße;PLZ;Ort\nSport Schmitt GmbH;Firma;Lieferant;Hauptstraße 12;12345;Musterstadt\n"), jetzt)
        val k = Kontakte.alle(s).single()
        assertEquals("Hauptstraße", k.adresse.strasse)
        assertEquals("12", k.adresse.hausnummer)
        assertEquals(listOf("supplier"), k.typen)
        assertEquals("K-1001", k.nummer)
    }

    @Test fun vorlagenSindLesbar() {
        val b = MemberCsv.parse(BuchungImport.vorlage())
        assertEquals(3, b.rows.size)
        assertEquals("Datum", BuchungImport.erkenneSpalten(b.headers)[BuchungFeld.DATUM])
        assertEquals("Konto", BuchungImport.erkenneSpalten(b.headers)[BuchungFeld.SKR])
        val k = MemberCsv.parse(KontaktImport.vorlage())
        assertEquals(2, k.rows.size)
    }
}
