/**
 * Verschlüsselte Datensicherung.
 * ---------------------------------------------------------------------------
 *
 * Eine normale Sicherung ist eine JSON-Textdatei: Wer sie in einem Editor
 * öffnet, liest alle Mitglieder samt Adressen und Bankverbindungen, Spenden
 * und Buchungen im Klartext. Dieses Modul legt eine Passwort-Hülle darum.
 *
 * Verfahren (alles Standardbausteine des Browsers, nichts selbst erfunden):
 *   - Schlüssel aus dem Passwort: PBKDF2 mit SHA-256, 600 000 Runden,
 *     zufälliges Salz je Datei. Die vielen Runden machen das Durchprobieren
 *     von Passwörtern langsam.
 *   - Verschlüsselung: AES-256 im GCM-Modus, zufällige Startzahl (IV) je
 *     Datei. GCM erkennt außerdem jede Veränderung der Datei — ein falsches
 *     Passwort und eine beschädigte Datei führen daher zu einem Fehler statt
 *     zu Datenmüll.
 *
 * Die Hülle ist selbst eine JSON-Datei, damit sie dieselbe Endung behält und
 * sich als verschlüsselt erkennen lässt. Sie enthält bewusst keinen Vereinsnamen
 * und keine Zählwerte — nur, was zum Entschlüsseln nötig ist.
 *
 * Es gibt keine Hintertür: Ohne das Passwort lässt sich die Datei nicht mehr
 * lesen, auch nicht von der App und nicht von den Entwicklern.
 *
 * Voraussetzung: `crypto.subtle` des Browsers. Es fehlt, wenn die Anwendung
 * über "http://" von einer anderen Adresse als "localhost" geladen wird. Eine
 * selbstgebaute Verschlüsselung als Ersatz gibt es hier bewusst nicht — bei
 * Verschlüsselung ist Selbstgebautes das größte Risiko. Stattdessen sagt die
 * App dann klar, dass es nicht geht.
 */

export const VERSCHLUESSELT_FORMAT = 'vereinsmanager-verschluesselt';
const FORMAT_VERSION = 1;
const ITERATIONEN = 600_000;
/** Grenzen für Werte, die aus einer fremden Datei gelesen werden. */
const MIN_ITERATIONEN = 100_000;
const MAX_ITERATIONEN = 5_000_000;
const SALZ_BYTES = 16;
const IV_BYTES = 12;

export const MIN_PASSWORT_LAENGE = 8;

interface Huelle {
  app: string;
  format: typeof VERSCHLUESSELT_FORMAT;
  version: number;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  daten: string;
}

/** Steht die Verschlüsselung des Browsers zur Verfügung? */
export function kannVerschluesseln(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.importKey === 'function' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  );
}

function zuBase64(bytes: Uint8Array): string {
  // In Stücken, damit große Dateien (Belege liegen als Text in der Sicherung)
  // nicht an der Argumentgrenze von String.fromCharCode scheitern.
  const stueck = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += stueck) {
    bin += String.fromCharCode(...bytes.subarray(i, i + stueck));
  }
  return btoa(bin);
}

function vonBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function leiteSchluesselAb(
  passwort: string,
  salz: Uint8Array,
  iterationen: number
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const grundlage = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passwort) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salz as BufferSource, iterations: iterationen, hash: 'SHA-256' },
    grundlage,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Erkennt, ob ein Dateitext eine verschlüsselte Sicherung ist.
 * Wirft nicht — bei jedem Zweifel lautet die Antwort "nein".
 */
export function istVerschluesselt(text: string): boolean {
  try {
    const geparst = JSON.parse(text);
    return Boolean(geparst) && geparst.format === VERSCHLUESSELT_FORMAT;
  } catch {
    return false;
  }
}

/** Verschlüsselt den Text einer Sicherung. Gibt den Text der Hülle zurück. */
export async function verschluessleSicherung(klartext: string, passwort: string): Promise<string> {
  if (!kannVerschluesseln()) {
    throw new Error(
      'Die Verschlüsselung steht in diesem Zusammenhang nicht zur Verfügung. ' +
        'Sie funktioniert nur, wenn die Anwendung über "localhost" oder per "https://" geöffnet wird.'
    );
  }
  if (passwort.length < MIN_PASSWORT_LAENGE) {
    throw new Error(`Das Passwort muss mindestens ${MIN_PASSWORT_LAENGE} Zeichen lang sein.`);
  }

  const salz = globalThis.crypto.getRandomValues(new Uint8Array(SALZ_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const schluessel = await leiteSchluesselAb(passwort, salz, ITERATIONEN);
  const chiffre = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    schluessel,
    new TextEncoder().encode(klartext) as BufferSource
  );

  const huelle: Huelle = {
    app: 'VereinsManager Lokal',
    format: VERSCHLUESSELT_FORMAT,
    version: FORMAT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONEN,
    cipher: 'AES-256-GCM',
    salt: zuBase64(salz),
    iv: zuBase64(iv),
    daten: zuBase64(new Uint8Array(chiffre))
  };
  return JSON.stringify(huelle);
}

/**
 * Entschlüsselt eine verschlüsselte Sicherung. Wirft mit verständlicher
 * Meldung bei falschem Passwort, beschädigter oder unbekannter Datei.
 */
export async function entschluessleSicherung(text: string, passwort: string): Promise<string> {
  let huelle: Partial<Huelle>;
  try {
    huelle = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige Sicherung.');
  }
  if (!huelle || huelle.format !== VERSCHLUESSELT_FORMAT) {
    throw new Error('Die Datei ist keine verschlüsselte Sicherung.');
  }
  if (huelle.version !== FORMAT_VERSION) {
    throw new Error(
      'Diese verschlüsselte Sicherung stammt aus einer neueren Fassung der App. Bitte die App aktualisieren.'
    );
  }
  if (!kannVerschluesseln()) {
    throw new Error(
      'Zum Entschlüsseln fehlt dem Browser in diesem Zusammenhang die nötige Funktion. ' +
        'Bitte die App über "localhost" oder per "https://" öffnen.'
    );
  }

  const iterationen = Number(huelle.iterations);
  if (
    !Number.isInteger(iterationen) ||
    iterationen < MIN_ITERATIONEN ||
    iterationen > MAX_ITERATIONEN ||
    typeof huelle.salt !== 'string' ||
    typeof huelle.iv !== 'string' ||
    typeof huelle.daten !== 'string'
  ) {
    throw new Error('Die verschlüsselte Sicherung ist beschädigt.');
  }

  let salz: Uint8Array;
  let iv: Uint8Array;
  let chiffre: Uint8Array;
  try {
    salz = vonBase64(huelle.salt);
    iv = vonBase64(huelle.iv);
    chiffre = vonBase64(huelle.daten);
  } catch {
    throw new Error('Die verschlüsselte Sicherung ist beschädigt.');
  }

  try {
    const schluessel = await leiteSchluesselAb(passwort, salz, iterationen);
    const klar = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      schluessel,
      chiffre as BufferSource
    );
    return new TextDecoder().decode(klar);
  } catch {
    // Falsches Passwort und veränderte Datei sind für GCM nicht zu
    // unterscheiden — die Meldung nennt deshalb beides.
    throw new Error('Das Passwort ist falsch, oder die Datei wurde verändert oder beschädigt.');
  }
}
