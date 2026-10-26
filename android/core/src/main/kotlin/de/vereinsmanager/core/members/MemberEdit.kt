package de.vereinsmanager.core.members

import de.vereinsmanager.core.sepa.SepaService
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.random.Random

/** Reiter des Formulars (wie am Desktop: Basis, Kontakt, Mitgliedschaft, Zahlung, Notizen). */
enum class FormTab { BASIS, KONTAKT, MITGLIEDSCHAFT, ZAHLUNG, NOTIZEN }

/**
 * Alle bearbeitbaren Felder eines Mitglieds, so wie sie im Formular stehen.
 * Der Beitrag bleibt als Text, damit man "12,5" tippen kann; [feeValue] liest ihn als Zahl.
 */
data class MemberForm(
    val id: String,
    val number: String,
    val firstName: String = "",
    val lastName: String = "",
    val gender: String = "none",
    val birthDate: String = "",
    val nationality: String = "",
    val isMinor: Boolean = false,
    val guardianName: String = "",
    val guardianRelation: String = "Mutter",
    val guardianPhone: String = "",
    val guardianEmail: String = "",
    val street: String = "",
    val houseNumber: String = "",
    val zip: String = "",
    val city: String = "",
    val country: String = "Deutschland",
    val phone: String = "",
    val email: String = "",
    val entryDate: String,
    val exitDate: String = "",
    val status: String = "active",
    val department: String = "",
    val type: String = "full",
    val fee: String = "120",
    val feePeriod: String = "yearly",
    val paymentMethod: String = "sepa",
    val iban: String = "",
    val bic: String = "",
    val bankName: String = "",
    val accountHolder: String = "",
    val mandateDate: String = "",
    val mandateReference: String = "",
    val monthlyDueDay: Int = 1,
    val mandateSequenceType: String = "RCUR",
    val notes: String = "",
    val dataPrivacyConsent: Boolean = true,
) {
    /** Beitrag als Zahl; Komma oder Punkt als Trenner. Unlesbares zählt als 0 (wie am Desktop). */
    val feeValue: BigDecimal get() = MemberRules.parseFee(fee)

    val isFeeLocked get() = status == "terminated" || type == "ausgetreten" || feePeriod == "none"
    val isPeriodLocked get() = status == "terminated" || type == "ausgetreten"
}

/** Die Verknüpfungsregeln des Formulars (Funktionsinventar Mitglieder, "Verknüpfungsregeln"). */
object MemberRules {
    const val STANDARD_BEITRAG = "120"

    fun parseFee(text: String): BigDecimal =
        text.trim().replace(',', '.').toBigDecimalOrNull()?.takeIf { it.signum() >= 0 } ?: BigDecimal.ZERO

    fun formatFee(v: BigDecimal): String = v.stripTrailingZeros().let {
        (if (it.scale() < 0) it.setScale(0) else it).toPlainString().replace('.', ',')
    }

    private fun feeFree(f: MemberForm) = f.copy(fee = "0", feePeriod = "none", paymentMethod = "exempt")

    fun setStatus(f: MemberForm, status: String, today: LocalDate): MemberForm =
        if (status == "terminated") {
            feeFree(f).copy(status = status, type = "ausgetreten", exitDate = f.exitDate.ifEmpty { today.toString() })
        } else {
            f.copy(status = status, type = if (f.type == "ausgetreten" || f.type == "terminated") "full" else f.type)
        }

    fun setType(f: MemberForm, type: String, today: LocalDate): MemberForm = when (type) {
        "ausgetreten", "terminated" ->
            feeFree(f).copy(type = type, status = "terminated", exitDate = f.exitDate.ifEmpty { today.toString() })
        "honorary" -> feeFree(f).copy(type = type)
        else -> f.copy(type = type, status = if (f.status == "terminated") "active" else f.status)
    }

    fun setFeePeriod(f: MemberForm, period: String): MemberForm =
        if (period == "none") {
            f.copy(feePeriod = period, fee = "0", paymentMethod = "exempt")
        } else {
            f.copy(
                feePeriod = period,
                paymentMethod = if (f.paymentMethod == "exempt") "sepa" else f.paymentMethod,
                fee = if (f.feeValue.signum() == 0) STANDARD_BEITRAG else f.fee,
            )
        }

