/**
 * Sicherungspaket (Format 1.3.0) SCHREIBEN (P30 Teil 2).
 * ---------------------------------------------------------------------------
 *
 * Gegenstück zu `backupPaket.ts` (Einlesen) und Nachbau von Android
 * `BackupPaket.schreiben`, damit ein Paket vom Desktop genauso aussieht wie
 * eines vom Handy und dort eingespielt werden kann (BACKUP_FORMAT.md,
 * Abschnitt 8):
 *
 *   sicherung.json                                  (immer der erste Eintrag)
 *   dokumente/<Ordner>/<Unterordner>/<Datei>
 *   dokumente/Buchhaltungsbelege & Finanzen/Belege 2026/<Datum> <Partner> <Belegnr>.pdf
 *   mitglieder-fotos/<Nr> <Nachname> <Vorname>.jpg
 *   inventar-fotos/<Gegenstand>.png
 *
 * Der Desktop speichert Dateien als Data-URL im Eintrag. Hier wird jede
 * Data-URL (Base64) an den vier Stellen zu einer Datei im ZIP; im Eintrag
 * steht danach der Pfad:
 *
 *   Bereich        am Desktop          im Paket
 *   documents      dataUrl             file
 *   transactions   receipt.dataUrl     receipt.file
 *   members        avatarUrl           avatarFile
 *   inventory      photoUrl            photoFile
 *
 * Gleicher Inhalt steht nur einmal im ZIP (ein Beleg hängt an der Buchung
 * UND als Dokument im Archiv). Andere Werte (leer, Internetadresse, Data-URL
 * ohne Base64) bleiben unverändert im Eintrag, wie am Handy.
 */
import { schreibeZip, type PaketDatei } from '../utils/zipSchreiben';
import { PAKET_JSON_NAME } from './backupPaket';

export const PAKET_VERSION = '1.3.0';

type Rekord = Record<string, unknown>;
type Art = 'DOKUMENT' | 'BELEG' | 'FOTO' | 'GERAET';

/** Reihenfolge wie Android: Dokumente, Buchungen, Mitglieder, Inventar (wichtig für die Pfadvergabe). */
const STELLEN: { art: Art; bereich: string; unterobjekt: string | null; desktopFeld: string; paketFeld: string }[] = [
  { art: 'DOKUMENT', bereich: 'documents', unterobjekt: null, desktopFeld: 'dataUrl', paketFeld: 'file' },
  { art: 'BELEG', bereich: 'transactions', unterobjekt: 'receipt', desktopFeld: 'dataUrl', paketFeld: 'file' },
  { art: 'FOTO', bereich: 'members', unterobjekt: null, desktopFeld: 'avatarUrl', paketFeld: 'avatarFile' },
  { art: 'GERAET', bereich: 'inventory', unterobjekt: null, desktopFeld: 'photoUrl', paketFeld: 'photoFile' }
];

const OHNE_ORDNER = '(ohne Ordner)';
const BELEG_ORDNER = 'Buchhaltungsbelege & Finanzen';

const istObjekt = (x: unknown): x is Rekord => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Wie Android `JsonObject.text`: Text oder Zahl als Text, sonst null. */
function text(o: Rekord, k: string): string | null {
  const v = o[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

// ------------------------------------------------------------------ Dateinamen (wie Android `Dateinamen`)

const VERBOTEN = new Set('/\\:*?"<>|'.split(''));
const WINDOWS_NAMEN = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

const beschneiden = (s: string): string => s.replace(/^ +/, '').replace(/[ .]+$/, '');

function trenne(name: string): [string, string] {
  const i = name.lastIndexOf('.');
  if (i <= 0) return [name, ''];
  const endung = name.slice(i);
  return endung.length >= 2 && endung.length <= 11 ? [name.slice(0, i), endung] : [name, ''];
}

function kuerze(s: string, max: number): string {
  if (s.length <= max) return s;
  let t = s.slice(0, Math.max(0, max));
  const letztes = t.charCodeAt(t.length - 1);
  if (t.length > 0 && letztes >= 0xd800 && letztes <= 0xdbff) t = t.slice(0, -1); // kein halbes Sonderzeichen
  return t;
}

/** Gültiger Datei- oder Ordnername auf jedem Betriebssystem (Android `Dateinamen.bereinigen`). */
export function bereinigen(name: string, max = 100, mitEndung = true): string {
  let roh = '';
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    const code = name.charCodeAt(i);
    roh += VERBOTEN.has(c) || code < 0x20 || code === 0x7f ? '-' : c;
  }
  const sauber = beschneiden(roh);
  if (sauber === '') return 'Datei';
  const [basis0, endung] = mitEndung ? trenne(sauber) : [sauber, ''];
  let basis = basis0;
  if (WINDOWS_NAMEN.test(basis)) basis = `_${basis}`;
  basis = beschneiden(kuerze(basis, max - endung.length));
  if (basis === '') basis = 'Datei';
  return basis + endung;
}

/** Eindeutig im Ordner, ohne Rücksicht auf Groß-/Kleinschreibung: „a.pdf“ → „a (2).pdf“ (Android `Dateinamen.eindeutig`). */
export function eindeutig(name: string, vergeben: Set<string>, mitEndung = true): string {
  const belegt = new Set([...vergeben].map(v => v.toLowerCase()));
  if (!belegt.has(name.toLowerCase())) return name;
  const [basis, endung] = mitEndung ? trenne(name) : [name, ''];
  for (let n = 2; ; n++) {
    const kandidat = `${basis} (${n})${endung}`;
    if (!belegt.has(kandidat.toLowerCase())) return kandidat;
  }
}

// ------------------------------------------------------------------ Dateityp

const MIME_ENDUNG: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
};

