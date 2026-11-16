import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { aesVerschluessleBlock, winzipAesCtr } from './aes';
import { referenzCtr } from './zipTestHelper';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const ausHex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'hex'));

describe('AES-Block (Prüfwerte des Standards FIPS 197, Anhang C)', () => {
  const klartext = ausHex('00112233445566778899aabbccddeeff');

  it('AES-128', () => {
    expect(hex(aesVerschluessleBlock(ausHex('000102030405060708090a0b0c0d0e0f'), klartext))).toBe(
      '69c4e0d86a7b0430d8cdb78070b4c55a'
    );
  });

  it('AES-192', () => {
    expect(hex(aesVerschluessleBlock(ausHex('000102030405060708090a0b0c0d0e0f1011121314151617'), klartext))).toBe(
      'dda97ca4864cdfe06eaf70a0ec0d7191'
    );
  });

  it('AES-256', () => {
    expect(
      hex(aesVerschluessleBlock(ausHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'), klartext))
    ).toBe('8ea2b7ca516745bfeafc49904b496089');
  });

  it('stimmt für zufällige Schlüssel und Blöcke mit OpenSSL überein', () => {
    for (const laenge of [16, 24, 32]) {
      for (let n = 0; n < 50; n++) {
        const key = randomBytes(laenge);
        const block = randomBytes(16);
        const ecb = createCipheriv(`aes-${laenge * 8}-ecb`, key, null);
        ecb.setAutoPadding(false);
        const erwartet = Buffer.concat([ecb.update(block), ecb.final()]);
        expect(hex(aesVerschluessleBlock(key, block))).toBe(hex(erwartet));
      }
    }
  });

  it('weist eine falsche Schlüssellänge zurück', () => {
    expect(() => aesVerschluessleBlock(new Uint8Array(15), klartext)).toThrow();
  });
});

describe('Zählermodus wie in ZIP-Dateien (WinZip-AES)', () => {
  it('stimmt für verschiedene Längen mit der Vergleichsrechnung überein', () => {
    const key = randomBytes(32);
    for (const laenge of [0, 1, 15, 16, 17, 31, 32, 33, 1000, 70000]) {
      const daten = randomBytes(laenge);
      expect(hex(winzipAesCtr(key, daten))).toBe(hex(referenzCtr(key, daten)));
    }
  });

  it('ist seine eigene Umkehrung (Entschlüsseln = noch einmal anwenden)', () => {
    const key = randomBytes(32);
    const daten = randomBytes(5000);
    expect(hex(winzipAesCtr(key, winzipAesCtr(key, daten)))).toBe(hex(daten));
  });

  it('verändert die Eingabe nicht', () => {
    const key = randomBytes(32);
    const daten = randomBytes(100);
    const kopie = hex(daten);
    winzipAesCtr(key, daten);
    expect(hex(daten)).toBe(kopie);
  });
});
