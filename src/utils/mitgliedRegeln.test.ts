import { describe, it, expect } from 'vitest';
import {
  statusText, typText, zahlweiseText, zahlartText, kontoinhaberNachName, wendeSammelRegelnAn,
  wirdEingezogen, kontoinhaberWeichtAb, lokalesHeute, prozente
} from './mitgliedRegeln';
import type { Member } from '../types';

const mitglied = (o: Partial<Member> = {}): Member =>
  ({ id: 'm1', firstName: 'Max', lastName: 'Müller', status: 'active', membershipType: 'full', feeAmount: 120, feePeriod: 'yearly', paymentMethod: 'sepa', entryDate: '2020-01-01', ...o }) as Member;

describe('Deutsche Begriffe (D-29)', () => {
  it('übersetzt die Kennungen', () => {
    expect(statusText('active')).toBe('Aktiv');
    expect(typText('full')).toBe('Vollmitglied');
    expect(typText('art-x', [{ id: 'art-x', name: 'Senioren' }])).toBe('Senioren');
    expect(zahlweiseText('half_yearly')).toBe('Halbjährlich');
    expect(zahlartText('sepa')).toBe('SEPA-Lastschrift');
    expect(statusText(undefined)).toBe('–');
  });
});

describe('Kontoinhaber folgt dem Namen (D-25)', () => {
  it('folgt beim Tippen, nicht nur beim ersten Buchstaben', () => {
    expect(kontoinhaberNachName('', '', 'M')).toBe('M');
    expect(kontoinhaberNachName('M', 'M', 'Ma')).toBe('Ma');
    expect(kontoinhaberNachName('Max', 'Max', 'Max Müller')).toBe('Max Müller');
  });
  it('lässt eine eigene Eingabe stehen', () => {
    expect(kontoinhaberNachName('Erika Müller', 'Max Müller', 'Max Müllerr')).toBeNull();
  });
  it('füllt ein geleertes Feld erst bei der nächsten Namensänderung', () => {
    expect(kontoinhaberNachName('', 'Max Müller', 'Max Müller')).toBe('Max Müller');
  });
});

describe('Sammelbearbeitung mit Formularregeln (D-27)', () => {
  it('„gekündigt“ setzt Beitrag, Zahlweise und Zahlungsart zurück', () => {
    const { mitglied: m } = wendeSammelRegelnAn(mitglied(), { status: 'terminated' }, '2026-11-20');
    expect(m).toMatchObject({ status: 'terminated', membershipType: 'ausgetreten', feeAmount: 0, feePeriod: 'none', paymentMethod: 'exempt', exitDate: '2026-11-20' });
  });
  it('setzt den Beitrag bei Ausgetretenen nicht und sagt es', () => {
    const r = wendeSammelRegelnAn(mitglied({ status: 'terminated', membershipType: 'ausgetreten', feeAmount: 0, feePeriod: 'none', paymentMethod: 'exempt' }), { feeAmount: 50, paymentMethod: 'sepa' }, '2026-11-20');
    expect(r.mitglied.feeAmount).toBe(0);
    expect(r.mitglied.paymentMethod).toBe('exempt');
    expect(r.uebersprungen).toEqual(['Zahlungsart', 'Beitrag']);
  });
  it('Ehrenmitglied wird beitragsfrei; Reaktivieren macht aus „ausgetreten“ ein Vollmitglied', () => {
    expect(wendeSammelRegelnAn(mitglied(), { membershipType: 'honorary' }, 'x').mitglied).toMatchObject({ feeAmount: 0, feePeriod: 'none', paymentMethod: 'exempt' });
    const r = wendeSammelRegelnAn(mitglied({ status: 'terminated', membershipType: 'ausgetreten' }), { status: 'active' }, 'x');
    expect(r.mitglied.membershipType).toBe('full');
  });
  it('Zahlweise „beitragsfrei“ setzt Beitrag 0; eine andere hebt „befreit“ auf', () => {
    expect(wendeSammelRegelnAn(mitglied(), { feePeriod: 'none' }, 'x').mitglied).toMatchObject({ feeAmount: 0, paymentMethod: 'exempt' });
    expect(wendeSammelRegelnAn(mitglied({ feePeriod: 'none', paymentMethod: 'exempt', feeAmount: 0 }), { feePeriod: 'monthly', feeAmount: 10 }, 'x').mitglied).toMatchObject({ feePeriod: 'monthly', paymentMethod: 'sepa', feeAmount: 10 });
  });
});

describe('Beitragseinzug (D-23, D-24)', () => {
  it('beachtet Ein- und Austrittsdatum', () => {
    expect(wirdEingezogen(mitglied({ exitDate: '2026-11-19' }), '2026-11-20')).toBe(false);
    expect(wirdEingezogen(mitglied({ exitDate: '2026-11-20' }), '2026-11-20')).toBe(true);
    expect(wirdEingezogen(mitglied({ entryDate: '2026-11-21' }), '2026-11-20')).toBe(false);
    expect(wirdEingezogen(mitglied({ entryDate: '2026-11-20' }), '2026-11-20')).toBe(true);
    expect(wirdEingezogen(mitglied({ status: 'suspended' }), '2026-11-20')).toBe(false);
  });
  it('setzt den Stern nur bei echter Abweichung', () => {
    expect(kontoinhaberWeichtAb('Max Müller', 'Max', 'Müller')).toBe(false);
    expect(kontoinhaberWeichtAb('Müller, Max', 'Max', 'Müller')).toBe(false);
    expect(kontoinhaberWeichtAb('Erika Müller', 'Max', 'Müller')).toBe(true);
  });
  it('nimmt das Datum in Ortszeit', () => {
    expect(lokalesHeute(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
  });
});

describe('Prozente ergeben 100 (T-131)', () => {
  it('verteilt die Reste statt einzeln zu runden', () => {
    // Zahlen aus dem Bildschirmfoto: einzeln gerundet 56+27+0+0+4+1+13 = 101
    const p = prozente([78, 38, 0, 0, 5, 1, 18], 140);
    expect(p.reduce((s, x) => s + x, 0)).toBe(100);
    expect(p).toEqual([56, 27, 0, 0, 3, 1, 13]);
  });
  it('rundet einzeln, wenn die Anzahlen nicht das Ganze sind', () => {
    expect(prozente([1, 1], 3)).toEqual([33, 33]);
    expect(prozente([5], 0)).toEqual([0]);
  });
});
