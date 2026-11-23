import { describe, it, expect, beforeEach } from 'vitest';
import { filterAktiv, filterZuruecksetzen, liesGemerkt, setzeGemerkt, vergissAlleFilter } from './gemerkteFilter';

describe('Gemerkte Filter (T-334)', () => {
  beforeEach(() => vergissAlleFilter());

  it('merkt Werte je Liste und kennt den Ausgangswert', () => {
    expect(liesGemerkt('mitglieder', 'suche', '')).toBe('');
    setzeGemerkt('mitglieder', 'suche', 'Meier');
    // zweites Anlegen (Ansicht neu geöffnet) liefert den gemerkten Wert, nicht den Ausgangswert
    expect(liesGemerkt('mitglieder', 'suche', '')).toBe('Meier');
    expect(filterAktiv('mitglieder')).toBe(true);
    expect(filterAktiv('buchungen')).toBe(false);
  });

  it('Zurücksetzen betrifft nur Filter dieser Liste, nicht die Sortierung', () => {
    liesGemerkt('mitglieder', 'status', 'all');
    liesGemerkt('mitglieder', 'sortierung', 'number', false);
    liesGemerkt('buchungen', 'jahr', 'all');
    setzeGemerkt('mitglieder', 'status', 'active');
    setzeGemerkt('mitglieder', 'sortierung', 'name');
    setzeGemerkt('buchungen', 'jahr', '2025');
    filterZuruecksetzen('mitglieder');
    expect(liesGemerkt('mitglieder', 'status', 'all')).toBe('all');
    expect(liesGemerkt('mitglieder', 'sortierung', 'number', false)).toBe('name');
    expect(filterAktiv('mitglieder')).toBe(false);
    expect(liesGemerkt('buchungen', 'jahr', 'all')).toBe('2025');
  });

  it('nur Sortierung geändert: kein aktiver Filter', () => {
    liesGemerkt('dokumente', 'sortBy', 'date_desc', false);
    setzeGemerkt('dokumente', 'sortBy', 'title');
    expect(filterAktiv('dokumente')).toBe(false);
  });
});
