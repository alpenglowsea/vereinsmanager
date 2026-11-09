package de.vereinsmanager.core.finance

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.sepa.SepaService
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigDecimal
import java.time.ZonedDateTime

/** Die Angaben zu einem Konto, wie sie im Formular stehen (der Anfangsbestand als getippter Text). */
data class KontoForm(
    val id: String,
    val name: String = "",
    val art: String = "bank",
    val iban: String = "",
    val bic: String = "",
    val anfangsbestand: String = "",
    val farbe: String = "emerald",
    val beschreibung: String = "",
) {
    companion object {
        fun von(k: Konto) = KontoForm(
            k.id, k.name, k.art, k.iban, k.bic,
            if (k.anfangsbestand.signum() == 0) "" else BuchungRegeln.betragText(k.anfangsbestand).let { if (k.anfangsbestand.signum() < 0) "-$it" else it },
            k.farbe.ifEmpty { "emerald" }, k.beschreibung,
        )
    }
}

class KontoException(message: String) : Exception(message)

/** Konten und Kassen anlegen, ändern, löschen und ordnen. Der Aufbau der Datensätze folgt dem Desktop (`FinancialAccount`). */
object KontoStore {
    /** Die Farbnamen, die auch der Desktop kennt. */
    val FARBEN = listOf("emerald", "green", "blue", "indigo", "purple", "pink", "rose", "red", "orange", "amber", "yellow", "teal", "cyan")

    private fun s(v: String) = JsonPrimitive(v)

    fun neueId(now: ZonedDateTime = ZonedDateTime.now()): String = "acc-" + now.toInstant().toEpochMilli()

    /** Der Anfangsbestand darf ein Minus haben ("-120,50"); leer gilt als 0. */
    fun parseBestand(text: String): BigDecimal? {
        val t = text.trim()
        if (t.isEmpty()) return BigDecimal.ZERO.setScale(2)
        val negativ = t.startsWith("-")
        val b = BuchungRegeln.parseBetrag(if (negativ) t.substring(1) else t) ?: return null
        return if (negativ) b.negate() else b
    }

    private fun bereinigeIban(v: String) = v.uppercase().replace(Regex("\\s"), "")

    /** Fehlermeldungen je Feld; leer, wenn alles in Ordnung ist. */
    fun pruefen(f: KontoForm): Map<String, String> {
        val e = linkedMapOf<String, String>()
        if (f.name.isBlank()) e["name"] = "Bitte eine Bezeichnung eingeben."
        if (f.art !in FinanceLabels.ACCOUNT_TYPE) e["art"] = "Bitte eine Kontoart wählen."
        if (parseBestand(f.anfangsbestand) == null) e["anfangsbestand"] = "Der Betrag ist ungültig."
        if (f.art == "bank") {
            val iban = bereinigeIban(f.iban)
            if (iban.isNotEmpty()) SepaService.validateIban(iban).let { if (!it.isValid) e["iban"] = it.error ?: "Die IBAN ist ungültig." }
            if (!SepaService.validateBic(f.bic)) e["bic"] = "Die BIC ist ungültig."
        }
        return e
    }

    private fun zahl(v: BigDecimal): JsonElement {
        val k = v.stripTrailingZeros()
        return if (k.scale() <= 0) JsonPrimitive(k.toBigInteger().toLong()) else JsonPrimitive(k.toDouble())
    }

    /** Legt ein Konto an oder ändert es. Unbekannte Felder, `order` und `createdAt` des bisherigen Datensatzes bleiben erhalten. */
    fun speichern(store: DocumentStore, f: KontoForm, now: ZonedDateTime = ZonedDateTime.now()): Konto {
        val fehler = pruefen(f)
        if (fehler.isNotEmpty()) throw KontoException(fehler.values.first())
        return store.transaction {
            val alt = store.get(Finance.KONTEN, f.id)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = s(f.id)
            m["name"] = s(f.name.trim())
            m["accountType"] = s(f.art)
            m["iban"] = s(bereinigeIban(f.iban))
            m["bic"] = s(f.bic.uppercase().trim())
            m["initialBalance"] = zahl(parseBestand(f.anfangsbestand)!!)
            m["color"] = s(f.farbe.ifEmpty { "blue" })
            m["description"] = s(f.beschreibung.trim())
            if (alt?.get("createdAt") == null) m["createdAt"] = s(Zeit.stempel(now))
            val doc = JsonObject(m)
            store.put(Finance.KONTEN, f.id, doc)
            Konto.from(doc)
        }
    }

