package de.vereinsmanager.core.settings

import java.time.Duration
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Wann und warum ein Schnappschuss entstanden ist. */
enum class SchnappGrund(val kuerzel: String, val text: String) {
    AUTOMATISCH("auto", "Automatisch"),
    MANUELL("manuell", "Von Hand"),
    VOR_IMPORT("import", "Vor dem Einspielen einer Sicherung"),
    VOR_LOESCHEN("loeschen", "Vor dem Löschen aller Daten"),
    VOR_ARCHIV("archiv", "Vor dem Auslagern ins Jahresarchiv"),
}

data class SchnappEintrag(val name: String, val zeit: LocalDateTime, val grund: SchnappGrund)

/**
 * Die Regeln für Schnappschüsse (vollständige Sicherungen im geschützten App-Ordner, ZIP ohne Passwort):
 * Dateinamen, Aufräumen und wann wieder ein automatischer fällig ist. Das Schreiben und Lesen der Dateien
 * selbst macht die App.
 *
 * Aufgeräumt wird getrennt: von den automatischen bleiben [MAX_AUTOMATISCH], von allen anderen [MAX_ANDERE].
 * So verdrängt eine Woche automatischer Sicherungen nie die Kopie, die vor einem Import oder Löschen angelegt wurde.
 */
object Schnappschuesse {
    const val MAX_AUTOMATISCH = 7
    const val MAX_ANDERE = 5
    const val ABSTAND_STUNDEN = 20L
    private val STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss")
    private val NAME = Regex("""schnappschuss_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_([a-z]+)\.zip""")
    private val ALT = Regex("""vor_import_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.zip""")

    fun dateiname(zeit: ZonedDateTime, grund: SchnappGrund): String = "schnappschuss_${zeit.format(STAMP)}_${grund.kuerzel}.zip"

    fun lesen(name: String): SchnappEintrag? {
        val m = NAME.matchEntire(name) ?: return null
        val grund = SchnappGrund.values().firstOrNull { it.kuerzel == m.groupValues[2] } ?: return null
        val zeit = runCatching { LocalDateTime.parse(m.groupValues[1], STAMP) }.getOrNull() ?: return null
        return SchnappEintrag(name, zeit, grund)
    }

    /** Der neue Name für eine Sicherheitskopie aus früheren Versionen („vor_import_…“), sonst null. */
    fun ausAltemNamen(name: String): String? = ALT.matchEntire(name)?.let { "schnappschuss_${it.groupValues[1]}_import.zip" }

    fun sortiert(namen: List<String>): List<SchnappEintrag> = namen.mapNotNull { lesen(it) }.sortedByDescending { it.zeit }

    /** Die Namen, die nach dem Anlegen eines neuen gelöscht werden sollen (die ältesten über dem Limit). */
    fun ueberzaehlige(namen: List<String>): List<String> {
        val alle = sortiert(namen)
        val auto = alle.filter { it.grund == SchnappGrund.AUTOMATISCH }.drop(MAX_AUTOMATISCH)
        val andere = alle.filter { it.grund != SchnappGrund.AUTOMATISCH }.drop(MAX_ANDERE)
        return (auto + andere).map { it.name }
    }

    /** Ob ein automatischer Schnappschuss fällig ist: noch keiner da, oder der jüngste ist älter als [ABSTAND_STUNDEN]. Ein von Hand angelegter zählt mit. */
    fun faellig(namen: List<String>, jetzt: LocalDateTime): Boolean {
        val juengster = sortiert(namen).firstOrNull { it.grund == SchnappGrund.AUTOMATISCH || it.grund == SchnappGrund.MANUELL } ?: return true
        return Duration.between(juengster.zeit, jetzt).toHours() >= ABSTAND_STUNDEN
    }
}
