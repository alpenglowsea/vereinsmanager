import { describe, it, expect } from 'vitest';
import { wendeSammelAn, sammelHinweis } from './buchungSammel';
import type { Transaction } from '../types';

const buchung = (o: Partial<Transaction>): Transaction =>
  ({
    id: 't',
    type: 'expense',
    amount: -10,
    accountId: 'bank',
    sphere: 'ideell',
    skrAccount: '68100',
    vatRate: 0,
    partner: 'Alt',
    date: '2026-03-01',
    notes: '',
    ...o
  }) as Transaction;

describe('Sammelbearbeitung von Buchungen', () => {
  it('ändert bei einer gewöhnlichen Buchung alle gewählten Felder', () => {
    const r = wendeSammelAn(buchung({}), { sphere: 'wirtschaftlich', skrAccount: '44000', vatRate: 19, accountId: 'kasse' });
    expect(r.geaendert).toBe(true);
    expect([r.buchung.sphere, r.buchung.skrAccount, r.buchung.vatRate, r.buchung.accountId]).toEqual([
      'wirtschaftlich',
      '44000',
      19,
      'kasse'
    ]);
    expect(r.ohneZuordnung).toBe(false);
  });

  it('lässt Sphäre, Konto des Kontenrahmens und USt einer Umbuchung unverändert', () => {
    const tx = buchung({ type: 'transfer', targetAccountId: 'kasse', sphere: undefined, skrAccount: undefined });
    const r = wendeSammelAn(tx, { sphere: 'wirtschaftlich', skrAccount: '44000', vatRate: 19, partner: 'Neu' });
    expect(r.ohneZuordnung).toBe(true);
    expect(r.buchung.sphere).toBeUndefined();
    expect(r.buchung.skrAccount).toBeUndefined();
    // der Zahlungspartner gilt trotzdem
    expect(r.buchung.partner).toBe('Neu');
    expect(r.geaendert).toBe(true);
  });

  it('lässt die Zuordnung einer aufgeteilten Buchung unverändert', () => {
    const tx = buchung({ isSplit: true, splits: [{ id: 's1' }, { id: 's2' }] as Transaction['splits'] });
    const r = wendeSammelAn(tx, { department: 'Fußball', vatRate: 7 });
    expect(r.ohneZuordnung).toBe(true);
    expect(r.geaendert).toBe(false);
    expect(r.buchung.vatRate).toBe(0);
  });

  it('verhindert eine Umbuchung von einem Konto auf dasselbe', () => {
    const tx = buchung({ type: 'transfer', accountId: 'bank', targetAccountId: 'kasse' });
    const r = wendeSammelAn(tx, { accountId: 'kasse' });
    expect(r.kontoUebersprungen).toBe(true);
    expect(r.buchung.accountId).toBe('bank');
    expect(r.geaendert).toBe(false);
    // auf ein drittes Konto geht es
    expect(wendeSammelAn(tx, { accountId: 'paypal' }).buchung.accountId).toBe('paypal');
  });

  it('meldet keine Änderung, wenn alles schon so ist', () => {
    const r = wendeSammelAn(buchung({}), { sphere: 'ideell', accountId: 'bank' });
    expect(r.geaendert).toBe(false);
  });

  it('hängt Notizen an oder ersetzt sie', () => {
    expect(wendeSammelAn(buchung({ notes: 'A' }), { notesAction: 'append', notesValue: ' B ' }).buchung.notes).toBe('A\nB');
    expect(wendeSammelAn(buchung({ notes: 'A' }), { notesAction: 'replace', notesValue: '' }).buchung.notes).toBe('');
  });

  it('verändert die Ausgangsbuchung nicht', () => {
    const tx = buchung({});
    wendeSammelAn(tx, { sphere: 'wirtschaftlich', partner: 'X' });
    expect(tx.sphere).toBe('ideell');
    expect(tx.partner).toBe('Alt');
  });

  it('formuliert einen Hinweis nur, wenn etwas übersprungen wurde', () => {
    expect(sammelHinweis({ geaendert: 3, ohneZuordnung: 0, kontoUebersprungen: 0 })).toBeNull();
    const text = sammelHinweis({ geaendert: 3, ohneZuordnung: 2, kontoUebersprungen: 1 });
    expect(text).toContain('2 Buchungen');
    expect(text).toContain('einer Umbuchung');
  });
});
