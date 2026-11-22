/**
 * Jahresarchiv (Runde 2, R4) – Rechenkern ohne Oberfläche.
 * ---------------------------------------------------------------------------
 *
 * Damit die Sicherung über die Jahre nicht immer größer wird, wandern die
 * Dateien eines abgeschlossenen Jahres aus dem Bestand in eine eigene
 * Archivdatei (ZIP). Die Einträge selbst (Buchung, Rechnung, Spende,
 * Gegenstand) bleiben vollständig im Bestand und auswertbar; an ihnen steht
 * nur noch ein Vermerk, in welchem Archiv die Datei liegt
 * (BACKUP_FORMAT.md, Abschnitt 9).
 *
 * Was ins Archiv eines Jahres gehört (Entscheidung Johannes, 22.11.2026):
 *
 *   Art           Datei                                  Jahr nach
 *   beleg         Beleg an einer Buchung und das          Buchungsdatum
 *                 gleiche Dokument „Beleg: …“; sonstige
 *                 Belege in der Dokumentenablage          Dokumentdatum
 *   rechnung      PDF einer ausgestellten Rechnung        Rechnungsdatum
 *   spende        PDF einer Zuwendungsbestätigung         Tag der Zuwendung
 *   inventarfoto  Foto eines ausgemusterten Gegenstands   „Ausgemustert am“,
 *                                                         sonst letzte Änderung
 *
 * Nicht ins Archiv: Satzung, Protokolle, Verträge und andere Dokumente,
 * Mitgliederfotos, Unterschriften, Logo und Briefpapier.
 *
 * Ablauf (die Oberfläche kommt in R4b):
 *   1. `archivJahre` / `planeArchiv`: was hinausginge, wie groß, Fristen.
 *   2. `erstelleArchiv`: ZIP schreiben (auf Wunsch mit Passwort).
 *   3. `leseArchiv` + `pruefeArchiv`: das gespeicherte Archiv zurücklesen
 *      und jede Prüfsumme vergleichen.
 *   4. `wendeArchivAn`: erst danach Dateien aus dem Bestand nehmen und
 *      vermerken – nur, wenn die Datei im Bestand noch genau die im Archiv ist.
 *   5. Später: `dateiAusArchiv` zeigt eine einzelne Datei, `holeArchivZurueck`
 *      stellt ein ganzes Jahr wieder her.
 *
 * Nichts hier speichert etwas. Die Funktionen geben geänderte Kopien zurück;
 * das Speichern übernimmt die Oberfläche.
 */
import type { ArchivVermerk, ClubDocument, ClubInvoice, DocumentFolder, DonationReceipt, InventoryItem, Transaction } from '../types';
import { bereinigen, paketInhalt } from './backupPaketSchreiben';
import { schreibeZip, type PaketDatei } from '../utils/zipSchreiben';
import { oeffneZip, type ZipEintrag } from '../utils/zipReader';
import { sha256HexBytes } from '../utils/sha256';

export const ARCHIV_JSON = 'archiv.json';
export const ARCHIV_CSV = 'Inhaltsverzeichnis.csv';
export const ARCHIV_FORMAT = 'VereinsManager-Jahresarchiv';
export const ARCHIV_VERSION = '1.0.0';
/** archiv.json größer als das gilt als unplausibel (wie bei der Sicherung). */
const MAX_JSON_BYTES = 64 * 1024 * 1024;

export type ArchivArt = 'beleg' | 'rechnung' | 'spende' | 'inventarfoto';
export type ArchivBereich = 'transactions' | 'documents' | 'inventory';

/** Die Teile des Bestands, die das Archiv braucht. */
export interface ArchivBestand {
  transactions: Transaction[];
  documents: ClubDocument[];
  invoices: ClubInvoice[];
  donations: DonationReceipt[];
  inventory: InventoryItem[];
  folders: DocumentFolder[];
}