    /** Wie viele Buchungen das Konto nennen (als Konto oder als Zielkonto einer Umbuchung). */
    fun buchungenAm(store: DocumentStore, id: String): Int =
        Finance.buchungen(store).count { it.kontoId == id || it.zielkontoId == id }

    /**
     * Löscht ein Konto. Hängen Buchungen daran, müssen sie auf [uebertragenAuf] übertragen werden. Eine Umbuchung, die dadurch
     * von einem Konto auf dasselbe Konto liefe, verhindert das Löschen. Es muss mindestens ein Konto übrig bleiben.
     */
    fun loeschen(store: DocumentStore, id: String, uebertragenAuf: String? = null, now: ZonedDateTime = ZonedDateTime.now()) {
        store.transaction {
            val konten = Finance.konten(store)
            if (konten.none { it.id == id }) throw KontoException("Das Konto gibt es nicht mehr.")
            if (konten.size <= 1) throw KontoException("Es muss mindestens ein Konto bleiben.")
            val betroffen = Finance.buchungen(store).filter { it.kontoId == id || it.zielkontoId == id }
            if (betroffen.isNotEmpty()) {
                if (uebertragenAuf == null || uebertragenAuf == id || konten.none { it.id == uebertragenAuf }) {
                    throw KontoException("An diesem Konto hängen ${betroffen.size} Buchungen. Bitte ein anderes Konto für sie wählen.")
                }
                val stempel = Zeit.stempel(now)
                for (b in betroffen) {
                    val neuKonto = if (b.kontoId == id) uebertragenAuf else b.kontoId
                    val neuZiel = if (b.zielkontoId == id) uebertragenAuf else b.zielkontoId
                    if (b.istUmbuchung && neuZiel.isNotEmpty() && neuKonto == neuZiel) {
                        throw KontoException("Eine Umbuchung (${b.belegNummer.ifEmpty { b.datum }}) läge danach zwischen demselben Konto. Bitte sie zuerst ändern oder ein anderes Konto wählen.")
                    }
                }
                for (b in betroffen) {
                    val doc = store.get(Finance.BUCHUNGEN, b.id) ?: continue
                    val m = LinkedHashMap<String, JsonElement>(doc)
                    if (b.kontoId == id) m["accountId"] = s(uebertragenAuf)
                    if (b.zielkontoId == id) m["targetAccountId"] = s(uebertragenAuf)
                    m["updatedAt"] = s(stempel)
                    store.put(Finance.BUCHUNGEN, b.id, JsonObject(m))
                }
            }
            store.delete(Finance.KONTEN, id)
        }
    }

    /** Schreibt die Reihenfolge fest (`order` = Platz in [ids]); Konten, die in [ids] fehlen, kommen danach. */
    fun ordnen(store: DocumentStore, ids: List<String>) {
        store.transaction {
            val alle = Finance.konten(store).map { it.id }
            val reihe = ids.filter { it in alle }.distinct() + alle.filter { it !in ids }
            reihe.forEachIndexed { i, id ->
                val doc = store.get(Finance.KONTEN, id) ?: return@forEachIndexed
                val m = LinkedHashMap<String, JsonElement>(doc)
                m["order"] = JsonPrimitive(i)
                store.put(Finance.KONTEN, id, JsonObject(m))
            }
        }
    }

    /** Verschiebt ein Konto um [schritt] Plätze (−1 nach oben, +1 nach unten). Gibt false zurück, wenn es schon am Rand steht. */
    fun schieben(store: DocumentStore, id: String, schritt: Int): Boolean {
        val ids = Finance.konten(store).map { it.id }.toMutableList()
        val von = ids.indexOf(id)
        val nach = von + schritt
        if (von < 0 || nach !in ids.indices) return false
        ids.add(nach, ids.removeAt(von))
        ordnen(store, ids)
        return true
    }
}
