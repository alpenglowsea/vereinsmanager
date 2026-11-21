/**
 * Regeln für das Inventar (P23/P24), wie Android `Inventar.kt`.
 *
 * Wert, Kennzahlen, Filter, Prüfung der Eingaben, Sammelbearbeitung und das
 * CSV-Format stehen hier an einer Stelle; Liste, Formular, PDF, CSV und die
 * Dashboard-Kachel rechnen damit gleich (D-101).
 */
import { InventoryBulkUpdates, InventoryItem, MemberInventoryAssignment } from '../types';
import { INVENTORY_CATEGORIES, CONDITION_OPTIONS } from '../data/inventoryCategories';
import { leseBetrag } from './importRegeln';

export const PRUEFTAGE = 30;
/** Höchstgröße des Fotos als Data-URL (wie Android). */
export const FOTO_MAX_ZEICHEN = 1_500_000;
/** Längste Seite des Fotos in Pixeln (wie Android). */
export const FOTO_MAX_PIXEL = 1024;
export const WERT_HINWEIS = 'Wert = Zeitwert, sonst Anschaffungspreis, mal Menge. Ausgemustertes zählt nicht mit.';

const ARTEN = new Set<string>(INVENTORY_CATEGORIES.map(c => c.id));
const ZUSTAENDE = new Map<string, string>(CONDITION_OPTIONS.map(c => [c.value, c.label]));
export const artName = (a: string) => INVENTORY_CATEGORIES.find(c => c.id === a)?.label ?? a;
export const zustandName = (z: string) => ZUSTAENDE.get(z) ?? z;

const istDatum = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z'));
const datumOk = (d: string | undefined) => !d || istDatum(d);
const zahlOderNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const cent = (v: number) => Math.round(v * 100);

export const ausgemustert = (a: Pick<InventoryItem, 'condition'>) => a.condition === 'discarded';
export const menge = (a: Pick<InventoryItem, 'quantity'>) => Math.max(1, Math.floor(Number(a.quantity) || 1));

/** Wert je Stück: Zeitwert, sonst Anschaffungspreis. Ein Zeitwert von 0 € ist ein Wert und gilt nicht als „fehlt“. */
export const stueckwert = (a: Pick<InventoryItem, 'currentValue' | 'purchasePrice'>): number | null =>
  zahlOderNull(a.currentValue) ?? zahlOderNull(a.purchasePrice);

/** Wert aller Stücke in Euro (in Cent gerechnet); ohne Angabe 0. */
export const wert = (a: Pick<InventoryItem, 'currentValue' | 'purchasePrice' | 'quantity'>): number =>
  (cent(stueckwert(a) ?? 0) * menge(a)) / 100;

// ---------- Eingaben

/**
 * Betrag in deutscher Schreibweise lesen: „1.234,50“ = 1234,50 (vorher
 * 1,234, D-97). Leer = kein Wert (undefined); negativ oder unlesbar = Fehler.
 */
export function leseInventarBetrag(text: string): { wert?: number; fehler?: string } {
  if (!text.trim()) return {};
  const b = leseBetrag(text);
  if (!b) return { fehler: 'Bitte einen Betrag eingeben, z. B. 1.234,50.' };
  if (b.wert < 0) return { fehler: 'Der Betrag darf nicht negativ sein.' };
  return { wert: b.wert };
}

/** Betrag für das Eingabefeld: „1.234,50“. */
export const betragText = (v: number | undefined | null): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

export interface ArtikelEingabe {
  id?: string;
  name: string;
  nummer: string;
  menge: string;
  art: string;
  zustand: string;
  kaufpreis: string;
  zeitwert: string;
  kaufdatum: string;
  letztePruefung: string;
  naechstePruefung: string;
  foto: string;
}

