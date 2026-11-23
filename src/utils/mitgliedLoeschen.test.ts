import { describe, it, expect } from 'vitest';
import type { Member, MemberInventoryAssignment } from '../types';
import { materialBeimLoeschen, moeglicheEmpfaenger, offenesMaterial } from './mitgliedLoeschen';

// Gleiches Verhalten wie android MemberStore.loeschen (MaterialChoice.Return / Transfer)
const m = (id: string, vorname: string, nachname: string, status: Member['status'] = 'active'): Member =>
  ({ id, firstName: vorname, lastName: nachname, memberNumber: id.toUpperCase(), status } as Member);
const a = (id: string, memberId: string, status: 'issued' | 'returned' = 'issued'): MemberInventoryAssignment =>
  ({ id, memberId, inventoryItemId: 'inv-' + id, itemName: 'Trikot', quantity: 1, unit: 'Stück', hasContribution: false, issueDate: '2025-01-01', status, createdAt: 'c', updatedAt: 'u' } as MemberInventoryAssignment);

const mitglieder = [m('m1', 'Felix', 'Mayr'), m('m2', 'Anna', 'Berger'), m('m3', 'Otto', 'Alt', 'terminated'), m('m4', 'Lea', 'Zorn')];
const ausgaben = [a('a1', 'm1'), a('a2', 'm1'), a('a3', 'm1', 'returned'), a('a4', 'm2'), a('a5', 'm4')];

describe('Mitglied löschen: Material', () => {
  it('zählt nur noch ausgegebenes Material', () => {
    expect(offenesMaterial(ausgaben, ['m1']).map(x => x.id)).toEqual(['a1', 'a2']);
    expect(offenesMaterial(ausgaben, ['m1', 'm2']).length).toBe(3);
    expect(offenesMaterial(ausgaben, ['m3']).length).toBe(0);
  });

  it('Empfänger: ohne Ausgetretene und ohne die Gelöschten, nach Name', () => {
    expect(moeglicheEmpfaenger(mitglieder, ['m1']).map(x => x.id)).toEqual(['m2', 'm4']);
  });

  it('zurück ins Inventar: heute zurückgegeben, Verlauf bleibt, kein Protokolleintrag', () => {
    const r = materialBeimLoeschen(ausgaben, [mitglieder[0]], { art: 'zurueck' }, mitglieder, '2026-11-23', 'T');
    expect(r.zurueckgegeben).toBe(2);
    expect(r.geaendert.map(x => [x.id, x.status, x.returnDate, x.memberId])).toEqual([
      ['a1', 'returned', '2026-11-23', 'm1'],
      ['a2', 'returned', '2026-11-23', 'm1']
    ]);
    expect(r.protokoll).toEqual([]);
  });

  it('übertragen: Material geht über, Empfänger bekommt einen Eintrag je gelöschtem Mitglied', () => {
    const r = materialBeimLoeschen(ausgaben, [mitglieder[0], mitglieder[1]], { art: 'uebertragen', zielId: 'm4' }, mitglieder, '2026-11-23', 'T');
    expect(r.uebertragen).toBe(3);
    expect(r.geaendert.every(x => x.memberId === 'm4' && x.status === 'issued')).toBe(true);
    expect(r.protokoll).toEqual([
      { memberId: 'm4', summary: 'Material übernommen von Felix Mayr (M1): 2 Gegenstand/Gegenstände' },
      { memberId: 'm4', summary: 'Material übernommen von Anna Berger (M2): 1 Gegenstand/Gegenstände' }
    ]);
  });

  it('übertragen auf ein Mitglied, das selbst gelöscht wird oder fehlt: Fehler', () => {
    expect(() => materialBeimLoeschen(ausgaben, [mitglieder[0], mitglieder[1]], { art: 'uebertragen', zielId: 'm2' }, mitglieder, 'h', 'T')).toThrow();
    expect(() => materialBeimLoeschen(ausgaben, [mitglieder[0]], { art: 'uebertragen', zielId: 'gibtsnicht' }, mitglieder, 'h', 'T')).toThrow();
  });
});
