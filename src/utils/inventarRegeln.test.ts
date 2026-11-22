import { describe, it, expect } from 'vitest';
import { InventoryItem, MemberInventoryAssignment } from '../types';
import {
  ausgebbar,
  ausmusterungsDatum,
  ausgabenVon,
  ausgegeben,
  geprueftAm,
  betragText,
  inventarCsv,
  kennzahlen,
  leseInventarBetrag,
  pruefeArtikel,
  pruefeSammel,
  pruefungBald,
  sichtbar,
  stueckwert,
  ueberfaellig,
  wendeSammelAn,
  wert,
  zurueckgeben
} from './inventarRegeln';

const artikel = (o: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'i1',
  itemNumber: 'INV-001',
  name: 'Ballnetz',
  category: 'sports_equipment',
  department: 'Fußball',
  quantity: 2,
  unit: 'Stk.',
  location: 'Geräteraum',
  condition: 'good',
  createdAt: '',
  updatedAt: '',
  ...o
});

const eingabe = {
  name: 'Ball', nummer: 'INV-002', menge: '1', art: 'sports_equipment', zustand: 'good',
  kaufpreis: '', zeitwert: '', kaufdatum: '', letztePruefung: '', naechstePruefung: '', foto: ''
};

describe('Beträge und Prüfung der Eingaben (D-97)', () => {
  it('deutsche Schreibweise, keine negativen Werte', () => {
    expect(leseInventarBetrag('1.234,50')).toEqual({ wert: 1234.5 });
    expect(leseInventarBetrag('')).toEqual({});
    expect(leseInventarBetrag('-5').fehler).toMatch(/negativ/);
    expect(leseInventarBetrag('abc').fehler).toMatch(/Betrag/);
    expect(betragText(1234.5)).toBe('1.234,50');
  });

  it('Pflichtfelder, doppelte Nummer ohne Groß-/Kleinschreibung, Menge, Foto', () => {
    const e = pruefeArtikel({ ...eingabe, name: ' ', nummer: 'inv-001', menge: '0', zeitwert: '-1', foto: 'data:text/plain,x' }, [artikel()]);
    expect(Object.keys(e).sort()).toEqual(['foto', 'menge', 'name', 'nummer', 'zeitwert']);
    expect(pruefeArtikel({ ...eingabe, id: 'i1', nummer: 'INV-001' }, [artikel()])).toEqual({});
  });
});

describe('Wert und Kennzahlen (D-100, D-101)', () => {
  it('Zeitwert, sonst Anschaffungspreis, mal Menge; 0 € ist ein Wert', () => {
    expect(wert(artikel({ currentValue: 12.5, purchasePrice: 20 }))).toBe(25);
    expect(wert(artikel({ purchasePrice: 20 }))).toBe(40);
    expect(stueckwert(artikel({ currentValue: 0, purchasePrice: 20 }))).toBe(0);
    expect(wert(artikel())).toBe(0);
  });

  it('Ausgemustertes zählt nirgends mit und ist nur über den Zustandsfilter sichtbar', () => {
    const liste = [
      artikel({ currentValue: 10, nextInspectionDate: '2026-01-01' }),
      artikel({ id: 'i2', condition: 'discarded', currentValue: 100, nextInspectionDate: '2026-01-01' }),
      artikel({ id: 'i3', condition: 'damaged', department: 'Tennis', quantity: 1 })
    ];
    expect(kennzahlen(liste, '2026-11-20')).toEqual({ positionen: 2, einheiten: 3, wert: 20, sparten: 2, reparatur: 1, ueberfaellig: 1 });
    expect([sichtbar(liste[1], null), sichtbar(liste[1], 'discarded')]).toEqual([false, true]);
    expect(ausgebbar(liste).map(a => a.id)).toEqual(['i1', 'i3']);
    expect(ueberfaellig(liste[1], '2026-11-20')).toBe(false);
    expect(pruefungBald(artikel({ nextInspectionDate: '2026-12-20' }), '2026-11-20')).toBe(true);
    expect(pruefungBald(artikel({ nextInspectionDate: '2026-12-21' }), '2026-11-20')).toBe(false);
  });
});

describe('Sammelbearbeitung (D-103)', () => {
  it('angehakt und leer leert freiwillige Felder; Standort darf nicht leer sein', () => {
    const a = artikel({ responsiblePerson: 'Max', supplier: 'X', notes: 'alt' });
    const n = wendeSammelAn(a, { responsiblePerson: '', notesValue: 'neu', notesAction: 'append' }, 'jetzt')!;
    expect([n.responsiblePerson, n.supplier, n.notes, n.updatedAt]).toEqual([undefined, 'X', 'alt\nneu', 'jetzt']);
    expect(wendeSammelAn(a, { supplier: 'X' }, 'jetzt')).toBeNull();
    expect(pruefeSammel({ location: ' ' })).toMatch(/Standort/);
    expect(pruefeSammel({})).toMatch(/mindestens/);
    expect(pruefeSammel({ notesValue: '' })).toMatch(/Notiz/);
    expect(pruefeSammel({ assignedTo: '' })).toBeNull();
  });
});

