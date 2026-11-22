/**
 * Prüft den Testverein (`testdaten/Testverein.json`): Umfang wie vereinbart,
 * alle Verweise zeigen auf etwas, das es gibt, Nummern sind eindeutig, und
 * jeder Datensatz besteht die Prüfungen, die auch die Eingabemasken der App
 * machen. Zuletzt: Die Datei im Repository ist genau die, die der Generator
 * erzeugt – sonst `npm run testverein` ausführen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { erzeugeTestverein, testvereinAlsJson, TESTVEREIN_JAHRE, TESTVEREIN_STAND, SPARTEN } from './testverein';
import { leseSicherung, SICHERUNGS_BEREICHE } from '../services/backupContents';
import { ibanFehler, bicFehler, emailFehler } from '../utils/kontaktRegeln';
import { pruefeSitzung, vollstaendigUnterschrieben } from '../utils/sitzungRegeln';
import { pruefeTermin } from '../utils/kalenderRegeln';
import { pruefeArtikel } from '../utils/inventarRegeln';

const datei = erzeugeTestverein();
const d = datei.data;

const eindeutig = (werte: string[]) => new Set(werte).size === werte.length;
const ids = <T extends { id: string }>(liste: T[]) => new Set(liste.map(x => x.id));
const cent = (v: number) => Math.round(v * 100);

describe('Testverein: Umfang', () => {
  it('hat die vereinbarten Mengen', () => {
    expect(d.members).toHaveLength(50);
    expect(d.transactions.length).toBeGreaterThanOrEqual(550);
    expect(d.transactions.length).toBeLessThanOrEqual(680);
    expect(d.contacts).toHaveLength(20);
    expect(d.meetings).toHaveLength(10);
    expect(d.inventory).toHaveLength(15);
    expect(d.settings.departments).toEqual([...SPARTEN]);
    for (const j of TESTVEREIN_JAHRE) {
      const termine = d.calendarEvents.filter(e => e.startDate.startsWith(String(j))).length;
      expect(termine, `Termine ${j}`).toBeGreaterThanOrEqual(45);
      expect(termine, `Termine ${j}`).toBeLessThanOrEqual(55);
    }
  });

  it('enthält alle Buchungsarten, auch Spenden und aufgeteilte Buchungen', () => {
    const arten = new Set(d.transactions.map(t => t.type));
    expect([...arten].sort()).toEqual(['expense', 'income', 'transfer']);
    expect(d.transactions.some(t => t.documentNumber.startsWith('SP-'))).toBe(true);
    expect(d.transactions.some(t => t.isSplit && t.splits && t.splits.length > 1)).toBe(true);
  });

  it('hat Sitzungen mit und ohne Beschluss und in verschiedenen Ständen', () => {
    const mitBeschluss = d.meetings.filter(m => m.agenda.some(t => (t.resolutions || []).length > 0));
    expect(mitBeschluss.length).toBeGreaterThan(0);
    expect(mitBeschluss.length).toBeLessThan(d.meetings.length);
    expect(new Set(d.meetings.map(m => m.status)).size).toBeGreaterThanOrEqual(4);
  });

  it('hat Belege nur zu einem Teil der Buchungen und Dokumente nur zu einigen Mitgliedern', () => {
    const mitBeleg = d.transactions.filter(t => t.receipt).length;
    expect(mitBeleg).toBeGreaterThan(0);
    expect(mitBeleg).toBeLessThan(d.transactions.length / 4);
    const mitgliedsDokumente = new Set(d.documents.filter(x => x.memberId).map(x => x.memberId));
    expect(mitgliedsDokumente.size).toBeGreaterThan(0);
    expect(mitgliedsDokumente.size).toBeLessThan(10);
  });

  it('hat Belege, Rechnungen und ausgemusterte Gegenstände mit Foto aus älteren Jahren (zum Archivieren)', () => {
    expect(d.documents.some(x => x.isReceipt && x.date < '2023-01-01')).toBe(true);
    expect(d.documents.some(x => x.id.startsWith('doc-inv-') && x.date < '2024-01-01')).toBe(true);
    expect(d.inventory.some(a => a.condition === 'discarded' && a.photoUrl)).toBe(true);
    expect(d.inventory.filter(a => a.condition === 'discarded').every(a => a.retiredAt)).toBe(true);
  });

  it('hat nach dem Stichtag keine Buchungen', () => {
    expect(d.transactions.every(t => t.date <= TESTVEREIN_STAND)).toBe(true);
  });
});

describe('Testverein: Verweise', () => {
  const mitglieder = ids(d.members);
  const buchungen = ids(d.transactions);
  const konten = ids(d.accounts);
  const kontakte = ids(d.contacts);
  const ordner = ids(d.folders);
  const artikel = ids(d.inventory);
  const kategorien = ids(d.calendarCategories);

  it('Buchungen zeigen auf vorhandene Konten; Teilbeträge ergeben den Betrag', () => {
    for (const t of d.transactions) {
      expect(konten.has(t.accountId), t.id).toBe(true);
      if (t.type === 'transfer') expect(konten.has(t.targetAccountId!), t.id).toBe(true);
      if (t.type === 'expense') expect(t.amount).toBeLessThan(0);
      if (t.type !== 'expense') expect(t.amount).toBeGreaterThan(0);
      expect(Math.abs(t.amount * 100 - cent(t.amount)), `${t.id}: ganze Cent`).toBeLessThan(1e-6);
      if (t.isSplit) {
        expect(t.splits!.reduce((s, x) => s + cent(x.amount), 0), t.id).toBe(cent(Math.abs(t.amount)));
      }
    }
  });

  it('kein Konto rutscht ins Minus', () => {
    const stand = new Map(d.accounts.map(a => [a.id, cent(a.initialBalance)]));
    for (const t of [...d.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
      if (t.type === 'transfer') {
        stand.set(t.accountId, stand.get(t.accountId)! - cent(t.amount));
        stand.set(t.targetAccountId!, stand.get(t.targetAccountId!)! + cent(t.amount));
      } else {
        stand.set(t.accountId, stand.get(t.accountId)! + cent(t.amount));
      }
      for (const [k, v] of stand) expect(v, `${k} am ${t.date}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('jeder Kontakt kommt in Buchungen oder Rechnungen vor (über den genauen Namen)', () => {
    const partner = new Set(d.transactions.map(t => t.partner));
    const empfaenger = new Set(d.invoices.map(r => r.recipientId));
    for (const k of d.contacts) {
      expect(partner.has(k.displayName) || empfaenger.has(k.id), k.displayName).toBe(true);
    }
    for (const r of d.invoices) expect(kontakte.has(r.recipientId!), r.id).toBe(true);
  });

  it('Rechnungen, Spenden und SEPA-Läufe zeigen auf ihre Buchungen', () => {
    for (const r of d.invoices) {
      if (r.status === 'paid') {
        const t = d.transactions.find(x => x.id === r.linkedTransactionId);
        expect(t, r.invoiceNumber).toBeDefined();
        expect(cent(t!.amount)).toBe(cent(r.totalAmount));
      } else {
        expect(r.linkedTransactionId).toBeUndefined();
      }
    }
    for (const s of d.donations) {
      if (s.type === 'money') expect(buchungen.has(s.transactionId!), s.receiptNumber).toBe(true);
      else expect(s.transactionId).toBeUndefined();
      if (s.memberId) expect(mitglieder.has(s.memberId)).toBe(true);
    }
    for (const lauf of d.sepaRuns) {
      expect(lauf.items.length).toBeGreaterThan(0);
      for (const p of lauf.items) expect(mitglieder.has(p.memberId)).toBe(true);
      const gebucht = d.transactions.filter(t => t.documentNumber.startsWith(`SEPA-${lauf.targetYear}-`));
      expect(gebucht).toHaveLength(lauf.items.length);
      expect(gebucht.reduce((s, t) => s + cent(t.amount), 0)).toBe(cent(lauf.totalAmount));
    }
  });

  it('Dokumente und Ordner hängen richtig zusammen', () => {
    for (const o of d.folders) if (o.parentId) expect(ordner.has(o.parentId), o.id).toBe(true);
    for (const x of d.documents) {
      expect(ordner.has(x.folderId!), x.id).toBe(true);
      if (x.transactionId) expect(buchungen.has(x.transactionId), x.id).toBe(true);
      if (x.memberId) expect(mitglieder.has(x.memberId), x.id).toBe(true);
      expect(x.dataUrl.startsWith(`data:${x.fileType};base64,`), x.id).toBe(true);
    }
    for (const t of d.transactions.filter(x => x.receipt)) {
      expect(d.documents.some(x => x.id === `doc-receipt-${t.id}`), t.id).toBe(true);
    }
    for (const r of d.invoices) if (r.documentId) expect(d.documents.some(x => x.id === r.documentId)).toBe(true);
    for (const s of d.donations) if (s.documentId) expect(d.documents.some(x => x.id === s.documentId)).toBe(true);
  });

  it('Inventar-Ausgaben, Termine und Sitzungen nennen vorhandene Mitglieder', () => {
    for (const a of d.memberInventory) {
      expect(mitglieder.has(a.memberId)).toBe(true);
      expect(artikel.has(a.inventoryItemId)).toBe(true);
    }
    for (const e of d.calendarEvents) {
      expect(kategorien.has(e.categoryId), e.id).toBe(true);
      for (const p of e.participants) expect(mitglieder.has(p.memberId), e.id).toBe(true);
    }
    for (const m of d.meetings) for (const a of m.attendees) if (a.memberId) expect(mitglieder.has(a.memberId)).toBe(true);
  });
});

describe('Testverein: Nummern und Formate', () => {
  it('Kennungen und Nummern sind eindeutig', () => {
    const bereiche = [d.members, d.transactions, d.accounts, d.auditLogs, d.inventory, d.memberInventory, d.sepaRuns, d.documents, d.folders, d.donations, d.contacts, d.invoices, d.meetings, d.calendarEvents];
    for (const b of bereiche) expect(eindeutig(b.map(x => x.id))).toBe(true);
    expect(eindeutig(d.members.map(m => m.memberNumber))).toBe(true);
    expect(eindeutig(d.transactions.map(t => t.documentNumber))).toBe(true);
    expect(d.transactions.every(t => t.documentNumber.trim() !== '')).toBe(true);
    expect(eindeutig(d.donations.map(s => s.receiptNumber))).toBe(true);
    expect(eindeutig(d.invoices.map(r => r.invoiceNumber))).toBe(true);
    expect(eindeutig(d.contacts.map(k => k.contactNumber))).toBe(true);
    expect(eindeutig(d.inventory.map(a => a.itemNumber))).toBe(true);
  });

  it('IBAN, BIC und E-Mail-Adressen sind gültig', () => {
    const ibans = [
      ...d.members.map(m => m.bankDetails.iban),
      ...d.contacts.map(k => k.bankDetails?.iban ?? ''),
      ...d.accounts.map(a => a.iban ?? ''),
      ...d.sepaRuns.flatMap(l => l.items.map(p => p.iban)),
      d.settings.creditorIban ?? ''
    ];
    for (const i of ibans) expect(ibanFehler(i), i).toBeNull();
    for (const m of d.members) {
      expect(bicFehler(m.bankDetails.bic)).toBeNull();
      expect(emailFehler(m.email)).toBeNull();
      expect(emailFehler(m.guardianEmail ?? '')).toBeNull();
      if (m.paymentMethod === 'sepa') expect(m.bankDetails.iban).not.toBe('');
    }
    for (const k of d.contacts) expect(emailFehler(k.email), k.displayName).toBeNull();
  });

  it('alle Adressen und Namen sind erfunden (Beispiel-Domains)', () => {
    const mails = [...d.members.flatMap(m => [m.email, m.guardianEmail ?? '']), ...d.contacts.map(k => k.email), d.settings.email].filter(Boolean);
    for (const m of mails) expect(m.endsWith('.example') || m.endsWith('@example.org'), m).toBe(true);
  });
});

describe('Testverein: besteht die Prüfungen der Eingabemasken', () => {
  it('Sitzungen', () => {
    for (const m of d.meetings) {
      expect(pruefeSitzung(m), m.title).toEqual({});
      if (m.status === 'approved') expect(vollstaendigUnterschrieben(m), m.title).toBe(true);
    }
  });

  it('Termine', () => {
    for (const e of d.calendarEvents) {
      const r = e.recurrence;
      const fehler = pruefeTermin({
        titel: e.title,
        beginn: e.startDate,
        ende: e.endDate,
        ganztaegig: e.isAllDay,
        beginnZeit: e.startTime ?? '',
        endeZeit: e.endTime ?? '',
        serie: !!r && r.frequency !== 'none',
        frequenz: r?.frequency ?? 'none',
        intervall: r?.interval ?? 1,
        wochentage: r?.daysOfWeek ?? [],
        endeArt: r?.endType ?? 'never',
        bis: r?.untilDate ?? '',
        anzahl: r?.count ?? ''
      });
      expect(fehler, e.title + ' ' + e.startDate).toEqual({});
    }
  });

  it('Inventar', () => {
    const betrag = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
    for (const a of d.inventory) {
      const fehler = pruefeArtikel(
        {
          id: a.id,
          name: a.name,
          nummer: a.itemNumber,
          menge: String(a.quantity),
          art: a.category,
          zustand: a.condition,
          kaufpreis: betrag(a.purchasePrice),
          zeitwert: betrag(a.currentValue),
          kaufdatum: a.purchaseDate ?? '',
          letztePruefung: a.lastCheckedDate ?? '',
          naechstePruefung: a.nextInspectionDate ?? '',
          foto: a.photoUrl ?? '',
          ausgemustertAm: a.retiredAt ?? '',
          heute: TESTVEREIN_STAND
        },
        d.inventory
      );
      expect(fehler, a.name).toEqual({});
    }
  });
});

describe('Testverein: Datei', () => {
  it('wird von der App als Sicherung erkannt, mit allen Bereichen', () => {
    const { kopf, daten } = leseSicherung(testvereinAlsJson());
    expect(kopf.clubName).toBe('TSV Testhausen 1921 e.V.');
    for (const s of Object.keys(SICHERUNGS_BEREICHE)) expect(daten[s as keyof typeof daten], s).toBeDefined();
  });

  it('fällt bei jedem Erzeugen gleich aus', () => {
    expect(testvereinAlsJson()).toBe(testvereinAlsJson());
  });

  it('liegt im Repository in der aktuellen Fassung (sonst „npm run testverein“)', () => {
    const imRepo = readFileSync(resolve(process.cwd(), 'testdaten', 'Testverein.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(imRepo === testvereinAlsJson()).toBe(true);
  });
});
