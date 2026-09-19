/**
 * Passwörter im lokalen Betrieb.
 *
 * WAS DAS LEISTET UND WAS NICHT
 *
 * Bis hierher standen die Passwörter im Klartext im Browser-Speicher. Wer die
 * Entwicklerwerkzeuge öffnete, las sie mit. Das ist vor allem deshalb schlimm,
 * weil Menschen dasselbe Passwort auch für ihr E-Mail-Postfach benutzen — der
 * Schaden bliebe also nicht im Verein.
 *
 * Ab jetzt wird nur noch ein Prüfwert gespeichert, aus dem sich das Passwort
 * nicht zurückrechnen lässt (PBKDF2 mit HMAC-SHA-256, eigenem Zufallssalz je
 * Benutzer und vielen Wiederholungen, damit Durchprobieren teuer wird).
 *
 * Was das NICHT leistet: Die Vereinsdaten selbst — Mitglieder, Bankverbindungen,
 * Kassenbuch — liegen unverschlüsselt in der Datenbank des Browsers. Wer an den
 * Rechner kommt, kommt an die Daten, ganz ohne Passwort. Dagegen hilft nur eine
 * Festplattenverschlüsselung des Rechners (Windows: BitLocker bzw.
 * "Geräteverschlüsselung"). Diese Anwendung kann das nicht ersetzen, und sie
 * soll auch nicht so tun.
 */

const PREFIX = 'pbkdf2';
const ALGO = 'sha256';

/**
 * Wiederholungen. Der Wert wird MIT gespeichert, deshalb lässt er sich später
 * erhöhen, ohne dass alte Passwörter ungültig werden.
 *
 * Zwei Werte, weil es zwei Wege gibt: Der Browser rechnet das eingebaute
 * Verfahren in Millisekunden, der Ersatzweg in JavaScript braucht dafür
 * spürbar länger. Ein Verein soll beim Anmelden nicht sekundenlang warten.
 */
const ITERATIONS_NATIVE = 210000;
const ITERATIONS_FALLBACK = 60000;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Steht das eingebaute Kryptoverfahren des Browsers zur Verfügung?
 *
 * Es fehlt in unsicheren Zusammenhängen — vor allem, wenn die Anwendung über
 * "http://" statt "https://" ausgeliefert wird, etwa vom Vereins-NAS. Dann
 * greift der Ersatzweg weiter unten.
 */
function hasNativeCrypto(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.importKey === 'function'
  );
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  // Ohne Zufallsquelle des Browsers: schlechter, aber besser als ein festes
  // Salz. Dieser Fall ist bei allen gängigen Browsern seit Jahren ausgeschlossen.
  for (let i = 0; i < length; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// SHA-256 in reinem JavaScript — nur für den Ersatzweg ohne crypto.subtle.
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function sha256(message: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLen = message.length * 8;
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  // Länge in Bits, 64 Bit gross. Höherwertige Hälfte bleibt 0 — Passwörter
  // sind keine 512 MB lang.
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = sha256(k);

  const padded = new Uint8Array(blockSize);
  padded.set(k);

  const inner = new Uint8Array(blockSize + message.length);
  const outer = new Uint8Array(blockSize + 32);

  for (let i = 0; i < blockSize; i++) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(message, blockSize);

  outer.set(sha256(inner), blockSize);
  return sha256(outer);
}

/** PBKDF2-HMAC-SHA256 ohne Browser-Kryptographie. */
function pbkdf2Js(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLength: number
): Uint8Array {
  const result = new Uint8Array(keyLength);
  const blocks = Math.ceil(keyLength / 32);
  let offset = 0;

  for (let block = 1; block <= blocks; block++) {
    const saltWithIndex = new Uint8Array(salt.length + 4);
    saltWithIndex.set(salt);
    const dv = new DataView(saltWithIndex.buffer);
    dv.setUint32(salt.length, block, false);

    let u = hmacSha256(password, saltWithIndex);
    const acc = new Uint8Array(u);

    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(password, u);
      for (let j = 0; j < acc.length; j++) acc[j] ^= u[j];
    }

    const take = Math.min(32, keyLength - offset);
    result.set(acc.subarray(0, take), offset);
    offset += take;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Öffentliche Schnittstelle
// ---------------------------------------------------------------------------

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const pwBytes = new TextEncoder().encode(password);

  if (hasNativeCrypto()) {
    const key = await globalThis.crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, [
      'deriveBits'
    ]);
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      KEY_BYTES * 8
    );
    return new Uint8Array(bits);
  }

  return pbkdf2Js(pwBytes, salt, iterations, KEY_BYTES);
}

