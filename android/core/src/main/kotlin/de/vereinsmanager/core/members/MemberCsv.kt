package de.vereinsmanager.core.members

import de.vereinsmanager.core.store.DocumentStore
import java.math.BigDecimal
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Die 29 Felder, denen eine CSV-Spalte zugeordnet werden kann (Reihenfolge wie am Desktop). */
enum class ImportField(val label: String) {
    NUMMER("Mitgliedsnummer"), VORNAME("Vorname"), NACHNAME("Nachname"), VOLLNAME("Vollständiger Name"),
    GESCHLECHT("Geschlecht"), GEBURTSDATUM("Geburtsdatum"), STRASSE("Straße"), HAUSNUMMER("Hausnummer"),
    KOMPLETTADRESSE("Komplettadresse"), PLZ("PLZ"), ORT("Ort"), LAND("Land"), TELEFON("Telefon"), EMAIL("E-Mail"),
    SPARTE("Abteilung / Sparte"), STATUS("Status"), TYP("Mitgliedstyp"), BEITRAG("Beitrag"),
    ZAHLWEISE("Zahlungsweise"), ZAHLART("Zahlungsart"), IBAN("IBAN"), BIC("BIC"), BANK("Bank"),
    KONTOINHABER("Kontoinhaber"), MANDATSDATUM("Mandatsdatum"), MANDATSREFERENZ("Mandatsreferenz"),
    EINTRITT("Eintritt"), AUSTRITT("Austritt"), NOTIZEN("Notizen"),
}

/** Zuordnung Feld → Spaltenüberschrift. */
typealias ColumnMapping = Map<ImportField, String>

data class CsvTable(val headers: List<String>, val rows: List<Map<String, String>>)

/** Eine Zeile der Vorschau: das umgewandelte Mitglied, Warnungen und ob es das Mitglied schon gibt. */
data class ImportRow(
    val index: Int,
    val raw: Map<String, String>,
    val warnings: List<String>,
    /** Kennung des vorhandenen Mitglieds (gleiche Nummer oder gleicher Name), sonst null. */
    val duplicateOf: String?,
    val form: MemberForm,
    /** Welche Felder aus der Datei stammen (nur diese überschreiben beim "Aktualisieren"). */
    val present: Set<String>,
) {
    val isDuplicate get() = duplicateOf != null
}

enum class DuplicateStrategy { UPDATE, SKIP, CREATE_ALWAYS }

data class CsvImportReport(val added: Int, val updated: Int, val skipped: Int)

object MemberCsv {
    // ---- Text einlesen ----

    /** Liest Bytes als UTF-8; ist die Datei kein gültiges UTF-8 (typisch: Excel in Windows-Kodierung), als Windows-1252. */
    fun decode(bytes: ByteArray): Pair<String, Boolean> {
        return try {
            val d = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            d.decode(ByteBuffer.wrap(bytes)).toString() to false
        } catch (e: CharacterCodingException) {
            String(bytes, Charset.forName("windows-1252")) to true
        }
    }

    // ---- CSV ----

    /** Trennzeichen und Anführungszeichen wie am Desktop: Semikolon, Komma oder Tabulator aus den ersten drei Zeilen; bei Gleichstand Semikolon. */
    fun parse(text: String): CsvTable {
        val clean = text.removePrefix("\uFEFF").trim()
        if (clean.isEmpty()) return CsvTable(emptyList(), emptyList())

        val firstLines = clean.split(Regex("\r?\n")).take(3).joinToString("\n")
        val semis = firstLines.count { it == ';' }
        val tabs = firstLines.count { it == '\t' }
        val commas = firstLines.count { it == ',' }
        val delimiter = if (semis >= commas && semis >= tabs) ';' else if (tabs > commas && tabs > semis) '\t' else ','

        val all = ArrayList<List<String>>()
        var row = ArrayList<String>()
        val cur = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < clean.length) {
            val c = clean[i]
            val next = if (i + 1 < clean.length) clean[i + 1] else null
            if (inQuotes) {
                if (c == '"' && next == '"') { cur.append('"'); i++ }
                else if (c == '"') inQuotes = false
                else cur.append(c)
            } else {
                when (c) {
                    '"' -> inQuotes = true
                    delimiter -> { row.add(cur.toString().trim()); cur.setLength(0) }
                    '\r' -> {}
                    '\n' -> {
                        row.add(cur.toString().trim())
                        if (row.any { it.isNotEmpty() }) all.add(row)
                        row = ArrayList(); cur.setLength(0)
                    }
                    else -> cur.append(c)
                }
            }
            i++
        }
        if (cur.isNotEmpty() || row.isNotEmpty()) {
            row.add(cur.toString().trim())
            if (row.any { it.isNotEmpty() }) all.add(row)
        }
        if (all.isEmpty()) return CsvTable(emptyList(), emptyList())

