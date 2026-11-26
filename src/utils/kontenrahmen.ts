/**
 * Kontenrahmen des Vereins: der mitgelieferte SKR 42, dazu eigene Nummernkreise und Konten und die Anpassungen des
 * Vereins (Nummer, Bezeichnung, Steuersatz-Vorgabe, ausgeblendet).
 *
 * Gleiche Regeln und Texte am Handy: `android/core/.../skr42/Kontenrahmen.kt`, mit denselben Prüffällen.
 *
 * Gespeichert wird beides in den Einstellungen des Vereins und damit in jeder Datensicherung
 * (BACKUP_FORMAT.md, Abschnitt 3):
 *   - `customSkr42Accounts`: die eigenen Nummernkreise und Konten (Format seit November 2026 unverändert)
 *   - `skr42Anpassungen`:   `{ nummernkreise: { "<Schlüssel>": { nummer?, name?, ausgeblendet? } },
 *                             konten:        { "<Schlüssel>": { nummer?, name?, vatRateDefault?, ausgeblendet? } } }`
 *
 * Der Schlüssel ist die ursprüngliche Nummer (mitgeliefert oder beim Anlegen vergeben). Er ändert sich nie, auch wenn
 * der Verein die Nummer ändert (`nummer`); im wirksamen Kontenrahmen steht er dann als `originalCode`. Daran hängen die
 * Anpassungen und die Vorgaben der App („Beiträge auf 40000“, siehe `standardKonto`). Damit Schlüssel eindeutig bleiben,
 * bekommt ein neu angelegtes Konto keine Nummer, die ursprünglich einem anderen gehört (`pruefeNeueNummer`).
 * Die mitgelieferte Liste bleibt unverändert die Grundlage; eine Anpassung lässt sich jederzeit zurücknehmen.
 *
 * Entscheidungen Johannes, 26.11.2026: änderbar sind Nummer, Bezeichnung, Steuersatz-Vorgabe und „ausgeblendet“, auch
 * bei den Standardkonten; eine neue Nummer oder Bezeichnung geht auf alle Buchungen über; bekommt ein Nummernkreis eine
 * neue Nummer, ziehen seine Konten um denselben Abstand mit; Nummernkreise und Konten stehen immer aufsteigend nach der
 * Nummer.
 */
import type { Skr42MainCategory, Skr42SubCategory, Transaction } from '../types';

export type Steuersatz = 0 | 7 | 19;

export interface NummernkreisAnpassung {
  nummer?: string;
  name?: string;
  ausgeblendet?: boolean;
}

