import { describe, it, expect } from 'vitest';
import {
  SKR42_STRUCTURE,
  SPENDEN_HAUPTKONTO_CODE,
  getAllSkr42MainCategories,
  getAllSkr42SubCategories
} from './taxSpheres';

describe('SKR42_STRUCTURE', () => {
  it('hat keine doppelt vergebenen Hauptkonto-Nummern (Nummernkreise)', () => {
    // Bis zur Entkopplung von Sphäre und Konto unterschieden sich manche
    // Nummernkreise nur durch die (inzwischen entfallene) Sphäre und trugen
    // deshalb dieselbe Nummer (u.a. 50000, 60000, 62000, 69000 je mehrfach).
    // Diese Prüfung stellt sicher, dass so etwas nicht wieder unbemerkt
    // hereinrutscht.
    const codes = SKR42_STRUCTURE.map(m => m.code);
    const duplicates = codes.filter((code, idx) => codes.indexOf(code) !== idx);
    expect(duplicates).toEqual([]);
  });

  it('hat keine doppelt vergebenen Haupt-IDs', () => {
    const ids = SKR42_STRUCTURE.map(m => m.id);
    const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    expect(duplicates).toEqual([]);
  });

  it('enthält den Spenden-Nummernkreis unter der erwarteten Nummer', () => {
    const spenden = SKR42_STRUCTURE.find(m => m.code === SPENDEN_HAUPTKONTO_CODE);
    expect(spenden).toBeDefined();
    expect(spenden?.type).toBe('income');
    expect(spenden?.subCategories.length).toBeGreaterThan(0);
  });

  it('liefert bei getAllSkr42MainCategories(type) nur Konten des angefragten Typs', () => {
    const income = getAllSkr42MainCategories('income');
    const expense = getAllSkr42MainCategories('expense');
    expect(income.length).toBeGreaterThan(0);
    expect(expense.length).toBeGreaterThan(0);
    expect(income.every(m => m.type === 'income')).toBe(true);
    expect(expense.every(m => m.type === 'expense')).toBe(true);
    expect(income.length + expense.length).toBe(SKR42_STRUCTURE.length);
  });

  it('liefert ohne Angaben alle Unterkonten aller Nummernkreise', () => {
    const allSubs = getAllSkr42SubCategories();
    const expectedCount = SKR42_STRUCTURE.reduce((sum, m) => sum + m.subCategories.length, 0);
    expect(allSubs.length).toBe(expectedCount);
  });

  it('liefert für einen bestimmten Nummernkreis nur dessen eigene Unterkonten', () => {
    const spenden = SKR42_STRUCTURE.find(m => m.code === SPENDEN_HAUPTKONTO_CODE)!;
    const subs = getAllSkr42SubCategories(undefined, spenden.code);
    expect(subs).toEqual(spenden.subCategories);
  });

  it('enthält keine Kontobezeichnung doppelt je Typ', () => {
    // vorher über die ungenutzte Konstante ALL_ACCOUNT_CATEGORIES geprüft (entfernt, Code-Prüfung 24.11.2026)
    for (const typ of ['income', 'expense'] as const) {
      const labels = SKR42_STRUCTURE.filter(m => m.type === typ).flatMap(m => m.subCategories.map(s => s.label));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('kein Skr42MainCategory-Eintrag trägt mehr eine Sphäre', () => {
    // TypeScript verhindert das schon beim Kompilieren (die Eigenschaft
    // existiert nicht mehr im Typ) — dieser Laufzeit-Check fängt zusätzlich
    // den Fall ab, dass irgendwo noch rohe Objektliterale ohne den Typ
    // durchgereicht werden.
    SKR42_STRUCTURE.forEach(m => {
      expect(Object.prototype.hasOwnProperty.call(m, 'sphere')).toBe(false);
    });
  });
});