        val raw = all[0].map { stripQuote(it).trim() }
        val seen = HashMap<String, Int>()
        val headers = raw.map { h ->
            val name = h.ifEmpty { "Spalte" }
            val n = (seen[name] ?: 0) + 1
            seen[name] = n
            if (n > 1) "${name}_$n" else name
        }
        val rows = (1 until all.size).map { r ->
            val values = all[r]
            LinkedHashMap<String, String>().also { m ->
                headers.forEachIndexed { idx, h -> m[h] = stripQuote(values.getOrElse(idx) { "" }).trim() }
            }
        }
        return CsvTable(headers, rows)
    }

    /** Entfernt je ein Anführungszeichen oder Apostroph am Anfang und am Ende (wie am Desktop). */
    private fun stripQuote(s: String): String {
        var t = s
        if (t.isNotEmpty() && (t.first() == '"' || t.first() == '\'')) t = t.substring(1)
        if (t.isNotEmpty() && (t.last() == '"' || t.last() == '\'')) t = t.substring(0, t.length - 1)
        return t
    }

    // ---- Spalten erkennen ----

    private val REGELN: List<Pair<ImportField, List<String>>> = listOf(
        ImportField.NUMMER to listOf("mitgliedsnummer", "mitgliedsnr", "mitgliedsno", "mgnr", "mgnr", "nr", "mitgliedsid", "membernumber", "memberno", "memberid", "ausweisnummer"),
        ImportField.VORNAME to listOf("vorname", "firstname", "givenname", "vname", "rufname"),
        ImportField.NACHNAME to listOf("nachname", "lastname", "familienname", "surname", "nname"),
        ImportField.VOLLNAME to listOf("name", "fullname", "vollständigername", "mitgliedsname", "mitglied"),
        ImportField.GESCHLECHT to listOf("geschlecht", "gender", "anrede", "sex"),
        ImportField.GEBURTSDATUM to listOf("geburtsdatum", "geburtstag", "gebdatum", "birthdate", "dob", "geboren", "geburtsjahr", "geb"),
        ImportField.STRASSE to listOf("straße", "strasse", "str", "street", "straßenname", "anschrift"),
        ImportField.HAUSNUMMER to listOf("hausnummer", "hausnr", "hnr", "housenumber", "nr"),
        ImportField.KOMPLETTADRESSE to listOf("adresse", "address", "wohnadresse", "straßeundhausnummer"),
        ImportField.PLZ to listOf("plz", "postleitzahl", "zip", "zipcode", "postalcode"),
        ImportField.ORT to listOf("ort", "stadt", "city", "wohnort", "gemeinde"),
        ImportField.LAND to listOf("land", "country", "staat", "nation"),
        ImportField.TELEFON to listOf("telefon", "telefonnummer", "phone", "mobil", "handy", "mobilnummer", "tel", "festnetz"),
        ImportField.EMAIL to listOf("email", "emailadresse", "mail", "mailadresse", "epost"),
        ImportField.SPARTE to listOf("abteilung", "sparte", "department", "sportart", "sektion", "bereich", "gruppe"),
        ImportField.STATUS to listOf("status", "mitgliedsstatus", "mitgliedschaftsstatus", "zustand"),
        ImportField.TYP to listOf("mitgliedschaftstyp", "typ", "beitragsgruppe", "tarif", "art", "mitgliedsart", "beitragsart"),
        ImportField.BEITRAG to listOf("beitrag", "beitragshöhe", "betrag", "fee", "jahresbeitrag", "monatsbeitrag", "summe", "kosten"),
        ImportField.ZAHLWEISE to listOf("zahlungsweise", "zahlungsintervall", "intervall", "periode", "turnus", "abrechnung", "frequenz"),
        ImportField.ZAHLART to listOf("zahlungsmethode", "zahlungsart", "zahlweg", "bezahlung", "paymentmethod"),
        ImportField.IBAN to listOf("iban", "kontonummer", "bankkonto", "sepaiban"),
        ImportField.BIC to listOf("bic", "swift", "swiftbic", "blz", "bankleitzahl"),
        ImportField.BANK to listOf("bank", "bankname", "kreditinstitut", "institut", "sparkasse"),
        ImportField.KONTOINHABER to listOf("kontoinhaber", "kontoinhaberin", "inhaber", "accountholder"),
        ImportField.MANDATSDATUM to listOf("mandatsdatum", "sepamandat", "mandaterteilt", "mandatedate"),
        ImportField.MANDATSREFERENZ to listOf("mandatsreferenz", "mandatsref", "mandatnr", "mandateno"),
        ImportField.EINTRITT to listOf("eintritt", "eintrittsdatum", "beitritt", "beitrittsdatum", "mitgliedseit", "entrydate", "startdate", "beginn"),
        ImportField.AUSTRITT to listOf("austritt", "austrittsdatum", "kündigung", "kündigungsdatum", "exitdate", "endedatum"),
        ImportField.NOTIZEN to listOf("notizen", "bemerkungen", "bemerkung", "kommentar", "anmerkung", "notes", "info"),
    )

    private fun norm(s: String) = s.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9äöüß]"), "")

    /**
     * Ordnet Überschriften den Feldern zu. Gegenüber dem Desktop verbessert: Erst zählen genaue Treffer, dann
     * Teiltreffer; "Vollständiger Name" wird nur bei genauem Treffer gewählt. Sonst fing die Überschrift
     * "Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)" der eigenen Vorlage wegen des Wortes "Mitglied" das Feld
     * Vollständiger Name ein, wurde danach verworfen, und der Status blieb unzugeordnet.
     */
    fun erkenneSpalten(headers: List<String>): ColumnMapping {
        val map = LinkedHashMap<ImportField, String>()
        val used = HashSet<String>()
        for (h in headers) {
            val n = norm(h)
            for ((field, aliases) in REGELN) {
                if (field !in map && n in aliases) { map[field] = h; used.add(h); break }
            }
        }
        for (h in headers) {
            if (h in used) continue
            val n = norm(h)
            for ((field, aliases) in REGELN) {
                if (field in map) continue
                val ok = if (field == ImportField.VOLLNAME) n in aliases else aliases.any { n.contains(it) }
                if (ok) { map[field] = h; used.add(h); break }
            }
        }
        if (ImportField.VORNAME in map && ImportField.NACHNAME in map) map.remove(ImportField.VOLLNAME)
        if (ImportField.STRASSE in map && ImportField.HAUSNUMMER in map) map.remove(ImportField.KOMPLETTADRESSE)
        return map
    }

    // ---- Werte umwandeln ----

    /** TT.MM.JJJJ, JJJJ-MM-TT (auch mit Uhrzeit dahinter), TT/MM/JJJJ oder ein reines Jahr. Unmögliche Daten ergeben null. */
    fun datum(value: String?): String? {
        val v = value?.trim().orEmpty()
        if (v.isEmpty()) return null
        fun mk(y: String, m: String, d: String): String? = try {
            LocalDate.of(y.toInt(), m.toInt(), d.toInt()).toString()
        } catch (e: Exception) { null }
        Regex("^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})$").find(v)?.let { return mk(it.groupValues[3], it.groupValues[2], it.groupValues[1]) }
        Regex("^(\\d{4})-(\\d{1,2})-(\\d{1,2})").find(v)?.let { return mk(it.groupValues[1], it.groupValues[2], it.groupValues[3]) }
        Regex("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$").find(v)?.let { return mk(it.groupValues[3], it.groupValues[2], it.groupValues[1]) }
        if (Regex("^\\d{4}$").matches(v)) return mk(v, "1", "1")
        return null
    }

    /** Deutsche und englische Schreibweise ("1.250,50", "1,250.50", "€ 15,00"); nie negativ. Wie am Desktop: "1.250" ist 1,25. */
    fun betrag(value: String?): BigDecimal {
        if (value.isNullOrEmpty()) return BigDecimal.ZERO
        var c = value.replace(Regex("[^0-9,.-]"), "").trim()
        if (c.isEmpty()) return BigDecimal.ZERO
        c = if (c.contains(',') && c.contains('.')) {
            if (c.lastIndexOf(',') > c.lastIndexOf('.')) c.replace(".", "").replaceFirst(',', '.') else c.replace(",", "")
        } else if (c.contains(',')) c.replaceFirst(',', '.') else c
        val m = Regex("^[+-]?(\\d+\\.?\\d*|\\.\\d+)").find(c) ?: return BigDecimal.ZERO
        val n = m.value.toBigDecimalOrNull() ?: return BigDecimal.ZERO
        return if (n.signum() < 0) BigDecimal.ZERO else n
    }

    fun namenTeilen(full: String): Pair<String, String> {
        val clean = full.trim()
        if (clean.isEmpty()) return "" to ""
        if (clean.contains(',')) {
            val parts = clean.split(',').map { it.trim() }
            return parts.drop(1).joinToString(" ") to (parts.firstOrNull() ?: "")
        }
        val parts = clean.split(Regex("\\s+")).toMutableList()
        if (parts.size == 1) return parts[0] to ""
        val last = parts.removeAt(parts.size - 1)
        return parts.joinToString(" ") to last
    }

    fun adresseTeilen(address: String): Pair<String, String> {
        val clean = address.trim()
        val m = Regex("^(.*?)(?:\\s+(\\d+[a-zA-Z\\s/-]*))$").find(clean)
        return if (m != null) m.groupValues[1].trim() to m.groupValues[2].trim() else clean to ""
    }

    fun geschlecht(v: String?): String {
        if (v.isNullOrEmpty()) return "none"
        val l = v.lowercase(Locale.ROOT).trim()
        if (l.startsWith("m") || l == "herr" || l == "männlich" || l == "male") return "m"
        if (l.startsWith("w") || l.startsWith("f") || l == "frau" || l == "weiblich" || l == "female") return "w"
        if (l.startsWith("d") || l == "divers") return "d"
        return "none"
    }

    fun status(v: String?): String {
        if (v.isNullOrEmpty()) return "active"
        val l = v.lowercase(Locale.ROOT).trim()
        return when {
            "passiv" in l -> "passive"
            "ehren" in l -> "honorary"
            "ruhend" in l || "ausgesetzt" in l -> "suspended"
            "gekündigt" in l || "austritt" in l || "ausgetreten" in l || "beendet" in l -> "terminated"
            else -> "active"
        }
    }

    fun mitgliedstyp(v: String?, age: Long?): String {
        if (v.isNullOrEmpty()) return if (age != null && age < 18) "youth" else "full"
        val l = v.lowercase(Locale.ROOT).trim()
        return when {
            "jugend" in l || "kind" in l || "schüler" in l || "youth" in l -> "youth"
            "ermäßigt" in l || "student" in l || "senior" in l || "azubi" in l -> "reduced"
            "familie" in l -> "family"
            "förder" in l || "sponsor" in l -> "supporting"
            "ehren" in l -> "honorary"
            else -> "full"
        }
    }

    fun zahlungsart(v: String?, iban: String?): String {
        if (iban != null && iban.trim().length >= 10) return "sepa"
        if (v.isNullOrEmpty()) return "transfer"
        val l = v.lowercase(Locale.ROOT).trim()
        return when {
            "sepa" in l || "lastschrift" in l || "einzug" in l -> "sepa"
            "bar" in l -> "cash"
            "dauerauftrag" in l -> "standing_order"
            else -> "transfer"
        }
    }

    fun zahlweise(v: String?): String {
        if (v.isNullOrEmpty()) return "yearly"
        val l = v.lowercase(Locale.ROOT).trim()
        return when {
            "monat" in l -> "monthly"
            "quartal" in l || "vierteljahr" in l -> "quarterly"
            "halbjahr" in l || "semester" in l -> "half_yearly"
            else -> "yearly"
        }
    }

    // ---- Zeilen umwandeln ----

    /**
     * Wandelt die Zeilen um. Gegenüber dem Desktop: Fehlende Mitgliedsnummern werden aus der höchsten
     * vergebenen Nummer fortgezählt (Entscheidung 2), unmögliche Daten ergeben eine Warnung statt eines
     * falschen Datums, und leere Zellen zählen nicht als "mitgeliefert" (wichtig beim Aktualisieren).
     */
    fun umwandeln(
        rows: List<Map<String, String>>, mapping: ColumnMapping, existing: List<Member>,
        departments: List<String>, defaultDepartment: String?, today: LocalDate,
    ): List<ImportRow> {
        val byNumber = HashMap<String, Member>()
        val byName = HashMap<String, Member>()
        for (m in existing) {
            if (m.number.isNotEmpty()) byNumber[m.number.lowercase(Locale.ROOT).trim()] = m
            byName[m.lastName.lowercase(Locale.ROOT).trim() + "_" + m.firstName.lowercase(Locale.ROOT).trim()] = m
        }
        // Schon vergebene Nummern: Bestand plus alle ausdrücklich genannten Nummern der Datei.
        val taken = LinkedHashSet<String>(existing.map { it.number })
        mapping[ImportField.NUMMER]?.let { col -> rows.forEach { r -> r[col]?.takeIf { it.isNotEmpty() }?.let { taken.add(it) } } }

        return rows.mapIndexed { index, row ->
            fun cell(f: ImportField): String = mapping[f]?.let { row[it] } ?: ""
            fun mapped(f: ImportField): Boolean = cell(f).isNotEmpty()
            val warnings = ArrayList<String>()
            val present = LinkedHashSet<String>()

            var first = cell(ImportField.VORNAME)
            var last = cell(ImportField.NACHNAME)
            if (first.isNotEmpty()) present.add("firstName")
            if (last.isNotEmpty()) present.add("lastName")
            if ((first.isEmpty() || last.isEmpty()) && cell(ImportField.VOLLNAME).isNotEmpty()) {
                val (f, l) = namenTeilen(cell(ImportField.VOLLNAME))
                if (first.isEmpty()) { first = f; if (f.isNotEmpty()) present.add("firstName") }
                if (last.isEmpty()) { last = l; if (l.isNotEmpty()) present.add("lastName") }
            }
            if (last.isEmpty() && first.isEmpty()) warnings.add("Vor- oder Nachname fehlt.")

            var number = cell(ImportField.NUMMER)
            if (number.isNotEmpty()) present.add("number")
            else { number = MemberRules.naechsteNummer(taken); taken.add(number) }

            val birthText = cell(ImportField.GEBURTSDATUM)
            val birth = datum(birthText)
            if (birthText.isNotEmpty() && birth == null) warnings.add("Geburtsdatum „$birthText“ ist nicht lesbar.")
            if (birth != null) present.add("birthDate")
            val age = birth?.let { ChronoUnit.YEARS.between(LocalDate.parse(it), today) }

            var street = cell(ImportField.STRASSE)
            var house = cell(ImportField.HAUSNUMMER)
            if (street.isEmpty() && cell(ImportField.KOMPLETTADRESSE).isNotEmpty()) {
                val (s, h) = adresseTeilen(cell(ImportField.KOMPLETTADRESSE)); street = s; house = h
            }
            if (street.isNotEmpty()) present.add("street")
            if (house.isNotEmpty()) present.add("houseNumber")
            val zip = cell(ImportField.PLZ)
            val city = cell(ImportField.ORT)
            val country = cell(ImportField.LAND).ifEmpty { "Deutschland" }
            if (zip.isNotEmpty()) present.add("zip")
            if (city.isNotEmpty()) present.add("city")
            if (mapped(ImportField.LAND)) present.add("country")
            val phone = cell(ImportField.TELEFON)
            val email = cell(ImportField.EMAIL)
            if (phone.isNotEmpty()) present.add("phone")
            if (email.isNotEmpty()) present.add("email")

            var dept = cell(ImportField.SPARTE)
            if (dept.isNotEmpty()) present.add("department")
            else dept = defaultDepartment?.takeIf { it.isNotEmpty() } ?: departments.firstOrNull() ?: "Hauptverein"

            val statusV = status(cell(ImportField.STATUS))
            val typeV = mitgliedstyp(cell(ImportField.TYP), age)
            if (mapped(ImportField.STATUS)) present.add("status")
            if (mapped(ImportField.TYP)) present.add("type")

            var fee = betrag(cell(ImportField.BEITRAG))
            if (fee.signum() > 0) present.add("fee")
            if (fee.signum() == 0 && statusV == "active" && typeV != "honorary") {
                fee = when (typeV) { "youth" -> BigDecimal("60"); "reduced" -> BigDecimal("80"); else -> BigDecimal("120") }
            }
            val period = zahlweise(cell(ImportField.ZAHLWEISE))
            if (mapped(ImportField.ZAHLWEISE)) present.add("feePeriod")

            val iban = cell(ImportField.IBAN).replace(Regex("\\s"), "").uppercase(Locale.ROOT)
            val bic = cell(ImportField.BIC).replace(Regex("\\s"), "").uppercase(Locale.ROOT)
            val bank = cell(ImportField.BANK)
            val fullName = "$first $last".trim()
            val holder = cell(ImportField.KONTOINHABER).ifEmpty { fullName }
            val pay = zahlungsart(cell(ImportField.ZAHLART), iban)
            if (iban.isNotEmpty()) present.add("iban")
            if (bic.isNotEmpty()) present.add("bic")
            if (bank.isNotEmpty()) present.add("bankName")
            if (mapped(ImportField.KONTOINHABER)) present.add("accountHolder")
            if (mapped(ImportField.ZAHLART) || iban.isNotEmpty()) present.add("paymentMethod")
            if (iban.isNotEmpty() && !iban.startsWith("DE") && iban.length < 15) warnings.add("IBAN ($iban) scheint unvollständig zu sein.")

            val entryText = cell(ImportField.EINTRITT)
            val entryParsed = datum(entryText)
            if (entryText.isNotEmpty() && entryParsed == null) warnings.add("Eintrittsdatum „$entryText“ ist nicht lesbar; heute eingesetzt.")
            if (entryParsed != null) present.add("entryDate")
            val entry = entryParsed ?: today.toString()
            val exitText = cell(ImportField.AUSTRITT)
            val exit = datum(exitText)
            if (exitText.isNotEmpty() && exit == null) warnings.add("Austrittsdatum „$exitText“ ist nicht lesbar.")
            if (exit != null) present.add("exitDate")
            val mandateParsed = datum(cell(ImportField.MANDATSDATUM))
            if (mandateParsed != null) present.add("mandateDate")
            val mandateDate = mandateParsed ?: if (iban.isNotEmpty()) entry else ""
            val refMapped = mapping.containsKey(ImportField.MANDATSREFERENZ)
            if (cell(ImportField.MANDATSREFERENZ).isNotEmpty()) present.add("mandateReference")
            val mandateRef = if (refMapped) cell(ImportField.MANDATSREFERENZ) else if (iban.isNotEmpty()) "MANDAT-$number" else ""
            val gender = geschlecht(cell(ImportField.GESCHLECHT))
            if (mapped(ImportField.GESCHLECHT)) present.add("gender")
            val notes = cell(ImportField.NOTIZEN)
            if (notes.isNotEmpty()) present.add("notes")

            var dup: String? = null
            byNumber[number.lowercase(Locale.ROOT).trim()]?.let { dup = it.id }
            if (dup == null && last.isNotEmpty() && first.isNotEmpty()) {
                byName[last.lowercase(Locale.ROOT).trim() + "_" + first.lowercase(Locale.ROOT).trim()]?.let { dup = it.id }
            }

            val form = MemberRules.neu(number, departments, today).copy(
                id = dup ?: "mem-${System.currentTimeMillis()}-$index-${Zeit.zufall(4)}",
                firstName = first, lastName = last, gender = gender, birthDate = birth ?: "",
                street = street, houseNumber = house, zip = zip, city = city, country = country,
                phone = phone, email = email, entryDate = entry, exitDate = exit ?: "",
                status = statusV, department = dept, type = typeV, fee = MemberRules.formatFee(fee),
                feePeriod = period, paymentMethod = pay, iban = iban, bic = bic, bankName = bank,
                accountHolder = holder, mandateDate = mandateDate, mandateReference = mandateRef, notes = notes,
            )
            ImportRow(index, row, warnings, dup, form, present)
        }
    }

    // ---- Schreiben ----

    private fun uebernehmen(basis: MemberForm, neu: MemberForm, p: Set<String>): MemberForm {
        var f = basis
        if ("number" in p) f = f.copy(number = neu.number)
        if ("firstName" in p) f = f.copy(firstName = neu.firstName)
        if ("lastName" in p) f = f.copy(lastName = neu.lastName)
        if ("gender" in p) f = f.copy(gender = neu.gender)
        if ("birthDate" in p) f = f.copy(birthDate = neu.birthDate)
        if ("street" in p) f = f.copy(street = neu.street)
        if ("houseNumber" in p) f = f.copy(houseNumber = neu.houseNumber)
        if ("zip" in p) f = f.copy(zip = neu.zip)
        if ("city" in p) f = f.copy(city = neu.city)
        if ("country" in p) f = f.copy(country = neu.country)
        if ("phone" in p) f = f.copy(phone = neu.phone)
        if ("email" in p) f = f.copy(email = neu.email)
        if ("department" in p) f = f.copy(department = neu.department)
        if ("status" in p) f = f.copy(status = neu.status)
        if ("type" in p) f = f.copy(type = neu.type)
        if ("fee" in p) f = f.copy(fee = neu.fee)
        if ("feePeriod" in p) f = f.copy(feePeriod = neu.feePeriod)
        if ("paymentMethod" in p) f = f.copy(paymentMethod = neu.paymentMethod)
        if ("iban" in p) f = f.copy(iban = neu.iban)
        if ("bic" in p) f = f.copy(bic = neu.bic)
        if ("bankName" in p) f = f.copy(bankName = neu.bankName)
        if ("accountHolder" in p) f = f.copy(accountHolder = neu.accountHolder)
        if ("mandateDate" in p) f = f.copy(mandateDate = neu.mandateDate)
        if ("mandateReference" in p) f = f.copy(mandateReference = neu.mandateReference)
        if ("entryDate" in p) f = f.copy(entryDate = neu.entryDate)
        if ("exitDate" in p) f = f.copy(exitDate = neu.exitDate)
        if ("notes" in p) f = f.copy(notes = neu.notes)
        return f
    }

    /**
     * Schreibt die ausgewählten Zeilen. "Aktualisieren" überschreibt am vorhandenen Mitglied nur Felder, die in der
     * Datei einen Wert hatten (Entscheidung 3); alles andere bleibt. Eine schon vergebene Nummer wird bei neuen
     * Mitgliedern durch die nächste freie ersetzt. Ein einziger Sammel-Protokolleintrag. Alles oder nichts.
     */
    fun importieren(
        store: DocumentStore, rows: List<ImportRow>, strategy: DuplicateStrategy, now: ZonedDateTime = ZonedDateTime.now(),
    ): CsvImportReport = store.transaction {
        val taken = LinkedHashSet<String>(store.all(MemberStore.AREA).map { Member.from(it).number })
        var added = 0
        var updated = 0
        var skipped = 0
        for (r in rows) {
            val dupId = r.duplicateOf
            if (dupId != null && strategy == DuplicateStrategy.SKIP) { skipped++; continue }
            if (dupId != null && strategy == DuplicateStrategy.UPDATE) {
                val alt = store.get(MemberStore.AREA, dupId)
                if (alt != null) {
                    val f = uebernehmen(MemberRules.von(Member.from(alt)), r.form, r.present)
                    store.put(MemberStore.AREA, dupId, MemberDocument.build(f, alt, now))
                    updated++
                    continue
                }
            }
            var f = r.form
            if (dupId != null) f = f.copy(id = "mem-${now.toInstant().toEpochMilli()}-${r.index}-${Zeit.zufall(4)}")
            if (f.number.lowercase(Locale.ROOT) in taken.map { it.lowercase(Locale.ROOT) }) {
                val alt = f.number
                val n = MemberRules.naechsteNummer(taken)
                f = f.copy(number = n, mandateReference = if (f.mandateReference == "MANDAT-$alt") "MANDAT-$n" else f.mandateReference)
            }
            taken.add(f.number)
            store.put(MemberStore.AREA, f.id, MemberDocument.build(f, null, now))
            added++
        }
        if (added + updated > 0) {
            val log = MemberAudit.sammelImport(added, updated, now)
            store.put(MemberStore.LOG, (log["id"] as kotlinx.serialization.json.JsonPrimitive).content, log)
        }
        CsvImportReport(added, updated, skipped)
    }

    // ---- Vorlage ----

    private fun esc(f: String) = if (f.contains(';') || f.contains('"') || f.contains('\n')) "\"" + f.replace("\"", "\"\"") + "\"" else f

    /** Muster-CSV mit 23 Spalten und drei Beispielzeilen, mit BOM für Excel. */
    fun vorlage(departments: List<String>): String {
        val headers = listOf(
            "Mitgliedsnummer", "Vorname", "Nachname", "Geschlecht (m/w/d)", "Geburtsdatum (TT.MM.JJJJ)", "Straße",
            "Hausnummer", "PLZ", "Ort", "Telefon", "E-Mail", "Sparte/Abteilung",
            "Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)", "Beitragsgruppe (Vollzahler/Jugend/Ermäßigt/Familie)",
            "Jahresbeitrag in Euro", "Zahlungsweise (Jährlich/Monatlich/Halbjährlich/Quartal)",
            "Zahlungsmethode (SEPA/Überweisung/Bar)", "IBAN", "BIC", "Bankname", "Kontoinhaber",
            "Eintrittsdatum (TT.MM.JJJJ)", "Notizen",
        )
        val d1 = departments.getOrNull(0) ?: "Fußball"
        val d2 = departments.getOrNull(1) ?: "Tennis"
        val rows = listOf(
            listOf("M-0101", "Max", "Mustermann", "m", "15.04.1988", "Hauptstraße", "14a", "12345", "Musterstadt", "0171 1234567",
                "max.mustermann@beispiel.de", d1, "Aktiv", "Vollzahler", "120,00", "Jährlich", "SEPA", "DE12500105170648489890",
                "HELGDEF1822", "Frankfurter Sparkasse", "Max Mustermann", "01.01.2020", "Mannschaftsführer 1. Herren"),
            listOf("M-0102", "Sophie", "Schneider", "w", "22.09.2010", "Sportplatzweg", "7", "12345", "Musterstadt", "0151 9876543",
                "eltern.schneider@beispiel.de", d2, "Aktiv", "Jugend", "60,00", "Jährlich", "SEPA", "DE89370400440532013000",
                "DRESDEFFXXX", "Commerzbank", "Thomas Schneider", "15.03.2022", "Jugendförderkader"),
            listOf("M-0103", "Klaus", "Bauer", "m", "05.11.1965", "Waldweg", "3", "12345", "Musterstadt", "01234 56789",
                "klaus.bauer@beispiel.de", d1, "Passiv", "Ermäßigt", "40,00", "Jährlich", "Überweisung", "", "", "", "",
                "01.07.1995", "Fördermitglied & Schiedsrichter"),
        )
        return "\uFEFF" + (listOf(headers.joinToString(";") { esc(it) }) + rows.map { r -> r.joinToString(";") { esc(it) } }).joinToString("\r\n")
    }
}
