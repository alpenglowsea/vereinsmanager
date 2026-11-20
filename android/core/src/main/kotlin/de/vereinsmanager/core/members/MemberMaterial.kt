package de.vereinsmanager.core.members

import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Ein Gegenstand aus dem Inventar, wie er in der Auswahl erscheint. */
data class Gegenstand(val id: String, val name: String, val nummer: String, val einheit: String)

/** Eine Ausgabe von Inventar an ein Mitglied (Bereich "memberInventory"). */
data class Ausgabe(
    val raw: JsonObject,
    val id: String,
    val memberId: String,
    val itemId: String,
    val itemName: String,
    val itemNumber: String,
    val quantity: Int,
    val unit: String,
    val hasContribution: Boolean,
    val contribution: BigDecimal?,
    val issueDate: String,
    val returnDate: String,
    val returned: Boolean,
    val notes: String,
) {
    companion object {
        private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

        fun from(o: JsonObject): Ausgabe {
            val q = (o["quantity"] as? JsonPrimitive)?.let { it.longOrNull ?: it.doubleOrNull?.toLong() } ?: 1L
            val c = (o["contributionAmount"] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull?.toBigDecimalOrNull()
            return Ausgabe(
                raw = o, id = t(o, "id"), memberId = t(o, "memberId"), itemId = t(o, "inventoryItemId"),
                itemName = t(o, "itemName").ifEmpty { "Gegenstand" }, itemNumber = t(o, "itemNumber"),
                quantity = q.toInt().coerceAtLeast(1), unit = t(o, "unit"),
                hasContribution = (o["hasContribution"] as? JsonPrimitive)?.booleanOrNull ?: false, contribution = c,
                issueDate = t(o, "issueDate"), returnDate = t(o, "returnDate"),
                returned = t(o, "status") == "returned", notes = t(o, "notes"),
            )
        }
    }
}

/** Eingabefelder der Ausgabe-Maske. [id] ist null bei einer neuen Ausgabe. */
data class AusgabeForm(
    val id: String? = null,
    val itemId: String = "",
    val quantity: String = "1",
    val issueDate: String = "",
    val hasContribution: Boolean = false,
    val contribution: String = "",
    val notes: String = "",
) {
    companion object {
        fun von(a: Ausgabe) = AusgabeForm(
            a.id, a.itemId, a.quantity.toString(), a.issueDate, a.hasContribution,
            a.contribution?.let { MemberRules.formatFee(it) } ?: "", a.notes,
        )
    }
}

/** Ausgaben von Inventar an Mitglieder: Anlegen, Ändern, Zurückgeben, Entfernen. */
object MemberMaterial {
    const val AREA = MemberStore.MATERIAL
    const val INVENTORY = "inventory"

    private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    fun gegenstaende(store: DocumentStore): List<Gegenstand> =
        store.all(INVENTORY).filter { t(it, "condition") != "discarded" }.map { Gegenstand(t(it, "id"), t(it, "name").ifEmpty { "Gegenstand" }, t(it, "itemNumber"), t(it, "unit").ifEmpty { "Stk." }) }
            .sortedWith(compareBy(java.text.Collator.getInstance(java.util.Locale.GERMANY)) { it.name })

    /** Alle Ausgaben aller Mitglieder, neueste zuerst. */
    fun alle(store: DocumentStore): List<Ausgabe> =
        store.all(AREA).map { Ausgabe.from(it) }.sortedWith(compareByDescending<Ausgabe> { it.issueDate }.thenByDescending { it.id })

    /** Wer den Gegenstand gerade hat: nicht zurückgegebene Ausgaben dieses Gegenstands, neueste zuerst (wie Desktop `ausgabenVon`). */
    fun offeneVon(store: DocumentStore, itemId: String): List<Ausgabe> = alle(store).filter { !it.returned && it.itemId == itemId }

    /** Ausgaben eines Mitglieds, neueste Ausgabe zuerst. */
    fun ausgaben(store: DocumentStore, memberId: String): List<Ausgabe> =
        store.all(AREA).filter { t(it, "memberId") == memberId }.map { Ausgabe.from(it) }
            .sortedWith(compareByDescending<Ausgabe> { it.issueDate }.thenByDescending { it.id })

    fun validate(f: AusgabeForm, gegenstaende: List<Gegenstand>): Map<String, String> {
        val e = LinkedHashMap<String, String>()
        if (f.itemId.isEmpty() || gegenstaende.none { it.id == f.itemId }) e["item"] = "Bitte einen Gegenstand wählen."
        val q = f.quantity.trim().toIntOrNull()
        if (q == null || q < 1) e["quantity"] = "Menge: ganze Zahl ab 1."
        if (f.issueDate.isNotEmpty() && runCatching { LocalDate.parse(f.issueDate) }.isFailure) e["issueDate"] = "Ausgabedatum ist ungültig."
        return e
    }

    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    private fun menge(a: Ausgabe) = "${a.quantity} ${a.unit}".trim()

    private fun protokoll(store: DocumentStore, memberId: String, now: ZonedDateTime, summary: String, aenderungen: List<Triple<String, String, String>> = emptyList()) {
        val m = store.get(MemberStore.AREA, memberId) ?: return
        val log = MemberAudit.material(m, now, summary, aenderungen)
        store.put(MemberStore.LOG, t(log, "id"), log)
    }

    /** Legt an oder ändert. Unbekannte Felder bleiben erhalten; ein geänderter Gegenstand wird neu kopiert. */
    fun speichern(
        store: DocumentStore, memberId: String, f: AusgabeForm, today: LocalDate = LocalDate.now(), now: ZonedDateTime = ZonedDateTime.now(),
    ): JsonObject = store.transaction {
        val item = gegenstaende(store).firstOrNull { it.id == f.itemId }
        val base = f.id?.let { store.get(AREA, it) }
        require(f.id == null || base != null) { "Die Ausgabe gibt es nicht mehr." }
        val stamp = Zeit.stempel(now)
        val id = f.id ?: "mia_${now.toInstant().toEpochMilli()}_${Zeit.zufall(5)}"
        val beitrag = MemberCsv.betrag(f.contribution)
        val m = LinkedHashMap<String, JsonElement>(base ?: emptyMap())
        m["id"] = JsonPrimitive(id)
        m["memberId"] = JsonPrimitive(memberId)
        m["inventoryItemId"] = JsonPrimitive(f.itemId)
        m["itemName"] = JsonPrimitive(item?.name ?: base?.let { t(it, "itemName") }.orEmpty().ifEmpty { "Gegenstand" })
        m["itemNumber"] = JsonPrimitive(item?.nummer ?: base?.let { t(it, "itemNumber") }.orEmpty())
        m["quantity"] = JsonPrimitive((f.quantity.trim().toIntOrNull() ?: 1).coerceAtLeast(1))
        m["unit"] = JsonPrimitive(item?.einheit ?: base?.let { t(it, "unit") }.orEmpty().ifEmpty { "Stk." })
        m["hasContribution"] = JsonPrimitive(f.hasContribution)
        if (f.hasContribution) m["contributionAmount"] = zahl(beitrag) else m.remove("contributionAmount")
        m["issueDate"] = JsonPrimitive(f.issueDate.ifEmpty { base?.let { t(it, "issueDate") }.orEmpty().ifEmpty { today.toString() } })
        if (base == null) {
            m["status"] = JsonPrimitive("issued")
            m["createdAt"] = JsonPrimitive(stamp)
        }
        val n = f.notes.trim()
        if (n.isEmpty()) m.remove("notes") else m["notes"] = JsonPrimitive(n)
        m["updatedAt"] = JsonPrimitive(stamp)
        val doc = JsonObject(m)
        store.put(AREA, id, doc)
        val neu = Ausgabe.from(doc)
        if (base == null) {
            protokoll(store, memberId, now, "Material ausgegeben: ${neu.itemName} (${menge(neu)})")
        } else {
            val alt = Ausgabe.from(base)
            val diff = buildList {
                if (alt.itemId != neu.itemId) add(Triple("Gegenstand", alt.itemName, neu.itemName))
                if (alt.quantity != neu.quantity) add(Triple("Menge", alt.quantity.toString(), neu.quantity.toString()))
                if (alt.issueDate != neu.issueDate) add(Triple("Ausgabedatum", Zeit.deutsch(alt.issueDate), Zeit.deutsch(neu.issueDate)))
                if (eigen(alt) != eigen(neu)) add(Triple("Eigenanteil", eigen(alt), eigen(neu)))
                if (alt.notes != neu.notes) add(Triple("Notiz", alt.notes, neu.notes))
            }
            if (diff.isNotEmpty()) protokoll(store, memberId, now, "Material bearbeitet: ${neu.itemName}", diff)
        }
        doc
    }

    private fun eigen(a: Ausgabe) = if (a.hasContribution && a.contribution != null) Zeit.euro(a.contribution) else ""

    /** Zurückgeben (heutiges Datum) bzw. wieder als ausgegeben markieren. */
    fun umschalten(store: DocumentStore, id: String, today: LocalDate = LocalDate.now(), now: ZonedDateTime = ZonedDateTime.now()): JsonObject =
        store.transaction {
            val a = store.get(AREA, id) ?: throw IllegalArgumentException("Die Ausgabe gibt es nicht mehr.")
            val m = LinkedHashMap<String, JsonElement>(a)
            if (t(a, "status") == "returned") {
                m["status"] = JsonPrimitive("issued")
                m.remove("returnDate")
            } else {
                m["status"] = JsonPrimitive("returned")
                m["returnDate"] = JsonPrimitive(today.toString())
            }
            m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
            val doc = JsonObject(m).also { store.put(AREA, id, it) }
            val a2 = Ausgabe.from(doc)
            protokoll(
                store, a2.memberId, now,
                if (a2.returned) "Material zurückgegeben: ${a2.itemName} (${menge(a2)})" else "Material wieder ausgegeben: ${a2.itemName} (${menge(a2)})",
            )
            doc
        }

    fun entfernen(store: DocumentStore, id: String, now: ZonedDateTime = ZonedDateTime.now()) {
        store.transaction {
            val a = store.get(AREA, id)?.let { Ausgabe.from(it) }
            store.delete(AREA, id)
            if (a != null) protokoll(store, a.memberId, now, "Material-Verknüpfung entfernt: ${a.itemName} (${menge(a)})")
        }
    }

    /** "Beitrag: 12,50 €" bzw. "Kein Eigenanteil". */
    fun eigenanteil(a: Ausgabe): String =
        if (a.hasContribution && a.contribution != null && a.contribution.signum() > 0) "Eigenanteil: ${Zeit.euro(a.contribution)}" else "Kein Eigenanteil"
}

/** Ein Eintrag der Historie eines Mitglieds. */
data class VerlaufEintrag(
    val id: String, val summary: String, val timestamp: String, val author: String,
    val changes: List<Triple<String, String, String>>, // Bezeichnung, alt, neu
)

object MemberHistory {
    private fun t(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull ?: ""

    /** Wie am Desktop: leer, 0, false und null erscheinen als "–". */
    fun wert(v: JsonElement?): String = when (v) {
        null, JsonNull -> "–"
        is JsonPrimitive -> if (v.isString) v.content.ifEmpty { "–" } else when (v.content) { "false", "0", "null", "" -> "–"; else -> v.content }
        is JsonArray -> if (v.isEmpty()) "–" else v.toString()
        is JsonObject -> v.toString()
    }

    /** Protokolleinträge des Mitglieds, neueste zuerst (Abweichung vom Desktop, der sie in Speicherreihenfolge zeigt). */
    fun fuer(store: DocumentStore, memberId: String): List<VerlaufEintrag> =
        store.all(MemberStore.LOG).filter { t(it, "memberId") == memberId }.map { l ->
            VerlaufEintrag(
                t(l, "id"), t(l, "summary"), t(l, "timestamp"), t(l, "author"),
                (l["changes"] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }.map {
                    Triple(t(it, "label"), wert(it["oldValue"]), wert(it["newValue"]))
                },
            )
        }.sortedByDescending { it.timestamp }

    private val FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy, HH:mm:ss")

    /** ISO-Zeitstempel (UTC) in Ortszeit, "26.10.2026, 09:30:00". Unlesbares bleibt unverändert. */
    fun zeit(iso: String, zone: ZoneId = ZoneId.systemDefault()): String =
        try { java.time.Instant.parse(iso).atZone(zone).format(FORMAT) } catch (e: Exception) { iso }
}
