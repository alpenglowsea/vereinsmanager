import { describe, it, expect } from 'vitest';
import { mergeStoredOrder, reorderColumns } from './useColumnOrder';

describe('mergeStoredOrder', () => {
  const defaults = ['name', 'city', 'fee', 'status'];

  it('übernimmt eine vollständige gespeicherte Reihenfolge unverändert', () => {
    const saved = ['status', 'name', 'fee', 'city'];
    expect(mergeStoredOrder(defaults, saved)).toEqual(['status', 'name', 'fee', 'city']);
  });

  it('hängt neue Spalten, die beim letzten Speichern noch nicht existierten, hinten an', () => {
    const saved = ['city', 'name'];
    expect(mergeStoredOrder(defaults, saved)).toEqual(['city', 'name', 'fee', 'status']);
  });

  it('lässt Spalten weg, die es nicht mehr gibt', () => {
    const saved = ['veraltete_spalte', 'city', 'name', 'fee', 'status'];
    expect(mergeStoredOrder(defaults, saved)).toEqual(['city', 'name', 'fee', 'status']);
  });

  it('berücksichtigt doppelte Einträge nur beim ersten Vorkommen', () => {
    const saved = ['name', 'name', 'city'];
    expect(mergeStoredOrder(defaults, saved)).toEqual(['name', 'city', 'fee', 'status']);
  });

  it('fällt bei leeren gespeicherten Daten auf die Standardreihenfolge zurück', () => {
    expect(mergeStoredOrder(defaults, [])).toEqual(defaults);
  });

  it('setzt eine neue Spalte vor die angegebene Spalte, statt sie hinten anzuhängen', () => {
    // gespeichert, als es die Spalte "nr" noch nicht gab
    const mitNr = ['nr', 'date', 'name', 'amount'];
    expect(mergeStoredOrder(mitNr, ['name', 'date', 'amount'], { nr: 'date' })).toEqual(['name', 'nr', 'date', 'amount']);
    // ist die Ankerspalte nicht gespeichert, landet die neue Spalte hinten
    expect(mergeStoredOrder(mitNr, ['name', 'amount'], { nr: 'date' })).toEqual(['name', 'amount', 'nr', 'date']);
    // eine schon gespeicherte Spalte wird nicht verschoben
    expect(mergeStoredOrder(mitNr, ['date', 'nr', 'name', 'amount'], { nr: 'date' })).toEqual(['date', 'nr', 'name', 'amount']);
  });
});

describe('reorderColumns', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('verschiebt eine Spalte beim Ziehen nach rechts direkt hinter die Zielspalte', () => {
    // "a" auf "c" ziehen: "a" landet direkt hinter "c", "c" selbst rutscht
    // dafür eine Stelle nach vorn.
    expect(reorderColumns(order, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('verschiebt eine Spalte beim Ziehen nach links direkt vor die Zielspalte', () => {
    expect(reorderColumns(order, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('vertauscht zwei benachbarte Spalten beim Ziehen nach rechts', () => {
    expect(reorderColumns(order, 'b', 'c')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('tut nichts, wenn Quelle und Ziel gleich sind', () => {
    expect(reorderColumns(order, 'b', 'b')).toEqual(order);
  });

  it('tut nichts, wenn eine der beiden Spalten unbekannt ist', () => {
    expect(reorderColumns(order, 'x', 'b')).toEqual(order);
    expect(reorderColumns(order, 'a', 'x')).toEqual(order);
  });
});
