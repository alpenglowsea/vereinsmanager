/**
 * Die Zahlen hinter den Diagrammen der Finanz-Auswertung, wie Android
 * `Finanzauswertung.kt` (P25):
 * - D-77 Einnahme/Ausgabe nach Buchungsart (wie die EÜR), nicht nach Vorzeichen,
 * - D-76 Spende ist nur eine Einnahme auf Nummernkreis 40400; eine Ausgabe dort
 *   (z. B. Rückerstattung) zählt als Ausgabe,
 * - D-78 der Bereichsfilter gilt je Teilbetrag aufgeteilter Buchungen,
 * - D-75 der Verlauf ist ein echter Kontostand mit Anfangsbestand.
 * Gerechnet wird in ganzen Cent, damit keine Rundungsfehler entstehen.
 */
import { FinancialAccount, Transaction } from '../types';
import { SPENDEN_HAUPTKONTO_CODE } from '../data/taxSpheres';
import { istAusgabe, istUmbuchung } from './buchungsBerichte';

export const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const GESAMT = 'Gesamtverein';
const SPHAEREN = new Set(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich']);
export const BEREICH_KURZ: Record<string, string> = {
  ideell: 'Ideeller Bereich',
  vermoegen: 'Vermögensverwaltung',
  zweckbetrieb: 'Zweckbetrieb',
  wirtschaftlich: 'Wirtschaftl. Geschäftsbetrieb'
};

/** Filter; null heißt „alle“. */
export interface AuswFilter {
  jahr: string | null;
  sphaere: string | null;
  kontoId: string | null;
}

/** Eine Zeile: eine Buchung oder ein Teilbetrag. Betrag immer positiv, in Cent. */
export interface Posten {
  jahr: number;
  monat: number; // 0 = Januar
  cent: number;
  ausgabe: boolean;
  spende: boolean;
  sparte: string;
  konto: string;
}

export interface Kennzahlen {
  einnahmen: number;
  spenden: number;
  ausgaben: number;
  saldo: number;
}
export interface MonatsSumme {
  name: string;
  einnahmen: number;
  spenden: number;
  ausgaben: number;
}
export interface VerlaufPunkt {
  name: string;
  stand: number;
}
export interface Anteil {
  name: string;
  wert: number;
}
export interface SpartenSumme {
  name: string;
  einnahmen: number;
  ausgaben: number;
  summe: number;
}
export interface Auswertung {
  filter: AuswFilter;
  posten: Posten[];
  kennzahlen: Kennzahlen;
  monate: MonatsSumme[];
  verlauf: VerlaufPunkt[];
  sparten: SpartenSumme[];
  keineBuchungen: boolean;
}

const zuCent = (euro: number | undefined) => Math.round(Math.abs(Number(euro) || 0) * 100);
const zuEuro = (c: number) => c / 100;
const istSpendenkreis = (nk?: string) => (nk || '').split(' - ')[0].trim() === SPENDEN_HAUPTKONTO_CODE;

/** Zeilen nach Filter. Umbuchungen zählen nicht; aufgeteilte Buchungen Teil für Teil. */
export function posten(buchungen: Transaction[], f: AuswFilter): Posten[] {
  const erg: Posten[] = [];
  for (const b of buchungen) {
    if (istUmbuchung(b)) continue;
    const jahr = Number((b.date || '').slice(0, 4));
    const monat = Number((b.date || '').slice(5, 7)) - 1;
    if (!Number.isInteger(jahr) || !(b.date || '').slice(0, 4).match(/^\d{4}$/) || !(monat >= 0 && monat <= 11)) continue;
    if (f.jahr !== null && String(jahr) !== f.jahr) continue;
    if (f.kontoId !== null && b.accountId !== f.kontoId) continue;
    const ausgabe = istAusgabe(b);
    const zeile = (sph: string | undefined, nk: string | undefined, sparte: string, konto: string, betrag: number) => {
      const s = sph && SPHAEREN.has(sph) ? sph : 'ideell';
      if (f.sphaere !== null && s !== f.sphaere) return;
      erg.push({ jahr, monat, cent: zuCent(betrag), ausgabe, spende: !ausgabe && istSpendenkreis(nk), sparte, konto: konto.trim() ? konto : 'Ohne Konto' });
    };
    if (b.isSplit && b.splits && b.splits.length > 0) {
      for (const t of b.splits) {
        zeile(
          t.sphere || b.sphere,
          t.mainCategory || b.mainCategory,
          t.department || b.department || '',
          t.subCategory || t.category || b.subCategory || b.category || '',
          t.amount
        );
      }
    } else {
      zeile(b.sphere, b.mainCategory, b.department || '', b.subCategory || b.category || '', b.amount);
    }
  }
  return erg;
}

const summe = (p: Posten[], pass: (x: Posten) => boolean) => p.filter(pass).reduce((a, x) => a + x.cent, 0);
const istEinnahme = (x: Posten) => !x.ausgabe && !x.spende;

export function kennzahlen(p: Posten[]): Kennzahlen {
  const e = summe(p, istEinnahme);
  const s = summe(p, x => x.spende);
  const a = summe(p, x => x.ausgabe);
  return { einnahmen: zuEuro(e), spenden: zuEuro(s), ausgaben: zuEuro(a), saldo: zuEuro(e + s - a) };
}

/** Zwölf Monate; bei „alle Jahre“ fallen gleiche Monate verschiedener Jahre zusammen (gewollt, D-74). */
export function monate(p: Posten[]): MonatsSumme[] {
  return MONATE.map((name, i) => {
    const m = p.filter(x => x.monat === i);
    return { name, einnahmen: zuEuro(summe(m, istEinnahme)), spenden: zuEuro(summe(m, x => x.spende)), ausgaben: zuEuro(summe(m, x => x.ausgabe)) };
  });
}

/** Einnahmen (ohne Spenden) oder Ausgaben nach Konto, größte zuerst; Sparte null oder „Gesamtverein“ = alle. */
export function mix(p: Posten[], einnahme: boolean, sparte: string | null = null): Anteil[] {
  const rel = p.filter(x => (einnahme ? istEinnahme(x) : x.ausgabe) && (sparte === null || sparte === GESAMT || x.sparte === sparte));
  const m = new Map<string, number>();
  for (const x of rel) m.set(x.konto, (m.get(x.konto) || 0) + x.cent);
  return Array.from(m.entries())
    .map(([name, c]) => ({ name, c }))
    .sort((a, b) => b.c - a.c || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ name, c }) => ({ name, wert: zuEuro(c) }));
}

