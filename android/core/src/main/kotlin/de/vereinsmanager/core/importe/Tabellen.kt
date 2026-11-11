package de.vereinsmanager.core.importe

import de.vereinsmanager.core.members.CsvTable
import de.vereinsmanager.core.members.MemberCsv
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler
import java.io.ByteArrayInputStream
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.util.Locale
import java.util.zip.ZipInputStream
import javax.xml.parsers.SAXParserFactory

/** Hilfen für alle Importe: Überschriften vergleichbar machen, Beträge und Daten lesen. */
object Tabellen {
    /** Kleinbuchstaben, Umlaute aufgelöst, nur Buchstaben und Ziffern: "Begünstigter/Zahlungspflichtiger" -> "beguenstigterzahlungspflichtiger". */
    fun norm(s: String): String = buildString {
        for (c in s.lowercase(Locale.ROOT)) when (c) {
            'ä' -> append("ae"); 'ö' -> append("oe"); 'ü' -> append("ue"); 'ß' -> append("ss")
            else -> if (c.isLetterOrDigit()) append(c)
        }
    }

    /**
     * Ordnet Feldern Spaltenüberschriften zu. Zuerst gilt jeweils ein genauer Treffer (in der Reihenfolge der
     * Namensliste), danach ein Teiltreffer mit den dafür vorgesehenen längeren Wörtern. Jede Spalte wird nur
     * einmal vergeben. (Der Desktop sucht überall nur Teiltreffer; dort fängt dann z. B. „Nr“ jede Spalte ein.)
     */
    fun <F> zuordnen(headers: List<String>, regeln: List<Triple<F, List<String>, List<String>>>): Map<F, String> {
        val normiert = headers.map { norm(it) }
        val vergeben = HashSet<Int>()
        val ergebnis = LinkedHashMap<F, String>()
        for ((feld, genau, _) in regeln) {
            for (name in genau) {
                val i = normiert.indices.firstOrNull { it !in vergeben && normiert[it] == name } ?: continue
                vergeben.add(i); ergebnis[feld] = headers[i]; break
            }
        }
        for ((feld, _, teil) in regeln) {
            if (feld in ergebnis) continue
            for (name in teil) {
                val i = normiert.indices.firstOrNull { it !in vergeben && normiert[it].contains(name) } ?: continue
                vergeben.add(i); ergebnis[feld] = headers[i]; break
            }
        }
        return ergebnis
    }

    /** Ergebnis eines Betrags: [mehrdeutig] heißt, dass „1.250“ oder „1,250“ als Tausender gelesen wurde. */
    data class Zahl(val wert: BigDecimal, val mehrdeutig: Boolean = false)

    /**
     * Liest einen Betrag mit Vorzeichen: "1.234,50", "1,234.50", "-12,5", "12,5-", "(12,50)", "12,50 S" (Soll = negativ),
     * "12,50 H" (Haben = positiv), "€ 15". Ein einzelner Punkt oder ein einzelnes Komma mit genau drei Ziffern danach
     * gilt als Tausendertrenner ("1.250" = 1250). Gibt null zurück, wenn es keine Zahl ist.
     */
    fun betrag(text: String?): Zahl? {
        var t = text?.trim().orEmpty()
        if (t.isEmpty()) return null
        var negativ = false
        if (t.startsWith("(") && t.endsWith(")")) { negativ = true; t = t.substring(1, t.length - 1) }
        t = t.replace("€", "").replace("EUR", "", ignoreCase = true).replace(" ", "").replace(" ", "")
        val schluss = t.lastOrNull()?.uppercaseChar()
        if (schluss == 'S' || schluss == 'H') { if (schluss == 'S') negativ = true; t = t.dropLast(1) }
        if (t.startsWith("-")) { negativ = true; t = t.substring(1) } else if (t.startsWith("+")) t = t.substring(1)
        if (t.endsWith("-")) { negativ = true; t = t.dropLast(1) }
        if (t.isEmpty() || !t.all { it.isDigit() || it == '.' || it == ',' }) return null
        var mehr = false
        val punkte = t.count { it == '.' }
        val kommas = t.count { it == ',' }
        val norm: String = when {
            punkte > 0 && kommas > 0 ->
                if (t.lastIndexOf(',') > t.lastIndexOf('.')) t.replace(".", "").replace(',', '.') else t.replace(",", "")
            kommas > 0 -> when {
                kommas > 1 -> t.replace(",", "")
                Regex("""^\d{1,3},\d{3}$""").matches(t) -> { mehr = true; t.replace(",", "") }
                else -> t.replace(',', '.')
            }
            punkte > 0 -> when {
                punkte > 1 -> if (Regex("""^\d{1,3}(\.\d{3})+$""").matches(t)) t.replace(".", "") else return null
                Regex("""^\d{1,3}\.\d{3}$""").matches(t) -> { mehr = true; t.replace(".", "") }
                else -> t
            }
            else -> t
        }
        val zahl = norm.toBigDecimalOrNull() ?: return null
        val gerundet = zahl.setScale(2, RoundingMode.HALF_UP)
        return Zahl(if (negativ) gerundet.negate() else gerundet, mehr)
    }

