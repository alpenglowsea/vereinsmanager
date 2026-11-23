/**
 * Testverein zum Ausprobieren (Runde 2, R2).
 *
 * Baut einen erfundenen Verein, den „TSV Testhausen 1921 e.V.“, mit Daten
 * von Anfang 2022 bis November 2026: 50 Mitglieder in drei Sparten, rund
 * 600 Buchungen (Beiträge, Spenden, Rechnungen, laufende Ausgaben,
 * Umbuchungen), 20 Kontakte, je Jahr etwa 50 Termine, 10 Sitzungen,
 * 15 Inventargegenstände und einige Dokumente.
 *
 * Das Ergebnis hat genau die Form einer Datensicherung der Desktop-Fassung
 * und wird von `npm run testverein` als `testdaten/Testverein.json`
 * gespeichert. Man spielt es in der App ein wie jede andere Sicherung.
 *
 * Warum ein Programm statt einer von Hand geschriebenen Datei?
 * - Die Datensätze entstehen, wo es sie gibt, mit denselben Funktionen wie
 *   in der App (Beitragslauf, Spendenbuchung, Rechnungsbuchung, Belegordner,
 *   Unterschrift). Ändert sich dort etwas, zieht der Testverein mit.
 * - Es gibt keinen Zufall: Ein fester Startwert erzeugt immer dieselbe
 *   Datei. Der Test `testverein.test.ts` prüft, dass die Datei im
 *   Repository zum Programm passt.
 *
 * Alle Namen, Adressen, Bankverbindungen und Nummern sind erfunden. Die
 * IBANs haben eine gültige Prüfziffer (sonst meldet die App Fehler), die
 * Bankleitzahl 99999999 ist aber ausgedacht. E-Mail-Adressen und Webseiten
 * enden auf example.org bzw. .example – diese Namen sind für Beispiele
 * reserviert und gehören niemandem.
 */
import type {
  Address,
  BankDetails,
  CalendarEvent,
  ClubContact,
  ClubDocument,
  ClubInvoice,
  ClubSettings,
  DocumentFolder,
  DonationReceipt,
  EventParticipant,
  FinancialAccount,
  InventoryItem,
  InvoiceItem,
  Meeting,
  MeetingAgendaItem,
  MeetingAttendee,
  MeetingResolution,
  Member,
  MemberAuditLog,
  MemberInventoryAssignment,
  SepaCollectionItem,
  SepaRunHistory,
  TaxSphere,
  Transaction,
  UnterlagenArt
} from '../types';
import { artText, ORDNER_UNTERLAGEN, unterlagenOrdner } from '../utils/unterlagen';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { getInitialFolders } from '../data/initialFolders';
import { DEFAULT_CALENDAR_CATEGORIES } from '../data/initialEvents';
import { DEFAULT_INVOICE_TEMPLATE } from '../data/initialInvoices';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';
import { DEFAULT_DASHBOARD_CONFIG } from '../data/defaultDashboard';
import { spendenBuchung } from '../services/spendenBuchung';
import { beitragsBuchungen } from '../services/beitragsBuchung';
import { berechneSummen, rechnungsBuchung, type EinnahmeKonto } from '../services/rechnungsRegeln';
import { numberToGermanWords } from '../services/donationService';
import { planeBelegOrdner, planeUnterordner } from '../utils/belegOrdner';
import { unterschreibe, ROLLE_LEITUNG, ROLLE_SCHRIFT } from '../utils/sitzungRegeln';
import { Bild, pdfDatei, unterschrift, type Farbe } from './dateien';

/** Bis zu diesem Tag gibt es Buchungen; Termine und eine Sitzung reichen weiter in die Zukunft. */
export const TESTVEREIN_STAND = '2026-11-20';
export const TESTVEREIN_JAHRE = [2022, 2023, 2024, 2025, 2026];
const EXPORTIERT_AM = `${TESTVEREIN_STAND}T12:00:00.000Z`;

export const SPARTEN = ['Fußball', 'Tennis', 'Turnen & Gymnastik'] as const;
type Sparte = (typeof SPARTEN)[number];

const ORT: Pick<Address, 'zip' | 'city' | 'country'> = { zip: '98765', city: 'Testhausen', country: 'Deutschland' };
const BANKNAME = 'Testbank Testhausen';
const BIC = 'TESTDEFFXXX';

// ---------------------------------------------------------------------------
// Fester Zufall (Startwert immer gleich → immer dieselbe Datei)
// ---------------------------------------------------------------------------

function erzeugeZufall(startwert: number) {
  let a = startwert >>> 0;
  const zahl = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    zahl,
    ganz: (von: number, bis: number) => von + Math.floor(zahl() * (bis - von + 1)),
    betrag: (von: number, bis: number) => Math.round((von + zahl() * (bis - von)) * 100) / 100,
    wahl: <T>(liste: readonly T[]): T => liste[Math.floor(zahl() * liste.length)]
  };
}

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

const zwei = (n: number) => String(n).padStart(2, '0');
const tag = (j: number, m: number, t: number) => `${j}-${zwei(m)}-${zwei(t)}`;
const alsDatum = (d: string) => new Date(d + 'T00:00:00Z');
const wochentag = (d: string) => alsDatum(d).getUTCDay();

