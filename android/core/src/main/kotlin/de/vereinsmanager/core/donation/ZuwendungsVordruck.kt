package de.vereinsmanager.core.donation

import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Ein Zeichenbefehl für die Zuwendungsbestätigung. Alle Maße in Millimetern auf A4 hoch (210 x 297), Ursprung oben links. */
sealed interface Zeichnung {
    enum class Aus { LINKS, MITTE, RECHTS }

    /** Eine Textzeile; [y] ist die Grundlinie. [fettAnhang] steht fett hinter dem Text (nach einem Leerzeichen und 0,6 mm). */
    data class Text(
        val text: String, val x: Double, val y: Double, val groesse: Double, val fett: Boolean = false,
        val aus: Aus = Aus.LINKS, val grau: Boolean = false, val fettAnhang: String? = null,
        /** Eigene Farbe als ARGB; null: schwarz (grau, wenn [grau]). */
        val farbe: Int? = null,
    ) : Zeichnung

    /** [fuellung] und [farbe] (Rand) als ARGB; ohne Angaben: nur schwarzer Rand. */
    data class Rechteck(val x: Double, val y: Double, val b: Double, val h: Double, val fuellung: Int? = null, val farbe: Int? = null, val rand: Boolean = true) : Zeichnung

    /** Ein QR-Code für [inhalt], quadratisch [groesse] groß, mit weißem Rand (Ruhezone) darin. */
    data class Qr(val inhalt: String, val x: Double, val y: Double, val groesse: Double) : Zeichnung
    /** Ein Linienzug (zusammenhängender Strich) durch die Punkte, etwa für die Unterschrift. */
    data class Linienzug(val punkte: List<Pair<Double, Double>>, val dicke: Double = 0.5, val farbe: Int? = null) : Zeichnung
    /** Ein Kreisring (oder Kuchenstück, wenn [innen] 0 ist) um ([cx], [cy]); Winkel in Grad, 0 = rechts, im Uhrzeigersinn. */
    data class Sektor(val cx: Double, val cy: Double, val aussen: Double, val innen: Double, val start: Double, val winkel: Double, val fuellung: Int) : Zeichnung
    data class Linie(val x1: Double, val y1: Double, val x2: Double, val y2: Double, val dicke: Double = 0.25, val farbe: Int? = null) : Zeichnung

    /**
     * Text, der in der Breite [breite] umbrochen wird (der Umbruch hängt von der Schrift ab und geschieht beim Zeichnen).
     * Jeder Absatz beginnt nach dem vorigen um [zeilenabstand] je Zeile plus [absatzAbstand]. [maxZeilen] schneidet jeden Absatz ab.
     */
    data class Umbruch(
        val absaetze: List<String>, val x: Double, val y: Double, val breite: Double, val groesse: Double,
        val zeilenabstand: Double, val absatzAbstand: Double = 0.0, val maxZeilen: Int? = null,
        /** Einzeilig bleiben und die Schrift verkleinern (bis 5,5 pt), statt umzubrechen; danach zweizeilig in 6 pt. */
        val schrumpfen: Boolean = false,
    ) : Zeichnung
}

/**
 * Das amtliche Muster der Zuwendungsbestätigung (Geldzuwendung/Mitgliedsbeitrag und Sachzuwendung). Das Layout ist von der
 * Desktop-Fassung (`generateBmfDonationReceiptPdf`, Maße und Texte unverändert) übernommen und hier als Liste von Zeichenbefehlen
 * beschrieben; die App zeichnet sie mit der Schrift des Geräts. Dadurch ist der Inhalt ohne Gerät prüfbar.
 */
object ZuwendungsVordruck {
    private const val L = 15.2
    private const val TX = 16.2
    private const val BW = 180.1
    private const val IND = 28.9

    private val DE = DecimalFormatSymbols(Locale.GERMANY)
    private fun betragDe(v: BigDecimal) = DecimalFormat("#,##0.00", DE).format(v.setScale(2, RoundingMode.HALF_UP))