    fun setPayment(f: MemberForm, method: String): MemberForm =
        if (method == "exempt") {
            f.copy(paymentMethod = method, feePeriod = "none", fee = "0")
        } else {
            f.copy(
                paymentMethod = method,
                feePeriod = if (f.feePeriod == "none") "yearly" else f.feePeriod,
                fee = if (f.feeValue.signum() == 0) STANDARD_BEITRAG else f.fee,
            )
        }

    private fun name(first: String, last: String) = "$first $last".trim()

    /**
     * Beim Tippen im Namen: Ist der Kontoinhaber leer oder steht darin noch genau der bisherige Name
     * ("Vorname Nachname", also vom Formular selbst eingetragen), folgt er dem Namen. Hat jemand ihn selbst
     * geändert (z. B. Konto der Eltern), bleibt er unberührt.
     *
     * Der Desktop trägt nur beim allerersten Buchstaben ein und lässt den Rest stehen; das ergibt "M" statt
     * "Max Müller". Diese Fassung hält den Namen vollständig.
     */
    private fun folgeName(alt: MemberForm, neu: MemberForm): MemberForm {
        val keinName = neu.firstName.isEmpty() && neu.lastName.isEmpty()
        val folgt = alt.accountHolder.isEmpty() || alt.accountHolder == name(alt.firstName, alt.lastName)
        return if (folgt && !keinName) neu.copy(accountHolder = name(neu.firstName, neu.lastName))
        else if (folgt && keinName) neu.copy(accountHolder = "")
        else neu
    }

    fun setFirstName(f: MemberForm, v: String) = folgeName(f, f.copy(firstName = v))
    fun setLastName(f: MemberForm, v: String) = folgeName(f, f.copy(lastName = v))

    /** IBAN wird beim Tippen groß geschrieben und von Leerzeichen befreit. */
    fun setIban(f: MemberForm, v: String) = f.copy(iban = v.uppercase(Locale.ROOT).replace(Regex("\\s"), ""))

    /** Neues Mitglied mit den Vorgaben des Desktops. */
    fun neu(number: String, departments: List<String>, today: LocalDate): MemberForm = MemberForm(
        id = "mem-${System.currentTimeMillis()}",
        number = number,
        entryDate = today.toString(),
        department = departments.firstOrNull() ?: "Fußball",
        mandateDate = today.toString(),
        mandateReference = "MANDAT-$number-${today.year}",
    )

    fun von(m: Member): MemberForm {
        val raw = m.raw
        val bank = raw["bankDetails"] as? JsonObject
        fun b(k: String) = (bank?.get(k) as? JsonPrimitive)?.contentOrNull ?: ""
        fun r(k: String) = (raw[k] as? JsonPrimitive)?.contentOrNull ?: ""
        val due = (bank?.get("monthlyDueDay") as? JsonPrimitive)?.contentOrNull?.toIntOrNull()
        val feeRaw = (raw["feeAmount"] as? JsonPrimitive)?.contentOrNull?.toBigDecimalOrNull() ?: BigDecimal("120")
        return MemberForm(
                id = m.id, number = m.number, firstName = m.firstName, lastName = m.lastName,
                gender = m.gender, birthDate = m.birthDate, nationality = r("nationality"),
                isMinor = (raw["isMinor"] as? JsonPrimitive)?.booleanOrNull ?: false,
                guardianName = r("guardianName"), guardianRelation = r("guardianRelation").ifEmpty { "Mutter" },
                guardianPhone = r("guardianPhone"), guardianEmail = r("guardianEmail"),
                street = m.street, houseNumber = m.houseNumber, zip = m.zip, city = m.city,
                country = m.country, phone = m.phone, email = m.email,
                entryDate = m.entryDate, exitDate = m.exitDate, status = m.status, department = m.department,
                type = m.type, fee = formatFee(feeRaw), feePeriod = m.feePeriod.ifEmpty { "yearly" },
                paymentMethod = m.paymentMethod.ifEmpty { "sepa" },
                iban = b("iban"), bic = b("bic"), bankName = b("bankName"), accountHolder = b("accountHolder"),
                mandateDate = b("mandateDate"), mandateReference = b("mandateReference"),
                monthlyDueDay = if (due == 15) 15 else 1,
                mandateSequenceType = b("mandateSequenceType").ifEmpty { "RCUR" },
                notes = m.notes,
                dataPrivacyConsent = (raw["dataPrivacyConsent"] as? JsonPrimitive)?.booleanOrNull ?: true,
        )
    }

