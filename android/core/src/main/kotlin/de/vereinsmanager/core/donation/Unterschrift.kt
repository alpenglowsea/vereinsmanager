package de.vereinsmanager.core.donation

import de.vereinsmanager.core.settings.Vereinsdaten
import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.util.Locale

/**
 * Eine mit dem Finger gezeichnete Unterschrift als Linienzüge. Die Punkte sind auf 0..1 bezogen (x auf die Breite, y auf die Höhe
 * der Zeichenfläche); [seitenverhaeltnis] ist Breite geteilt durch Höhe dieser Fläche. So lässt sie sich beliebig skalieren.
 */
data class Unterschrift(val seitenverhaeltnis: Double, val striche: List<List<Pair<Double, Double>>>) {
    val leer: Boolean get() = striche.none { it.size >= 2 }
}

/** Die hinterlegte Unterschrift steht im Vereinsdaten-Dokument (`settings/main`, Schlüssel `signature`) und geht mit der Sicherung mit. */
object Unterschriften {
    const val SCHLUESSEL = "signature"

    private fun rund(v: Double): JsonElement = JsonPrimitive(String.format(Locale.ROOT, "%.4f", v.coerceIn(0.0, 1.0)).toDouble())

    fun lesen(store: DocumentStore): Unterschrift? {
        val o = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)?.get(SCHLUESSEL) as? JsonObject ?: return null
        val aspekt = (o["aspect"] as? JsonPrimitive)?.doubleOrNull?.takeIf { it > 0 } ?: return null
        val striche = (o["strokes"] as? JsonArray)?.mapNotNull { st ->
            (st as? JsonArray)?.mapNotNull { p ->
                val a = p as? JsonArray
                val x = (a?.getOrNull(0) as? JsonPrimitive)?.doubleOrNull
                val y = (a?.getOrNull(1) as? JsonPrimitive)?.doubleOrNull
                if (x != null && y != null) x to y else null
            }
        }.orEmpty()
        return Unterschrift(aspekt, striche).takeIf { !it.leer }
    }

    /** Speichert die Unterschrift; null (oder eine leere) löscht sie. Der übrige Inhalt der Vereinsdaten bleibt unverändert. */
    fun speichern(store: DocumentStore, u: Unterschrift?) {
        store.transaction {
            val alt = store.get(Vereinsdaten.BEREICH, Vereinsdaten.ID)
            val m = LinkedHashMap<String, JsonElement>(alt ?: JsonObject(emptyMap()))
            m["id"] = JsonPrimitive(Vereinsdaten.ID)
            if (u == null || u.leer) m.remove(SCHLUESSEL)
            else m[SCHLUESSEL] = JsonObject(
                linkedMapOf(
                    "aspect" to JsonPrimitive(u.seitenverhaeltnis),
                    "strokes" to JsonArray(
                        u.striche.filter { it.size >= 2 }.map { st -> JsonArray(st.map { (x, y) -> JsonArray(listOf(rund(x), rund(y))) }) },
                    ),
                ),
            )
            store.put(Vereinsdaten.BEREICH, Vereinsdaten.ID, JsonObject(m))
        }
    }
}
