package de.vereinsmanager.core.donation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class DonationExportTest {
    private val r1 = DonationReceipt(
        receiptNumber = "ZB-2026-001", type = "money", date = "2026-03-05", donorType = "member",
        donorName = "Müller, Hans \"Hansi\"",
        donorAddress = DonorAddress("Hauptstr.", "1a", "12345", "Musterstadt", "Deutschland"),
        amount = BigDecimal("1234.5"),
        amountInWords = "Eintausendzweihundertvierunddreißig Euro und fünfzig Cent",
        isWaiverOfRefund = true, taxOffice = "Waren (Müritz)", taxNumber = "075/142/03436",
        exemptionDate = "24.07.2025", assessmentPeriod = "2022 - 2024", promotedPurpose = "des Sports; und mehr",
        isDirectlyPromoted = true, issuedBy = " Kassenwart", cityAndDate = "Musterstadt, 05.03.2026",
        notes = "Zeile1\nZeile2",
    )
    private val r2 = DonationReceipt(
        receiptNumber = "ZB-2026-002", type = "goods", date = "2026-03-06", donorType = "external",
        donorName = "=SUMME(A1)", amount = BigDecimal("50"), goodsDescription = "Laptop, alt",
        goodsOrigin = "private", goodsValuationBasis = "Rechnung", exemptionDate = "2023-02-01",
        isDirectlyPromoted = false,
    )

    @Test fun fuenfundzwanzigSpalten() {
        assertEquals(25, DonationExport.SPALTEN.size)
        assertEquals(25, DonationExport.baueTabelle(listOf(r1)).first().size)
    }

    // Die Ausgabe der Dateinamen- und Zahlenfunktionen wurde gegen einen Lauf des Desktop-Codes geprüft.
    @Test fun dateinamen() {
        assertEquals("Aepfel_Oel_Uebung_ss", DonationExport.dateinameTeil("Äpfel Öl Übung ß!"))
        assertEquals("a_b_c", DonationExport.dateinameTeil("  a/b\\c  "))
        assertEquals(60, DonationExport.dateinameTeil("x".repeat(70)).length)
    }

    @Test fun pdfDateinamenSindEindeutig() {
        val namen = DonationExport.pdfDateinamen(listOf(r1, r2, r2, r1.copy(receiptNumber = "", donorName = "")))
        assertEquals(
            listOf(
                "Zuwendungsbestaetigung_ZB-2026-001_Mueller_Hans_Hansi.pdf",
                "Zuwendungsbestaetigung_ZB-2026-002_SUMME_A1.pdf",
                "Zuwendungsbestaetigung_ZB-2026-002_SUMME_A1_2.pdf",
                "Zuwendungsbestaetigung_ohne-Nr_Spender.pdf",
            ),
            namen,
        )
    }

    @Test fun zipName() {
        assertEquals("Zuwendungsbestaetigungen_TSV_Mueller_Soehne_e_V_3_Stueck.zip", DonationExport.zipDateiname("TSV Müller & Söhne e.V.", 3))
        assertEquals("Zuwendungsbestaetigungen_Verein_0_Stueck.zip", DonationExport.zipDateiname("", 0))
    }

    @Test fun betragDatumUndSicherheit() {
        assertEquals("1234,50", DonationExport.deutscherBetrag(BigDecimal("1234.5")))
        assertEquals("05.03.2026", DonationExport.deutschesDatum("2026-03-05"))
        assertEquals("24.07.2025", DonationExport.deutschesDatum("24.07.2025"))
        assertEquals("'@x", DonationExport.csvTextSicher("@x"))
        assertEquals("'-1", DonationExport.csvTextSicher("-1"))
        assertEquals("ok", DonationExport.csvTextSicher("ok"))
    }

    // CSV-Regeln nach Papaparse (Anführungszeichen bei Trennzeichen, Anführungszeichen, Umbruch, Leerzeichen
    // am Rand): von Hand aus dem Desktop-Verhalten abgeleitet, NICHT gegen Papaparse selbst geprüft.
    @Test fun csv() {
        val zeilen = DonationExport.baueCsv(listOf(r1, r2)).split("\r\n")
        assertEquals(3, zeilen.size)
        assertEquals(DonationExport.SPALTEN.joinToString(";"), zeilen[0])
        assertEquals(
            listOf(
                "ZB-2026-001", "Geldzuwendung", "05.03.2026", "\"Müller, Hans \"\"Hansi\"\"\"", "Mitglied",
                "Hauptstr.", "1a", "12345", "Musterstadt", "Deutschland", "1234,50",
                "Eintausendzweihundertvierunddreißig Euro und fünfzig Cent", "Ja", "", "", "", "Waren (Müritz)",
                "075/142/03436", "24.07.2025", "2022 - 2024", "\"des Sports; und mehr\"", "Ja", "\" Kassenwart\"",
                "Musterstadt, 05.03.2026", "Zeile1 Zeile2",
            ).joinToString(";"),
            zeilen[1],
        )
        assertEquals(
            listOf(
                "ZB-2026-002", "Sachzuwendung", "06.03.2026", "'=SUMME(A1)", "Extern", "", "", "", "", "", "50,00",
                "", "Nein", "Laptop, alt", "Privatvermögen", "Rechnung", "", "", "01.02.2023", "", "", "Nein", "", "", "",
            ).joinToString(";"),
            zeilen[2],
        )
    }

    @Test fun csvDateiHatByteOrderMark() {
        assertTrue(DonationExport.csvDateiInhalt(listOf(r1)).startsWith("﻿"))
    }

    // C4 (Code-Prüfung 24.11.2026): Excel wie am Desktop, mit dem eigenen Excel-Leser zurückgelesen
    @Test fun excelLaesstSichZuruecklesen() {
        val bytes = DonationExport.baueXlsx(listOf(r1, r2))
        val t = de.vereinsmanager.core.importe.Xlsx.lesen(bytes)
        assertEquals(DonationExport.SPALTEN, t.headers)
        val (a, b) = t.rows
        // Datum als echtes Excel-Datum (der Leser liefert es als JJJJ-MM-TT), Betrag als Zahl
        assertEquals("2026-03-05", a["Datum der Zuwendung"]); assertEquals("1234,5", a["Betrag / Wert (EUR)"])
        assertEquals("Müller, Hans \"Hansi\"", a["Spender"]); assertEquals("Zeile1 Zeile2", a["Notizen"])
        // Freistellungsdatum: Freitext bleibt Text, ein echtes Datum wird Datum
        assertEquals("24.07.2025", a["Freistellungsbescheid vom"]); assertEquals("2023-02-01", b["Freistellungsbescheid vom"])
        // Eine Formel im Namen bleibt Text (inlineStr), wird also nicht ausgeführt
        assertEquals("=SUMME(A1)", b["Spender"]); assertEquals("50", b["Betrag / Wert (EUR)"])
        val sheet = String(java.util.zip.ZipInputStream(bytes.inputStream()).use { z ->
            generateSequence { z.nextEntry }.first { it.name == "xl/worksheets/sheet1.xml" }; z.readBytes()
        }, Charsets.UTF_8)
        assertTrue(sheet.contains("t=\"inlineStr\"><is><t xml:space=\"preserve\">=SUMME(A1)</t>"))
        assertTrue(sheet.contains("state=\"frozen\"") && sheet.contains("<autoFilter ref=\"A1:Y3\"/>"))
    }
}

