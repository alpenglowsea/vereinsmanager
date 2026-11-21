/**
 * Zahlen der Dashboard-Kacheln (P26/P27), wie Android `Dashboard.kt` und
 * `MemberAnalytics.kt`. Die Kacheln rechnen damit wie die zugehörigen Seiten:
 * - D-134 Jahres-Saldo, § 64, Sphären und Cashflow aus der EÜR-Rechnung
 *   (aufgeteilte Buchungen Teil für Teil, Umbuchungen zählen nicht),
 * - D-132 Grenze je Kalenderjahr (`wgbGrenze`),
 * - D-135 Sparten, Alter und Geschlecht nur der aktuellen Mitglieder,
 * - D-136 Jahres-Soll mit Zahlrhythmus,
 * - D-137 offen = gestellt und nicht bezahlt; Entwürfe und Stornierte weder
 *   Forderung noch abgerechnet,
 * - D-138 „heute“ als lokales Datum,
 * - D-139 Alter auf den Tag genau,
 * - D-133/D-141 Geburtstage und Mitgliedsjubiläen der nächsten 30 Tage,
 * - D-142 nächste Termine auch aus Serien.
 */
import {
  CalendarEvent,
  ClubDocument,
  ClubInvoice,
  Meeting,
  ClubContact,
  DonationReceipt,
  FinancialAccount,
  Member,
  SpecialCalendarItem,
  Transaction
} from '../types';
import { Euer, berechneEuer } from '../services/buchungsBerichte';
import { MonatsSumme, berechne as finanzAuswertung } from '../services/finanzAuswertung';
import { istUeberfaellig } from '../services/rechnungsRegeln';
import { Vorkommen, besondereTage, vorkommen } from './kalenderRegeln';

/** Mitgliedsjubiläen, die das Dashboard hervorhebt (wie Android). */
export const JUBILAEEN = new Set([10, 25, 40, 50]);
export const VORSCHAU_TAGE = 30;

const cent = (v: number) => Math.round((Number(v) || 0) * 100);
const euro = (c: number) => c / 100;
const prozent = (n: number, gesamt: number) => (gesamt > 0 ? Math.round((n / gesamt) * 100) : 0);

/** JJJJ-MM-TT plus n Tage (ohne Zeitzone). */
export function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tage von `von` bis `bis` (beides JJJJ-MM-TT). */
export const tageBis = (von: string, bis: string) => Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86400000);

// ---------- Mitglieder (wie Android MemberAnalytics)

/** Aktuelle Mitglieder: nicht gekündigt und nicht vom Typ „ausgetreten“. */
export const aktuelle = (members: Member[]) =>
  members.filter(m => m.status !== 'terminated' && m.membershipType !== 'ausgetreten' && (m.membershipType as string) !== 'terminated');

const faktor = (p?: string) => (p === 'monthly' ? 12 : p === 'quarterly' ? 4 : p === 'half_yearly' ? 2 : 1);

/** Jahres-Soll aller nicht gekündigten Mitglieder mit Zahlrhythmus (D-136). */
export const jahresSoll = (members: Member[]) =>
  euro(members.filter(m => m.status !== 'terminated').reduce((s, m) => s + cent(m.feeAmount || 0) * faktor(m.feePeriod), 0));

export interface SpartenZeile {
  name: string;
  anzahl: number;
  prozent: number;
}

/** Kopfzahl je Sparte, größte zuerst; Prozent bezogen auf die aktuellen Mitglieder (D-135). */
export function sparten(members: Member[]): SpartenZeile[] {
  const cur = aktuelle(members);
  const zahl = new Map<string, number>();
  for (const m of cur) zahl.set(m.department || '', (zahl.get(m.department || '') || 0) + 1);
  return Array.from(zahl.entries())
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e[1] - a.e[1] || a.i - b.i)
    .map(({ e: [name, n] }) => ({ name: name || '(ohne Sparte)', anzahl: n, prozent: prozent(n, cur.length) }));
}

export interface Anteil {
  schluessel: string;
  bezeichnung: string;
  anzahl: number;
  prozent: number;
}

const GRUPPEN: [string, string][] = [
  ['kids', 'Kinder (0–13 Jahre)'],
  ['teens', 'Jugendliche (14–17 Jahre)'],
  ['adults', 'Erwachsene (18–59 Jahre)'],
  ['seniors', 'Senioren (ab 60 Jahre)'],
  ['unknown', 'Ohne Geburtsdatum']
];

