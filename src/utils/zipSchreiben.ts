/**
 * ZIP-Schreiber für das Sicherungspaket (P30 Teil 2), Gegenstück zu `zipReader.ts`.
 * ---------------------------------------------------------------------------
 *
 * Schreibt so, wie die Android-Fassung (Bibliothek zip4j) liest:
 *  - jeder Eintrag mit Deflate (Methode 8), Dateinamen als UTF-8 (Bit 11);
 *  - Größen und Prüfsumme stehen im lokalen Kopf VOR den Daten. Android liest
 *    das Paket als Datenstrom von vorn nach hinten und braucht sie dort;
 *  - wahlweise mit Passwort: WinZip-AES, Fassung AE-2, 256 Bit. Je Eintrag
 *    ein eigenes zufälliges Salz (16 Byte); Schlüssel aus dem Passwort mit
 *    PBKDF2-HMAC-SHA1, 1000 Runden; Inhalt mit AES im Zählermodus; dahinter
 *    10 Byte Echtheitsprüfung (HMAC-SHA1). AE-2 schreibt keine CRC (0).
 *
 * Der vorhandene `zipWriter.ts` (ohne Kompression, ohne Passwort) bleibt für
 * die Exporte (Zuwendungsbestätigungen, Excel) unverändert.
 *
 * Grenzen: klassisches ZIP ohne ZIP64, also höchstens 65 535 Einträge und
 * knapp 4 GB insgesamt; darüber gibt es eine klare Fehlermeldung.
 */
import { crc32 } from './zipWriter';
import { winzipAesCtr } from './aes';

export interface PaketDatei {
  /** Name im ZIP, mit „/“ als Ordnertrenner */
  name: string;
  data: Uint8Array;
}

const GRENZE = 0xffffffff - 1024;

/** Deflate-Daten ohne Verkleinerung (gespeicherte Blöcke): gültig für jeden Deflate-Leser. */
export function deflateOhneKompression(daten: Uint8Array): Uint8Array {
  const BLOCK = 0xffff;
  const bloecke = Math.max(1, Math.ceil(daten.length / BLOCK));
  const out = new Uint8Array(daten.length + bloecke * 5);
  let pos = 0;
  for (let b = 0; b < bloecke; b++) {
    const start = b * BLOCK;
    const laenge = Math.min(BLOCK, daten.length - start);
    out[pos] = b === bloecke - 1 ? 1 : 0; // Bit 0: letzter Block; Bits 1-2: 00 = gespeichert
    out[pos + 1] = laenge & 0xff;
    out[pos + 2] = laenge >>> 8;
    out[pos + 3] = ~laenge & 0xff;
    out[pos + 4] = (~laenge >>> 8) & 0xff;
    out.set(daten.subarray(start, start + laenge), pos + 5);
    pos += 5 + laenge;
  }
  return out;
}

/**
 * Packt mit Deflate. Nimmt die eingebaute Funktion des Browsers bzw. des
 * Programmfensters (`CompressionStream('deflate-raw')`); fehlt sie, gültige
 * Deflate-Daten ohne Verkleinerung.
 */
export async function deflateRawPacken(daten: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  if (CS) {
    try {
      const strom = new Blob([daten as BlobPart]).stream().pipeThrough(new CS('deflate-raw'));
      return new Uint8Array(await new Response(strom).arrayBuffer());
    } catch {
      // ältere Laufzeit ohne „deflate-raw“: unten ohne Kompression
    }
  }
  return deflateOhneKompression(daten);
}