export interface KontoAnpassung {
  nummer?: string;
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

const NUMMER = /^\d{4,6}$/;

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
      if (typeof a.nummer === 'string' && NUMMER.test(a.nummer.trim()) && a.nummer.trim() !== code) e.nummer = a.nummer.trim();
      if (typeof a.name === 'string' && a.name.trim()) e.name = a.name.trim();
      if (a.ausgeblendet === true) e.ausgeblendet = true;
      if (Object.keys(e).length) ergebnis.nummernkreise[code] = e;
    }
  }
  if (istObjekt(roh.konten)) {
    for (const [code, a] of Object.entries(roh.konten)) {
      if (!istObjekt(a)) continue;
      const e: KontoAnpassung = {};
      if (typeof a.nummer === 'string' && NUMMER.test(a.nummer.trim()) && a.nummer.trim() !== code) e.nummer = a.nummer.trim();
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
    if (a?.nummer && a.nummer !== m.code) {
      m.originalCode = m.code;
      m.code = a.nummer;
    }
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
      if (k.nummer && k.nummer !== s.code) {
        const bezeichnung = kontoBezeichnung(s);
        s.originalCode = s.code;
        s.code = k.nummer;
        s.label = kontoText(k.nummer, bezeichnung);
      }
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

/** Der feste Schlüssel eines Nummernkreises oder Kontos: die ursprüngliche Nummer (siehe oben). */
export function schluessel(x: Pick<Skr42SubCategory, 'code' | 'originalCode'>): string {
  return x.originalCode ?? x.code;
}

/**
 * Ein mitgeliefertes Konto über seine ursprüngliche Nummer, wo auch immer es heute steht. Für die Vorgaben der App
 * (Beiträge 40000, Spenden 40450, Rechnungen, zweite Teilzeile 68500 …): Hat der Verein das Konto umnummeriert, bucht
 * die App auf die neue Nummer.
 */
export function standardKonto(
  code: string,
  struktur: readonly Skr42MainCategory[]
): { main: Skr42MainCategory; sub: Skr42SubCategory } | null {
  for (const main of struktur) {
    const sub = main.subCategories.find(s => !s.isCustom && schluessel(s) === code);
    if (sub) return { main, sub };
  }
  return null;
}

/** Ein mitgelieferter Nummernkreis über seine ursprüngliche Nummer (wie `standardKonto`). */
export function standardNummernkreis(code: string, struktur: readonly Skr42MainCategory[]): Skr42MainCategory | null {
  return struktur.find(m => !m.isCustom && schluessel(m) === code) ?? null;
}

/**
 * Fehlermeldung zu einer neuen Nummer, sonst null. Konten- und Nummernkreisnummern sind je für sich eindeutig.
 *  - `ausgenommen`: Schlüssel der Einträge, die gerade selbst eine neue Nummer bekommen (sie zählen nicht als belegt).
 *  - `anlegen` (Vorgabe): Die Nummer wird Schlüssel eines neuen Eintrags; dann darf sie auch nicht die ursprüngliche
 *    Nummer eines anderen sein. Beim Umnummerieren gilt das nicht, dort zählt nur, was heute belegt ist.
 */
export function pruefeNeueNummer(
  code: string,
  art: 'nummernkreis' | 'konto',
  struktur: readonly Skr42MainCategory[],
  optionen: { ausgenommen?: readonly string[]; anlegen?: boolean } = {}
): string | null {
  const c = code.trim();
  if (!c) return 'Bitte eine Nummer eingeben.';
  if (!NUMMER.test(c)) return 'Die Nummer besteht aus 4 bis 6 Ziffern.';
  const ausgenommen = optionen.ausgenommen ?? [];
  const eintraege = (
    art === 'nummernkreis'
      ? struktur.map(m => ({ code: m.code, key: schluessel(m), text: m.name }))
      : struktur.flatMap(m => m.subCategories.map(s => ({ code: s.code, key: schluessel(s), text: kontoBezeichnung(s) })))
  ).filter(e => !ausgenommen.includes(e.key));
  const da = eintraege.find(e => e.code === c);
  if (da) return art === 'nummernkreis' ? `Den Nummernkreis ${c} gibt es schon (${da.text}).` : `Das Konto ${c} gibt es schon (${da.text}).`;
  if (optionen.anlegen !== false) {
    const vorbehalten = eintraege.find(e => e.key === c);
    if (vorbehalten) {
      return `Die Nummer ${c} gehört ursprünglich ${art === 'nummernkreis' ? 'zum Nummernkreis' : 'zum Konto'} „${vorbehalten.text}“ ` +
        `(heute ${vorbehalten.code}) und bleibt dafür frei. Bitte eine andere wählen.`;
    }
  }
  return null;
}

/**
 * Trägt eine Anpassung ein. Was dem Original entspricht, fällt weg; eine leere Anpassung verschwindet ganz.
 * `code` ist der Schlüssel (ursprüngliche Nummer), `original` der Stand ohne Anpassung (Bezeichnung ohne Nummer,
 * Steuersatz).
 */
export function mitKontoAnpassung(
  a: Skr42Anpassungen,
  code: string,
  aenderung: KontoAnpassung,
  original: { name: string; vatRateDefault: Steuersatz }
): Skr42Anpassungen {
  const e: KontoAnpassung = { ...a.konten[code], ...aenderung };
  if (e.nummer !== undefined && (!e.nummer.trim() || e.nummer.trim() === code)) delete e.nummer;
  else if (e.nummer !== undefined) e.nummer = e.nummer.trim();
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
  if (e.nummer !== undefined && (!e.nummer.trim() || e.nummer.trim() === code)) delete e.nummer;
  else if (e.nummer !== undefined) e.nummer = e.nummer.trim();
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
 * Was eine Änderung im Kontenrahmen für die Buchungen bedeutet (Entscheidung Johannes, 26.11.2026): Jede neue Nummer
 * und jede neue Bezeichnung geht auf alle Buchungen über. Verglichen wird der Kontenrahmen vorher und nachher über den
 * festen Schlüssel; so deckt eine Funktion Umbenennen, Umnummerieren, das Verschieben eines ganzen Nummernkreises und
 * das Zurücksetzen ab, auch mehrere zugleich.
 *  - Konto: `subCategory` und `category` werden „Nummer - Bezeichnung“, `skrAccount` die neue Nummer, in der Buchung
 *    und in jeder Teilbuchung dieses Kontos.
 *  - Nummernkreis: `mainCategory` wird „Nummer - Bezeichnung“, ebenso.
 * Liefert nur die geänderten Buchungen, jeweils als neue Objekte; die übrigen Felder bleiben, wie sie sind.
 */
export function buchungenAngleichen(
  transaktionen: readonly Transaction[],
  vorher: readonly Skr42MainCategory[],
  nachher: readonly Skr42MainCategory[]
): Transaction[] {
  const kontoNeu = new Map<string, Skr42SubCategory>();
  for (const m of nachher) for (const s of m.subCategories) kontoNeu.set(schluessel(s), s);
  const kreisNeu = new Map<string, Skr42MainCategory>();
  for (const m of nachher) kreisNeu.set(schluessel(m), m);

  // alte Nummer → neuer Text (nur, was sich geändert hat)
  const konten = new Map<string, { code: string; text: string }>();
  for (const m of vorher) {
    for (const s of m.subCategories) {
      const n = kontoNeu.get(schluessel(s));
      if (n && (n.code !== s.code || kontoBezeichnung(n) !== kontoBezeichnung(s))) {
        konten.set(s.code, { code: n.code, text: kontoText(n.code, kontoBezeichnung(n)) });
      }
    }
  }
  const kreise = new Map<string, string>();
  for (const m of vorher) {
    const n = kreisNeu.get(schluessel(m));
    if (n && (n.code !== m.code || n.name !== m.name)) kreise.set(m.code, kontoText(n.code, n.name));
  }
  if (!konten.size && !kreise.size) return [];

  const nummerVorne = (text?: string) => (text ? text.split(' - ')[0].trim() : '');
  const geaendert: Transaction[] = [];
  for (const t of transaktionen) {
    const setze = <T extends Transaction | NonNullable<Transaction['splits']>[number]>(x: T): T => {
      let y = x;
      const k = konten.get(x.skrAccount || nummerVorne(x.subCategory));
      if (k && (x.subCategory !== k.text || x.category !== k.text || (x.skrAccount !== undefined && x.skrAccount !== k.code))) {
        y = { ...y, subCategory: k.text, category: k.text, ...(x.skrAccount !== undefined ? { skrAccount: k.code } : {}) };
      }
      const nk = kreise.get(nummerVorne(x.mainCategory));
      if (nk && x.mainCategory !== nk) y = { ...y, mainCategory: nk };
      return y;
    };
    let neu: Transaction = setze(t);
    if (t.splits?.length) {
      const teile = t.splits.map(setze);
      if (teile.some((s, i) => s !== t.splits![i])) neu = { ...neu, splits: teile };
    }
    if (neu !== t) geaendert.push(neu);
  }
  return geaendert;
}

/**
 * Plant eine Änderung an einem Nummernkreis oder Konto, gegeben über seine heutige Nummer. Liefert die neuen
 * Anpassungen oder eine Fehlermeldung. Bekommt ein Nummernkreis eine neue Nummer, ziehen alle seine Konten (auch
 * ausgeblendete und eigene) um denselben Abstand mit; jede neue Nummer muss frei sein.
 */
export function planeAenderung(
  struktur: readonly Skr42MainCategory[],
  anpassungen: Skr42Anpassungen,
  art: 'konto' | 'nummernkreis',
  code: string,
  aenderung: KontoAnpassung
): { anpassungen: Skr42Anpassungen } | { fehler: string } {
  if (aenderung.name !== undefined) {
    const f = pruefeBezeichnung(aenderung.name);
    if (f) return { fehler: f };
  }
  const nummer = aenderung.nummer?.trim();
  if (art === 'konto') {
    let gefunden: Skr42SubCategory | undefined;
    for (const m of struktur) gefunden ??= m.subCategories.find(s => s.code === code);
    if (!gefunden) return { fehler: `Das Konto ${code} gibt es nicht.` };
    const s = gefunden;
    const key = schluessel(s);
    if (nummer !== undefined && nummer !== s.code) {
      const f = pruefeNeueNummer(nummer, 'konto', struktur, { ausgenommen: [key], anlegen: false });
      if (f) return { fehler: f };
    }
    return {
      anpassungen: mitKontoAnpassung(anpassungen, key, nummer !== undefined ? { ...aenderung, nummer } : aenderung, {
        name: s.originalName ?? kontoBezeichnung(s),
        vatRateDefault: s.originalVatRate ?? s.vatRateDefault,
      }),
    };
  }
  const m = struktur.find(x => x.code === code);
  if (!m) return { fehler: `Den Nummernkreis ${code} gibt es nicht.` };
  const key = schluessel(m);
  const kreisAenderung: NummernkreisAnpassung = {};
  if (aenderung.name !== undefined) kreisAenderung.name = aenderung.name;
  if (aenderung.ausgeblendet !== undefined) kreisAenderung.ausgeblendet = aenderung.ausgeblendet;
  let a = anpassungen;
  if (nummer !== undefined && nummer !== m.code) {
    const f = pruefeNeueNummer(nummer, 'nummernkreis', struktur, { ausgenommen: [key], anlegen: false });
    if (f) return { fehler: f };
    const abstand = Number(nummer) - Number(m.code);
    const eigeneKonten = m.subCategories.map(schluessel);
    for (const s of m.subCategories) {
      const neu = String(Number(s.code) + abstand);
      if (!NUMMER.test(neu)) {
        return { fehler: `Das Konto ${s.code} käme dabei auf ${neu}; Kontonummern haben 4 bis 6 Ziffern. Bitte eine andere Nummer wählen.` };
      }
      const f2 = pruefeNeueNummer(neu, 'konto', struktur, { ausgenommen: eigeneKonten, anlegen: false });
      if (f2) return { fehler: `Das Konto ${s.code} käme dabei auf ${neu}: ${f2}` };
      a = mitKontoAnpassung(a, schluessel(s), { nummer: neu }, {
        name: s.originalName ?? kontoBezeichnung(s),
        vatRateDefault: s.originalVatRate ?? s.vatRateDefault,
      });
    }
  }
  return {
    anpassungen: mitNummernkreisAnpassung(a, key, nummer !== undefined ? { ...kreisAenderung, nummer } : kreisAenderung, {
      name: m.originalName ?? m.name,
    }),
  };
}
