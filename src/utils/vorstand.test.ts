import { describe, it, expect } from 'vitest';
import { istVorsitz, istKasse, vorsitzAus, kasseAus, vorstandHinweise, vorstandFehler, vorstandBereinigt } from './vorstand';
import type { BoardMember } from '../types';

const p = (role: string, name: string, extra: Partial<BoardMember> = {}): BoardMember =>
  ({ id: `${role}-${name}`, role, name, email: '', phone: '', ...extra }) as BoardMember;

describe('Funktion erkennen', () => {
  it('erkennt Vorsitz, aber keine Stellvertreter, Jugend- oder Abteilungsleitungen', () => {
    expect(istVorsitz('1. Vorsitzende/r')).toBe(true);
    expect(istVorsitz('Vorsitzender')).toBe(true);
    expect(istVorsitz('Präsident')).toBe(true);
    expect(istVorsitz('Stellv. Vorsitzender')).toBe(false);
    expect(istVorsitz('2. Vorsitzende/r')).toBe(false);
    expect(istVorsitz('Jugendvorsitzender')).toBe(false);
    expect(istVorsitz('Beisitzer im Vorstand')).toBe(false);
  });

  it('erkennt den Kassenwart, aber keinen Kassenprüfer oder Stellvertreter', () => {
    expect(istKasse('Kassenwart / Schatzmeister')).toBe(true);
    expect(istKasse('Kassiererin')).toBe(true);
    expect(istKasse('Finanzvorstand')).toBe(true);
    expect(istKasse('Kassenprüfer/in')).toBe(false);
    expect(istKasse('Stellv. Kassenwart')).toBe(false);
    expect(istKasse('Schriftführer/in')).toBe(false);
  });
});

describe('Vorsitz und Kassenwart aus der Liste', () => {
  it('wählt nach der Funktion, nicht nach der Stelle in der Liste', () => {
    // vorher: Platz 1 wurde Vorsitz, Platz 2 Kassenwart
    const liste = [p('Stellv. Vorsitzender', 'Anna'), p('Schriftführer/in', 'Bernd'), p('Kassenprüfer/in', 'Clara'), p('1. Vorsitzende/r', 'Dora'), p('Kassenwart / Schatzmeister', 'Emil')];
    expect(vorsitzAus(liste)).toBe('Dora');
    expect(kasseAus(liste)).toBe('Emil');
  });

  it('lässt das Feld leer, wenn niemand passt, und nennt es als Hinweis', () => {
    const liste = [p('Schriftführer/in', 'Bernd'), p('Kassenprüfer/in', 'Clara')];
    expect(vorsitzAus(liste)).toBe('');
    expect(kasseAus(liste)).toBe('');
    expect(vorstandHinweise(liste)).toHaveLength(2);
    expect(vorstandHinweise([p('Vorsitzende', 'A'), p('Kassenwart', 'B')])).toHaveLength(0);
  });

  it('übergeht Einträge ohne Namen', () => {
    expect(vorsitzAus([p('Vorsitzender', ' '), p('1. Vorsitzende/r', ' Dora ')])).toBe('Dora');
  });
});

describe('Prüfen und Bereinigen', () => {
  it('verlangt Name und Funktion bei ausgefüllten Zeilen und prüft die E-Mail', () => {
    const liste = [
      p('', '', { id: 'leer' }),
      p('Kassenwart', '', { id: 'ohneName' }),
      p('', 'Bernd', { id: 'ohneFunktion' }),
      p('Vorsitz', 'Anna', { id: 'mail', email: 'anna(at)verein.de' }),
      p('Vorsitz', 'Anna', { id: 'gut', email: 'anna@verein.de' })
    ];
    expect(Object.keys(vorstandFehler(liste))).toEqual(['ohneName', 'ohneFunktion', 'mail']);
  });

  it('lehnt dieselbe Person mit derselben Funktion doppelt ab, erlaubt aber zwei Ämter', () => {
    const liste = [
      p('Kassenwart', 'Emil', { id: 'a' }),
      p('kassenwart ', ' emil', { id: 'b' }),
      p('Schriftführer/in', 'Emil', { id: 'c' })
    ];
    expect(Object.keys(vorstandFehler(liste))).toEqual(['b']);
  });

  it('lässt ganz leere Zeilen weg und entfernt Leerzeichen am Rand', () => {
    expect(vorstandBereinigt([p('', '', { id: 'x' }), p(' Kassenwart ', ' Emil ')]).map(m => [m.role, m.name])).toEqual([
      ['Kassenwart', 'Emil']
    ]);
  });
});
