import { describe, it, expect } from 'vitest';
import { ermittleSeitenStatus, wechsleSeite, waehleAlleGefilterten } from './tableSelection';

const zeilen = (von: number, bis: number) =>
  Array.from({ length: bis - von + 1 }, (_, i) => ({ id: `e${von + i}` }));

const alle = zeilen(1, 60);
const seite1 = zeilen(1, 25);
const seite2 = zeilen(26, 50);

describe('Auswahl über mehrere Seiten', () => {
  it('Kopfkästchen wählt nur die aktuelle Seite', () => {
    const auswahl = wechsleSeite(new Set(), seite1);
    expect(auswahl.size).toBe(25);
    expect(auswahl.has('e26')).toBe(false);
  });

  it('Auswahl von Seite 1 bleibt erhalten, wenn Seite 2 dazukommt', () => {
    let auswahl = wechsleSeite(new Set(), seite1);
    auswahl = wechsleSeite(auswahl, seite2);
    expect(auswahl.size).toBe(50);
    expect(auswahl.has('e1')).toBe(true);
    expect(auswahl.has('e50')).toBe(true);
  });

  it('erneuter Klick wählt nur die aktuelle Seite wieder ab', () => {
    let auswahl = wechsleSeite(new Set(), seite1);
    auswahl = wechsleSeite(auswahl, seite2);
    auswahl = wechsleSeite(auswahl, seite2);
    expect(auswahl.size).toBe(25);
    expect(auswahl.has('e1')).toBe(true);
    expect(auswahl.has('e26')).toBe(false);
  });

  it('teilweise ausgewählte Seite wird beim Klick vervollständigt', () => {
    const auswahl = wechsleSeite(new Set(['e3']), seite1);
    expect(auswahl.size).toBe(25);
  });

  it('Knopf „Alle auswählen" nimmt alle Gefilterten, auch auf anderen Seiten', () => {
    const auswahl = waehleAlleGefilterten(wechsleSeite(new Set(), seite1), alle);
    expect(auswahl.size).toBe(60);
  });

  it('Status: komplett / teilweise / alles', () => {
    expect(ermittleSeitenStatus(new Set(), seite1, alle)).toEqual({
      seiteKomplett: false, seiteTeilweise: false, allesKomplett: false,
    });
    expect(ermittleSeitenStatus(new Set(['e1']), seite1, alle).seiteTeilweise).toBe(true);
    const s = ermittleSeitenStatus(wechsleSeite(new Set(), seite1), seite1, alle);
    expect(s.seiteKomplett).toBe(true);
    expect(s.allesKomplett).toBe(false);
    expect(ermittleSeitenStatus(waehleAlleGefilterten(new Set(), alle), seite1, alle).allesKomplett).toBe(true);
  });

  it('leere Tabelle: nichts ist „komplett"', () => {
    expect(ermittleSeitenStatus(new Set(), [], [])).toEqual({
      seiteKomplett: false, seiteTeilweise: false, allesKomplett: false,
    });
    expect(wechsleSeite(new Set(), []).size).toBe(0);
  });
});
