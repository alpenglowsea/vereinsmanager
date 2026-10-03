import { describe, it, expect } from 'vitest';

import { schluesselStimmt, pruefeZugriff } from './apiAuth';

const SCHLUESSEL = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('Zugriffsschutz: Schluesselvergleich', () => {
  it('erkennt den richtigen Schluessel', () => {
    expect(schluesselStimmt(SCHLUESSEL, SCHLUESSEL)).toBe(true);
  });

  it('weist einen falschen Schluessel ab', () => {
    expect(schluesselStimmt('a1b2c3d4e5f60718293a4b5c6d7e8f91', SCHLUESSEL)).toBe(false);
  });

  it('weist einen zu kurzen oder zu langen Schluessel ab', () => {
    expect(schluesselStimmt(SCHLUESSEL.slice(0, 10), SCHLUESSEL)).toBe(false);
    expect(schluesselStimmt(SCHLUESSEL + 'x', SCHLUESSEL)).toBe(false);
  });

  it('laesst ohne hinterlegten Schluessel niemanden durch', () => {
    // Sonst oeffnete ein leerer Wert versehentlich alle Tueren.
    expect(schluesselStimmt('', '')).toBe(false);
    expect(schluesselStimmt(undefined, SCHLUESSEL)).toBe(false);
    expect(schluesselStimmt(['array'], SCHLUESSEL)).toBe(false);
  });
});

describe('Zugriffsschutz: Entscheidung ueber einen Aufruf', () => {
  it('laesst den richtigen Zugriffsschluessel durch', async () => {
    const ergebnis = await pruefeZugriff({ zugriffsschluessel: SCHLUESSEL }, SCHLUESSEL);
    expect(ergebnis.erlaubt).toBe(true);
  });

  it('lehnt einen Aufruf ohne Zugriffsschluessel ab und nennt den Grund', async () => {
    const ergebnis = await pruefeZugriff({}, SCHLUESSEL);
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain('Zugriffsschlüssel');
    expect(ergebnis.code).toBe('ZUGRIFF_VERWEIGERT');
  });

  it('lehnt einen falschen Zugriffsschluessel ab', async () => {
    const ergebnis = await pruefeZugriff(
      { zugriffsschluessel: 'a1b2c3d4e5f60718293a4b5c6d7e8f91' },
      SCHLUESSEL
    );
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.code).toBe('ZUGRIFF_VERWEIGERT');
  });
});