const endungZu = (mime: string): string | null => MIME_ENDUNG[mime.split(';')[0].trim().toLowerCase()] ?? null;

function erkennen(b: Uint8Array): string | null {
  const ab = (...w: number[]) => b.length >= w.length && w.every((x, i) => b[i] === x);
  if (ab(0x25, 0x50, 0x44, 0x46)) return 'pdf';
  if (ab(0xff, 0xd8, 0xff)) return 'jpg';
  if (ab(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (ab(0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (b.length >= 12 && ab(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP') return 'webp';
  return null;
}

/** Hat der Name schon eine Endung (2 bis 6 Zeichen, nur Buchstaben und Ziffern)? */
function hatEndung(name: string): boolean {
  const i = name.lastIndexOf('.');
  return i > 0 && name.length - i >= 2 && name.length - i <= 6 && /^[\p{L}\p{N}]+$/u.test(name.slice(i + 1));
}

function mitEndung(name: string, mime: string | null, inhalt: Uint8Array, standard: string | null = null): string {
  if (hatEndung(name)) return name;
  const e = (mime ? endungZu(mime) : null) ?? erkennen(inhalt) ?? standard;
  return e === null ? name : `${name}.${e}`;
}

// ------------------------------------------------------------------ Ordner und Ablage

/** Ordnerpfade aus den Ordner-Einträgen; gleiche Namen unter demselben Elternordner werden unterschieden. */
class OrdnerPfade {
  private nachId = new Map<string, Rekord>();
  private fertig = new Map<string, string>();
  private inArbeit = new Set<string>();
  private vergeben = new Map<string, Set<string>>();

  constructor(ordner: Rekord[]) {
    for (const o of ordner) {
      const id = text(o, 'id') ?? '';
      this.nachId.set(id, o);
    }
    for (const id of this.nachId.keys()) this.pfad(id);
  }

  pfad(id: string | null): string | null {
    if (!id) return null;
    const f = this.fertig.get(id);
    if (f !== undefined) return f;
    const o = this.nachId.get(id);
    if (!o) return null;
    if (this.inArbeit.has(id)) return null; // Kreis (A in B in A): der Ordner wird zum obersten
    this.inArbeit.add(id);
    const eltern = this.pfad(text(o, 'parentId'));
    this.inArbeit.delete(id);
    const schluessel = eltern ?? '';
    let namen = this.vergeben.get(schluessel);
    if (!namen) {
      namen = new Set();
      this.vergeben.set(schluessel, namen);
    }
    const name = eindeutig(bereinigen(text(o, 'name') ?? 'Ordner', 100, false), namen, false);
    namen.add(name);
    const pfad = eltern === null ? name : `${eltern}/${name}`;
    this.fertig.set(id, pfad);
    return pfad;
  }
}

/** Vergibt die Pfade im ZIP; derselbe Inhalt bekommt immer denselben Pfad. */
class Ablage {
  readonly pfadVonInhalt = new Map<string, { pfad: string; data: Uint8Array }>();
  private namen = new Map<string, Set<string>>();

  pfad(schluessel: string, data: Uint8Array, wo: () => [string, string]): string {
    const da = this.pfadVonInhalt.get(schluessel);
    if (da) return da.pfad;
    const [verz, name] = wo();
    const k = verz.toLowerCase();
    let belegt = this.namen.get(k);
    if (!belegt) {
      belegt = new Set();
      this.namen.set(k, belegt);
    }
    const n = eindeutig(name, belegt);
    belegt.add(n);
    const pfad = `${verz}/${n}`;
    this.pfadVonInhalt.set(schluessel, { pfad, data });
    return pfad;
  }
}

function verzeichnisUndName(art: Art, ziel: Rekord, rekord: Rekord, ordner: OrdnerPfade, inhalt: Uint8Array): [string, string] {
  switch (art) {
    case 'DOKUMENT': {
      const verz = `dokumente/${ordner.pfad(text(rekord, 'folderId')) ?? OHNE_ORDNER}`;
      const fn = text(rekord, 'fileName');
      const titel = text(rekord, 'title');
      const roh = fn && fn.trim() ? fn : titel && titel.trim() ? titel : 'Dokument';
      return [verz, bereinigen(mitEndung(roh.trim(), text(rekord, 'fileType'), inhalt))];
    }
    case 'BELEG': {
      const datum = (text(rekord, 'date') ?? '').trim();
      const jahr = /^\d{4}/.test(datum) ? datum.slice(0, 4) : null;
      const verz = `dokumente/${BELEG_ORDNER}/${bereinigen(jahr ? `Belege ${jahr}` : 'Belege (ohne Datum)', 100, false)}`;
      const aus = [datum, text(rekord, 'partner') ?? '', text(rekord, 'documentNumber') ?? '']
        .map(s => s.trim())
        .filter(s => s !== '')
        .join(' ');
      const ursprung = (text(ziel, 'name') ?? '').trim();
      const roh = aus || ursprung || 'Beleg';
      const endung = hatEndung(ursprung) ? ursprung.slice(ursprung.lastIndexOf('.')) : '';
      return [verz, bereinigen(mitEndung(roh + endung, text(ziel, 'type'), inhalt))];
    }
    case 'FOTO': {
      const roh =
        [text(rekord, 'memberNumber'), text(rekord, 'lastName'), text(rekord, 'firstName')]
          .map(s => (s ?? '').trim())
          .filter(s => s !== '')
          .join(' ') || 'Foto';
      return ['mitglieder-fotos', bereinigen(mitEndung(roh, null, inhalt, 'jpg'))];
    }
    case 'GERAET': {
      const roh = (text(rekord, 'name') ?? '').trim() || 'Foto';
      return ['inventar-fotos', bereinigen(mitEndung(roh, null, inhalt, 'jpg'))];
    }
  }
}

// ------------------------------------------------------------------ Data-URL

/** Base64-Teil einer Data-URL; null, wenn es keine Base64-Data-URL ist (dann bleibt sie im Eintrag, wie am Handy). */
function base64Teil(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('data:')) return null;
  const komma = url.indexOf(',');
  if (komma < 0) return null;
  const kopf = url.slice(5, komma);
  if (!kopf.split(';').some(t => t.toLowerCase() === 'base64')) return null;
  const b64 = url.slice(komma + 1).replace(/\s+/g, '');
  return /^[A-Za-z0-9+/]*={0,2}$/.test(b64) ? b64 : null;
}

function ausBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ------------------------------------------------------------------ Paket

export interface PaketInhalt {
  /** Inhalt von `sicherung.json` (Version 1.3.0, Pfade statt Data-URLs) */
  sicherung: Rekord;
  /** Die Dateien in der Reihenfolge, in der sie ins ZIP kommen (ohne sicherung.json) */
  dateien: PaketDatei[];
}

/**
 * Baut aus einer Desktop-Sicherung (Text von `exportFullBackup`) den Inhalt
 * des Pakets. Die übergebene Sicherung wird nicht verändert.
 */
export function paketInhalt(sicherungsText: string): PaketInhalt {
  const sicherung = JSON.parse(sicherungsText) as unknown;
  if (!istObjekt(sicherung) || !istObjekt(sicherung.data)) throw new Error('Die Sicherung hat nicht die erwartete Form.');
  const daten = sicherung.data;
  const ordner = new OrdnerPfade((Array.isArray(daten.folders) ? daten.folders : []).filter(istObjekt));
  const ablage = new Ablage();

  for (const stelle of STELLEN) {
    const liste = daten[stelle.bereich];
    if (!Array.isArray(liste)) continue;
    for (const rekord of liste) {
      if (!istObjekt(rekord)) continue;
      const ziel = stelle.unterobjekt === null ? rekord : rekord[stelle.unterobjekt];
      if (!istObjekt(ziel)) continue;
      const b64 = base64Teil(ziel[stelle.desktopFeld]);
      if (b64 === null) continue;
      let inhalt: Uint8Array;
      try {
        inhalt = ausBase64(b64);
      } catch {
        continue; // unlesbar: bleibt wie am Handy unverändert im Eintrag
      }
      const pfad = ablage.pfad(b64, inhalt, () => verzeichnisUndName(stelle.art, ziel, rekord, ordner, inhalt));
      delete ziel[stelle.desktopFeld];
      ziel[stelle.paketFeld] = pfad;
    }
  }

  sicherung.version = PAKET_VERSION;
  return { sicherung, dateien: [...ablage.pfadVonInhalt.values()].map(d => ({ name: d.pfad, data: d.data })) };
}

export interface PaketErstellt {
  bytes: Uint8Array;
  /** Anzahl der Dateien im Paket (ohne sicherung.json) */
  dateien: number;
}

/**
 * Schreibt das Sicherungspaket: `sicherung.json` zuerst, danach die Dateien;
 * mit Passwort jeder Eintrag mit AES-256 (WinZip-AES, AE-2).
 */
export async function schreibePaket(sicherungsText: string, passwort?: string | null, jetzt: Date = new Date()): Promise<PaketErstellt> {
  const { sicherung, dateien } = paketInhalt(sicherungsText);
  const json = new TextEncoder().encode(JSON.stringify(sicherung, null, 2));
  const bytes = await schreibeZip([{ name: PAKET_JSON_NAME, data: json }, ...dateien], passwort, jetzt);
  return { bytes, dateien: dateien.length };
}
