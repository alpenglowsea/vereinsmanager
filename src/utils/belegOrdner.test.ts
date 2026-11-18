import { describe, it, expect } from 'vitest';
import { planeBelegOrdner, BELEG_HAUPTORDNER_ID } from './belegOrdner';
import type { DocumentFolder } from '../types';

const ordner = (o: Partial<DocumentFolder>): DocumentFolder =>
  ({ id: 'x', name: 'x', parentId: null, createdAt: '', updatedAt: '', ...o }) as DocumentFolder;

const HAUPT = ordner({ id: 'folder-belege', name: 'Buchhaltungsbelege & Finanzen' });
const B2026 = ordner({ id: 'folder-belege-2026', name: 'Belege 2026', parentId: 'folder-belege' });

describe('Ordner für Buchungsbelege', () => {
  it('nimmt den vorhandenen Jahresordner', () => {
    expect(planeBelegOrdner([HAUPT, B2026], '2026-03-01')).toEqual({ zielId: 'folder-belege-2026', neu: [] });
  });

  it('legt einen fehlenden Jahresordner unter dem Hauptordner an', () => {
    const { zielId, neu } = planeBelegOrdner([HAUPT, B2026], '2027-01-15', 'T');
    expect(zielId).toBe('folder-belege-2027');
    expect(neu).toHaveLength(1);
    const [o] = neu;
    expect([o.id, o.name, o.parentId, o.category]).toEqual(['folder-belege-2027', 'Belege 2027', 'folder-belege', 'belege']);
  });

  it('legt beide Ordner an, wenn noch keiner existiert', () => {
    const { zielId, neu } = planeBelegOrdner([], '2026-05-05', 'T');
    expect(zielId).toBe('folder-belege-2026');
    expect(neu.map(o => [o.id, o.name, o.parentId ?? null])).toEqual([
      [BELEG_HAUPTORDNER_ID, 'Buchhaltungsbelege & Finanzen', null],
      ['folder-belege-2026', 'Belege 2026', BELEG_HAUPTORDNER_ID]
    ]);
  });

  it('erkennt einen Hauptordner mit anderer Kennung am Namen', () => {
    const eigen = ordner({ id: 'folder-123', name: 'Buchhaltungsbelege & Finanzen' });
    const jahr = ordner({ id: 'folder-456', name: 'Belege 2026', parentId: 'folder-123' });
    expect(planeBelegOrdner([eigen, jahr], '2026-01-01')).toEqual({ zielId: 'folder-456', neu: [] });
  });

  it('weicht auf eine neue Kennung aus, wenn die übliche schon anders vergeben ist', () => {
    const fremd = ordner({ id: 'folder-belege-2026', name: 'Etwas anderes', parentId: null });
    const { zielId, neu } = planeBelegOrdner([HAUPT, fremd], '2026-01-01', 'T', () => 'folder-neu');
    expect(zielId).toBe('folder-neu');
    expect(neu[0].parentId).toBe('folder-belege');
  });

  it('legt Belege ohne gültiges Datum in den Hauptordner', () => {
    expect(planeBelegOrdner([HAUPT, B2026], '')).toEqual({ zielId: 'folder-belege', neu: [] });
    expect(planeBelegOrdner([HAUPT], 'unbekannt').zielId).toBe('folder-belege');
  });
});
