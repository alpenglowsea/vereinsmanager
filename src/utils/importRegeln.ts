/**
 * Regeln für die Buchungsimporte (P17), wie die Android-Fassung
 * (`importe-1`: Tabellen.kt und BuchungImport.kt).
 *
 * Bank-Import und Excel/CSV-Import benutzen dieselben Regeln; vorher hatte
 * jeder Import seine eigenen, mit unterschiedlichen Fehlern.
 */
import type { Skr42MainCategory, Skr42SubCategory, Transaction } from '../types';

/** Überschrift vergleichbar machen: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern. */
export function normKopf(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

export interface SpaltenRegel<F extends string> {
  feld: F;
  /** Überschriften, die genau passen müssen (in Normalform, siehe normKopf). */
  genau: string[];
  /** Längere Wörter, die auch als Teil einer Überschrift genügen. */
  teil: string[];
}

/**
 * Ordnet Feldern Spalten zu: zuerst genaue Treffer, danach Teiltreffer nur
 * mit den dafür vorgesehenen längeren Wörtern. Jede Spalte wird nur einmal
 * vergeben. Vorher genügte ein Teiltreffer mit Kurzwörtern wie „nr“, „art“
 * oder „name“; „Artikel“ wurde dann zur Buchungsart, „Bankverbindung“ zum
 * Konto (D-68, D-70).
 */
export function ordneSpaltenZu<F extends string>(headers: string[], regeln: SpaltenRegel<F>[]): Partial<Record<F, string>> {
  const normiert = headers.map(normKopf);
  const vergeben = new Set<number>();
  const ergebnis: Partial<Record<F, string>> = {};
  for (const r of regeln) {
    for (const name of r.genau) {
      const i = normiert.findIndex((n, idx) => !vergeben.has(idx) && n === name);
      if (i < 0) continue;
      vergeben.add(i);
      ergebnis[r.feld] = headers[i];
      break;
    }
  }
  for (const r of regeln) {
    if (ergebnis[r.feld] !== undefined) continue;
    for (const name of r.teil) {
      const i = normiert.findIndex((n, idx) => !vergeben.has(idx) && n.includes(name));
      if (i < 0) continue;
      vergeben.add(i);
      ergebnis[r.feld] = headers[i];
      break;
    }
  }
  return ergebnis;
}

function isoDatum(j: number, m: number, t: number): string | null {
  if (m < 1 || m > 12 || t < 1 || t > 31 || j < 1900 || j > 2999) return null;
  const d = new Date(Date.UTC(j, m - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return null;
  return `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
}

/**
 * Liest ein Datum als JJJJ-MM-TT: TT.MM.JJJJ, TT.MM.JJ (20JJ), JJJJ-MM-TT,
 * TT/MM/JJJJ, TT-MM-JJJJ, JJJJMMTT, auch mit Uhrzeit dahinter. Unmögliche
 * Daten (31.02.) ergeben null. Vorher wurde ein unlesbares Datum
 * stillschweigend zu „heute“ (D-67).
 */
export function leseDatum(text: string | null | undefined): string | null {
  let v = (text || '').trim();
  if (!v) return null;
  v = v.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$/, '');
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) return isoDatum(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(v);
  if (m) return isoDatum(2000 + +m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) return isoDatum(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v);
  if (m) return isoDatum(+m[3], +m[2], +m[1]);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return isoDatum(+m[1], +m[2], +m[3]);
  return null;
}

export interface GelesenerBetrag {
  /** Betrag mit Vorzeichen, auf Cent gerundet. */
  wert: number;
  /** „1.250“ oder „1,250“ wurde als Tausender gelesen – bitte prüfen. */
  mehrdeutig: boolean;
}

/**
 * Liest einen Betrag mit Vorzeichen: „1.234,50“, „1,234.50“, „-12,5“,
 * „12,5-“, „(12,50)“, „12,50 S“ (Soll = negativ), „12,50 H“, „€ 15“.
 * „S“ und „H“ zählen nur direkt hinter der Zahl; vorher machte jedes „S“ am
 * Ende einen Betrag negativ (D-71). Ein einzelner Punkt oder ein einzelnes
 * Komma mit genau drei Ziffern danach gilt als Tausendertrenner: „1.250“ ist
 * 1250 (vorher 1,25 €). Gibt null zurück, wenn es keine Zahl ist.
 */
export function leseBetrag(text: string | number | null | undefined): GelesenerBetrag | null {
  if (typeof text === 'number') return Number.isFinite(text) ? { wert: Math.round(text * 100) / 100, mehrdeutig: false } : null;
  let t = (text || '').trim();
  if (!t) return null;
  let negativ = false;
  if (t.startsWith('(') && t.endsWith(')')) { negativ = true; t = t.slice(1, -1); }
  t = t.replace(/€/g, '').replace(/EUR/gi, '').replace(/[\s\u00a0]/g, '');
  const schluss = t.slice(-1).toUpperCase();
  if ((schluss === 'S' || schluss === 'H') && /\d[SsHh]$/.test(t)) {
    if (schluss === 'S') negativ = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith('-')) { negativ = true; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  if (t.endsWith('-')) { negativ = true; t = t.slice(0, -1); }
  if (!t || !/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  let mehrdeutig = false;
  const punkte = (t.match(/\./g) || []).length;
  const kommas = (t.match(/,/g) || []).length;
  let norm: string;
  if (punkte > 0 && kommas > 0) {
    norm = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (kommas > 0) {
    if (kommas > 1) norm = t.replace(/,/g, '');
    else if (/^\d{1,3},\d{3}$/.test(t)) { mehrdeutig = true; norm = t.replace(',', ''); }
    else norm = t.replace(',', '.');
  } else if (punkte > 0) {
    if (punkte > 1) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return null;
      norm = t.replace(/\./g, '');
    } else if (/^\d{1,3}\.\d{3}$/.test(t)) { mehrdeutig = true; norm = t.replace('.', ''); }
    else norm = t;
  } else norm = t;
  const zahl = Number(norm);
  if (!Number.isFinite(zahl)) return null;
  const cent = Math.round(zahl * 100);
  return { wert: (negativ ? -cent : cent) / 100, mehrdeutig };
}

/** Richtung aus einer Art-Spalte; null = nicht erkannt. Nur ganze Wörter, keine Teiltreffer. */
export function artAusText(text: string): 'income' | 'expense' | 'transfer' | null {
  switch (normKopf(text)) {
    case 'einnahme': case 'einnahmen': case 'income': case 'haben': case 'h': case 'e': case 'gutschrift':
    case 'zahlungseingang': case 'credit': case 'zugang':
      return 'income';
    case 'ausgabe': case 'ausgaben': case 'expense': case 'soll': case 's': case 'a': case 'belastung':
    case 'lastschrift': case 'zahlungsausgang': case 'debit': case 'abgang':
      return 'expense';
    case 'umbuchung': case 'transfer':
      return 'transfer';
    default:
      return null;
  }
}

const vergleichstext = (s: string | null | undefined) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Sucht eine vorhandene Buchung, die der Zeile gleicht: gleiches Datum,
 * gleicher Betrag und dazu gleiche Belegnummer, gleicher Partner oder
 * gleicher Text (Regel des Excel-Imports, jetzt auch für den Bankimport,
 * D-65). Umbuchungen werden nicht verglichen.
 */
export function findeDuplikat(
  z: { date: string; amount: number; type: Transaction['type']; documentNumber?: string; partner?: string; bookingText?: string },
  vorhandene: Transaction[]
): Transaction | undefined {
  if (!z.date || z.type === 'transfer') return undefined;
  const nr = (z.documentNumber || '').trim().toLowerCase();
  const partner = vergleichstext(z.partner);
  const text = vergleichstext(z.bookingText);
  return vorhandene.find(t =>
    t.type !== 'transfer' &&
    t.date === z.date &&
    Math.abs((t.amount || 0) - z.amount) < 0.005 &&
    ((nr !== '' && (t.documentNumber || '').trim().toLowerCase() === nr) ||
      (partner !== '' && vergleichstext(t.partner) === partner) ||
      (text !== '' && vergleichstext(t.bookingText) === text))
  );
}

/** Kurze Beschreibung einer gefundenen Doppelbuchung für die Vorschau. */
export function duplikatText(t: Transaction): string {
  const datum = (t.date || '').split('-').reverse().join('.');
  return `Gleicht Beleg ${t.documentNumber || 'ohne Nr.'} vom ${datum} (${t.partner || t.bookingText})`;
}

export interface KontoTreffer {
  main: Skr42MainCategory;
  sub: Skr42SubCategory;
}

/**
 * Findet ein Konto des Kontenrahmens nach Nummer (auch „40000 - Name“) oder
 * genauem Namen. Kein Ähnlichkeitsraten: Vorher wurde bei fehlendem Treffer
 * irgendein erstes Konto gesetzt.
 */
export function findeSkrKonto(text: string, typ: 'income' | 'expense', skr: readonly Skr42MainCategory[]): KontoTreffer | null {
  const t = (text || '').trim();
  if (!t) return null;
  const code = /^(\d{4,6})\b/.exec(t)?.[1];
  const lower = t.toLowerCase();
  const treffer: KontoTreffer[] = [];
  for (const main of skr) {
    for (const sub of main.subCategories) {
      if (code ? sub.code === code : sub.name.toLowerCase() === lower || sub.label.toLowerCase() === lower) treffer.push({ main, sub });
    }
  }
  return treffer.find(k => k.main.type === typ) || treffer[0] || null;
}

/** Findet das Konto zu einer Kontonummer (für Auswahllisten). */
export function kontoNachNummer(code: string, skr: readonly Skr42MainCategory[]): KontoTreffer | null {
  if (!code) return null;
  for (const main of skr) {
    const sub = main.subCategories.find(s => s.code === code);
    if (sub) return { main, sub };
  }
  return null;
}

/** Die Kontofelder einer Buchung wie im Buchungsformular; Umsatzsteuer aus dem Konto (D-69). */
export function kontoFelder(k: KontoTreffer): Pick<Transaction, 'mainCategory' | 'subCategory' | 'category' | 'skrAccount' | 'vatRate'> {
  return {
    mainCategory: `${k.main.code} - ${k.main.name}`,
    subCategory: k.sub.label,
    category: k.sub.label,
    skrAccount: k.sub.code,
    vatRate: k.sub.vatRateDefault
  };
}

/**
 * Vorschlag aus früheren Buchungen desselben Partners in derselben Richtung
 * (die neueste mit gesetztem Konto, ohne Umbuchungen und aufgeteilte
 * Buchungen), D-69.
 */
export function kontoAusHistorie(partner: string, richtung: 'income' | 'expense', vorhandene: Transaction[]): Transaction | undefined {
  const p = vergleichstext(partner);
  if (!p) return undefined;
  let beste: Transaction | undefined;
  for (const t of vorhandene) {
    if (!t.skrAccount || t.type === 'transfer' || t.isSplit) continue;
    if (vergleichstext(t.partner) !== p) continue;
    const ausgabe = t.type === 'expense' || (t.amount || 0) < 0;
    if (ausgabe !== (richtung === 'expense')) continue;
    if (!beste || (t.date || '') >= (beste.date || '')) beste = t;
  }
  return beste;
}
