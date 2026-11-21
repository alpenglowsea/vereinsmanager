/**
 * Excel-Dateien (.xlsx) LESEN, ohne Bibliothek (P28, D-72).
 * ---------------------------------------------------------------------------
 *
 * Gegenstück zu `xlsxWriter.ts` und Nachbau von Android `Xlsx` in
 * `core/importe/Tabellen.kt`, damit beide Fassungen dieselbe Datei gleich
 * lesen:
 *
 *  - Eine .xlsx-Datei ist ein ZIP mit XML-Dateien. Gelesen wird die ERSTE
 *    Tabelle des Arbeitsbuchs (Reihenfolge in `xl/workbook.xml`).
 *  - Texte aus `sharedStrings.xml` (ohne Lautschrift `rPh`), Text direkt in
 *    der Zelle (`inlineStr`), Formeln mit ihrem gespeicherten Ergebnis,
 *    Wahrheitswerte als WAHR/FALSCH, Fehlerwerte (#NV …) als leer.
 *  - Zahlen ohne Tausenderpunkt mit Komma: 1234,5. Datumszellen (am
 *    Zahlenformat erkannt) als JJJJ-MM-TT, Uhrzeiten als HH:MM.
 *  - Erste nicht leere Zeile = Überschriften; doppelte Namen werden zu
 *    „Name_2“, „Name_3“; leere Zeilen fallen weg.
 *
 * Bewusst nicht: weitere Tabellenblätter, verbundene Zellen, alte
 * .xls-Dateien (anderes Format) und mit Passwort geschützte Excel-Dateien
 * (die sind gar kein ZIP). Für diese gibt `XlsxFehler` eine verständliche
 * Meldung.
 *
 * Sicherheit: Der eigene XML-Leser kennt keine DTD und löst keine fremden
 * Entitäten auf; nur die fünf Standard-Entitäten und Zeichenverweise.
 */
import { istZip, oeffneZip, type ZipEintrag } from './zipReader';

export class XlsxFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxFehler';
  }
}

/** Eine eingelesene Tabelle in der Form, die die Import-Fenster erwarten. */
export interface Tabelle {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_BYTES = 64 * 1024 * 1024;

// ------------------------------------------------------------------ XML

interface Element {
  art: 'start' | 'ende' | 'text';
  /** Name ohne Namensraum-Vorsilbe („x:c“ → „c“) */
  name: string;
  attr: Record<string, string>;
  text: string;
  /** Selbstschließend (<c r="A1"/>): auf „start“ folgt sofort „ende“. */
  leer: boolean;
}

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Löst Entitäten auf. Unbekannte bleiben, wie sie sind. */
export function xmlText(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (ganz, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ganz;
    }
    return ENTITAETEN[e] ?? ganz;
  });
}

const lokal = (n: string): string => {
  const i = n.indexOf(':');
  return i >= 0 ? n.slice(i + 1) : n;
};

/** Liest Attribute aus dem Inneren eines Start-Tags. Schlüssel mit Vorsilbe (z. B. „r:id“) wie geschrieben. */
function attribute(innen: string): Record<string, string> {
  const a: Record<string, string> = {};
  const re = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(innen))) a[m[1]] = xmlText(m[3] ?? m[4] ?? '');
  return a;
}

/**
 * Zerlegt XML in Start-, End- und Textstücke (ein einfacher „SAX“-Leser).
 * Kommentare, Verarbeitungsanweisungen und DOCTYPE werden übersprungen.
 */
