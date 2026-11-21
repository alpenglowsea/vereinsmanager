import { describe, it, expect } from 'vitest';
import { erkenneKontaktSpalten, siehtNachFirmaAus, kontaktTypen, wandleKontakteUm, mitArt, bereiteKontaktImportVor, KONTAKT_VORLAGE } from './kontaktImportService';
import type { ClubContact } from '../types';

const vorhanden = [
  { id: 'a', contactNumber: 'K-1005', personType: 'legal', displayName: 'Sport Schmitt GmbH', companyName: 'Sport Schmitt GmbH', types: ['supplier'], address: {}, email: '', phone: '', createdAt: '', updatedAt: '' }
] as unknown as ClubContact[];

const tabelle = (text: string) => {
  const [kopf, ...zeilen] = text.split('\n');
  const h = kopf.split(';');
  return { h, rows: zeilen.map(z => Object.fromEntries(z.split(';').map((v, i) => [h[i], v]))) };
};

describe('Firma erkennen (D-56)', () => {
  it('Rechtsform nur als ganzes Wort', () => {
    expect(siehtNachFirmaAus('Müller GmbH')).toBe(true);
    expect(siehtNachFirmaAus('TSV Musterstadt e.V.')).toBe(true);
    expect(siehtNachFirmaAus('Evangelische Kirchengemeinde')).toBe(false);
    expect(siehtNachFirmaAus('Hugo Zeugner')).toBe(false);
  });
});

describe('Kontakttypen (D-57)', () => {
  it('alle neun, Unbekanntes wird gemeldet', () => {
    expect(kontaktTypen('Mitgliedsbezug, Sonstige').typen).toEqual(['member_contact', 'other']);
    expect(kontaktTypen('Lieferant; Spender').typen).toEqual(['supplier', 'donor']);
    expect(kontaktTypen('Bäcker').unbekannt).toEqual(['Bäcker']);
  });
});

describe('Umwandeln mit der Vorlage', () => {
  const { h, rows } = tabelle(KONTAKT_VORLAGE);
  const sp = erkenneKontaktSpalten(h);
  const z = wandleKontakteUm(rows, sp, 'erkennen', 'supplier', vorhanden);

  it('ordnet die Spalten zu', () => {
    expect(sp.displayName).toBe('Name / Firma');
    expect(sp.personType).toBe('Personenart');
    expect(sp.types).toBe('Kontakttypen');
  });
  it('Duplikat (gleicher Name) ist markiert und abgewählt (D-58)', () => {
    expect(z[0].duplikat).toBe('Sport Schmitt GmbH (K-1005)');
    expect(z[0].selected).toBe(false);
  });
  it('Ansprechpartner ohne feste Anrede, Privatperson mit Vor- und Nachname', () => {
    expect(z[0].kontakt.contactPerson).toEqual({ firstName: 'Thomas', lastName: 'Schmitt' });
    expect(z[2].kontakt.personType).toBe('natural');
    expect(z[2].kontakt.displayName).toBe('Markus Weber');
    expect(z[2].kontakt.types).toEqual(['donor']);
  });
  it('Nummern werden aus der höchsten fortgezählt', () => {
    const k = bereiteKontaktImportVor(z, vorhanden);
    expect(k.map(c => c.contactNumber)).toEqual(['K-1006', 'K-1007', 'K-1008']);
  });
});

describe('Prüfungen beim Import (D-73)', () => {
  it('ungültige IBAN, BIC und E-Mail werden nicht übernommen', () => {
    const [z] = wandleKontakteUm([{ N: 'Erika Muster', I: 'DE89370400440532013001', B: 'COBA', E: 'x(at)y.de' }], { displayName: 'N', iban: 'I', bic: 'B', email: 'E' }, 'erkennen', 'other', []);
    expect(z.kontakt.bankDetails).toBeUndefined();
    expect(z.kontakt.email).toBe('');
    expect(z.hinweise).toHaveLength(3);
    expect(z.selected).toBe(true);
  });
  it('vergebene Nummer wird ersetzt und gemeldet; Duplikat über die Nummer', () => {
    const [z] = wandleKontakteUm([{ Nr: 'k-1005', N: 'Anderer Name' }], { contactNumber: 'Nr', displayName: 'N' }, 'erkennen', 'other', vorhanden);
    expect(z.kontakt.contactNumber).toBe('');
    expect(z.duplikat).toBe('Sport Schmitt GmbH (K-1005)');
  });
  it('Art umschalten ordnet die Namen neu', () => {
    const [z] = wandleKontakteUm([{ N: 'Bäckerei Krume' }], { displayName: 'N' }, 'erkennen', 'other', []);
    expect(z.kontakt.personType).toBe('natural');
    const f = mitArt(z, 'legal', []);
    expect(f.kontakt.companyName).toBe('Bäckerei Krume');
    expect(f.kontakt.displayName).toBe('Bäckerei Krume');
  });
});