    fun bauen(r: DonationReceipt, settings: ClubTaxSettings, unterschrift: Unterschrift? = null): List<Zeichnung> {
        val z = ArrayList<Zeichnung>()
        val sach = r.type == "goods"
        val st = DonationService.ermittleSteuerangaben(r, settings)
        fun text(s: String, x: Double, y: Double, size: Double, fett: Boolean = false, aus: Zeichnung.Aus = Zeichnung.Aus.LINKS) {
            z.add(Zeichnung.Text(s, x, y, size, fett, aus))
        }
        fun box(x: Double, y: Double, w: Double, h: Double) { z.add(Zeichnung.Rechteck(x, y, w, h)) }
        fun linie(x1: Double, y1: Double, x2: Double, y2: Double, d: Double = 0.25) { z.add(Zeichnung.Linie(x1, y1, x2, y2, d)) }
        fun kaestchen(x: Double, y: Double, an: Boolean, size: Double = 4.7) {
            z.add(Zeichnung.Rechteck(x, y, size, size))
            if (an) {
                linie(x + 0.5, y + 0.5, x + size - 0.5, y + size - 0.5, 0.35)
                linie(x + size - 0.5, y + 0.5, x + 0.5, y + size - 0.5, 0.35)
            }
        }

        // 1. Aussteller
        box(L, 13.7, BW, 18.7)
        text("Aussteller (Bezeichnung und Anschrift der steuerbegünstigten Einrichtung)", TX, 16.8, 8.0)
        (listOf(settings.clubName) + DonationService.adresszeilen(settings.address)).take(3).forEachIndexed { i, s -> text(s, TX, 21.6 + i * 4.3, 10.0) }

        // 2. Titel
        text(if (sach) "Bestätigung über Sachzuwendungen" else "Bestätigung über Geldzuwendungen/Mitgliedsbeitrag", TX, 36.8, 10.0, true)
        text("im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten", TX, 42.0, 8.0)
        text("Körperschaften, Personenvereinigungen oder Vermögensmassen", TX, 45.3, 8.0)

        // 3. Zuwendender
        box(L, 50.6, BW, 18.4)
        text("Name und Anschrift des Zuwendenden", TX, 53.3, 8.0)
        val a = r.donorAddress
        listOf(
            r.donorName,
            "${a.street} ${a.houseNumber}".trim(),
            "${a.zip} ${a.city}".trim() + if (a.country.isNotEmpty() && a.country != "Deutschland") ", ${a.country}" else "",
        ).forEachIndexed { i, s -> text(s, TX, 58.5 + i * 4.2, 10.0) }

        // 4. Betrag / in Buchstaben / Tag der Zuwendung
        box(L, 74.4, BW, 11.9)
        linie(61.1, 74.4, 61.1, 86.3)
        linie(151.8, 74.4, 151.8, 86.3)
        text(if (sach) "Wert der Zuwendung - in Ziffern -" else "Betrag der Zuwendung - in Ziffern -", TX, 77.8, 8.0)
        text("- in Buchstaben -", 106.5, 77.8, 8.0, aus = Zeichnung.Aus.MITTE)
        text("Tag der Zuwendung:", 152.9, 77.8, 8.0)
        text("${betragDe(r.amount)}€", 60.3, 84.7, 10.0, aus = Zeichnung.Aus.RECHTS)
        z.add(Zeichnung.Umbruch(listOf(r.amountInWords.ifEmpty { DonationService.numberToGermanWords(r.amount) }), 62.2, 84.7, 87.0, 10.0, 4.2, maxZeilen = 1, schrumpfen = true))
        text(DonationService.datumFuerFormular(r.date), 152.9, 84.7, 10.0)

        // 5. Verzicht auf Erstattung (Geld) bzw. Angaben zur Sache (Sach)
        var dy = 0.0
        if (!sach) {
            text("Es handelt sich um den Verzicht auf Erstattung von Aufwendungen", TX, 97.9, 8.0)
            text("Ja", 127.0, 97.9, 8.0)
            kaestchen(132.0, 94.7, r.isWaiverOfRefund)
            text("Nein", 144.7, 97.9, 8.0)
            kaestchen(153.0, 94.7, !r.isWaiverOfRefund)
        } else {
            text("Genaue Bezeichnung der Sachzuwendung (Gegenstand, Alter, Zustand, Kaufpreis usw.)", TX, 94.9, 8.0)
            z.add(Zeichnung.Umbruch(listOf(r.goodsDescription.orEmpty()), TX, 99.9, BW - 4, 10.0, 4.2, maxZeilen = 2))
            val hy = 99.9 + 2 * 4.2 + 1.2
            val betrieb = r.goodsOrigin == "business"
            kaestchen(TX + 1, hy - 3.6, betrieb, 4.2)
            text("Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Betriebsvermögen.", IND - 3, hy, 8.0)
            kaestchen(TX + 1, hy + 2.2, !betrieb, 4.2)
            text("Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Privatvermögen.", IND - 3, hy + 5.8, 8.0)
            val unterlagen = r.goodsValuationBasis.orEmpty().trim()
            text(
                if (unterlagen.isNotEmpty()) "Unterlagen zur Wertermittlung (z. B. Rechnung, Gutachten): $unterlagen" else "Unterlagen zur Wertermittlung (z. B. Rechnung, Gutachten):",
                TX, hy + 11.6, 8.0,
            )
            dy = 18.0
        }

        // 6. Freistellungsbescheid (Kästchen 1)
        val hatFreistellung = st.freistellungsDatum.isNotEmpty()
        kaestchen(20.5, 107.0 + dy, hatFreistellung)
        text("Wir sind wegen Förderung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)", IND, 109.4 + dy, 8.0)
        text(st.zweckMitVerweis, IND, 115.2 + dy, 10.0)
        text("nach dem Freistellungsbescheid bzw. nach der Anlage zum Körperschaftsteuerbescheid des Finanzamtes", IND, 130.7 + dy, 8.0)
        if (hatFreistellung) {
            text(st.finanzamt, IND, 136.4 + dy, 10.0)
            text(st.steuernummer, 86.9, 136.4 + dy, 10.0)
            text(st.freistellungsDatum, 134.0, 136.4 + dy, 10.0)
            text(st.veranlagungszeitraum, 66.8, 141.2 + dy, 10.0)
        }
        text("StNr.", 79.5, 136.4 + dy, 7.0)
        text("vom", 124.4, 136.4 + dy, 7.0)
        text("für den letzten", 156.4, 136.4 + dy, 7.0)
        text("Veranlagungszeitraum", IND, 141.2 + dy, 7.0)
        text("nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der", 94.3, 141.2 + dy, 7.5)
        text("Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.", IND, 146.5 + dy, 7.5)

        // 7. Feststellung nach § 60a AO (Kästchen 2)
        val hatFeststellung = st.feststellungsDatum.isNotEmpty()
        kaestchen(20.5, 151.3 + dy, hatFeststellung)
        text("Die Einhaltung der satzungsmäßigen Voraussetzungen nach den §§ 51, 59, 60 und 61 AO wurde vom Finanzamt", IND, 154.6 + dy, 8.0)
        if (hatFeststellung) {
            text(st.finanzamt, IND, 160.1 + dy, 10.0)
            text(st.steuernummer, 76.2, 160.1 + dy, 10.0)
            text(st.feststellungsDatum, 131.3, 160.1 + dy, 10.0)
        }
        text("StNr.", 69.1, 160.1 + dy, 7.0)
        text("mit Bescheid vom", 105.5, 160.1 + dy, 7.0)
        text("nach § 60a AO gesondert", 150.6, 160.1 + dy, 7.0)
        text("festgestellt. Wir fördern nach unserer Satzung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)", IND, 165.0 + dy, 8.0)
        if (hatFeststellung) text(st.zweckSatzung, IND, 170.0 + dy, 10.0)

        // 8. Bestätigung der Verwendung (+ Mitgliedsbeitrag bei Geldzuwendungen)
        val kastenY = (if (sach) 182.0 else 188.4) + dy
        val kastenH = if (sach) 29.0 else 41.8
        box(L, kastenY, BW, kastenH)
        text("Es wird bestätigt, dass die Zuwendung nur zur Förderung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)", TX, kastenY + 2.7, 8.0)
        text(st.zweckKurz, TX, kastenY + 8.5, 10.0)
        text("verwendet wird.", TX, kastenY + 21.7, 8.0)
        if (!sach) {
            text("Nur für steuerbegünstigte Einrichtungen, bei denen die Mitgliedsbeiträge steuerlich nicht abziehbar sind", TX, kastenY + 30.3, 8.0, true)
            kaestchen(16.4, kastenY + 32.6, true)
            text("Es wird bestätigt, dass es sich nicht um einen Mitgliedsbeitrag handelt, dessen Abzug nach § 10b Abs. 1 des Einkommensteuergesetzes", 22.5, kastenY + 35.2, 8.0)
            text("ausgeschlossen ist.", 22.5, kastenY + 39.6, 8.0)
        } else {
            text("Es wird bestätigt, dass über die Sachzuwendung keine weitere Bestätigung ausgestellt wurde und wird.", TX, kastenY + 26.2, 8.0)
        }

        // 9. Ort, Datum, Unterschrift
        val sigY = kastenY + kastenH + 12.2
        text(r.cityAndDate, L, sigY, 10.0)
        linie(L, sigY + 1.8, L + BW, sigY + 1.8)
        text("(Ort, Datum und Unterschrift des Zuwendungsempfängers)", TX - 1, sigY + 4.8, 8.0)
        if (r.signed && unterschrift != null && !unterschrift.leer) {
            // Rechts neben Ort und Datum, auf der Linie; höchstens 70 x 11 mm, Seitenverhältnis bleibt.
            val hoehe = minOf(11.0, 70.0 / unterschrift.seitenverhaeltnis)
            val breite = hoehe * unterschrift.seitenverhaeltnis
            val x0 = L + 100.0
            val y0 = sigY + 1.2 - hoehe
            for (st in unterschrift.striche) if (st.size >= 2) z.add(Zeichnung.Linienzug(st.map { (x, y) -> (x0 + x * breite) to (y0 + y * hoehe) }))
        }

        // 10. Hinweis
        val hy = sigY + 10.2
        text("Hinweis:", TX - 1, hy, 8.0, true)
        z.add(
            Zeichnung.Umbruch(
                listOf(HINWEIS_1, HINWEIS_2), TX - 1, hy + 4.5, 179.0, 8.0, zeilenabstand = 3.4, absatzAbstand = 4.6,
            ),
        )

        // 11. Fußzeile
        if (sach) {
            text("Bestätigung über Sachzuwendung / steuerbegünstigte Einrichtung / Verein", TX, 290.2, 8.0)
        } else {
            text("034122", TX - 0.2, 290.2, 10.0, true)
            z.add(Zeichnung.Text("Bestätigung über Geldzuwendung / steuerbegünstigte Einrichtung / Verein", 29.0, 290.2, 8.0, fettAnhang = "(2013)"))
        }
        z.add(Zeichnung.Text("Beleg-Nr. ${r.receiptNumber}", 195.3, 290.2, 7.0, aus = Zeichnung.Aus.RECHTS, grau = true))
        return z
    }

    const val HINWEIS_1 =
        "Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG)."
    const val HINWEIS_2 =
        "Diese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Freistellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO)."
}

/** Packt mehrere Dateien in eine ZIP-Datei (ohne Passwort). */
object SpendenZip {
    fun bauen(namen: List<String>, daten: List<ByteArray>): ByteArray {
        require(namen.size == daten.size) { "Namen und Daten passen nicht zusammen." }
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            namen.forEachIndexed { i, n ->
                zip.putNextEntry(ZipEntry(n))
                zip.write(daten[i])
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }
}