export function* xmlElemente(xml: string): Generator<Element> {
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      yield { art: 'text', name: '', attr: {}, text: xmlText(xml.slice(i)), leer: false };
      return;
    }
    if (lt > i) yield { art: 'text', name: '', attr: {}, text: xmlText(xml.slice(i, lt)), leer: false };
    if (xml.startsWith('<!--', lt)) {
      const e = xml.indexOf('-->', lt + 4);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const e = xml.indexOf(']]>', lt + 9);
      const ende = e < 0 ? n : e;
      yield { art: 'text', name: '', attr: {}, text: xml.slice(lt + 9, ende), leer: false };
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (xml[lt + 1] === '?' || xml[lt + 1] === '!') {
      const e = xml.indexOf('>', lt);
      i = e < 0 ? n : e + 1;
      continue;
    }
    // Ende des Tags suchen; „>“ in Attributwerten in Anführungszeichen überspringen
    let j = lt + 1;
    let quote = '';
    while (j < n) {
      const c = xml[j];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    const innen = xml.slice(lt + 1, j);
    i = j + 1;
    if (innen[0] === '/') {
      yield { art: 'ende', name: lokal(innen.slice(1).trim()), attr: {}, text: '', leer: false };
      continue;
    }
    const leer = innen.endsWith('/');
    const rumpf = leer ? innen.slice(0, -1) : innen;
    const m = /^\s*([^\s/>]+)/.exec(rumpf);
    const name = lokal(m ? m[1] : '');
    const attr = attribute(rumpf.slice(m ? m[0].length : 0));
    yield { art: 'start', name, attr, text: '', leer };
    if (leer) yield { art: 'ende', name, attr: {}, text: '', leer: true };
  }
}

// ------------------------------------------------------------------ Zahlen und Datum

/** Wie Android `art`: 'd' Datum, 't' Uhrzeit, 'n' Zahl – nach dem Zahlenformat der Zelle. */
export function zellArt(numFmtId: number, eigeneFormate: Map<number, string>): 'd' | 't' | 'n' {
  const id = numFmtId;
  if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) {
    return (id >= 18 && id <= 21) || (id >= 45 && id <= 47) ? 't' : 'd';
  }
  const code = eigeneFormate.get(id);
  if (code === undefined) return 'n';
  const rest = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
    .toLowerCase();
  if (/[yd]/.test(rest)) return 'd';
  if (/[hs]/.test(rest)) return 't';
  return 'n';
}

const ZWEI = (x: number) => String(x).padStart(2, '0');

/** Zahl einer Zelle als Text, wie Android `zahlText`. */
export function zahlText(roh: string, art: 'd' | 't' | 'n'): string {
  if (roh === '') return '';
  // Nur echte Dezimalzahlen (auch mit Exponent); sonst unverändert (wie BigDecimal-Fehler am Handy)
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(roh)) return roh;
  const z = Number(roh);
  if (!Number.isFinite(z)) return roh;
  if (art === 'd') {
    const tage = Math.floor(z);
    const ms = Date.UTC(1899, 11, 30) + tage * 86400000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return roh;
    return `${String(d.getUTCFullYear()).padStart(4, '0')}-${ZWEI(d.getUTCMonth() + 1)}-${ZWEI(d.getUTCDate())}`;
  }
  if (art === 't') {
    const anteil = z - Math.floor(z);
    const minuten = Math.round(anteil * 1440);
    return `${ZWEI(Math.floor(minuten / 60) % 24)}:${ZWEI(minuten % 60)}`;
  }
  // Auf 10 Nachkommastellen runden (entfernt Rechenreste wie 0,30000000000000004)
  let s = Math.abs(z) < 1e21 ? z.toFixed(10) : String(z);
  if (s.includes('.') && !/e/i.test(s)) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('.', ',');
}

// ------------------------------------------------------------------ Tabelle

/** Baut aus Zeilen eine Tabelle wie Android `Tabellen.tabelle`. */
export function tabelleAusZeilen(zeilen: string[][]): Tabelle {
  const sauber = zeilen.map(z => z.map(x => x.trim())).filter(z => z.some(x => x !== ''));
  if (sauber.length === 0) return { headers: [], rows: [] };
  const gesehen = new Map<string, number>();
  const headers = sauber[0].map(h => {
    const name = h || 'Spalte';
    const n = (gesehen.get(name) ?? 0) + 1;
    gesehen.set(name, n);
    return n > 1 ? `${name}_${n}` : name;
  });
  const rows = sauber.slice(1).map(werte => {
    const m: Record<string, string> = {};
    headers.forEach((h, i) => {
      m[h] = werte[i] ?? '';
    });
    return m;
  });
  return { headers, rows };
}

