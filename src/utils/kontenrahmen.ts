/**
 * Kontenrahmen des Vereins: der mitgelieferte SKR 42, dazu eigene Nummernkreise und Konten und die Anpassungen des
 * Vereins (Bezeichnung, Steuersatz-Vorgabe, ausgeblendet).
 *
 * Gleiche Regeln und Texte am Handy: `android/core/.../skr42/Kontenrahmen.kt`, mit denselben Prüffällen.
 *
 * Gespeichert wird beides in den Einstellungen des Vereins und damit in jeder Datensicherung
 * (BACKUP_FORMAT.md, Abschnitt 3):
 *   - `customSkr42Accounts`: die eigenen Nummernkreise und Konten (Format seit November 2026 unverändert)
 *   - `skr42Anpassungen`:   `{ nummernkreise: { "<Nummer>": { name?, ausgeblendet? } },
 *                             konten:        { "<Nummer>": { name?, vatRateDefault?, ausgeblendet? } } }`
 *
 * Angepasst wird über die Nummer, nicht über die Bezeichnung: Die Nummer bleibt fest, sie steht in jeder Buchung
 * (`skrAccount`) und in den Vorgaben der App. Die mitgelieferte Liste bleibt unverändert die Grundlage; eine Anpassung
 * lässt sich jederzeit zurücknehmen.
 *
 * Entscheidungen Johannes, 26.11.2026: änderbar sind Bezeichnung, Steuersatz-Vorgabe und „ausgeblendet“, auch bei den
 * Standardkonten; eine neue Bezeichnung geht auf alle Buchungen des Kontos über; Nummernkreise und Konten stehen immer
 * aufsteigend nach der Nummer.
 */
import type { Skr42MainCategory, Skr42SubCategory, Transaction } from '../types';

export type Steuersatz = 0 | 7 | 19;

export interface NummernkreisAnpassung {
  name?: string;
  ausgeblendet?: boolean;
}

export interface KontoAnpassung {
  name?: string;
  vatRateDefault?: Steuersatz;
  ausgeblendet?: boolean;
}

export interface Skr42Anpassungen {
  nummernkreise: Record<string, NummernkreisAnpassung>;
  konten: Record<string, KontoAnpassung>;
}

export interface EigeneKonten {
  customMainCategories: Skr42MainCategory[];
  customSubCategories: Array<{ mainCatIdOrCode: string; subCategory: Skr42SubCategory }>;
}

export const LEERE_ANPASSUNGEN: Skr42Anpassungen = { nummernkreise: {}, konten: {} };
export const LEERE_EIGENE: EigeneKonten = { customMainCategories: [], customSubCategories: [] };

const STEUERSAETZE: Steuersatz[] = [0, 7, 19];

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** „40000 - Mitgliedsbeiträge“: so stehen Nummernkreis und Konto in einer Buchung. */
export function kontoText(code: string, name: string): string {
  return `${code} - ${name}`;
}

/** Die Bezeichnung eines Kontos ohne Nummer, so wie sie in den Listen steht (aus der Beschriftung). */
export function kontoBezeichnung(sub: Pick<Skr42SubCategory, 'code' | 'label' | 'name'>): string {
  const praefix = `${sub.code} - `;
  return sub.label.startsWith(praefix) ? sub.label.slice(praefix.length) : sub.name;
}