/** Eine Datei im Bestand, die in ein Jahresarchiv gehört. */
export interface ArchivKandidat {
  art: ArchivArt;
  bereich: ArchivBereich;
  /** Kennung des Eintrags (Buchung, Dokument, Gegenstand) */
  id: string;
  jahr: number;
  datum: string;
  belegnummer?: string;
  betrag?: number;
  bezeichnung: string;
  typ: string;
  /** Größe der Datei in Bytes */
  groesse: number;
}

export interface Aufbewahrung {
  art: ArchivArt;
  bezeichnung: string;
  /** Jahre ab Ende des Kalenderjahres; null = keine gesetzliche Frist */
  jahre: number | null;
  /** Letzter Tag der Aufbewahrung (JJJJ-MM-TT); null = keine gesetzliche Frist */
  bis: string | null;
  grundlage: string;
}

/** Eine Datei im Archiv. */
export interface ArchivDatei {
  pfad: string;
  sha256: string;
  groesse: number;
  typ: string;
}

/** Ein Eintrag des Bestands, dessen Datei im Archiv liegt. */
export interface ArchivEintrag {
  art: ArchivArt;
  bereich: ArchivBereich;
  id: string;
  pfad: string;
  datum: string;
  belegnummer?: string;
  betrag?: number;
  bezeichnung: string;
}

/** Inhalt von archiv.json */
export interface ArchivKopf {
  format: typeof ARCHIV_FORMAT;
  version: string;
  kennung: string;
  verein: string;
  jahr: number;
  erstelltAm: string;
  aufbewahrung: Aufbewahrung[];
  dateien: ArchivDatei[];
  eintraege: ArchivEintrag[];
}

export class ArchivFehler extends Error {}

// ------------------------------------------------------------------ Hilfen

const jahrVon = (datum: string | undefined): number | null => {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(datum ?? '');
  return m ? Number(m[1]) : null;
};

/** Base64-Teil einer Data-URL mit Inhalt; sonst null (leer, Internetadresse, kaputt). */
function base64Teil(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('data:')) return null;
  const komma = url.indexOf(',');
  if (komma < 0) return null;
  if (!url.slice(5, komma).split(';').some(t => t.toLowerCase() === 'base64')) return null;
  const b64 = url.slice(komma + 1).replace(/\s+/g, '');
  return b64 !== '' && /^[A-Za-z0-9+/]*={0,2}$/.test(b64) ? b64 : null;
}

const mimeVon = (url: string): string => {
  const kopf = url.slice(5, url.indexOf(','));
  return kopf.split(';')[0] || 'application/octet-stream';
};

const groesseAusBase64 = (b64: string): number => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

function ausBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function zuBase64(bytes: Uint8Array): string {
  let binaer = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binaer);
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// ------------------------------------------------------------------ Fristen

const FRISTEN: Record<ArchivArt, { bezeichnung: string; jahre: number | null; grundlage: string }> = {
  beleg: { bezeichnung: 'Buchungsbelege', jahre: 8, grundlage: '§ 147 Abs. 3 AO (seit 2025: 8 Jahre)' },
  rechnung: { bezeichnung: 'Ausgestellte Rechnungen', jahre: 8, grundlage: '§ 147 Abs. 3 AO, § 14b UStG (seit 2025: 8 Jahre)' },
  spende: {
    bezeichnung: 'Doppel der Zuwendungsbestätigungen',
    jahre: 10,
    grundlage: '§ 50 Abs. 7 EStDV (keine eigene Frist genannt; vorsichtshalber 10 Jahre)'
  },
  inventarfoto: { bezeichnung: 'Fotos ausgemusterter Gegenstände', jahre: null, grundlage: 'keine gesetzliche Aufbewahrungspflicht' }
};

/** Aufbewahrung für eine Art und ein Jahr; die Frist beginnt mit dem Ende des Kalenderjahres. */
export function aufbewahrung(art: ArchivArt, jahr: number): Aufbewahrung {
  const f = FRISTEN[art];
  return { art, bezeichnung: f.bezeichnung, jahre: f.jahre, bis: f.jahre === null ? null : `${jahr + f.jahre}-12-31`, grundlage: f.grundlage };
}

