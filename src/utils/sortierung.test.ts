import { describe, it, expect } from 'vitest';
import { vergleicheNummern, vergleicheDatumDannNummer, vergleicheNummerDannDatum } from './sortierung';

describe('vergleicheNummern', () => {
  it('vergleicht Zahlen in der Nummer als Zahlen', () => {
    expect(vergleicheNummern('RE-2026-9', 'RE-2026-10')).toBeLessThan(0);
    expect(vergleicheNummern('ZB-2026-010', 'ZB-2026-009')).toBeGreaterThan(0);
    expect(vergleicheNummern('INV-FB-002', 'INV-FB-002')).toBe(0);
  });

  it('stellt leere Nummern ans Ende', () => {
    expect(vergleicheNummern('', 'RE-2026-001')).toBeGreaterThan(0);
    expect(vergleicheNummern('RE-2026-001', undefined)).toBeLessThan(0);
    expect(vergleicheNummern(null, '')).toBe(0);
  });
});

describe('Sortierung nach Datum, dann Nummer', () => {
  const belege = [
    { datum: '2026-03-02', nummer: 'ZB-2026-012' },
    { datum: '2026-03-01', nummer: 'ZB-2026-010' },
    { datum: '2026-03-02', nummer: 'ZB-2026-011' },
    { datum: '2026-02-28', nummer: 'ZB-2026-013' }
  ];

  it('ordnet Belege desselben Tages nach ihrer Nummer', () => {
    const aufsteigend = [...belege].sort(vergleicheDatumDannNummer).map(b => b.nummer);
    expect(aufsteigend).toEqual(['ZB-2026-013', 'ZB-2026-010', 'ZB-2026-011', 'ZB-2026-012']);
    // absteigend (neueste zuerst) kehrt beides um
    const absteigend = [...belege].sort((a, b) => -vergleicheDatumDannNummer(a, b)).map(b => b.nummer);
    expect(absteigend).toEqual(['ZB-2026-012', 'ZB-2026-011', 'ZB-2026-010', 'ZB-2026-013']);
  });

  it('sortiert nach Nummer unabhängig vom Datum', () => {
    expect([...belege].sort(vergleicheNummerDannDatum).map(b => b.nummer)).toEqual([
      'ZB-2026-010',
      'ZB-2026-011',
      'ZB-2026-012',
      'ZB-2026-013'
    ]);
  });

  it('kommt mit fehlenden oder ungültigen Daten zurecht', () => {
    const liste = [
      { datum: 'kein Datum', nummer: 'B' },
      { datum: undefined, nummer: 'A' },
      { datum: '2026-01-01', nummer: 'C' }
    ];
    expect([...liste].sort(vergleicheDatumDannNummer).map(b => b.nummer)).toEqual(['A', 'B', 'C']);
  });
});
