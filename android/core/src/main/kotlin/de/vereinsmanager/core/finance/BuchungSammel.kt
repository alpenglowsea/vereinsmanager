package de.vereinsmanager.core.finance

import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import java.time.ZonedDateTime

/** Die Zuordnung zu einem Konto des Kontenrahmens (Nummernkreis und Konto), wie sie das Buchungsformular setzt. */
data class SammelKategorie(val nummernkreis: String, val konto: String, val skrKonto: String, val ust: Int? = null)

/**
 * Was die Sammelbearbeitung an Buchungen ändern soll; nur gesetzte Felder (nicht null) werden angefasst.
 * [sparte] "" entfernt die Sparte. [notizErsetzen] "" leert die Notiz, [notizAnhaengen] leer ändert nichts.
 */
data class BuchungSammel(
    val kontoId: String? = null,
    val sphaere: String? = null,
    val sparte: String? = null,
    val kategorie: SammelKategorie? = null,
    val ust: Int? = null,
    val partner: String? = null,
    val datum: String? = null,
    val notizAnhaengen: String? = null,
    val notizErsetzen: String? = null,
) {
    val leer: Boolean get() = kontoId == null && sphaere == null && sparte == null && kategorie == null && ust == null &&
        partner.isNullOrBlank() && datum.isNullOrEmpty() && notizAnhaengen.isNullOrBlank() && notizErsetzen == null
}

/**
 * Ergebnis: [geaendert] = Buchungen, an denen sich etwas geändert hat; [ohneZuordnung] = Umbuchungen und aufgeteilte Buchungen,
 * bei denen Sphäre, Sparte, Konto und Umsatzsteuer NICHT geändert wurden (sie haben keine einheitliche Zuordnung);
 * [kontoUebersprungen] = Umbuchungen, deren Konto nicht geändert wurde, weil Quelle und Ziel sonst gleich wären.
 */
data class SammelBericht(val geaendert: Int, val ohneAenderung: Int, val ohneZuordnung: Int, val kontoUebersprungen: Int)

object BuchungSammelStore {
    private fun JsonObject.text(k: String) = (this[k] as? JsonPrimitive)?.contentOrNull

    fun anwenden(store: DocumentStore, ids: List<String>, e: BuchungSammel, now: ZonedDateTime = ZonedDateTime.now()): SammelBericht {
        if (e.leer) throw IllegalArgumentException("Es ist nichts zum Ändern gewählt.")
        if (!e.datum.isNullOrEmpty()) runCatching { LocalDate.parse(e.datum) }.getOrElse { throw IllegalArgumentException("Das Datum ist ungültig.") }
        if (e.kontoId != null && store.get(Finance.KONTEN, e.kontoId) == null) throw IllegalArgumentException("Das gewählte Konto gibt es nicht.")
        val stempel = Zeit.stempel(now)
        var geaendert = 0; var gleich = 0; var ohneZuordnung = 0; var kontoSkip = 0
        store.transaction {
            for (id in ids.distinct()) {
                val doc = store.get(Finance.BUCHUNGEN, id) ?: continue
                val m = LinkedHashMap<String, JsonElement>(doc)
                val umbuchung = doc.text("type") == "transfer"
                val geteilt = (doc["isSplit"] as? JsonPrimitive)?.contentOrNull == "true"
                var skipZuordnung = false
                fun setze(k: String, v: JsonElement) { if (m[k] != v) m[k] = v }

                if (e.kontoId != null) {
                    if (umbuchung && doc.text("targetAccountId") == e.kontoId) kontoSkip++ else setze("accountId", JsonPrimitive(e.kontoId))
                }
                val zuordnung = e.sphaere != null || e.sparte != null || e.kategorie != null || e.ust != null
                if (zuordnung) {
                    if (umbuchung || geteilt) skipZuordnung = true
                    else {
                        e.sphaere?.let { setze("sphere", JsonPrimitive(it)) }
                        e.sparte?.let { if (it.isEmpty()) m.remove("department") else setze("department", JsonPrimitive(it)) }
                        e.kategorie?.let { k ->
                            setze("mainCategory", JsonPrimitive(k.nummernkreis)); setze("subCategory", JsonPrimitive(k.konto))
                            setze("category", JsonPrimitive(k.konto)); setze("skrAccount", JsonPrimitive(k.skrKonto))
                            k.ust?.let { setze("vatRate", JsonPrimitive(it)) }
                        }
                        e.ust?.let { setze("vatRate", JsonPrimitive(it)) }
                    }
                }
                if (!e.partner.isNullOrBlank()) setze("partner", JsonPrimitive(e.partner.trim()))
                if (!e.datum.isNullOrEmpty()) setze("date", JsonPrimitive(e.datum))
                if (e.notizErsetzen != null) setze("notes", JsonPrimitive(e.notizErsetzen))
                else if (!e.notizAnhaengen.isNullOrBlank()) {
                    val alt = doc.text("notes").orEmpty()
                    setze("notes", JsonPrimitive(if (alt.isNotEmpty()) alt + "\n" + e.notizAnhaengen.trim() else e.notizAnhaengen.trim()))
                }
                if (skipZuordnung) ohneZuordnung++
                val neu = JsonObject(m)
                if (neu == doc) { gleich++; continue }
                m["updatedAt"] = JsonPrimitive(stempel)
                store.put(Finance.BUCHUNGEN, id, JsonObject(m))
                geaendert++
            }
        }
        return SammelBericht(geaendert, gleich, ohneZuordnung, kontoSkip)
    }
}
