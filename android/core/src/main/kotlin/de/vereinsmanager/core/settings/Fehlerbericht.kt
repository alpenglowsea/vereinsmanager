package de.vereinsmanager.core.settings

/** Ein Fehlerbericht, der per E-Mail verschickt (oder kopiert) wird. Es wird nichts automatisch übertragen. */
object Fehlerbericht {
    const val EMPFAENGER = "vereinsmanager@ik.me"
    const val SPENDEN_URL = "https://liberapay.com/alpenglowsea/"

    val BEREICHE = listOf(
        "Mitglieder", "Finanzen", "Rechnungen", "SEPA-Lastschrift", "Spenden", "Kontakte", "Kalender",
        "Sitzungen", "Inventar", "Dokumente", "Dashboard", "Einstellungen / Sicherung", "Sonstiges",
    )
    val SCHWEREGRADE = listOf("Kleinigkeit", "Stört, geht aber weiter", "Kann nicht weiterarbeiten", "Daten sind falsch oder fehlen")

    data class Eingabe(val bereich: String, val betreff: String, val schwere: String, val beschreibung: String)

    /** Fehlertext, wenn etwas fehlt; sonst null. */
    fun pruefen(e: Eingabe): String? = when {
        e.betreff.isBlank() -> "Bitte eine Betreffzeile angeben."
        e.beschreibung.isBlank() -> "Bitte beschreiben Sie das Problem."
        else -> null
    }

    fun betreff(e: Eingabe) = "[Bugreport Android - ${e.bereich}] ${e.betreff.trim()}"

    /** Der Text der Mail, mit den Systemangaben, die der Absender vor dem Versand sieht. [system] z. B. „App 1.0, Android 15, Pixel 8“. */
    fun text(e: Eingabe, system: String): String = buildString {
        appendLine("Bereich: ${e.bereich}")
        appendLine("Schweregrad: ${e.schwere}")
        appendLine("System: $system")
        appendLine()
        appendLine(e.beschreibung.trim())
    }.trimEnd()

    const val VORLAGE = "1. Was habe ich getan? (Schritt für Schritt):\n- \n\n2. Was ist passiert? (Fehlermeldung oder unerwartetes Verhalten):\n- \n\n3. Was hatte ich erwartet?:\n- "
}
