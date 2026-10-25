package de.vereinsmanager.core.backup

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.Json

/** Zusammenführen beim "Nur Fehlendes ergänzen" (Kotlin-Fassung von backupContents.ts). */
object BackupMerge {

    /** Die Mustertexte eines frisch eingerichteten Geräts (DEFAULT_SETTINGS der Desktop-Fassung). */
    val STAMMDATEN_PLATZHALTER: JsonObject by lazy {
        val text = BackupMerge::class.java.getResourceAsStream("/backup/default_settings.json")!!
            .readBytes().toString(Charsets.UTF_8)
        Json.parseToJsonElement(text) as JsonObject
    }

    /** Felder, die früher in den Stammdaten standen (SMTP-Zugang, KI-Schlüssel) und nie wieder geschrieben werden. */
    val VERALTETE_FELDER = listOf(
        "smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPassword", "smtpFromEmail", "smtpFromName",
        "geminiApiKey", "aiApiKey", "aiProvider", "aiModel", "aiBaseUrl",
    )

    fun ohneVeralteteFelder(settings: JsonObject): JsonObject =
        JsonObject(settings.filterKeys { it !in VERALTETE_FELDER })

    private fun istLeer(w: JsonElement?): Boolean = when (w) {
        null, is JsonNull -> true
        is JsonPrimitive -> w.isString && w.content.trim().isEmpty()
        is JsonArray -> w.isEmpty()
        else -> false
    }

    /**
     * Stammdaten beim Ergänzen feldweise: Ein selbst eingetragener Wert bleibt, ein leeres Feld oder ein
     * unberührter Mustertext wird durch den Wert aus der Datei ersetzt, sofern die Datei einen hat.
     */
    fun ergaenzeStammdaten(ausDatei: JsonObject?, vorhanden: JsonObject?, platzhalter: JsonObject): JsonObject? {
        if (ausDatei == null) return vorhanden
        if (vorhanden == null) return ausDatei
        val ergebnis = LinkedHashMap<String, JsonElement>(vorhanden)
        for ((schluessel, neu) in ausDatei) {
            if (schluessel == "id") continue
            if (istLeer(neu)) continue
            val alt = ergebnis[schluessel]
            if (istLeer(alt) || alt == platzhalter[schluessel]) ergebnis[schluessel] = neu
        }
        // Ältere Dateien kennen nur chairman/treasurer statt einer Vorstandsliste: Liegt hier noch die
        // Muster-Liste und bringt die Datei keine eigene mit, soll der Mustervorstand verschwinden.
        if (istLeer(ausDatei["boardMembers"]) && ergebnis["boardMembers"] == platzhalter["boardMembers"]) {
            ergebnis.remove("boardMembers")
        }
        return JsonObject(ergebnis)
    }

    @Suppress("unused")
    internal fun text(e: JsonElement?): String? = (e as? JsonPrimitive)?.contentOrNull
}
