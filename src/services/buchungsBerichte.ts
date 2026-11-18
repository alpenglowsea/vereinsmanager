/**
 * Rechnungen für die Berichte aus den Buchungen: Einnahmen-Überschuss-
 * Rechnung (EÜR), Besteuerungsgrenze des wirtschaftlichen Geschäftsbetriebs,
 * Buchungsjournal (PDF) und Buchungs-CSV.
 *
 * Eine gemeinsame Stelle für Bildschirm und PDF. Vorher rechnete das EÜR-PDF
 * anders als die EÜR-Seite (D-34): Es löste aufgeteilte Buchungen nicht auf
 * und gliederte nur nach dem Textfeld „Kategorie“. Die Regeln hier entsprechen
 * der Android-Fassung (`Berichte.kt`).
 *
 * Gerechnet wird in ganzen Cent, damit sich keine Rundungsreste aufsummieren.
 */
import type { TaxSphere, Transaction, FinancialAccount } from '../types';
import { TAX_SPHERES, findSkr42MainForSub } from '../data/taxSpheres';

// ---------------------------------------------------------------------------
// Grundregeln
// ---------------------------------------------------------------------------

/** Umbuchung zwischen eigenen Konten: weder Einnahme noch Ausgabe. */
export function istUmbuchung(t: Pick<Transaction, 'type'>): boolean {
  return t.type === 'transfer';
}

/** Ausgabe ist, was als Ausgabe gebucht ist oder einen negativen Betrag hat (Umbuchungen nie). */
export function istAusgabe(t: Pick<Transaction, 'type' | 'amount'>): boolean {
  return !istUmbuchung(t) && (t.type === 'expense' || t.amount < 0);
}

/** Ist die Buchung in Teile aufgeteilt? */
export function istAufgeteilt(t: Pick<Transaction, 'isSplit' | 'splits'>): boolean {
  return Boolean(t.isSplit && t.splits && t.splits.length > 0);
}

const cent = (euro: number): number => Math.round(Math.abs(euro || 0) * 100);
const euro = (c: number): number => c / 100;

// ---------------------------------------------------------------------------
// Besteuerungsgrenze § 64 Abs. 3 AO
// ---------------------------------------------------------------------------

/** Grenze bis einschließlich 2025. */
export const WGB_GRENZE_BIS_2025 = 45000;
/** Grenze ab dem Kalenderjahr 2026 (Steueränderungsgesetz 2025, BGBl. 2025 I Nr. 363). */
export const WGB_GRENZE_AB_2026 = 50000;

/**
 * Die Besteuerungsgrenze für den wirtschaftlichen Geschäftsbetrieb im
 * Kalenderjahr `jahr` (Einnahmen einschließlich Umsatzsteuer). Bei
 * unlesbarem Jahr gilt das laufende Jahr. Auch von der Dashboard-Kachel zu
 * nutzen (P26).
 */
export function wgbGrenze(jahr?: string | number | null, heute: Date = new Date()): number {
  const j = typeof jahr === 'number' ? jahr : Number.parseInt(String(jahr ?? ''), 10);
  const kalenderjahr = Number.isFinite(j) && j > 1900 ? j : heute.getFullYear();
  return kalenderjahr >= 2026 ? WGB_GRENZE_AB_2026 : WGB_GRENZE_BIS_2025;
}

export interface GrenzStand {
  einnahmen: number;
  grenze: number;
  /** Erst MEHR als die Grenze ist überschritten („nicht übersteigen“); genau der Grenzbetrag ist noch frei (D-37). */
  ueberschritten: boolean;
  /** Ab 75 % bis einschließlich der Grenze. */
  warnung: boolean;
  /** Anteil in Prozent, nicht begrenzt (kann über 100 liegen). */
  prozent: number;
  /** Noch frei bis zur Grenze, nie negativ. */
  puffer: number;
}

