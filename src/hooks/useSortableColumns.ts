import { useState, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<Field extends string> {
  field: Field;
  direction: SortDirection;
}

/**
 * Sortier-Zustand für eine Tabelle mit klickbaren Spaltenköpfen — das
 * Verhalten, das in der Mitgliederliste und im Buchungsjournal schon länger
 * existiert (dort aber je Tabelle einzeln nachgebaut war): Klick auf eine
 * neue Spalte sortiert aufsteigend, ein erneuter Klick auf dieselbe Spalte
 * dreht die Richtung um.
 *
 * Diese Datei ist die gemeinsame Grundlage für Kontakte, Rechnungen,
 * Spenden und Inventar. Die Mitgliederliste und das Buchungsjournal haben
 * ihre eigene, schon vorhandene Sortierlogik bewusst NICHT auf diesen Hook
 * umgestellt — im Buchungsjournal etwa sortiert ein Klick auf "Datum" oder
 * "Betrag" beim ersten Mal absteigend (neueste/höchste zuerst), nicht
 * aufsteigend wie hier. Das an dieser Stelle zu vereinheitlichen hätte das
 * bestehende, funktionierende Verhalten leise verändert.
 */
/**
 * Reine Übergangslogik, losgelöst von React testbar: Klick auf die schon
 * aktive Spalte dreht die Richtung um, Klick auf eine andere Spalte
 * wechselt zu ihr und beginnt aufsteigend.
 */
export function nextSortState<Field extends string>(current: SortState<Field>, clickedField: Field): SortState<Field> {
  return current.field === clickedField
    ? { field: clickedField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { field: clickedField, direction: 'asc' };
}

export function useSortableColumns<Field extends string>(initialField: Field, initialDirection: SortDirection = 'asc') {
  const [sort, setSort] = useState<SortState<Field>>({ field: initialField, direction: initialDirection });

  const handleSort = useCallback((field: Field) => {
    setSort(prev => nextSortState(prev, field));
  }, []);

  return { sortBy: sort.field, sortDirection: sort.direction, handleSort };
}