function plusTage(d: string, n: number): string {
  const x = alsDatum(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function letzterTag(j: number, m: number): string {
  return plusTage(tag(m === 12 ? j + 1 : j, m === 12 ? 1 : m + 1, 1), -1);
}

/** Der n-te Wochentag `wt` (0 = Sonntag) im Monat; n = -1 für den letzten. */
function nterWochentag(j: number, m: number, wt: number, n: number): string {
  if (n > 0) {
    let d = tag(j, m, 1);
    while (wochentag(d) !== wt) d = plusTage(d, 1);
    return plusTage(d, 7 * (n - 1));
  }
  let d = letzterTag(j, m);
  while (wochentag(d) !== wt) d = plusTage(d, -1);
  return d;
}

/** Fällt der Tag auf ein Wochenende, gilt der folgende Montag (für Bankbuchungen). */
function werktag(d: string): string {
  let x = d;
  while (wochentag(x) === 0 || wochentag(x) === 6) x = plusTage(x, 1);
  return x;
}

const zeitstempel = (d: string, stunde = 9) => `${d}T${zwei(stunde)}:00:00.000Z`;
const deutsch = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

// ---------------------------------------------------------------------------
// IBAN mit gültiger Prüfziffer (erfundene Bankleitzahl)
// ---------------------------------------------------------------------------

function iban(kontonummer: number): string {
  const bban = '99999999' + String(kontonummer).padStart(10, '0');
  const ziffern = bban + '1314' + '00'; // D = 13, E = 14
  let rest = 0;
  for (const z of ziffern) rest = (rest * 10 + Number(z)) % 97;
  return `DE${zwei(98 - rest)}${bban}`;
}

// ---------------------------------------------------------------------------
// Kontenrahmen
// ---------------------------------------------------------------------------

interface Konto extends EinnahmeKonto {
  category: string;
  vatRate: 0 | 7 | 19;
}

function konto(code: string, art: 'income' | 'expense'): Konto {
  const haupt = SKR42_STRUCTURE.find(m => m.type === art && m.subCategories.some(s => s.code === code));
  const unter = haupt?.subCategories.find(s => s.code === code);
  if (!haupt || !unter) throw new Error(`Konto ${code} (${art}) fehlt im Kontenrahmen.`);
  const satz = Number(unter.vatRateDefault) || 0;
  return {
    mainCategory: `${haupt.code} - ${haupt.name}`,
    subCategory: unter.label,
    skrAccount: code,
    category: unter.label,
    vatRate: (satz === 7 || satz === 19 ? satz : 0) as 0 | 7 | 19
  };
}

// ---------------------------------------------------------------------------
// Namen
// ---------------------------------------------------------------------------

const VORNAMEN_M = ['Lukas', 'Jonas', 'Maximilian', 'Felix', 'Tobias', 'Stefan', 'Andreas', 'Markus', 'Florian', 'Michael', 'Thomas', 'Paul', 'Leon', 'Elias', 'Benedikt', 'Georg', 'Sebastian', 'Matthias', 'Christian', 'Johann', 'Franz', 'Moritz', 'David', 'Simon'];
const VORNAMEN_W = ['Anna', 'Lena', 'Sophie', 'Julia', 'Katharina', 'Maria', 'Laura', 'Hannah', 'Lisa', 'Sabine', 'Claudia', 'Petra', 'Theresa', 'Johanna', 'Eva', 'Monika', 'Sarah', 'Emma', 'Mia', 'Franziska', 'Veronika', 'Barbara', 'Clara', 'Lea'];
const NACHNAMEN = ['Huber', 'Bauer', 'Wagner', 'Maier', 'Schmid', 'Fischer', 'Weber', 'Hofer', 'Berger', 'Brunner', 'Lechner', 'Wimmer', 'Eder', 'Fuchs', 'Kraus', 'Stadler', 'Winkler', 'Lang', 'Zeller', 'Haas', 'Mayr', 'Pichler', 'Reiter', 'Moser', 'Graf', 'Vogl', 'Hartl', 'Obermeier', 'Kellner', 'Schuster', 'Holzer', 'Bichler', 'Thaler', 'Sommer', 'Ertl', 'Dorfner', 'Rieder', 'Forster', 'Riedl', 'Seitz', 'Gruber', 'Lindner', 'Aigner', 'Steiner', 'Kerscher', 'Hofmann', 'Brandl', 'Seidl', 'Engl', 'Bachmeier'];
const STRASSEN = ['Hauptstraße', 'Bahnhofstraße', 'Kirchweg', 'Lindenallee', 'Am Sportplatz', 'Schulstraße', 'Gartenweg', 'Bergstraße', 'Mühlweg', 'Ahornring', 'Wiesenstraße', 'Birkenweg'];

// ---------------------------------------------------------------------------
// Der Generator
// ---------------------------------------------------------------------------

export interface TestvereinDatei {
  app: string;
  version: string;
  exportedAt: string;
  data: {
    members: Member[];
    transactions: Transaction[];
    accounts: FinancialAccount[];
    auditLogs: MemberAuditLog[];
    inventory: InventoryItem[];
    memberInventory: MemberInventoryAssignment[];
    sepaRuns: SepaRunHistory[];
    documents: ClubDocument[];
    folders: DocumentFolder[];
    donations: DonationReceipt[];
    contacts: ClubContact[];
    invoices: ClubInvoice[];
    invoiceTemplate: typeof DEFAULT_INVOICE_TEMPLATE;
    meetings: Meeting[];
    meetingTemplate: typeof DEFAULT_MEETING_TEMPLATE;
    dashboardConfig: typeof DEFAULT_DASHBOARD_CONFIG;
    calendarEvents: CalendarEvent[];
    calendarCategories: typeof DEFAULT_CALENDAR_CATEGORIES;
    settings: ClubSettings;
  };
}

export function erzeugeTestverein(): TestvereinDatei {
  const z = erzeugeZufall(1921);

  // -------------------------------------------------------------------------
  // Finanzkonten
  // -------------------------------------------------------------------------
  const GIRO = 'acc-main';
  const KASSE = 'acc-cash';
  const TAGESGELD = 'acc-savings';
  const accounts: FinancialAccount[] = [
    { id: GIRO, name: 'Girokonto Testbank', accountType: 'bank', iban: iban(1921001), bic: BIC, initialBalance: 18500, color: '#2563eb', description: 'Hauptkonto des Vereins', createdAt: zeitstempel('2022-01-01'), order: 1 },
    { id: KASSE, name: 'Barkasse Vereinsheim', accountType: 'cash', initialBalance: 250, color: '#f59e0b', description: 'Kasse für Getränke und Feste', createdAt: zeitstempel('2022-01-01'), order: 2 },
    { id: TAGESGELD, name: 'Tagesgeld (Rücklage)', accountType: 'bank', iban: iban(1921002), bic: BIC, initialBalance: 10000, color: '#10b981', description: 'Freie Rücklage nach § 62 AO', createdAt: zeitstempel('2022-01-01'), order: 3 }
  ];

  // -------------------------------------------------------------------------
  // Mitglieder
  // -------------------------------------------------------------------------
  const members: Member[] = [];
  const auditLogs: MemberAuditLog[] = [];
  const vorgaben = { full: 120, reduced: 60, youth: 60, family: 180, supporting: 36 } as const;
  const vergebeneNamen = new Set<string>();

  for (let i = 0; i < 50; i++) {
    const sparte: Sparte = i < 20 ? 'Fußball' : i < 34 ? 'Tennis' : 'Turnen & Gymnastik';
    const weiblich = sparte === 'Fußball' ? i % 5 === 4 : sparte === 'Tennis' ? i % 2 === 0 : i % 4 !== 1;
    const minderjaehrig = (sparte === 'Fußball' && i % 4 === 0) || (sparte === 'Turnen & Gymnastik' && i % 5 === 0) || i === 27;
    // Ohne Startwert: Die Schleife läuft mindestens einmal und setzt beide.
    let vorname: string;
    let nachname: string;
    do {
      vorname = z.wahl(weiblich ? VORNAMEN_W : VORNAMEN_M);
      nachname = z.wahl(NACHNAMEN);
    } while (vergebeneNamen.has(vorname + nachname));
    vergebeneNamen.add(vorname + nachname);

    const geburt = minderjaehrig
      ? tag(z.ganz(2010, 2016), z.ganz(1, 12), z.ganz(1, 28))
      : tag(z.ganz(1950, 2003), z.ganz(1, 12), z.ganz(1, 28));
    // Eintritt: nicht vor dem 6. Geburtstag; einige erst in den Testjahren.
    const fruehestes = Math.max(1990, Number(geburt.slice(0, 4)) + 6);
    const spaet = i % 6 === 5;
    const eintrittsjahr = spaet ? z.ganz(2022, 2026) : z.ganz(fruehestes, Math.max(fruehestes, 2021));
    let eintritt = tag(eintrittsjahr, z.ganz(1, 12), 1);
    if (eintritt > '2026-10-01') eintritt = '2026-10-01';

    const nummer = `M-${String(101 + i).padStart(4, '0')}`;
    const ehren = i === 2 || i === 40;
    const passiv = i === 7 || i === 23;
    const austritt = i === 15 ? '2024-12-31' : i === 30 ? '2025-06-30' : i === 45 ? '2023-12-31' : undefined;
    const typ: Member['membershipType'] = ehren
      ? 'honorary'
      : minderjaehrig
        ? 'youth'
        : passiv
          ? 'supporting'
          : i % 9 === 3
            ? 'family'
            : i % 7 === 6
              ? 'reduced'
              : 'full';
    const zahlart: Member['paymentMethod'] = ehren ? 'exempt' : i % 11 === 5 ? 'transfer' : i % 17 === 8 ? 'cash' : 'sepa';
    const beitrag = ehren ? 0 : vorgaben[typ as keyof typeof vorgaben];
    const elternteil = minderjaehrig ? `${z.wahl(i % 2 ? VORNAMEN_W : VORNAMEN_M)} ${nachname}` : '';
    const inhaber = minderjaehrig ? elternteil : `${vorname} ${nachname}`;
    const bank: BankDetails =
      zahlart === 'sepa'
        ? {
            iban: iban(5000000 + i * 137),
            bic: BIC,
            bankName: BANKNAME,
            accountHolder: inhaber,
            mandateDate: eintritt,
            mandateReference: `MANDAT-${nummer}`,
            mandateSequenceType: 'RCUR'
          }
        : { iban: '', bic: '', bankName: '', accountHolder: '', mandateDate: '', mandateReference: '' };
    const mail = (v: string, n: string) =>
      `${v}.${n}@example.org`.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

    const m: Member = {
      id: `mem-${nummer}`,
      memberNumber: nummer,
      firstName: vorname,
      lastName: nachname,
      gender: weiblich ? 'w' : 'm',
      birthDate: geburt,
      nationality: 'deutsch',
      address: { street: z.wahl(STRASSEN), houseNumber: String(z.ganz(1, 48)), ...ORT },
      phone: `09999 ${z.ganz(10000, 99999)}`,
      email: minderjaehrig ? '' : mail(vorname, nachname),
      entryDate: eintritt,
      ...(austritt ? { exitDate: austritt } : {}),
      status: austritt ? 'terminated' : ehren ? 'honorary' : passiv ? 'passive' : 'active',
      department: sparte,
      membershipType: typ,
      feeAmount: beitrag,
      feePeriod: ehren ? 'none' : 'yearly',
      paymentMethod: zahlart,
      bankDetails: bank,
      notes: ehren ? 'Ehrenmitglied seit der Jahreshauptversammlung, beitragsfrei.' : passiv ? 'Passives Mitglied (Fördermitglied).' : '',
      dataPrivacyConsent: true,
      ...(minderjaehrig
        ? {
            isMinor: true,
            guardianName: elternteil,
            guardianRelation: i % 2 ? 'Mutter' : 'Vater',
            guardianPhone: `0170 ${z.ganz(1000000, 9999999)}`,
            guardianEmail: mail(elternteil.split(' ')[0], nachname)
          }
        : {}),
      createdAt: zeitstempel(eintritt < '2022-01-01' ? '2022-01-01' : eintritt),
      updatedAt: zeitstempel(austritt && austritt < TESTVEREIN_STAND ? austritt : eintritt < '2022-01-01' ? '2022-01-01' : eintritt)
    };
    members.push(m);

    if (eintritt >= '2022-01-01') {
      auditLogs.push({
        id: `log-${nummer}-neu`,
        memberId: m.id,
        memberNumber: nummer,
        memberName: `${vorname} ${nachname}`,
        timestamp: m.createdAt,
        author: 'Admin',
        action: 'create',
        summary: 'Mitglied neu angelegt',
        changes: []
      });
    }
    if (austritt) {
      auditLogs.push({
        id: `log-${nummer}-austritt`,
        memberId: m.id,
        memberNumber: nummer,
        memberName: `${vorname} ${nachname}`,
        timestamp: zeitstempel(austritt),
        author: 'Admin',
        action: 'status_change',
        summary: 'Austritt eingetragen',
        changes: [
          { field: 'status', label: 'Status', oldValue: 'active', newValue: 'terminated' },
          { field: 'exitDate', label: 'Austrittsdatum', oldValue: '', newValue: austritt }
        ]
      });
    }
  }

  // Zwei Geburtstage kurz nach dem Stichtag, damit Dashboard und Kalender
  // beim Ausprobieren im Spätherbst 2026 etwas zeigen (Jahr bleibt gleich).
  members[10].birthDate = `${members[10].birthDate!.slice(0, 4)}-11-28`;
  members[36].birthDate = `${members[36].birthDate!.slice(0, 4)}-12-03`;

  const name = (m: Member) => `${m.firstName} ${m.lastName}`;
  const erwachsen = (m: Member) => !m.isMinor;
  const aktivAm = (m: Member, d: string) => m.entryDate <= d && (!m.exitDate || m.exitDate >= d);
  // Vorstand und Übungsleiter: erwachsene, aktive Mitglieder ohne Austritt.
  const kandidaten = members.filter(m => erwachsen(m) && !m.exitDate && m.status === 'active');
  const ausSparte = (s: Sparte, n = 0) => {
    const m = kandidaten.filter(x => x.department === s)[n];
    if (!m) throw new Error(`Zu wenige Mitglieder in der Sparte ${s}.`);
    return m;
  };
  const vorsitz = ausSparte('Fußball', 0);
  const stellvertretung = ausSparte('Tennis', 0);
  const kassier = ausSparte('Turnen & Gymnastik', 0);
  const schrift = ausSparte('Tennis', 1);
  const jugendleitung = ausSparte('Fußball', 1);
  const trainer: Record<Sparte, Member> = {
    Fußball: ausSparte('Fußball', 2),
    Tennis: ausSparte('Tennis', 2),
    'Turnen & Gymnastik': ausSparte('Turnen & Gymnastik', 1)
  };

  // -------------------------------------------------------------------------
  // Kontakte
  // -------------------------------------------------------------------------
  interface KontaktVorlage {
    name: string;
    art: ClubContact['personType'];
    typen: ClubContact['types'];
    rechtsform?: string;
    vorname?: string;
    nachname?: string;
    ansprechpartner?: [string, string, string];
    strasse: string;
    lieferant?: boolean;
    kunde?: boolean;
    notiz?: string;
  }
  const kontaktVorlagen: KontaktVorlage[] = [
    { name: 'Stadt Testhausen', art: 'legal', typen: ['authority'], rechtsform: 'Gebietskörperschaft', ansprechpartner: ['Frau', 'Ingrid Pfeffer', 'Sportamt'], strasse: 'Rathausplatz 1', lieferant: true, notiz: 'Vermieterin der Turnhalle, zahlt den jährlichen Vereinszuschuss.' },
    { name: 'Stadtwerke Testhausen GmbH', art: 'legal', typen: ['supplier'], rechtsform: 'GmbH', ansprechpartner: ['Herr', 'Ralf Kunz', 'Kundenservice'], strasse: 'Werkstraße 4', lieferant: true, notiz: 'Strom und Wasser für Vereinsheim und Platz.' },
    { name: 'Fußballverband Musterland e.V.', art: 'legal', typen: ['association'], rechtsform: 'e.V.', strasse: 'Verbandsweg 10', lieferant: true, notiz: 'Jahresbeitrag der Fußballabteilung.' },
    { name: 'Tennisverband Musterland e.V.', art: 'legal', typen: ['association'], rechtsform: 'e.V.', strasse: 'Verbandsweg 12', lieferant: true, notiz: 'Jahresbeitrag der Tennisabteilung.' },
    { name: 'Turnerbund Musterland e.V.', art: 'legal', typen: ['association'], rechtsform: 'e.V.', strasse: 'Verbandsweg 14', lieferant: true, notiz: 'Jahresbeitrag der Turnabteilung.' },
    { name: 'Getränke Hofmann GmbH', art: 'legal', typen: ['supplier'], rechtsform: 'GmbH', ansprechpartner: ['Herr', 'Bernd Hofmann', 'Geschäftsführer'], strasse: 'Gewerbering 7', lieferant: true, notiz: 'Liefert Getränke für das Vereinsheim.' },
    { name: 'Sporthaus Brandl KG', art: 'legal', typen: ['supplier', 'sponsor'], rechtsform: 'KG', ansprechpartner: ['Frau', 'Nicole Brandl', 'Inhaberin'], strasse: 'Marktplatz 3', lieferant: true, notiz: 'Sportgeräte und Trikots; gewährt 10 % Vereinsrabatt.' },
    { name: 'Vereinsversicherung Süd AG', art: 'legal', typen: ['service'], rechtsform: 'AG', strasse: 'Versicherungsallee 1', lieferant: true, notiz: 'Haftpflicht- und Unfallversicherung des Vereins.' },
    { name: 'Testbank Testhausen', art: 'legal', typen: ['service'], rechtsform: 'eG', ansprechpartner: ['Herr', 'Jürgen Saller', 'Firmenkundenberater'], strasse: 'Bankgasse 2', lieferant: true, notiz: 'Hausbank: Kontoführung, Tagesgeld.' },
    { name: 'Bäckerei Lindner', art: 'legal', typen: ['sponsor'], rechtsform: 'e.K.', ansprechpartner: ['Herr', 'Otto Lindner', 'Inhaber'], strasse: 'Bäckergasse 5', kunde: true, notiz: 'Bandenwerbung am Hauptplatz.' },
    { name: 'Autohaus Kerscher GmbH', art: 'legal', typen: ['sponsor', 'donor'], rechtsform: 'GmbH', ansprechpartner: ['Frau', 'Daniela Kerscher', 'Marketing'], strasse: 'Industriestraße 21', kunde: true, notiz: 'Trikotsponsor der 1. Herren.' },
    { name: 'Physiotherapie Aigner', art: 'legal', typen: ['sponsor', 'partner'], rechtsform: 'Praxis', ansprechpartner: ['Herr', 'Stefan Aigner', 'Inhaber'], strasse: 'Lindenallee 9', kunde: true, notiz: 'Bandenwerbung; betreut verletzte Spieler bevorzugt.' },
    { name: 'Zimmerei Gruber', art: 'legal', typen: ['sponsor', 'donor'], rechtsform: 'e.K.', ansprechpartner: ['Herr', 'Alois Gruber', 'Zimmermeister'], strasse: 'Holzweg 2', kunde: true, notiz: 'Spendet regelmäßig; hat die Holzbänke gestiftet.' },
    { name: 'Volksbank Testhausen eG', art: 'legal', typen: ['sponsor'], rechtsform: 'eG', ansprechpartner: ['Frau', 'Karin Faltermeier', 'Vorstandssekretariat'], strasse: 'Bankgasse 8', kunde: true, notiz: 'Sponsoring-Paket Sommerfest.' },
    { name: 'Bürobedarf Wimmer', art: 'legal', typen: ['supplier'], rechtsform: 'e.K.', strasse: 'Schulstraße 11', lieferant: true },
    { name: 'Elektro Huber GmbH', art: 'legal', typen: ['service'], rechtsform: 'GmbH', ansprechpartner: ['Herr', 'Martin Huber', 'Meister'], strasse: 'Am Bach 6', lieferant: true, notiz: 'Wartet jedes Jahr die Flutlichtanlage.' },
    { name: 'Gasthof zur Post', art: 'legal', typen: ['partner'], rechtsform: 'e.K.', ansprechpartner: ['Frau', 'Rosa Wirth', 'Wirtin'], strasse: 'Hauptstraße 1', notiz: 'Ort der Jahreshauptversammlung.' },
    { name: 'SV Nachbarort e.V.', art: 'legal', typen: ['partner'], rechtsform: 'e.V.', strasse: 'Sportplatzweg 1', lieferant: true, notiz: 'Richtet Turniere aus; Startgelder.' },
    { name: 'Heinz Moser', art: 'natural', typen: ['donor'], vorname: 'Heinz', nachname: 'Moser', strasse: 'Kirchweg 14', notiz: 'Langjähriger Gönner, kein Mitglied.' },
    { name: 'Erika Steiner', art: 'natural', typen: ['donor'], vorname: 'Erika', nachname: 'Steiner', strasse: 'Gartenweg 3', notiz: 'Spendet jedes Jahr zu Weihnachten.' }
  ];

  let kred = 7000;
  let deb = 1000;
  const contacts: ClubContact[] = kontaktVorlagen.map((k, i) => {
    const adresse: Address = { street: k.strasse.replace(/ \d+$/, ''), houseNumber: k.strasse.match(/\d+$/)?.[0] ?? '1', ...ORT };
    const domain = k.name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const c: ClubContact = {
      id: `kon-${zwei(i + 1)}`,
      contactNumber: `K-${1001 + i}`,
      personType: k.art,
      types: k.typen,
      displayName: k.name,
      address: adresse,
      email: k.art === 'natural' ? `${k.vorname}.${k.nachname}@example.org`.toLowerCase() : `info@${domain}.example`,
      phone: `09999 ${2000 + i * 37}`,
      notes: k.notiz ?? '',
      tags: [],
      createdAt: zeitstempel('2022-01-10'),
      updatedAt: zeitstempel('2022-01-10')
    };
    if (k.art === 'legal') {
      c.companyName = k.name;
      if (k.rechtsform) c.legalForm = k.rechtsform;
      c.website = `https://${domain}.example`;
      if (k.ansprechpartner) {
        const [anrede, voll, rolle] = k.ansprechpartner;
        const [v, ...n] = voll.split(' ');
        c.contactPerson = { salutation: anrede, firstName: v, lastName: n.join(' '), roleOrPosition: rolle };
      }
    } else {
      c.firstName = k.vorname;
      c.lastName = k.nachname;
      c.salutation = k.vorname === 'Erika' ? 'Frau' : 'Herr';
    }
    if (k.lieferant) {
      c.creditorOrDebtorNumber = `KRED-${++kred}`;
      c.bankDetails = { iban: iban(8000000 + i * 211), bic: BIC, bankName: BANKNAME, accountHolder: k.name };
    } else if (k.kunde) {
      c.creditorOrDebtorNumber = `DEB-${++deb}`;
    }
    return c;
  });
  const kontakt = (n: string): ClubContact => {
    const c = contacts.find(x => x.displayName === n);
    if (!c) throw new Error(`Kontakt ${n} fehlt.`);
    return c;
  };

  // -------------------------------------------------------------------------
  // Buchungen
  // -------------------------------------------------------------------------
  const transactions: Transaction[] = [];
  /** Buchungen ohne feste Belegnummer bekommen am Ende BE-Jahr-Nr. in Datumsfolge. */
  const ohneNummer = new Set<string>();
  let laufnummer = 0;
  const neueId = () => `tx-${String(++laufnummer).padStart(4, '0')}`;

  interface Eingabe {
    datum: string;
    betrag: number;
    art: 'income' | 'expense';
    code: string;
    kontoId?: string;
    text: string;
    partner: string;
    sphere: TaxSphere;
    sparte?: string;
    notiz?: string;
  }
  function buche(e: Eingabe): Transaction | null {
    if (e.datum > TESTVEREIN_STAND) return null;
    const k = konto(e.code, e.art);
    const betrag = Math.round(Math.abs(e.betrag) * 100) / 100;
    const t: Transaction = {
      id: neueId(),
      date: e.datum,
      amount: e.art === 'expense' ? -betrag : betrag,
      type: e.art,
      accountId: e.kontoId ?? GIRO,
      documentNumber: '',
      bookingText: e.text,
      partner: e.partner,
      sphere: e.sphere,
      ...(e.sparte ? { department: e.sparte } : {}),
      mainCategory: k.mainCategory,
      subCategory: k.subCategory,
      skrAccount: k.skrAccount,
      category: k.category,
      vatRate: k.vatRate,
      ...(e.notiz ? { notes: e.notiz } : {}),
      isSplit: false,
      createdAt: zeitstempel(e.datum, 18),
      updatedAt: zeitstempel(e.datum, 18)
    };
    transactions.push(t);
    ohneNummer.add(t.id);
    return t;
  }

  function umbuchung(datum: string, betrag: number, von: string, nach: string, text: string): void {
    if (datum > TESTVEREIN_STAND || betrag <= 0) return;
    const t: Transaction = {
      id: neueId(),
      date: datum,
      amount: Math.round(betrag * 100) / 100,
      type: 'transfer',
      accountId: von,
      targetAccountId: nach,
      documentNumber: '',
      bookingText: text,
      partner: '',
      sphere: 'ideell',
      category: 'Umbuchung',
      vatRate: 0,
      isSplit: false,
      createdAt: zeitstempel(datum, 18),
      updatedAt: zeitstempel(datum, 18)
    };
    transactions.push(t);
    ohneNummer.add(t.id);
  }

  // --- Beitragsläufe (SEPA, einmal im Jahr im März) und Überweiser/Barzahler
  const sepaRuns: SepaRunHistory[] = [];
  const schonEingezogen = new Set<string>();
  for (const j of TESTVEREIN_JAHRE) {
    const ausfuehrung = werktag(tag(j, 3, 2));
    const items: SepaCollectionItem[] = members
      .filter(m => m.paymentMethod === 'sepa' && m.feeAmount > 0 && aktivAm(m, ausfuehrung))
      .map(m => ({
        memberId: m.id,
        memberNumber: m.memberNumber,
        memberName: name(m),
        accountHolder: m.bankDetails.accountHolder,
        iban: m.bankDetails.iban,
        bic: m.bankDetails.bic,
        bankName: m.bankDetails.bankName,
        mandateReference: m.bankDetails.mandateReference,
        mandateDate: m.bankDetails.mandateDate,
        sequenceType: schonEingezogen.has(m.id) ? 'RCUR' : 'FRST',
        amount: m.feeAmount,
        feePeriod: m.feePeriod,
        department: m.department,
        remittanceInfo: `Mitgliedsbeitrag ${j} ${m.memberNumber} ${name(m)}`,
        endToEndId: `E2E-${j}-${m.memberNumber}`,
        isValid: true,
        validationErrors: [],
        selected: true
      }));
    const lauf: SepaRunHistory = {
      id: `sepa-${j}`,
      title: `Jahresbeitrag ${j}`,
      executionDate: ausfuehrung,
      createdAt: zeitstempel(plusTage(ausfuehrung, -7)),
      totalAmount: Math.round(items.reduce((s, x) => s + x.amount, 0) * 100) / 100,
      totalTransactions: items.length,
      periodFilter: 'yearly',
      targetYear: j,
      bookedToAccountId: GIRO,
      isBooked: true,
      items
    };
    items.forEach(x => schonEingezogen.add(x.memberId));
    sepaRuns.push(lauf);
    transactions.push(
      ...beitragsBuchungen(
        lauf,
        GIRO,
        transactions.map(t => t.documentNumber),
        zeitstempel(ausfuehrung, 18),
        nr => `tx-sepa-${j}-${nr}`
      )
    );

    for (const m of members.filter(x => (x.paymentMethod === 'transfer' || x.paymentMethod === 'cash') && x.feeAmount > 0)) {
      const datum = werktag(tag(j, 3, 10 + (Number(m.memberNumber.slice(-2)) % 15)));
      if (!aktivAm(m, datum)) continue;
      buche({
        datum,
        betrag: m.feeAmount,
        art: 'income',
        code: '40000',
        kontoId: m.paymentMethod === 'cash' ? KASSE : GIRO,
        text: `Mitgliedsbeitrag ${j} ${m.memberNumber}`,
        partner: name(m),
        sphere: 'ideell',
        sparte: m.department,
        notiz: m.paymentMethod === 'cash' ? 'Bar bezahlt im Vereinsheim' : undefined
      });
    }
  }

  // --- Laufende Einnahmen und Ausgaben je Jahr
  const STADT = 'Stadt Testhausen';
  const WERKE = 'Stadtwerke Testhausen GmbH';
  const VERBAND: Record<Sparte, string> = {
    Fußball: 'Fußballverband Musterland e.V.',
    Tennis: 'Tennisverband Musterland e.V.',
    'Turnen & Gymnastik': 'Turnerbund Musterland e.V.'
  };
  const GETRAENKE = 'Getränke Hofmann GmbH';
  const SPORTHAUS = 'Sporthaus Brandl KG';
  const BANK = 'Testbank Testhausen';

  for (const j of TESTVEREIN_JAHRE) {
    const teurer = j >= 2025 ? 1.08 : 1;
    // Ausgaben
    for (let m = 1; m <= 12; m++) {
      buche({ datum: werktag(tag(j, m, 5)), betrag: Math.round(250 * teurer), art: 'expense', code: '62100', text: `Hallenmiete Turnhalle ${zwei(m)}/${j}`, partner: STADT, sphere: 'ideell', sparte: 'Turnen & Gymnastik' });
    }
    for (const m of [2, 5, 8, 11]) {
      buche({ datum: werktag(tag(j, m, 15)), betrag: Math.round(z.betrag(260, 340) * teurer * 100) / 100, art: 'expense', code: '62200', text: `Stromabschlag Vereinsheim ${zwei(m)}/${j}`, partner: WERKE, sphere: 'ideell' });
    }
    for (const m of [6, 12]) {
      buche({ datum: werktag(tag(j, m, 10)), betrag: z.betrag(120, 190), art: 'expense', code: '62300', text: `Wasser/Abwasser ${m === 6 ? '1.' : '2.'} Halbjahr ${j}`, partner: WERKE, sphere: 'ideell' });
    }
    for (const m of [3, 6, 9, 12]) {
      buche({ datum: letzterTag(j, m), betrag: z.betrag(18.5, 24.9), art: 'expense', code: '68500', text: `Kontoführung Quartal ${m / 3}/${j}`, partner: BANK, sphere: 'ideell' });
    }
    buche({ datum: werktag(tag(j, 1, 15)), betrag: Math.round(860 * (1 + (j - 2022) * 0.03)), art: 'expense', code: '68800', text: `Vereinshaftpflicht und Unfallversicherung ${j}`, partner: 'Vereinsversicherung Süd AG', sphere: 'ideell' });
    for (const s of SPARTEN) {
      buche({ datum: werktag(tag(j, 2, 1)), betrag: s === 'Fußball' ? 480 : s === 'Tennis' ? 310 : 260, art: 'expense', code: '66100', text: `Verbandsbeitrag ${j} Abteilung ${s}`, partner: VERBAND[s], sphere: 'ideell', sparte: s });
    }
    for (const m of [3, 6, 9, 12]) {
      for (const s of SPARTEN) {
        const t = trainer[s];
        buche({ datum: letzterTag(j, m), betrag: j >= 2026 ? 275 : 250, art: 'expense', code: '60040', text: `Übungsleiterpauschale Q${m / 3}/${j} (${s})`, partner: name(t), sphere: 'ideell', sparte: s, notiz: 'Steuerfrei nach § 3 Nr. 26 EStG' });
      }
    }
    for (const [m, s] of [[4, 'Fußball'], [7, 'Tennis'], [10, 'Turnen & Gymnastik']] as const) {
      buche({ datum: werktag(tag(j, m, 18)), betrag: z.betrag(180, 650), art: 'expense', code: '65100', text: `Sportgeräte ${s}`, partner: SPORTHAUS, sphere: 'ideell', sparte: s });
    }
    for (const m of [2, 5, 8, 11]) {
      buche({ datum: werktag(tag(j, m, 8)), betrag: z.betrag(380, 640), art: 'expense', code: '51100', text: `Getränkelieferung Vereinsheim ${zwei(m)}/${j}`, partner: GETRAENKE, sphere: 'wirtschaftlich' });
    }
    for (const [m, s] of [[4, 'Fußball'], [6, 'Tennis'], [9, 'Turnen & Gymnastik'], [11, 'Fußball']] as const) {
      buche({ datum: werktag(tag(j, m, 22)), betrag: z.ganz(4, 12) * 10, art: 'expense', code: '66150', text: `Startgeld Turnier ${s}`, partner: 'SV Nachbarort e.V.', sphere: 'ideell', sparte: s });
    }
    for (const m of [2, 6, 10]) {
      buche({ datum: werktag(tag(j, m, 12)), betrag: z.betrag(25, 95), art: 'expense', code: '68100', text: 'Büromaterial und Porto', partner: 'Bürobedarf Wimmer', sphere: 'ideell' });
    }
    buche({ datum: plusTage(nterWochentag(j, 3, 5, -1), 3), betrag: z.betrag(90, 160), art: 'expense', code: '68700', text: `Raummiete und Getränke Jahreshauptversammlung ${j}`, partner: 'Gasthof zur Post', sphere: 'ideell' });
    buche({ datum: werktag(tag(j, 9, 3)), betrag: z.betrag(380, 720), art: 'expense', code: '62500', text: `Wartung Flutlichtanlage ${j}`, partner: 'Elektro Huber GmbH', sphere: 'ideell', sparte: 'Fußball' });

    // Trikots: im August; 2024 als aufgeteilte Buchung (Trikots + Bälle).
    const trikotTag = werktag(tag(j, 8, 20));
    if (j === 2024) {
      const t = buche({ datum: trikotTag, betrag: 1480, art: 'expense', code: '65200', text: 'Trikotsatz und Spielbälle 1. Herren', partner: SPORTHAUS, sphere: 'ideell', sparte: 'Fußball' })!;
      const trikots = konto('65200', 'expense');
      const baelle = konto('65100', 'expense');
      t.isSplit = true;
      t.splits = [
        { id: `split-${t.id}-1`, amount: 1180, bookingText: 'Trikotsatz (18 Stück)', sphere: 'ideell', department: 'Fußball', mainCategory: trikots.mainCategory, subCategory: trikots.subCategory, skrAccount: trikots.skrAccount, category: trikots.category, vatRate: trikots.vatRate },
        { id: `split-${t.id}-2`, amount: 300, bookingText: 'Spielbälle (10 Stück)', sphere: 'ideell', department: 'Fußball', mainCategory: baelle.mainCategory, subCategory: baelle.subCategory, skrAccount: baelle.skrAccount, category: baelle.category, vatRate: baelle.vatRate }
      ];
    } else {
      buche({ datum: trikotTag, betrag: z.betrag(900, 1500), art: 'expense', code: '65200', text: `Trainingsanzüge und Trikots ${j}`, partner: SPORTHAUS, sphere: 'ideell', sparte: z.wahl(SPARTEN) });
    }

    // Einnahmen
    for (let m = 4; m <= 11; m++) {
      buche({ datum: tag(j, m, 28), betrag: z.betrag(240, 480), art: 'income', code: '43150', kontoId: KASSE, text: `Getränkeverkauf Vereinsheim ${zwei(m)}/${j}`, partner: 'Barverkauf Vereinsheim', sphere: 'wirtschaftlich', sparte: 'Fußball' });
    }
    buche({ datum: nterWochentag(j, 7, 6, 2), betrag: z.betrag(700, 1300), art: 'income', code: '43200', kontoId: KASSE, text: `Sommerfest ${j}: Speisen und Getränke`, partner: 'Barverkauf Sommerfest', sphere: 'wirtschaftlich' });
    buche({ datum: nterWochentag(j, 12, 6, 2), betrag: z.betrag(400, 800), art: 'income', code: '43200', kontoId: KASSE, text: `Weihnachtsfeier ${j}: Speisen und Getränke`, partner: 'Barverkauf Weihnachtsfeier', sphere: 'wirtschaftlich' });
    for (const m of [1, 4, 9, 11]) {
      buche({ datum: werktag(tag(j, m, 20)), betrag: z.ganz(8, 14) * 45, art: 'income', code: '41200', text: `Kursgebühren Rückenfit ${m}/${j}`, partner: 'Kursteilnehmer Rückenfit', sphere: 'zweckbetrieb', sparte: 'Turnen & Gymnastik' });
    }
    for (const m of [5, 9]) {
      buche({ datum: werktag(tag(j, m, 25)), betrag: z.ganz(12, 24) * 15, art: 'income', code: '41000', text: `Startgelder Vereinsturnier ${m === 5 ? 'Frühjahr' : 'Herbst'} ${j}`, partner: 'Turnierteilnehmer', sphere: 'zweckbetrieb', sparte: 'Tennis' });
    }
    buche({ datum: werktag(tag(j, 6, 1)), betrag: z.ganz(15, 25) * 100, art: 'income', code: '40720', text: `Vereinszuschuss ${j}`, partner: STADT, sphere: 'ideell' });
    buche({ datum: tag(j, 12, 31), betrag: j === 2022 ? 4.2 : z.betrag(120, 260), art: 'income', code: '47000', kontoId: TAGESGELD, text: `Zinsen Tagesgeld ${j}`, partner: BANK, sphere: 'vermoegen' });

    // Umbuchungen: Bargeld aus der Kasse aufs Girokonto, Rücklage aufs Tagesgeld.
    for (const m of [3, 6, 9, 12]) {
      const bis = tag(j, m, 30);
      const von = tag(j, m - 2, 1);
      const eingang = transactions
        .filter(t => t.accountId === KASSE && t.type === 'income' && t.date >= von && t.date <= bis)
        .reduce((s, t) => s + t.amount, 0);
      umbuchung(bis, Math.floor((eingang * 0.9) / 50) * 50, KASSE, GIRO, 'Bareinzahlung Kasse auf Girokonto');
    }
    umbuchung(werktag(tag(j, 11, 15)), 1000, GIRO, TAGESGELD, `Zuführung freie Rücklage ${j}`);
  }

  // -------------------------------------------------------------------------
  // Spenden mit Zuwendungsbestätigung
  // -------------------------------------------------------------------------
  const settingsVorlauf = {
    taxOffice: 'Finanzamt Testhausen',
    taxNumber: '999/123/45678',
    taxExemptionDate: '14.03.2024',
    taxAssessmentPeriod: '2020 bis 2022',
    promotedPurposes: 'Förderung des Sports (§ 52 Abs. 2 Satz 1 Nr. 21 AO)'
  };
  const donations: DonationReceipt[] = [];
  interface Spende {
    kontakt?: string;
    mitglied?: number;
    datum: string;
    betrag: number;
    sachText?: string;
  }
  const spender: { kontakt?: string; mitglied?: number; monat: number }[] = [
    { kontakt: 'Heinz Moser', monat: 2 },
    { kontakt: 'Zimmerei Gruber', monat: 4 },
    { mitglied: 31, monat: 5 },
    { kontakt: 'Autohaus Kerscher GmbH', monat: 7 },
    { mitglied: 2, monat: 9 },
    { kontakt: 'Erika Steiner', monat: 12 }
  ];
  for (const j of TESTVEREIN_JAHRE) {
    const alle: Spende[] = spender.map(s => ({ kontakt: s.kontakt, mitglied: s.mitglied, datum: werktag(tag(j, s.monat, 6 + s.monat)), betrag: z.ganz(2, 30) * 25 }));
    if (j === 2023) alle.push({ kontakt: 'Zimmerei Gruber', datum: '2023-06-14', betrag: 850, sachText: '4 Holzbänke für den Sportplatz, neu, eigene Fertigung' });
    if (j === 2025) alle.push({ kontakt: 'Sporthaus Brandl KG', datum: '2025-03-19', betrag: 240, sachText: '12 Trainingsbälle Größe 4, neu, aus dem Warenbestand' });
    alle
      .filter(s => s.datum <= TESTVEREIN_STAND)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .forEach((s, i) => {
        const nr = `ZB-${j}-${String(i + 1).padStart(3, '0')}`;
        const mitglied = s.mitglied !== undefined ? members[s.mitglied] : undefined;
        const k = s.kontakt ? kontakt(s.kontakt) : undefined;
        const spenderName = mitglied ? name(mitglied) : k!.displayName;
        const ausgestellt = plusTage(s.datum, 7);
        const r: DonationReceipt = {
          id: `don-${j}-${zwei(i + 1)}`,
          receiptNumber: nr,
          type: s.sachText ? 'goods' : 'money',
          date: s.datum,
          donorType: mitglied ? 'member' : 'external',
          ...(mitglied ? { memberId: mitglied.id } : {}),
          donorName: spenderName,
          donorAddress: mitglied ? mitglied.address : k!.address,
          amount: s.betrag,
          amountInWords: numberToGermanWords(s.betrag),
          isWaiverOfRefund: false,
          ...(s.sachText
            ? { goodsDescription: s.sachText, goodsOrigin: 'business' as const, goodsValuationBasis: 'Rechnungskopie / Einkaufspreis laut Warenwirtschaft' }
            : {}),
          taxOffice: settingsVorlauf.taxOffice,
          taxNumber: settingsVorlauf.taxNumber,
          exemptionDate: settingsVorlauf.taxExemptionDate,
          assessmentPeriod: settingsVorlauf.taxAssessmentPeriod,
          promotedPurpose: settingsVorlauf.promotedPurposes,
          isDirectlyPromoted: true,
          issuedBy: '',
          cityAndDate: `Testhausen, ${deutsch(ausgestellt)}`,
          signed: true,
          createdAt: zeitstempel(ausgestellt),
          updatedAt: zeitstempel(ausgestellt)
        };
        if (!s.sachText) {
          const t = spendenBuchung(r, GIRO, transactions.map(x => x.documentNumber), zeitstempel(s.datum, 18), `tx-don-${r.id}`);
          transactions.push(t);
          r.transactionId = t.id;
        }
        donations.push(r);
      });
  }

  // -------------------------------------------------------------------------
  // Rechnungen an Sponsoren (bezahlte werden mit der App-Funktion verbucht)
  // -------------------------------------------------------------------------
  const invoices: ClubInvoice[] = [];
  interface RechnungsVorlage {
    monat: number;
    kunde: string;
    betreff: string;
    code: string;
    positionen: { text: string; menge: number; einheit: string; preis: number; satz: number }[];
  }
  const rechnungsPlan: RechnungsVorlage[] = [
    { monat: 2, kunde: 'Bäckerei Lindner', betreff: 'Bandenwerbung Hauptplatz', code: '44100', positionen: [{ text: 'Bandenwerbung Hauptplatz, 1 Saison (3 m Bande)', menge: 1, einheit: 'Pauschale', preis: 450, satz: 19 }] },
    { monat: 3, kunde: 'Autohaus Kerscher GmbH', betreff: 'Trikotwerbung 1. Herren', code: '44200', positionen: [{ text: 'Trikotwerbung Brust, 1. Herren, 1 Saison', menge: 1, einheit: 'Pauschale', preis: 1200, satz: 19 }] },
    { monat: 4, kunde: 'Physiotherapie Aigner', betreff: 'Bandenwerbung Nebenplatz', code: '44100', positionen: [{ text: 'Bandenwerbung Nebenplatz, 1 Saison (2 m Bande)', menge: 1, einheit: 'Pauschale', preis: 320, satz: 19 }] },
    {
      monat: 6,
      kunde: 'Volksbank Testhausen eG',
      betreff: 'Sponsoring-Paket Sommerfest',
      code: '44100',
      positionen: [
        { text: 'Werbebanner Sommerfest mit Nennung im Programm', menge: 1, einheit: 'Pauschale', preis: 500, satz: 19 },
        { text: 'Eintrittskarten Sportfest für Mitarbeiter', menge: 20, einheit: 'Stück', preis: 8, satz: 7 }
      ]
    }
  ];
  for (const j of TESTVEREIN_JAHRE) {
    const geplant = [...rechnungsPlan];
    if (j === 2026) {
      geplant.push({ monat: 11, kunde: 'Bäckerei Lindner', betreff: 'Bandenwerbung Hauptplatz 2027', code: '44100', positionen: [{ text: 'Bandenwerbung Hauptplatz, Saison 2027 (3 m Bande)', menge: 1, einheit: 'Pauschale', preis: 480, satz: 19 }] });
    }
    geplant.forEach((v, i) => {
      const datum = j === 2026 && v.monat === 11 ? '2026-11-12' : werktag(tag(j, v.monat, 3));
      const k = kontakt(v.kunde);
      // Preise steigen ab 2024 etwas (auf volle 10 € bzw. 50 Cent gerundet).
      const preis = (p: number) => (p >= 100 ? Math.round((p * (1 + Math.max(0, j - 2023) * 0.04)) / 10) * 10 : p + Math.max(0, j - 2023) * 0.5);
      const items: InvoiceItem[] = v.positionen.map((p, n) => ({
        id: `pos-${j}-${i + 1}-${n + 1}`,
        position: n + 1,
        description: p.text,
        quantity: p.menge,
        unit: p.einheit,
        unitPrice: preis(p.preis),
        vatRate: p.satz,
        totalPrice: Math.round(p.menge * preis(p.preis) * 100) / 100
      }));
      const s = berechneSummen(items, false);
      const nr = `RE-${j}-${String(i + 1).padStart(3, '0')}`;
      const storniert = j === 2025 && v.kunde === 'Physiotherapie Aigner';
      const entwurf = j === 2026 && v.monat === 11;
      const offen = j === 2026 && v.kunde === 'Physiotherapie Aigner';
      const r: ClubInvoice = {
        id: `inv-${j}-${zwei(i + 1)}`,
        invoiceNumber: nr,
        date: datum,
        deliveryDate: datum,
        dueDate: plusTage(datum, 14),
        status: storniert ? 'cancelled' : entwurf ? 'draft' : offen ? 'open' : 'paid',
        recipientType: 'contact',
        recipientId: k.id,
        recipientName: k.displayName,
        recipientCompany: k.displayName,
        ...(k.contactPerson ? { recipientContactPerson: `z. Hd. ${k.contactPerson.salutation} ${k.contactPerson.firstName} ${k.contactPerson.lastName}` } : {}),
        recipientAddress: k.address,
        recipientEmail: k.email,
        title: 'Rechnung',
        subject: v.betreff,
        introText: 'Vielen Dank für Ihre Unterstützung des TSV Testhausen. Wir berechnen Ihnen wie vereinbart:',
        items: s.positionen,
        outroText: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen unter Angabe der Rechnungsnummer.',
        taxSphere: 'wirtschaftlich',
        subtotalNet: s.subtotalNet,
        vatAmounts: s.vatAmounts,
        totalVat: s.totalVat,
        totalAmount: s.totalAmount,
        paymentTermsDays: 14,
        smallBusiness: false,
        ...(storniert ? { notes: 'Storniert: Werbefläche wurde in diesem Jahr nicht genutzt.' } : {}),
        createdAt: zeitstempel(datum),
        updatedAt: zeitstempel(datum)
      };
      if (r.status === 'paid') {
        const bezahlt = werktag(plusTage(datum, 10));
        const t = rechnungsBuchung(
          r,
          { datum: bezahlt, zahlart: 'transfer', buchungAnlegen: true, kontoId: GIRO, konto: konto(v.code, 'income') },
          transactions.map(x => x.documentNumber),
          zeitstempel(bezahlt, 18),
          `tx-inv-${r.id}`
        );
        if (bezahlt <= TESTVEREIN_STAND) {
          transactions.push(t);
          r.paidAt = bezahlt;
          r.paymentMethod = 'transfer';
          r.linkedTransactionId = t.id;
          r.updatedAt = zeitstempel(bezahlt);
        } else {
          r.status = 'open';
        }
      }
      invoices.push(r);
    });
  }

  // -------------------------------------------------------------------------
  // Belegnummern BE-Jahr-Nr. in Datumsfolge vergeben
  // -------------------------------------------------------------------------
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const zaehler = new Map<string, number>();
  for (const t of transactions) {
    if (!ohneNummer.has(t.id)) continue;
    const j = t.date.slice(0, 4);
    const n = (zaehler.get(j) ?? 0) + 1;
    zaehler.set(j, n);
    t.documentNumber = `BE-${j}-${String(n).padStart(3, '0')}`;
  }

  // -------------------------------------------------------------------------
  // Dokumente und Ordner
  // -------------------------------------------------------------------------
  const folders: DocumentFolder[] = getInitialFolders();
  let ordnerNr = 0;
  const neueOrdnerId = () => `folder-test-${++ordnerNr}`;
  const documents: ClubDocument[] = [];
  const ablegen = (plan: { zielId: string; neu: DocumentFolder[] }) => {
    folders.push(...plan.neu);
    return plan.zielId;
  };

  // Belege: nur zu einem Teil der Ausgaben (etwa jede vierte), wie im Alltag.
  transactions
    .filter(t => t.type === 'expense')
    .filter((_, i) => i % 4 === 0)
    .forEach(t => {
      const pdf = pdfDatei(`Beleg ${t.documentNumber}`, [
        `Datum: ${deutsch(t.date)}`,
        `Von: ${t.partner}`,
        `Für: ${t.bookingText}`,
        `Betrag: ${Math.abs(t.amount).toFixed(2).replace('.', ',')} €`
      ]);
      const dateiname = `Beleg_${t.documentNumber}.pdf`;
      t.receipt = { name: dateiname, type: 'application/pdf', size: pdf.groesse, dataUrl: pdf.dataUrl, uploadedAt: t.createdAt };
      documents.push({
        id: `doc-receipt-${t.id}`,
        title: `Beleg: ${t.documentNumber} - ${t.bookingText || t.partner}`,
        fileName: dateiname,
        fileType: 'application/pdf',
        fileSize: pdf.groesse,
        dataUrl: pdf.dataUrl,
        category: 'belege',
        date: t.date,
        uploadDate: t.createdAt,
        tags: ['Beleg', t.sphere, t.category, t.documentNumber].filter(Boolean),
        notes: t.notes || `Buchungsbeleg für ${t.partner} (${t.bookingText})`,
        transactionId: t.id,
        transactionDocNumber: t.documentNumber,
        isReceipt: true,
        folderId: ablegen(planeBelegOrdner(folders, t.date, t.createdAt, neueOrdnerId)),
        createdAt: t.createdAt,
        updatedAt: t.createdAt
      });
    });

  // Rechnungs-PDFs (außer Entwürfen), wie „PDF ablegen“ in der App.
  for (const r of invoices.filter(x => x.status !== 'draft')) {
    const pdf = pdfDatei(`Rechnung ${r.invoiceNumber}`, [
      `An: ${r.recipientName}`,
      `Datum: ${deutsch(r.date)}`,
      `Betreff: ${r.subject}`,
      ...r.items.map(p => `${p.position}. ${p.description}: ${p.totalPrice.toFixed(2).replace('.', ',')} € zzgl. ${p.vatRate} % USt`),
      `Gesamtbetrag: ${r.totalAmount.toFixed(2).replace('.', ',')} €`
    ]);
    const id = `doc-inv-${r.id}`;
    documents.push({
      id,
      title: `Rechnung ${r.invoiceNumber} - ${r.recipientName}`,
      fileName: `Rechnung_${r.invoiceNumber}.pdf`,
      fileType: 'application/pdf',
      fileSize: pdf.groesse,
      dataUrl: pdf.dataUrl,
      category: 'belege',
      date: r.date,
      uploadDate: r.createdAt,
      tags: ['Rechnung', r.invoiceNumber],
      isReceipt: true,
      ...(r.linkedTransactionId ? { transactionId: r.linkedTransactionId, transactionDocNumber: transactions.find(t => t.id === r.linkedTransactionId)?.documentNumber } : {}),
      folderId: ablegen(planeUnterordner(folders, r.date, 'rechnungen', r.createdAt, neueOrdnerId)),
      createdAt: r.createdAt,
      updatedAt: r.createdAt
    });
    r.documentId = id;
  }

  // Zuwendungsbestätigungen ab 2024 als PDF (ältere hat der Verein nur auf Papier).
  for (const r of donations.filter(d => d.date >= '2024-01-01')) {
    const pdf = pdfDatei(`Zuwendungsbestätigung ${r.receiptNumber}`, [
      `Zuwendende Person: ${r.donorName}`,
      `Art: ${r.type === 'goods' ? 'Sachzuwendung' : 'Geldzuwendung'}`,
      `Betrag: ${r.amount.toFixed(2).replace('.', ',')} € (${r.amountInWords})`,
      `Tag der Zuwendung: ${deutsch(r.date)}`
    ]);
    const id = `doc-don-${r.id}`;
    documents.push({
      id,
      title: `Zuwendungsbestätigung: ${r.receiptNumber} - ${r.donorName}`,
      fileName: `Zuwendungsbestaetigung_${r.receiptNumber}_${r.donorName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
      fileType: 'application/pdf',
      fileSize: pdf.groesse,
      dataUrl: pdf.dataUrl,
      category: 'belege',
      date: r.date,
      uploadDate: r.createdAt,
      tags: ['Spendenbescheinigung', 'Zuwendungsbestätigung', r.type === 'goods' ? 'Sachzuwendung' : 'Geldzuwendung', r.receiptNumber, 'BMF-Muster'],
      notes: `${r.type === 'goods' ? 'Sachspende' : 'Geldspende'} über ${r.amount.toFixed(2)} € von ${r.donorName}.`,
      ...(r.transactionId ? { transactionId: r.transactionId } : {}),
      ...(r.memberId ? { memberId: r.memberId } : {}),
      memberName: r.donorName,
      isReceipt: true,
      folderId: ablegen(planeUnterordner(folders, r.date, 'spenden', r.createdAt, neueOrdnerId)),
      createdAt: r.createdAt,
      updatedAt: r.createdAt
    });
    r.documentId = id;
  }

  // Einige Vereinsdokumente.
  const vereinsDokument = (id: string, titel: string, datum: string, ordner: string, kategorie: ClubDocument['category'], zeilen: string[], extra: Partial<ClubDocument> = {}) => {
    const pdf = pdfDatei(titel, zeilen);
    documents.push({
      id,
      title: titel,
      fileName: `${titel.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_')}.pdf`,
      fileType: 'application/pdf',
      fileSize: pdf.groesse,
      dataUrl: pdf.dataUrl,
      category: kategorie,
      folderId: ordner,
      date: datum,
      uploadDate: zeitstempel(datum),
      tags: [],
      createdAt: zeitstempel(datum),
      updatedAt: zeitstempel(datum),
      ...extra
    });
  };
  vereinsDokument('doc-satzung', 'Vereinssatzung (Fassung 2024)', '2024-03-22', 'folder-satzung', 'satzung', ['Satzung des TSV Testhausen 1921 e.V.', 'Beschlossen von der Mitgliederversammlung am 22.03.2024.']);
  vereinsDokument('doc-freistellung', 'Freistellungsbescheid 2020 bis 2022', '2024-03-14', 'folder-bescheide', 'bescheide', ['Finanzamt Testhausen, Steuernummer 999/123/45678', 'Bescheid über Körperschaftsteuer und Gewerbesteuer 2020 bis 2022.']);
  vereinsDokument('doc-hallenvertrag', 'Mietvertrag Turnhalle', '2022-01-10', 'folder-pacht', 'vertraege', ['Mietvertrag zwischen der Stadt Testhausen und dem TSV Testhausen', 'Nutzung der Turnhalle, monatliche Miete laut Anlage.']);
  vereinsDokument('doc-sponsoring-kerscher', 'Sponsoringvertrag Autohaus Kerscher', '2022-02-15', 'folder-sponsoring', 'vertraege', ['Trikotwerbung 1. Herren, jährliche Rechnung im März.']);
  vereinsDokument('doc-uel-vereinbarung', `Übungsleitervereinbarung ${name(trainer.Tennis)}`, '2022-01-05', 'folder-trainer', 'vertraege', ['Übungsleiterpauschale nach § 3 Nr. 26 EStG, quartalsweise Auszahlung.'], { memberId: trainer.Tennis.id, memberName: name(trainer.Tennis) });
  for (const m of members.filter(x => x.entryDate >= '2025-01-01').slice(0, 3)) {
    vereinsDokument(`doc-antrag-${m.memberNumber}`, `Aufnahmeantrag ${name(m)}`, m.entryDate, 'folder-aufnahmeantraege', 'mitglieder', [`Mitgliedsnummer ${m.memberNumber}`, `Eintritt zum ${deutsch(m.entryDate)}, Abteilung ${m.department}`], { memberId: m.id, memberName: name(m) });
  }

  // Unterlagen am Mitglied (Paket U): Lizenzen mit verschiedenen Fristen (eine
  // abgelaufen, eine läuft bald ab, eine lange gültig), ein Erste-Hilfe-Nachweis,
  // ein Einverständnis ohne Frist; dazu zwei Führungszeugnis-Vermerke, einer
  // davon bald fällig. „Bald“ gilt vom Stand 20.11.2026 aus (90 Tage).
  folders.push(unterlagenOrdner(folders, zeitstempel('2022-01-05')));
  const unterlage = (m: Member, art: UnterlagenArt, titel: string, ausgestellt: string, bis?: string) =>
    vereinsDokument(
      `doc-unterlage-${m.memberNumber}-${art}`, titel, ausgestellt, ORDNER_UNTERLAGEN.id, 'mitglieder',
      [`${artText(art)} für ${name(m)} (${m.memberNumber})`, `Ausgestellt am ${deutsch(ausgestellt)}${bis ? `, gültig bis ${deutsch(bis)}` : ''}.`],
      { memberId: m.id, memberName: name(m), memberDocType: art, issuedAt: ausgestellt, ...(bis ? { validUntil: bis } : {}) }
    );
  unterlage(trainer.Fußball, 'trainerlizenz', 'C-Lizenz Fußball', '2023-02-01', '2027-01-31');
  unterlage(trainer.Fußball, 'erste_hilfe', 'Erste-Hilfe-Kurs (9 Unterrichtseinheiten)', '2025-03-08', '2027-03-08');
  unterlage(trainer.Tennis, 'trainerlizenz', 'C-Trainer Tennis Breitensport', '2022-10-01', '2026-09-30');
  unterlage(trainer['Turnen & Gymnastik'], 'trainerlizenz', 'Übungsleiter-C Breitensport', '2024-06-15', '2028-06-14');
  const kindMitFoto = members.find(m => m.isMinor && m.status !== 'terminated');
  if (kindMitFoto) unterlage(kindMitFoto, 'einverstaendnis', 'Einverständnis Fotos und Veröffentlichung', kindMitFoto.entryDate);
  trainer.Fußball.policeCertificate = { certificateDate: '2022-01-10', inspectedAt: '2022-01-17', relevantConviction: false };
  trainer['Turnen & Gymnastik'].policeCertificate = { certificateDate: '2024-05-02', inspectedAt: '2024-05-06', relevantConviction: false };

  // -------------------------------------------------------------------------
  // Inventar
  // -------------------------------------------------------------------------
  const foto = (grund: Farbe, motiv: (b: Bild) => void) => {
    const b = new Bild(96, 72, grund);
    motiv(b);
    return b.alsPng();
  };
  const weiss: Farbe = [250, 250, 250];
  const grau: Farbe = [90, 90, 90];
  const fotos = {
    rasenmaeher: foto([120, 180, 90], b => {
      b.rechteck(24, 26, 48, 22, [200, 40, 40]);
      b.rechteck(30, 48, 10, 10, grau);
      b.rechteck(58, 48, 10, 10, grau);
      b.linie(70, 28, 88, 8, grau, 3);
    }),
    trikots: foto([230, 230, 240], b => {
      b.rechteck(32, 18, 32, 40, [30, 80, 160]);
      b.rechteck(20, 18, 12, 14, [30, 80, 160]);
      b.rechteck(64, 18, 12, 14, [30, 80, 160]);
      b.rechteck(44, 28, 8, 12, weiss);
    }),
    tor: foto([110, 170, 80], b => {
      b.linie(14, 60, 14, 16, weiss, 3);
      b.linie(82, 60, 82, 16, weiss, 3);
      b.linie(14, 16, 82, 16, weiss, 3);
      for (let x = 20; x < 82; x += 8) b.linie(x, 18, x, 60, [220, 220, 220]);
    }),
    defi: foto([240, 240, 240], b => {
      b.rechteck(26, 16, 44, 40, [40, 150, 70]);
      b.linie(40, 36, 56, 36, weiss, 4);
      b.linie(48, 28, 48, 44, weiss, 4);
    })
  };

  interface ArtikelVorlage {
    name: string;
    art: InventoryItem['category'];
    sparte: string;
    menge: number;
    einheit: string;
    ort: string;
    zustand: InventoryItem['condition'];
    kauf: string;
    preis: number;
    zeitwert?: number;
    lieferant?: string;
    pruefung?: [string, string];
    foto?: string;
    notiz?: string;
    seriennummer?: string;
    ausgemustert?: string;
  }
  const artikel: ArtikelVorlage[] = [
    { name: 'Fußballtore 7,32 × 2,44 m (Alu)', art: 'sports_equipment', sparte: 'Fußball', menge: 2, einheit: 'Stk.', ort: 'Hauptplatz', zustand: 'good', kauf: '2019-04-10', preis: 1850, zeitwert: 1200, lieferant: SPORTHAUS, pruefung: ['2026-04-15', '2027-04-15'], foto: fotos.tor, notiz: 'Jährliche Kippsicherheitsprüfung' },
    { name: 'Spielbälle Größe 5', art: 'sports_equipment', sparte: 'Fußball', menge: 20, einheit: 'Stk.', ort: 'Geräteraum Platz', zustand: 'used', kauf: '2024-08-20', preis: 30, zeitwert: 15, lieferant: SPORTHAUS },
    { name: 'Trikotsatz 1. Herren (blau)', art: 'apparel', sparte: 'Fußball', menge: 18, einheit: 'Stk.', ort: 'Kabine 1', zustand: 'good', kauf: '2024-08-20', preis: 65, zeitwert: 50, lieferant: SPORTHAUS, foto: fotos.trikots },
    { name: 'Trikotsatz 1. Herren (alt, 2016)', art: 'apparel', sparte: 'Fußball', menge: 16, einheit: 'Stk.', ort: 'Lager Vereinsheim', zustand: 'discarded', ausgemustert: '2024-09-01', kauf: '2016-07-01', preis: 55, zeitwert: 0, lieferant: SPORTHAUS, foto: fotos.trikots, notiz: 'Ausgemustert nach Kauf des neuen Satzes; Spende an Partnerverein geplant.' },
    { name: 'Tennisnetze', art: 'sports_equipment', sparte: 'Tennis', menge: 4, einheit: 'Stk.', ort: 'Tennisanlage', zustand: 'good', kauf: '2021-04-01', preis: 160, zeitwert: 90, lieferant: SPORTHAUS },
    { name: 'Ballwurfmaschine', art: 'electronics', sparte: 'Tennis', menge: 1, einheit: 'Stk.', ort: 'Tennisanlage, Hütte', zustand: 'in_repair', kauf: '2018-05-12', preis: 1290, zeitwert: 400, seriennummer: 'BWM-55021', notiz: 'Akku defekt, beim Händler zur Reparatur.' },
    { name: 'Leihschläger Tennis (Jugend)', art: 'accessories', sparte: 'Tennis', menge: 6, einheit: 'Stk.', ort: 'Tennisanlage, Hütte', zustand: 'used', kauf: '2022-04-20', preis: 45, zeitwert: 20, lieferant: SPORTHAUS },
    { name: 'Turnmatten 200 × 100 cm', art: 'sports_equipment', sparte: 'Turnen & Gymnastik', menge: 12, einheit: 'Stk.', ort: 'Turnhalle, Geräteraum', zustand: 'good', kauf: '2020-09-15', preis: 140, zeitwert: 80, lieferant: SPORTHAUS },
    { name: 'Sprungkasten 5-teilig', art: 'sports_equipment', sparte: 'Turnen & Gymnastik', menge: 2, einheit: 'Stk.', ort: 'Turnhalle, Geräteraum', zustand: 'good', kauf: '2017-10-01', preis: 690, zeitwert: 300, pruefung: ['2026-01-20', '2027-01-20'] },
    { name: 'Erste-Hilfe-Koffer DIN 13157', art: 'medical', sparte: 'Gesamtverein', menge: 3, einheit: 'Kiste / Koffer', ort: 'Vereinsheim, Kabinen, Turnhalle', zustand: 'good', kauf: '2023-02-01', preis: 59, zeitwert: 59, pruefung: ['2026-02-10', '2026-12-10'], notiz: 'Inhalt auf Verfallsdaten prüfen' },
    { name: 'Defibrillator (AED)', art: 'medical', sparte: 'Gesamtverein', menge: 1, einheit: 'Stk.', ort: 'Vereinsheim, Eingang', zustand: 'good', kauf: '2022-06-30', preis: 1490, zeitwert: 1100, seriennummer: 'AED-TH-0042', pruefung: ['2025-12-03', '2026-12-03'], foto: fotos.defi, notiz: 'Gespendet über Sommerfest-Erlös; Elektroden 2027 tauschen.' },
    { name: 'Bierzeltgarnituren', art: 'furniture', sparte: 'Gesamtverein', menge: 10, einheit: 'Set', ort: 'Lager Vereinsheim', zustand: 'used', kauf: '2015-06-01', preis: 120, zeitwert: 40 },
    { name: 'Musikanlage mit Funkmikrofon', art: 'electronics', sparte: 'Gesamtverein', menge: 1, einheit: 'Set', ort: 'Vereinsheim, Saal', zustand: 'good', kauf: '2021-11-11', preis: 780, zeitwert: 450, seriennummer: 'PA-3307' },
    { name: 'Aufsitzrasenmäher', art: 'facility', sparte: 'Fußball', menge: 1, einheit: 'Stk.', ort: 'Garage Sportplatz', zustand: 'good', kauf: '2023-04-03', preis: 3400, zeitwert: 2600, seriennummer: 'RM-88412', pruefung: ['2026-03-01', '2027-03-01'] },
    { name: 'Rasenmäher (alt)', art: 'facility', sparte: 'Fußball', menge: 1, einheit: 'Stk.', ort: 'Garage Sportplatz', zustand: 'discarded', ausgemustert: '2023-04-03', kauf: '2009-05-01', preis: 1100, zeitwert: 0, foto: fotos.rasenmaeher, notiz: 'Motorschaden 2023, ersetzt durch Aufsitzrasenmäher. Wartet auf Abholung durch Wertstoffhof.' }
  ];
  const inventory: InventoryItem[] = artikel.map((a, i) => ({
    id: `inv-item-${zwei(i + 1)}`,
    itemNumber: `INV-${String(i + 1).padStart(3, '0')}`,
    name: a.name,
    category: a.art,
    department: a.sparte,
    quantity: a.menge,
    unit: a.einheit,
    location: a.ort,
    condition: a.zustand,
    purchaseDate: a.kauf,
    purchasePrice: a.preis,
    ...(a.zeitwert !== undefined ? { currentValue: a.zeitwert } : {}),
    ...(a.lieferant ? { supplier: a.lieferant } : {}),
    responsiblePerson: a.sparte === 'Gesamtverein' ? `${name(vorsitz)} (Vorstand)` : `${name(trainer[a.sparte as Sparte])} (Übungsleitung)`,
    ...(a.seriennummer ? { serialNumber: a.seriennummer } : {}),
    ...(a.notiz ? { notes: a.notiz } : {}),
    ...(a.foto ? { photoUrl: a.foto } : {}),
    ...(a.ausgemustert ? { retiredAt: a.ausgemustert } : {}),
    ...(a.pruefung ? { lastCheckedDate: a.pruefung[0], nextInspectionDate: a.pruefung[1] } : {}),
    createdAt: zeitstempel(a.kauf < '2022-01-01' ? '2022-01-01' : a.kauf),
    updatedAt: zeitstempel(a.ausgemustert ?? (a.kauf < '2022-01-01' ? '2022-01-01' : a.kauf))
  }));

  const trikotsatz = inventory[2];
  const leihschlaeger = inventory[6];
  const fussballer = members.filter(m => m.department === 'Fußball' && !m.exitDate && !m.isMinor && m.status === 'active');
  const tennisJugend = members.filter(m => m.department === 'Tennis' && m.isMinor);
  const ausgabe = (id: string, m: Member, a: InventoryItem, von: string, zurueck?: string, eigenanteil?: number): MemberInventoryAssignment => ({
    id,
    memberId: m.id,
    inventoryItemId: a.id,
    itemName: a.name,
    itemNumber: a.itemNumber,
    quantity: 1,
    unit: a.unit,
    hasContribution: eigenanteil !== undefined,
    ...(eigenanteil !== undefined ? { contributionAmount: eigenanteil } : {}),
    issueDate: von,
    ...(zurueck ? { returnDate: zurueck } : {}),
    status: zurueck ? 'returned' : 'issued',
    createdAt: zeitstempel(von),
    updatedAt: zeitstempel(zurueck ?? von)
  });
  const memberInventory: MemberInventoryAssignment[] = [
    ...fussballer.slice(0, 3).map((m, i) => ausgabe(`mi-${zwei(i + 1)}`, m, trikotsatz, '2024-09-01', undefined, i === 0 ? 20 : undefined)),
    ...(tennisJugend[0]
      ? [ausgabe('mi-04', tennisJugend[0], leihschlaeger, '2025-04-15', '2025-10-01'), ausgabe('mi-05', tennisJugend[0], leihschlaeger, '2026-04-20')]
      : [])
  ];

  // -------------------------------------------------------------------------
  // Termine (je Jahr etwa 50)
  // -------------------------------------------------------------------------
  const calendarEvents: CalendarEvent[] = [];
  let terminNr = 0;
  const teilnehmer = (ms: Member[], d: string, rolle: EventParticipant['role'] = 'participant'): EventParticipant[] =>
    ms
      .filter(m => aktivAm(m, d))
      .map((m, i) => ({
        memberId: m.id,
        memberName: name(m),
        ...(m.email ? { memberEmail: m.email } : {}),
        memberDepartment: m.department,
        role: rolle,
        status: d < TESTVEREIN_STAND ? (i % 5 === 3 ? 'declined' : 'attended') : i % 4 === 2 ? 'invited' : 'confirmed'
      }));
  const termin = (e: Omit<CalendarEvent, 'id' | 'participants' | 'createdAt' | 'updatedAt' | 'endDate' | 'isAllDay'> & { endDate?: string; isAllDay?: boolean; participants?: EventParticipant[] }) => {
    const angelegt = plusTage(e.startDate, -21);
    calendarEvents.push({
      id: `evt-${String(++terminNr).padStart(4, '0')}`,
      ...e,
      endDate: e.endDate ?? e.startDate,
      isAllDay: e.isAllDay ?? false,
      participants: e.participants ?? [],
      createdAt: zeitstempel(angelegt < '2022-01-01' ? '2022-01-01' : angelegt),
      updatedAt: zeitstempel(angelegt < '2022-01-01' ? '2022-01-01' : angelegt)
    });
  };
  const GEGNER = ['SV Nachbarort', 'FC Oberdorf', 'TSV Unterau', 'SpVgg Bergheim', 'DJK Waldkirchen', 'FC Seeblick', 'SC Talhausen'];
  const erster = (d: string, wt: number) => {
    let x = d;
    while (wochentag(x) !== wt) x = plusTage(x, 1);
    return x;
  };

  for (const j of TESTVEREIN_JAHRE) {
    const fussball = members.filter(m => m.department === 'Fußball');
    const tennis = members.filter(m => m.department === 'Tennis');
    const turnen = members.filter(m => m.department === 'Turnen & Gymnastik');

    // Trainingsserien
    termin({ title: 'Training 1. Herren', categoryId: 'cat-training', department: 'Fußball', startDate: erster(tag(j, 1, 8), 2), startTime: '18:30', endTime: '20:00', location: 'Sportplatz Testhausen', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [2, 4], endType: 'until_date', untilDate: tag(j, 12, 18), exceptionDates: [] }, participants: teilnehmer([trainer.Fußball], tag(j, 1, 8), 'trainer') });
    termin({ title: 'Tennistraining Jugend', categoryId: 'cat-training', department: 'Tennis', startDate: erster(tag(j, 4, 15), 3), startTime: '16:30', endTime: '18:00', location: 'Tennisanlage', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [3], endType: 'until_date', untilDate: tag(j, 9, 30) }, participants: teilnehmer([trainer.Tennis], tag(j, 4, 15), 'trainer') });
    termin({ title: 'Gymnastik für alle', categoryId: 'cat-training', department: 'Turnen & Gymnastik', startDate: erster(tag(j, 1, 9), 1), startTime: '19:00', endTime: '20:30', location: 'Turnhalle der Grundschule', recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1], endType: 'until_date', untilDate: tag(j, 12, 15), exceptionDates: [erster(tag(j, 8, 1), 1), plusTage(erster(tag(j, 8, 1), 1), 7)] }, participants: teilnehmer([trainer['Turnen & Gymnastik']], tag(j, 1, 9), 'trainer') });

    // Punktspiele Fußball (Frühjahr und Herbst, sonntags)
    const spielplan: [number, number][] = [[3, 2], [3, 4], [4, 1], [4, 3], [4, -1], [5, 2], [5, 4], [9, 1], [9, 3], [10, 1], [10, 3], [10, -1], [11, 2], [11, 4]];
    spielplan.map(([m, n]) => nterWochentag(j, m, 0, n)).forEach((d, i) => {
      const heim = i % 2 === 0;
      const gegner = GEGNER[(i + j) % GEGNER.length];
      termin({ title: heim ? `TSV Testhausen – ${gegner}` : `${gegner} – TSV Testhausen`, description: heim ? 'Heimspiel, Kabine 1' : 'Auswärtsspiel, Abfahrt 1 Std. vorher am Vereinsheim', categoryId: 'cat-match', department: 'Fußball', startDate: d, startTime: '15:00', endTime: '16:45', location: heim ? 'Sportplatz Testhausen' : `Sportplatz ${gegner.split(' ').slice(1).join(' ')}`, participants: [...teilnehmer([trainer.Fußball], d, 'trainer'), ...teilnehmer(fussball.filter(m => !m.isMinor).slice(0, 6), d)] });
    });
    // Medenspiele Tennis
    for (let n = 0; n < 5; n++) {
      const d = nterWochentag(j, 5 + Math.floor(n / 2), 6, (n % 2) * 2 + 1);
      termin({ title: `Medenspiel Damen 40 (${n + 1}. Spieltag)`, categoryId: 'cat-match', department: 'Tennis', startDate: d, startTime: '13:00', endTime: '18:00', location: n % 2 ? 'Tennisanlage Oberdorf' : 'Tennisanlage', participants: teilnehmer(tennis.filter(m => m.gender === 'w' && !m.isMinor).slice(0, 4), d) });
    }
    // Turnen Wettkämpfe
    termin({ title: 'Gauturnfest', categoryId: 'cat-match', department: 'Turnen & Gymnastik', startDate: nterWochentag(j, 6, 6, 3), endDate: plusTage(nterWochentag(j, 6, 6, 3), 1), isAllDay: true, location: 'Kreisstadt, Sportzentrum', participants: teilnehmer(turnen.slice(0, 5), nterWochentag(j, 6, 6, 3)) });
    termin({ title: 'Kinderturnwettkampf', categoryId: 'cat-match', department: 'Turnen & Gymnastik', startDate: nterWochentag(j, 11, 6, 2), startTime: '10:00', endTime: '15:00', location: 'Turnhalle der Grundschule' });
    // Vorstand, Versammlung, Kassenprüfung
    for (const m of [1, 3, 5, 7, 9, 11]) {
      const d = nterWochentag(j, m, 2, 1);
      termin({ title: 'Vorstandssitzung', categoryId: 'cat-board', department: 'all', startDate: d, startTime: '19:30', endTime: '21:30', location: 'Vereinsheim, Besprechungsraum', participants: teilnehmer([vorsitz, stellvertretung, kassier, schrift, jugendleitung], d) });
    }
    termin({ title: 'Kassenprüfung', categoryId: 'cat-board', department: 'all', startDate: nterWochentag(j, 2, 4, 3), startTime: '18:00', endTime: '20:00', location: 'Vereinsheim, Besprechungsraum' });
    termin({ title: `Jahreshauptversammlung ${j}`, description: 'Einladung fristgerecht per E-Mail und Aushang', categoryId: 'cat-assembly', department: 'all', startDate: nterWochentag(j, 3, 5, -1), startTime: '19:00', endTime: '21:30', location: 'Gasthof zur Post, Nebenzimmer' });
    // Feste
    termin({ title: `Sommerfest ${j}`, categoryId: 'cat-celebration', department: 'all', startDate: nterWochentag(j, 7, 6, 2), isAllDay: true, location: 'Sportgelände', participants: teilnehmer([vorsitz, kassier, ...fussball.slice(3, 6)], nterWochentag(j, 7, 6, 2), 'helper') });
    termin({ title: 'Weihnachtsfeier', categoryId: 'cat-celebration', department: 'all', startDate: nterWochentag(j, 12, 6, 2), startTime: '18:00', endTime: '23:00', location: 'Vereinsheim, Saal' });
    termin({ title: 'Stand am Weihnachtsmarkt', categoryId: 'cat-celebration', department: 'all', startDate: nterWochentag(j, 12, 0, 1), startTime: '11:00', endTime: '19:00', location: 'Marktplatz Testhausen', participants: teilnehmer(turnen.filter(m => !m.isMinor).slice(0, 3), nterWochentag(j, 12, 0, 1), 'helper') });
    // Arbeitseinsätze
    for (const m of [3, 6, 10]) {
      termin({ title: m === 3 ? 'Platzpflege Frühjahr' : m === 6 ? 'Arbeitseinsatz Tennisanlage' : 'Laub und Winterfest machen', categoryId: 'cat-maintenance', department: m === 6 ? 'Tennis' : 'Fußball', startDate: nterWochentag(j, m, 6, 1), startTime: '09:00', endTime: '13:00', location: m === 6 ? 'Tennisanlage' : 'Sportplatz Testhausen' });
    }
    // Kurse
    for (const m of [1, 4, 9, 11]) {
      termin({ title: 'Kursbeginn Rückenfit (8 Abende)', categoryId: 'cat-course', department: 'Turnen & Gymnastik', startDate: nterWochentag(j, m, 4, 2), startTime: '18:00', endTime: '19:00', location: 'Turnhalle der Grundschule', maxParticipants: 14 });
    }
    // Allgemeines
    termin({ title: 'Vereinsheim geschlossen (Sommerpause)', categoryId: 'cat-general', department: 'all', startDate: tag(j, 8, 3), endDate: tag(j, 8, 16), isAllDay: true, location: 'Vereinsheim' });
    termin({ title: 'Vereinsheim geschlossen (Weihnachten)', categoryId: 'cat-general', department: 'all', startDate: tag(j, 12, 23), endDate: tag(j + 1, 1, 6), isAllDay: true, location: 'Vereinsheim' });
    termin({ title: 'Saisoneröffnung Tennis', categoryId: 'cat-celebration', department: 'Tennis', startDate: nterWochentag(j, 4, 6, 3), startTime: '14:00', endTime: '18:00', location: 'Tennisanlage' });
    termin({ title: 'Saisonabschluss mit Doppelturnier', categoryId: 'cat-match', department: 'Tennis', startDate: nterWochentag(j, 9, 6, 4), startTime: '10:00', endTime: '18:00', location: 'Tennisanlage' });
    termin({ title: 'Sportabzeichen-Abnahme', categoryId: 'cat-general', department: 'all', startDate: nterWochentag(j, 7, 3, 3), startTime: '17:00', endTime: '20:00', location: 'Sportplatz Testhausen' });
    termin({ title: 'Jugend-Zeltlager', categoryId: 'cat-general', department: 'Fußball', startDate: nterWochentag(j, 8, 5, 3), endDate: plusTage(nterWochentag(j, 8, 5, 3), 2), isAllDay: true, location: 'Zeltplatz am See', participants: teilnehmer([jugendleitung, ...fussball.filter(m => m.isMinor)], nterWochentag(j, 8, 5, 3)) });
    termin({ title: 'Hallenturnier F-Jugend', categoryId: 'cat-match', department: 'Fußball', startDate: nterWochentag(j, 1, 6, 4), startTime: '09:00', endTime: '16:00', location: 'Dreifachhalle Kreisstadt' });
    termin({ title: 'Schiedsrichter-Lehrgang', categoryId: 'cat-course', department: 'Fußball', startDate: nterWochentag(j, 2, 6, 2), startTime: '09:00', endTime: '15:00', location: 'Verbandsheim' });
  }

  // -------------------------------------------------------------------------
  // Sitzungen (10)
  // -------------------------------------------------------------------------
  const meetings: Meeting[] = [];
  const beschluss = (
    id: string,
    top: string,
    titel: string,
    text: string,
    ja: number,
    nein: number,
    enth: number,
    ergebnis: MeetingResolution['result'],
    art: { steuer?: boolean; register?: boolean; verantwortlich?: string; frist?: string } = {}
  ): MeetingResolution => ({
    id,
    agendaItemNumber: top,
    title: titel,
    motionText: text,
    votesFor: ja,
    votesAgainst: nein,
    votesAbstain: enth,
    result: ergebnis,
    isTaxRelevant: !!art.steuer,
    isRegisterRelevant: !!art.register,
    ...(art.verantwortlich ? { responsiblePerson: art.verantwortlich } : {}),
    ...(art.frist ? { dueDate: art.frist } : {})
  });
  const anwesende = (d: string, vorstand: boolean, anzahl: number): MeetingAttendee[] => {
    const vs = [vorsitz, stellvertretung, kassier, schrift, jugendleitung];
    const rollen = ['Versammlungsleiter', 'Vorstand', 'Vorstand', 'Schriftführer', 'Vorstand'];
    const basis = vs.map((m, i) => ({
      id: `att-${m.memberNumber}`,
      memberId: m.id,
      name: name(m),
      ...(m.email ? { email: m.email } : {}),
      role: rollen[i],
      present: true,
      hasVotingRight: true,
      isSignatory: i === 0 || i === 3
    }));
    if (vorstand) return basis;
    const weitere = members
      .filter(m => !vs.includes(m) && !m.isMinor && aktivAm(m, d))
      .slice(0, anzahl - basis.length)
      .map(m => ({ id: `att-${m.memberNumber}`, memberId: m.id, name: name(m), ...(m.email ? { email: m.email } : {}), role: 'Mitglied', present: true, hasVotingRight: true, isSignatory: false }));
    return [...basis, ...weitere];
  };
  interface SitzungsVorlage {
    id: string;
    titel: string;
    typ: Meeting['type'];
    datum: string;
    beginn: string;
    ende?: string;
    ort: string;
    anzahl: number;
    tops: { titel: string; notiz?: string; beschluesse?: (top: string, n: number) => MeetingResolution[] }[];
    status: 'signiert' | Meeting['status'];
    notiz?: string;
  }
  const GASTHOF = 'Gasthof zur Post, Nebenzimmer';
  const HEIM = 'Vereinsheim, Besprechungsraum';
  const regularien = (j: number): SitzungsVorlage['tops'] => [
    { titel: 'Begrüßung, Feststellung der Beschlussfähigkeit', notiz: 'Form- und fristgerecht eingeladen; die Versammlung ist beschlussfähig.' },
    { titel: 'Berichte des Vorstands und der Abteilungen', notiz: 'Die Abteilungsleitungen berichten über das Sportjahr.' },
    { titel: 'Kassenbericht und Bericht der Kassenprüfer', notiz: `Kassier ${name(kassier)} erläutert die Einnahmen-Überschuss-Rechnung ${j - 1}. Die Kassenprüfer bestätigen eine ordnungsgemäße Kassenführung.` },
    {
      titel: 'Entlastung des Vorstands',
      beschluesse: (top, n) => [beschluss(`res-${j}-ent`, top, 'Entlastung des Vorstands', `Die Mitgliederversammlung entlastet den Vorstand für das Geschäftsjahr ${j - 1}.`, n - 3, 0, 3, 'accepted', { steuer: false })]
    }
  ];
  const sitzungen: SitzungsVorlage[] = [
    { id: 'mtg-2022-jhv', titel: 'Jahreshauptversammlung 2022', typ: 'general_assembly', datum: nterWochentag(2022, 3, 5, -1), beginn: '19:00', ende: '21:15', ort: GASTHOF, anzahl: 24, status: 'signiert', tops: [...regularien(2022), { titel: 'Wahl des Kassiers', beschluesse: (top, n) => [beschluss('res-2022-wahl', top, `Wahl von ${name(kassier)} zum Kassier`, `${name(kassier)} wird für drei Jahre zum Kassier gewählt.`, n - 1, 0, 1, 'accepted', { register: true, verantwortlich: name(vorsitz), frist: '2022-05-31' })] }] },
    { id: 'mtg-2022-vs', titel: 'Vorstandssitzung September 2022', typ: 'board', datum: nterWochentag(2022, 9, 2, 1), beginn: '19:30', ende: '21:00', ort: HEIM, anzahl: 5, status: 'signiert', notiz: 'Reine Informationssitzung ohne Beschlüsse.', tops: [{ titel: 'Rückblick Sommerfest', notiz: 'Gute Beteiligung, Überschuss geht in die Jugendarbeit.' }, { titel: 'Planung Weihnachtsfeier', notiz: 'Termin und Helferliste abgestimmt.' }] },
    { id: 'mtg-2023-jhv', titel: 'Jahreshauptversammlung 2023', typ: 'general_assembly', datum: nterWochentag(2023, 3, 5, -1), beginn: '19:00', ende: '21:40', ort: GASTHOF, anzahl: 27, status: 'signiert', tops: [...regularien(2023), { titel: 'Anpassung der Mitgliedsbeiträge', beschluesse: (top, n) => [beschluss('res-2023-beitrag', top, 'Neue Beitragsordnung ab 2024', 'Der Jahresbeitrag für Erwachsene bleibt bei 120 €, der Familienbeitrag wird auf 180 € festgesetzt.', n - 6, 4, 2, 'accepted', { verantwortlich: name(kassier), frist: '2024-01-01' })] }] },
    { id: 'mtg-2023-vs', titel: 'Vorstandssitzung November 2023', typ: 'board', datum: nterWochentag(2023, 11, 2, 1), beginn: '19:30', ende: '21:20', ort: HEIM, anzahl: 5, status: 'signiert', tops: [{ titel: 'Anschaffungen 2024', beschluesse: (top) => [beschluss('res-2023-trikots', top, 'Neuer Trikotsatz 1. Herren', 'Der Vorstand beschließt die Anschaffung eines neuen Trikotsatzes bis 1.500 €.', 4, 0, 1, 'accepted', { verantwortlich: name(trainer.Fußball), frist: '2024-08-31' }), beschluss('res-2023-bus', top, 'Vereinsbus leasen', 'Der Verein least einen Kleinbus für Auswärtsfahrten.', 1, 3, 1, 'rejected')] }] },
    { id: 'mtg-2024-jhv', titel: 'Jahreshauptversammlung 2024', typ: 'general_assembly', datum: nterWochentag(2024, 3, 5, -1), beginn: '19:00', ende: '22:05', ort: GASTHOF, anzahl: 31, status: 'signiert', tops: [...regularien(2024), { titel: 'Satzungsänderung § 9 (Online-Versammlungen)', beschluesse: (top, n) => [beschluss('res-2024-satzung', top, 'Satzungsänderung § 9', 'Mitgliederversammlungen können auch online oder hybrid stattfinden.', n - 3, 2, 1, 'accepted', { register: true, verantwortlich: name(vorsitz), frist: '2024-06-30' })] }, { titel: 'Neuwahl des Vorstands', beschluesse: (top, n) => [beschluss('res-2024-wahl', top, `Wahl von ${name(vorsitz)} zum 1. Vorsitzenden`, `${name(vorsitz)} wird für drei Jahre zum 1. Vorsitzenden gewählt.`, n - 2, 0, 2, 'accepted', { register: true })] }] },
    { id: 'mtg-2024-tennis', titel: 'Abteilungsversammlung Tennis 2024', typ: 'department', datum: '2024-10-10', beginn: '19:00', ende: '20:15', ort: 'Tennisanlage, Hütte', anzahl: 9, status: 'review', notiz: 'Protokoll liegt der Abteilungsleitung zur Durchsicht vor.', tops: [{ titel: 'Rückblick Saison 2024', notiz: 'Damen 40 auf Platz 3.' }, { titel: 'Platzpflege und Hallenzeiten im Winter', notiz: 'Wintertraining in der Kreishalle ab November.' }] },
    { id: 'mtg-2025-jhv', titel: 'Jahreshauptversammlung 2025', typ: 'general_assembly', datum: nterWochentag(2025, 3, 5, -1), beginn: '19:00', ende: '21:30', ort: GASTHOF, anzahl: 28, status: 'signiert', tops: [...regularien(2025), { titel: 'Bildung einer Rücklage', beschluesse: (top, n) => [beschluss('res-2025-ruecklage', top, 'Zweckgebundene Rücklage Flutlicht', 'Für die Erneuerung der Flutlichtanlage wird eine Rücklage nach § 62 Abs. 1 Nr. 1 AO von 5.000 € gebildet.', n - 1, 0, 1, 'accepted', { steuer: true, verantwortlich: name(kassier), frist: '2027-12-31' })] }] },
    { id: 'mtg-2025-amv', titel: 'Außerordentliche Mitgliederversammlung 2025', typ: 'extraordinary_assembly', datum: '2025-09-19', beginn: '19:30', ende: '21:00', ort: GASTHOF, anzahl: 22, status: 'signiert', tops: [{ titel: 'Begrüßung, Feststellung der Beschlussfähigkeit' }, { titel: 'Beteiligung am Neubau der Mehrzweckhalle', notiz: 'Die Stadt bietet eine Beteiligung an. Viele Fragen sind offen.', beschluesse: (top, n) => [beschluss('res-2025-halle', top, 'Beteiligung Mehrzweckhalle', 'Der Verein beteiligt sich mit 15.000 € am Neubau der Mehrzweckhalle.', 0, 0, 0, 'deferred'), beschluss('res-2025-ag', top, 'Arbeitsgruppe Hallenneubau', 'Eine Arbeitsgruppe aus drei Mitgliedern klärt die Bedingungen mit der Stadt.', n - 2, 1, 1, 'accepted', { verantwortlich: name(stellvertretung), frist: '2026-03-01' })] }] },
    { id: 'mtg-2026-jhv', titel: 'Jahreshauptversammlung 2026', typ: 'general_assembly', datum: nterWochentag(2026, 3, 5, -1), beginn: '19:00', ende: '21:45', ort: GASTHOF, anzahl: 30, status: 'draft', notiz: 'Protokoll im Entwurf, Unterschriften fehlen noch.', tops: [...regularien(2026), { titel: 'Erhöhung der Übungsleiterpauschale', beschluesse: (top, n) => [beschluss('res-2026-uel', top, 'Übungsleiterpauschale 1.100 € im Jahr', 'Die Übungsleiterpauschale wird ab 2026 auf 275 € im Quartal angehoben.', n - 5, 3, 2, 'accepted', { steuer: true, verantwortlich: name(kassier) })] }] },
    { id: 'mtg-2026-vs', titel: 'Vorstandssitzung Dezember 2026', typ: 'board', datum: '2026-12-01', beginn: '19:30', ort: HEIM, anzahl: 5, status: 'scheduled', tops: [{ titel: 'Jahresplanung 2027' }, { titel: 'Vorbereitung Jahreshauptversammlung 2027' }, { titel: 'Verschiedenes' }] }
  ];

  for (const s of sitzungen) {
    const vorstand = s.typ === 'board';
    const attendees = s.status === 'scheduled' ? anwesende(s.datum, true, 5).map(a => ({ ...a, present: false })) : anwesende(s.datum, vorstand, s.anzahl);
    const stimmen = attendees.filter(a => a.present && a.hasVotingRight).length;
    const agenda: MeetingAgendaItem[] = s.tops.map((t, i) => {
      const top = `TOP ${i + 1}`;
      return {
        id: `${s.id}-top-${i + 1}`,
        number: top,
        title: t.titel,
        ...(t.notiz ? { discussionNotes: t.notiz } : {}),
        resolutions: (t.beschluesse?.(top, stimmen) ?? []).map(r => ({ ...r, meetingId: s.id }))
      };
    });
    let m: Meeting = {
      id: s.id,
      title: s.titel,
      type: s.typ,
      status: s.status === 'signiert' ? 'review' : s.status,
      protocolType: 'results',
      date: s.datum,
      startTime: s.beginn,
      ...(s.ende ? { endTime: s.ende } : {}),
      location: s.ort,
      chairperson: name(vorsitz),
      minuteKeeper: name(schrift),
      invitationDate: plusTage(s.datum, vorstand ? -7 : -21),
      invitationMethod: vorstand ? 'Per E-Mail an den Vorstand' : 'Schriftlich per E-Mail und Aushang gem. § 8 der Satzung',
      invitationCompliant: true,
      quorumConfirmed: s.status !== 'scheduled',
      ...(s.status !== 'scheduled' ? { totalEligibleVoters: stimmen } : {}),
      agenda,
      attendees,
      ...(s.notiz ? { generalNotes: s.notiz } : {}),
      createdAt: zeitstempel(plusTage(s.datum, -21) < '2022-01-01' ? '2022-01-01' : plusTage(s.datum, -21)),
      updatedAt: zeitstempel(s.status === 'scheduled' ? plusTage(s.datum, -21) : s.datum, 22)
    };
    if (s.status === 'signiert') {
      const tagDanach = plusTage(s.datum, 3);
      let n = 0;
      for (const [rolle, person] of [[ROLLE_LEITUNG, vorsitz], [ROLLE_SCHRIFT, schrift]] as const) {
        const u = unterschrift(name(person));
        // Feste Uhrzeit statt „jetzt“, damit die Datei immer gleich ausfällt.
        m = unterschreibe(m, rolle, { dataUrl: u.dataUrl, aspect: u.aspect, strokes: u.strokes, geraet: 'Mauszeiger (Desktop)' }, new Date(`${tagDanach}T${zwei(18 + n)}:00:00.000Z`));
        n++;
      }
      m.signatures = (m.signatures ?? []).map((sig, i) => ({ ...sig, id: `sig-${s.id}-${i + 1}` }));
      m.signedAt = tagDanach;
    }
    meetings.push(m);
  }

  // -------------------------------------------------------------------------
  // Vereinsstammdaten
  // -------------------------------------------------------------------------
  const vereinsAdresse: Address = { street: 'Am Sportplatz', houseNumber: '1', ...ORT };
  const sig = unterschrift(name(vorsitz));
  const settings: ClubSettings = {
    clubName: 'TSV Testhausen 1921 e.V.',
    associationNumber: 'VR 4711',
    taxNumber: settingsVorlauf.taxNumber,
    creditorId: 'DE98ZZZ09999999999',
    creditorIban: accounts[0].iban,
    creditorBic: BIC,
    creditorAccountId: GIRO,
    address: vereinsAdresse,
    clubAddress: vereinsAdresse,
    chairman: name(vorsitz),
    treasurer: name(kassier),
    boardMembers: [
      { id: 'bm-1', role: '1. Vorsitzender', name: name(vorsitz), email: vorsitz.email },
      { id: 'bm-2', role: '2. Vorsitzende/r', name: name(stellvertretung), email: stellvertretung.email },
      { id: 'bm-3', role: 'Kassier', name: name(kassier), email: kassier.email },
      { id: 'bm-4', role: 'Schriftführer/in', name: name(schrift), email: schrift.email },
      { id: 'bm-5', role: 'Jugendleitung', name: name(jugendleitung), email: jugendleitung.email }
    ],
    email: 'info@tsv-testhausen.example',
    phone: '09999 1921',
    website: 'https://tsv-testhausen.example',
    departments: [...SPARTEN],
    signature: { aspect: sig.aspect, strokes: sig.strokes },
    membershipFeeDefaults: {
      full: { amount: vorgaben.full, period: 'yearly' },
      reduced: { amount: vorgaben.reduced, period: 'yearly' },
      youth: { amount: vorgaben.youth, period: 'yearly' },
      family: { amount: vorgaben.family, period: 'yearly' },
      supporting: { amount: vorgaben.supporting, period: 'yearly' }
    },
    taxOffice: settingsVorlauf.taxOffice,
    taxExemptionDate: settingsVorlauf.taxExemptionDate,
    taxAssessmentPeriod: settingsVorlauf.taxAssessmentPeriod,
    promotedPurposes: settingsVorlauf.promotedPurposes
  };
  for (const d of donations) d.issuedBy = `${name(vorsitz)} (1. Vorsitzender)`;

  // Sortierung wie in der App: Neueste zuerst bei Buchungen; sonst nach Kennung.
  transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return {
    app: 'VereinsManager Lokal',
    version: '1.2.3',
    exportedAt: EXPORTIERT_AM,
    data: {
      members,
      transactions,
      accounts,
      auditLogs,
      inventory,
      memberInventory,
      sepaRuns,
      documents,
      folders,
      donations,
      contacts,
      invoices,
      invoiceTemplate: DEFAULT_INVOICE_TEMPLATE,
      meetings,
      meetingTemplate: DEFAULT_MEETING_TEMPLATE,
      dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
      calendarEvents,
      calendarCategories: DEFAULT_CALENDAR_CATEGORIES,
      settings
    }
  };
}

/** Die Datei so, wie sie im Repository liegt (2 Leerzeichen eingerückt, Zeilenende am Schluss). */
export function testvereinAlsJson(): string {
  return JSON.stringify(erzeugeTestverein(), null, 2) + '\n';
}
