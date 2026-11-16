import { describe, it, expect } from 'vitest';
import { deflateRawSync, constants } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { inflateRaw, InflateFehler } from './inflate';

const gleich = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

/** Gemischte Daten: Text mit Wiederholungen, dazwischen Zufallsbytes. */
function gemischt(groesse: number): Uint8Array {
  const teile: Buffer[] = [];
  let summe = 0;
  let n = 0;
  while (summe < groesse) {
    const teil =
      n % 3 === 0
        ? Buffer.from(`Mitgliedsbeitrag ${n} für Jörg Müßig, Beleg BE-2026-${String(n).padStart(3, '0')}\n`.repeat(20), 'utf8')
        : n % 3 === 1
          ? randomBytes(700)
          : Buffer.alloc(900, n & 0xff);
    teile.push(teil);
    summe += teil.length;
    n++;
  }
  return new Uint8Array(Buffer.concat(teile).subarray(0, groesse));
}

describe('inflateRaw (Vergleich mit zlib von Node)', () => {
  it('entpackt leere Daten', () => {
    expect(inflateRaw(deflateRawSync(Buffer.alloc(0)))).toHaveLength(0);
  });

  it('entpackt kurzen Text mit Umlauten', () => {
    const text = Buffer.from('Grüße aus dem Vereinsheim – äöüß ✓', 'utf8');
    expect(gleich(inflateRaw(deflateRawSync(text)), text)).toBe(true);
  });

  it('entpackt in allen Kompressionsstufen dasselbe', () => {
    const daten = gemischt(300_000);
    for (const level of [0, 1, 3, 6, 9]) {
      const gepackt = deflateRawSync(daten, { level });
      expect(gleich(inflateRaw(gepackt), daten)).toBe(true);
      // auch mit bekannter Zielgröße (so ruft es der ZIP-Leser auf)
      expect(gleich(inflateRaw(gepackt, daten.length), daten)).toBe(true);
    }
  });

  it('entpackt Blöcke mit festen Tabellen', () => {
    const daten = gemischt(50_000);
    const gepackt = deflateRawSync(daten, { strategy: constants.Z_FIXED });
    expect(gleich(inflateRaw(gepackt), daten)).toBe(true);
  });

  it('entpackt reine Huffman-Kodierung und Lauflängen', () => {
    const daten = gemischt(80_000);
    for (const strategy of [constants.Z_HUFFMAN_ONLY, constants.Z_RLE, constants.Z_FILTERED]) {
      expect(gleich(inflateRaw(deflateRawSync(daten, { strategy })), daten)).toBe(true);
    }
  });

  it('entpackt lange Wiederholungen (überlappende Rückverweise)', () => {
    const daten = Buffer.alloc(200_000, 'a');
    expect(gleich(inflateRaw(deflateRawSync(daten)), daten)).toBe(true);
    const muster = Buffer.from('abc'.repeat(70_000));
    expect(gleich(inflateRaw(deflateRawSync(muster)), muster)).toBe(true);
  });

  it('entpackt Zufallsdaten (bereits gepackte Inhalte wie PDF oder JPEG)', () => {
    const daten = randomBytes(150_000);
    expect(gleich(inflateRaw(deflateRawSync(daten)), daten)).toBe(true);
  });

  it('entpackt viele zufällige kleine Eingaben', () => {
    for (let n = 0; n < 200; n++) {
      const daten = gemischt(1 + ((n * 37) % 3000));
      expect(gleich(inflateRaw(deflateRawSync(daten, { level: (n % 9) + 1 })), daten)).toBe(true);
    }
  });

  it('meldet abgeschnittene Daten', () => {
    const gepackt = deflateRawSync(gemischt(20_000));
    expect(() => inflateRaw(gepackt.subarray(0, gepackt.length - 20))).toThrow(InflateFehler);
    expect(() => inflateRaw(new Uint8Array(0))).toThrow(InflateFehler);
  });

  it('meldet eine unbekannte Blockart', () => {
    // Bits: letzter Block = 1, Blockart = 3 (gibt es nicht)
    expect(() => inflateRaw(new Uint8Array([0b111]))).toThrow(InflateFehler);
  });

  it('hält die Obergrenze für die Größe ein', () => {
    const gepackt = deflateRawSync(Buffer.alloc(100_000, 0));
    expect(() => inflateRaw(gepackt, undefined, 10_000)).toThrow(InflateFehler);
  });
});
