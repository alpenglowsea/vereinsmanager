package de.vereinsmanager.core.settings

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

/**
 * Versionsprüfung: fragt GitHub nach der zuletzt veröffentlichten Version und vergleicht sie mit der installierten.
 *
 * Grundsatz (Johannes, 25.11.2026): Nichts geht nach draußen, ohne dass der Anwender es angetippt hat. Hier stehen nur
 * die Regeln; die Abfrage löst allein der Knopf in der Karte „Version“ aus (Einstellungen → Allgemein).
 *
 * Gleiche Regeln und Texte wie am Desktop (`src/utils/versionspruefung.ts`), mit denselben Prüffällen.
 * Gefragt wird nur nach der neuesten veröffentlichten Version (`/releases/latest`; Entwürfe und Vorabversionen zählen
 * dort nicht).
 */
object Versionspruefung {
    const val REPOSITORY = "alpenglowsea/vereinsmanager"
    const val ABFRAGE_ADRESSE = "https://api.github.com/repos/$REPOSITORY/releases/latest"
    const val VERSIONEN_SEITE = "https://github.com/$REPOSITORY/releases"

    sealed interface Ergebnis
    data class Neuer(val version: String, val seite: String, val datei: String?, val datum: String?) : Ergebnis
    data class Aktuell(val version: String) : Ergebnis
    data object KeineVeroeffentlicht : Ergebnis
    /** status -1: keine Verbindung; 0: Antwort nicht lesbar; sonst HTTP-Status. */
    data class Fehler(val status: Int) : Ergebnis

    private fun teile(v: String): List<Int> =
        v.trim().removePrefix("v").removePrefix("V").split('-', '+').first().split('.').map { it.toIntOrNull() ?: 0 }

    /** > 0, wenn a neuer ist als b; „1.0“ und „1.0.0“ sind gleich. */
    fun vergleichen(a: String, b: String): Int {
        val x = teile(a); val y = teile(b)
        for (i in 0 until maxOf(x.size, y.size)) {
            val d = (x.getOrNull(i) ?: 0) - (y.getOrNull(i) ?: 0)
            if (d != 0) return if (d > 0) 1 else -1
        }
        return 0
    }

    private fun JsonObject.text(feld: String): String? = (this[feld] as? JsonPrimitive)?.contentOrNull

    /**
     * Wertet die Antwort von GitHub aus.
     * @param endungen Dateiendungen der Installationsdatei dieser Fassung, in Vorzugsreihenfolge (Handy: .apk).
     */
    fun auswerten(status: Int, text: String?, installiert: String, endungen: List<String>): Ergebnis {
        if (status == 404) return KeineVeroeffentlicht
        if (status != 200 || text.isNullOrEmpty()) return Fehler(status)
        val daten = try { Json.parseToJsonElement(text).jsonObject } catch (e: Exception) { return Fehler(0) }
        val version = daten.text("tag_name")?.trim()?.removePrefix("v")?.removePrefix("V").orEmpty()
        if (version.isEmpty()) return Fehler(0)
        if (vergleichen(version, installiert) <= 0) return Aktuell(version)
        val namen = (daten["assets"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonObject)?.text("name") }
        val datei = endungen.firstNotNullOfOrNull { e -> namen.firstOrNull { it.lowercase().endsWith(e) } }
        val seite = daten.text("html_url")?.takeIf { it.startsWith("https://github.com/") } ?: VERSIONEN_SEITE
        val datum = daten.text("published_at")?.take(10)
        return Neuer(version, seite, datei, datum)
    }

    private fun deutschesDatum(iso: String): String {
        val t = iso.split('-')
        return if (t.size == 3) "${t[2]}.${t[1]}.${t[0]}" else iso
    }

    /** Die Meldung für den Anwender, am Desktop wortgleich. */
    fun text(e: Ergebnis, installiert: String): String = when (e) {
        is Neuer -> "Version ${e.version} ist erschienen" + (e.datum?.let { " (${deutschesDatum(it)})" } ?: "") + ". Installiert ist $installiert." +
            (if (e.datei != null) " Installationsdatei: ${e.datei}." else " Für diese Fassung liegt der neuen Version keine Installationsdatei bei.")
        is Aktuell ->
            if (vergleichen(installiert, e.version) == 0) "Sie haben die neueste Version ($installiert)."
            else "Installiert ist $installiert, die neueste veröffentlichte Version ist ${e.version}. Ihre Fassung ist neuer."
        KeineVeroeffentlicht -> "Auf GitHub ist noch keine Version veröffentlicht."
        is Fehler -> when (e.status) {
            -1 -> "Keine Verbindung zu GitHub. Ist das Gerät mit dem Internet verbunden?"
            403, 429 -> "GitHub nimmt gerade keine Abfragen an (zu viele in kurzer Zeit). Bitte später noch einmal versuchen."
            0 -> "Die Antwort von GitHub ließ sich nicht lesen."
            else -> "GitHub hat unerwartet geantwortet (Fehler ${e.status})."
        }
    }
}
