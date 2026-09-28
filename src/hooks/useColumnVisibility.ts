import { useCallback, useState } from 'react';

interface StoredVisibility {
  /** Schlüssel der aktuell ausgeblendeten Spalten. */
  hidden: string[];
  /** ALLE Schlüssel, die es zum Zeitpunkt des Speicherns gab — nicht nur die
   *  ausgeblendeten. Nötig, um bei einem künftigen App-Update zwischen "war
   *  schon da, Nutzer hat sie absichtlich eingeblendet gelassen" und "ist
   *  gerade erst neu dazugekommen" zu unterscheiden (siehe unten). */
  known: string[];
}

/**
 * Verwaltet, welche Spalten einer Tabelle ein-/ausgeblendet sind — unabhängig
 * von der Reihenfolge (useColumnOrder) und der Breite (useResizableColumns).
 * Eine ausgeblendete Spalte behält ihren Platz in der gespeicherten
 * Reihenfolge; sie verschwindet nur aus der Anzeige, bis sie über dasselbe
 * Menü wieder eingeblendet wird. Nichts wird dabei gelöscht.
 *
 * Wie bei Reihenfolge und Breite wird der Zustand je Tabelle (storageKey) im
 * Browser gespeichert (localStorage) — dauerhaft auf diesem Gerät/Browser,
 * aber nicht in der Cloud.
 *
 * `defaultHidden` legt fest, welche Spalten beim ALLERERSTEN Aufruf (noch
 * nichts gespeichert) ausgeblendet starten sollen — z.B. neu hinzugekommene
 * Felder, die vorher gar nicht existierten, damit eine bestehende Tabelle
 * nach einem Update nicht plötzlich mit vielen zusätzlichen Spalten
 * überrascht. Kommt bei einem SPÄTEREN Update eine weitere neue Spalte
 * hinzu, obwohl der Nutzer hier schon einmal etwas ein-/ausgeblendet hatte,
 * greift derselbe Vorgabe-Mechanismus erneut — dafür wird beim Speichern
 * immer auch vermerkt, welche Spalten zu diesem Zeitpunkt überhaupt bekannt
 * waren (`known`); eine Spalte, die dort fehlt, ist neu und bekommt ihren
 * Vorgabewert aus `defaultHidden`, statt ungefragt sichtbar zu werden.
 */
export function useColumnVisibility(storageKey: string, allKeys: string[], defaultHidden: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredVisibility>;
        if (Array.isArray(parsed.hidden) && Array.isArray(parsed.known)) {
          const known = new Set(parsed.known);
          const result = new Set(parsed.hidden.filter(k => allKeys.includes(k)));
          for (const key of allKeys) {
            if (!known.has(key) && defaultHidden.includes(key)) {
              result.add(key);
            }
          }
          return result;
        }
      }
    } catch {
      // localStorage kann fehlen oder blockiert sein (z.B. Privatmodus) —
      // dann einfach mit der Vorgabe starten, ohne Fehlermeldung.
    }
    return new Set(defaultHidden);
  });

  const persist = useCallback(
    (next: Set<string>) => {
      setHidden(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ hidden: Array.from(next), known: allKeys }));
      } catch {
        // Speichern fehlgeschlagen — die Anzeige funktioniert trotzdem
        // weiter, nur ohne dauerhaftes Merken.
      }
    },
    [storageKey, allKeys]
  );

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(hidden);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      persist(next);
    },
    [hidden, persist]
  );

  return { hidden, toggle };
}
