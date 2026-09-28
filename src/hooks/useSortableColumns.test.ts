import { describe, it, expect } from 'vitest';
import { nextSortState, SortState } from './useSortableColumns';

describe('nextSortState', () => {
  it('dreht die Richtung um, wenn dieselbe Spalte erneut angeklickt wird', () => {
    const current: SortState<'name'> = { field: 'name', direction: 'asc' };
    expect(nextSortState(current, 'name')).toEqual({ field: 'name', direction: 'desc' });
  });

  it('dreht bei nochmaligem Klick wieder zurück auf aufsteigend', () => {
    const current: SortState<'name'> = { field: 'name', direction: 'desc' };
    expect(nextSortState(current, 'name')).toEqual({ field: 'name', direction: 'asc' });
  });

  it('wechselt bei einer anderen Spalte zu ihr und beginnt aufsteigend', () => {
    const current: SortState<'name' | 'city'> = { field: 'name', direction: 'desc' };
    expect(nextSortState(current, 'city')).toEqual({ field: 'city', direction: 'asc' });
  });
});