export function grenzStand(einnahmen: number, grenze: number): GrenzStand {
  const e = cent(einnahmen);
  const g = cent(grenze);
  const ueberschritten = e > g;
  return {
    einnahmen: euro(e),
    grenze: euro(g),
    ueberschritten,
    warnung: !ueberschritten && e * 4 >= g * 3,
    prozent: g > 0 ? (e / g) * 100 : 0,
    puffer: euro(Math.max(0, g - e))
  };
}

// ---------------------------------------------------------------------------
// Einnahmen-Überschuss-Rechnung
// ---------------------------------------------------------------------------

export const SPHAEREN: TaxSphere[] = ['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'];

export interface EuerKonto {
  name: string;
  skrCode?: string;
  income: number;
  expense: number;
  txCount: number;
}

export interface EuerNummernkreis {
  id: string;
  code: string;
  name: string;
  income: number;
  expense: number;
  txCount: number;
  subCategories: Record<string, EuerKonto>;
}

export interface EuerSphaere {
  income: number;
  expense: number;
  net: number;
  txCount: number;
  mainCategories: Record<string, EuerNummernkreis>;
}

export interface Euer {
  /** Gewähltes Jahr (vierstellig) oder null für alle Jahre. */
  jahr: string | null;
  spheres: Record<TaxSphere, EuerSphaere>;
  income: number;
  expense: number;
  net: number;
  /** Nur bei einem einzelnen Jahr: Die Grenze gilt je Kalenderjahr. Bei „alle Jahre“ null (D-37). */
  grenze: GrenzStand | null;
}

/**
 * Die EÜR wie auf der EÜR-Seite: Umbuchungen zählen nicht; aufgeteilte
 * Buchungen werden Teil für Teil mit ihrer eigenen Sphäre und ihrem eigenen
 * Konto gezählt; eine unbekannte oder leere Sphäre zählt zum ideellen Bereich.
 * Gegliedert nach Sphäre → Nummernkreis → Konto, jeweils nach Kontonummer
 * sortiert.
 */