    /**
     * Prüfungen beim Speichern. Schlüssel: memberNumber, firstName, lastName, entryDate, iban, accountHolder.
     * Eine ungültige IBAN verhindert das Speichern nicht (wie am Desktop), sie wird nur angezeigt.
     * Zusätzlich gegenüber dem Desktop: eine schon vergebene Mitgliedsnummer wird abgelehnt.
     */
    fun validate(f: MemberForm, otherNumbers: Collection<String>): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.number.isBlank()) e["memberNumber"] = "Mitgliedsnummer ist erforderlich."
        else if (otherNumbers.any { it.trim().equals(f.number.trim(), ignoreCase = true) })
            e["memberNumber"] = "Diese Mitgliedsnummer ist schon vergeben."
        if (f.firstName.isBlank()) e["firstName"] = "Vorname ist erforderlich."
        if (f.lastName.isBlank()) e["lastName"] = "Nachname ist erforderlich."
        if (f.entryDate.isBlank()) e["entryDate"] = "Eintrittsdatum ist erforderlich."
        if (f.paymentMethod == "sepa") {
            if (f.iban.isBlank()) e["iban"] = "Für SEPA-Lastschrift ist die IBAN erforderlich."
            if (f.accountHolder.isBlank()) e["accountHolder"] = "Kontoinhaber ist erforderlich."
        }
        return e
    }

    /** Zu welchem Reiter springt das Formular bei Fehlern (Auffälligkeit 8: richtig machen). */
    fun ersterFehlerReiter(errors: Map<String, String>): FormTab? = when {
        errors.keys.any { it == "memberNumber" || it == "firstName" || it == "lastName" } -> FormTab.BASIS
        "entryDate" in errors -> FormTab.MITGLIEDSCHAFT
        errors.keys.any { it == "iban" || it == "accountHolder" } -> FormTab.ZAHLUNG
        else -> null
    }

    fun ibanHinweis(iban: String): String? =
        if (iban.isEmpty()) null
        else SepaService.validateIban(iban).let { if (it.isValid) "Gültige ${it.country}-IBAN (${it.formatted})" else it.error ?: "Prüfziffer ungültig" }

    /**
     * Nächste Mitgliedsnummer: höchste vergebene Nummer + 1 im Format des Bestands (Entscheidung 2).
     * Maßgeblich ist die häufigste Vorsilbe (z. B. "M-"); die Ziffernbreite richtet sich nach dem Bestand.
     */
    fun naechsteNummer(existing: Collection<String>): String {
        val re = Regex("^(.*?)(\\d+)$")
        val parts = existing.mapNotNull { n -> re.find(n.trim())?.let { it.groupValues[1] to it.groupValues[2] } }
        if (parts.isEmpty()) return "M-0001"
        val prefix = parts.groupingBy { it.first }.eachCount().entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key }).first().key
        val group = parts.filter { it.first == prefix }
        val width = group.maxOf { it.second.length }
        var next = group.maxOf { it.second.toBigInteger() } + java.math.BigInteger.ONE
        val taken = existing.map { it.trim().lowercase(Locale.ROOT) }.toSet()
        while (true) {
            val candidate = prefix + next.toString().padStart(width, '0')
            if (candidate.lowercase(Locale.ROOT) !in taken) return candidate
            next += java.math.BigInteger.ONE
        }
    }
}

/** Zeitstempel und Kennungen im Format der Desktop-Fassung. */
object Zeit {
    private val STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    fun stempel(now: ZonedDateTime = ZonedDateTime.now()): String = now.withZoneSameInstant(ZoneOffset.UTC).format(STAMP)
    private const val ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
    fun zufall(n: Int = 5): String = (1..n).map { ALPHABET[Random.nextInt(ALPHABET.length)] }.joinToString("")

    /** "2026-10-26" -> "26.10.2026"; alles andere bleibt unverändert. */
    fun deutsch(iso: String): String = try {
        LocalDate.parse(iso).let { "%02d.%02d.%04d".format(it.dayOfMonth, it.monthValue, it.year) }
    } catch (e: Exception) { iso }

