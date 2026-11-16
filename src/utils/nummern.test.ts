import { describe, it, expect } from 'vitest';
import {
  naechsteJahresNummer,
  naechsteKontaktNummer,
  naechsteNummerImSchema,
  nummerVergeben,
  naechsteTopNummer,
  nummeriereTopsNeu
} from './nummern';

describe('naechsteJahresNummer (BE-, RE-, ZB-, BK-)', () => {
  it('beginnt bei 001', () => {
    expect(naechsteJahresNummer('BE', [], 2026)).toBe('BE-2026-001');
  });

  it('vergibt nach dem Löschen keine Nummer doppelt', () => {
    // BE-002 wurde gelöscht. „Anzahl + 1“ ergäbe wieder BE-2026-003.
    expect(naechsteJahresNummer('BE', ['BE-2026-001', 'BE-2026-003'], 2026)).toBe('BE-2026-004');
  });

  it('zählt je Jahr', () => {
    const nummern = ['RE-2025-040', 'RE-2026-002'];
    expect(naechsteJahresNummer('RE', nummern, 2026)).toBe('RE-2026-003');
    expect(naechsteJahresNummer('RE', nummern, 2025)).toBe('RE-2025-041');
    expect(naechsteJahresNummer('RE', nummern, 2027)).toBe('RE-2027-001');
  });

  it('zählt je Präfix', () => {
    const nummern = ['BE-2026-009', 'BK-2026-120', 'SEPA-2026-11-M-0001'];
    expect(naechsteJahresNummer('BE', nummern, 2026)).toBe('BE-2026-010');
    expect(naechsteJahresNummer('BK', nummern, 2026)).toBe('BK-2026-121');
    expect(naechsteJahresNummer('ZB', nummern, 2026)).toBe('ZB-2026-001');
  });

  it('übergeht von Hand vergebene und leere Nummern', () => {
    expect(naechsteJahresNummer('BE', ['Quittung 7', '', null, undefined, ' BE-2026-005 ', 'BE-2026-5a'], 2026)).toBe(
      'BE-2026-006'
    );
  });

  it('wächst über drei Stellen hinaus', () => {
    expect(naechsteJahresNummer('BE', ['BE-2026-999'], 2026)).toBe('BE-2026-1000');
  });
});

describe('naechsteKontaktNummer', () => {
  it('beginnt bei K-1001', () => {
    expect(naechsteKontaktNummer([])).toBe('K-1001');
    expect(naechsteKontaktNummer(['', null, 'ohne Zahl'])).toBe('K-1001');
  });

  it('nimmt die höchste Zahl plus eins, nicht die Anzahl', () => {
    expect(naechsteKontaktNummer(['K-1001', 'K-1005'])).toBe('K-1006');
  });

  it('vergibt mehrere Nummern nacheinander ohne Dopplung (Import)', () => {
    const nummern = ['K-1001', 'K-1003'];
    const neu: string[] = [];
    for (let i = 0; i < 3; i++) {
      const n = naechsteKontaktNummer([...nummern, ...neu]);
      neu.push(n);
    }
    expect(neu).toEqual(['K-1004', 'K-1005', 'K-1006']);
  });
});

