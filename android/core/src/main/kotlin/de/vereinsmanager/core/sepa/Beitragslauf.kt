package de.vereinsmanager.core.sepa

import de.vereinsmanager.core.export.Export
import de.vereinsmanager.core.finance.BuchungDokument
import de.vereinsmanager.core.finance.BuchungForm
import de.vereinsmanager.core.finance.BuchungRegeln
import de.vereinsmanager.core.finance.Finance
import de.vereinsmanager.core.skr42.Skr42
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.settings.Glaeubiger
import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZonedDateTime

/** Was der Anwender für einen neuen Lauf einstellt. */
data class LaufParameter(
    val filter: SepaPeriodFilter = SepaPeriodFilter.MONTHLY_1,
    val jahr: Int,
    val monat: Int,
    val quartal: Int,
    val halbjahr: Int,
    val ausfuehrung: String,
    val titel: String = "",
    val vorlage: String = Beitragslauf.STANDARD_VORLAGE,
    val format: SepaFormat = SepaFormat.PAIN_008_001_08,
)

/** Ein gespeicherter Lauf (Bereich `sepaRuns`, gleiche Felder wie `SepaRunHistory` am Desktop). */
data class Lauf(
    val id: String,
    val titel: String,
    val filter: SepaPeriodFilter?,
    val jahr: Int,
    val monat: Int?,
    val ausfuehrung: String,
    val erstellt: String,
    val summe: BigDecimal,
    val anzahl: Int,
    val posten: List<SepaItem>,
    val xml: String?,
    val gebucht: Boolean,
    val gebuchtAufKonto: String?,
    val roh: JsonObject,
) {
    /** Die Posten, die tatsächlich eingezogen werden (wie in XML und Protokoll). */
    val aktive: List<SepaItem> get() = SepaService.activeItems(posten)
}

/** Alles, was das Prüfprotokoll (PDF) enthält, schon als fertiger Text. Gezeichnet wird in der App. */
data class SepaProtokoll(
    val verein: String,
    val kopf1: String,
    val kopf2: String,
    val titel: String,
    val daten: String,
    val summeText: String,
    val anzahlText: String,
    val zyklus: String,
    val spalten: List<String>,
    val zeilen: List<List<String>>,
    val fussnote: String,
    val kassenwart: String,
    val erstellt: String,
    val fusszeile: String,
    val dateiname: String,
)

/** Was das Verbuchen angelegt hat. */
data class Verbucht(val anzahl: Int, val summe: BigDecimal)

data class LaufErgebnis(val lauf: Lauf, val xml: String, val xmlDateiname: String)

object Beitragslauf {
    const val BEREICH = "sepaRuns"
    const val STANDARD_VORLAGE = "Mitgliedsbeitrag {month}/{year} - {memberNumber}"

    private val MONATE = listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")

    val FILTER_TEXT = linkedMapOf(
        SepaPeriodFilter.MONTHLY_1 to "Monatlich, 1. des Monats",
        SepaPeriodFilter.MONTHLY_15 to "Monatlich, 15. des Monats",
        SepaPeriodFilter.MONTHLY_ALL to "Monatlich, alle",
        SepaPeriodFilter.QUARTERLY to "Quartal",
        SepaPeriodFilter.HALF_YEARLY to "Halbjahr",
        SepaPeriodFilter.YEARLY to "Jahr",
    )

    fun monatsname(m: Int) = MONATE.getOrElse(m - 1) { "" }

    fun istMonatlich(f: SepaPeriodFilter) = f == SepaPeriodFilter.MONTHLY_1 || f == SepaPeriodFilter.MONTHLY_15 || f == SepaPeriodFilter.MONTHLY_ALL

    /** Vorgeschlagene Titel wie am Desktop; ein selbst eingegebener Titel hat Vorrang. */
    fun titel(p: LaufParameter): String {
        if (p.titel.isNotBlank()) return p.titel.trim()
        val monat = "${monatsname(p.monat)} ${p.jahr}"
        return when (p.filter) {
            SepaPeriodFilter.MONTHLY_1 -> "Monatsbeitrag $monat (1. d. M.)"
            SepaPeriodFilter.MONTHLY_15 -> "Monatsbeitrag $monat (15. d. M.)"
            SepaPeriodFilter.MONTHLY_ALL -> "Monatsbeitrag $monat (Alle)"
            SepaPeriodFilter.QUARTERLY -> "Quartalsbeitrag Q${p.quartal} ${p.jahr}"
            SepaPeriodFilter.HALF_YEARLY -> "Halbjahresbeitrag H${p.halbjahr} ${p.jahr}"
            SepaPeriodFilter.YEARLY -> "Jahresbeitrag ${p.jahr}"
        }
    }