describe('Ausgemustert am (R4)', () => {
  it('heute beim Ausmustern, eingegebenes Datum gilt, vorhandenes bleibt, sonst entfernt', () => {
    expect(ausmusterungsDatum(artikel(), 'discarded', '', '2026-11-22')).toBe('2026-11-22');
    expect(ausmusterungsDatum(artikel(), 'discarded', '2025-03-01', '2026-11-22')).toBe('2025-03-01');
    expect(ausmusterungsDatum(artikel({ condition: 'discarded', retiredAt: '2024-05-05' }), 'discarded', '', '2026-11-22')).toBe('2024-05-05');
    expect(ausmusterungsDatum(artikel({ condition: 'discarded', retiredAt: '2024-05-05' }), 'used', '2024-05-05', '2026-11-22')).toBeUndefined();
    expect(ausmusterungsDatum(null, 'discarded', undefined, '2026-11-22')).toBe('2026-11-22');
  });

  it('Prüfung: gültig, nicht in der Zukunft, nicht vor dem Kauf; ohne Ausmusterung egal', () => {
    const f = { ...eingabe, zustand: 'discarded', kaufdatum: '2020-01-01', heute: '2026-11-22' };
    expect(pruefeArtikel({ ...f, ausgemustertAm: '2026-11-23' }, []).ausgemustertAm).toMatch(/Zukunft/);
    expect(pruefeArtikel({ ...f, ausgemustertAm: '2019-12-31' }, []).ausgemustertAm).toMatch(/Kaufdatum/);
    expect(pruefeArtikel({ ...f, ausgemustertAm: '2026-13-01' }, []).ausgemustertAm).toMatch(/ungültig/);
    expect(pruefeArtikel({ ...f, ausgemustertAm: '2024-06-30' }, [])).toEqual({});
    expect(pruefeArtikel({ ...f, ausgemustertAm: '' }, [])).toEqual({});
    expect(pruefeArtikel({ ...f, zustand: 'used', ausgemustertAm: 'quatsch' }, [])).toEqual({});
  });

  it('Sammelbearbeitung setzt und entfernt das Datum mit dem Zustand', () => {
    const n = wendeSammelAn(artikel(), { condition: 'discarded' }, '2026-11-22T10:00:00.000Z', '2026-11-22')!;
    expect([n.condition, n.retiredAt]).toEqual(['discarded', '2026-11-22']);
    const alt = artikel({ condition: 'discarded', retiredAt: '2023-02-02' });
    expect(wendeSammelAn(alt, { condition: 'discarded' }, 'jetzt', '2026-11-22')).toBeNull();
    const zurueck = wendeSammelAn(alt, { condition: 'used' }, 'jetzt', '2026-11-22')!;
    expect('retiredAt' in zurueck).toBe(false);
  });
});

describe('CSV wie Android (D-102)', () => {
  it('19 Spalten, Punkt als Dezimalzeichen, ausgegebene Stücke', () => {
    const aus: MemberInventoryAssignment[] = [
      { id: 'x', memberId: 'm', inventoryItemId: 'i1', quantity: 2, hasContribution: false, issueDate: '', status: 'issued', createdAt: '', updatedAt: '' },
      { id: 'y', memberId: 'm', inventoryItemId: 'i1', quantity: 5, hasContribution: false, issueDate: '', status: 'returned', createdAt: '', updatedAt: '' }
    ];
    const csv = inventarCsv([artikel({ purchasePrice: 1234.5, notes: 'a\nb; c' })], ausgegeben(aus));
    const [kopf, zeile] = csv.replace('\uFEFF', '').split('\r\n');
    expect(kopf.split(';').length).toBe(19);
    expect(zeile).toBe('INV-001;Ballnetz;Sportgerät;Fußball;2;Stk.;Geräteraum;Guter Zustand;;1234.50;;;;;;;;2;"a b; c"');
    expect(inventarCsv([])).toBe('\uFEFF');
  });
});

describe('Wer hat den Gegenstand (Detailansicht)', () => {
  it('nur nicht zurückgegebene Ausgaben dieses Gegenstands, neueste zuerst; „Heute geprüft“ setzt nur das Datum', () => {
    const aus = (id: string, item: string, datum: string, status: 'issued' | 'returned' = 'issued'): MemberInventoryAssignment =>
      ({ id, memberId: 'm' + id, inventoryItemId: item, quantity: 1, hasContribution: false, issueDate: datum, status, createdAt: '', updatedAt: '' });
    const liste = [aus('a', 'i1', '2026-01-05'), aus('b', 'i1', '2026-03-01'), aus('c', 'i1', '2026-04-01', 'returned'), aus('d', 'i2', '2026-05-01'), aus('e', 'i1', '2026-03-01')];
    expect(ausgabenVon('i1', liste).map(a => a.id)).toEqual(['e', 'b', 'a']);
    const r = zurueckgeben({ ...liste[1], notes: 'x' }, '2026-11-20', 'jetzt');
    expect([r.status, r.returnDate, r.updatedAt, r.notes, r.quantity]).toEqual(['returned', '2026-11-20', 'jetzt', 'x', 1]);
    expect(ausgabenVon('i1', liste.map(a => (a.id === 'b' ? r : a))).map(a => a.id)).toEqual(['e', 'a']);
    const g = geprueftAm(artikel({ nextInspectionDate: '2027-01-01' }), '2026-11-20', 'jetzt');
    expect([g.lastCheckedDate, g.nextInspectionDate, g.updatedAt]).toEqual(['2026-11-20', '2027-01-01', 'jetzt']);
  });
});
