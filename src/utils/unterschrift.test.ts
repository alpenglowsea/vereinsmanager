import { describe, it, expect } from 'vitest';
import { leseUnterschrift, unterschriftAusZeichnung, unterschriftImPdf } from './unterschrift';

describe('Unterschrift (D-41)', () => {
  it('liest das Format der Android-Fassung', () => {
    const u = leseUnterschrift({ aspect: 4, strokes: [[[0, 0], [0.5, 1]], [[0.2, 0.2]]] });
    expect(u).toEqual({ aspect: 4, strokes: [[[0, 0], [0.5, 1]]] });
  });

  it('lehnt Unbrauchbares ab', () => {
    expect(leseUnterschrift(undefined)).toBeNull();
    expect(leseUnterschrift({ aspect: 0, strokes: [[[0, 0], [1, 1]]] })).toBeNull();
    expect(leseUnterschrift({ aspect: 3, strokes: [[[0, 0]]] })).toBeNull();
    expect(leseUnterschrift({ aspect: 3, strokes: 'x' })).toBeNull();
  });

  it('macht aus der Zeichnung Werte zwischen 0 und 1, auf vier Stellen', () => {
    const u = unterschriftAusZeichnung([[{ x: 0, y: 0 }, { x: 200, y: 50 }, { x: 410, y: -3 }], [{ x: 5, y: 5 }]], 400, 100);
    expect(u).toEqual({ aspect: 4, strokes: [[[0, 0], [0.5, 0.5], [1, 0]]] });
    expect(unterschriftAusZeichnung([[{ x: 1, y: 1 }]], 400, 100)).toBeNull();
  });

  it('setzt sie höchstens 70 × 11 mm groß auf die Linie', () => {
    // breit: 70 mm begrenzen
    const breit = unterschriftImPdf({ aspect: 10, strokes: [[[0, 0], [1, 1]]] }, 100, 200);
    expect(breit[0][1][0]).toBeCloseTo(170);
    expect(breit[0][0][1]).toBeCloseTo(193);
    expect(breit[0][1][1]).toBeCloseTo(200);
    // hoch: 11 mm begrenzen
    const hoch = unterschriftImPdf({ aspect: 2, strokes: [[[0, 0], [1, 1]]] }, 100, 200);
    expect(hoch[0][1][0]).toBeCloseTo(122);
    expect(hoch[0][0][1]).toBeCloseTo(189);
  });
});
