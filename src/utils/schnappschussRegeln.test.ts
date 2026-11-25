import { describe, it, expect } from 'vitest';
import { schnappschuesseZuLoeschen, taeglicherFaellig, schnappschussGruppe } from './schnappschussRegeln';

const k = (id: string, timestamp: string, reason: 'startup' | 'periodic' | 'manual' | 'pre_update') => ({ id, timestamp, reason });

describe('Schnappschüsse am Desktop', () => {
  it('behält die 3 neuesten täglichen und die 2 neuesten anderen', () => {
    const liste = [
      k('t1', '2026-11-20T08:00:00Z', 'startup'), k('t2', '2026-11-21T08:00:00Z', 'startup'),
      k('t3', '2026-11-22T08:00:00Z', 'periodic'), k('t4', '2026-11-23T08:00:00Z', 'startup'),
      k('m1', '2026-11-20T09:00:00Z', 'manual'), k('m2', '2026-11-21T09:00:00Z', 'manual'), k('m3', '2026-11-22T09:00:00Z', 'pre_update')
    ];
    expect(schnappschuesseZuLoeschen(liste).sort()).toEqual(['m1', 't1']);
    expect(schnappschuesseZuLoeschen(liste.slice(0, 2))).toEqual([]);
    expect(schnappschussGruppe('periodic')).toBe('taeglich');
    expect(schnappschussGruppe('pre_update')).toBe('andere');
  });

  it('ein täglicher ist fällig, wenn es keinen gibt oder der letzte über 20 Stunden alt ist', () => {
    const jetzt = new Date('2026-11-25T08:00:00Z');
    expect(taeglicherFaellig([], jetzt)).toBe(true);
    // Ein Schnappschuss vor einer Änderung zählt nicht als täglicher
    expect(taeglicherFaellig([k('m', '2026-11-25T07:00:00Z', 'manual')], jetzt)).toBe(true);
    expect(taeglicherFaellig([k('t', '2026-11-24T13:00:00Z', 'startup')], jetzt)).toBe(false);
    expect(taeglicherFaellig([k('t', '2026-11-24T12:00:00Z', 'startup')], jetzt)).toBe(true);
  });
});