/** Nach der Nummer aufsteigend; Nummern als Zahlen verglichen (999 vor 1000), sonst als Text. */
export function nachNummer(a: string, b: string): number {
  const x = Number(a);
  const y = Number(b);
  if (a.trim() !== '' && b.trim() !== '' && Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y;
  return a.localeCompare(b, 'de');
}

// ---------------------------------------------------------------------------
// Lesen (aus den Einstellungen oder einer Sicherung; Unbrauchbares fällt heraus)
// ---------------------------------------------------------------------------

function leseSub(x: unknown): Skr42SubCategory | null {
  if (!istObjekt(x) || typeof x.code !== 'string' || !x.code.trim()) return null;
  const code = x.code.trim();
  const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : code;
  const label = typeof x.label === 'string' && x.label.trim() ? x.label.trim() : kontoText(code, name);
  const ust = STEUERSAETZE.includes(x.vatRateDefault as Steuersatz) ? (x.vatRateDefault as Steuersatz) : 0;
  return { code, name, label, vatRateDefault: ust, isCustom: true };
}

export function leseEigeneKonten(roh: unknown): EigeneKonten {
  if (!istObjekt(roh)) return { customMainCategories: [], customSubCategories: [] };
  const haupt: Skr42MainCategory[] = [];
  for (const m of Array.isArray(roh.customMainCategories) ? roh.customMainCategories : []) {
    if (!istObjekt(m) || typeof m.code !== 'string' || !m.code.trim()) continue;
    const code = m.code.trim();
    const subs = (Array.isArray(m.subCategories) ? m.subCategories : []).map(leseSub).filter((s): s is Skr42SubCategory => s !== null);
    haupt.push({
      id: typeof m.id === 'string' && m.id ? m.id : `HK-${code}-CUSTOM`,
      code,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : code,
      type: m.type === 'expense' ? 'expense' : 'income',
      subCategories: subs,
      isCustom: true,
    });
  }
  const unter: EigeneKonten['customSubCategories'] = [];
  for (const u of Array.isArray(roh.customSubCategories) ? roh.customSubCategories : []) {
    if (!istObjekt(u) || typeof u.mainCatIdOrCode !== 'string') continue;
    const sub = leseSub(u.subCategory);
    if (sub) unter.push({ mainCatIdOrCode: u.mainCatIdOrCode, subCategory: sub });
  }
  return { customMainCategories: haupt, customSubCategories: unter };
}

export function leseAnpassungen(roh: unknown): Skr42Anpassungen {
  const ergebnis: Skr42Anpassungen = { nummernkreise: {}, konten: {} };
  if (!istObjekt(roh)) return ergebnis;
  if (istObjekt(roh.nummernkreise)) {
    for (const [code, a] of Object.entries(roh.nummernkreise)) {
      if (!istObjekt(a)) continue;
      const e: NummernkreisAnpassung = {};
      if (typeof a.name === 'string' && a.name.trim()) e.name = a.name.trim();
      if (a.ausgeblendet === true) e.ausgeblendet = true;
      if (Object.keys(e).length) ergebnis.nummernkreise[code] = e;
    }
  }
  if (istObjekt(roh.konten)) {
    for (const [code, a] of Object.entries(roh.konten)) {
      if (!istObjekt(a)) continue;
      const e: KontoAnpassung = {};
      if (typeof a.name === 'string' && a.name.trim()) e.name = a.name.trim();
      if (STEUERSAETZE.includes(a.vatRateDefault as Steuersatz)) e.vatRateDefault = a.vatRateDefault as Steuersatz;
      if (a.ausgeblendet === true) e.ausgeblendet = true;
      if (Object.keys(e).length) ergebnis.konten[code] = e;
    }
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Der wirksame Kontenrahmen
// ---------------------------------------------------------------------------

/**
 * Setzt den Kontenrahmen zusammen: mitgelieferte Liste, eigene Nummernkreise und Konten, darauf die Anpassungen.
 * Alles neu erzeugt (die Eingaben bleiben unverändert) und aufsteigend nach der Nummer sortiert.
 */
export function wirksamerKontenrahmen(
  standard: readonly Skr42MainCategory[],
  eigene: EigeneKonten,
  anpassungen: Skr42Anpassungen
): Skr42MainCategory[] {
  const haupt: Skr42MainCategory[] = standard.map(m => ({ ...m, subCategories: m.subCategories.map(s => ({ ...s })) }));
  for (const m of eigene.customMainCategories) {
    const i = haupt.findIndex(h => h.code === m.code || h.id === m.id);
    const kopie = { ...m, isCustom: true, subCategories: m.subCategories.map(s => ({ ...s, isCustom: true })) };
    if (i >= 0) {
      if (haupt[i].isCustom) haupt[i] = kopie; // ein Standard-Nummernkreis wird nie ersetzt
    } else haupt.push(kopie);
  }
  for (const u of eigene.customSubCategories) {
    const main = haupt.find(h => h.id === u.mainCatIdOrCode || h.code === u.mainCatIdOrCode);
    if (!main) continue;
    if (main.subCategories.some(s => s.code === u.subCategory.code)) continue;
    main.subCategories.push({ ...u.subCategory, isCustom: true });
  }
  for (const m of haupt) {
    const a = anpassungen.nummernkreise[m.code];
    if (a?.name && a.name !== m.name) {
      m.originalName = m.name;
      m.name = a.name;
    }
    if (a?.ausgeblendet) m.ausgeblendet = true;
    for (const s of m.subCategories) {
      const k = anpassungen.konten[s.code];
      if (!k) continue;
      const bisher = kontoBezeichnung(s);
      if (k.name && k.name !== bisher) {
        s.originalName = bisher;
        s.name = k.name;
        s.label = kontoText(s.code, k.name);
      }
      if (k.vatRateDefault !== undefined && k.vatRateDefault !== s.vatRateDefault) {
        s.originalVatRate = s.vatRateDefault;
        s.vatRateDefault = k.vatRateDefault;
      }
      if (k.ausgeblendet) s.ausgeblendet = true;
    }
    m.subCategories.sort((x, y) => nachNummer(x.code, y.code));
  }
  haupt.sort((x, y) => nachNummer(x.code, y.code));
  return haupt;
}

/**
 * Für Auswahllisten: ohne ausgeblendete Nummernkreise und Konten. Was eine Buchung schon verwendet (`behalten`), bleibt
 * sichtbar, damit sie sich weiter bearbeiten lässt.
 */
export function nurSichtbare(
  struktur: readonly Skr42MainCategory[],
  behalten: { nummernkreis?: string; konto?: string } = {}
): Skr42MainCategory[] {
  const bleibtKonto = (s: Skr42SubCategory) =>
    !s.ausgeblendet || (!!behalten.konto && (behalten.konto === s.code || behalten.konto === s.label));
  return struktur
    .map(m => ({ ...m, subCategories: m.subCategories.filter(bleibtKonto) }))
    .filter(m => {
      const gewaehlt = !!behalten.nummernkreis && [m.id, m.code, kontoText(m.code, m.name)].includes(behalten.nummernkreis);
      return gewaehlt || (!m.ausgeblendet && m.subCategories.length > 0);
    });
}

// ---------------------------------------------------------------------------
// Ändern
// ---------------------------------------------------------------------------

/** Fehlermeldung zu einer Bezeichnung, sonst null. */
export function pruefeBezeichnung(name: string): string | null {
  if (!name.trim()) return 'Bitte eine Bezeichnung eingeben.';
  if (name.trim().length > 120) return 'Die Bezeichnung ist zu lang (höchstens 120 Zeichen).';
  return null;
}

/** Fehlermeldung zu einer neuen Nummer, sonst null. Konten- und Nummernkreisnummern sind je für sich eindeutig. */
export function pruefeNeueNummer(code: string, art: 'nummernkreis' | 'konto', struktur: readonly Skr42MainCategory[]): string | null {
  const c = code.trim();
  if (!c) return 'Bitte eine Nummer eingeben.';
  if (!/^\d{4,6}$/.test(c)) return 'Die Nummer besteht aus 4 bis 6 Ziffern.';
  if (art === 'nummernkreis') {
    const da = struktur.find(m => m.code === c);
    if (da) return `Den Nummernkreis ${c} gibt es schon (${da.name}).`;
  } else {
    for (const m of struktur) {
      const da = m.subCategories.find(s => s.code === c);
      if (da) return `Das Konto ${c} gibt es schon (${kontoBezeichnung(da)}).`;
    }
  }
  return null;
}

/**
 * Trägt eine Anpassung ein. Was dem Original entspricht, fällt weg; eine leere Anpassung verschwindet ganz.
 * `original` ist der Stand ohne Anpassung (Bezeichnung ohne Nummer, Steuersatz).
 */
export function mitKontoAnpassung(
  a: Skr42Anpassungen,
  code: string,
  aenderung: KontoAnpassung,
  original: { name: string; vatRateDefault: Steuersatz }
): Skr42Anpassungen {
  const e: KontoAnpassung = { ...a.konten[code], ...aenderung };
  if (e.name !== undefined && (!e.name.trim() || e.name.trim() === original.name)) delete e.name;
  else if (e.name !== undefined) e.name = e.name.trim();
  if (e.vatRateDefault !== undefined && e.vatRateDefault === original.vatRateDefault) delete e.vatRateDefault;
  if (!e.ausgeblendet) delete e.ausgeblendet;
  const konten = { ...a.konten };
  if (Object.keys(e).length) konten[code] = e;
  else delete konten[code];
  return { nummernkreise: { ...a.nummernkreise }, konten };
}

export function mitNummernkreisAnpassung(
  a: Skr42Anpassungen,
  code: string,
  aenderung: NummernkreisAnpassung,
  original: { name: string }
): Skr42Anpassungen {
  const e: NummernkreisAnpassung = { ...a.nummernkreise[code], ...aenderung };
  if (e.name !== undefined && (!e.name.trim() || e.name.trim() === original.name)) delete e.name;
  else if (e.name !== undefined) e.name = e.name.trim();
  if (!e.ausgeblendet) delete e.ausgeblendet;
  const nummernkreise = { ...a.nummernkreise };
  if (Object.keys(e).length) nummernkreise[code] = e;
  else delete nummernkreise[code];
  return { nummernkreise, konten: { ...a.konten } };
}

/** Beim Einspielen mit „Ergänzen“: Vorhandene Anpassungen bleiben, aus der Datei kommt nur hinzu, was hier fehlt. */
export function ergaenzeAnpassungen(vorhanden: Skr42Anpassungen, neu: Skr42Anpassungen): Skr42Anpassungen {
  return {
    nummernkreise: { ...neu.nummernkreise, ...vorhanden.nummernkreise },
    konten: { ...neu.konten, ...vorhanden.konten },
  };
}

/** Beim Einspielen mit „Ergänzen“: eigene Nummernkreise und Konten aus der Datei, die es hier noch nicht gibt. */
export function ergaenzeEigene(vorhanden: EigeneKonten, neu: EigeneKonten): EigeneKonten {
  const haupt = [...vorhanden.customMainCategories];
  for (const m of neu.customMainCategories) if (!haupt.some(h => h.id === m.id || h.code === m.code)) haupt.push(m);
  const unter = [...vorhanden.customSubCategories];
  for (const u of neu.customSubCategories) {
    if (!unter.some(x => x.mainCatIdOrCode === u.mainCatIdOrCode && x.subCategory.code === u.subCategory.code)) unter.push(u);
  }
  return { customMainCategories: haupt, customSubCategories: unter };
}

/** Wie oft ein Konto in Buchungen (samt Teilbuchungen) vorkommt; vor dem Löschen eines eigenen Kontos. */
export function kontoVerwendungen(transaktionen: readonly Transaction[], code: string): number {
  let n = 0;
  for (const t of transaktionen) {
    if (gehoertZuKonto(t, code)) n++;
    else if (t.splits?.some(s => gehoertZuKonto(s, code))) n++;
  }
  return n;
}

/** Wie oft ein Nummernkreis in Buchungen (samt Teilbuchungen) vorkommt; für die Rückfrage vor dem Umbenennen. */
export function nummernkreisVerwendungen(transaktionen: readonly Transaction[], code: string): number {
  let n = 0;
  for (const t of transaktionen) {
    if (gehoertZuNummernkreis(t, code) || t.splits?.some(s => gehoertZuNummernkreis(s, code))) n++;
  }
  return n;
}

function gehoertZuKonto(x: { skrAccount?: string; subCategory?: string }, code: string): boolean {
  if (x.skrAccount) return x.skrAccount === code;
  return !!x.subCategory && (x.subCategory === code || x.subCategory.startsWith(`${code} - `));
}

function gehoertZuNummernkreis(x: { mainCategory?: string }, code: string): boolean {
  return !!x.mainCategory && (x.mainCategory === code || x.mainCategory.startsWith(`${code} - `));
}

/**
 * Neue Bezeichnung in die Buchungen übernehmen (Entscheidung Johannes, 26.11.2026). Liefert nur die geänderten
 * Buchungen, jeweils als neue Objekte; die übrigen Felder bleiben, wie sie sind.
 *  - Konto: `subCategory` und `category` werden „Nummer - neue Bezeichnung“, in der Buchung und in jeder Teilbuchung
 *    dieses Kontos.
 *  - Nummernkreis: `mainCategory` wird „Nummer - neue Bezeichnung“, ebenso.
 */
export function buchungenUmbenennen(
  transaktionen: readonly Transaction[],
  aenderung: { art: 'konto' | 'nummernkreis'; code: string; name: string }
): Transaction[] {
  const text = kontoText(aenderung.code, aenderung.name);
  const geaendert: Transaction[] = [];
  for (const t of transaktionen) {
    let neu: Transaction = t;
    const setze = <T extends Transaction | NonNullable<Transaction['splits']>[number]>(x: T): T => {
      if (aenderung.art === 'konto' && gehoertZuKonto(x, aenderung.code) && (x.subCategory !== text || x.category !== text)) {
        return { ...x, subCategory: text, category: text };
      }
      if (aenderung.art === 'nummernkreis' && gehoertZuNummernkreis(x, aenderung.code) && x.mainCategory !== text) {
        return { ...x, mainCategory: text };
      }
      return x;
    };
    neu = setze(neu);
    if (t.splits?.length) {
      const teile = t.splits.map(setze);
      if (teile.some((s, i) => s !== t.splits![i])) neu = { ...neu, splits: teile };
    }
    if (neu !== t) geaendert.push(neu);
  }
  return geaendert;
}
