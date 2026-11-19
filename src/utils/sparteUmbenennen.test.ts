import { describe, it, expect } from 'vitest';
import { spartenNameFehler, ersetzeSparte, ersetzeSparteInBuchung, ersetzeInListe } from './sparteUmbenennen';
import type { Transaction } from '../types';

describe('Spartennamen prüfen', () => {
  const liste = ['Fußball', 'Tennis'];
  it('lehnt leere und doppelte Namen ab, ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(spartenNameFehler('  ', liste)).not.toBeNull();
    expect(spartenNameFehler('fussball', liste)).toBeNull();
    expect(spartenNameFehler('FUßBALL', liste)).not.toBeNull();
    expect(spartenNameFehler(' Tennis ', liste)).not.toBeNull();
    expect(spartenNameFehler('Badminton', liste)).toBeNull();
  });
  it('erlaubt beim Umbenennen, nur die Schreibweise zu ändern', () => {
    expect(spartenNameFehler('TENNIS', liste, 'Tennis')).toBeNull();
    expect(spartenNameFehler('Tennis', liste, 'Tennis')).not.toBeNull();
    expect(spartenNameFehler('Fußball', liste, 'Tennis')).not.toBeNull();
  });
});

describe('Sparte umbenennen', () => {
  it('ändert nur Einträge der alten Sparte', () => {
    expect(ersetzeSparte({ id: 1, department: 'tennis ' }, 'Tennis', 'Tennis & Padel')?.department).toBe('Tennis & Padel');
    expect(ersetzeSparte({ id: 2, department: 'Fußball' }, 'Tennis', 'Padel')).toBeNull();
    expect(ersetzeSparte<{ id: number; department?: string }>({ id: 3 }, 'Tennis', 'Padel')).toBeNull();
  });
  it('zieht Teilbuchungen mit und lässt andere Teile stehen', () => {
    const b = { id: 'b', department: 'Fußball', splits: [{ department: 'Tennis', amount: 5 }, { department: 'Fußball', amount: 5 }] } as unknown as Transaction;
    const neu = ersetzeSparteInBuchung(b, 'Tennis', 'Padel');
    expect(neu?.department).toBe('Fußball');
    expect(neu?.splits?.map(s => s.department)).toEqual(['Padel', 'Fußball']);
    expect(ersetzeSparteInBuchung(b, 'Golf', 'Padel')).toBeNull();
  });
  it('behält die Reihenfolge der Liste', () => {
    expect(ersetzeInListe(['A', 'B', 'C'], 'B', ' X ')).toEqual(['A', 'X', 'C']);
  });
});
