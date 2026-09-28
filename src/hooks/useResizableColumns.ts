import { useState, useCallback, useRef, RefObject } from 'react';

export type ColumnWidths = Record<string, number>;

/**
 * Verschmilzt gespeicherte Spaltenbreiten mit den Standardbreiten — reine,
 * von React losgelöste Logik, direkt testbar. Nur bekannte Spalten mit
 * einer plausiblen (mindestens minWidth großen) gespeicherten Breite werden
 * übernommen; alles andere (neue Spalten, gelöschte Spalten, beschädigte
 * Werte) fällt auf die Standardbreite zurück.
 */
export function mergeStoredWidths(defaultWidths: ColumnWidths, saved: ColumnWidths, minWidth: number): ColumnWidths {
  const merged: ColumnWidths = { ...defaultWidths };
  Object.keys(defaultWidths).forEach(key => {
    if (typeof saved[key] === 'number' && saved[key] >= minWidth) {
      merged[key] = saved[key];
    }
  });
  return merged;
}

/** Neue Breite während des Ziehens, nie kleiner als minWidth. */
export function computeDragWidth(startWidth: number, deltaX: number, minWidth: number): number {
  return Math.max(minWidth, Math.round(startWidth + deltaX));
}

/** Neue Breite bei der automatischen Anpassung per Doppelklick. */
export function computeAutoFitWidth(maxContentWidth: number, minWidth: number): number {
  return Math.max(minWidth, Math.ceil(maxContentWidth) + 4); // kleiner Puffer gegen Rundungsfehler
}

/**
 * Verwaltet ziehbare Spaltenbreiten für eine Tabelle:
 *
 * - Ziehen am rechten Rand eines Spaltenkopfs verändert die Breite.
 * - Doppelklick auf den Rand passt die Spalte automatisch an den
 *   breitesten sichtbaren Inhalt dieser Spalte an (Kopfzeile und aktuell
 *   angezeigte Zeilen — bei mehrseitigen Tabellen also die aktuelle Seite,
 *   nicht alle Einträge über alle Seiten hinweg, sonst müsste für die
 *   Messung jede Seite erst geladen werden).
 * - Die Breiten werden je Tabelle (storageKey) im Browser gespeichert
 *   (localStorage) und bleiben so nach Neuladen und Neustart erhalten —
 *   aber nur auf diesem Gerät/Browser, nicht in der Cloud.
 *
 * Für die Auto-Anpassung müssen Kopf- und Zellinhalte der betroffenen
 * Spalte im DOM mit `data-col-content="<spaltenschlüssel>"` markiert sein.
 */
export function useResizableColumns(
  storageKey: string,
  defaultWidths: ColumnWidths,
  tableRef: RefObject<HTMLTableElement | null>,
  minWidth = 60
) {
  const [widths, setWidths] = useState<ColumnWidths>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as ColumnWidths;
        return mergeStoredWidths(defaultWidths, saved, minWidth);
      }
    } catch {
      // localStorage kann fehlen oder blockiert sein (z.B. Privatmodus) —
      // dann einfach mit den Standardbreiten starten, ohne Fehlermeldung.
    }
    return defaultWidths;
  });

  const persist = useCallback(
    (next: ColumnWidths) => {
      setWidths(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Speichern fehlgeschlagen (z.B. Speicher voll) — die Anzeige
        // funktioniert trotzdem weiter, nur ohne dauerhaftes Merken.
      }
    },
    [storageKey]
  );

  const dragState = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = { key, startX: e.clientX, startWidth: widths[key] ?? defaultWidths[key] ?? 120 };

      const handleMove = (moveEvent: PointerEvent) => {
        const drag = dragState.current;
        if (!drag) return;
        const delta = moveEvent.clientX - drag.startX;
        const newWidth = computeDragWidth(drag.startWidth, delta, minWidth);
        setWidths(prev => ({ ...prev, [drag.key]: newWidth }));
      };

      const handleUp = () => {
        dragState.current = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        // Erst beim Loslassen dauerhaft speichern, nicht bei jeder Pixel-
        // Bewegung während des Ziehens.
        setWidths(current => {
          try {
            localStorage.setItem(storageKey, JSON.stringify(current));
          } catch {
            // siehe oben
          }
          return current;
        });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp, { once: true });
    },
    [widths, defaultWidths, minWidth, storageKey]
  );

  const autoFit = useCallback(
    (key: string) => {
      const tableEl = tableRef.current;
      if (!tableEl) return;
      const cells = Array.from(tableEl.querySelectorAll<HTMLElement>(`[data-col-content="${key}"]`));
      if (cells.length === 0) return;

      // Die ursprüngliche Messung (scrollWidth direkt an der Zelle, kurz auf
      // "kein Zeilenumbruch" gestellt) hat bei table-layout:fixed nicht
      // zuverlässig funktioniert: Weil das Tabellenlayout die Spaltenbreite
      // fest vorgibt und NICHT vom Inhalt abhängt, hat der Browser die
      // "wahre" Inhaltsbreite bei jedem Doppelklick etwas zu groß gemessen —
      // mit dem Ergebnis, dass sich die Spalte bei jedem weiteren
      // Doppelklick ein Stück weiter verbreitert hat, statt sich einmalig
      // richtig einzupendeln.
      //
      // Stattdessen wird jede Zelle jetzt als unsichtbare, freistehende
      // Kopie AUSSERHALB der Tabelle gemessen — bewusst als eigenständiger
      // Block (nicht mehr als Tabellenzelle), ohne jede Breitenvorgabe. So
      // liefert die Messung immer die tatsächliche, von der Tabelle völlig
      // unabhängige Inhaltsbreite, egal wie oft man doppelklickt. Das
      // sichtbare DOM wird dabei nicht angefasst.
      let max = 0;
      cells.forEach(el => {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.display = 'inline-block';
        clone.style.width = 'auto';
        clone.style.maxWidth = 'none';
        clone.style.minWidth = '0';
        clone.style.whiteSpace = 'nowrap';
        document.body.appendChild(clone);
        const width = clone.getBoundingClientRect().width;
        if (width > max) max = width;
        document.body.removeChild(clone);
      });

      persist({ ...widths, [key]: computeAutoFitWidth(max, minWidth) });
    },
    [widths, persist, minWidth, tableRef]
  );

  return { widths, startResize, autoFit };
}