    fun konfig(p: LaufParameter, g: Glaeubiger?): SepaRunConfig = SepaRunConfig(
        periodFilter = p.filter, targetYear = p.jahr,
        targetMonth = if (istMonatlich(p.filter)) p.monat else null,
        targetQuarter = if (p.filter == SepaPeriodFilter.QUARTERLY) p.quartal else null,
        targetHalfYear = if (p.filter == SepaPeriodFilter.HALF_YEARLY) p.halbjahr else null,
        executionDate = p.ausfuehrung,
        creditorId = g?.id.orEmpty(), creditorName = g?.name.orEmpty(), creditorIban = g?.iban.orEmpty(), creditorBic = g?.bic,
        remittanceTemplate = p.vorlage, format = p.format,
    )

    /** Die Einzugsposten aus dem Mitgliederbestand für diese Einstellungen. */
    fun vorbereiten(store: DocumentStore, p: LaufParameter): List<SepaItem> = vorbereiten(store.all("members"), p)

    /** Dasselbe aus schon geladenen Mitglieds-Dokumenten. */
    fun vorbereiten(mitglieder: List<JsonObject>, p: LaufParameter): List<SepaItem> =
        SepaService.buildCollectionItems(mitglieder.map { it.toSepaMember() }, konfig(p, null))

    /** Zwei Posten mit gleichem Namen (Reihenfolge der Wörter und Kommas egal) – der Kontoinhaber ist dann das Mitglied selbst. */
    private fun gleicherName(a: String, b: String): Boolean {
        fun w(s: String) = s.lowercase().split(Regex("[\\s,]+")).filter { it.isNotEmpty() }.sorted()
        return w(a) == w(b)
    }

    private fun maskiert(iban: String) = if (iban.isEmpty()) "–" else iban.take(6) + "..." + iban.takeLast(4)

    private fun zyklus(c: LaufParameter): String = when (c.filter) {
        SepaPeriodFilter.MONTHLY_1 -> "Monatlich (1. des Monats)"
        SepaPeriodFilter.MONTHLY_15 -> "Monatlich (15. des Monats)"
        SepaPeriodFilter.MONTHLY_ALL -> "Monatlich (Alle)"
        SepaPeriodFilter.QUARTERLY -> "Quartal Q${c.quartal}"
        SepaPeriodFilter.HALF_YEARLY -> "Halbjahr H${c.halbjahr}"
        SepaPeriodFilter.YEARLY -> "Jahresbeitrag ${c.jahr}"
    }

    /**
     * Das Prüfprotokoll: dieselbe Auswahl wie die XML-Datei (ausgewählt, gültig, Betrag über null), mit Summe, Zyklus und Freigabezeile.
     * Abweichung vom Desktop: Der Stern „weicht vom Mitglied ab" steht nur bei abweichendem Kontoinhaber (der Desktop setzt ihn bei jedem,
     * weil er „Nachname, Vorname" mit „Vorname Nachname" vergleicht).
     */
    fun protokoll(p: LaufParameter, posten: List<SepaItem>, g: Glaeubiger, heute: LocalDate = LocalDate.now()): SepaProtokoll {
        val aktiv = SepaService.activeItems(posten)
        val summe = aktiv.fold(BigDecimal.ZERO) { s, i -> s + i.amount }
        val erstellt = Zeit.deutsch(heute.toString())
        var abweichend = false
        val zeilen = aktiv.mapIndexed { i, it ->
            val gleich = gleicherName(it.accountHolder, it.memberName)
            if (!gleich) abweichend = true
            listOf(
                (i + 1).toString(), it.memberNumber, it.memberName, if (gleich) it.accountHolder else it.accountHolder + "*",
                maskiert(it.iban), it.mandateReference, Export.fixed2(it.amount) + " €",
            )
        }
        return SepaProtokoll(
            verein = g.name,
            kopf1 = listOf(g.anschrift, "Gläubiger-ID: ${g.id}").filter { it.isNotEmpty() }.joinToString(" | "),
            kopf2 = "Vereinskonto: ${g.iban.ifEmpty { "–" }} (${g.bic.ifEmpty { "–" }})",
            titel = "SEPA-Basislastschrift: Beitrags-Einzugsprotokoll",
            daten = "Fälligkeitsdatum: ${Zeit.deutsch(p.ausfuehrung)} | Erstellt: $erstellt",
            summeText = Export.fixed2(summe) + " €", anzahlText = "${aktiv.size} Posten", zyklus = zyklus(p),
            spalten = listOf("#", "Mgl-Nr.", "Mitglied", "Kontoinhaber", "IBAN (maskiert)", "Mandatsreferenz", "Betrag"),
            zeilen = zeilen,
            fussnote = if (abweichend) "* Weicht vom Namen des Mitglieds ab (z.B. Erziehungsberechtigte/r)" else "",
            kassenwart = g.kassenwart, erstellt = erstellt,
            fusszeile = "${g.name} - SEPA Lastschrifteinzug (${p.ausfuehrung})",
            dateiname = "SEPA_Einzugsprotokoll_${p.ausfuehrung}_${p.filter.wire}.pdf",
        )
    }