export function berechneEuer(transactions: Transaction[], jahr: string | null): Euer {
  interface KontoAcc { skr?: string; ein: number; aus: number; n: number }
  interface KreisAcc { code: string; name: string; ein: number; aus: number; n: number; konten: Map<string, KontoAcc> }
  interface SphAcc { ein: number; aus: number; n: number; kreise: Map<string, KreisAcc> }
  const acc = new Map<TaxSphere, SphAcc>(SPHAEREN.map(s => [s, { ein: 0, aus: 0, n: 0, kreise: new Map() }]));

  const zeile = (
    sphRoh: string | undefined,
    haupt: string | undefined,
    unter: string | undefined,
    skr: string | undefined,
    betragCent: number,
    ausgabe: boolean
  ) => {
    const sph: TaxSphere = (SPHAEREN as string[]).includes(sphRoh || '') ? (sphRoh as TaxSphere) : 'ideell';
    const konto = (unter || '').trim() || 'Sonstige Buchung';
    let key: string;
    let code: string;
    let name: string;
    if (haupt && haupt.trim()) {
      key = haupt;
      const teile = haupt.split(' - ');
      code = teile[0] || '';
      name = teile.length > 1 ? teile.slice(1).join(' - ') : haupt;
    } else {
      const gefunden = findSkr42MainForSub(konto);
      if (gefunden) {
        key = `${gefunden.code} - ${gefunden.name}`;
        code = gefunden.code;
        name = gefunden.name;
      } else {
        key = `Allgemein (${sph})`;
        code = '';
        name = `Allgemeine Erlöse/Kosten ${sph}`;
      }
    }
    const s = acc.get(sph)!;
    let k = s.kreise.get(key);
    if (!k) {
      k = { code, name, ein: 0, aus: 0, n: 0, konten: new Map() };
      s.kreise.set(key, k);
    }
    let kt = k.konten.get(konto);
    if (!kt) {
      kt = { skr: skr || undefined, ein: 0, aus: 0, n: 0 };
      k.konten.set(konto, kt);
    }
    if (!kt.skr && skr) kt.skr = skr;
    s.n++;
    k.n++;
    kt.n++;
    if (ausgabe) {
      s.aus += betragCent;
      k.aus += betragCent;
      kt.aus += betragCent;
    } else {
      s.ein += betragCent;
      k.ein += betragCent;
      kt.ein += betragCent;
    }
  };

  for (const t of transactions) {
    if (istUmbuchung(t)) continue;
    if (jahr && !(t.date || '').startsWith(jahr)) continue;
    const ausgabe = istAusgabe(t);
    if (istAufgeteilt(t)) {
      for (const teil of t.splits!) {
        zeile(
          teil.sphere || t.sphere,
          teil.mainCategory || t.mainCategory,
          teil.subCategory || teil.category || t.subCategory || t.category,
          teil.skrAccount || t.skrAccount,
          cent(teil.amount),
          ausgabe
        );
      }
    } else {
      zeile(t.sphere, t.mainCategory, t.subCategory || t.category, t.skrAccount, cent(t.amount), ausgabe);
    }
  }

  const nachCode = (a: { code?: string; name: string }, b: { code?: string; name: string }) =>
    (a.code || '~').localeCompare(b.code || '~', 'de', { numeric: true }) || a.name.localeCompare(b.name, 'de');

  let ein = 0;
  let aus = 0;
  const spheres = {} as Record<TaxSphere, EuerSphaere>;
  for (const sph of SPHAEREN) {
    const s = acc.get(sph)!;
    ein += s.ein;
    aus += s.aus;
    const mainCategories: Record<string, EuerNummernkreis> = {};
    const kreise = [...s.kreise.entries()].sort((a, b) => nachCode(a[1], b[1]));
    for (const [key, k] of kreise) {
      const subCategories: Record<string, EuerKonto> = {};
      const konten = [...k.konten.entries()].sort((a, b) =>
        nachCode({ code: a[1].skr, name: a[0] }, { code: b[1].skr, name: b[0] })
      );
      for (const [name, kt] of konten) {
        subCategories[name] = { name, skrCode: kt.skr, income: euro(kt.ein), expense: euro(kt.aus), txCount: kt.n };
      }
      mainCategories[key] = {
        id: key,
        code: k.code,
        name: k.name,
        income: euro(k.ein),
        expense: euro(k.aus),
        txCount: k.n,
        subCategories
      };
    }
    spheres[sph] = { income: euro(s.ein), expense: euro(s.aus), net: euro(s.ein - s.aus), txCount: s.n, mainCategories };
  }

  return {
    jahr,
    spheres,
    income: euro(ein),
    expense: euro(aus),
    net: euro(ein - aus),
    grenze: jahr ? grenzStand(spheres.wirtschaftlich.income, wgbGrenze(jahr)) : null
  };
}

// ---------------------------------------------------------------------------
// Buchungsjournal
// ---------------------------------------------------------------------------

export interface JournalSummen {
  einnahmen: number;
  ausgaben: number;
  saldo: number;
  /** Anzahl der Umbuchungen; sie stehen im Journal, zählen aber nicht mit (D-35). */
  umbuchungen: number;
}

export function journalSummen(transactions: Transaction[]): JournalSummen {
  let ein = 0;
  let aus = 0;
  let umb = 0;
  for (const t of transactions) {
    if (istUmbuchung(t)) {
      umb++;
      continue;
    }
    if (istAusgabe(t)) aus += cent(t.amount);
    else ein += cent(t.amount);
  }
  return { einnahmen: euro(ein), ausgaben: euro(aus), saldo: euro(ein - aus), umbuchungen: umb };
}

/** Betrag mit Vorzeichen nach der Buchungsart (Ausgaben negativ, Umbuchungen ohne Vorzeichen). */
export function betragMitVorzeichen(t: Pick<Transaction, 'type' | 'amount'>, betrag: number = t.amount): number {
  const b = Math.abs(betrag || 0);
  if (istUmbuchung(t)) return b;
  return istAusgabe(t) ? -b : b;
}

// ---------------------------------------------------------------------------
// Buchungs-CSV
// ---------------------------------------------------------------------------

