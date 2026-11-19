import { describe, it, expect } from 'vitest';
import { spendenKonto, spendenBelegNummer, spendenBuchung, buchungWeichtAb, gleicheBuchungAn } from './spendenBuchung';
import type { DonationReceipt, Transaction } from '../types';

const spende = (o: Partial<DonationReceipt> = {}): DonationReceipt =>
  ({ id: 'd1', receiptNumber: 'ZB-2026-004', type: 'money', date: '2026-03-01', donorName: ' Anna Muster ', amount: 123.45, notes: '', ...o }) as DonationReceipt;

describe('Spendenbuchung (D-10, D-38)', () => {
  it('bucht auf 40450 im Nummernkreis 40400', () => {
    const k = spendenKonto();
    expect(k.skrAccount).toBe('40450');
    expect(k.mainCategory.startsWith('40400 - ')).toBe(true);
    expect(k.subCategory.startsWith('40450 - ')).toBe(true);
  });

  it('vergibt SP-Nummern ohne Doppel', () => {
    expect(spendenBelegNummer('2026-03-01', 'ZB-2026-004', [])).toBe('SP-2026-004');
    expect(spendenBelegNummer('2026-03-01', 'ZB-2026-004', ['SP-2026-004', 'SP-2026-004-2'])).toBe('SP-2026-004-3');
    expect(spendenBelegNummer('2026-03-01', 'ohne', [])).toBe('SP-2026-000');
  });

  it('legt eine Einnahme im ideellen Bereich ohne Umsatzsteuer an', () => {
    const b = spendenBuchung(spende(), 'acc-1', [], '2026-03-02T10:00:00Z', 'tx-1');
    expect(b).toMatchObject({ type: 'income', amount: 123.45, sphere: 'ideell', vatRate: 0, skrAccount: '40450', accountId: 'acc-1', partner: 'Anna Muster', documentNumber: 'SP-2026-004' });
    expect(b.bookingText).toBe('Spende / Zuwendung: Anna Muster (ZB-2026-004)');
  });
});

describe('Verknüpfte Buchung nachführen (D-39)', () => {
  const buchung = (o: Partial<Transaction> = {}): Transaction =>
    ({ id: 'tx-1', type: 'income', amount: 123.45, date: '2026-03-01', partner: 'Anna Muster', bookingText: 'x', ...o }) as Transaction;

  it('erkennt Abweichungen bei Betrag, Datum und Name', () => {
    expect(buchungWeichtAb(spende(), buchung())).toBe(false);
    expect(buchungWeichtAb(spende({ amount: 100 }), buchung())).toBe(true);
    expect(buchungWeichtAb(spende({ date: '2026-03-02' }), buchung())).toBe(true);
    expect(buchungWeichtAb(spende({ donorName: 'Berta' }), buchung())).toBe(true);
  });

  it('gleicht an und behält das Vorzeichen', () => {
    const neu = gleicheBuchungAn(buchung({ notes: 'bleibt' }), spende({ amount: 50, date: '2026-04-01' }), 'jetzt');
    expect(neu).toMatchObject({ amount: 50, date: '2026-04-01', partner: 'Anna Muster', notes: 'bleibt', updatedAt: 'jetzt' });
    expect(gleicheBuchungAn(buchung({ type: 'expense', amount: -10 }), spende({ amount: 50 }), 'jetzt').amount).toBe(-50);
  });
});
