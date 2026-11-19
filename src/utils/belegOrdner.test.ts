import { describe, it, expect } from 'vitest';
import { planeBelegOrdner, BELEG_HAUPTORDNER_ID, planeUnterordner, belegArtVon, sollEinsortiertWerden } from './belegOrdner';
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

describe('Unterordner für Spenden und Rechnungen (D-40, D-47)', () => {
  const haupt: DocumentFolder = { id: 'folder-belege', name: 'Buchhaltungsbelege & Finanzen', parentId: null, category: 'belege', createdAt: '', updatedAt: '' } as DocumentFolder;
  const jahr: DocumentFolder = { id: 'folder-belege-2026', name: 'Belege 2026', parentId: 'folder-belege', category: 'belege', createdAt: '', updatedAt: '' } as DocumentFolder;

  it('legt „Spendenbescheinigungen“ unter dem Jahresordner an', () => {
    const r = planeUnterordner([haupt, jahr], '2026-05-01', 'spenden', 'jetzt');
    expect(r.zielId).toBe('folder-belege-2026-spendenbescheinigungen');
    expect(r.neu.map(o => [o.name, o.parentId])).toEqual([['Spendenbescheinigungen', 'folder-belege-2026']]);
  });

  it('legt bei Bedarf alle drei Ebenen an und findet Vorhandenes am Namen', () => {
    const r = planeUnterordner([], '2027-01-02', 'rechnungen', 'jetzt');
    expect(r.neu.map(o => o.name)).toEqual(['Buchhaltungsbelege & Finanzen', 'Belege 2027', 'Ausgangsrechnungen']);
    const vomHandy = { id: 'folder-xyz', name: 'Ausgangsrechnungen', parentId: 'folder-belege-2026' } as DocumentFolder;
    expect(planeUnterordner([haupt, jahr, vomHandy], '2026-03-03', 'rechnungen').zielId).toBe('folder-xyz');
  });

  it('erkennt die Art an der Kennung', () => {
    expect(belegArtVon('doc-don-don-1')).toBe('spenden');
    expect(belegArtVon('doc-inv-inv-1-abc')).toBe('rechnungen');
    expect(belegArtVon('doc-receipt-tx-1')).toBeNull();
  });

  it('sortiert nur ein, was ohne Ordner, im Haupt- oder Jahresordner liegt', () => {
    const eigener = { id: 'f-eigen', name: 'Sponsoring', parentId: 'folder-belege-2026' } as DocumentFolder;
    const alle = [haupt, jahr, eigener];
    expect(sollEinsortiertWerden(undefined, alle)).toBe(true);
    expect(sollEinsortiertWerden('folder-belege', alle)).toBe(true);
    expect(sollEinsortiertWerden('folder-belege-2026', alle)).toBe(true);
    expect(sollEinsortiertWerden('f-eigen', alle)).toBe(false);
    expect(sollEinsortiertWerden('gibt-es-nicht', alle)).toBe(true);
  });
});
