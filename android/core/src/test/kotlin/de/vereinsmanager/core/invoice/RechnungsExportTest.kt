package de.vereinsmanager.core.invoice

import de.vereinsmanager.core.donation.Zeichnung
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class RechnungsExportTest {
    private val heute = LocalDate.of(2026, 3, 5)

    @Test fun beispielSummenStimmen() {
        val r = RechnungsExport.beispiel(heute)
        // 2 x 45,00 = 90,00 (19 %) ; 30,00 (7 %)  -> USt 17,10 + 2,10 = 19,20 ; brutto 139,20
        assertEquals("120.00", r.netto.toPlainString())
        assertEquals("19.20", r.ustGesamt.toPlainString())
        assertEquals("139.20", r.brutto.toPlainString())
        assertEquals("2026-03-19", r.faellig)
    }

    @Test fun csvKopfUndZeile() {
        val csv = RechnungsExport.csvDateiInhalt(listOf(RechnungsExport.beispiel(heute)))
        val zeilen = csv.removePrefix("﻿").split("\r\n")
        assertEquals(2, zeilen.size)
        assertEquals(RechnungsExport.SPALTEN.joinToString(";"), zeilen[0])
        assertTrue(zeilen[1].startsWith("RE-2026-000;05.03.2026;19.03.2026;Offen;"))
        assertTrue(zeilen[1].contains(";120,00;19,20;139,20;"))
    }

    @Test fun csvOhneRechnungenIstLeer() {
        assertEquals("﻿", RechnungsExport.csvDateiInhalt(emptyList()))
    }

    @Test fun csvSchuetztFormeln() {
        val r = RechnungsExport.beispiel(heute).copy(betreff = "=1+1")
        assertTrue(RechnungsExport.csvDateiInhalt(listOf(r)).contains("'=1+1"))
    }

    @Test fun dateinameOhneUmlaute() {
        val r = RechnungsExport.beispiel(heute).copy(firma = "Müller & Söhne")
        assertEquals("Rechnung_RE-2026-000_Mueller_Soehne.pdf", RechnungsExport.pdfDateiname(r))
    }

    @Test fun beispielLaesstSichLayouten() {
        val a = Absender("Testverein", "Weg 1\n12345 Stadt", "", "", "", "", "", "", "DE02120300000000202051", "BYLADEM1001", "")
        val seiten = RechnungsLayout.bauen(RechnungsExport.beispiel(heute), a, Vorlage(), { t, g, _ -> t.length * g * 0.2 })
        assertTrue(seiten.isNotEmpty())
        assertTrue(seiten.flatten().any { it is Zeichnung.Qr })
    }
}
