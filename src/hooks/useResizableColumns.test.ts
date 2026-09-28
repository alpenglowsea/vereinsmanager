import { describe, it, expect } from 'vitest';
import { mergeStoredWidths, computeDragWidth, computeAutoFitWidth } from './useResizableColumns';

describe('mergeStoredWidths', () => {
  const defaults = { name: 200, city: 120, fee: 90 };

  it('übernimmt gespeicherte Breiten für bekannte Spalten', () => {
    const saved = { name: 260, city: 150 };
    expect(mergeStoredWidths(defaults, saved, 60)).toEqual({ name: 260, city: 150, fee: 90 });
  });

  it('ignoriert gespeicherte Spalten, die es im aktuellen Layout nicht mehr gibt', () => {
    const saved = { name: 260, veraltete_spalte: 999 };
    const result = mergeStoredWidths(defaults, saved, 60);
    expect(result).toEqual({ name: 260, city: 120, fee: 90 });
    expect(result).not.toHaveProperty('veraltete_spalte');
  });

  it('fällt bei einer neuen Spalte ohne gespeicherten Wert auf die Standardbreite zurück', () => {
    const saved = { name: 260 };
    expect(mergeStoredWidths(defaults, saved, 60)).toEqual({ name: 260, city: 120, fee: 90 });
  });

  it('verwirft gespeicherte Werte unterhalb der Mindestbreite (beschädigte/unplausible Daten)', () => {
    const saved = { name: 10 };
    expect(mergeStoredWidths(defaults, saved, 60)).toEqual(defaults);
  });
});

describe('computeDragWidth', () => {
  it('addiert die Zeigerbewegung zur Startbreite', () => {
    expect(computeDragWidth(200, 40, 60)).toBe(240);
    expect(computeDragWidth(200, -40, 60)).toBe(160);
  });

  it('rundet auf ganze Pixel', () => {
    expect(computeDragWidth(200, 0.6, 60)).toBe(201);
  });

  it('unterschreitet die Mindestbreite nicht, auch bei starkem Verkleinern', () => {
    expect(computeDragWidth(200, -1000, 60)).toBe(60);
  });
});

describe('computeAutoFitWidth', () => {
  it('rundet den gemessenen Inhalt auf und fügt einen kleinen Puffer hinzu', () => {
    expect(computeAutoFitWidth(150.2, 60)).toBe(155);
  });

  it('unterschreitet die Mindestbreite nicht, auch bei sehr schmalem Inhalt', () => {
    expect(computeAutoFitWidth(10, 60)).toBe(60);
  });
});
