package de.vereinsmanager.core.export

import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.time.LocalDate
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Eine Zelle für [XlsxSchreiber]; `null` = leere Zelle. */
sealed class XlsxZelle {
    data class Text(val v: String) : XlsxZelle()
    data class Zahl(val v: BigDecimal) : XlsxZelle()
    data class Betrag(val v: BigDecimal) : XlsxZelle()
    /** JJJJ-MM-TT */
    data class Datum(val iso: String) : XlsxZelle()
}

/**
 * Minimaler Excel-Schreiber (.xlsx) ohne Abhängigkeiten, eine Übertragung von `src/utils/xlsxWriter.ts` des Desktops
 * (Code-Prüfung C4). Eine .xlsx-Datei ist ein ZIP mit ein paar XML-Dateien. Es entsteht genau eine Tabelle mit Kopfzeile
 * (fett, grau, fixiert, mit Autofilter), Text-, Zahl-, Betrags- und Datumszellen. Text steht als „inlineStr“ und damit nie
 * als Formel: Ein Spendername, der mit „=“ beginnt, wird nicht ausgeführt.
 */
object XlsxSchreiber {
    private const val STIL_KOPF = 1
    private const val STIL_BETRAG = 2
    private const val STIL_DATUM = 3

    private val VERBOTEN = Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]")

    fun xmlEscape(s: String): String =
        s.replace(VERBOTEN, "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    /** Spaltenbuchstaben: 0 → A, 25 → Z, 26 → AA. */
    fun spaltenBuchstabe(index: Int): String {
        var n = index
        val sb = StringBuilder()
        do {
            sb.insert(0, ('A'.code + n % 26).toChar())
            n = n / 26 - 1
        } while (n >= 0)
        return sb.toString()
    }

    /** Excel-Tageszahl (1900-System) für JJJJ-MM-TT; null bei ungültigem Wert. */
    fun excelTag(iso: String): Long? {
        val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})").find(iso) ?: return null
        return try {
            LocalDate.of(m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt()).toEpochDay() + 25569
        } catch (e: Exception) { null }
    }

    private fun zahlText(v: BigDecimal) = v.stripTrailingZeros().toPlainString()

    private fun zelleXml(ref: String, z: XlsxZelle?): String = when (z) {
        null -> ""
        is XlsxZelle.Text -> if (z.v.isEmpty()) "" else "<c r=\"$ref\" t=\"inlineStr\"><is><t xml:space=\"preserve\">${xmlEscape(z.v)}</t></is></c>"
        is XlsxZelle.Zahl -> "<c r=\"$ref\"><v>${zahlText(z.v)}</v></c>"
        is XlsxZelle.Betrag -> "<c r=\"$ref\" s=\"$STIL_BETRAG\"><v>${zahlText(z.v)}</v></c>"
        is XlsxZelle.Datum -> excelTag(z.iso)?.let { "<c r=\"$ref\" s=\"$STIL_DATUM\"><v>$it</v></c>" } ?: ""
    }

    private fun laenge(z: XlsxZelle?): Int = when (z) {
        null -> 0
        is XlsxZelle.Text -> z.v.length
        is XlsxZelle.Datum -> 10
        is XlsxZelle.Zahl -> zahlText(z.v).length + 2
        is XlsxZelle.Betrag -> zahlText(z.v).length + 2
    }

    fun schreiben(name: String, kopf: List<String>, zeilen: List<List<XlsxZelle?>>): ByteArray {
        val spalten = kopf.size
        val breiten = kopf.mapIndexed { i, h ->
            var w = h.length + 2
            for (z in zeilen) w = maxOf(w, minOf(laenge(z.getOrNull(i)) + 2, 60))
            w.coerceIn(8, 60)
        }
        val rows = StringBuilder("<row r=\"1\">")
        kopf.forEachIndexed { i, h ->
            rows.append("<c r=\"${spaltenBuchstabe(i)}1\" s=\"$STIL_KOPF\" t=\"inlineStr\"><is><t xml:space=\"preserve\">${xmlEscape(h)}</t></is></c>")
        }
        rows.append("</row>")
        zeilen.forEachIndexed { r, zeile ->
            val nr = r + 2
            rows.append("<row r=\"$nr\">")
            for (c in 0 until spalten) rows.append(zelleXml("${spaltenBuchstabe(c)}$nr", zeile.getOrNull(c)))
            rows.append("</row>")
        }
        val letzte = "${spaltenBuchstabe(maxOf(spalten - 1, 0))}${zeilen.size + 1}"
        val cols = breiten.mapIndexed { i, w -> "<col min=\"${i + 1}\" max=\"${i + 1}\" width=\"$w\" customWidth=\"1\"/>" }.joinToString("")
        val kopfXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        val sheet = kopfXml +
            "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
            "<dimension ref=\"A1:$letzte\"/>" +
            "<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>" +
            "<sheetFormatPr defaultRowHeight=\"15\"/>" +
            "<cols>$cols</cols>" +
            "<sheetData>$rows</sheetData>" +
            "<autoFilter ref=\"A1:$letzte\"/>" +
            "</worksheet>"
        // Blattname: höchstens 31 Zeichen, ohne \ / ? * [ ] :
        val blatt = name.replace(Regex("[\\\\/?*\\[\\]:]"), " ").trim().ifEmpty { "Tabelle" }.take(31)
        val dateien = linkedMapOf(
            "[Content_Types].xml" to kopfXml +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
                "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
                "</Types>",
            "_rels/.rels" to kopfXml +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "</Relationships>",
            "xl/worksheets/sheet1.xml" to sheet,
            "xl/workbook.xml" to kopfXml +
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
                "<sheets><sheet name=\"${xmlEscape(blatt)}\" sheetId=\"1\" r:id=\"rId1\"/></sheets>" +
                "</workbook>",
            "xl/_rels/workbook.xml.rels" to kopfXml +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
                "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
                "</Relationships>",
            // Stile: 0 Standard, 1 Kopfzeile (fett, grau hinterlegt), 2 Betrag (#.##0,00), 3 Datum (landesübliche Kurzform)
            "xl/styles.xml" to kopfXml +
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>" +
                "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE2E8F0\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
                "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
                "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                "<cellXfs count=\"4\">" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
                "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>" +
                "<xf numFmtId=\"4\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                "<xf numFmtId=\"14\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                "</cellXfs>" +
                "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
                "</styleSheet>",
        )
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            for ((pfad, text) in dateien) {
                zip.putNextEntry(ZipEntry(pfad))
                zip.write(text.toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }
}