/** DOS-Datum/Uhrzeit (Jahre ab 1980, Sekunden in 2er-Schritten). */
function dosZeit(d: Date): { zeit: number; datum: number } {
  const jahr = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    zeit: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    datum: ((jahr - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

/** Verschlüsselt einen gepackten Eintrag nach WinZip-AES (AE-2, 256 Bit). */
export async function aesEintrag(gepackt: Uint8Array, passwort: string, salz?: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Die Verschlüsselung ist hier nicht verfügbar (der Browser stellt sie nur über localhost oder https bereit).');
  }
  const s = salz ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const grundlage = await subtle.importKey('raw', new TextEncoder().encode(passwort) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const abgeleitet = new Uint8Array(
    await subtle.deriveBits({ name: 'PBKDF2', salt: s.slice() as BufferSource, iterations: 1000, hash: 'SHA-1' }, grundlage, (32 + 32 + 2) * 8)
  );
  const chiffre = winzipAesCtr(abgeleitet.subarray(0, 32), gepackt);
  const macSchluessel = await subtle.importKey('raw', abgeleitet.slice(32, 64) as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await subtle.sign('HMAC', macSchluessel, chiffre.slice() as BufferSource)).subarray(0, 10);
  const out = new Uint8Array(16 + 2 + chiffre.length + 10);
  out.set(s, 0);
  out.set(abgeleitet.subarray(64, 66), 16); // Prüfwert für das Passwort
  out.set(chiffre, 18);
  out.set(mac, 18 + chiffre.length);
  return out;
}

/**
 * Schreibt die Einträge in dieser Reihenfolge als ZIP (Deflate, wahlweise
 * mit Passwort). `jetzt` setzt die Änderungszeit aller Einträge.
 */
export async function schreibeZip(dateien: PaketDatei[], passwort?: string | null, jetzt: Date = new Date()): Promise<Uint8Array> {
  if (dateien.length > 65535) throw new Error('Zu viele Dateien für eine ZIP-Datei (höchstens 65 535).');
  const mitPasswort = typeof passwort === 'string' && passwort.length > 0;
  const enc = new TextEncoder();
  const { zeit, datum } = dosZeit(jetzt);
  const lokal: Uint8Array[] = [];
  const zentral: Uint8Array[] = [];
  let offset = 0;

  for (const d of dateien) {
    if (d.data.length > GRENZE) throw new Error(`Die Datei „${d.name}“ ist für das ZIP-Format zu groß.`);
    const name = enc.encode(d.name);
    const gepackt = await deflateRawPacken(d.data);
    const inhalt = mitPasswort ? await aesEintrag(gepackt, passwort as string) : gepackt;
    const crc = mitPasswort ? 0 : crc32(d.data); // AE-2: keine CRC, die HMAC ersetzt sie
    const methode = mitPasswort ? 99 : 8;
    const flags = 0x0800 | (mitPasswort ? 0x0001 : 0);
    const version = mitPasswort ? 51 : 20;
    // Zusatzfeld 0x9901: AE-2, Hersteller „AE“, Stärke 3 (256 Bit), eigentliche Methode 8
    const extra = mitPasswort ? new Uint8Array([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, 8, 0]) : new Uint8Array(0);

    const k = new Uint8Array(30 + name.length + extra.length);
    const kv = new DataView(k.buffer);
    kv.setUint32(0, 0x04034b50, true);
    kv.setUint16(4, version, true);
    kv.setUint16(6, flags, true);
    kv.setUint16(8, methode, true);
    kv.setUint16(10, zeit, true);
    kv.setUint16(12, datum, true);
    kv.setUint32(14, crc, true);
    kv.setUint32(18, inhalt.length, true);
    kv.setUint32(22, d.data.length, true);
    kv.setUint16(26, name.length, true);
    kv.setUint16(28, extra.length, true);
    k.set(name, 30);
    k.set(extra, 30 + name.length);

    const z = new Uint8Array(46 + name.length + extra.length);
    const zv = new DataView(z.buffer);
    zv.setUint32(0, 0x02014b50, true);
    zv.setUint16(4, version, true);
    zv.setUint16(6, version, true);
    zv.setUint16(8, flags, true);
    zv.setUint16(10, methode, true);
    zv.setUint16(12, zeit, true);
    zv.setUint16(14, datum, true);
    zv.setUint32(16, crc, true);
    zv.setUint32(20, inhalt.length, true);
    zv.setUint32(24, d.data.length, true);
    zv.setUint16(28, name.length, true);
    zv.setUint16(30, extra.length, true);
    zv.setUint32(42, offset, true);
    z.set(name, 46);
    z.set(extra, 46 + name.length);

    lokal.push(k, inhalt);
    zentral.push(z);
    offset += k.length + inhalt.length;
    if (offset > GRENZE) throw new Error('Das Sicherungspaket würde größer als 4 GB.');
  }

  const zentralGroesse = zentral.reduce((s, p) => s + p.length, 0);
  const ende = new Uint8Array(22);
  const ev = new DataView(ende.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, dateien.length, true);
  ev.setUint16(10, dateien.length, true);
  ev.setUint32(12, zentralGroesse, true);
  ev.setUint32(16, offset, true);

  const teile = [...lokal, ...zentral, ende];
  const out = new Uint8Array(teile.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const t of teile) {
    out.set(t, pos);
    pos += t.length;
  }
  return out;
}
