package de.vereinsmanager.core.backup

/**
 * Die Bereiche der Sicherungsdatei. Quelle: BACKUP_FORMAT.md (Abschnitt 3).
 *
 * `onlineApplications` und `applicationSettings` gehören bewusst NICHT mehr dazu
 * (Entscheidung 25.10.2026: werden weder in Android noch am Desktop gebraucht).
 */
object BackupAreas {
    /** Bereiche, die eine Liste von Einträgen mit `id` sind. */
    val LISTS = listOf(
        "members", "transactions", "accounts", "auditLogs", "inventory",
        "memberInventory", "sepaRuns", "documents", "folders", "donations",
        "contacts", "invoices", "meetings", "calendarEvents", "calendarCategories",
    )

    /** Bereiche, die genau ein Objekt sind. */
    val SINGLES = listOf(
        "invoiceTemplate", "meetingTemplate", "dashboardConfig", "settings",
    )

    val ALL: List<String> = LISTS + SINGLES

    /** Schlüssel aus älteren Dateien, die beim Einlesen verworfen werden. */
    val DROPPED = setOf("onlineApplications", "applicationSettings")
}
