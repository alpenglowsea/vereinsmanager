/**
 * Nur für Tests: baut ZIP-Dateien so, wie die Android-Fassung (Bibliothek
 * zip4j) sie schreibt – Deflate, Größen erst nach den Daten
 * („Datenbeschreibung“), wahlweise WinZip-AES-256 (AE-2).
 *
 * Bewusst mit den Bausteinen von Node (zlib, OpenSSL) geschrieben und nicht
 * mit dem eigenen Code aus `inflate.ts` / `aes.ts`: So prüfen die Tests den
 * eigenen Leser gegen eine unabhängige Umsetzung.
 */
import { deflateRawSync } from 'node:zlib';
import { createCipheriv, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { crc32 } from './zipWriter';

export interface TestEintrag {
  name: string;
  data: Uint8Array;
  /** Ohne Kompression ablegen (Standard: Deflate). */
  gespeichert?: boolean;
}

/** WinZip-AES-Zählermodus mit OpenSSL: Zähler niederwertiges Byte zuerst, Start bei 1. */
export function referenzCtr(key: Uint8Array, daten: Uint8Array): Uint8Array {
  const bloecke = Math.ceil(daten.length / 16);
  const zaehler = Buffer.alloc(bloecke * 16);
  for (let i = 0; i < bloecke; i++) zaehler.writeUInt32LE(i + 1, i * 16);
  const ecb = createCipheriv(`aes-${key.length * 8}-ecb`, key, null);
  ecb.setAutoPadding(false);
  const strom = Buffer.concat([ecb.update(zaehler), ecb.final()]);
  const out = new Uint8Array(daten.length);
  for (let i = 0; i < daten.length; i++) out[i] = daten[i] ^ strom[i];
  return out;
}

export function baueTestZip(eintraege: TestEintrag[], passwort?: string): Uint8Array {
  const teile: Buffer[] = [];
  const zentral: Buffer[] = [];
  let position = 0;

  for (const e of eintraege) {
    const name = Buffer.from(e.name, 'utf8');
    const methodeInhalt = e.gespeichert ? 0 : 8;
    let inhalt: Uint8Array = e.gespeichert ? e.data : deflateRawSync(e.data);
    let methode = methodeInhalt;
    let crc = crc32(e.data);
    let extra: Buffer = Buffer.alloc(0);
    let flags = 0x0800 | 0x0008; // UTF-8-Namen, Größen nach den Daten

    if (passwort !== undefined) {
      const salz = randomBytes(16);
      const abgeleitet = pbkdf2Sync(Buffer.from(passwort, 'utf8'), salz, 1000, 66, 'sha1');
      const chiffre = referenzCtr(abgeleitet.subarray(0, 32), inhalt);
      const mac = createHmac('sha1', abgeleitet.subarray(32, 64)).update(chiffre).digest().subarray(0, 10);
      inhalt = Buffer.concat([salz, abgeleitet.subarray(64, 66), chiffre, mac]);
      extra = Buffer.alloc(11);
      extra.writeUInt16LE(0x9901, 0);
      extra.writeUInt16LE(7, 2);
      extra.writeUInt16LE(2, 4); // AE-2
      extra.write('AE', 6, 'latin1');
      extra.writeUInt8(3, 8); // 256 Bit
      extra.writeUInt16LE(methodeInhalt, 9);
      methode = 99;
      crc = 0; // AE-2 schreibt keine CRC
      flags |= 1;
    }

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(passwort !== undefined ? 51 : 20, 4);
    lokal.writeUInt16LE(flags, 6);
    lokal.writeUInt16LE(methode, 8);
    // CRC und Größen bleiben im Kopf 0 (stehen in der Datenbeschreibung)
    lokal.writeUInt16LE(name.length, 26);
    lokal.writeUInt16LE(extra.length, 28);

    const beschreibung = Buffer.alloc(16);
    beschreibung.writeUInt32LE(0x08074b50, 0);
    beschreibung.writeUInt32LE(crc, 4);
    beschreibung.writeUInt32LE(inhalt.length, 8);
    beschreibung.writeUInt32LE(e.data.length, 12);

    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0);
    z.writeUInt16LE(51, 4);
    z.writeUInt16LE(passwort !== undefined ? 51 : 20, 6);
    z.writeUInt16LE(flags, 8);
    z.writeUInt16LE(methode, 10);
    z.writeUInt32LE(crc, 16);
    z.writeUInt32LE(inhalt.length, 20);
    z.writeUInt32LE(e.data.length, 24);
    z.writeUInt16LE(name.length, 28);
    z.writeUInt16LE(extra.length, 30);
    z.writeUInt32LE(position, 42);
    zentral.push(z, name, extra);

    teile.push(lokal, name, extra, Buffer.from(inhalt), beschreibung);
    position += 30 + name.length + extra.length + inhalt.length + 16;
  }

  const verzeichnis = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(eintraege.length, 8);
  ende.writeUInt16LE(eintraege.length, 10);
  ende.writeUInt32LE(verzeichnis.length, 12);
  ende.writeUInt32LE(position, 16);
  return new Uint8Array(Buffer.concat([...teile, verzeichnis, ende]));
}