    /** "15,00 €" (feste deutsche Schreibweise, unabhängig von der Gerätesprache). */
    fun euro(v: BigDecimal): String = java.text.NumberFormat.getCurrencyInstance(Locale.GERMANY).format(v)

    fun logId(now: ZonedDateTime = ZonedDateTime.now()) = "log-${now.toInstant().toEpochMilli()}-${zufall()}"
}

/** Baut aus dem Formular das Dokument für den Speicher; unbekannte Felder des bisherigen Dokuments bleiben erhalten. */
object MemberDocument {
    private fun s(v: String) = JsonPrimitive(v)

    /** Ganze Beträge ohne Nachkommastellen ("120"), sonst als Dezimalzahl ("12.5") – wie JavaScript sie schreibt. */
    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    fun build(f: MemberForm, base: JsonObject?, now: ZonedDateTime = ZonedDateTime.now()): JsonObject {
        val stamp = Zeit.stempel(now)
        val address = JsonObject(
            ((base?.get("address") as? JsonObject) ?: JsonObject(emptyMap())) + mapOf(
                "street" to s(f.street), "houseNumber" to s(f.houseNumber), "zip" to s(f.zip),
                "city" to s(f.city), "country" to s(f.country),
            ),
        )
        val bank = JsonObject(
            ((base?.get("bankDetails") as? JsonObject) ?: JsonObject(emptyMap())) + mapOf(
                "iban" to s(f.iban), "bic" to s(f.bic), "bankName" to s(f.bankName),
                "accountHolder" to s(f.accountHolder), "mandateDate" to s(f.mandateDate),
                "mandateReference" to s(f.mandateReference), "monthlyDueDay" to JsonPrimitive(f.monthlyDueDay),
                "mandateSequenceType" to s(f.mandateSequenceType),
            ),
        )
        val fields = mapOf(
            "id" to s(f.id), "memberNumber" to s(f.number.trim()),
            "firstName" to s(f.firstName.trim()), "lastName" to s(f.lastName.trim()),
            "gender" to s(f.gender), "birthDate" to s(f.birthDate), "nationality" to s(f.nationality),
            "isMinor" to JsonPrimitive(f.isMinor), "guardianName" to s(f.guardianName),
            "guardianRelation" to s(f.guardianRelation), "guardianPhone" to s(f.guardianPhone),
            "guardianEmail" to s(f.guardianEmail), "address" to address,
            "phone" to s(f.phone), "email" to s(f.email), "entryDate" to s(f.entryDate), "exitDate" to s(f.exitDate),
            "status" to s(f.status), "department" to s(f.department), "membershipType" to s(f.type),
            "feeAmount" to zahl(f.feeValue), "feePeriod" to s(f.feePeriod), "paymentMethod" to s(f.paymentMethod),
            "bankDetails" to bank, "notes" to s(f.notes), "dataPrivacyConsent" to JsonPrimitive(f.dataPrivacyConsent),
            "createdAt" to ((base?.get("createdAt") as? JsonPrimitive) ?: s(stamp)),
            "updatedAt" to s(stamp),
        )
        // Reihenfolge: bisherige Felder zuerst (unverändert eingeordnet), neue hinten.
        return JsonObject((base ?: JsonObject(emptyMap())) + fields)
    }
}

/** Einträge des Änderungsprotokolls (Bereich "auditLogs"), Bearbeiter fest "Administrator" (Entscheidung 1). */
object MemberAudit {
    const val BEARBEITER = "Administrator"

    private val FELDER = listOf(
        "firstName" to "Vorname", "lastName" to "Nachname", "gender" to "Geschlecht", "birthDate" to "Geburtsdatum",
        "phone" to "Telefon", "email" to "E-Mail", "entryDate" to "Eintrittsdatum", "exitDate" to "Austrittsdatum",
        "status" to "Mitgliedsstatus", "department" to "Abteilung", "membershipType" to "Mitgliedschaftstyp",
        "feeAmount" to "Beitragshöhe", "feePeriod" to "Zahlungsweise", "paymentMethod" to "Zahlungsmethode",
        "notes" to "Notizen",
    )

    private fun JsonElement?.leer(): Boolean = when (this) {
        null, JsonNull -> true
        is JsonPrimitive -> contentOrNull.isNullOrEmpty() || (!isString && contentOrNull?.toBigDecimalOrNull()?.signum() == 0)
        else -> false
    }

