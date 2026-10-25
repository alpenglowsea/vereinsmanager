package de.vereinsmanager.core.donation

import java.math.BigDecimal
import java.math.RoundingMode

/** Tabellen-Export der Zuwendungsbestätigungen (Kotlin-Fassung von donationExport.ts, ohne Excel/ZIP). */
object DonationExport {
    val SPALTEN = listOf(
        "Beleg-Nr.", "Art", "Datum der Zuwendung", "Spender", "Spendertyp", "Straße", "Hausnummer", "PLZ", "Ort",
        "Land", "Betrag / Wert (EUR)", "Betrag in Worten", "Verzicht auf Erstattung", "Sachspende: Bezeichnung",
        "Sachspende: Herkunft", "Sachspende: Wertermittlung", "Finanzamt", "Steuernummer",
        "Freistellungsbescheid vom", "Veranlagungszeitraum", "Gemeinnütziger Zweck", "Unmittelbar gefördert",
        "Ausgestellt von", "Ort und Datum der Ausstellung", "Notizen",
    )
    private const val COL_MONEY = 10
    private val COL_DATES = setOf(2, 18)

    private fun jaNein(v: Boolean) = if (v) "Ja" else "Nein"

    /** Zeilen als Text; der Betrag steht an Stelle 10 als [BigDecimal]. */
    fun baueTabelle(receipts: List<DonationReceipt>): List<List<Any>> = receipts.map { r ->
        listOf(
            r.receiptNumber,
            if (r.type == "money") "Geldzuwendung" else "Sachzuwendung",
            r.date, r.donorName,
            if (r.donorType == "member") "Mitglied" else "Extern",
            r.donorAddress.street, r.donorAddress.houseNumber, r.donorAddress.zip, r.donorAddress.city,
            r.donorAddress.country,
            r.amount,
            r.amountInWords,
            jaNein(r.isWaiverOfRefund),
            if (r.type == "goods") r.goodsDescription ?: "" else "",
            if (r.type == "goods") when (r.goodsOrigin) {
                "business" -> "Betriebsvermögen"
                "private" -> "Privatvermögen"
                else -> ""
            } else "",
            if (r.type == "goods") r.goodsValuationBasis ?: "" else "",
            r.taxOffice, r.taxNumber, r.exemptionDate, r.assessmentPeriod, r.promotedPurpose,
            jaNein(r.isDirectlyPromoted),
            r.issuedBy, r.cityAndDate,
            (r.notes ?: "").replace(Regex("(\\r\\n|\\n|\\r)"), " "),
        )
    }

    fun deutschesDatum(iso: String): String {
        val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").matchEntire(iso) ?: return iso
        return "${m.groupValues[3]}.${m.groupValues[2]}.${m.groupValues[1]}"
    }

    /** 1234.5 -> "1234,50" (deutsches Komma, ohne Tausenderpunkt: Excel liest das als Zahl). */
    fun deutscherBetrag(n: BigDecimal): String = n.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',')

    /** Schutz vor "CSV-Injection": Ein Text, der mit = + - @ beginnt, würde Excel als Formel lesen. */
    fun csvTextSicher(s: String): String = if (Regex("^[=+\\-@\\t\\r]").containsMatchIn(s)) "'$s" else s

    /**
     * Papaparse-Regeln (Desktop): Ein Feld wird in Anführungszeichen gesetzt, wenn es das Trennzeichen,
     * ein Anführungszeichen, einen Zeilenumbruch oder ein Byte-Order-Mark enthält oder mit einem
     * Leerzeichen beginnt oder endet. Anführungszeichen werden verdoppelt. Zeilen enden mit CRLF.
     */
    private fun csvFeld(s: String, trenner: Char): String {
        val braucht = s.contains(trenner) || s.contains('"') || s.contains('\n') || s.contains('\r') ||
            s.contains('﻿') || s.startsWith(" ") || s.endsWith(" ")
        return if (braucht) "\"" + s.replace("\"", "\"\"") + "\"" else s
    }

    fun baueCsv(receipts: List<DonationReceipt>): String {
        val zeilen = baueTabelle(receipts).map { row ->
            row.mapIndexed { i, v ->
                when {
                    i == COL_MONEY -> deutscherBetrag(v as BigDecimal)
                    i in COL_DATES -> deutschesDatum(v.toString())
                    else -> csvTextSicher(v.toString())
                }
            }
        }
        return (listOf(SPALTEN) + zeilen).joinToString("\r\n") { r -> r.joinToString(";") { csvFeld(it, ';') } }
    }

    /** Die Datei bekommt zusätzlich ein Byte-Order-Mark, damit Excel die Umlaute richtig liest. */
    fun csvDateiInhalt(receipts: List<DonationReceipt>): String = "﻿" + baueCsv(receipts)

    /** Umlaute ausschreiben und alles Unsichere durch _ ersetzen – für Dateinamen. */
    fun dateinameTeil(s: String?): String =
        (s ?: "")
            .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
            .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("ß", "ss")
            .replace(Regex("[^a-zA-Z0-9_-]+"), "_")
            .replace(Regex("^_+|_+$"), "")
            .take(60)

    /** Dateinamen im ZIP, eindeutig auch bei doppelten Nummern/Namen. */
    fun pdfDateinamen(receipts: List<DonationReceipt>): List<String> {
        val benutzt = mutableSetOf<String>()
        return receipts.map { r ->
            val basis = "Zuwendungsbestaetigung_${dateinameTeil(r.receiptNumber).ifEmpty { "ohne-Nr" }}_${dateinameTeil(r.donorName).ifEmpty { "Spender" }}"
            var name = "$basis.pdf"
            var n = 2
            while (name.lowercase() in benutzt) name = "${basis}_${n++}.pdf"
            benutzt.add(name.lowercase())
            name
        }
    }

    fun zipDateiname(clubName: String, anzahl: Int): String =
        "Zuwendungsbestaetigungen_${dateinameTeil(clubName).ifEmpty { "Verein" }}_${anzahl}_Stueck.zip"
}