/** Alter am Tag `heute`, auf den Tag genau (D-139); null ohne lesbares Geburtsdatum. */
export function alter(geburt: string | undefined, heute: string): number | null {
  const g = /^(\d{4})-(\d{2})-(\d{2})/.exec(geburt || '');
  if (!g) return null;
  const [hj, hm, ht] = heute.split('-').map(Number);
  let a = hj - Number(g[1]);
  if (hm < Number(g[2]) || (hm === Number(g[2]) && ht < Number(g[3]))) a--;
  return a;
}

export function altersgruppen(members: Member[], heute: string): Anteil[] {
  const cur = aktuelle(members);
  const z = new Map(GRUPPEN.map(([k]) => [k, 0]));
  for (const m of cur) {
    const a = alter(m.birthDate, heute);
    const k = a === null ? 'unknown' : a <= 13 ? 'kids' : a <= 17 ? 'teens' : a <= 59 ? 'adults' : 'seniors';
    z.set(k, (z.get(k) || 0) + 1);
  }
  return GRUPPEN.map(([k, l]) => ({ schluessel: k, bezeichnung: l, anzahl: z.get(k) || 0, prozent: prozent(z.get(k) || 0, cur.length) }));
}

export interface MitgliederDaten {
  bestand: number;
  aktiv: number;
  passiv: number;
  neuImJahr: number;
  sparten: SpartenZeile[];
  spartenAnzahl: number;
  altersgruppen: Anteil[];
  maenner: number;
  frauen: number;
  divers: number;
  ohneAngabe: number;
  neueste: Member[];
  /** Geburtstage und hervorgehobene Mitgliedsjubiläen der nächsten 30 Tage, heute eingeschlossen (D-133, D-141). */
  anstehend: SpecialCalendarItem[];
}

export function mitglieder(members: Member[], heute: string): MitgliederDaten {
  const cur = aktuelle(members);
  const sp = sparten(members);
  const jahr = heute.slice(0, 4);
  const anstehend = besondereTage(members, heute, plusTage(heute, VORSCHAU_TAGE))
    .filter(b => b.type === 'birthday' || JUBILAEEN.has(b.years))
    .slice(0, 6);
  return {
    bestand: cur.length,
    aktiv: members.filter(m => m.status === 'active').length,
    passiv: members.filter(m => m.status === 'passive').length,
    neuImJahr: members.filter(m => m.status !== 'terminated' && (m.entryDate || '').startsWith(jahr)).length,
    sparten: sp.slice(0, 4),
    spartenAnzahl: sp.length,
    altersgruppen: altersgruppen(members, heute),
    maenner: cur.filter(m => m.gender === 'm').length,
    frauen: cur.filter(m => m.gender === 'w').length,
    divers: cur.filter(m => m.gender === 'd').length,
    ohneAngabe: cur.filter(m => !m.gender || m.gender === 'none').length,
    neueste: cur
      .filter(m => m.entryDate)
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))
      .slice(0, 4),
    anstehend
  };
}

// ---------- Finanzen

export interface FinanzDaten {
  jahr: string;
  euer: Euer;
  monate: MonatsSumme[];
  letzte: Transaction[];
}

/** Laufendes Jahr wie die EÜR-Seite (D-134), Monate wie die Finanz-Auswertung, die fünf neuesten Buchungen. */
export function finanzen(konten: FinancialAccount[], buchungen: Transaction[], heute: string): FinanzDaten {
  const jahr = heute.slice(0, 4);
  return {
    jahr,
    euer: berechneEuer(buchungen, jahr),
    monate: finanzAuswertung(buchungen, konten, { jahr, sphaere: null, kontoId: null }, [], heute).monate,
    letzte: [...buchungen]
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0))
      .slice(0, 5)
  };
}

export interface SepaDaten {
  aktive: number;
  sepa: number;
  unvollstaendig: number;
  jahresSoll: number;
}

export function sepa(members: Member[]): SepaDaten {
  const aktiv = members.filter(m => m.status === 'active');
  const s = aktiv.filter(m => m.paymentMethod === 'sepa');
  return {
    aktive: aktiv.length,
    sepa: s.length,
    unvollstaendig: s.filter(m => !(m.bankDetails?.iban || '').trim() || !(m.bankDetails?.mandateReference || '').trim()).length,
    jahresSoll: jahresSoll(members)
  };
}

