import { describe, it, expect } from 'vitest';
import { CalendarEvent, ClubDocument, ClubInvoice, FinancialAccount, Member, Meeting, Transaction } from '../types';
import { wgbGrenze } from '../services/buchungsBerichte';
import { alter, dokumente, finanzen, gemeinnuetzigText, mitglieder, plusTage, rechnungen, sepa, sitzungen, termine } from './dashboardRegeln';

// Gleiche Beispieldaten und Erwartungen wie Android DashboardTest
const heute = '2026-11-14';

const mitglied = (
  id: string,
  o: Partial<{ status: string; geb: string; eintritt: string; sparte: string; zahlart: string; beitrag: number; periode: string; iban: string; mandat: string; geschlecht: string; typ: string }> = {}
): Member =>
  ({
    id, memberNumber: id, firstName: `V${id}`, lastName: `N${id}`, status: o.status ?? 'active', membershipType: o.typ ?? 'full',
    department: o.sparte ?? 'Fußball', entryDate: o.eintritt ?? '2020-01-01', birthDate: o.geb ?? '', gender: o.geschlecht ?? 'm',
    paymentMethod: o.zahlart ?? 'sepa', feeAmount: o.beitrag ?? 10, feePeriod: o.periode ?? 'monthly',
    bankDetails: { iban: o.iban ?? 'DE89370400440532013000', mandateReference: o.mandat ?? 'MR-1' }
  }) as unknown as Member;

const buchung = (id: string, date: string, amount: number, sphere = 'ideell', type = 'income'): Transaction =>
  ({
    id, date, amount, type, accountId: 'k1', sphere, vatRate: 0, documentNumber: '', bookingText: '', partner: '', department: '',
    mainCategory: '', subCategory: '', category: '', createdAt: '', updatedAt: ''
  }) as unknown as Transaction;

const konten = [{ id: 'k1', name: 'Giro', accountType: 'bank', initialBalance: 100, color: '', createdAt: '' } as FinancialAccount];