/** Spalten wie in der Android-Fassung (D-36). */
export const BUCHUNGS_CSV_SPALTEN = [
  'Buchungs-ID',
  'Datum',
  'Belegnummer',
  'Teil',
  'Buchungstext',
  'Zahlungspartner',
  'Konto',
  'Zielkonto',
  'Steuerliche Sphäre',
  'Sparte',
  'Kategorie',
  'SKR-Konto',
  'Betrag (EUR)',
  'Typ',
  'USt-Satz (%)',
  'Beleg vorhanden',
  'Notizen'
] as const;

export type BuchungsCsvZeile = Record<(typeof BUCHUNGS_CSV_SPALTEN)[number], string>;

const einzeilig = (s: string | undefined | null): string => (s || '').replace(/(\r\n|\n|\r)/gm, ' ');

/**
 * Eine Zeile je Buchung, bei aufgeteilten Buchungen eine Zeile je Teil
 * (Spalte „Teil“, z. B. „2/3“), damit Summen über die Spalte Betrag stimmen
 * und jeder Teil seine Sphäre, Sparte und sein Konto zeigt. Vorher stand eine
 * aufgeteilte Buchung als eine Zeile mit dem Gesamtbetrag da (D-36).
 */
export function buchungsCsvZeilen(transactions: Transaction[], accounts: FinancialAccount[]): BuchungsCsvZeile[] {
  const kontoName = new Map(accounts.map(a => [a.id, a.name]));
  const konto = (id?: string) => (id ? kontoName.get(id) || id : '');
  const sphaere = (s?: string) => (s ? TAX_SPHERES[s as TaxSphere]?.name || s : '');
  const typ = (t: Transaction) => (istUmbuchung(t) ? 'Umbuchung' : istAusgabe(t) ? 'Ausgabe' : 'Einnahme');

  const zeilen: BuchungsCsvZeile[] = [];
  for (const t of transactions) {
    const gemeinsam = {
      'Buchungs-ID': t.id,
      Datum: t.date,
      Belegnummer: t.documentNumber || '',
      Zahlungspartner: t.partner || '',
      Konto: konto(t.accountId),
      Zielkonto: istUmbuchung(t) ? konto(t.targetAccountId) : '',
      Typ: typ(t),
      'Beleg vorhanden': t.receipt ? 'Ja' : 'Nein',
      Notizen: einzeilig(t.notes)
    };
    if (istAufgeteilt(t)) {
      const n = t.splits!.length;
      t.splits!.forEach((teil, i) => {
        zeilen.push({
          ...gemeinsam,
          Teil: `${i + 1}/${n}`,
          Buchungstext: teil.bookingText || t.bookingText || '',
          'Steuerliche Sphäre': sphaere(teil.sphere || t.sphere),
          Sparte: teil.department || t.department || '',
          Kategorie: teil.subCategory || teil.category || t.subCategory || t.category || '',
          'SKR-Konto': teil.skrAccount || t.skrAccount || '',
          'Betrag (EUR)': betragMitVorzeichen(t, teil.amount).toFixed(2),
          'USt-Satz (%)': String(teil.vatRate ?? t.vatRate ?? '')
        });
      });
    } else {
      zeilen.push({
        ...gemeinsam,
        Teil: '',
        Buchungstext: t.bookingText || '',
        'Steuerliche Sphäre': istUmbuchung(t) ? '' : sphaere(t.sphere),
        Sparte: t.department || '',
        Kategorie: t.subCategory || t.category || '',
        'SKR-Konto': t.skrAccount || '',
        'Betrag (EUR)': (istUmbuchung(t) ? Math.abs(t.amount || 0) : betragMitVorzeichen(t)).toFixed(2),
        'USt-Satz (%)': istUmbuchung(t) ? '' : String(t.vatRate ?? '')
      });
    }
  }
  // Feste Spaltenfolge: Die CSV übernimmt die Reihenfolge der Felder der
  // ersten Zeile, und die ergibt sich oben aus der Schreibweise.
  return zeilen.map(z => Object.fromEntries(BUCHUNGS_CSV_SPALTEN.map(k => [k, z[k]])) as BuchungsCsvZeile);
}