export interface SpendenDaten {
  jahr: string;
  summe: number;
  geld: number;
  sach: number;
}

export function spenden(liste: DonationReceipt[], heute: string): SpendenDaten {
  const jahr = heute.slice(0, 4);
  const d = liste.filter(x => (x.date || '').startsWith(jahr));
  return {
    jahr,
    summe: euro(d.reduce((s, x) => s + cent(x.amount), 0)),
    geld: d.filter(x => x.type === 'money').length,
    sach: d.filter(x => x.type !== 'money').length
  };
}

export interface RechnungsDaten {
  offen: number;
  offenAnzahl: number;
  ueberfaellig: number;
  abgerechnet: number;
  bezahlt: number;
  entwuerfe: number;
  gesamt: number;
  neueste: ClubInvoice[];
}

/** D-137: offen = gestellt und nicht bezahlt; Entwürfe und Stornierte zählen weder als Forderung noch als abgerechnet. */
export function rechnungen(liste: ClubInvoice[], heute: string): RechnungsDaten {
  const offen = liste.filter(r => r.status === 'open' || r.status === 'overdue');
  const abger = liste.filter(r => r.status !== 'draft' && r.status !== 'cancelled');
  return {
    offen: euro(offen.reduce((s, r) => s + cent(r.totalAmount), 0)),
    offenAnzahl: offen.length,
    ueberfaellig: offen.filter(r => istUeberfaellig({ ...r, status: 'open' }, heute)).length,
    abgerechnet: euro(abger.reduce((s, r) => s + cent(r.totalAmount), 0)),
    bezahlt: liste.filter(r => r.status === 'paid').length,
    entwuerfe: liste.filter(r => r.status === 'draft').length,
    gesamt: liste.length,
    neueste: [...liste].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')).slice(0, 4)
  };
}

export interface KontaktDaten {
  gesamt: number;
  nachArt: Map<string, number>;
  sponsoren: number;
  partner: number;
  zuletzt: ClubContact[];
}

export function kontakte(liste: ClubContact[]): KontaktDaten {
  const zahl = new Map<string, number>();
  for (const k of liste) for (const t of k.types && k.types.length ? k.types : ['other']) zahl.set(t, (zahl.get(t) || 0) + 1);
  return {
    gesamt: liste.length,
    nachArt: zahl,
    sponsoren: zahl.get('sponsor') || 0,
    partner: zahl.get('partner') || 0,
    zuletzt: [...liste].sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')).slice(0, 4)
  };
}

/** Die nächsten Termine ab heute, auch aus Serien; mehrtägige zählen, solange sie laufen (D-142). */
export const termine = (liste: CalendarEvent[], heute: string, max = 3): Vorkommen[] =>
  vorkommen(liste, heute, plusTage(heute, 366)).slice(0, max);

export interface SitzungsDaten {
  anstehend: Meeting[];
  anstehendAnzahl: number;
  offeneProtokolle: number;
}

/** Anstehend ab heute (lokales Datum, D-138), Abgesagtes nicht. */
export function sitzungen(liste: Meeting[], heute: string): SitzungsDaten {
  const kommend = liste
    .filter(m => (m.date || '') >= heute && m.status !== 'cancelled')
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || ''));
  return {
    anstehend: kommend.slice(0, 3),
    anstehendAnzahl: kommend.length,
    offeneProtokolle: liste.filter(m => m.status === 'draft' || m.status === 'review').length
  };
}

export interface DokumentDaten {
  gesamt: number;
  belege: number;
  vertraege: number;
  protokolle: number;
}

export const dokumente = (liste: ClubDocument[]): DokumentDaten => ({
  gesamt: liste.length,
  belege: liste.filter(d => d.category === 'belege').length,
  vertraege: liste.filter(d => d.category === 'vertraege').length,
  protokolle: liste.filter(d => d.category === 'protokolle').length
});

/**
 * „Gemeinnützig – Freistellungsbescheid vom …“ statt eines Abzeichens ohne Datum (D-140, wie Android).
 * Das Feld in den Einstellungen ist freier Text (meist „15.03.2024“); wie Android zählt jeder
 * eingetragene Text, nur JJJJ-MM-TT wird ins deutsche Format gebracht (T-244).
 */
export const gemeinnuetzigText = (freistellungsDatum?: string): string | null => {
  const d = (freistellungsDatum || '').trim();
  if (!d) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return `Gemeinnützig – Freistellungsbescheid vom ${iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : d}`;
};