/** Spaltenbuchstaben „AB“ → Index 27 (0-basiert); wie Android. */
function spaltenIndex(ref: string): number {
  let n = 0;
  for (const c of ref) {
    const u = c.toUpperCase();
    if (u >= 'A' && u <= 'Z') n = n * 26 + (u.charCodeAt(0) - 64);
    else break;
  }
  return n - 1;
}

/** Steckt hinter den Bytes eine Excel-Datei (.xlsx)? */
export function istXlsx(bytes: Uint8Array): boolean {
  if (!istZip(bytes)) return false;
  try {
    return oeffneZip(bytes).eintraege.some(e => e.name === 'xl/workbook.xml');
  } catch {
    return false;
  }
}

/** Alte Excel-Datei (.xls) oder mit Passwort geschützte Office-Datei (Compound File)? */
export function istAltesOfficeFormat(bytes: Uint8Array): boolean {
  const kopf = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length >= 8 && kopf.every((b, i) => bytes[i] === b);
}

/** Liest die erste Tabelle einer .xlsx-Datei als Zeilen. */
export async function leseXlsxZeilen(bytes: Uint8Array): Promise<string[][]> {
  let zip;
  try {
    zip = oeffneZip(bytes);
  } catch {
    throw new XlsxFehler('Die Excel-Datei ist beschädigt oder keine .xlsx-Datei.');
  }
  // Nur die XML-Dateien unter xl/ und die Verweise (.rels), wie am Handy
  const dateien = new Map<string, ZipEintrag>();
  let summe = 0;
  for (const e of zip.eintraege) {
    if (e.istOrdner) continue;
    if (!((e.name.startsWith('xl/') && e.name.endsWith('.xml')) || e.name.endsWith('.rels'))) continue;
    summe += e.groesse;
    if (summe > MAX_BYTES) throw new XlsxFehler('Die Excel-Datei ist zu groß.');
    dateien.set(e.name, e);
  }
  const text = async (name: string): Promise<string | null> => {
    const e = dateien.get(name);
    if (!e) return null;
    try {
      return new TextDecoder('utf-8').decode(await zip.lies(e));
    } catch {
      throw new XlsxFehler('Die Excel-Datei ist beschädigt und lässt sich nicht lesen.');
    }
  };

  const workbook = await text('xl/workbook.xml');
  if (workbook === null) throw new XlsxFehler('Das ist keine Excel-Datei (.xlsx).');

  // Erste Tabelle des Arbeitsbuchs
  let ersteId: string | null = null;
  for (const el of xmlElemente(workbook)) {
    if (el.art === 'start' && el.name === 'sheet') {
      const schluessel = Object.keys(el.attr).find(k => lokal(k) === 'id');
      ersteId = el.attr['r:id'] ?? el.attr.id ?? (schluessel ? el.attr[schluessel] : null);
      break;
    }
  }
  let pfad: string | null = null;
  const rels = await text('xl/_rels/workbook.xml.rels');
  if (rels !== null && ersteId !== null) {
    for (const el of xmlElemente(rels)) {
      if (el.art === 'start' && el.name === 'Relationship' && el.attr.Id === ersteId) {
        const t = el.attr.Target;
        if (t) pfad = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
        break;
      }
    }
  }
  if (pfad === null || !dateien.has(pfad)) {
    pfad = [...dateien.keys()].filter(k => k.startsWith('xl/worksheets/sheet')).sort()[0] ?? null;
  }
  const blatt = pfad ? await text(pfad) : null;
  if (blatt === null) throw new XlsxFehler('Die Excel-Datei enthält keine Tabelle.');

  // Gemeinsame Texte
  const texte: string[] = [];
  const shared = await text('xl/sharedStrings.xml');
  if (shared !== null) {
    let sb = '';
    let inT = false;
    let phonetik = 0;
    for (const el of xmlElemente(shared)) {
      if (el.art === 'start') {
        if (el.name === 'si') sb = '';
        else if (el.name === 't') inT = true;
        else if (el.name === 'rPh') phonetik++;
      } else if (el.art === 'ende') {
        if (el.name === 'si') texte.push(sb);
        else if (el.name === 't') inT = false;
        else if (el.name === 'rPh') phonetik--;
      } else if (inT && phonetik === 0) sb += el.text;
    }
  }

  // Zahlenformate: welche Zellformate sind Datum oder Uhrzeit?
  const formate = new Map<number, string>();
  const zellformate: number[] = [];
  const styles = await text('xl/styles.xml');
  if (styles !== null) {
    let inXfs = false;
    for (const el of xmlElemente(styles)) {
      if (el.art === 'start') {
        if (el.name === 'numFmt') {
          const id = Number.parseInt(el.attr.numFmtId ?? '', 10);
          if (Number.isFinite(id)) formate.set(id, el.attr.formatCode ?? '');
        } else if (el.name === 'cellXfs') inXfs = true;
        else if (el.name === 'xf' && inXfs) {
          const id = Number.parseInt(el.attr.numFmtId ?? '', 10);
          zellformate.push(Number.isFinite(id) ? id : 0);
        }
      } else if (el.art === 'ende' && el.name === 'cellXfs') inXfs = false;
    }
  }
  const artVon = (stil: number): 'd' | 't' | 'n' => {
    const id = zellformate[stil];
    return id === undefined ? 'n' : zellArt(id, formate);
  };

  // Zellen
  const zeilen: string[][] = [];
  let zeile = new Map<number, string>();
  let spalte = -1;
  let typ = '';
  let stil = 0;
  let inV = false;
  let inT = false;
  let inIs = false;
  let v = '';
  let inline = '';
  for (const el of xmlElemente(blatt)) {
    if (el.art === 'start') {
      switch (el.name) {
        case 'row':
          zeile = new Map();
          spalte = -1;
          break;
        case 'c': {
          const r = el.attr.r;
          spalte = r ? spaltenIndex(r) : spalte + 1;
          typ = el.attr.t ?? '';
          stil = Number.parseInt(el.attr.s ?? '0', 10) || 0;
          v = '';
          inline = '';
          break;
        }
        case 'v':
          inV = true;
          break;
        case 'is':
          inIs = true;
          break;
        case 't':
          if (inIs) inT = true;
          break;
      }
    } else if (el.art === 'ende') {
      switch (el.name) {
        case 'v':
          inV = false;
          break;
        case 't':
          inT = false;
          break;
        case 'is':
          inIs = false;
          break;
        case 'c': {
          const roh = v.trim();
          let wert: string;
          if (typ === 's') {
            const i = Number.parseInt(roh, 10);
            wert = Number.isFinite(i) ? (texte[i] ?? '') : '';
          } else if (typ === 'inlineStr') wert = inline;
          else if (typ === 'str') wert = roh;
          else if (typ === 'b') wert = roh === '1' ? 'WAHR' : 'FALSCH';
          else if (typ === 'e') wert = '';
          else wert = zahlText(roh, artVon(stil));
          if (wert !== '' && spalte >= 0) zeile.set(spalte, wert);
          break;
        }
        case 'row': {
          const max = zeile.size ? Math.max(...zeile.keys()) : -1;
          const liste: string[] = [];
          for (let i = 0; i <= max; i++) liste.push(zeile.get(i) ?? '');
          zeilen.push(liste);
          break;
        }
      }
    } else {
      if (inV) v += el.text;
      if (inT) inline += el.text;
    }
  }
  return zeilen;
}

/** Liest die erste Tabelle einer .xlsx-Datei als Tabelle mit Überschriften. */
export async function leseXlsx(bytes: Uint8Array): Promise<Tabelle> {
  return tabelleAusZeilen(await leseXlsxZeilen(bytes));
}
