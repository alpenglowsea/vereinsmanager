import { describe, it, expect } from 'vitest';
import type { ClubDocument } from '../types';
import { unterlageGeaendert, unterlageGeloescht, unterlageHinzugefuegt } from './unterlagenProtokoll';

// Gleiche Fälle und Texte wie android/core/src/test/.../members/UnterlagenTest.kt (Protokoll)
const dok = (p: Partial<ClubDocument>): ClubDocument =>
  ({ id: 'doc-1', title: 'C-Lizenz Fußball', fileName: 'lizenz.pdf', memberId: 'mem-1', date: '2026-01-01', memberDocType: 'trainerlizenz', ...p } as ClubDocument);

describe('Unterlagen im Änderungsprotokoll', () => {
  it('hinzugefügt und gelöscht nennen Art und Bezeichnung', () => {
    expect(unterlageHinzugefuegt(dok({})).summary).toBe('Unterlage hinzugefügt: Trainer-/Übungsleiterlizenz: C-Lizenz Fußball');
    expect(unterlageGeloescht(dok({})).summary).toBe('Unterlage gelöscht: Trainer-/Übungsleiterlizenz: C-Lizenz Fußball');
    // alter Aufnahmeantrag ohne Art
    expect(unterlageGeloescht(dok({ id: 'doc-antrag-M-1', memberDocType: undefined, title: 'Antrag' })).summary).toBe('Unterlage gelöscht: Aufnahmeantrag: Antrag');
  });

  it('bearbeitet: nur geänderte Felder, Daten deutsch, leer als Strich', () => {
    const e = unterlageGeaendert(dok({ validUntil: '2027-01-31' }), dok({ memberDocType: 'erste_hilfe', issuedAt: '2026-11-20', validUntil: '' }));
    expect(e?.summary).toBe('Unterlage bearbeitet: C-Lizenz Fußball');
    expect(e?.changes).toEqual([
      { field: 'unterlage0', label: 'Art', oldValue: 'Trainer-/Übungsleiterlizenz', newValue: 'Erste-Hilfe-Nachweis' },
      { field: 'unterlage1', label: 'Ausgestellt am', oldValue: '–', newValue: '20.11.2026' },
      { field: 'unterlage2', label: 'Gültig bis', oldValue: '31.01.2027', newValue: '–' }
    ]);
  });

  it('bearbeitet: neue Datei und Bezeichnung', () => {
    const e = unterlageGeaendert(dok({}), dok({ title: 'B-Lizenz', fileName: 'neu.jpg' }));
    expect(e?.changes.map(c => c.label)).toEqual(['Bezeichnung', 'Datei']);
    expect(e?.summary).toBe('Unterlage bearbeitet: B-Lizenz');
  });

  it('ohne Änderung kein Eintrag; Art „Aufnahmeantrag“ für alten Antrag ist keine Änderung', () => {
    expect(unterlageGeaendert(dok({}), dok({ updatedAt: 'x' }))).toBeNull();
    const alt = dok({ id: 'doc-antrag-M-1', memberDocType: undefined });
    expect(unterlageGeaendert(alt, { ...alt, memberDocType: 'aufnahmeantrag' })).toBeNull();
  });
});