    fun xmlDateiname(titel: String, ausfuehrung: String) = "SEPA_" + titel.replace(Regex("[^a-zA-Z0-9_-]"), "_") + "_" + ausfuehrung + ".xml"

    /** Erzeugt die SEPA-Datei und legt den Lauf in der Historie ab (wie der Desktop). Wirft, wenn kein gültiger Posten ausgewählt ist. */
    fun erzeugen(
        store: DocumentStore, p: LaufParameter, posten: List<SepaItem>, g: Glaeubiger, now: ZonedDateTime = ZonedDateTime.now(),
    ): LaufErgebnis {
        val aktiv = SepaService.activeItems(posten)
        if (aktiv.isEmpty()) throw IllegalStateException("Keine gültigen Lastschriftposten ausgewählt.")
        val titel = titel(p)
        val xml = SepaService.generateSepaXml(konfig(p, g), posten, now)
        val stempel = Zeit.stempel(now)
        val summe = aktiv.fold(BigDecimal.ZERO) { s, i -> s + i.amount }.setScale(2, java.math.RoundingMode.HALF_UP)
        val id = "sepa-" + now.toInstant().toEpochMilli()
        val m = linkedMapOf<String, JsonElement>(
            "id" to JsonPrimitive(id), "title" to JsonPrimitive(titel), "periodFilter" to JsonPrimitive(p.filter.wire),
            "targetYear" to JsonPrimitive(p.jahr),
        )
        if (istMonatlich(p.filter)) m["targetMonth"] = JsonPrimitive(p.monat)
        m["executionDate"] = JsonPrimitive(p.ausfuehrung)
        m["createdAt"] = JsonPrimitive(stempel)
        m["totalAmount"] = zahl(summe)
        m["totalTransactions"] = JsonPrimitive(aktiv.size)
        m["items"] = JsonArray(posten.map { postenJson(it) })
        m["xmlContent"] = JsonPrimitive(xml)
        m["isBooked"] = JsonPrimitive(false)
        val doc = JsonObject(m)
        store.put(BEREICH, id, doc)
        return LaufErgebnis(laufAus(doc), xml, xmlDateiname(titel, p.ausfuehrung))
    }

    fun laeufe(store: DocumentStore): List<Lauf> = store.all(BEREICH).map { laufAus(it) }.sortedByDescending { it.erstellt }

    fun lauf(store: DocumentStore, id: String): Lauf? = store.get(BEREICH, id)?.let { laufAus(it) }

    fun loeschen(store: DocumentStore, id: String) = store.delete(BEREICH, id)

    /** Die Parameter eines gespeicherten Laufs, um aus der Historie das Protokoll neu zu erzeugen. */
    fun parameterVon(l: Lauf): LaufParameter {
        val monat = l.monat ?: runCatching { LocalDate.parse(l.ausfuehrung).monthValue }.getOrDefault(1)
        return LaufParameter(
            filter = l.filter ?: SepaPeriodFilter.MONTHLY_1, jahr = l.jahr, monat = monat, quartal = (monat + 2) / 3,
            halbjahr = if (monat <= 6) 1 else 2, ausfuehrung = l.ausfuehrung, titel = l.titel,
        )
    }

    // ---------------------------------------------------------------- Verbuchen

    /** Ursprüngliche Nummer; hat der Verein das Konto umnummeriert, wird auf die neue gebucht (`Kontenrahmen.standardKonto`). */
    const val NUMMERNKREIS_KONTO = "40000"