    /**
     * Liest ein Datum als ISO-Text: TT.MM.JJJJ, TT.MM.JJ (Jahr 20JJ), JJJJ-MM-TT, TT/MM/JJJJ, JJJJMMTT, auch mit Uhrzeit dahinter.
     * Unmögliche Daten und bloße Jahreszahlen ergeben null. (Der Desktop setzt dann stillschweigend „heute“ ein.)
     */
    fun datum(text: String?): String? {
        var v = text?.trim().orEmpty()
        if (v.isEmpty()) return null
        v = v.replace(Regex("""[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$"""), "")
        fun mk(y: Int, m: Int, d: Int): String? = try { LocalDate.of(y, m, d).toString() } catch (e: Exception) { null }
        Regex("""^(\d{1,2})\.(\d{1,2})\.(\d{4})$""").find(v)?.let { return mk(it.groupValues[3].toInt(), it.groupValues[2].toInt(), it.groupValues[1].toInt()) }
        Regex("""^(\d{1,2})\.(\d{1,2})\.(\d{2})$""").find(v)?.let { return mk(2000 + it.groupValues[3].toInt(), it.groupValues[2].toInt(), it.groupValues[1].toInt()) }
        Regex("""^(\d{4})-(\d{1,2})-(\d{1,2})$""").find(v)?.let { return mk(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt()) }
        Regex("""^(\d{1,2})/(\d{1,2})/(\d{4})$""").find(v)?.let { return mk(it.groupValues[3].toInt(), it.groupValues[2].toInt(), it.groupValues[1].toInt()) }
        Regex("""^(\d{4})(\d{2})(\d{2})$""").find(v)?.let { return mk(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt()) }
        return null
    }

    /** Baut aus Zeilen eine Tabelle: erste nicht leere Zeile = Überschriften (doppelte Namen mit _2, _3), leere Zeilen entfallen. */
    fun tabelle(zeilen: List<List<String>>): CsvTable {
        val sauber = zeilen.map { z -> z.map { it.trim() } }.filter { z -> z.any { it.isNotEmpty() } }
        if (sauber.isEmpty()) return CsvTable(emptyList(), emptyList())
        val seen = HashMap<String, Int>()
        val headers = sauber[0].map { h ->
            val name = h.ifEmpty { "Spalte" }
            val n = (seen[name] ?: 0) + 1
            seen[name] = n
            if (n > 1) "${name}_$n" else name
        }
        val rows = sauber.drop(1).map { values ->
            LinkedHashMap<String, String>().also { m -> headers.forEachIndexed { i, h -> m[h] = values.getOrElse(i) { "" } } }
        }
        return CsvTable(headers, rows)
    }

    /** Eine Datei als Tabelle: Excel-Datei (.xlsx) oder Text (CSV/TSV). Zweiter Wert: Hinweis für die Anzeige, sonst leer. */
    fun ausDatei(bytes: ByteArray): Pair<CsvTable, String> {
        if (Xlsx.istXlsx(bytes)) return Xlsx.lesen(bytes) to ""
        val (text, fallback) = MemberCsv.decode(bytes)
        return MemberCsv.parse(text) to
            if (fallback) "Die Datei war nicht UTF-8 und wurde als Windows-1252 gelesen. Prüfen Sie Umlaute in der Vorschau." else ""
    }
}

/** Liest die erste Tabelle einer Excel-Datei (.xlsx = ZIP mit XML). Formeln zählen mit ihrem gespeicherten Ergebnis. */
object Xlsx {
    private const val MAX_BYTES = 64L * 1024 * 1024

