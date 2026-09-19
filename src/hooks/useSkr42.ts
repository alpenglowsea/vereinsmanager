import { useSyncExternalStore } from 'react';
import { Skr42MainCategory } from '../types';
import { subscribeSkr42, getSkr42Snapshot } from '../data/skr42Store';

/**
 * Gibt den aktuellen SKR-42-Kontenrahmen zurück und sorgt dafür, dass die
 * Maske neu zeichnet, sobald der Kassenwart ein eigenes Konto anlegt.
 *
 * Das Ergebnis gehört in die Abhängigkeitsliste jedes useMemo, das daraus
 * etwas berechnet — und wird dort dann auch wirklich benutzt. Genau das ist
 * der Unterschied zum früheren Zähler: Die Abhängigkeit ist jetzt im Code
 * sichtbar, statt nur im Kopf desjenigen zu existieren, der sie geschrieben
 * hat.
 *
 * Der dritte Parameter ist derselbe wie der zweite. React verlangt ihn für
 * den Fall, dass eine Seite auf dem Server vorgerendert wird. Das tut der
 * VereinsManager nicht — aber ohne den Parameter bricht React dort mit
 * einer Fehlermeldung ab, die schwer zuzuordnen wäre.
 */
export function useSkr42(): readonly Skr42MainCategory[] {
  return useSyncExternalStore(subscribeSkr42, getSkr42Snapshot, getSkr42Snapshot);
}
