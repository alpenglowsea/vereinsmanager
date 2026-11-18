import { describe, it, expect } from 'vitest';
import {
  istAusgabe,
  wgbGrenze,
  grenzStand,
  berechneEuer,
  journalSummen,
  buchungsCsvZeilen,
  BUCHUNGS_CSV_SPALTEN,
  WGB_GRENZE_BIS_2025,
  WGB_GRENZE_AB_2026
} from './buchungsBerichte';
import type { FinancialAccount, Transaction } from '../types';

const buchung = (o: Partial<Transaction>): Transaction =>
  ({
    id: 't',
    date: '2026-03-01',
    amount: 100,
    type: 'income',
    accountId: 'bank',
    documentNumber: 'BE-2026-001',
    bookingText: 'Text',
    partner: 'Partner',
    sphere: 'ideell',
    mainCategory: '40000 - Mitgliedsbeiträge & Aufnahmegebühren',
    subCategory: '40000 - Echte Mitgliedsbeiträge (laufend)',
    category: '40000 - Echte Mitgliedsbeiträge (laufend)',
    skrAccount: '40000',
    vatRate: 0,
    ...o
  }) as Transaction;

const konten = [{ id: 'bank', name: 'Girokonto' }, { id: 'kasse', name: 'Barkasse' }] as FinancialAccount[];

describe('Grundregeln', () => {
  it('erkennt Ausgaben an der Art oder am Vorzeichen, Umbuchungen nie', () => {
    expect(istAusgabe({ type: 'expense', amount: 10 })).toBe(true);
    expect(istAusgabe({ type: 'income', amount: -10 })).toBe(true);
    expect(istAusgabe({ type: 'income', amount: 10 })).toBe(false);
    expect(istAusgabe({ type: 'transfer', amount: -10 })).toBe(false);
  });
});

describe('Besteuerungsgrenze § 64 Abs. 3 AO', () => {
  it('gilt je Kalenderjahr: bis 2025 45.000 €, ab 2026 50.000 €', () => {
    expect(wgbGrenze('2025')).toBe(WGB_GRENZE_BIS_2025);
    expect(wgbGrenze(2026)).toBe(WGB_GRENZE_AB_2026);
    expect(wgbGrenze('2031')).toBe(50000);
    expect(wgbGrenze('2019')).toBe(45000);
  });

  it('nimmt bei unlesbarem Jahr das laufende', () => {
    expect(wgbGrenze('all', new Date('2025-06-01'))).toBe(45000);
    expect(wgbGrenze(null, new Date('2026-06-01'))).toBe(50000);
  });

  it('ist bei genau dem Grenzbetrag noch nicht überschritten', () => {
    expect(grenzStand(50000, 50000).ueberschritten).toBe(false);
    expect(grenzStand(50000.01, 50000).ueberschritten).toBe(true);
    expect(grenzStand(45000, 45000).ueberschritten).toBe(false);
  });

  it('warnt ab 75 % bis einschließlich der Grenze', () => {
    expect(grenzStand(37499.99, 50000).warnung).toBe(false);
    expect(grenzStand(37500, 50000).warnung).toBe(true);
    expect(grenzStand(50000, 50000).warnung).toBe(true);
    expect(grenzStand(50000.01, 50000).warnung).toBe(false);
  });

  it('rechnet Puffer und Prozent', () => {
    const s = grenzStand(12500.5, 50000);
    expect(s.puffer).toBe(37499.5);
    expect(s.prozent.toFixed(3)).toBe('25.001');
    expect(grenzStand(60000, 50000).puffer).toBe(0);
  });
});

