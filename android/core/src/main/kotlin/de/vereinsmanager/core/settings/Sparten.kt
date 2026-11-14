package de.vereinsmanager.core.settings

import de.vereinsmanager.core.members.MemberMaterial
import de.vereinsmanager.core.members.Zeit
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.ZonedDateTime

/** Wo eine Sparte noch verwendet wird. */
data class SpartenVerwendung(val mitglieder: Int, val buchungen: Int, val inventar: Int) {
    val gesamt get() = mitglieder + buchungen + inventar

    /** „3 Mitglieder, 12 Buchungen“ – nur, was vorkommt. */
    fun text(): String = listOfNotNull(
        mitglieder.takeIf { it > 0 }?.let { if (it == 1) "1 Mitglied" else "$it Mitglieder" },
        buchungen.takeIf { it > 0 }?.let { if (it == 1) "1 Buchung" else "$it Buchungen" },
        inventar.takeIf { it > 0 }?.let { if (it == 1) "1 Inventargegenstand" else "$it Inventargegenstände" },
    ).joinToString(", ")
}

/**
 * Die Sparten (Abteilungen) des Vereins: die Liste `departments` im Dokument `settings/main`, wie am Desktop.
 * Alle anderen Felder der Einstellungen bleiben beim Ändern unverändert.
 *
 * Anders als am Desktop wird eine Sparte, die noch gebraucht wird, nicht gelöscht: Mitglieder, Buchungen und
 * Inventar führen sie als Text, und ein gelöschter Name bliebe dort als „Waise“ stehen.
 */
object Sparten {
    const val MAX_LAENGE = 60

    private fun text(o: JsonObject, k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull.orEmpty()

    fun lesen(settings: JsonObject?): List<String> =
        (settings?.get("departments") as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { s -> s.isNotEmpty() } } ?: emptyList()

    fun lesen(store: DocumentStore): List<String> = lesen(store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID))

    /** Fehlertext, wenn [name] als neue Sparte nicht geht; sonst null. Groß-/Kleinschreibung zählt beim Vergleich nicht. */
    fun pruefen(name: String, vorhanden: List<String>): String? {
        val n = name.trim()
        if (n.isEmpty()) return "Bitte einen Namen eingeben."
        if (n.length > MAX_LAENGE) return "Der Name ist zu lang (höchstens $MAX_LAENGE Zeichen)."
        if (vorhanden.any { it.equals(n, ignoreCase = true) }) return "Die Sparte „$n“ gibt es schon."
        return null
    }

    fun verwendung(store: DocumentStore, name: String): SpartenVerwendung {
        fun zaehle(bereich: String) = store.all(bereich).count { text(it, "department") == name }
        return SpartenVerwendung(zaehle("members"), zaehle("transactions"), zaehle(MemberMaterial.INVENTORY))
    }

    private fun schreiben(store: DocumentStore, liste: List<String>, now: ZonedDateTime) {
        val alt = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)
        val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
        m["id"] = JsonPrimitive(Vereinsdaten.ID)
        m["departments"] = JsonArray(liste.map { JsonPrimitive(it) })
        m["updatedAt"] = JsonPrimitive(Zeit.stempel(now))
        store.put(Vereinsdaten.BEREICH, Vereinsdaten.ID, JsonObject(m))
    }

    fun hinzufuegen(store: DocumentStore, name: String, now: ZonedDateTime = ZonedDateTime.now()): List<String> = store.transaction {
        val liste = lesen(store)
        pruefen(name, liste)?.let { throw IllegalArgumentException(it) }
        (liste + name.trim()).also { schreiben(store, it, now) }
    }

    /**
     * Benennt eine Sparte um und zieht sie bei allen Mitgliedern, Buchungen und Inventargegenständen mit.
     * Das gibt es am Desktop nicht; ohne das müsste man neu anlegen und alles von Hand umstellen.
     */
    fun umbenennen(store: DocumentStore, alt: String, neu: String, now: ZonedDateTime = ZonedDateTime.now()): List<String> = store.transaction {
        val liste = lesen(store)
        if (alt !in liste) throw IllegalArgumentException("Die Sparte „$alt“ gibt es nicht mehr.")
        val n = neu.trim()
        if (n != alt) pruefen(n, liste.filter { it != alt })?.let { throw IllegalArgumentException(it) }
        if (n == alt) return@transaction liste
        for (bereich in listOf("members", "transactions", MemberMaterial.INVENTORY)) {
            for (d in store.all(bereich)) {
                if (text(d, "department") != alt) continue
                val m = LinkedHashMap<String, JsonElement>(d)
                m["department"] = JsonPrimitive(n)
                val id = text(d, "id")
                if (id.isNotEmpty()) store.put(bereich, id, JsonObject(m))
            }
        }
        liste.map { if (it == alt) n else it }.also { schreiben(store, it, now) }
    }

    /** Löscht eine Sparte, die nirgends mehr gebraucht wird. Mindestens eine Sparte bleibt immer. */
    fun loeschen(store: DocumentStore, name: String, now: ZonedDateTime = ZonedDateTime.now()): List<String> = store.transaction {
        val liste = lesen(store)
        if (name !in liste) return@transaction liste
        if (liste.size <= 1) throw IllegalArgumentException("Mindestens eine Sparte muss bleiben.")
        val v = verwendung(store, name)
        if (v.gesamt > 0) throw IllegalArgumentException("„$name“ wird noch verwendet (${v.text()}). Bitte erst dort eine andere Sparte eintragen oder die Sparte umbenennen.")
        liste.filter { it != name }.also { schreiben(store, it, now) }
    }

    /** Schiebt eine Sparte um [schritt] Plätze (−1 nach oben, +1 nach unten). */
    fun verschieben(store: DocumentStore, name: String, schritt: Int, now: ZonedDateTime = ZonedDateTime.now()): List<String> = store.transaction {
        val liste = lesen(store).toMutableList()
        val i = liste.indexOf(name)
        val j = i + schritt
        if (i < 0 || j < 0 || j >= liste.size) return@transaction liste
        liste.add(j, liste.removeAt(i))
        liste.also { schreiben(store, it, now) }
    }
}
