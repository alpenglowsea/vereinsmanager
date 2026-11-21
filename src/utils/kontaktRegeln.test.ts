import { describe, it, expect } from 'vitest';
import { gehoertZuKontakt, kontaktBuchungen, ibanFehler, bicFehler, emailFehler } from './kontaktRegeln';
import type { Transaction } from '../types';

const kontakt = { displayName: 'Müller', companyName: '', contactNumber: 'K-1001' };
const b = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), date: '2026-01-01', type: 'income', amount: 10, partner: '', bookingText: '', notes: '', ...o }) as Transaction;

describe('Zuordnung von Buchungen (D-55)', () => {
  it('nur genauer Name, ohne Groß-/Kleinschreibung', () => {
    expect(gehoertZuKontakt(b({ partner: 'müller ' }), kontakt)).toBe(true);
    expect(gehoertZuKontakt(b({ partner: 'Müller Bau GmbH' }), kontakt)).toBe(false);
    expect(gehoertZuKontakt(b({ partner: 'Frau Müller' }), kontakt)).toBe(false);
  });
  it('oder die Kontaktnummer als ganzes Wort', () => {
    expect(gehoertZuKontakt(b({ partner: 'K-1001' }), kontakt)).toBe(true);
    expect(gehoertZuKontakt(b({ bookingText: 'Spende (K-1001)' }), kontakt)).toBe(true);
    expect(gehoertZuKontakt(b({ notes: 'siehe k-1001.' }), kontakt)).toBe(true);
    expect(gehoertZuKontakt(b({ bookingText: 'K-10012' }), kontakt)).toBe(false);
  });
});

describe('Summen über alle Buchungen (D-54)', () => {
  it('rechnet alle, zeigt die neuesten zehn, lässt Umbuchungen weg', () => {
    const liste = [
      ...Array.from({ length: 12 }, (_, i) => b({ partner: 'Müller', amount: 10, date: `2026-01-${String(i + 1).padStart(2, '0')}` })),
      b({ partner: 'Müller', type: 'expense', amount: -25 }),
      b({ partner: 'Müller', type: 'transfer', amount: 100 })
    ];
    const r = kontaktBuchungen(kontakt, liste);
    expect(r.anzahl).toBe(14);
    expect(r.einnahmen).toBe(120);
    expect(r.ausgaben).toBe(25);
    expect(r.neueste).toHaveLength(10);
    expect(r.neueste[0].date).toBe('2026-01-12');
  });
});

describe('Bankdaten und E-Mail prüfen (D-61)', () => {
  it('prüft die IBAN-Prüfziffer', () => {
    expect(ibanFehler('DE89 3704 0044 0532 0130 00')).toBeNull();
    expect(ibanFehler('DE89 3704 0044 0532 0130 01')).not.toBeNull();
    expect(ibanFehler('DE89 3704')).not.toBeNull();
    expect(ibanFehler('')).toBeNull();
  });
  it('prüft BIC und E-Mail', () => {
    expect(bicFehler('COBADEFFXXX')).toBeNull();
    expect(bicFehler('cobadeff')).toBeNull();
    expect(bicFehler('COBADE')).not.toBeNull();
    expect(emailFehler('info@verein.de')).toBeNull();
    expect(emailFehler('info(at)verein.de')).not.toBeNull();
  });
});
