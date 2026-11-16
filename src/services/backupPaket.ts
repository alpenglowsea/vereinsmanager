/**
 * Sicherungspaket (Format 1.3.0) EINLESEN.
 * ---------------------------------------------------------------------------
 *
 * Die Android-Fassung sichert als ZIP-Datei: `sicherung.json` mit allen Daten
 * und daneben die Belege, Dokumente und Fotos als einzelne Dateien, wahlweise
 * mit Passwort (BACKUP_FORMAT.md, Abschnitt 8).
 *
 * Die Desktop-Fassung speichert Dateien bisher als Text (Data-URL) direkt im
 * Datensatz. Dieses Modul übersetzt deshalb beim Einlesen zurück: Aus dem
 * Verweis auf eine Datei im ZIP wird wieder die Data-URL im Datensatz.
 * Heraus kommt der Text einer Sicherung, wie ihn der vorhandene Einspielweg
 * (`StorageService.analysiereSicherung` / `importFullBackup`) schon versteht.
 *
 *   Bereich        im Paket            am Desktop
 *   documents      file                dataUrl
 *   transactions   receipt.file        receipt.dataUrl
 *   members        avatarFile          avatarUrl
 *   inventory      photoFile           photoUrl
 *
 * Das Schreiben eines Pakets am Desktop ist noch nicht umgesetzt.
 */
import { istZip, oeffneZip, ZipFehler } from '../utils/zipReader';

export const PAKET_JSON_NAME = 'sicherung.json';
const MAX_JSON_BYTES = 64 * 1024 * 1024;

/** Ist die Datei ein Sicherungspaket (ZIP)? Erkannt an den ersten vier Bytes. */
export function istPaket(bytes: Uint8Array): boolean {
  return istZip(bytes);
}

/** Ist der erste Eintrag des Pakets verschlüsselt? (Bit 0 der Kennzeichen im ersten Kopf.) */
export function istPaketVerschluesselt(bytes: Uint8Array): boolean {
  return istZip(bytes) && bytes.length >= 8 && (bytes[6] & 1) === 1;
}

export interface PaketErgebnis {
  /** Text einer Sicherung in der Form, die der vorhandene Einspielweg versteht. */
  jsonText: string;
  /** Anzahl der Dateien, die aus dem Paket übernommen wurden. */
  dateien: number;
  /** Dateien, die ein Eintrag nennt, die im Paket aber fehlen. */
  fehlend: string[];
}

interface DateiStelle {
  bereich: string;
  /** Unterobjekt, an dem die Angabe hängt (bei Buchungen der Beleg). */
  unterobjekt: string | null;
  paketFeld: string;
  desktopFeld: string;
  /** Feld mit dem Dateityp (MIME), falls der Eintrag eines führt. */
  typFeld: string | null;
  /** Muss das Desktop-Feld immer vorhanden sein (dann leer statt weggelassen)? */
  pflicht: boolean;
}

const STELLEN: DateiStelle[] = [
  { bereich: 'documents', unterobjekt: null, paketFeld: 'file', desktopFeld: 'dataUrl', typFeld: 'fileType', pflicht: true },
  { bereich: 'transactions', unterobjekt: 'receipt', paketFeld: 'file', desktopFeld: 'dataUrl', typFeld: 'type', pflicht: true },
  { bereich: 'members', unterobjekt: null, paketFeld: 'avatarFile', desktopFeld: 'avatarUrl', typFeld: null, pflicht: false },
  { bereich: 'inventory', unterobjekt: null, paketFeld: 'photoFile', desktopFeld: 'photoUrl', typFeld: null, pflicht: false }
];