    /** Aus dem Kontenrahmen des Vereins (mit seinen Anpassungen), wie am Desktop. */
    private fun beitragsKonto(store: DocumentStore) = de.vereinsmanager.core.skr42.Kontenrahmen.standardKonto(NUMMERNKREIS_KONTO, de.vereinsmanager.core.skr42.Kontenrahmen.wirksam(store))

    /**
     * Bucht jeden eingezogenen Posten als Einnahme auf das Konto [kontoId]: Ausführungsdatum als Buchungsdatum, ideeller Bereich,
     * Konto 40000 „Echte Mitgliedsbeiträge (laufend)“. Alles oder nichts; ein Lauf lässt sich nur einmal verbuchen.
     * Abweichung vom Desktop: der dort nur mit „Mitgliedsbeiträge“ beschriftete Buchungssatz bekommt hier den Nummernkreis 40000.
     */
    fun verbuchen(
        store: DocumentStore, runId: String, kontoId: String, now: ZonedDateTime = ZonedDateTime.now(), zufall: kotlin.random.Random = kotlin.random.Random.Default,
    ): Verbucht = store.transaction {
        val lauf = lauf(store, runId) ?: throw IllegalStateException("Der Lauf ist nicht mehr vorhanden.")
        if (lauf.gebucht) throw IllegalStateException("Dieser Lauf ist schon verbucht.")
        if (store.get(Finance.KONTEN, kontoId) == null) throw IllegalStateException("Das Konto gibt es nicht mehr.")
        val aktiv = lauf.aktive
        if (aktiv.isEmpty()) throw IllegalStateException("Der Lauf enthält keine Posten zum Verbuchen.")
        val (haupt, unter) = beitragsKonto(store) ?: throw IllegalStateException("Das Konto 40000 fehlt im Kontenrahmen.")
        val vergeben = store.all(Finance.BUCHUNGEN).mapNotNull { it.t("documentNumber") }.toMutableSet()
        var summe = BigDecimal.ZERO
        for (i in aktiv) {
            val grund = "SEPA-${lauf.jahr}-${lauf.monat?.toString()?.padStart(2, '0') ?: "RUN"}-${i.memberNumber}"
            var nummer = grund
            var n = 2
            while (nummer in vergeben) nummer = "$grund-${n++}"
            vergeben.add(nummer)
            val iban = i.iban
            val id = "tx-sepa-${lauf.id}-${i.memberNumber}-" + (1..4).map { "abcdefghijklmnopqrstuvwxyz0123456789"[zufall.nextInt(36)] }.joinToString("")
            val form = BuchungForm(
                id = id, datum = lauf.ausfuehrung, betrag = BuchungRegeln.betragText(i.amount), art = "income", kontoId = kontoId,
                belegNummer = nummer, text = i.remittanceInfo, partner = i.accountHolder.ifEmpty { i.memberName }, sphaere = "ideell",
                nummernkreis = BuchungRegeln.nummernkreisText(haupt), konto = unter.label, skrKonto = unter.code, ust = 0,
                notiz = "Automatische Verbuchung aus SEPA-Beitragslauf \"${lauf.titel}\" (Mandat: ${i.mandateReference}, IBAN: ${iban.take(6)}...${iban.takeLast(4)})",
            )
            store.put(Finance.BUCHUNGEN, id, BuchungDokument.build(form, null, now))
            summe += i.amount
        }
        val m = LinkedHashMap<String, JsonElement>(lauf.roh)
        m["isBooked"] = JsonPrimitive(true)
        m["bookedToAccountId"] = JsonPrimitive(kontoId)
        store.put(BEREICH, lauf.id, JsonObject(m))
        Verbucht(aktiv.size, summe)
    }

    /** Die Mitglieder dieses Laufs, deren Mandat noch als Erstlastschrift (FRST) gespeichert ist. */
    fun erstlastschriften(store: DocumentStore, l: Lauf): List<SepaItem> = l.aktive.filter { i ->
        i.sequenceType == "FRST" && mandatsfolge(store.get("members", i.memberId)) == "FRST"
    }

    private fun mandatsfolge(m: JsonObject?): String? = ((m?.get("bankDetails") as? JsonObject)?.get("mandateSequenceType") as? JsonPrimitive)?.contentOrNull

