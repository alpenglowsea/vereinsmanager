import { describe, it, expect } from 'vitest';
import { numberToGermanWords, passeWorteInFeld } from './donationService';

describe('Betrag in Worten (D-03)', () => {
  it('schreibt die 1 richtig', () => {
    expect(numberToGermanWords(1)).toBe('Ein Euro');
    expect(numberToGermanWords(101)).toBe('Einhunderteins Euro');
    expect(numberToGermanWords(0.01)).toBe('Null Euro und ein Cent');
    expect(numberToGermanWords(1.01)).toBe('Ein Euro und ein Cent');
    expect(numberToGermanWords(1001)).toBe('Eintausendeins Euro');
  });

  it('schreibt übliche Beträge', () => {
    expect(numberToGermanWords(1500)).toBe('Eintausendfünfhundert Euro');
    expect(numberToGermanWords(123.45)).toBe('Einhundertdreiundzwanzig Euro und fünfundvierzig Cent');
    expect(numberToGermanWords(21)).toBe('Einundzwanzig Euro');
    expect(numberToGermanWords(31000)).toBe('Einunddreißigtausend Euro');
    expect(numberToGermanWords(101000)).toBe('Einhunderteintausend Euro');
    expect(numberToGermanWords(2_000_000)).toBe('Zwei Millionen Euro');
    expect(numberToGermanWords(1_000_000)).toBe('Eine Million Euro');
  });

  it('rechnet in ganzen Cent', () => {
    expect(numberToGermanWords(0.29)).toBe('Null Euro und neunundzwanzig Cent');
    expect(numberToGermanWords(19.99)).toBe('Neunzehn Euro und neunundneunzig Cent');
  });

  it('gibt bei null, negativ oder ungültig „Null Euro“', () => {
    expect(numberToGermanWords(0)).toBe('Null Euro');
    expect(numberToGermanWords(-5)).toBe('Null Euro');
    expect(numberToGermanWords(Number.NaN)).toBe('Null Euro');
  });
});

describe('Worte ins Feld bringen (D-42)', () => {
  // Gedachte Schrift: jedes Zeichen ist pt/10 * 2 mm breit
  const messe = (s: string, pt: number) => s.length * (pt / 10) * 2;

  it('lässt kurze Texte in 10 pt', () => {
    expect(passeWorteInFeld('Ein Euro', 87, messe)).toEqual({ groesse: 10, zeilen: ['Ein Euro'] });
  });

  it('verkleinert die Schrift, bevor umgebrochen wird', () => {
    const t = 'x'.repeat(60); // 120 mm bei 10 pt
    const r = passeWorteInFeld(t, 87, messe);
    expect(r.zeilen).toEqual([t]);
    expect(r.groesse).toBeLessThan(10);
    expect(r.groesse).toBeGreaterThanOrEqual(5.5);
    expect(messe(t, r.groesse)).toBeLessThanOrEqual(87);
  });

  it('bricht erst unter 5,5 pt in zwei Zeilen zu 6 pt um', () => {
    const t = Array.from({ length: 20 }, () => 'wort').join(' '); // 99 Zeichen, bei 5,5 pt 108,9 mm
    const r = passeWorteInFeld(t, 87, messe);
    expect(r.groesse).toBe(6);
    expect(r.zeilen).toHaveLength(2);
    expect(r.zeilen.join(' ')).toBe(t);
  });
});
