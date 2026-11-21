import { describe, it, expect } from 'vitest';
import { beitragsKonto, beitragsBuchungen, erstlastschriftMitglieder } from './beitragsBuchung';
import type { SepaCollectionItem, SepaRunHistory } from '../types';

const posten = (o: Partial<SepaCollectionItem>): SepaCollectionItem =>
  ({ memberId: 'm1', memberNumber: 'M-1', memberName: 'Muster, Max', accountHolder: 'Max Muster', iban: 'DE89370400440532013000', mandateReference: 'MAND-1', amount: 10, remittanceInfo: 'Beitrag', sequenceType: 'RCUR', isValid: true, selected: true, department: 'Fußball', ...o }) as SepaCollectionItem;

const lauf = (items: SepaCollectionItem[], o: Partial<SepaRunHistory> = {}): SepaRunHistory =>
  ({ id: 'r1', title: 'Lauf', executionDate: '2026-12-01', targetYear: 2026, targetMonth: 12, items, ...o }) as SepaRunHistory;

describe('Beitragslauf verbuchen (D-02)', () => {
  it('bucht auf Konto 40000 im ideellen Bereich', () => {
    expect(beitragsKonto().skrAccount).toBe('40000');
    expect(beitragsKonto().mainCategory.startsWith('40000 - ')).toBe(true);
    const [b] = beitragsBuchungen(lauf([posten({})]), 'acc-1', [], 'jetzt', nr => `tx-${nr}`);
    expect(b).toMatchObject({ type: 'income', amount: 10, sphere: 'ideell', vatRate: 0, skrAccount: '40000', accountId: 'acc-1', documentNumber: 'SEPA-2026-12-M-1', partner: 'Max Muster', department: 'Fußball', date: '2026-12-01' });
  });

  it('lässt ungültige, abgewählte und leere Posten weg', () => {
    const r = lauf([posten({}), posten({ memberNumber: 'M-2', isValid: false }), posten({ memberNumber: 'M-3', selected: false }), posten({ memberNumber: 'M-4', amount: 0 })]);
    expect(beitragsBuchungen(r, 'a', [], 'j', nr => nr).map(b => b.documentNumber)).toEqual(['SEPA-2026-12-M-1']);
  });

  it('vergibt Belegnummern ohne Doppel', () => {
    const r = lauf([posten({})], { targetMonth: undefined });
    expect(beitragsBuchungen(r, 'a', ['SEPA-2026-RUN-M-1'], 'j', nr => nr)[0].documentNumber).toBe('SEPA-2026-RUN-M-1-2');
  });
});

describe('Nach dem ersten Einzug (D-22)', () => {
  it('nennt die Mitglieder mit Erstlastschrift', () => {
    const r = lauf([posten({ memberId: 'a', sequenceType: 'FRST' }), posten({ memberId: 'b' }), posten({ memberId: 'c', sequenceType: 'FRST', isValid: false })]);
    expect(erstlastschriftMitglieder(r)).toEqual(['a']);
  });
});