    fun istXlsx(bytes: ByteArray): Boolean = bytes.size > 4 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte() &&
        entries(bytes).let { it.containsKey("xl/workbook.xml") }

    private fun entries(bytes: ByteArray): Map<String, ByteArray> {
        val m = LinkedHashMap<String, ByteArray>()
        var summe = 0L
        try {
            ZipInputStream(ByteArrayInputStream(bytes)).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    if (e.isDirectory) continue
                    val name = e.name
                    if (!(name.startsWith("xl/") && name.endsWith(".xml") || name.endsWith(".rels"))) continue
                    val data = z.readBytes()
                    summe += data.size
                    if (summe > MAX_BYTES) throw IllegalArgumentException("Die Excel-Datei ist zu groß.")
                    m[name] = data
                }
            }
        } catch (e: java.util.zip.ZipException) { /* kein gültiges ZIP: leer zurückgeben */ }
        return m
    }

    private fun sax(data: ByteArray, h: DefaultHandler) {
        val f = SAXParserFactory.newInstance()
        f.isNamespaceAware = false
        for ((k, v) in listOf("http://apache.org/xml/features/disallow-doctype-decl" to true,
            "http://xml.org/sax/features/external-general-entities" to false,
            "http://xml.org/sax/features/external-parameter-entities" to false)) {
            try { f.setFeature(k, v) } catch (e: Exception) { /* nicht jede Laufzeit kennt jedes Merkmal */ }
        }
        f.newSAXParser().parse(InputSource(ByteArrayInputStream(data)), h)
    }

    private fun lokal(q: String) = q.substringAfter(':')

    fun lesen(bytes: ByteArray): CsvTable {
        val dateien = entries(bytes)
        val workbook = dateien["xl/workbook.xml"] ?: throw IllegalArgumentException("Das ist keine Excel-Datei (.xlsx).")

        // Erste Tabelle des Arbeitsbuchs
        var ersteId: String? = null
        sax(workbook, object : DefaultHandler() {
            override fun startElement(u: String?, l: String?, q: String, a: Attributes) {
                if (lokal(q) == "sheet" && ersteId == null) ersteId = a.getValue("r:id") ?: a.getValue("id")
            }
        })
        var pfad: String? = null
        val rels = dateien["xl/_rels/workbook.xml.rels"]
        if (rels != null && ersteId != null) {
            sax(rels, object : DefaultHandler() {
                override fun startElement(u: String?, l: String?, q: String, a: Attributes) {
                    if (lokal(q) == "Relationship" && a.getValue("Id") == ersteId) {
                        val t = a.getValue("Target") ?: return
                        pfad = if (t.startsWith("/")) t.removePrefix("/") else "xl/$t"
                    }
                }
            })
        }
        val sheet = pfad?.let { dateien[it] } ?: dateien.keys.filter { it.startsWith("xl/worksheets/sheet") }.minOrNull()?.let { dateien[it] }
            ?: throw IllegalArgumentException("Die Excel-Datei enthält keine Tabelle.")

        // Gemeinsame Texte
        val texte = ArrayList<String>()
        dateien["xl/sharedStrings.xml"]?.let { d ->
            sax(d, object : DefaultHandler() {
                val sb = StringBuilder()
                var inT = false
                var phonetik = 0
                override fun startElement(u: String?, l: String?, q: String, a: Attributes) {
                    when (lokal(q)) { "si" -> sb.setLength(0); "t" -> inT = true; "rPh" -> phonetik++ }
                }
                override fun endElement(u: String?, l: String?, q: String) {
                    when (lokal(q)) { "si" -> texte.add(sb.toString()); "t" -> inT = false; "rPh" -> phonetik-- }
                }
                override fun characters(ch: CharArray, s: Int, n: Int) { if (inT && phonetik == 0) sb.append(ch, s, n) }
            })
        }

        // Zahlenformate: welche Zellformate sind Datum oder Uhrzeit?
        val formate = HashMap<Int, String>()
        val zellformate = ArrayList<Int>()
        dateien["xl/styles.xml"]?.let { d ->
            sax(d, object : DefaultHandler() {
                var inXfs = false
                override fun startElement(u: String?, l: String?, q: String, a: Attributes) {
                    when (lokal(q)) {
                        "numFmt" -> a.getValue("numFmtId")?.toIntOrNull()?.let { formate[it] = a.getValue("formatCode") ?: "" }
                        "cellXfs" -> inXfs = true
                        "xf" -> if (inXfs) zellformate.add(a.getValue("numFmtId")?.toIntOrNull() ?: 0)
                    }
                }
                override fun endElement(u: String?, l: String?, q: String) { if (lokal(q) == "cellXfs") inXfs = false }
            })
        }
        fun art(styleIndex: Int): Char { // 'd' Datum, 't' Uhrzeit, 'n' Zahl
            val id = zellformate.getOrNull(styleIndex) ?: return 'n'
            if (id in 14..22 || id in 27..36 || id in 45..47 || id in 50..58) return if (id in 18..21 || id in 45..47) 't' else 'd'
            val code = formate[id] ?: return 'n'
            val rest = code.replace(Regex("\"[^\"]*\""), "").replace(Regex("\\[[^\\]]*\\]"), "").replace(Regex("\\\\."), "").lowercase(Locale.ROOT)
            return when {
                rest.any { it == 'y' || it == 'd' } -> 'd'
                rest.any { it == 'h' || it == 's' } -> 't'
                else -> 'n'
            }
        }

        val zeilen = ArrayList<List<String>>()
        sax(sheet, object : DefaultHandler() {
            var zeile = HashMap<Int, String>()
            var spalte = 0
            var typ = ""
            var stil = 0
            var inV = false
            var inT = false
            var inIs = false
            val v = StringBuilder()
            val inline = StringBuilder()

            fun spaltenIndex(ref: String): Int {
                var n = 0
                for (c in ref) { if (c in 'A'..'Z') n = n * 26 + (c - 'A' + 1) else if (c in 'a'..'z') n = n * 26 + (c - 'a' + 1) else break }
                return n - 1
            }

            override fun startElement(u: String?, l: String?, q: String, a: Attributes) {
                when (lokal(q)) {
                    "row" -> { zeile = HashMap(); spalte = -1 }
                    "c" -> {
                        val r = a.getValue("r")
                        spalte = if (r != null) spaltenIndex(r) else spalte + 1
                        typ = a.getValue("t") ?: ""
                        stil = a.getValue("s")?.toIntOrNull() ?: 0
                        v.setLength(0); inline.setLength(0)
                    }
                    "v" -> inV = true
                    "is" -> inIs = true
                    "t" -> if (inIs) inT = true
                }
            }

            override fun endElement(u: String?, l: String?, q: String) {
                when (lokal(q)) {
                    "v" -> inV = false
                    "t" -> inT = false
                    "is" -> inIs = false
                    "c" -> {
                        val roh = v.toString().trim()
                        val text = when (typ) {
                            "s" -> roh.toIntOrNull()?.let { texte.getOrNull(it) } ?: ""
                            "inlineStr" -> inline.toString()
                            "str" -> roh
                            "b" -> if (roh == "1") "WAHR" else "FALSCH"
                            "e" -> ""
                            else -> zahlText(roh, art(stil))
                        }
                        if (text.isNotEmpty() && spalte >= 0) zeile[spalte] = text
                    }
                    "row" -> {
                        val max = zeile.keys.maxOrNull() ?: -1
                        zeilen.add((0..max).map { zeile[it] ?: "" })
                    }
                }
            }

            override fun characters(ch: CharArray, s: Int, n: Int) {
                if (inV) v.append(ch, s, n)
                if (inT) inline.append(ch, s, n)
            }
        })
        return Tabellen.tabelle(zeilen)
    }

    private fun zahlText(roh: String, art: Char): String {
        if (roh.isEmpty()) return ""
        val z = roh.toBigDecimalOrNull() ?: return roh
        if (art == 'd') {
            val tage = z.setScale(0, RoundingMode.FLOOR).toLong()
            return LocalDate.of(1899, 12, 30).plusDays(tage).toString()
        }
        if (art == 't') {
            val minuten = z.remainder(BigDecimal.ONE).multiply(BigDecimal(1440)).setScale(0, RoundingMode.HALF_UP).toInt()
            return "%02d:%02d".format(minuten / 60 % 24, minuten % 60)
        }
        val k = z.setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()
        return (if (k.scale() < 0) k.setScale(0) else k).toPlainString().replace('.', ',')
    }
}
