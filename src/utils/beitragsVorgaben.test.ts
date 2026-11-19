import { describe, it, expect } from 'vitest';
import { leseVorgaben, vorgabeFuer, STANDARD_VORGABEN } from './beitragsVorgaben';

describe('Beitragsvorgaben je Mitgliedsart', () => {
  it('nimmt ohne gespeicherte Werte die Startwerte (wie Android)', () => {
    expect(leseVorgaben(undefined)).toEqual(STANDARD_VORGABEN);
    expect(leseVorgaben('kaputt')).toEqual(STANDARD_VORGABEN);
  });

  it('übernimmt gespeicherte Werte und ergänzt fehlende', () => {
    const v = leseVorgaben({ full: { amount: 120, period: 'yearly' }, youth: { amount: '7,50' } });
    expect(v.full).toEqual({ amount: 120, period: 'yearly' });
    expect(v.youth).toEqual({ amount: 7.5, period: 'monthly' });
    expect(v.reduced).toEqual(STANDARD_VORGABEN.reduced);
  });

  it('verwirft unbrauchbare Angaben', () => {
    const v = leseVorgaben({ full: { amount: -5, period: 'weekly' }, family: { amount: 'abc', period: 'quarterly' } });
    expect(v.full).toEqual(STANDARD_VORGABEN.full);
    expect(v.family).toEqual({ amount: 30, period: 'quarterly' });
  });

  it('liefert für Ehrenmitglieder und Ausgetretene keine Vorgabe', () => {
    const v = leseVorgaben(undefined);
    expect(vorgabeFuer(v, 'full')).toEqual(STANDARD_VORGABEN.full);
    expect(vorgabeFuer(v, 'honorary')).toBeNull();
    expect(vorgabeFuer(v, 'ausgetreten')).toBeNull();
  });
});
