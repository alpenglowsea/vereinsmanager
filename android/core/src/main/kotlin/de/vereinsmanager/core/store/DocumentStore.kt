package de.vereinsmanager.core.store

import kotlinx.serialization.json.JsonObject

/**
 * Der Speicher der App: je Bereich (z. B. "members") beliebig viele Einträge, jeder als vollständiges
 * JSON-Dokument unter seiner `id`. Unbekannte Felder bleiben so beim Zurückschreiben erhalten.
 *
 * Auf dem Handy steckt dahinter SQLite, in Tests ein Speicher im Arbeitsspeicher.
 */
interface DocumentStore {
    fun ids(area: String): List<String>
    fun count(area: String): Int
    fun get(area: String, id: String): JsonObject?
    /** Alle Einträge in der Reihenfolge, in der sie angelegt wurden. */
    fun all(area: String): List<JsonObject>
    fun put(area: String, id: String, doc: JsonObject)
    fun delete(area: String, id: String)
    fun clear(area: String)

    /** Alles oder nichts: Wirft [block], bleibt der Speicher wie vorher. */
    fun <T> transaction(block: () -> T): T
}

class InMemoryDocumentStore : DocumentStore {
    private var data = LinkedHashMap<String, LinkedHashMap<String, JsonObject>>()
    private var depth = 0

    private fun area(a: String) = data.getOrPut(a) { LinkedHashMap() }

    override fun ids(area: String) = area(area).keys.toList()
    override fun count(area: String) = area(area).size
    override fun get(area: String, id: String) = area(area)[id]
    override fun all(area: String) = area(area).values.toList()
    override fun put(area: String, id: String, doc: JsonObject) { area(area)[id] = doc }
    override fun delete(area: String, id: String) { area(area).remove(id) }
    override fun clear(area: String) { area(area).clear() }

    override fun <T> transaction(block: () -> T): T {
        val sicherung = if (depth == 0) copy() else null
        depth++
        try {
            return block()
        } catch (e: Throwable) {
            if (sicherung != null) data = sicherung
            throw e
        } finally {
            depth--
        }
    }

    private fun copy(): LinkedHashMap<String, LinkedHashMap<String, JsonObject>> {
        val c = LinkedHashMap<String, LinkedHashMap<String, JsonObject>>()
        for ((k, v) in data) c[k] = LinkedHashMap(v)
        return c
    }
}
