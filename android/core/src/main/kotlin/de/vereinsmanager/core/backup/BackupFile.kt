package de.vereinsmanager.core.backup

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class BackupFormatException(message: String) : Exception(message)

/**
 * Eine Klartext-Sicherung. Die Einträge bleiben als JSON-Bäume erhalten, damit
 * unbekannte Felder beim Zurückschreiben nicht verloren gehen
 * (BACKUP_FORMAT.md, "Unbekannte Felder müssen erhalten bleiben").
 */
data class BackupFile(
    val app: String?,
    val version: String?,
    val exportedAt: String?,
    /** Nur Bereiche, die in der Datei vorkamen (fehlend oder null = nicht enthalten). */
    val data: Map<String, JsonElement>,
) {
    fun list(area: String): List<JsonObject>? =
        (data[area] as? kotlinx.serialization.json.JsonArray)?.map { it.jsonObject }

    fun single(area: String): JsonObject? = data[area] as? JsonObject

    /** Ausdrücklich enthaltene Einträge je Listen-Bereich, zum Anzeigen im Vergleich. */
    fun counts(): Map<String, Int> =
        BackupAreas.LISTS.mapNotNull { a -> list(a)?.let { a to it.size } }.toMap()

    @OptIn(ExperimentalSerializationApi::class)
    fun toJsonText(): String {
        val dataObj = JsonObject(BackupAreas.ALL.mapNotNull { k -> data[k]?.let { k to it } }.toMap())
        val root = JsonObject(
            linkedMapOf(
                "app" to JsonPrimitive(app ?: APP_NAME),
                "version" to JsonPrimitive(version ?: FORMAT_VERSION),
                "exportedAt" to JsonPrimitive(exportedAt ?: ""),
                "data" to dataObj,
            ),
        )
        return PRETTY.encodeToString(JsonElement.serializer(), root)
    }

    companion object {
        const val APP_NAME = "VereinsManager Lokal"
        const val FORMAT_VERSION = "1.2.3"
        const val ENCRYPTED_FORMAT = "vereinsmanager-verschluesselt"

        @OptIn(ExperimentalSerializationApi::class)
        private val PRETTY = Json {
            prettyPrint = true
            prettyPrintIndent = "  " // wie die Desktop-Fassung: 2 Leerzeichen
        }

        /** Erkennt die verschlüsselte Hülle (Feld `format`). */
        fun isEncrypted(text: String): Boolean {
            val root = runCatching { Json.parseToJsonElement(text) }.getOrNull() as? JsonObject
                ?: return false
            return root["format"]?.jsonPrimitive?.contentOrNull == ENCRYPTED_FORMAT
        }

        /** Liest eine Klartext-Sicherung. Wirft [BackupFormatException], wenn es keine ist. */
        fun parse(text: String): BackupFile {
            val root = try {
                Json.parseToJsonElement(text)
            } catch (e: Exception) {
                throw BackupFormatException("Die Datei ist keine gültige JSON-Datei.")
            } as? JsonObject ?: throw BackupFormatException("Die Datei ist keine Sicherung.")

            // Fehlt "data", gilt das Objekt selbst als Daten (ältere Dateien).
            val dataObj = (root["data"] as? JsonObject) ?: root

            val kept = linkedMapOf<String, JsonElement>()
            for (key in BackupAreas.ALL) {
                val v = dataObj[key] ?: continue
                if (v is JsonNull) continue
                val ok = if (key in BackupAreas.LISTS)
                    v is kotlinx.serialization.json.JsonArray else v is JsonObject
                if (!ok) throw BackupFormatException("Bereich „$key“ hat die falsche Form.")
                kept[key] = v
            }
            if (kept.isEmpty()) {
                throw BackupFormatException("Die Datei enthält keinen bekannten Bereich einer Sicherung.")
            }
            fun str(k: String) = (root[k] as? JsonPrimitive)?.contentOrNull
            return BackupFile(str("app"), str("version"), str("exportedAt"), kept)
        }
    }
}
