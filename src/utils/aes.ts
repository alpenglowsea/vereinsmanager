/**
 * AES-Blockverschlüsselung und der Zählermodus, wie ihn verschlüsselte
 * ZIP-Dateien („WinZip-AES“) verwenden. Ohne Abhängigkeiten.
 *
 * Warum selbst geschrieben, obwohl das Fenster AES eingebaut hat
 * (`crypto.subtle`): Der eingebaute Zählermodus zählt den Zähler vom Ende des
 * Blocks her hoch (höchstwertiges Byte zuerst). ZIP-Dateien zählen vom Anfang
 * des Blocks her (niederwertiges Byte zuerst). Das lässt sich mit der
 * eingebauten Funktion nicht nachstellen. Schlüsselableitung (PBKDF2) und
 * Echtheitsprüfung (HMAC) kommen weiterhin aus `crypto.subtle`; nur der eine
 * Baustein hier ist eigener Code.
 *
 * Geprüft wird er in den Tests gegen die AES-Umsetzung von Node (OpenSSL) und
 * gegen die veröffentlichten Prüfwerte des Standards (FIPS 197).
 *
 * Hinweis zur Sicherheit: Tabellenbasiertes AES ist grundsätzlich über
 * Laufzeitmessungen angreifbar, wenn ein Angreifer auf demselben Rechner sehr
 * genau messen kann. Hier wird ausschließlich eine Datei entschlüsselt, deren
 * Passwort der Benutzer gerade selbst eingegeben hat; das Risiko ist für
 * diesen Zweck vertretbar.
 */

const SBOX = new Uint8Array(256);
const TE0 = new Uint32Array(256);
const TE1 = new Uint32Array(256);
const TE2 = new Uint32Array(256);
const TE3 = new Uint32Array(256);
let tabellenFertig = false;