const MIME_NACH_ENDUNG: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/** Dateityp an den ersten Bytes erkennen (wie `Dateityp.erkennen` in der Android-Fassung). */
function mimeAusInhalt(b: Uint8Array): string | null {
  const ab = (...w: number[]): boolean => b.length >= w.length && w.every((x, i) => b[i] === x);
  if (ab(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (ab(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ab(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (ab(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (b.length >= 12 && ab(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

function bestimmeMime(angabe: unknown, pfad: string, inhalt: Uint8Array): string {
  if (typeof angabe === 'string') {
    const sauber = angabe.split(';')[0].trim().toLowerCase();
    if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(sauber)) return sauber;
  }
  const ausInhalt = mimeAusInhalt(inhalt);
  if (ausInhalt) return ausInhalt;
  const punkt = pfad.lastIndexOf('.');
  const endung = punkt >= 0 ? pfad.slice(punkt + 1).toLowerCase() : '';
  return MIME_NACH_ENDUNG[endung] ?? 'application/octet-stream';
}

function zuBase64(bytes: Uint8Array): string {
  // In Stücken, weil String.fromCharCode nur eine begrenzte Zahl von
  // Argumenten auf einmal verträgt.
  let binaer = '';
  const STUECK = 0x8000;
  for (let i = 0; i < bytes.length; i += STUECK) {
    binaer += String.fromCharCode.apply(null, bytes.subarray(i, i + STUECK) as unknown as number[]);
  }
  return btoa(binaer);
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Liest ein Sicherungspaket und gibt den Text einer Sicherung zurück, in der
 * die Dateien wieder als Data-URL in den Einträgen stehen.
 *
 * Wirft einen `ZipFehler` (mit `art`), wenn das Passwort fehlt oder falsch
 * ist oder das Paket beschädigt ist. Nichts wird gespeichert; das Einspielen
 * selbst geschieht danach über den vorhandenen Weg.
 */
export async function lesePaket(bytes: Uint8Array, passwort?: string): Promise<PaketErgebnis> {
  const zip = oeffneZip(bytes);
  const nachName = new Map(zip.eintraege.filter(e => !e.istOrdner).map(e => [e.name, e] as const));

  const jsonEintrag = nachName.get(PAKET_JSON_NAME);
  if (!jsonEintrag) {
    throw new ZipFehler('format', `Das ist kein VereinsManager-Sicherungspaket (${PAKET_JSON_NAME} fehlt).`);
  }
  if (jsonEintrag.groesse > MAX_JSON_BYTES) {
    throw new ZipFehler('format', `${PAKET_JSON_NAME} im Paket ist unplausibel groß.`);
  }
  const jsonBytes = await zip.lies(jsonEintrag, passwort);

  let sicherung: unknown;
  try {
    sicherung = JSON.parse(new TextDecoder('utf-8').decode(jsonBytes));
  } catch {
    throw new ZipFehler('format', `${PAKET_JSON_NAME} im Paket ist keine gültige JSON-Datei.`);
  }
  if (!istObjekt(sicherung)) {
    throw new ZipFehler('format', `${PAKET_JSON_NAME} im Paket enthält keine Datensicherung.`);
  }
  const daten = istObjekt(sicherung.data) ? sicherung.data : sicherung;

  // Jede Datei wird nur einmal gelesen, auch wenn mehrere Einträge sie nennen
  // (ein Beleg hängt an der Buchung UND steht als Dokument in der Ablage).
  const geladen = new Map<string, { bytes: Uint8Array; base64: string } | null>(); // bytes = die ersten 16 Byte
  const fehlend: string[] = [];
  const lade = async (pfad: string): Promise<{ bytes: Uint8Array; base64: string } | null> => {
    if (geladen.has(pfad)) return geladen.get(pfad) ?? null;
    const eintrag = nachName.get(pfad);
    let ergebnis: { bytes: Uint8Array; base64: string } | null = null;
    if (eintrag) {
      const inhalt = await zip.lies(eintrag, passwort);
      // Nur den Anfang aufheben (für die Erkennung des Dateityps), nicht die ganze Datei.
      ergebnis = { bytes: inhalt.slice(0, 16), base64: zuBase64(inhalt) };
    } else {
      fehlend.push(pfad);
    }
    geladen.set(pfad, ergebnis);
    return ergebnis;
  };

  for (const stelle of STELLEN) {
    const liste = daten[stelle.bereich];
    if (!Array.isArray(liste)) continue;
    for (const rekord of liste) {
      if (!istObjekt(rekord)) continue;
      const ziel = stelle.unterobjekt === null ? rekord : rekord[stelle.unterobjekt];
      if (!istObjekt(ziel)) continue;
      const pfad = ziel[stelle.paketFeld];
      if (typeof pfad !== 'string' || pfad === '') continue;

      const datei = await lade(pfad);
      delete ziel[stelle.paketFeld];
      if (datei) {
        const mime = bestimmeMime(stelle.typFeld ? ziel[stelle.typFeld] : null, pfad, datei.bytes);
        ziel[stelle.desktopFeld] = `data:${mime};base64,${datei.base64}`;
      } else if (stelle.pflicht) {
        // Der Eintrag bleibt, nur ohne Inhalt; die fehlende Datei wird gemeldet.
        ziel[stelle.desktopFeld] = '';
      }
    }
  }

  const dateien = [...geladen.values()].filter(Boolean).length;
  return { jsonText: JSON.stringify(sicherung), dateien, fehlend };
}

/**
 * Macht aus einem Lesefehler die Meldung für die Oberfläche.
 */
export function paketFehlerText(err: unknown): string {
  if (err instanceof ZipFehler) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Das Sicherungspaket konnte nicht gelesen werden.';
}

/**
 * Hinweis für die Oberfläche, wenn im Paket Dateien fehlten, auf die ein
 * Eintrag verweist. Ohne fehlende Dateien: kein Hinweis.
 */
export function paketHinweis(ergebnis: PaketErgebnis): string | undefined {
  const n = ergebnis.fehlend.length;
  if (n === 0) return undefined;
  const beispiele = ergebnis.fehlend.slice(0, 3).join('; ');
  const mehr = n > 3 ? ` und ${n - 3} weitere` : '';
  return `Hinweis: ${n === 1 ? 'Eine Datei fehlte' : `${n} Dateien fehlten`} im Sicherungspaket (${beispiele}${mehr}). Die zugehörigen Einträge wurden ohne Datei übernommen.`;
}
