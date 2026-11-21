import { describe, it, expect } from 'vitest';
import { autoDetectMapping, convertRowsToMembers, bereiteMitgliederImportVor, uebernehmeMitglied, leseImportDatum } from './memberImportService';
import type { ClubSettings, Member } from '../types';

const settings = { departments: ['Fußball'], membershipFeeDefaults: { full: { amount: 18, period: 'monthly' } } } as unknown as ClubSettings;
const alt = {
  id: 'm1', memberNumber: 'M-0107', firstName: 'Max', lastName: 'Muster', email: 'alt@x.de', phone: '0123',
  address: { street: 'Weg', houseNumber: '1', zip: '1', city: 'A', country: 'Deutschland' },
  bankDetails: { iban: 'DE89370400440532013000', bic: '', bankName: '', accountHolder: 'Eltern Muster', mandateDate: '2020-01-01', mandateReference: 'M-1' },
  guardianName: 'Erika', feeAmount: 30, feePeriod: 'yearly', status: 'active', membershipType: 'full'
} as unknown as Member;

describe('Spaltenzuordnung (D-32)', () => {
  it('„Status (…Ehrenmitglied…)“ wird zum Status, nicht zum Namen', () => {
    const m = autoDetectMapping(['Vorname', 'Nachname', 'Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)', 'Beitragsgruppe (Vollzahler/Jugend)', 'Beitrag in Euro (je Zahlung)', 'Hausnummer']);
    expect(m.status).toBe('Status (Aktiv/Passiv/Ehrenmitglied/Gekündigt)');
    expect(m.membershipType).toBe('Beitragsgruppe (Vollzahler/Jugend)');
    expect(m.feeAmount).toBe('Beitrag in Euro (je Zahlung)');
    expect(m.fullName).toBeUndefined();
    expect(m.houseNumber).toBe('Hausnummer');
  });
  it('Datum: unmöglich ergibt nichts, reines Jahr den 1. Januar', () => {
    expect(leseImportDatum('31.02.2000')).toBeUndefined();
    expect(leseImportDatum('1990')).toBe('1990-01-01');
  });
});

describe('Umwandeln', () => {
  const map = { firstName: 'V', lastName: 'N', feeAmount: 'B', memberNumber: 'Nr', entryDate: 'E' };
  const z = convertRowsToMembers([
    { V: 'Anna', N: 'Neu', B: '1.250', Nr: '', E: 'gestern' },
    { V: 'Ben', N: 'Neu', B: '', Nr: 'M-0110', E: '' },
    { V: 'Max', N: 'Muster', B: '', Nr: '', E: '' }
  ], map, [alt], settings, undefined, '2026-11-20');

  it('Nummern aus der höchsten fortgezählt, auch über Nummern der Datei hinweg', () => {
    expect(z[0].member.memberNumber).toBe('M-0111');
    expect(z[2].member.memberNumber).toBe('M-0112');
  });
  it('„1.250“ wird 1250 mit Hinweis; unlesbares Datum wird gemeldet', () => {
    expect(z[0].member.feeAmount).toBe(1250);
    expect(z[0].warnings.join(' ')).toContain('bitte prüfen');
    expect(z[0].warnings.join(' ')).toContain('Eintrittsdatum „gestern“');
  });
  it('ohne Beitrag gilt die Vorgabe der Mitgliedsart', () => {
    expect(z[1].member.feeAmount).toBe(18);
    expect(z[1].member.feePeriod).toBe('monthly');
  });
  it('Aktualisieren überschreibt nur Felder mit Wert in der Datei', () => {
    expect(z[2].isDuplicate).toBe(true);
    const [m] = bereiteMitgliederImportVor([z[2]], 'update', [alt]);
    expect(m.email).toBe('alt@x.de');
    expect(m.feeAmount).toBe(30);
    expect(m.bankDetails.accountHolder).toBe('Eltern Muster');
    expect((m as unknown as { guardianName: string }).guardianName).toBe('Erika');
    expect(m.memberNumber).toBe('M-0107');
  });
  it('„Immer neu“ vergibt eine freie Nummer', () => {
    const mitNr = { ...z[2], member: { ...z[2].member, memberNumber: 'M-0107' } };
    const [m] = bereiteMitgliederImportVor([mitNr], 'create_always', [alt]);
    expect(m.id).not.toBe('m1');
    expect(m.memberNumber).toBe('M-0108');
  });
  it('uebernehmeMitglied ändert nur die genannten Felder', () => {
    const m = uebernehmeMitglied(alt, { ...alt, email: 'neu@x.de', phone: '999' } as Member, ['email']);
    expect(m.email).toBe('neu@x.de');
    expect(m.phone).toBe('0123');
  });
});
