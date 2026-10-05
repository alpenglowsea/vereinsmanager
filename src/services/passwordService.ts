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
 */
const ITERATIONS = 210000;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

const MELDUNG_KEINE_KRYPTO =
  'Dieser Browser stellt die nötige Kryptographie nicht bereit. Sie fehlt, wenn die Anwendung ' +
  'über "http://" von einer anderen Adresse als "localhost" geöffnet wird. Bitte die Desktop-App ' +
  'oder "localhost" verwenden.';

/**
 * Das eingebaute Kryptoverfahren des Browsers (`crypto.subtle`). Es fehlt nur
 * in unsicheren Zusammenhängen — vor allem, wenn die Anwendung über "http://"
 * von einer fremden Adresse geladen wird. Die Anwendung läuft aber nur auf dem
 * eigenen Gerät (Desktop-App bzw. "localhost"), und dort steht es zur
 * Verfügung. Früher gab es für den Fehlerfall einen selbstgebauten
 * Ersatzweg in JavaScript; er wurde entfernt, weil selbstgebaute Kryptographie
 * ein Risiko ist und der Fall nicht mehr vorkommt. Bereits gespeicherte
 * Prüfwerte bleiben gültig: Beide Wege rechneten dasselbe Standardverfahren.
 */
function holeKrypto(): Crypto {
  const krypto = (globalThis as { crypto?: Crypto }).crypto;
  if (
    !krypto ||
    typeof krypto.subtle === 'undefined' ||
    typeof krypto.subtle.importKey !== 'function' ||
    typeof krypto.getRandomValues !== 'function'
  ) {
    throw new Error(MELDUNG_KEINE_KRYPTO);
  }
  return krypto;
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

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const krypto = holeKrypto();
  const key = await krypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await krypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

/**
 * Prüfwert für ein neues Passwort erzeugen.
 * Ergebnis: pbkdf2$sha256$<wiederholungen>$<salz>$<prüfwert>
 *
 * Wirft, wenn der Browser die nötige Kryptographie nicht bereitstellt.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = holeKrypto().getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derive(plain, salt, ITERATIONS);
  return `${PREFIX}$${ALGO}$${ITERATIONS}$${toBase64(salt)}$${toBase64(key)}`;
}

/** Vergleich ohne Zeitunterschied, damit sich nichts abtasten lässt. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Passwort gegen einen gespeicherten Prüfwert prüfen.
 *
 * Ein Wert, der kein Prüfwert ist (leer, beschädigt, im Klartext), gilt immer
 * als falsch — es gibt keinen Umweg über einen direkten Vergleich.
 *
 * Wirft nur, wenn der Browser die nötige Kryptographie nicht bereitstellt;
 * sonst käme die irreführende Meldung "Passwort falsch".
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith(`${PREFIX}$`)) return false;

  const parts = stored.split('$');
  if (parts.length !== 5) return false;

  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  holeKrypto();

  try {
    const salt = fromBase64(parts[3]);
    const expected = fromBase64(parts[4]);
    const actual = await derive(plain, salt, iterations);
    return equalBytes(actual, expected);
  } catch {
    return false;
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