describe('Einnahmen-Überschuss-Rechnung', () => {
  it('lässt Umbuchungen und andere Jahre weg', () => {
    const e = berechneEuer(
      [
        buchung({ id: 'a', amount: 100 }),
        buchung({ id: 'b', type: 'transfer', amount: 500, targetAccountId: 'kasse' }),
        buchung({ id: 'c', date: '2025-12-31', amount: 70 })
      ],
      '2026'
    );
    expect(e.income).toBe(100);
    expect(e.spheres.ideell.txCount).toBe(1);
  });

  it('zählt aufgeteilte Buchungen Teil für Teil mit eigener Sphäre und eigenem Konto (wie die EÜR-Seite)', () => {
    const geteilt = buchung({
      id: 's',
      type: 'expense',
      amount: -100,
      sphere: 'ideell',
      isSplit: true,
      splits: [
        { id: '1', amount: 60, sphere: 'ideell', mainCategory: '68000 - Verwaltung', subCategory: '68500 - Bankgebühren & Zahlungsverkehr', skrAccount: '68500', category: '', vatRate: 0 },
        { id: '2', amount: 40, sphere: 'wirtschaftlich', mainCategory: '69000 - Wirtschaftlicher Betrieb', subCategory: '69100 - Wareneinkauf', skrAccount: '69100', category: '', vatRate: 19 }
      ]
    });
    const e = berechneEuer([geteilt], '2026');
    expect(e.spheres.ideell.expense).toBe(60);
    expect(e.spheres.wirtschaftlich.expense).toBe(40);
    expect(e.expense).toBe(100);
    const kreis = e.spheres.wirtschaftlich.mainCategories['69000 - Wirtschaftlicher Betrieb'];
    expect(kreis.code).toBe('69000');
    expect(kreis.subCategories['69100 - Wareneinkauf'].skrCode).toBe('69100');
  });

  it('ordnet eine unbekannte Sphäre dem ideellen Bereich zu', () => {
    const e = berechneEuer([buchung({ sphere: '' as never })], null);
    expect(e.spheres.ideell.income).toBe(100);
  });

  it('summiert ohne Gleitkomma-Reste', () => {
    const viele = Array.from({ length: 30 }, (_, i) => buchung({ id: `x${i}`, amount: i % 2 ? 0.1 : 0.2 }));
    expect(berechneEuer(viele, '2026').income).toBe(4.5);
  });

  it('nennt die Grenze nur bei einem einzelnen Jahr', () => {
    const wgb = buchung({ sphere: 'wirtschaftlich', amount: 50000 });
    expect(berechneEuer([wgb], '2026').grenze).toEqual(
      expect_grenze({ einnahmen: 50000, grenze: 50000, ueberschritten: false })
    );
    expect(berechneEuer([wgb], null).grenze).toBeNull();
    expect(berechneEuer([{ ...wgb, date: '2025-05-05' }], '2025').grenze?.ueberschritten).toBe(true);
  });

  it('sortiert Nummernkreise und Konten nach Nummer', () => {
    const e = berechneEuer(
      [
        buchung({ id: '1', mainCategory: '44000 - B', subCategory: '44100 - y', skrAccount: '44100' }),
        buchung({ id: '2', mainCategory: '40000 - A', subCategory: '40200 - x', skrAccount: '40200' }),
        buchung({ id: '3', mainCategory: '40000 - A', subCategory: '40100 - w', skrAccount: '40100' })
      ],
      null
    );
    expect(Object.keys(e.spheres.ideell.mainCategories)).toEqual(['40000 - A', '44000 - B']);
    expect(Object.keys(e.spheres.ideell.mainCategories['40000 - A'].subCategories)).toEqual(['40100 - w', '40200 - x']);
  });
});

describe('Buchungsjournal', () => {
  it('rechnet Umbuchungen nicht mit und weist Einnahmen, Ausgaben und Saldo getrennt aus', () => {
    const s = journalSummen([
      buchung({ amount: 100 }),
      buchung({ type: 'expense', amount: -30.5 }),
      buchung({ type: 'transfer', amount: 1000, targetAccountId: 'kasse' })
    ]);
    expect(s).toEqual({ einnahmen: 100, ausgaben: 30.5, saldo: 69.5, umbuchungen: 1 });
  });
});

describe('Buchungs-CSV', () => {
  it('hat die Spalten der Android-Fassung', () => {
    const [zeile] = buchungsCsvZeilen([buchung({})], konten);
    expect(Object.keys(zeile)).toEqual(expect_spalten());
    expect(zeile['SKR-Konto']).toBe('40000');
    expect(zeile.Konto).toBe('Girokonto');
    expect(zeile.Teil).toBe('');
  });

  it('schreibt eine Zeile je Teil einer aufgeteilten Buchung, mit Vorzeichen der Buchung', () => {
    const geteilt = buchung({
      type: 'expense',
      amount: -100,
      department: 'Gesamtverein',
      isSplit: true,
      splits: [
        { id: '1', amount: 60, sphere: 'ideell', skrAccount: '68500', subCategory: '68500 - Bank', category: '', vatRate: 0, department: 'Fußball' },
        { id: '2', amount: 40, sphere: 'wirtschaftlich', skrAccount: '69100', subCategory: '69100 - Ware', category: '', vatRate: 19 }
      ]
    });
    const zeilen = buchungsCsvZeilen([geteilt], konten);
    expect(zeilen.map(z => [z.Teil, z['Betrag (EUR)'], z['SKR-Konto'], z.Sparte, z['USt-Satz (%)']])).toEqual([
      ['1/2', '-60.00', '68500', 'Fußball', '0'],
      ['2/2', '-40.00', '69100', 'Gesamtverein', '19']
    ]);
    // Summe der Teile = Buchungsbetrag
    const summe = zeilen.reduce((s, z) => s + Number(z['Betrag (EUR)']), 0);
    expect(summe).toBe(-100);
  });

  it('nennt bei Umbuchungen das Zielkonto', () => {
    const [z] = buchungsCsvZeilen([buchung({ type: 'transfer', amount: 200, targetAccountId: 'kasse' })], konten);
    expect([z.Typ, z.Konto, z.Zielkonto, z['Betrag (EUR)']]).toEqual(['Umbuchung', 'Girokonto', 'Barkasse', '200.00']);
  });
});

function expect_spalten(): string[] {
  return [...BUCHUNGS_CSV_SPALTEN];
}

function expect_grenze(teil: { einnahmen: number; grenze: number; ueberschritten: boolean }) {
  return { ...teil, warnung: true, prozent: 100, puffer: 0 };
}
