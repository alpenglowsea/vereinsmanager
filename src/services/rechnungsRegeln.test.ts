import { describe, it, expect } from 'vitest';
import {
  parseMenge, mengeText, berechneSummen, giroCodeInhalt, kontaktZeile, kontoVorschlag, eindeutigeBelegNummer,
  pruefeBezahlt, rechnungsBuchung, buchungWeichtAb, gleicheBuchungAn, istUeberfaellig
} from './rechnungsRegeln';
import type { ClubInvoice, InvoiceItem, Transaction } from '../types';

const pos = (q: number | string, p: number, ust: number): InvoiceItem =>
  ({ id: `p${Math.random()}`, position: 0, description: 'x', quantity: q as number, unitPrice: p, vatRate: ust, totalPrice: 0 }) as InvoiceItem;

describe('Menge (D-49)', () => {
  it('liest bis zu drei Nachkommastellen', () => {
    expect(parseMenge('0,75')).toBe(0.75);
    expect(parseMenge('1.234,5')).toBe(1234.5);
    expect(parseMenge('2.125')).toBe(2.125);
    expect(parseMenge('1,23456')).toBe(1.235);
    expect(parseMenge('abc')).toBeNull();
    expect(parseMenge('')).toBeNull();
    expect(mengeText(0.75)).toBe('0,75');
    expect(mengeText(2)).toBe('2');
  });
});

describe('Summen', () => {
  it('rechnet die Umsatzsteuer je Satz aus der Nettosumme', () => {
    // drei Positionen à 0,33 € netto zu 19 %: je Position gerundet wären es 3 × 0,06 = 0,18
    const s = berechneSummen([pos(1, 0.33, 19), pos(1, 0.33, 19), pos(1, 0.33, 19)], false);
    expect(s.subtotalNet).toBe(0.99);
    expect(s.vatAmounts[19]).toBe(0.19);
    expect(s.totalAmount).toBe(1.18);
  });

  it('lässt 0,75 als Menge stehen', () => {
    const s = berechneSummen([pos('0,75', 40, 19)], false);
    expect(s.positionen[0].quantity).toBe(0.75);
    expect(s.positionen[0].totalPrice).toBe(30);
  });

  it('setzt beim Kleinunternehmer alle Sätze auf 0 (D-05)', () => {
    const s = berechneSummen([pos(1, 100, 19), pos(2, 10, 7)], true);
    expect(s.positionen.map(p => p.vatRate)).toEqual([0, 0]);
    expect(s.totalVat).toBe(0);
    expect(s.totalAmount).toBe(120);
  });
});

describe('GiroCode (D-51)', () => {
  it('schreibt den Verwendungszweck in Zeile 11 und lässt die Referenz leer', () => {
    const z = giroCodeInhalt({ creditorIban: 'de89 3704 0044 0532 0130 00', creditorBic: 'COBADEFFXXX', clubName: 'TSV' }, 123.4, 'Rechnung RE-2026-001')!.split('\n');
    expect(z).toHaveLength(11);
    expect(z[6]).toBe('DE89370400440532013000');
    expect(z[7]).toBe('EUR123.40');
    expect(z[9]).toBe('');
    expect(z[10]).toBe('Rechnung RE-2026-001');
  });
  it('gibt ohne IBAN oder Betrag nichts', () => {
    expect(giroCodeInhalt({ creditorIban: '', clubName: 'TSV' }, 10, 'x')).toBeNull();
    expect(giroCodeInhalt({ creditorIban: 'DE89370400440532013000', clubName: 'TSV' }, 0, 'x')).toBeNull();
  });
});

describe('Briefkopf (E10)', () => {
  it('nennt nur, was eingetragen ist', () => {
    expect(kontaktZeile({ phone: '0123 456', email: 'info@tsv.de', website: 'www.tsv.de' })).toBe('Tel.: 0123 456 • info@tsv.de • www.tsv.de');
    expect(kontaktZeile({ phone: ' ', email: '', website: 'www.tsv.de' })).toBe('www.tsv.de');
  });
});

