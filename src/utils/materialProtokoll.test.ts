import { describe, it, expect } from 'vitest';
import { MemberInventoryAssignment } from '../types';
import { materialEntfernt, materialGespeichert } from './materialProtokoll';

const aus = (o: Partial<MemberInventoryAssignment> = {}): MemberInventoryAssignment => ({
  id: 'a', memberId: 'm', inventoryItemId: 'inv-7', itemName: 'Trikotsatz', quantity: 2, unit: 'Set',
  hasContribution: false, issueDate: '2026-10-26', status: 'issued', createdAt: '', updatedAt: '', ...o
});

// Gleiche Fälle wie Android MemberMaterialTest.vorgaengeStehenInDerHistorie
describe('Material im Änderungsprotokoll des Mitglieds', () => {
  it('ausgeben, bearbeiten, zurückgeben, wieder ausgeben, entfernen; ohne Änderung kein Eintrag', () => {
    expect(materialGespeichert(null, aus())?.summary).toBe('Material ausgegeben: Trikotsatz (2 Set)');
    const b = materialGespeichert(aus(), aus({ quantity: 3, notes: 'neu' }))!;
    expect(b.summary).toBe('Material bearbeitet: Trikotsatz');
    expect(b.changes.map(c => [c.label, c.oldValue, c.newValue])).toEqual([['Menge', '2', '3'], ['Notiz', '', 'neu']]);
    expect(materialGespeichert(aus(), aus({ status: 'returned', returnDate: '2026-11-20' }))?.summary).toBe('Material zurückgegeben: Trikotsatz (2 Set)');
    expect(materialGespeichert(aus({ status: 'returned' }), aus())?.summary).toBe('Material wieder ausgegeben: Trikotsatz (2 Set)');
    expect(materialEntfernt(aus()).summary).toBe('Material-Verknüpfung entfernt: Trikotsatz (2 Set)');
    expect(materialGespeichert(aus(), aus({ updatedAt: 'x' }))).toBeNull();
    const e = materialGespeichert(aus(), aus({ hasContribution: true, contributionAmount: 12.5, issueDate: '2026-10-20' }))!;
    expect(e.changes.map(c => c.label)).toEqual(['Ausgabedatum', 'Eigenanteil']);
    expect(e.changes[0].newValue).toBe('20.10.2026');
    expect(String(e.changes[1].newValue).replace(/\s/g, ' ')).toBe('12,50 €');
  });
});