    /** Stellt die Mandate der genannten Mitglieder von FRST auf RCUR (Folgelastschrift). Alle anderen Angaben bleiben, Mitglieder mit anderer Folge bleiben unberührt. */
    fun aufFolgelastschrift(store: DocumentStore, memberIds: List<String>, now: ZonedDateTime = ZonedDateTime.now()): Int = store.transaction {
        var n = 0
        for (id in memberIds.distinct()) {
            val doc = store.get("members", id) ?: continue
            val bank = doc["bankDetails"] as? JsonObject ?: continue
            if (mandatsfolge(doc) != "FRST") continue
            val b = LinkedHashMap<String, JsonElement>(bank); b["mandateSequenceType"] = JsonPrimitive("RCUR")
            val d = LinkedHashMap<String, JsonElement>(doc); d["bankDetails"] = JsonObject(b)
            if (d.containsKey("updatedAt")) d["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            store.put("members", id, JsonObject(d)); n++
        }
        n
    }

    // ---------------------------------------------------------------- JSON

    private fun s(v: String) = JsonPrimitive(v)

    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    private fun postenJson(i: SepaItem): JsonObject {
        val m = linkedMapOf<String, JsonElement>(
            "memberId" to s(i.memberId), "memberNumber" to s(i.memberNumber), "memberName" to s(i.memberName),
            "accountHolder" to s(i.accountHolder), "iban" to s(i.iban), "bic" to s(i.bic),
        )
        i.bankName?.let { m["bankName"] = s(it) }
        m["mandateReference"] = s(i.mandateReference)
        m["mandateDate"] = s(i.mandateDate)
        m["sequenceType"] = s(i.sequenceType)
        m["amount"] = zahl(i.amount)
        i.feePeriod?.let { m["feePeriod"] = s(it) }
        i.department?.let { m["department"] = s(it) }
        i.monthlyDueDay?.let { m["monthlyDueDay"] = JsonPrimitive(it) }
        m["remittanceInfo"] = s(i.remittanceInfo)
        m["endToEndId"] = s(i.endToEndId)
        m["isValid"] = JsonPrimitive(i.isValid)
        m["validationErrors"] = JsonArray(i.validationErrors.map { s(it) })
        m["selected"] = JsonPrimitive(i.selected)
        return JsonObject(m)
    }

    private fun JsonObject.t(k: String) = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
    private fun JsonObject.dec(k: String) = t(k)?.toBigDecimalOrNull() ?: BigDecimal.ZERO

    private fun postenAus(o: JsonObject) = SepaItem(
        memberId = o.t("memberId").orEmpty(), memberNumber = o.t("memberNumber").orEmpty(), memberName = o.t("memberName").orEmpty(),
        accountHolder = o.t("accountHolder").orEmpty(), iban = o.t("iban").orEmpty(), bic = o.t("bic").orEmpty(), bankName = o.t("bankName"),
        mandateReference = o.t("mandateReference").orEmpty(), mandateDate = o.t("mandateDate").orEmpty(),
        sequenceType = o.t("sequenceType") ?: "RCUR", amount = o.dec("amount"), feePeriod = o.t("feePeriod"), department = o.t("department"),
        monthlyDueDay = (o["monthlyDueDay"] as? JsonPrimitive)?.intOrNull, remittanceInfo = o.t("remittanceInfo").orEmpty(),
        endToEndId = o.t("endToEndId").orEmpty(), isValid = (o["isValid"] as? JsonPrimitive)?.booleanOrNull ?: false,
        validationErrors = (o["validationErrors"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList(),
        selected = (o["selected"] as? JsonPrimitive)?.booleanOrNull ?: false,
    )

    fun laufAus(d: JsonObject) = Lauf(
        id = d.t("id").orEmpty(), titel = d.t("title").orEmpty(), filter = SepaPeriodFilter.fromWire(d.t("periodFilter")),
        jahr = (d["targetYear"] as? JsonPrimitive)?.intOrNull ?: 0, monat = (d["targetMonth"] as? JsonPrimitive)?.intOrNull,
        ausfuehrung = d.t("executionDate").orEmpty(), erstellt = d.t("createdAt").orEmpty(), summe = d.dec("totalAmount"),
        anzahl = (d["totalTransactions"] as? JsonPrimitive)?.intOrNull ?: 0,
        posten = (d["items"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.let(::postenAus) } ?: emptyList(),
        xml = d.t("xmlContent"), gebucht = (d["isBooked"] as? JsonPrimitive)?.booleanOrNull ?: false,
        gebuchtAufKonto = d.t("bookedToAccountId"), roh = d,
    )
}
