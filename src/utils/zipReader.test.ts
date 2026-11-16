import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { oeffneZip, istZip, ZipFehler, ZipFehlerArt } from './zipReader';
import { createZip } from './zipWriter';
import { baueTestZip } from './zipTestHelper';

const utf8 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'utf8'));
const gleich = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

/** Erwartet, dass das Versprechen mit einem ZipFehler der genannten Art scheitert. */
async function fehlerArt(p: Promise<unknown>): Promise<ZipFehlerArt | 'kein Fehler' | 'anderer Fehler'> {
  try {
    await p;
    return 'kein Fehler';
  } catch (e) {
    return e instanceof ZipFehler ? e.art : 'anderer Fehler';
  }
}

const TEXT = utf8('{"app":"VereinsManager","data":{"members":[{"id":"m1","lastName":"Müßig"}]}}'.repeat(40));
const PDF = new Uint8Array(Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(40_000)]));

describe('oeffneZip: unverschlüsselt', () => {
  it('liest Einträge, wie Android sie schreibt (Deflate, Größen nach den Daten)', async () => {
    const zip = oeffneZip(
      baueTestZip([
        { name: 'sicherung.json', data: TEXT },
        { name: 'dokumente/Satzung & Ordnungen/Satzung.pdf', data: PDF }
      ])
    );
    expect(zip.eintraege.map(e => e.name)).toEqual(['sicherung.json', 'dokumente/Satzung & Ordnungen/Satzung.pdf']);
    expect(zip.eintraege[0].verschluesselt).toBe(false);
    expect(zip.eintraege[0].groesse).toBe(TEXT.length);
    expect(gleich(await zip.lies(zip.eintraege[0]), TEXT)).toBe(true);
    expect(gleich(await zip.lies(zip.eintraege[1]), PDF)).toBe(true);
  });

  it('liest Einträge ohne Kompression', async () => {
    const zip = oeffneZip(baueTestZip([{ name: 'a.bin', data: PDF, gespeichert: true }]));
    expect(gleich(await zip.lies(zip.eintraege[0]), PDF)).toBe(true);
  });

  it('liest, was der eigene ZIP-Schreiber erzeugt', async () => {
    const zip = oeffneZip(
      createZip([
        { name: 'Bescheinigung Jörg Müßig.pdf', data: PDF },
        { name: 'leer.txt', data: new Uint8Array(0) }
      ])
    );
    expect(zip.eintraege.map(e => e.name)).toEqual(['Bescheinigung Jörg Müßig.pdf', 'leer.txt']);
    expect(gleich(await zip.lies(zip.eintraege[0]), PDF)).toBe(true);
    expect(await zip.lies(zip.eintraege[1])).toHaveLength(0);
  });

  it('erkennt Umlaute und Sonderzeichen in Namen', () => {
    const zip = oeffneZip(baueTestZip([{ name: 'mitglieder-fotos/M-0012 Müller Jörg ✓.jpg', data: utf8('x') }]));
    expect(zip.eintraege[0].name).toBe('mitglieder-fotos/M-0012 Müller Jörg ✓.jpg');
  });

  it('bemerkt eine beschädigte Datei an der Prüfsumme', async () => {
    const bytes = baueTestZip([{ name: 'a.bin', data: PDF, gespeichert: true }]);
    bytes[30 + 5 + 100] ^= 0xff; // ein Byte im Inhalt kippen
    const zip = oeffneZip(bytes);
    expect(await fehlerArt(zip.lies(zip.eintraege[0]))).toBe('beschaedigt');
  });

  it('weist Dateien zurück, die kein ZIP sind', () => {
    expect(istZip(utf8('{"app":"VereinsManager"}'))).toBe(false);
    expect(() => oeffneZip(utf8('{"app":"VereinsManager"} und noch etwas Text dahinter'))).toThrow(ZipFehler);
    expect(() => oeffneZip(new Uint8Array(5))).toThrow(ZipFehler);
  });

  it('weist ein abgeschnittenes ZIP zurück', () => {
    const bytes = baueTestZip([{ name: 'a.bin', data: PDF }]);
    expect(() => oeffneZip(bytes.subarray(0, bytes.length - 30))).toThrow(ZipFehler);
  });
});

describe('oeffneZip: mit Passwort (WinZip-AES-256, AE-2)', () => {
  const PASSWORT = 'Pässwort-ÄÖÜ-12345';
  const paket = (): Uint8Array =>
    baueTestZip(
      [
        { name: 'sicherung.json', data: TEXT },
        { name: 'dokumente/Belege 2026/Beleg.pdf', data: PDF },
        { name: 'leer.txt', data: new Uint8Array(0) }
      ],
      PASSWORT
    );

  it('entschlüsselt mit dem richtigen Passwort (auch mit Umlauten)', async () => {
    const bytes = paket();
    expect(istZip(bytes)).toBe(true);
    const zip = oeffneZip(bytes);
    expect(zip.eintraege.every(e => e.verschluesselt)).toBe(true);
    expect(gleich(await zip.lies(zip.eintraege[0], PASSWORT), TEXT)).toBe(true);
    expect(gleich(await zip.lies(zip.eintraege[1], PASSWORT), PDF)).toBe(true);
    expect(await zip.lies(zip.eintraege[2], PASSWORT)).toHaveLength(0);
  });

  it('der Inhalt steht nicht lesbar in der Datei', () => {
    expect(Buffer.from(paket()).includes(Buffer.from('VereinsManager'))).toBe(false);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const zip = oeffneZip(paket());
    expect(await fehlerArt(zip.lies(zip.eintraege[0], 'Passwort-AOU-12345'))).toBe('passwort-falsch');
  });

  it('meldet ein fehlendes Passwort', async () => {
    const zip = oeffneZip(paket());
    expect(await fehlerArt(zip.lies(zip.eintraege[0]))).toBe('passwort-fehlt');
    expect(await fehlerArt(zip.lies(zip.eintraege[0], ''))).toBe('passwort-fehlt');
  });

  it('bemerkt veränderten verschlüsselten Inhalt', async () => {
    const bytes = paket();
    const zip0 = oeffneZip(bytes);
    // Ein Byte mitten im verschlüsselten Inhalt des zweiten Eintrags kippen.
    const e = zip0.eintraege[1].intern;
    const nameLen = Buffer.from(zip0.eintraege[1].name, 'utf8').length;
    bytes[e.kopfPosition + 30 + nameLen + 11 + 18 + 500] ^= 0x01;
    const zip = oeffneZip(bytes);
    expect(await fehlerArt(zip.lies(zip.eintraege[1], PASSWORT))).toBe('beschaedigt');
    // die anderen Einträge bleiben lesbar
    expect(gleich(await zip.lies(zip.eintraege[0], PASSWORT), TEXT)).toBe(true);
  });
});
