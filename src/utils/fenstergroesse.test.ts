import { describe, it, expect } from 'vitest';
import {
  begrenze,
  neueGroesse,
  leseGespeichert,
  schreibeGespeichert,
  mauszeiger,
  MIN_BREITE,
  MIN_HOEHE
} from './fenstergroesse';

describe('Fenstergröße begrenzen', () => {
  it('lässt einen Wunsch, der passt, unverändert', () => {
    expect(begrenze({ breite: 900, hoehe: 700 }, { breite: 1600, hoehe: 1000 })).toEqual({ breite: 900, hoehe: 700 });
  });

  it('macht das Fenster kleiner, wenn das Programmfenster kleiner geworden ist', () => {
    expect(begrenze({ breite: 1400, hoehe: 950 }, { breite: 1000, hoehe: 700 })).toEqual({ breite: 1000, hoehe: 700 });
  });

  it('hält die Mindestgröße, solange Platz dafür ist', () => {
    expect(begrenze({ breite: 50, hoehe: 20 }, { breite: 1600, hoehe: 1000 })).toEqual({ breite: MIN_BREITE, hoehe: MIN_HOEHE });
  });

  it('lässt bei sehr kleinem Programmfenster den Platz gewinnen, nie die Mindestgröße', () => {
    expect(begrenze({ breite: 800, hoehe: 600 }, { breite: 300, hoehe: 200 })).toEqual({ breite: 300, hoehe: 200 });
  });

  it('nimmt eine eigene Mindestgröße des Fensters', () => {
    expect(begrenze({ breite: 400, hoehe: 300 }, { breite: 1600, hoehe: 1000 }, { breite: 600, hoehe: 480 })).toEqual({ breite: 600, hoehe: 480 });
    expect(begrenze({ hoehe: 300 }, { breite: 1600, hoehe: 400 }, { breite: 600, hoehe: 480 })).toEqual({ hoehe: 400 });
  });

  it('lässt fehlende Maße weg (dann gilt die Standardgröße des Fensters)', () => {
    expect(begrenze({ breite: 800 }, { breite: 1600, hoehe: 1000 })).toEqual({ breite: 800 });
    expect(begrenze({}, { breite: 1600, hoehe: 1000 })).toEqual({});
  });

  it('übergeht unsinnige Werte', () => {
    expect(begrenze({ breite: NaN, hoehe: -5 }, { breite: 1600, hoehe: 1000 })).toEqual({});
    expect(begrenze({ breite: Infinity }, { breite: 1600, hoehe: 1000 })).toEqual({});
  });
});

describe('Fenstergröße beim Ziehen', () => {
  const start = { breite: 600, hoehe: 400 };
  const mittig = { x: 2, y: 2 };

  it('rechte Kante: nur die Breite, mittiges Fenster wächst doppelt (die Kante bleibt unter der Maus)', () => {
    expect(neueGroesse(start, 'e', 50, 30, mittig)).toEqual({ breite: 700 });
  });

  it('linke Kante: nach links ziehen macht breiter', () => {
    expect(neueGroesse(start, 'w', -50, 0, mittig)).toEqual({ breite: 700 });
    expect(neueGroesse(start, 'w', -50, 0, { x: 1, y: 1 })).toEqual({ breite: 650 });
  });

  it('obere und untere Kante: nur die Höhe', () => {
    expect(neueGroesse(start, 's', 99, 20, mittig)).toEqual({ hoehe: 440 });
    expect(neueGroesse(start, 'n', 0, 20, mittig)).toEqual({ hoehe: 360 });
  });

  it('Ecke: beides', () => {
    expect(neueGroesse(start, 'se', 10, 10, mittig)).toEqual({ breite: 620, hoehe: 420 });
    expect(neueGroesse(start, 'nw', 10, 10, mittig)).toEqual({ breite: 580, hoehe: 380 });
  });

  it('Mauszeiger je Kante', () => {
    expect(mauszeiger('e')).toBe('ew-resize');
    expect(mauszeiger('n')).toBe('ns-resize');
    expect(mauszeiger('ne')).toBe('nesw-resize');
    expect(mauszeiger('se')).toBe('nwse-resize');
  });
});

describe('Gemerkte Fenstergrößen', () => {
  it('liest gültige Einträge und übergeht kaputte', () => {
    const roh = JSON.stringify({
      buchung: { breite: 900, hoehe: 700 },
      mitglied: { breite: 'breit' },
      rechnung: { hoehe: 812.6 },
      kaputt: null,
      riesig: { breite: 1e9 }
    });
    expect(leseGespeichert(roh)).toEqual({ buchung: { breite: 900, hoehe: 700 }, rechnung: { hoehe: 813 } });
  });

  it('übersteht unlesbaren Inhalt', () => {
    expect(leseGespeichert('{nicht json')).toEqual({});
    expect(leseGespeichert('[1,2]')).toEqual({});
    expect(leseGespeichert(null)).toEqual({});
  });

  it('schreibt, ersetzt und entfernt einzelne Fenster, die anderen bleiben', () => {
    let roh = schreibeGespeichert(null, 'buchung', { breite: 900 });
    roh = schreibeGespeichert(roh, 'mitglied', { breite: 1000, hoehe: 800 });
    roh = schreibeGespeichert(roh, 'buchung', { breite: 950, hoehe: 600 });
    expect(leseGespeichert(roh)).toEqual({ buchung: { breite: 950, hoehe: 600 }, mitglied: { breite: 1000, hoehe: 800 } });
    roh = schreibeGespeichert(roh, 'buchung', null);
    expect(leseGespeichert(roh)).toEqual({ mitglied: { breite: 1000, hoehe: 800 } });
  });
});
