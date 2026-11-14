package de.vereinsmanager.core.settings

import de.vereinsmanager.core.backup.BackupAreas
import de.vereinsmanager.core.files.FileStore
import de.vereinsmanager.core.store.DocumentStore

/** Löscht den gesamten Bestand des Vereins (alle Bereiche der Sicherung und alle abgelegten Dateien). */
object Zuruecksetzen {
    /** Das Wort, das man zur Bestätigung eintippen muss. */
    const val BESTAETIGUNG = "LÖSCHEN"

    fun bestaetigt(eingabe: String) = eingabe.trim().equals(BESTAETIGUNG, ignoreCase = true)

    /** Alles oder nichts für die Datenbank; die Dateien werden danach entfernt. */
    fun alles(store: DocumentStore, files: FileStore) {
        store.transaction { BackupAreas.ALL.forEach { store.clear(it) } }
        files.clear()
    }
}