/** „Gesamtverein“ und je Sparte Einnahmen (mit Spenden), Ausgaben und Summe. */
export function sparten(p: Posten[], spartenListe: string[]): SpartenSumme[] {
  return [GESAMT, ...spartenListe.filter(s => s !== GESAMT)].map(name => {
    const m = name === GESAMT ? p : p.filter(x => x.sparte === name);
    const e = summe(m, x => !x.ausgabe);
    const a = summe(m, x => x.ausgabe);
    return { name, einnahmen: zuEuro(e), ausgaben: zuEuro(a), summe: zuEuro(e - a) };
  });
}

/** Wirkung einer Buchung auf die gewählten Konten in Cent (mit Vorzeichen), wie der Kontostand in der Buchungsübersicht. */
function wirkung(b: Transaction, ids: Set<string>): number {
  if (istUmbuchung(b)) {
    if (!b.targetAccountId) return 0;
    const betrag = zuCent(b.amount);
    return (ids.has(b.targetAccountId) ? betrag : 0) - (ids.has(b.accountId) ? betrag : 0);
  }
  return ids.has(b.accountId) ? Math.round((Number(b.amount) || 0) * 100) : 0;
}

const zwei = (n: number) => String(n).padStart(2, '0');

/**
 * Echter Kontostand am Ende jedes Monats (gewähltes Jahr; im laufenden Jahr
 * bis zum aktuellen Monat) bzw. jedes Jahres („alle Jahre“, mit „Anfang“).
 * Anfangsbestand plus alle Buchungen bis dahin, unabhängig vom Bereichsfilter;
 * bei gewähltem Konto nur dieses.
 */
export function verlauf(buchungen: Transaction[], konten: FinancialAccount[], f: AuswFilter, heute: string): VerlaufPunkt[] {
  const ids = new Set(konten.map(k => k.id).filter(id => f.kontoId === null || id === f.kontoId));
  const anfang = konten.filter(k => ids.has(k.id)).reduce((a, k) => a + Math.round((Number(k.initialBalance) || 0) * 100), 0);
  const ereignisse = buchungen.map(b => [b.date || '', wirkung(b, ids)] as const).filter(([, w]) => w !== 0);
  const stand = (bis: string) => ereignisse.filter(([d]) => d <= bis).reduce((a, [, w]) => a + w, anfang);
  const hj = Number(heute.slice(0, 4));
  const hm = Number(heute.slice(5, 7));
  if (f.jahr !== null) {
    const j = Number(f.jahr);
    if (!Number.isInteger(j) || j > hj) return [];
    const letzter = j === hj ? hm : 12;
    return Array.from({ length: letzter }, (_, i) => ({ name: MONATE[i], stand: zuEuro(stand(`${j}-${zwei(i + 1)}-31`)) }));
  }
  const jahre = buchungen.map(b => Number((b.date || '').slice(0, 4))).filter(n => Number.isInteger(n) && n > 0);
  if (!jahre.length) return [];
  const punkte: VerlaufPunkt[] = [{ name: 'Anfang', stand: zuEuro(anfang) }];
  for (let j = Math.min(...jahre); j <= Math.max(...jahre); j++) punkte.push({ name: String(j), stand: zuEuro(stand(`${j}-12-31`)) });
  return punkte;
}