describe('Dashboard: Zahlen wie Android (P26)', () => {
  it('Freigrenze je Kalenderjahr (D-132)', () => {
    expect([wgbGrenze('2025'), wgbGrenze('2026'), wgbGrenze('2031')]).toEqual([45000, 50000, 50000]);
    const f = finanzen(konten, [buchung('1', '2026-03-01', 47000, 'wirtschaftlich')], heute);
    expect(f.euer.grenze?.grenze).toBe(50000);
    expect(f.euer.grenze?.ueberschritten).toBe(false);
  });

  it('Mitgliederzahlen nur der aktuellen Mitglieder (D-135)', () => {
    const d = mitglieder(
      [
        mitglied('1', { eintritt: '2026-02-01' }),
        mitglied('2', { status: 'passive' }),
        mitglied('3', { status: 'terminated', sparte: 'Tennis', eintritt: '2026-03-01' }),
        mitglied('4', { sparte: 'Tennis', eintritt: '2025-05-01' })
      ],
      heute
    );
    expect([d.bestand, d.passiv, d.neuImJahr, d.spartenAnzahl, d.maenner]).toEqual([3, 1, 1, 2, 3]);
    expect(d.sparten).toEqual([
      { name: 'Fußball', anzahl: 2, prozent: 67 },
      { name: 'Tennis', anzahl: 1, prozent: 33 }
    ]);
    expect(d.neueste[0].id).toBe('1');
  });

  it('Alter auf den Tag genau (D-139)', () => {
    expect(alter('2008-11-15', heute)).toBe(17); // 18. Geburtstag erst morgen
    expect(alter('2008-11-14', heute)).toBe(18);
    expect(alter('', heute)).toBeNull();
    const g = mitglieder([mitglied('1', { geb: '2008-11-15' }), mitglied('2', { geb: '2008-11-14' }), mitglied('3')], heute).altersgruppen;
    expect(g.map(x => x.anzahl)).toEqual([0, 1, 1, 0, 1]);
  });

  it('Finanzen aus der EÜR-Rechnung, Teilbuchungen und Umbuchungen eingeschlossen (D-134)', () => {
    const geteilt = {
      ...buchung('5', '2026-06-01', 100),
      isSplit: true,
      splits: [
        { id: 't1', amount: 60, sphere: 'ideell', vatRate: 0 },
        { id: 't2', amount: 40, sphere: 'wirtschaftlich', vatRate: 0 }
      ]
    } as unknown as Transaction;
    const f = finanzen(
      konten,
      [
        buchung('1', '2026-03-01', 300),
        buchung('2', '2026-04-01', -50, 'ideell', 'expense'),
        buchung('3', '2025-04-01', 1000),
        buchung('4', '2026-05-01', 20000, 'wirtschaftlich'),
        geteilt,
        { ...buchung('6', '2026-07-01', 500), type: 'transfer', targetAccountId: 'k2' } as Transaction
      ],
      heute
    );
    expect([f.euer.income, f.euer.expense]).toEqual([20400, 50]);
    expect(f.euer.spheres.wirtschaftlich.income).toBe(20040);
    expect(f.monate).toHaveLength(12);
    expect(f.letzte[0].id).toBe('6');
  });

  it('SEPA: Lücken und Jahres-Soll mit Zahlrhythmus (D-136)', () => {
    const d = sepa([
      mitglied('1', { beitrag: 10 }),
      mitglied('2', { iban: '', beitrag: 20 }),
      mitglied('3', { mandat: '' }),
      mitglied('4', { zahlart: 'transfer', beitrag: 60, periode: 'yearly' }),
      mitglied('5', { status: 'passive', beitrag: 15, periode: 'quarterly' }),
      mitglied('6', { status: 'terminated', beitrag: 99 })
    ]);
    expect([d.aktive, d.sepa, d.unvollstaendig]).toEqual([4, 3, 2]);
    expect(d.jahresSoll).toBe(120 + 240 + 120 + 60 + 60);
  });

  it('Rechnungen: Entwürfe und Stornos zählen nicht als Forderung (D-137)', () => {
    const r = (id: string, status: string, totalAmount: number, dueDate: string) =>
      ({ id, invoiceNumber: `R-${id}`, status, totalAmount, date: '2026-10-01', dueDate }) as unknown as ClubInvoice;
    const liste = [r('1', 'open', 100, '2026-11-01'), r('2', 'open', 50, '2026-12-01'), r('3', 'paid', 200, '2026-10-15'), r('4', 'draft', 999, '2026-10-01'), r('5', 'cancelled', 888, '2026-10-01')];
    const d = rechnungen(liste, heute);
    expect([d.offen, d.offenAnzahl, d.ueberfaellig, d.abgerechnet, d.bezahlt, d.entwuerfe, d.gesamt]).toEqual([150, 2, 1, 350, 1, 1, 5]);
    expect(d.neueste).toHaveLength(4);
    expect(rechnungen(liste, '2026-11-01').ueberfaellig).toBe(0); // am Fälligkeitstag noch nicht überfällig
  });

  it('Sitzungen ab heute, Abgesagtes zählt nicht (D-138)', () => {
    const s = (id: string, date: string, status: string) => ({ id, date, status, startTime: '19:00' }) as unknown as Meeting;
    const d = sitzungen([s('1', '2026-11-14', 'planned'), s('2', '2026-11-13', 'planned'), s('3', '2026-12-01', 'cancelled'), s('4', '2026-10-01', 'draft')], heute);
    expect([d.anstehendAnzahl, d.offeneProtokolle, d.anstehend[0].id]).toEqual([1, 1, '1']);
  });

  it('Dokumente nach Kategorie', () => {
    const mk = (category: string) => ({ id: category, category }) as unknown as ClubDocument;
    expect(dokumente(['belege', 'belege', 'vertraege', 'protokolle', 'sonstiges'].map(mk))).toEqual({ gesamt: 5, belege: 2, vertraege: 1, protokolle: 1 });
  });
});