/** Das späteste Ende aller Fristen eines Archivs (null, wenn keine gilt). */
export function aufbewahrenBis(liste: Aufbewahrung[]): string | null {
  const daten = liste.map(a => a.bis).filter((b): b is string => b !== null).sort();
  return daten.length ? daten[daten.length - 1] : null;
}

// ------------------------------------------------------------------ Was gehört ins Archiv?

/** Alle Dateien des Bestands, die in ein Jahresarchiv gehören (alle Jahre). */
export function archivKandidaten(b: ArchivBestand): ArchivKandidat[] {
  const aus: ArchivKandidat[] = [];
  const buchungen = new Map(b.transactions.map(t => [t.id, t]));
  const rechnungen = new Map(b.invoices.map(r => [r.id, r]));
  const spenden = new Map(b.donations.map(s => [s.id, s]));
  const rechnungZuDok = new Map(b.invoices.filter(r => r.documentId).map(r => [r.documentId as string, r]));
  const spendeZuDok = new Map(b.donations.filter(s => s.documentId).map(s => [s.documentId as string, s]));

  // Belege an Buchungen
  for (const t of b.transactions) {
    const r = t.receipt;
    if (!r || r.archiv) continue;
    const b64 = base64Teil(r.dataUrl);
    const jahr = jahrVon(t.date);
    if (!b64 || jahr === null) continue;
    aus.push({
      art: 'beleg',
      bereich: 'transactions',
      id: t.id,
      jahr,
      datum: t.date,
      belegnummer: t.documentNumber || undefined,
      betrag: zahl(t.amount),
      bezeichnung: [t.partner, t.bookingText].filter(Boolean).join(' – ') || 'Beleg',
      typ: r.type || mimeVon(r.dataUrl),
      groesse: groesseAusBase64(b64)
    });
  }

  // Dokumente: Belege, Rechnungs- und Spenden-PDFs
  for (const d of b.documents) {
    if (d.archiv) continue;
    const b64 = base64Teil(d.dataUrl);
    if (!b64) continue;
    const rechnung = rechnungZuDok.get(d.id) ?? (d.id.startsWith('doc-inv-') ? rechnungen.get(d.id.slice(8)) : undefined);
    const spende = spendeZuDok.get(d.id) ?? (d.id.startsWith('doc-don-') ? spenden.get(d.id.slice(8)) : undefined);
    const buchungsId = d.transactionId || (d.id.startsWith('doc-receipt-') ? d.id.slice(12) : '');
    const buchung = buchungsId ? buchungen.get(buchungsId) : undefined;
    let k: Omit<ArchivKandidat, 'jahr' | 'typ' | 'groesse' | 'bereich' | 'id'> | null = null;
    if (rechnung) {
      k = { art: 'rechnung', datum: rechnung.date, belegnummer: rechnung.invoiceNumber, betrag: zahl(rechnung.totalAmount), bezeichnung: `Rechnung an ${rechnung.recipientName}` };
    } else if (spende) {
      k = { art: 'spende', datum: spende.date, belegnummer: spende.receiptNumber, betrag: zahl(spende.amount), bezeichnung: `Zuwendungsbestätigung für ${spende.donorName}` };
    } else if (d.isReceipt || d.category === 'belege') {
      k = buchung
        ? { art: 'beleg', datum: buchung.date, belegnummer: buchung.documentNumber || undefined, betrag: zahl(buchung.amount), bezeichnung: d.title || 'Beleg' }
        : { art: 'beleg', datum: d.date, belegnummer: d.transactionDocNumber || undefined, bezeichnung: d.title || 'Beleg' };
    }
    const jahr = k ? jahrVon(k.datum) : null;
    if (!k || jahr === null) continue;
    aus.push({ ...k, bereich: 'documents', id: d.id, jahr, typ: d.fileType || mimeVon(d.dataUrl), groesse: groesseAusBase64(b64) });
  }

  // Fotos ausgemusterter Gegenstände
  for (const a of b.inventory) {
    if (a.condition !== 'discarded' || a.photoArchiv) continue;
    const b64 = base64Teil(a.photoUrl);
    const datum = a.retiredAt || (a.updatedAt || '').slice(0, 10);
    const jahr = jahrVon(datum);
    if (!b64 || jahr === null) continue;
    aus.push({
      art: 'inventarfoto',
      bereich: 'inventory',
      id: a.id,
      jahr,
      datum,
      belegnummer: a.itemNumber || undefined,
      bezeichnung: `Foto: ${a.name}`,
      typ: mimeVon(a.photoUrl as string),
      groesse: groesseAusBase64(b64)
    });
  }
  return aus;
}