/** Ist dieser gespeicherte Wert bereits ein Prüfwert — oder noch Klartext? */
export function isHashed(stored: string | undefined | null): boolean {
  return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`);
}

/**
 * Prüfwert für ein neues Passwort erzeugen.
 * Ergebnis: pbkdf2$sha256$<wiederholungen>$<salz>$<prüfwert>
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const iterations = hasNativeCrypto() ? ITERATIONS_NATIVE : ITERATIONS_FALLBACK;
  const key = await derive(plain, salt, iterations);
  return `${PREFIX}$${ALGO}$${iterations}$${toBase64(salt)}$${toBase64(key)}`;
}

/** Vergleich ohne Zeitunterschied, damit sich nichts abtasten lässt. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface VerifyResult {
  /** Passt das Passwort? */
  ok: boolean;
  /**
   * Lag das Passwort noch im Klartext vor? Dann sollte der Aufrufer es jetzt
   * durch einen Prüfwert ersetzen.
   */
  needsUpgrade: boolean;
}

/**
 * Passwort prüfen.
 *
 * Kommt mit beiden Formen zurecht: Für Konten aus der Zeit vor dieser Änderung
 * steht im Speicher noch der Klartext. Die werden hier erkannt und im selben
 * Zug zur Umstellung gemeldet — ein Verein soll nach einem Update nicht vor
 * einer Anmeldung stehen, die plötzlich nicht mehr funktioniert.
 */
export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsUpgrade: false };

  if (!isHashed(stored)) {
    return { ok: stored === plain, needsUpgrade: stored === plain };
  }

  const parts = stored.split('$');
  if (parts.length !== 5) return { ok: false, needsUpgrade: false };

  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations <= 0) return { ok: false, needsUpgrade: false };

  try {
    const salt = fromBase64(parts[3]);
    const expected = fromBase64(parts[4]);
    const actual = await derive(plain, salt, iterations);
    return { ok: equalBytes(actual, expected), needsUpgrade: false };
  } catch {
    return { ok: false, needsUpgrade: false };
  }
}

/** Mindestlänge für neue Passwörter. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Prüft ein neues Passwort auf das Nötigste.
 *
 * Bewusst keine Vorschriften über Sonderzeichen und Ziffern: Die führen
 * erfahrungsgemäss zu "Sommer2024!" auf einem Zettel unter der Tastatur.
 * Länge hilft mehr.
 */
export function checkPasswordStrength(plain: string): { ok: boolean; message?: string } {
  const value = (plain || '').trim();

  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`
    };
  }

  const trivial = ['passwort', 'password', '12345678', 'verein', 'vorstand', 'qwertz', 'admin'];
  if (trivial.some(t => value.toLowerCase() === t || value.toLowerCase().startsWith(t + '1'))) {
    return { ok: false, message: 'Bitte ein weniger naheliegendes Passwort wählen.' };
  }

  return { ok: true };
}

/**
 * Läuft die Anwendung in einem Zusammenhang, in dem der Browser richtige
 * Kryptographie anbietet? Für einen Hinweis in den Einstellungen.
 */
export function usesNativeCrypto(): boolean {
  return hasNativeCrypto();
}
