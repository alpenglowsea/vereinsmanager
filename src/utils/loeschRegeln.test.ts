import { describe, it, expect } from 'vitest';
import {
  belegDokumentId,
  offeneAusgaben,
  teileInventarAuswahl,
  inventarSperrText,
  buchungenAmKonto,
  planeKontoLoeschen,
  spartenVerwendung,
  spartenSperrText
} from './loeschRegeln';
import type { FinancialAccount, MemberInventoryAssignment, Transaction } from '../types';

const ausgabe = (o: Partial<MemberInventoryAssignment>): MemberInventoryAssignment =>
  ({ id: 'a', memberId: 'm1', inventoryItemId: 'inv1', quantity: 1, status: 'issued', ...o }) as MemberInventoryAssignment;

const konto = (id: string): FinancialAccount => ({ id, name: id }) as FinancialAccount;

const buchung = (o: Partial<Transaction>): Transaction =>
  ({ id: 'tx', type: 'expense', accountId: 'bank', date: '2026-03-01', documentNumber: 'BE-2026-001', ...o }) as Transaction;

describe('Beleg-Dokument einer Buchung', () => {
  it('trägt die Kennung, die saveTransaction vergibt', () => {
    expect(belegDokumentId('tx-123')).toBe('doc-receipt-tx-123');
  });
});

describe('Inventar: noch ausgegebene Gegenstände', () => {
  const ausgaben = [
    ausgabe({ id: 'a1', memberId: 'm1', quantity: 2 }),
    ausgabe({ id: 'a2', memberId: 'm2', quantity: 1 }),
    ausgabe({ id: 'a3', memberId: 'm1', quantity: 5, status: 'returned' }),
    ausgabe({ id: 'a4', inventoryItemId: 'inv2', status: 'returned' })
  ];

  it('zählt nur, was nicht zurückgegeben ist', () => {
    expect(offeneAusgaben('inv1', ausgaben)).toEqual({ ausgaben: 2, stueck: 3, mitglieder: 2 });
    expect(offeneAusgaben('inv2', ausgaben)).toEqual({ ausgaben: 0, stueck: 0, mitglieder: 0 });
    expect(offeneAusgaben('unbekannt', ausgaben)).toEqual({ ausgaben: 0, stueck: 0, mitglieder: 0 });
  });

  it('trennt beim Sammellöschen Löschbares von noch Ausgegebenem', () => {
    expect(teileInventarAuswahl(['inv1', 'inv2', 'inv3'], ausgaben)).toEqual({
      loeschbar: ['inv2', 'inv3'],
      gesperrt: ['inv1']
    });
  });

  it('nennt in der Meldung Mitglieder und Stückzahl', () => {
    const text = inventarSperrText('Trikotsatz', offeneAusgaben('inv1', ausgaben));
    expect(text).toContain('Trikotsatz');
    expect(text).toContain('2 Mitglieder');
    expect(text).toContain('3 Stück');
  });
});

describe('Konto löschen', () => {
  const konten = [konto('bank'), konto('kasse'), konto('paypal')];

  it('lässt ein Konto ohne Buchungen ohne Weiteres löschen', () => {
    const plan = planeKontoLoeschen('paypal', konten, [buchung({})]);
    expect(plan).toEqual({ ok: true, betroffen: 0, geaendert: [] });
  });

  it('lässt das letzte Konto nicht löschen', () => {
    const plan = planeKontoLoeschen('bank', [konto('bank')], []);
    expect(plan.ok).toBe(false);
  });

  it('verlangt ein anderes Konto, wenn Buchungen am Konto hängen', () => {
    const buchungen = [buchung({ id: 't1' }), buchung({ id: 't2' })];
    for (const ziel of [undefined, null, '', 'bank', 'gibt-es-nicht']) {
      const plan = planeKontoLoeschen('bank', konten, buchungen, ziel);
      expect(plan.ok).toBe(false);
      expect(plan.betroffen).toBe(2);
    }
  });

  it('überträgt Buchungen und Umbuchungen auf das gewählte Konto', () => {
    const buchungen = [
      buchung({ id: 't1', accountId: 'bank' }),
      buchung({ id: 't2', accountId: 'kasse' }),
      buchung({ id: 't3', type: 'transfer', accountId: 'kasse', targetAccountId: 'bank' }),
      buchung({ id: 't4', type: 'transfer', accountId: 'bank', targetAccountId: 'kasse' })
    ];
    const plan = planeKontoLoeschen('bank', konten, buchungen, 'paypal');
    expect(plan.ok).toBe(true);
    expect(plan.betroffen).toBe(3);
    expect(plan.geaendert.map(b => [b.id, b.accountId, b.targetAccountId ?? null])).toEqual([
      ['t1', 'paypal', null],
      ['t3', 'kasse', 'paypal'],
      ['t4', 'paypal', 'kasse']
    ]);
    // die Ausgangsdaten bleiben unverändert
    expect(buchungen[0].accountId).toBe('bank');
  });

  it('verhindert eine Umbuchung von einem Konto auf dasselbe Konto', () => {
    const buchungen = [
      buchung({ id: 't1', accountId: 'bank' }),
      buchung({ id: 't3', type: 'transfer', accountId: 'kasse', targetAccountId: 'bank', documentNumber: 'BE-2026-007' })
    ];
    const plan = planeKontoLoeschen('bank', konten, buchungen, 'kasse');
    expect(plan.ok).toBe(false);
    expect(plan.geaendert).toHaveLength(0);
    expect(plan.fehler).toContain('BE-2026-007');
  });

  it('findet Buchungen auch über das Zielkonto', () => {
    const buchungen = [buchung({ id: 't3', type: 'transfer', accountId: 'kasse', targetAccountId: 'bank' })];
    expect(buchungenAmKonto('bank', buchungen)).toHaveLength(1);
    expect(buchungenAmKonto('paypal', buchungen)).toHaveLength(0);
  });
});

describe('Sparte löschen', () => {
  const mitglieder = [{ department: 'Fußball' }, { department: 'fußball ' }, { department: 'Tennis' }];
  const buchungen = [
    { department: 'Fußball' },
    { department: undefined, splits: [{ department: 'Tennis' }, { department: 'Fußball' }] },
    { department: 'Tennis' }
  ] as Pick<Transaction, 'department' | 'splits'>[];
  const inventar = [{ department: 'Fußball' }, { department: 'Gesamtverein' }];

  it('zählt Mitglieder, Buchungen (auch Teilbuchungen) und Inventar', () => {
    expect(spartenVerwendung('Fußball', mitglieder, buchungen, inventar)).toEqual({
      mitglieder: 2,
      buchungen: 2,
      inventar: 1,
      gesamt: 5
    });
  });

  it('meldet eine unbenutzte Sparte als frei', () => {
    expect(spartenVerwendung('Schach', mitglieder, buchungen, inventar).gesamt).toBe(0);
  });

  it('nennt in der Meldung, wer die Sparte noch nutzt', () => {
    const text = spartenSperrText('Fußball', spartenVerwendung('Fußball', mitglieder, buchungen, inventar));
    expect(text).toContain('2 Mitglieder');
    expect(text).toContain('2 Buchungen');
    expect(text).toContain('1 Inventargegenstand');
  });
});
