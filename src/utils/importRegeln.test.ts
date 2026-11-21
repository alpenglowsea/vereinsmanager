import { describe, it, expect } from 'vitest';
import { ordneSpaltenZu, leseDatum, leseBetrag, artAusText, findeDuplikat, findeSkrKonto, kontoFelder, kontoAusHistorie } from './importRegeln';
import type { Skr42MainCategory, Transaction } from '../types';

const b = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), date: '2026-01-15', type: 'income', amount: 10, accountId: 'a', documentNumber: '', partner: '', bookingText: '', sphere: 'ideell', category: '', vatRate: 0, createdAt: '', updatedAt: '', ...o }) as Transaction;

describe('Spaltenzuordnung (D-68, D-70)', () => {
  const regeln = [
    { feld: 'partner' as const, genau: ['partner', 'name'], teil: ['beguenstigter', 'auftraggeber'] },
    { feld: 'art' as const, genau: ['art', 'buchungsart'], teil: ['buchungsart'] },
    { feld: 'text' as const, genau: ['text', 'verwendungszweck'], teil: ['verwendungszweck'] }
  ];
  it('kein Teiltreffer mit Kurzwörtern', () => {
    const m = ordneSpaltenZu(['Artikel', 'Kontoname', 'Begünstigter/Zahlungspflichtiger', 'Verwendungszweck'], regeln);
    expect(m.art).toBeUndefined();
    expect(m.partner).toBe('Begünstigter/Zahlungspflichtiger');
    expect(m.text).toBe('Verwendungszweck');
  });
  it('genaue Treffer gehen vor, jede Spalte nur einmal', () => {
    const m = ordneSpaltenZu(['Buchungsart', 'Art'], regeln);
    expect(m.art).toBe('Art');
  });
});

describe('Datum (D-67)', () => {
  it('liest die üblichen Formen', () => {
    expect(leseDatum('5.3.2026')).toBe('2026-03-05');
    expect(leseDatum('05.03.26')).toBe('2026-03-05');
    expect(leseDatum('2026-03-05')).toBe('2026-03-05');
    expect(leseDatum('05/03/2026')).toBe('2026-03-05');
    expect(leseDatum('20260305')).toBe('2026-03-05');
    expect(leseDatum('05.03.2026 14:30')).toBe('2026-03-05');
  });
  it('unlesbar oder unmöglich ergibt null statt „heute“', () => {
    expect(leseDatum('31.02.2026')).toBeNull();
    expect(leseDatum('2026')).toBeNull();
    expect(leseDatum('morgen')).toBeNull();
    expect(leseDatum('')).toBeNull();
  });
});

describe('Betrag (D-71)', () => {
  it('liest deutsche und englische Schreibweisen', () => {
    expect(leseBetrag('1.234,50')).toEqual({ wert: 1234.5, mehrdeutig: false });
    expect(leseBetrag('1,234.50')).toEqual({ wert: 1234.5, mehrdeutig: false });
    expect(leseBetrag('-12,5')!.wert).toBe(-12.5);
    expect(leseBetrag('12,50-')!.wert).toBe(-12.5);
    expect(leseBetrag('(12,50)')!.wert).toBe(-12.5);
    expect(leseBetrag('€ 15')!.wert).toBe(15);
  });
  it('S und H nur direkt hinter der Zahl', () => {
    expect(leseBetrag('12,50 S')!.wert).toBe(-12.5);
    expect(leseBetrag('12,50 H')!.wert).toBe(12.5);
    expect(leseBetrag('Gebühr S')).toBeNull();
    expect(leseBetrag('S 12,50')).toBeNull();
  });
  it('„1.250“ ist 1250 und wird als mehrdeutig gemeldet', () => {
    expect(leseBetrag('1.250')).toEqual({ wert: 1250, mehrdeutig: true });
    expect(leseBetrag('12.5')).toEqual({ wert: 12.5, mehrdeutig: false });
    expect(leseBetrag('abc')).toBeNull();
  });
  it('Art-Spalte nur mit ganzen Wörtern', () => {
    expect(artAusText('Soll')).toBe('expense');
    expect(artAusText('H')).toBe('income');
    expect(artAusText('Umbuchung')).toBe('transfer');
    expect(artAusText('Spende')).toBeNull();
  });
});

describe('Duplikate (D-65)', () => {
  const alt = [b({ documentNumber: 'BK-2026-001', partner: 'Sparkasse', bookingText: 'Kontoführung', amount: -7.9, type: 'expense' })];
  it('gleiches Datum, gleicher Betrag und gleicher Partner', () => {
    expect(findeDuplikat({ date: '2026-01-15', amount: -7.9, type: 'expense', partner: 'sparkasse ' }, alt)).toBe(alt[0]);
  });
  it('anderes Datum oder anderer Betrag ist kein Duplikat', () => {
    expect(findeDuplikat({ date: '2026-01-16', amount: -7.9, type: 'expense', partner: 'Sparkasse' }, alt)).toBeUndefined();
    expect(findeDuplikat({ date: '2026-01-15', amount: -8.9, type: 'expense', partner: 'Sparkasse' }, alt)).toBeUndefined();
  });
});

describe('Konto (D-69)', () => {
  const skr = [
    { id: 'HK-40000', code: '40000', name: 'Mitgliedsbeiträge', type: 'income', subCategories: [{ code: '40000', name: 'Echte Mitgliedsbeiträge', label: '40000 - Echte Mitgliedsbeiträge', vatRateDefault: 0 }] },
    { id: 'HK-43000', code: '43000', name: 'Gastronomie', type: 'income', subCategories: [{ code: '43150', name: 'Getränke', label: '43150 - Getränke', vatRateDefault: 19 }] }
  ] as Skr42MainCategory[];
  it('nach Nummer oder genauem Namen, kein Raten', () => {
    expect(findeSkrKonto('43150 - irgendwas', 'income', skr)!.sub.code).toBe('43150');
    expect(findeSkrKonto('Echte Mitgliedsbeiträge', 'income', skr)!.sub.code).toBe('40000');
    expect(findeSkrKonto('Beiträge', 'income', skr)).toBeNull();
    expect(findeSkrKonto('99999', 'income', skr)).toBeNull();
  });
  it('Umsatzsteuer kommt aus dem Konto', () => {
    const f = kontoFelder(findeSkrKonto('43150', 'income', skr)!);
    expect(f).toEqual({ mainCategory: '43000 - Gastronomie', subCategory: '43150 - Getränke', category: '43150 - Getränke', skrAccount: '43150', vatRate: 19 });
  });
  it('Vorschlag aus der neuesten Buchung desselben Partners in derselben Richtung', () => {
    const alt = [
      b({ partner: 'Metro', type: 'expense', amount: -5, skrAccount: '51000', date: '2025-01-01' }),
      b({ partner: 'Metro', type: 'expense', amount: -5, skrAccount: '51100', date: '2025-06-01' }),
      b({ partner: 'Metro', type: 'income', amount: 5, skrAccount: '43150', date: '2025-07-01' })
    ];
    expect(kontoAusHistorie('metro', 'expense', alt)!.skrAccount).toBe('51100');
    expect(kontoAusHistorie('Rewe', 'expense', alt)).toBeUndefined();
  });
});