/** Fehlertexte je Feld (wie Android `Inventar.pruefen`). */
export function pruefeArtikel(f: ArtikelEingabe, vorhandene: Pick<InventoryItem, 'id' | 'itemNumber'>[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Bitte eine Bezeichnung eingeben.';
  const n = f.nummer.trim();
  if (!n) e.nummer = 'Bitte eine Inventarnummer eingeben.';
  else if (vorhandene.some(v => v.id !== f.id && (v.itemNumber || '').trim().toLowerCase() === n.toLowerCase())) {
    e.nummer = 'Diese Inventarnummer gibt es schon.';
  }
  if (!/^\d+$/.test(f.menge.trim()) || Number(f.menge) < 1) e.menge = 'Menge: ganze Zahl ab 1.';
  const kp = leseInventarBetrag(f.kaufpreis);
  if (kp.fehler) e.kaufpreis = kp.fehler;
  const zw = leseInventarBetrag(f.zeitwert);
  if (zw.fehler) e.zeitwert = zw.fehler;
  if (!datumOk(f.kaufdatum)) e.kaufdatum = 'Kaufdatum ist ungültig.';
  if (!datumOk(f.letztePruefung)) e.letztePruefung = 'Datum ist ungültig.';
  if (!datumOk(f.naechstePruefung)) e.naechstePruefung = 'Datum ist ungültig.';
  if (!ARTEN.has(f.art)) e.art = 'Bitte eine Art wählen.';
  if (!ZUSTAENDE.has(f.zustand)) e.zustand = 'Bitte einen Zustand wählen.';
  if (f.foto && (!f.foto.startsWith('data:image/') || f.foto.length > FOTO_MAX_ZEICHEN)) e.foto = 'Das Foto ist ungültig oder zu groß.';
  return e;
}

// ---------- Prüfung, Kennzahlen, Filter

/** Datum als JJJJ-MM-TT plus n Tage (ohne Zeitzone). */
function plusTage(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const ueberfaellig = (a: InventoryItem, heute: string) =>
  !ausgemustert(a) && !!a.nextInspectionDate && istDatum(a.nextInspectionDate) && a.nextInspectionDate < heute;
export const pruefungBald = (a: InventoryItem, heute: string) =>
  !ausgemustert(a) && !!a.nextInspectionDate && istDatum(a.nextInspectionDate) && a.nextInspectionDate <= plusTage(heute, PRUEFTAGE);
export const reparatur = (a: InventoryItem) => a.condition === 'damaged' || a.condition === 'in_repair';

export interface InventarKennzahlen {
  positionen: number;
  einheiten: number;
  wert: number;
  sparten: number;
  reparatur: number;
  ueberfaellig: number;
}

/** Kennzahlen über den Bestand; Ausgemustertes zählt nirgends mit (D-100). */
export function kennzahlen(alle: InventoryItem[], heute: string): InventarKennzahlen {
  const bestand = alle.filter(a => !ausgemustert(a));
  return {
    positionen: bestand.length,
    einheiten: bestand.reduce((s, a) => s + menge(a), 0),
    wert: bestand.reduce((s, a) => s + cent(wert(a)), 0) / 100,
    sparten: new Set(bestand.map(a => a.department || 'Gesamtverein')).size,
    reparatur: bestand.filter(reparatur).length,
    ueberfaellig: bestand.filter(a => ueberfaellig(a, heute)).length
  };
}

/**
 * Ausgemustertes erscheint nur, wenn der Zustandsfilter „Ausgemustert“
 * gewählt ist (wie Android). `zustand`/`sparte`/`art` null = alle.
 */
export function sichtbar(a: InventoryItem, zustand: string | null): boolean {
  return zustand === 'discarded' || !ausgemustert(a);
}

/** Gegenstände, die an Mitglieder ausgegeben werden können (D-106). */
export const ausgebbar = (alle: InventoryItem[]) => alle.filter(a => !ausgemustert(a));

/** Wie viele Stücke je Gegenstand gerade ausgegeben (nicht zurückgegeben) sind. */
export function ausgegeben(ausgaben: MemberInventoryAssignment[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of ausgaben) {
    if (a.status === 'returned') continue;
    m.set(a.inventoryItemId, (m.get(a.inventoryItemId) || 0) + (Number(a.quantity) || 0));
  }
  return m;
}

/**
 * Wer den Gegenstand gerade hat: die nicht zurückgegebenen Ausgaben, neueste
 * zuerst (wie Android `MemberMaterial.offeneVon`).
 */
export function ausgabenVon(itemId: string, ausgaben: MemberInventoryAssignment[]): MemberInventoryAssignment[] {
  return ausgaben
    .filter(a => a.inventoryItemId === itemId && a.status !== 'returned')
    .sort((x, y) => (y.issueDate || '').localeCompare(x.issueDate || '') || (y.id < x.id ? -1 : y.id > x.id ? 1 : 0));
}

/** Rückgabe eintragen (wie Android `MemberMaterial.umschalten` bei einer offenen Ausgabe). */
export const zurueckgeben = (a: MemberInventoryAssignment, heute: string, jetzt: string): MemberInventoryAssignment => ({
  ...a,
  status: 'returned',
  returnDate: heute,
  updatedAt: jetzt
});

/** „Heute geprüft“: setzt nur das Datum der letzten Prüfung (wie Android `Inventar.geprueft`). */
export const geprueftAm = (a: InventoryItem, heute: string, jetzt: string): InventoryItem => ({ ...a, lastCheckedDate: heute, updatedAt: jetzt });

// ---------- Sammelbearbeitung (D-103)

/**
 * Prüft eine Sammeländerung. Angehakt + leer heißt bei freiwilligen Feldern
 * „leeren“; der Standort darf aber nicht leer werden, und eine Notiz braucht
 * Text (wie Android).
 */
export function pruefeSammelFeld(u: InventoryBulkUpdates): { feld: string; text: string } | null {
  const felder = ['department', 'category', 'condition', 'location', 'responsiblePerson', 'assignedTo', 'supplier', 'lastCheckedDate', 'nextInspectionDate', 'notesValue'] as const;
  if (felder.every(k => u[k] === undefined)) return { feld: '', text: 'Bitte mindestens eine Änderung wählen.' };
  if (u.location !== undefined && !u.location.trim()) return { feld: 'location', text: 'Der Standort darf nicht leer sein.' };
  if (u.department !== undefined && !u.department.trim()) return { feld: 'department', text: 'Bitte eine Sparte wählen.' };
  if (u.category !== undefined && !ARTEN.has(u.category)) return { feld: 'category', text: 'Bitte eine Art wählen.' };
  if (u.condition !== undefined && !ZUSTAENDE.has(u.condition)) return { feld: 'condition', text: 'Bitte einen Zustand wählen.' };
  if (u.lastCheckedDate !== undefined && !datumOk(u.lastCheckedDate)) return { feld: 'lastCheckedDate', text: 'Das Datum der letzten Prüfung ist ungültig.' };
  if (u.nextInspectionDate !== undefined && !datumOk(u.nextInspectionDate)) return { feld: 'nextInspectionDate', text: 'Das Datum der nächsten Prüfung ist ungültig.' };
  if (u.notesValue !== undefined && !u.notesValue.trim()) return { feld: 'notesValue', text: 'Bitte eine Notiz eingeben oder die Änderung abwählen.' };
  return null;
}

/** Wie `pruefeSammelFeld`, nur der Text. */
export const pruefeSammel = (u: InventoryBulkUpdates): string | null => pruefeSammelFeld(u)?.text ?? null;

/** Wendet die Sammeländerung auf einen Gegenstand an; null, wenn sich nichts ändert. */
export function wendeSammelAn(item: InventoryItem, u: InventoryBulkUpdates, jetzt: string): InventoryItem | null {
  const neu: InventoryItem = { ...item };
  const setze = <K extends keyof InventoryItem>(k: K, v: string | undefined) => {
    if (v === undefined) return;
    const w = v.trim();
    if (w) (neu as unknown as Record<string, unknown>)[k] = w;
    else delete (neu as unknown as Record<string, unknown>)[k];
  };
  if (u.department !== undefined) neu.department = u.department.trim();
  if (u.category !== undefined) neu.category = u.category;
  if (u.condition !== undefined) neu.condition = u.condition;
  if (u.location !== undefined) neu.location = u.location.trim();
  // Angehakt + leer = Feld leeren (vorher wurden Zuständig und Standort dann still übergangen)
  setze('responsiblePerson', u.responsiblePerson);
  setze('assignedTo', u.assignedTo);
  setze('supplier', u.supplier);
  setze('lastCheckedDate', u.lastCheckedDate);
  setze('nextInspectionDate', u.nextInspectionDate);
  if (u.notesValue !== undefined && u.notesValue.trim()) {
    const alt = item.notes || '';
    neu.notes = u.notesAction !== 'replace' && alt ? `${alt}\n${u.notesValue.trim()}` : u.notesValue.trim();
  }
  if (JSON.stringify(neu) === JSON.stringify(item)) return null;
  return { ...neu, updatedAt: jetzt };
}

// ---------- CSV (D-102): ein Format wie Android

export const CSV_KOPF = [
  'Inventar-Nr.', 'Bezeichnung', 'Kategorie', 'Sparte / Abteilung', 'Menge', 'Einheit', 'Standort', 'Zustand', 'Anschaffungsdatum',
  'Anschaffungspreis (EUR)', 'Zeitwert (EUR)', 'Lieferant / Hersteller', 'Zuständige Person', 'Im Einsatz bei', 'Seriennummer',
  'Letzte Prüfung', 'Nächste Prüfung', 'Aktuell ausgegeben', 'Notizen'
];

const BOM = '\uFEFF';

function csvFeld(s: string): string {
  const q = s.replace(/"/g, '""');
  const braucht = /[\r\n";]/.test(q) || q.includes(BOM) || q.startsWith(' ') || q.endsWith(' ');
  return braucht ? `"${q}"` : q;
}

const fest2 = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? (cent(v) / 100).toFixed(2) : '');

/**
 * CSV wie Android `Inventar.csv`: Semikolon, Punkt als Dezimalzeichen,
 * 19 Spalten mit „Aktuell ausgegeben“. Ohne Gegenstände nur die Kennung
 * am Anfang (wie Android).
 */
export function inventarCsv(liste: InventoryItem[], aus: Map<string, number> = new Map()): string {
  if (!liste.length) return BOM;
  const zeilen = liste.map(a => [
    a.itemNumber || '', a.name || '', artName(a.category), a.department || 'Gesamtverein', String(menge(a)), a.unit || 'Stk.',
    a.location || '', zustandName(a.condition), a.purchaseDate || '', fest2(a.purchasePrice), fest2(a.currentValue), a.supplier || '',
    a.responsiblePerson || '', a.assignedTo || '', a.serialNumber || '', a.lastCheckedDate || '', a.nextInspectionDate || '',
    String(aus.get(a.id) || 0), (a.notes || '').replace(/\r\n|\n|\r/g, ' ')
  ]);
  return BOM + [CSV_KOPF, ...zeilen].map(z => z.map(csvFeld).join(';')).join('\r\n');
}