export interface ArchivJahr {
  jahr: number;
  anzahl: number;
  groesse: number;
  /** Darf archiviert werden? Erst ab dem Vorvorjahr (Entscheidung 22.11.2026). */
  erlaubt: boolean;
  /** Warum (noch) nicht */
  grund?: string;
}

/** Erstes Jahr, das noch nicht archiviert werden darf: das Vorjahr. */
export const juengstesArchivjahr = (heute: string): number => (jahrVon(heute) ?? new Date().getFullYear()) - 2;

export const GRUND_VORJAHR =
  'Für das Vorjahr laufen meist noch Jahresabschluss, Einnahmen-Überschuss-Rechnung, Kassenprüfung und Steuererklärung. Dafür werden die Belege noch gebraucht.';

/** Jahre mit archivierbaren Dateien, neueste zuerst. */
export function archivJahre(b: ArchivBestand, heute: string): ArchivJahr[] {
  const grenze = juengstesArchivjahr(heute);
  const je = new Map<number, ArchivJahr>();
  for (const k of archivKandidaten(b)) {
    const j = je.get(k.jahr) ?? { jahr: k.jahr, anzahl: 0, groesse: 0, erlaubt: k.jahr <= grenze };
    j.anzahl++;
    j.groesse += k.groesse;
    if (!j.erlaubt) j.grund = k.jahr === grenze + 1 ? GRUND_VORJAHR : 'Das laufende Jahr ist noch nicht abgeschlossen.';
    je.set(k.jahr, j);
  }
  return [...je.values()].sort((a, b2) => b2.jahr - a.jahr);
}

export interface ArchivPlan {
  jahr: number;
  kandidaten: ArchivKandidat[];
  /** Summe der Dateigrößen; Dateien, die an Buchung und als Dokument hängen, zählen je Stelle */
  groesse: number;
  aufbewahrung: Aufbewahrung[];
}

export function planeArchiv(b: ArchivBestand, jahr: number): ArchivPlan {
  const kandidaten = archivKandidaten(b).filter(k => k.jahr === jahr);
  const arten = [...new Set(kandidaten.map(k => k.art))];
  return {
    jahr,
    kandidaten,
    groesse: kandidaten.reduce((s, k) => s + k.groesse, 0),
    aufbewahrung: (['beleg', 'rechnung', 'spende', 'inventarfoto'] as ArchivArt[]).filter(a => arten.includes(a)).map(a => aufbewahrung(a, jahr))
  };
}

/** Vorgeschlagener Dateiname: VereinsManager_Archiv_<Verein>_<Jahr>.zip */
export function archivDateiname(verein: string, jahr: number): string {
  const name = (verein.trim() || 'Verein').replace(/\s+/g, '_').slice(0, 60);
  return bereinigen(`VereinsManager_Archiv_${name}_${jahr}.zip`, 120);
}

// ------------------------------------------------------------------ Archiv schreiben

const CSV_KOPF = ['Art', 'Datum', 'Belegnummer', 'Betrag (EUR)', 'Bezeichnung', 'Datei im Archiv', 'SHA-256'];
const ART_NAME: Record<ArchivArt, string> = { beleg: 'Beleg', rechnung: 'Rechnung', spende: 'Zuwendungsbestätigung', inventarfoto: 'Inventarfoto' };

const csvFeld = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const deDatum = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d);
const deBetrag = (v: number | undefined) => (v === undefined ? '' : v.toFixed(2).replace('.', ','));