export function berechne(
  buchungen: Transaction[],
  konten: FinancialAccount[],
  f: AuswFilter,
  spartenListe: string[],
  heute: string
): Auswertung {
  const p = posten(buchungen, f);
  return {
    filter: f,
    posten: p,
    kennzahlen: kennzahlen(p),
    monate: monate(p),
    verlauf: verlauf(buchungen, konten, f, heute),
    sparten: sparten(p, spartenListe),
    keineBuchungen: p.length === 0
  };
}

// ---------- Text und CSV (D-80)

export function filterText(f: AuswFilter, konten: FinancialAccount[]): string {
  return [
    f.jahr === null ? 'Alle Jahre' : `Jahr ${f.jahr}`,
    f.sphaere === null ? 'Alle Bereiche' : BEREICH_KURZ[f.sphaere] || f.sphaere,
    f.kontoId === null ? 'Alle Konten' : konten.find(k => k.id === f.kontoId)?.name || f.kontoId
  ].join(' · ');
}

const zahl = (v: number) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
const BOM = '\uFEFF';
function feld(s: string): string {
  const q = s.replace(/"/g, '""');
  const braucht = /[\r\n";]/.test(q) || q.includes(BOM) || q.startsWith(' ') || q.endsWith(' ');
  return braucht ? `"${q}"` : q;
}

/** Alle Zahlen in einer Datei, wie Android: Abschnitt; Bezeichnung; Einnahmen; Spenden; Ausgaben; Wert. */
export function csv(a: Auswertung, konten: FinancialAccount[], mixEinnahmen: Anteil[], mixAusgaben: Anteil[]): string {
  const z: string[][] = [];
  z.push(['Filter', filterText(a.filter, konten), '', '', '', '']);
  const k = a.kennzahlen;
  z.push(['Kennzahlen', 'Gesamt', zahl(k.einnahmen), zahl(k.spenden), zahl(k.ausgaben), zahl(k.saldo)]);
  for (const m of a.monate) {
    const c = zuCent(m.einnahmen) + zuCent(m.spenden) - zuCent(m.ausgaben);
    z.push([a.filter.jahr === null ? 'Monat (alle Jahre zusammen)' : 'Monat', m.name, zahl(m.einnahmen), zahl(m.spenden), zahl(m.ausgaben), zahl(c / 100)]);
  }
  for (const v of a.verlauf) z.push(['Kontostand (Ende)', v.name, '', '', '', zahl(v.stand)]);
  for (const x of mixEinnahmen) z.push(['Einnahmen nach Konto (ohne Spenden)', x.name, zahl(x.wert), '', '', zahl(x.wert)]);
  for (const x of mixAusgaben) z.push(['Ausgaben nach Konto', x.name, '', '', zahl(x.wert), zahl(x.wert)]);
  for (const s of a.sparten) z.push(['Sparte (Einnahmen mit Spenden)', s.name, zahl(s.einnahmen), '', zahl(s.ausgaben), zahl(s.summe)]);
  const kopf = ['Abschnitt', 'Bezeichnung', 'Einnahmen', 'Spenden', 'Ausgaben', 'Wert'];
  return BOM + [kopf, ...z].map(r => r.map(feld).join(';')).join('\r\n');
}

/** Wie Android `Export.dateiname`. */
export const vereinFuerDatei = (text: string) =>
  text.trim().replace(/[^A-Za-z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Verein';

/** „Finanzauswertung_2026_Vereinsname.csv“ wie am Handy. */
export const dateiname = (a: Auswertung, verein: string, endung: 'csv' | 'pdf') =>
  `Finanzauswertung_${a.filter.jahr ?? 'alle-Jahre'}_${vereinFuerDatei(verein)}.${endung}`;