describe('Bezahlen und Buchung (D-01)', () => {
  const rechnung = (o: Partial<ClubInvoice> = {}): ClubInvoice =>
    ({
      id: 'inv-1', invoiceNumber: 'RE-2026-004', status: 'open', subject: 'Bandenwerbung', recipientName: 'Max Muster', recipientCompany: 'Muster GmbH',
      taxSphere: 'wirtschaftlich', items: [{ ...pos(1, 100, 19), totalPrice: 100 }], totalAmount: 119, dueDate: '2026-03-01', ...o
    }) as ClubInvoice;
  const angaben = { datum: '2026-03-05', zahlart: 'transfer' as const, buchungAnlegen: true, kontoId: 'acc-1', konto: kontoVorschlag('wirtschaftlich') };

  it('schlägt je Sphäre ein Konto vor', () => {
    expect(kontoVorschlag('wirtschaftlich')?.skrAccount).toBe('44000');
    expect(kontoVorschlag('ideell')?.skrAccount).toBe('40890');
    expect(kontoVorschlag('vermoegen')?.skrAccount).toBe('46900');
    expect(kontoVorschlag('zweckbetrieb')?.skrAccount).toBe('41000');
  });

  it('prüft die Angaben', () => {
    expect(pruefeBezahlt(rechnung({ status: 'cancelled' }), angaben)).not.toBeNull();
    expect(pruefeBezahlt(rechnung(), { ...angaben, datum: '' })).not.toBeNull();
    expect(pruefeBezahlt(rechnung(), { ...angaben, kontoId: '' })).not.toBeNull();
    expect(pruefeBezahlt(rechnung(), { ...angaben, buchungAnlegen: false, kontoId: '' })).toBeNull();
  });

  it('legt eine Einnahme über den Bruttobetrag an', () => {
    const b = rechnungsBuchung(rechnung(), angaben, ['RE-2026-004'], 'jetzt', 'tx-1');
    expect(b).toMatchObject({ type: 'income', amount: 119, date: '2026-03-05', accountId: 'acc-1', partner: 'Muster GmbH', skrAccount: '44000', vatRate: 19, documentNumber: 'RE-2026-004-2' });
    expect(b.bookingText).toBe('Rechnung RE-2026-004: Bandenwerbung');
    expect(b.isSplit).toBeUndefined();
  });

  it('teilt bei mehreren Steuersätzen je Satz auf', () => {
    const r = rechnung({ items: [{ ...pos(1, 100, 19), totalPrice: 100 }, { ...pos(1, 50, 7), totalPrice: 50 }], totalAmount: 172.5 });
    const b = rechnungsBuchung(r, angaben, [], 'jetzt', 'tx-2');
    expect(b.isSplit).toBe(true);
    expect(b.splits!.map(s => [s.vatRate, s.amount])).toEqual([[7, 53.5], [19, 119]]);
    expect(b.vatRate).toBe(0);
  });

  it('vergibt die Belegnummer ohne Doppel', () => {
    expect(eindeutigeBelegNummer('RE-1', [])).toBe('RE-1');
    expect(eindeutigeBelegNummer('RE-1', ['RE-1', 'RE-1-2'])).toBe('RE-1-3');
  });

  it('gleicht die Buchung an und hebt eine Aufteilung auf', () => {
    const b = { id: 'tx', type: 'income', amount: 172.5, isSplit: true, splits: [{}], partner: 'alt' } as unknown as Transaction;
    expect(buchungWeichtAb(rechnung(), b)).toBe(true);
    const neu = gleicheBuchungAn(b, rechnung(), 'jetzt');
    expect(neu).toMatchObject({ amount: 119, partner: 'Muster GmbH', isSplit: false, vatRate: 19 });
    expect(neu.splits).toBeUndefined();
    expect(buchungWeichtAb(rechnung(), neu)).toBe(false);
  });

  it('erkennt überfällige Rechnungen', () => {
    expect(istUeberfaellig(rechnung(), '2026-03-02')).toBe(true);
    expect(istUeberfaellig(rechnung(), '2026-03-01')).toBe(false);
    expect(istUeberfaellig(rechnung({ status: 'paid' }), '2026-04-01')).toBe(false);
  });
});