describe('naechsteNummerImSchema (Mitglieder, Inventar)', () => {
  it('gibt ohne Bestand die erste Nummer zurück', () => {
    expect(naechsteNummerImSchema([], 'INV-001')).toBe('INV-001');
    expect(naechsteNummerImSchema(['', null], 'M-0101')).toBe('M-0101');
  });

  it('zählt die höchste Nummer weiter und behält die Stellenzahl', () => {
    expect(naechsteNummerImSchema(['M-0101', 'M-0102', 'M-0107'], 'M-0101')).toBe('M-0108');
    expect(naechsteNummerImSchema(['INV-001', 'INV-002'], 'INV-001')).toBe('INV-003');
  });

  it('folgt dem Schema, das der Verein benutzt', () => {
    expect(naechsteNummerImSchema(['INV-FB-001', 'INV-FB-002', 'INV-TT-009'], 'INV-001')).toBe('INV-FB-003');
  });

  it('vergibt nach dem Löschen keine Nummer doppelt', () => {
    // M-0102 gelöscht: zwei Mitglieder, höchste Nummer 0103
    expect(naechsteNummerImSchema(['M-0101', 'M-0103'], 'M-0101')).toBe('M-0104');
  });

  it('überspringt einen Vorschlag, der in anderer Schreibweise schon vergeben ist', () => {
    expect(naechsteNummerImSchema(['INV-009', 'inv-010', 'INV-9'], 'INV-001')).toBe('INV-011');
  });

  it('kommt mit sehr langen Nummern zurecht', () => {
    expect(naechsteNummerImSchema(['A-99999999999999999999'], 'A-1')).toBe('A-100000000000000000000');
  });
});

describe('nummerVergeben', () => {
  const bestand = [
    { id: 'a', nummer: 'M-0101' },
    { id: 'b', nummer: ' m-0102 ' },
    { id: 'c', nummer: undefined }
  ];

  it('erkennt eine vergebene Nummer ohne Rücksicht auf Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(nummerVergeben('M-0101', bestand)).toBe(true);
    expect(nummerVergeben('M-0102', bestand)).toBe(true);
    expect(nummerVergeben(' m-0101 ', bestand)).toBe(true);
  });

  it('lässt den bearbeiteten Eintrag seine eigene Nummer behalten', () => {
    expect(nummerVergeben('M-0101', bestand, 'a')).toBe(false);
    expect(nummerVergeben('M-0102', bestand, 'a')).toBe(true);
  });

  it('meldet freie und leere Nummern nicht', () => {
    expect(nummerVergeben('M-0199', bestand)).toBe(false);
    expect(nummerVergeben('', bestand)).toBe(false);
    expect(nummerVergeben(undefined, bestand)).toBe(false);
  });
});

describe('Tagesordnungspunkte', () => {
  it('vergibt nach dem Löschen keine TOP-Nummer doppelt', () => {
    // TOP 2 gelöscht, ohne neu durchzuzählen: „Anzahl + 1“ ergäbe wieder TOP 3.
    expect(naechsteTopNummer(['TOP 1', 'TOP 3'])).toBe('TOP 4');
    expect(naechsteTopNummer([])).toBe('TOP 1');
    expect(naechsteTopNummer(['TOP 1', 'TOP 2a'])).toBe('TOP 3');
    expect(naechsteTopNummer(['Begrüßung', 'Berichte'])).toBe('TOP 3');
  });

  it('zählt nach dem Entfernen lückenlos durch und führt die Beschlüsse mit', () => {
    const agenda = [
      { id: '1', number: 'TOP 1', resolutions: [{ id: 'r1', agendaItemNumber: 'TOP 1' }] },
      { id: '3', number: 'TOP 3', resolutions: [{ id: 'r3', agendaItemNumber: 'TOP 3' }] },
      { id: '4', number: 'TOP 4' }
    ];
    const neu = nummeriereTopsNeu(agenda);
    expect(neu.map(t => t.number)).toEqual(['TOP 1', 'TOP 2', 'TOP 3']);
    expect(neu[1].resolutions?.[0].agendaItemNumber).toBe('TOP 2');
    expect(neu[1].resolutions?.[0].id).toBe('r3');
    // unveränderte Punkte bleiben dieselben Objekte, das Original bleibt unberührt
    expect(neu[0]).toBe(agenda[0]);
    expect(agenda[1].number).toBe('TOP 3');
  });

  it('lässt eigene Bezeichnungen in Ruhe', () => {
    const agenda = [{ number: 'TOP 1' }, { number: 'TOP 3a' }, { number: 'TOP 4' }];
    expect(nummeriereTopsNeu(agenda)).toBe(agenda);
  });
});
