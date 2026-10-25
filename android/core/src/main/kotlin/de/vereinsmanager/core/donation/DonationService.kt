package de.vereinsmanager.core.donation

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

/** Angaben, die auf dem Vordruck der Zuwendungsbestätigung stehen. */
data class Steuerangaben(
    val finanzamt: String,
    val steuernummer: String,
    val freistellungsDatum: String,
    val veranlagungszeitraum: String,
    val feststellungsDatum: String,
    /** Zweck mit Gesetzesverweis, ohne führendes "Förderung" */
    val zweckMitVerweis: String,
    /** Zweck ohne Klammerverweis */
    val zweckKurz: String,
    /** Zweck ohne Klammerverweis, mit "Förderung" */
    val zweckSatzung: String,
)

/** Kotlin-Fassung von src/services/donationService.ts (ohne PDF-Zeichnung). */
object DonationService {

    private val UNITS = listOf("", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun")
    private val TEENS = listOf("zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn")
    private val TENS = listOf("", "zehn", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig")

    /** [one]: Wie eine abschließende 1 geschrieben wird ("eins" am Ende, "ein" vor "tausend"). */
    private fun below100(n: Int, one: String): String = when {
        n == 0 -> ""
        n == 1 -> one
        n < 10 -> UNITS[n]
        n < 20 -> TEENS[n - 10]
        n % 10 == 0 -> TENS[n / 10]
        n % 10 == 1 -> "einund" + TENS[n / 10]
        else -> UNITS[n % 10] + "und" + TENS[n / 10]
    }

    private fun below1000(n: Int, one: String): String {
        if (n == 0) return ""
        val h = n / 100
        val rest = n % 100
        var s = ""
        if (h > 0) s += (if (h == 1) "ein" else UNITS[h]) + "hundert"
        if (rest > 0) s += below100(rest, one)
        return s
    }

    private fun number(n: Int): String {
        if (n == 0) return "null"
        require(n in 1..999_999_999) { "Betrag zu groß für die Schreibweise in Worten." }
        val millions = n / 1_000_000
        val thousands = n % 1_000_000 / 1000
        val rem = n % 1000
        var s = ""
        if (millions > 0) s += if (millions == 1) "eine Million " else below1000(millions, "eine") + " Millionen "
        if (thousands > 0) s += if (thousands == 1) "eintausend" else below1000(thousands, "ein") + "tausend"
        if (rem > 0) s += below1000(rem, "eins")
        return s.trim()
    }

    /**
     * Betrag in Worten für die Zuwendungsbestätigung, z. B. 1500 -> "Eintausendfünfhundert Euro".
     *
     * Abweichung vom Desktop (dort Fehler, für Desktop vorgemerkt): "Ein Euro" statt "Eins Euro",
     * "Einhunderteins" statt "Einhundertein" und "ein Cent" statt "eins Cent".
     */
    fun numberToGermanWords(amount: BigDecimal): String {
        if (amount.signum() <= 0) return "Null Euro"
        val rounded = amount.setScale(2, RoundingMode.HALF_UP)
        val euros = rounded.toBigInteger().toInt()
        val cents = rounded.remainder(BigDecimal.ONE).movePointRight(2).toInt()

        var wordEuro = if (euros == 1) "ein" else number(euros)
        wordEuro = wordEuro.replaceFirstChar { it.uppercase() }
        var result = "$wordEuro Euro"
        if (cents > 0) {
            val wordCents = if (cents == 1) "ein" else number(cents)
            result += " und $wordCents Cent"
        }
        return result
    }

    /** Ein Adressblock der Vereinsadresse als bis zu zwei Zeilen. */
    fun adresszeilen(address: ClubAddress?): List<String> = when (address) {
        null -> emptyList()
        is ClubAddress.FreeText -> address.text.split(Regex("\\n|,\\s*")).map { it.trim() }.filter { it.isNotEmpty() }
        is ClubAddress.Structured -> {
            val strasse = listOf(address.street, address.houseNumber).filter { it.isNotEmpty() }.joinToString(" ").trim()
            val ort = listOf(address.zip, address.city).filter { it.isNotEmpty() }.joinToString(" ").trim()
            listOf(strasse, ort).filter { it.isNotEmpty() }
        }
    }

    private val ISO = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$")

    /** JJJJ-MM-TT -> TT.MM.JJJJ; Freitext (z. B. "24.07.2025") bleibt unverändert. */
    fun datumFuerFormular(s: String?): String {
        val t = (s ?: "").trim()
        val m = ISO.matchEntire(t) ?: return t
        return "${m.groupValues[3]}.${m.groupValues[2]}.${m.groupValues[1]}"
    }

    /**
     * Steuerliche Angaben für den Vordruck. Was auf der Bescheinigung selbst steht, hat Vorrang
     * (eine ausgestellte Bescheinigung bleibt beim erneuten Drucken unverändert); fehlt es dort,
     * kommt es aus den Vereinsdaten. Es wird nichts erfunden.
     */
    fun ermittleSteuerangaben(receipt: DonationReceipt, settings: ClubTaxSettings): Steuerangaben {
        fun first(a: String?, b: String?) = a?.takeIf { it.isNotEmpty() } ?: b ?: ""
        val zweckRoh = first(receipt.promotedPurpose, settings.promotedPurposes).trim()
        val ohneFoerderung = zweckRoh.replace(Regex("^(die\\s+)?förderung\\s+", RegexOption.IGNORE_CASE), "").trim()
        fun ohneVerweis(s: String) =
            s.replace(Regex("\\s*\\(\\s*§[^)]*\\)"), "").replace(Regex("\\s{2,}"), " ").trim()
        return Steuerangaben(
            finanzamt = first(receipt.taxOffice, settings.taxOffice).trim(),
            steuernummer = first(receipt.taxNumber, settings.taxNumber).trim(),
            freistellungsDatum = datumFuerFormular(first(receipt.exemptionDate, settings.taxExemptionDate)),
            veranlagungszeitraum = first(receipt.assessmentPeriod, settings.taxAssessmentPeriod).trim(),
            feststellungsDatum = datumFuerFormular(first(receipt.statementDate, settings.taxStatementDate)),
            zweckMitVerweis = ohneFoerderung,
            zweckKurz = ohneVerweis(ohneFoerderung),
            zweckSatzung = ohneVerweis(zweckRoh),
        )
    }

    /** Ort aus der Vereinsadresse (Objekt oder Freitext "… 17235 Neustrelitz"); leer, wenn nicht erkennbar. */
    fun vereinsOrt(address: ClubAddress?): String = when (address) {
        null -> ""
        is ClubAddress.Structured -> address.city.trim()
        is ClubAddress.FreeText ->
            Regex("\\b\\d{5}\\s+([^,\\n]+)").find(address.text)?.groupValues?.get(1)?.trim() ?: ""
    }

    /** Vorbelegung für "Ort, Datum": "Neustrelitz, 28.07.2025" (ohne Ort nur das Datum). */
    fun standardOrtUndDatum(settings: ClubTaxSettings, datum: LocalDate = LocalDate.now()): String {
        val ort = vereinsOrt(settings.address)
        val d = String.format(java.util.Locale.ROOT, "%02d.%02d.%d", datum.dayOfMonth, datum.monthValue, datum.year)
        return if (ort.isNotEmpty()) "$ort, $d" else d
    }

    /** Welche für den Vordruck nötigen Angaben in den Vereinsdaten noch fehlen. */
    fun fehlendeSteuerangaben(s: ClubTaxSettings): List<String> {
        val fehlt = mutableListOf<String>()
        if (s.taxNumber.isBlank()) fehlt.add("Steuernummer")
        if (s.taxOffice.isBlank()) fehlt.add("Zuständiges Finanzamt")
        if (s.taxExemptionDate.isBlank() && s.taxStatementDate.isBlank()) fehlt.add("Datum Freistellungs- oder Feststellungsbescheid")
        if (s.taxAssessmentPeriod.isBlank() && s.taxExemptionDate.isNotBlank()) fehlt.add("Veranlagungszeitraum")
        if (s.promotedPurposes.isBlank()) fehlt.add("Steuerbegünstigte Zwecke")
        return fehlt
    }
}