describe('Dashboard: Anzeige wie Android (P27)', () => {
  it('Geburtstag heute und Mitgliedsjubiläen der nächsten 30 Tage (D-133, D-141)', () => {
    const d = mitglieder(
      [
        mitglied('1', { geb: '1990-11-14' }),
        mitglied('2', { geb: '1980-11-20' }),
        mitglied('3', { geb: '1980-12-20' }),
        mitglied('4', { eintritt: '2001-11-18' }),
        mitglied('5', { eintritt: '2013-11-18' }),
        mitglied('6', { status: 'terminated', geb: '1990-11-15' })
      ],
      heute
    );
    expect(d.anstehend.map(b => b.memberId)).toEqual(['1', '4', '2']);
    expect(d.anstehend[0].date).toBe(heute);
    expect([d.anstehend[1].type, d.anstehend[1].years]).toEqual(['anniversary', 25]);
  });

  it('Jahreswechsel und 29. Februar', () => {
    expect(mitglieder([mitglied('1', { geb: '1990-01-05' }), mitglied('2', { geb: '2000-02-29' })], '2026-12-28').anstehend.map(b => b.memberId)).toEqual(['1']);
    expect(mitglieder([mitglied('2', { geb: '2000-02-29' })], '2027-02-27').anstehend.map(b => b.date)).toEqual(['2027-02-28']);
  });

  it('Nächste Termine auch aus Serien (D-142)', () => {
    const t = (id: string, startDate: string, endDate = startDate, serie = false) =>
      ({ id, title: `T${id}`, startDate, endDate, isAllDay: true, recurrence: serie ? { frequency: 'weekly', interval: 1, endType: 'never' } : undefined }) as unknown as CalendarEvent;
    const v = termine([t('a', '2026-11-10', '2026-11-15'), t('b', '2026-11-01'), t('c', '2026-10-01', '2026-10-01', true)], heute);
    expect(v).toHaveLength(3);
    expect(v[0].originalEvent.id).toBe('a');
    expect(v.slice(1).every(x => x.originalEvent.id === 'c')).toBe(true);
  });

  it('„Gemeinnützig“ nur mit Datum des Bescheids (D-140)', () => {
    expect(gemeinnuetzigText('2024-03-15')).toBe('Gemeinnützig – Freistellungsbescheid vom 15.03.2024');
    // So steht es in den Einstellungen (freies Textfeld, T-244)
    expect(gemeinnuetzigText(' 10.01.2024 ')).toBe('Gemeinnützig – Freistellungsbescheid vom 10.01.2024');
    expect(gemeinnuetzigText('   ')).toBeNull();
    expect(gemeinnuetzigText('')).toBeNull();
    expect(gemeinnuetzigText(undefined)).toBeNull();
  });
});

// Prüfung 24.11.2026, A1: Fälligkeit im Rechnungsformular. Vorher ergab 20.03. + 14 Tage den 02.04.,
// weil über die Sommerzeit-Umstellung hinweg Orts- und Weltzeit gemischt wurden.
describe('plusTage (Fälligkeit von Rechnungen)', () => {
  it('zählt Kalendertage, auch über die Zeitumstellungen und Monats-/Jahresgrenzen', () => {
    expect(plusTage('2026-03-20', 14)).toBe('2026-04-03');
    expect(plusTage('2026-03-28', 14)).toBe('2026-04-11');
    expect(plusTage('2027-03-20', 30)).toBe('2027-04-19');
    expect(plusTage('2026-10-20', 14)).toBe('2026-11-03');
    expect(plusTage('2026-12-25', 14)).toBe('2027-01-08');
    expect(plusTage('2028-02-27', 2)).toBe('2028-02-29');
  });
});
