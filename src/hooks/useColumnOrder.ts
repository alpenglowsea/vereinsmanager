import { useCallback, useRef, useState } from 'react';

/**
 * Verschmilzt eine gespeicherte Spaltenreihenfolge mit der Standard-
 * reihenfolge — reine, von React losgelöste Logik, direkt testbar.
 *
 * Bekannte Spalten werden in der gespeicherten Reihenfolge übernommen;
 * Spalten, die es nicht mehr gibt (z.B. nach einem Update entfernt), fallen
 * weg; neue Spalten, die es beim letzten Speichern noch nicht gab, werden
 * hinten angehängt, statt zu verschwinden. Doppelte Einträge in den
 * gespeicherten Daten werden nur beim ersten Vorkommen berücksichtigt.
 */
export function mergeStoredOrder(defaultOrder: string[], saved: string[]): string[] {
  const seen = new Set<string>();
  const knownSaved = saved.filter(key => {
    if (!defaultOrder.includes(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const missing = defaultOrder.filter(key => !seen.has(key));
  return [...knownSaved, ...missing];
}

/**
 * Verschiebt `fromKey` an die Stelle von `toKey` — reine, von React
 * losgelöste Logik, direkt testbar.
 *
 * Beim Ziehen nach rechts (fromIndex < toIndex) landet die Spalte direkt
 * HINTER der Zielspalte, beim Ziehen nach links (fromIndex > toIndex) direkt
 * VOR der Zielspalte — die Zielspalte selbst rutscht dafür jeweils eine
 * Stelle in die Gegenrichtung. Das ist keine Ungenauigkeit, sondern das
 * erwartete Verhalten beim "Vorbeischieben" einer Spalte an einer anderen.
 */
export function reorderColumns(order: string[], fromKey: string, toKey: string): string[] {
  if (fromKey === toKey) return order;
  const fromIndex = order.indexOf(fromKey);
  const toIndex = order.indexOf(toKey);
  if (fromIndex === -1 || toIndex === -1) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromKey);
  return next;
}

/**
 * Verwaltet die per Drag & Drop änderbare Reihenfolge der Datenspalten
 * einer Tabelle. Die Auswahl-Kästchen- und die Aktionen-Spalte gehören
 * NICHT zu dieser Reihenfolge — sie bleiben in jeder der sechs Tabellen
 * fest am Anfang bzw. Ende stehen, nur die Datenspalten dazwischen lassen
 * sich verschieben.
 *
 * Bedienung: Der komplette Spaltenkopf (außer dem schmalen Ziehgriff für
 * die Breite ganz rechts) ist per HTML5-Drag&Drop ziehbar. Ein einfacher
 * Klick zum Sortieren löst dabei KEINEN Drag aus (das unterscheidet der
 * Browser selbst anhand der Geste) und wird durch das Ziehen nicht
 * gestört.
 *
 * Wie bei den Spaltenbreiten wird die Reihenfolge je Tabelle (storageKey)
 * im Browser gespeichert (localStorage) — dauerhaft auf diesem Gerät/
 * Browser, aber nicht in der Cloud.
 */
export function useColumnOrder(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        if (Array.isArray(saved)) {
          return mergeStoredOrder(defaultOrder, saved);
        }
      }
    } catch {
      // localStorage kann fehlen oder blockiert sein (z.B. Privatmodus) —
      // dann einfach mit der Standardreihenfolge starten, ohne Fehlermeldung.
    }
    return defaultOrder;
  });

  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Zusätzlich zum State (der nur fürs Aussehen gebraucht wird — abgedunkelte
  // gezogene Spalte, blaue Ziel-Markierung) wird die gezogene Spalte auch in
  // einer Ref gehalten. Grund: handleColDrop braucht beim Loslassen einen
  // synchronen, garantiert aktuellen Lesezugriff auf "welche Spalte wird
  // gerade gezogen", OHNE dafür einen weiteren Zustands-Wechsel (setOrder)
  // aus dem Aktualisierungs-Callback von setDraggedKey heraus anzustoßen —
  // genau das hatte die Umsortierung zuvor unzuverlässig gemacht: React
  // verlangt, dass die Funktion, die man setDraggedKey übergibt, frei von
  // Nebenwirkungen ist (sie darf NUR den neuen Wert berechnen), und ruft sie
  // im Entwicklungsmodus (StrictMode, hier in main.tsx aktiv) zur Kontrolle
  // sogar zweimal auf. Ein verschachtelter setOrder-Aufruf darin wurde
  // dadurch teils zweimal, teils in der falschen Reihenfolge ausgeführt —
  // das Ergebnis war ein Loslassen, das sichtbar gar nichts (oder etwas
  // Falsches) bewirkte.
  const draggedKeyRef = useRef<string | null>(null);

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Speichern fehlgeschlagen — die Anzeige funktioniert trotzdem
        // weiter, nur ohne dauerhaftes Merken.
      }
    },
    [storageKey]
  );

  const handleColDragStart = useCallback(
    (key: string) => (e: React.DragEvent) => {
      draggedKeyRef.current = key;
      setDraggedKey(key);
      e.dataTransfer.effectAllowed = 'move';
      // Manche Browser (Firefox) starten das Ziehen nur, wenn dataTransfer
      // tatsächlich Daten trägt.
      e.dataTransfer.setData('text/plain', key);
    },
    []
  );

  const handleColDragOver = useCallback(
    (key: string) => (e: React.DragEvent) => {
      // Ohne preventDefault() erlaubt der Browser an dieser Stelle keinen
      // drop.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverKey(prev => (prev === key ? prev : key));
    },
    []
  );

  const handleColDrop = useCallback(
    (key: string) => (e: React.DragEvent) => {
      e.preventDefault();
      const fromKey = draggedKeyRef.current;
      if (fromKey && fromKey !== key) {
        persist(reorderColumns(order, fromKey, key));
      }
      draggedKeyRef.current = null;
      setDraggedKey(null);
      setDragOverKey(null);
    },
    [order, persist]
  );

  const handleColDragEnd = useCallback(() => {
    draggedKeyRef.current = null;
    setDraggedKey(null);
    setDragOverKey(null);
  }, []);

  return {
    order,
    draggedKey,
    dragOverKey,
    handleColDragStart,
    handleColDragOver,
    handleColDrop,
    handleColDragEnd,
    // Für Tests bzw. einen expliziten Reset nützlich, im normalen Betrieb
    // nicht gebraucht.
    resetOrder: () => persist(defaultOrder)
  };
}