    private fun gleich(a: JsonElement?, b: JsonElement?): Boolean {
        if (a.leer() && b.leer()) return true
        val x = (a as? JsonPrimitive)?.contentOrNull
        val y = (b as? JsonPrimitive)?.contentOrNull
        if (x == null || y == null) return a == b
        val nx = x.toBigDecimalOrNull()
        val ny = y.toBigDecimalOrNull()
        return if (nx != null && ny != null) nx.compareTo(ny) == 0 else x == y
    }

    /** Lesbare Anzeige für das Protokoll: deutsche Bezeichnungen statt Kennungen, Beträge und Daten deutsch. */
    private fun anzeige(feld: String, v: JsonElement?): JsonPrimitive {
        val roh = (v as? JsonPrimitive)?.contentOrNull ?: ""
        if (feld != "dataPrivacyConsent" && v.leer()) return JsonPrimitive("–")
        val text = when (feld) {
            "status" -> MemberLabels.STATUS[roh]
            "paymentMethod" -> MemberLabels.PAYMENT[roh]
            "feePeriod" -> MemberLabels.FEE_PERIOD[roh]
            "membershipType" -> MemberLabels.TYPE_DETAIL[roh]
            "gender" -> MemberLabels.GENDER[roh]
            "feeAmount" -> roh.toBigDecimalOrNull()?.let { Zeit.euro(it) }
            "entryDate", "exitDate", "birthDate" -> Zeit.deutsch(roh)
            "dataPrivacyConsent" -> if (roh == "true") "Zugestimmt" else "Nicht erteilt"
            "monthlyDueDay" -> "$roh. des Monats"
            else -> null
        }
        return JsonPrimitive(text ?: roh)
    }

