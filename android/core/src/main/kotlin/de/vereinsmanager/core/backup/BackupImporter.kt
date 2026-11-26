package de.vereinsmanager.core.backup

import de.vereinsmanager.core.store.DocumentStore
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

enum class ImportMode {
    /** Je Bereich der Datei: Bereich leeren und aus der Datei neu füllen. */
    REPLACE,
    /** Nur Einträge hinzufügen, deren id hier noch nicht existiert; der Bestand gewinnt immer. */
    MERGE,
}

data class ImportReport(
    val mode: ImportMode,
    /** Anzahl der Einträge je Listen-Bereich in der Datei (nur Bereiche, die vorkamen). */
    val inFile: Map<String, Int>,
    /** Bereiche, die sich nicht schreiben ließen, mit Grund. Die übrigen wurden eingespielt. */
    val failed: List<String>,
) {
    val ok get() = failed.isEmpty()
}

/** Schlüssel der Einzel-Bereiche im Speicher. */
object SingleIds {
    const val INVOICE_TEMPLATE = "main_template"
    /** Bewusst nicht "main_template" wie in der Desktop-Importroutine (BACKUP_FORMAT.md, Abschnitt 4). */
    const val MEETING_TEMPLATE = "main_meeting_template"
    const val DASHBOARD = "main_dashboard"
    const val SETTINGS = "main"

    val BY_AREA = mapOf(
        "invoiceTemplate" to INVOICE_TEMPLATE,
        "meetingTemplate" to MEETING_TEMPLATE,
        "dashboardConfig" to DASHBOARD,
        "settings" to SETTINGS,
    )
}

object BackupImporter {

    fun import(file: BackupFile, store: DocumentStore, mode: ImportMode): ImportReport {
        val failed = mutableListOf<String>()
        val inFile = linkedMapOf<String, Int>()

        for (area in BackupAreas.LISTS) {
            val list = file.data[area] as? JsonArray ?: continue
            inFile[area] = list.size
            try {
                importList(area, list, store, mode)
            } catch (e: Exception) {
                failed.add("$area (${e.message})")
            }
        }

        for ((area, key) in SingleIds.BY_AREA) {
            val doc = file.data[area] as? JsonObject ?: continue
            try {
                importSingle(area, key, doc, store, mode)
            } catch (e: Exception) {
                failed.add("$area (${e.message})")
            }
        }
        return ImportReport(mode, inFile, failed)
    }

    private fun idOf(e: JsonElement): String {
        val id = ((e as? JsonObject)?.get("id") as? JsonPrimitive)?.contentOrNull
        if (id.isNullOrBlank()) throw IllegalArgumentException("Ein Eintrag hat keine Kennung (id)")
        return id
    }

    private fun importList(area: String, list: JsonArray, store: DocumentStore, mode: ImportMode) {
        when (mode) {
            ImportMode.MERGE -> {
                if (list.isEmpty()) return
                store.transaction {
                    val bekannt = store.ids(area).toHashSet()
                    for (e in list) {
                        val id = idOf(e)
                        if (id !in bekannt) {
                            store.put(area, id, e as JsonObject)
                            bekannt.add(id)
                        }
                    }
                }
            }
            ImportMode.REPLACE -> {
                // Erst prüfen, dann anfassen: Ein Eintrag ohne id ändert nichts am Bereich.
                val ids = list.map { idOf(it) }
                val verschieden = ids.toSet().size
                store.transaction {
                    store.clear(area)
                    for ((i, e) in list.withIndex()) store.put(area, ids[i], e as JsonObject)
                    val gezaehlt = store.count(area)
                    check(gezaehlt == verschieden) { "Nachzählung: $gezaehlt statt $verschieden Einträge" }
                }
            }
        }
    }

    private fun withId(key: String, doc: JsonObject): JsonObject {
        val m = LinkedHashMap<String, JsonElement>()
        m["id"] = JsonPrimitive(key)
        m.putAll(doc) // eine id aus der Datei hat Vorrang (wie am Desktop)
        return JsonObject(m)
    }

    private fun importSingle(area: String, key: String, fromFile: JsonObject, store: DocumentStore, mode: ImportMode) {
        val existing = store.get(area, key)
        if (area == "settings") {
            val cleaned = BackupMerge.ohneVeralteteFelder(fromFile)
            if (mode == ImportMode.MERGE) {
                val merged = BackupMerge.ergaenzeStammdaten(cleaned, existing, BackupMerge.STAMMDATEN_PLATZHALTER)
                if (merged != null) {
                    val m = LinkedHashMap<String, JsonElement>(merged)
                    m["id"] = JsonPrimitive(key)
                    // Kontenrahmen kontoweise ergänzen wie am Desktop: vorhandene Konten und Anpassungen bleiben, aus der
                    // Datei kommt nur hinzu, was es hier noch nicht gibt.
                    val kr = de.vereinsmanager.core.skr42.Kontenrahmen
                    cleaned[kr.FELD_EIGENE]?.let { neu ->
                        m[kr.FELD_EIGENE] = kr.eigeneAlsJson(kr.ergaenzeEigene(kr.leseEigene(existing?.get(kr.FELD_EIGENE)), kr.leseEigene(neu)))
                    }
                    cleaned[kr.FELD_ANPASSUNGEN]?.let { neu ->
                        m[kr.FELD_ANPASSUNGEN] = kr.anpassungenAlsJson(kr.ergaenzeAnpassungen(kr.leseAnpassungen(existing?.get(kr.FELD_ANPASSUNGEN)), kr.leseAnpassungen(neu)))
                    }
                    store.put(area, key, JsonObject(m))
                }
            } else {
                // Wie am Desktop: Bringt eine ältere Datei den Kontenrahmen nicht mit, bleibt der vorhandene.
                val kr = de.vereinsmanager.core.skr42.Kontenrahmen
                val m = LinkedHashMap<String, JsonElement>(cleaned)
                for (feld in listOf(kr.FELD_EIGENE, kr.FELD_ANPASSUNGEN)) {
                    if (m[feld] == null) existing?.get(feld)?.let { m[feld] = it }
                }
                store.put(area, key, withId(key, JsonObject(m)))
            }
            return
        }
        if (mode == ImportMode.MERGE && existing != null) return
        store.put(area, key, withId(key, fromFile))
    }
}

object BackupExporter {
    private val STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")

    /** Gesamter Bestand als Sicherung (Format 1.2.3, nur die 19 Bereiche). */
    fun export(store: DocumentStore, now: ZonedDateTime = ZonedDateTime.now()): BackupFile {
        val data = linkedMapOf<String, JsonElement>()
        for (area in BackupAreas.LISTS) data[area] = JsonArray(store.all(area))
        for ((area, key) in SingleIds.BY_AREA) {
            val doc = store.get(area, key) ?: continue
            // Die Sitzungsvorlage trägt immer ihre richtige Kennung in der Datei (BACKUP_FORMAT.md, Abschnitt 4).
            data[area] = if (area == "meetingTemplate") withIdFirst(SingleIds.MEETING_TEMPLATE, doc) else doc
        }
        return BackupFile(
            app = BackupFile.APP_NAME,
            version = BackupFile.FORMAT_VERSION,
            exportedAt = now.withZoneSameInstant(ZoneOffset.UTC).format(STAMP),
            data = data,
        )
    }

    private fun withIdFirst(id: String, doc: JsonObject): JsonObject {
        val m = LinkedHashMap<String, JsonElement>(doc)
        m["id"] = JsonPrimitive(id)
        return JsonObject(m)
    }
}