function baueTabellen(): void {
  if (tabellenFertig) return;
  // S-Box nach der Definition des Standards: Kehrwert im Körper GF(2^8),
  // danach eine feste Bit-Umformung.
  const rotl8 = (x: number, n: number): number => ((x << n) | (x >>> (8 - n))) & 0xff;
  let p = 1;
  let q = 1;
  do {
    // p mit 3 malnehmen
    p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 0xff;
    // q durch 3 teilen
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    SBOX[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;

  for (let x = 0; x < 256; x++) {
    const s = SBOX[x];
    const s2 = ((s << 1) ^ (s & 0x80 ? 0x1b : 0)) & 0xff;
    const s3 = s2 ^ s;
    const t = ((s2 << 24) | (s << 16) | (s << 8) | s3) >>> 0;
    TE0[x] = t;
    TE1[x] = ((t >>> 8) | (t << 24)) >>> 0;
    TE2[x] = ((t >>> 16) | (t << 16)) >>> 0;
    TE3[x] = ((t >>> 24) | (t << 8)) >>> 0;
  }
  tabellenFertig = true;
}

/** Rundenschlüssel für einen AES-Schlüssel von 16, 24 oder 32 Byte. */
export function aesRundenschluessel(key: Uint8Array): Uint32Array {
  baueTabellen();
  const nk = key.length / 4;
  if (nk !== 4 && nk !== 6 && nk !== 8) throw new Error('AES-Schlüssel muss 16, 24 oder 32 Byte lang sein.');
  const nr = nk + 6;
  const w = new Uint32Array(4 * (nr + 1));
  for (let i = 0; i < nk; i++) {
    w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
  }
  const subWord = (x: number): number =>
    ((SBOX[x >>> 24] << 24) | (SBOX[(x >>> 16) & 0xff] << 16) | (SBOX[(x >>> 8) & 0xff] << 8) | SBOX[x & 0xff]) >>> 0;
  let rcon = 1;
  for (let i = nk; i < w.length; i++) {
    let temp = w[i - 1];
    if (i % nk === 0) {
      temp = (subWord(((temp << 8) | (temp >>> 24)) >>> 0) ^ (rcon << 24)) >>> 0;
      rcon = ((rcon << 1) ^ (rcon & 0x80 ? 0x1b : 0)) & 0xff;
    } else if (nk > 6 && i % nk === 4) {
      temp = subWord(temp);
    }
    w[i] = (w[i - nk] ^ temp) >>> 0;
  }
  return w;
}

/**
 * Verschlüsselt einen Block aus vier 32-Bit-Wörtern (höchstwertiges Byte
 * zuerst) und schreibt das Ergebnis nach `out` (vier Wörter).
 */
function verschluessleBlock(rk: Uint32Array, a0: number, a1: number, a2: number, a3: number, out: Uint32Array): void {
  const nr = rk.length / 4 - 1;
  let t0 = a0 ^ rk[0];
  let t1 = a1 ^ rk[1];
  let t2 = a2 ^ rk[2];
  let t3 = a3 ^ rk[3];
  let k = 4;
  for (let r = 1; r < nr; r++) {
    const s0 = TE0[t0 >>> 24] ^ TE1[(t1 >>> 16) & 0xff] ^ TE2[(t2 >>> 8) & 0xff] ^ TE3[t3 & 0xff] ^ rk[k];
    const s1 = TE0[t1 >>> 24] ^ TE1[(t2 >>> 16) & 0xff] ^ TE2[(t3 >>> 8) & 0xff] ^ TE3[t0 & 0xff] ^ rk[k + 1];
    const s2 = TE0[t2 >>> 24] ^ TE1[(t3 >>> 16) & 0xff] ^ TE2[(t0 >>> 8) & 0xff] ^ TE3[t1 & 0xff] ^ rk[k + 2];
    const s3 = TE0[t3 >>> 24] ^ TE1[(t0 >>> 16) & 0xff] ^ TE2[(t1 >>> 8) & 0xff] ^ TE3[t2 & 0xff] ^ rk[k + 3];
    t0 = s0;
    t1 = s1;
    t2 = s2;
    t3 = s3;
    k += 4;
  }
  out[0] =
    (((SBOX[t0 >>> 24] << 24) | (SBOX[(t1 >>> 16) & 0xff] << 16) | (SBOX[(t2 >>> 8) & 0xff] << 8) | SBOX[t3 & 0xff]) ^
      rk[k]) >>>
    0;
  out[1] =
    (((SBOX[t1 >>> 24] << 24) | (SBOX[(t2 >>> 16) & 0xff] << 16) | (SBOX[(t3 >>> 8) & 0xff] << 8) | SBOX[t0 & 0xff]) ^
      rk[k + 1]) >>>
    0;
  out[2] =
    (((SBOX[t2 >>> 24] << 24) | (SBOX[(t3 >>> 16) & 0xff] << 16) | (SBOX[(t0 >>> 8) & 0xff] << 8) | SBOX[t1 & 0xff]) ^
      rk[k + 2]) >>>
    0;
  out[3] =
    (((SBOX[t3 >>> 24] << 24) | (SBOX[(t0 >>> 16) & 0xff] << 16) | (SBOX[(t1 >>> 8) & 0xff] << 8) | SBOX[t2 & 0xff]) ^
      rk[k + 3]) >>>
    0;
}

/** Verschlüsselt genau einen 16-Byte-Block (für Tests und Prüfwerte). */
export function aesVerschluessleBlock(key: Uint8Array, block: Uint8Array): Uint8Array {
  if (block.length !== 16) throw new Error('Ein AES-Block ist 16 Byte lang.');
  const rk = aesRundenschluessel(key);
  const wort = (i: number): number =>
    ((block[i] << 24) | (block[i + 1] << 16) | (block[i + 2] << 8) | block[i + 3]) >>> 0;
  const out = new Uint32Array(4);
  verschluessleBlock(rk, wort(0), wort(4), wort(8), wort(12), out);
  const res = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    res[4 * i] = out[i] >>> 24;
    res[4 * i + 1] = (out[i] >>> 16) & 0xff;
    res[4 * i + 2] = (out[i] >>> 8) & 0xff;
    res[4 * i + 3] = out[i] & 0xff;
  }
  return res;
}

/**
 * Zählermodus nach der WinZip-AES-Beschreibung: Der Zähler ist eine
 * 128-Bit-Zahl, niederwertiges Byte zuerst, und beginnt bei 1. Ver- und
 * Entschlüsseln sind dieselbe Rechnung. Gibt ein neues Feld zurück.
 */
export function winzipAesCtr(key: Uint8Array, daten: Uint8Array): Uint8Array {
  const rk = aesRundenschluessel(key);
  const out = new Uint8Array(daten.length);
  const ks = new Uint32Array(4);
  const n = daten.length;
  let zaehlerLo = 1; // untere 32 Bit des Zählers
  let zaehlerHi = 0; // nächste 32 Bit (reicht für weit mehr als jede ZIP-Datei)
  // Byte-Reihenfolge eines 32-Bit-Werts umdrehen: Der Zähler steht mit dem
  // niederwertigen Byte zuerst im Block, AES liest den Block wortweise mit
  // dem höchstwertigen Byte zuerst.
  const dreh = (x: number): number =>
    (((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24)) >>> 0;
  for (let pos = 0; pos < n; pos += 16) {
    verschluessleBlock(rk, dreh(zaehlerLo), dreh(zaehlerHi), 0, 0, ks);
    const ende = Math.min(16, n - pos);
    for (let i = 0; i < ende; i++) {
      out[pos + i] = daten[pos + i] ^ ((ks[i >>> 2] >>> (24 - 8 * (i & 3))) & 0xff);
    }
    zaehlerLo = (zaehlerLo + 1) >>> 0;
    if (zaehlerLo === 0) zaehlerHi = (zaehlerHi + 1) >>> 0;
  }
  return out;
}