/** Inhaltsverzeichnis für Menschen (Excel liest es mit Umlauten dank BOM). Ein Beleg, der an Buchung und Dokument hängt, steht einmal. */
export function inhaltsverzeichnis(kopf: ArchivKopf): string {
  const sha = new Map(kopf.dateien.map(d => [d.pfad, d.sha256]));
  const zeilen: string[][] = [];
  const gesehen = new Set<string>();
  // Buchungen zuerst, damit beim Beleg Betrag und Belegnummer der Buchung stehen
  const reihe = [...kopf.eintraege].sort((a, b) => (a.bereich === 'transactions' ? 0 : 1) - (b.bereich === 'transactions' ? 0 : 1));
  for (const e of reihe) {
    const schluessel = `${e.art}|${e.pfad}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    zeilen.push([ART_NAME[e.art], deDatum(e.datum), e.belegnummer ?? '', deBetrag(e.betrag), e.bezeichnung, e.pfad, sha.get(e.pfad) ?? '']);
  }
  zeilen.sort((a, b) => a[5].localeCompare(b[5]));
  return '\uFEFF' + [CSV_KOPF, ...zeilen].map(z => z.map(csvFeld).join(';')).join('\r\n') + '\r\n';
}

export interface ArchivErstellt {
  bytes: Uint8Array;
  kopf: ArchivKopf;
  dateiname: string;
}

/**
 * Baut das Jahresarchiv. Aufbau und Dateinamen wie im Sicherungspaket
 * (dieselbe Funktion `paketInhalt`), davor archiv.json und das
 * Inhaltsverzeichnis. Mit Passwort ist jeder Eintrag AES-256-verschlüsselt
 * (Dateinamen nicht – das ist im ZIP-Format so).
 */
export async function erstelleArchiv(
  b: ArchivBestand,
  jahr: number,
  optionen: { verein: string; kennung: string; jetzt: Date; passwort?: string | null }
): Promise<ArchivErstellt> {
  const plan = planeArchiv(b, jahr);
  if (plan.kandidaten.length === 0) throw new ArchivFehler(`Für ${jahr} gibt es keine Dateien zum Archivieren.`);
  const ids = (bereich: ArchivBereich) => new Set(plan.kandidaten.filter(k => k.bereich === bereich).map(k => k.id));
  const tIds = ids('transactions');
  const dIds = ids('documents');
  const iIds = ids('inventory');

  // Nur die betroffenen Einträge, und an Buchungen nur der Beleg (der Rest
  // würde paketInhalt nicht stören, wird aber nicht gebraucht).
  const teil = {
    app: 'VereinsManager',
    data: {
      documents: b.documents.filter(d => dIds.has(d.id)),
      transactions: b.transactions.filter(t => tIds.has(t.id)),
      members: [],
      inventory: b.inventory.filter(a => iIds.has(a.id)),
      folders: b.folders
    }
  };
  const { sicherung, dateien } = paketInhalt(JSON.stringify(teil));
  const daten = sicherung.data as Record<string, Record<string, unknown>[]>;
  const pfadVon = (bereich: ArchivBereich, id: string): string | null => {
    const r = daten[bereich]?.find(x => x.id === id);
    if (!r) return null;
    const p = bereich === 'documents' ? r.file : bereich === 'transactions' ? (r.receipt as Record<string, unknown> | undefined)?.file : r.photoFile;
    return typeof p === 'string' ? p : null;
  };

  const typVon = new Map<string, string>();
  const eintraege: ArchivEintrag[] = [];
  for (const k of plan.kandidaten) {
    const pfad = pfadVon(k.bereich, k.id);
    if (!pfad) throw new ArchivFehler(`Die Datei zu „${k.bezeichnung}“ ließ sich nicht ins Archiv übernehmen.`);
    if (!typVon.has(pfad)) typVon.set(pfad, k.typ);
    eintraege.push({
      art: k.art,
      bereich: k.bereich,
      id: k.id,
      pfad,
      datum: k.datum,
      ...(k.belegnummer ? { belegnummer: k.belegnummer } : {}),
      ...(k.betrag !== undefined ? { betrag: k.betrag } : {}),
      bezeichnung: k.bezeichnung
    });
  }
  const archivDateien: ArchivDatei[] = dateien.map(d => ({
    pfad: d.name,
    sha256: sha256HexBytes(d.data),
    groesse: d.data.length,
    typ: typVon.get(d.name) ?? 'application/octet-stream'
  }));

  const kopf: ArchivKopf = {
    format: ARCHIV_FORMAT,
    version: ARCHIV_VERSION,
    kennung: optionen.kennung,
    verein: optionen.verein,
    jahr,
    erstelltAm: optionen.jetzt.toISOString(),
    aufbewahrung: plan.aufbewahrung,
    dateien: archivDateien,
    eintraege
  };
  const text = (s: string) => new TextEncoder().encode(s);
  const inhalt: PaketDatei[] = [
    { name: ARCHIV_JSON, data: text(JSON.stringify(kopf, null, 2)) },
    { name: ARCHIV_CSV, data: text(inhaltsverzeichnis(kopf)) },
    ...dateien
  ];
  const bytes = await schreibeZip(inhalt, optionen.passwort, optionen.jetzt);
  return { bytes, kopf, dateiname: archivDateiname(optionen.verein, jahr) };
}

// ------------------------------------------------------------------ Archiv lesen und prüfen

export interface GelesenesArchiv {
  kopf: ArchivKopf;
  /** Liest eine Datei aus dem Archiv (ohne Prüfung der Prüfsumme). */
  lies(pfad: string): Promise<Uint8Array>;
}

/**
 * Öffnet ein Jahresarchiv und liest archiv.json. Wirft `ZipFehler`
 * (Passwort fehlt/falsch, beschädigt) oder `ArchivFehler` (kein Jahresarchiv).
 */
export async function leseArchiv(bytes: Uint8Array, passwort?: string): Promise<GelesenesArchiv> {
  const zip = oeffneZip(bytes);
  const nachName = new Map<string, ZipEintrag>(zip.eintraege.filter(e => !e.istOrdner).map(e => [e.name, e] as const));
  const json = nachName.get(ARCHIV_JSON);
  if (!json) throw new ArchivFehler('Das ist kein Jahresarchiv des VereinsManagers (archiv.json fehlt).');
  if (json.groesse > MAX_JSON_BYTES) throw new ArchivFehler('archiv.json im Archiv ist unplausibel groß.');
  let kopf: unknown;
  try {
    kopf = JSON.parse(new TextDecoder('utf-8').decode(await zip.lies(json, passwort)));
  } catch (e) {
    if (e instanceof SyntaxError) throw new ArchivFehler('archiv.json im Archiv ist keine gültige JSON-Datei.');
    throw e;
  }
  const k = kopf as Partial<ArchivKopf>;
  if (!k || k.format !== ARCHIV_FORMAT || typeof k.kennung !== 'string' || typeof k.jahr !== 'number' || !Array.isArray(k.dateien) || !Array.isArray(k.eintraege)) {
    throw new ArchivFehler('Das ist kein Jahresarchiv des VereinsManagers.');
  }
  if (!/^1\./.test(String(k.version ?? ''))) {
    throw new ArchivFehler(`Das Archiv hat das Format ${String(k.version)}; diese Version der App liest Format 1.x.`);
  }
  return {
    kopf: k as ArchivKopf,
    lies: async (pfad: string) => {
      const e = nachName.get(pfad);
      if (!e) throw new ArchivFehler(`Die Datei „${pfad}“ fehlt im Archiv.`);
      return zip.lies(e, passwort);
    }
  };
}

export interface ArchivPruefung {
  ok: boolean;
  geprueft: number;
  fehler: string[];
}

/** Liest jede Datei des Archivs und vergleicht Größe und Prüfsumme mit archiv.json. */
export async function pruefeArchiv(archiv: GelesenesArchiv): Promise<ArchivPruefung> {
  const fehler: string[] = [];
  let geprueft = 0;
  for (const d of archiv.kopf.dateien) {
    try {
      const inhalt = await archiv.lies(d.pfad);
      if (inhalt.length !== d.groesse || sha256HexBytes(inhalt) !== d.sha256) fehler.push(`${d.pfad}: Inhalt stimmt nicht mit der Prüfsumme überein.`);
      else geprueft++;
    } catch (e) {
      fehler.push(`${d.pfad}: ${e instanceof Error ? e.message : 'nicht lesbar'}`);
    }
  }
  const bekannt = new Set(archiv.kopf.dateien.map(d => d.pfad));
  for (const e of archiv.kopf.eintraege) if (!bekannt.has(e.pfad)) fehler.push(`${e.bezeichnung}: Datei ${e.pfad} ist im Inhaltsverzeichnis nicht aufgeführt.`);
  return { ok: fehler.length === 0, geprueft, fehler };
}

// ------------------------------------------------------------------ Bestand ändern

export interface ArchivAenderungen {
  transactions: Transaction[];
  documents: ClubDocument[];
  inventory: InventoryItem[];
  /** Einträge, die übergangen wurden, mit Grund */
  uebersprungen: string[];
}

const leer = (): ArchivAenderungen => ({ transactions: [], documents: [], inventory: [], uebersprungen: [] });

/**
 * Nimmt die archivierten Dateien aus dem Bestand und setzt die Vermerke.
 * Nur aufrufen, nachdem das gespeicherte Archiv mit `pruefeArchiv` gelesen
 * und geprüft wurde. Eine Datei wird nur entfernt, wenn sie im Bestand noch
 * genau die im Archiv ist (gleiche Prüfsumme) – wurde sie inzwischen
 * ersetzt, bleibt sie und wird gemeldet.
 */
export function wendeArchivAn(b: ArchivBestand, kopf: ArchivKopf, jetzt: string): ArchivAenderungen {
  const aus = leer();
  const dateien = new Map(kopf.dateien.map(d => [d.pfad, d]));
  const dateiname = archivDateiname(kopf.verein, kopf.jahr);
  const vermerk = (pfad: string): ArchivVermerk | null => {
    const d = dateien.get(pfad);
    return d ? { jahr: kopf.jahr, kennung: kopf.kennung, datei: dateiname, pfad, sha256: d.sha256, groesse: d.groesse, typ: d.typ, archiviertAm: jetzt } : null;
  };
  const gleich = (url: string | undefined, pfad: string): boolean => {
    const b64 = base64Teil(url);
    const d = dateien.get(pfad);
    return !!b64 && !!d && sha256HexBytes(ausBase64(b64)) === d.sha256;
  };

  for (const e of kopf.eintraege) {
    const v = vermerk(e.pfad);
    if (!v) {
      aus.uebersprungen.push(`${e.bezeichnung}: Datei fehlt im Inhaltsverzeichnis.`);
      continue;
    }
    if (e.bereich === 'transactions') {
      const t = b.transactions.find(x => x.id === e.id);
      if (!t?.receipt) aus.uebersprungen.push(`${e.bezeichnung}: Buchung oder Beleg nicht mehr vorhanden.`);
      else if (t.receipt.archiv) aus.uebersprungen.push(`${e.bezeichnung}: schon archiviert.`);
      else if (!gleich(t.receipt.dataUrl, e.pfad)) aus.uebersprungen.push(`${e.bezeichnung}: Beleg wurde inzwischen geändert, bleibt im Bestand.`);
      else aus.transactions.push({ ...t, receipt: { ...t.receipt, dataUrl: '', archiv: v }, updatedAt: jetzt });
    } else if (e.bereich === 'documents') {
      const d = b.documents.find(x => x.id === e.id);
      if (!d) aus.uebersprungen.push(`${e.bezeichnung}: Dokument nicht mehr vorhanden.`);
      else if (d.archiv) aus.uebersprungen.push(`${e.bezeichnung}: schon archiviert.`);
      else if (!gleich(d.dataUrl, e.pfad)) aus.uebersprungen.push(`${e.bezeichnung}: Dokument wurde inzwischen geändert, bleibt im Bestand.`);
      else aus.documents.push({ ...d, dataUrl: '', archiv: v, updatedAt: jetzt });
    } else {
      const a = b.inventory.find(x => x.id === e.id);
      if (!a) aus.uebersprungen.push(`${e.bezeichnung}: Gegenstand nicht mehr vorhanden.`);
      else if (a.photoArchiv) aus.uebersprungen.push(`${e.bezeichnung}: schon archiviert.`);
      else if (!gleich(a.photoUrl, e.pfad)) aus.uebersprungen.push(`${e.bezeichnung}: Foto wurde inzwischen geändert, bleibt im Bestand.`);
      else {
        const neu: InventoryItem = { ...a, photoArchiv: v, updatedAt: jetzt };
        delete neu.photoUrl;
        aus.inventory.push(neu);
      }
    }
  }
  return aus;
}

const alsDataUrl = (typ: string, bytes: Uint8Array) => `data:${typ || 'application/octet-stream'};base64,${zuBase64(bytes)}`;

/**
 * Holt eine einzelne Datei aus dem Archiv, z. B. zum Ansehen eines Belegs.
 * Prüft, dass es das richtige Archiv ist und die Datei unverändert.
 */
export async function dateiAusArchiv(archiv: GelesenesArchiv, v: ArchivVermerk): Promise<string> {
  if (archiv.kopf.kennung !== v.kennung) {
    throw new ArchivFehler(`Das ist nicht das passende Archiv. Gesucht: ${v.datei} (Jahr ${v.jahr}), gewählt: Archiv ${archiv.kopf.jahr} von „${archiv.kopf.verein}“.`);
  }
  const inhalt = await archiv.lies(v.pfad);
  if (sha256HexBytes(inhalt) !== v.sha256) throw new ArchivFehler(`Die Datei „${v.pfad}“ im Archiv ist verändert oder beschädigt.`);
  return alsDataUrl(v.typ, inhalt);
}

/**
 * Stellt alle Dateien eines Archivs im Bestand wieder her (z. B. für eine
 * Betriebsprüfung). Betroffen sind nur Einträge, deren Vermerk auf genau
 * dieses Archiv zeigt; jede Datei wird vor dem Zurückschreiben geprüft.
 */
export async function holeArchivZurueck(b: ArchivBestand, archiv: GelesenesArchiv, jetzt: string): Promise<ArchivAenderungen> {
  const aus = leer();
  const kennung = archiv.kopf.kennung;
  const cache = new Map<string, Promise<string>>();
  const holen = (v: ArchivVermerk): Promise<string> => {
    const k = `${v.pfad}|${v.sha256}`;
    let p = cache.get(k);
    if (!p) {
      p = dateiAusArchiv(archiv, v);
      cache.set(k, p);
    }
    return p;
  };
  const versuche = async (v: ArchivVermerk, name: string): Promise<string | null> => {
    try {
      return await holen(v);
    } catch (e) {
      aus.uebersprungen.push(`${name}: ${e instanceof Error ? e.message : 'nicht lesbar'}`);
      return null;
    }
  };

  for (const t of b.transactions) {
    const v = t.receipt?.archiv;
    if (!t.receipt || !v || v.kennung !== kennung) continue;
    const url = await versuche(v, `Beleg ${t.documentNumber || t.id}`);
    if (url === null) continue;
    const r = { ...t.receipt, dataUrl: url };
    delete r.archiv;
    aus.transactions.push({ ...t, receipt: r, updatedAt: jetzt });
  }
  for (const d of b.documents) {
    const v = d.archiv;
    if (!v || v.kennung !== kennung) continue;
    const url = await versuche(v, d.title || d.id);
    if (url === null) continue;
    const neu: ClubDocument = { ...d, dataUrl: url, updatedAt: jetzt };
    delete neu.archiv;
    aus.documents.push(neu);
  }
  for (const a of b.inventory) {
    const v = a.photoArchiv;
    if (!v || v.kennung !== kennung) continue;
    const url = await versuche(v, `Foto ${a.name}`);
    if (url === null) continue;
    const neu: InventoryItem = { ...a, photoUrl: url, updatedAt: jetzt };
    delete neu.photoArchiv;
    aus.inventory.push(neu);
  }
  return aus;
}

/** Kurzer Text für die Anzeige an einem Eintrag. */
export const vermerkText = (v: ArchivVermerk): string => `Im Jahresarchiv ${v.jahr} (${v.datei})`;