    private fun text(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.contentOrNull ?: ""

    private fun adresse(o: JsonObject): String {
        val a = o["address"] as? JsonObject ?: JsonObject(emptyMap())
        return "${text(a, "street")} ${text(a, "houseNumber")}, ${text(a, "zip")} ${text(a, "city")}"
    }

    private fun adresseGleich(x: JsonObject, y: JsonObject): Boolean {
        val a = x["address"] as? JsonObject ?: JsonObject(emptyMap())
        val b = y["address"] as? JsonObject ?: JsonObject(emptyMap())
        return listOf("street", "houseNumber", "zip", "city", "country").all { gleich(a[it], b[it]) }
    }

    // Fehlende Angaben gelten als Vorgabe (Fälligkeitstag 1, Folgelastschrift): Öffnen und Speichern ohne Änderung bleibt ohne Eintrag.
    private val BANK_VORGABE = mapOf("mandateSequenceType" to JsonPrimitive("RCUR"), "monthlyDueDay" to JsonPrimitive(1))

    private fun bank(o: JsonObject) = o["bankDetails"] as? JsonObject ?: JsonObject(emptyMap())

    private fun bankGleich(x: JsonObject, y: JsonObject, ohneFaelligkeitstag: Boolean): Boolean {
        val a = bank(x)
        val b = bank(y)
        return (a.keys + b.keys).filter { !(ohneFaelligkeitstag && it == "monthlyDueDay") }
            .all { gleich(a[it] ?: BANK_VORGABE[it], b[it] ?: BANK_VORGABE[it]) }
    }

    private fun bankText(o: JsonObject): String {
        val iban = text(bank(o), "iban")
        return if (iban.isNotEmpty()) "IBAN: $iban" else "Keine Bankdaten"
    }

    private fun aenderung(feld: String, label: String, alt: JsonElement, neu: JsonElement) = JsonObject(
        mapOf("field" to JsonPrimitive(feld), "label" to JsonPrimitive(label), "oldValue" to alt, "newValue" to neu),
    )

    private fun eintrag(
        m: JsonObject, now: ZonedDateTime, action: String, summary: String, changes: List<JsonObject>,
    ) = JsonObject(
        mapOf(
            "id" to JsonPrimitive(Zeit.logId(now)),
            "memberId" to JsonPrimitive(text(m, "id")),
            "memberNumber" to JsonPrimitive(text(m, "memberNumber")),
            "memberName" to JsonPrimitive("${text(m, "firstName")} ${text(m, "lastName")}"),
            "timestamp" to JsonPrimitive(Zeit.stempel(now)),
            "author" to JsonPrimitive(BEARBEITER),
            "action" to JsonPrimitive(action),
            "summary" to JsonPrimitive(summary),
            "changes" to JsonArray(changes),
        ),
    )

    fun angelegt(m: JsonObject, now: ZonedDateTime = ZonedDateTime.now()) =
        eintrag(m, now, "create", "Neues Mitglied (${text(m, "memberNumber")}) angelegt", emptyList())

    /**
     * Vergleich alt gegen neu. Keine Änderung: null (kein Eintrag). Leer, fehlend und 0 gelten als gleich.
     * [sammel]: Sammelbearbeitung; dort zählen auch Datenschutz-Einwilligung und Fälligkeitstag, und die
     * Bankverbindung wird nicht als Block gezeigt.
     */
    fun geaendert(alt: JsonObject, neu: JsonObject, now: ZonedDateTime = ZonedDateTime.now(), sammel: Boolean = false): JsonObject? {
        val changes = ArrayList<JsonObject>()
        for ((k, label) in FELDER) {
            if (!gleich(alt[k], neu[k])) changes.add(aenderung(k, label, anzeige(k, alt[k]), anzeige(k, neu[k])))
        }
        if (sammel && !gleich(alt["dataPrivacyConsent"] ?: JsonPrimitive(true), neu["dataPrivacyConsent"] ?: JsonPrimitive(true))) {
            changes.add(
                aenderung(
                    "dataPrivacyConsent", "Datenschutz-Einwilligung",
                    anzeige("dataPrivacyConsent", alt["dataPrivacyConsent"] ?: JsonPrimitive(true)),
                    anzeige("dataPrivacyConsent", neu["dataPrivacyConsent"] ?: JsonPrimitive(true)),
                ),
            )
        }
        if (sammel && !gleich(bank(alt)["monthlyDueDay"] ?: JsonPrimitive(1), bank(neu)["monthlyDueDay"] ?: JsonPrimitive(1))) {
            changes.add(
                aenderung(
                    "monthlyDueDay", "Fälligkeitstag (monatlicher Einzug)",
                    anzeige("monthlyDueDay", bank(alt)["monthlyDueDay"] ?: JsonPrimitive(1)),
                    anzeige("monthlyDueDay", bank(neu)["monthlyDueDay"] ?: JsonPrimitive(1)),
                ),
            )
        }
        if (!adresseGleich(alt, neu)) {
            changes.add(aenderung("address", "Adresse", JsonPrimitive(adresse(alt)), JsonPrimitive(adresse(neu))))
        }
        if (!bankGleich(alt, neu, ohneFaelligkeitstag = sammel)) {
            changes.add(aenderung("bankDetails", "Bankverbindung / SEPA", JsonPrimitive(bankText(alt)), JsonPrimitive(bankText(neu))))
        }
        if (changes.isEmpty()) return null
        val labels = changes.joinToString(", ") { (it["label"] as JsonPrimitive).content }
        val summary = if (sammel) "Sammeländerung Stammdaten: ${changes.size} Feld(er) angepasst ($labels)"
        else "${changes.size} Feld(er) aktualisiert ($labels)"
        return eintrag(neu, now, "update", summary, changes)
    }

    fun geloescht(m: JsonObject, now: ZonedDateTime = ZonedDateTime.now(), sammel: Boolean = false): JsonObject {
        val was = "Mitglied (${text(m, "memberNumber")} - ${text(m, "firstName")} ${text(m, "lastName")}) gelöscht"
        return eintrag(m, now, "delete", if (sammel) "Sammellöschung: $was" else was, emptyList())
    }
}

enum class DocumentChoice { KEEP, DELETE }

/** Was mit ausgegebenem Material eines gelöschten Mitglieds geschieht (Entscheidung 9). */
sealed interface MaterialChoice {
    /** Alle noch ausgegebenen Gegenstände gelten als zurückgegeben (heutiges Datum). */
    data object Return : MaterialChoice
    /** Alle noch ausgegebenen Gegenstände gehen auf ein anderes Mitglied über. */
    data class Transfer(val toMemberId: String) : MaterialChoice
}

data class DeleteReport(val documentsDeleted: Int, val materialReturned: Int, val materialTransferred: Int)
