/**
 * Entpacken von Deflate-Daten (RFC 1951), ohne Abhängigkeiten.
 *
 * Wofür: Das Sicherungspaket der Android-Fassung ist eine ZIP-Datei, deren
 * Einträge mit Deflate gepackt sind. Um sie am Desktop zu lesen, muss die
 * Anwendung Deflate entpacken können.
 *
 * Warum selbst geschrieben und nicht die eingebaute Funktion des Fensters
 * (`DecompressionStream`): Die Desktop-Fassung läuft unter Linux mit dem
 * Webfenster des jeweiligen Systems, und ältere Systeme kennen diese Funktion
 * nicht. Der Algorithmus ist seit 1996 unverändert und überschaubar; die Tests
 * vergleichen das Ergebnis mit der Deflate-Umsetzung von Node (zlib).
 *
 * Aufbau nach dem Muster von „puff“ aus der zlib-Quelle (Mark Adler):
 * einfache, gut prüfbare Entschlüsselung der Huffman-Codes Bit für Bit.
 */

export class InflateFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InflateFehler';
  }
}

interface Huffman {
  /** Anzahl der Codes je Länge (Index = Länge in Bit). */
  count: Uint16Array;
  /** Symbole, nach Codelänge und dann nach Wert geordnet. */
  symbol: Uint16Array;
}

const MAXBITS = 15;

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577
];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function baueHuffman(lengths: Uint8Array, offset: number, n: number): Huffman {
  const count = new Uint16Array(MAXBITS + 1);
  for (let i = 0; i < n; i++) count[lengths[offset + i]]++;

  // Mehr Codes als bei der jeweiligen Länge möglich: beschädigte Daten.
  let frei = 1;
  for (let len = 1; len <= MAXBITS; len++) {
    frei <<= 1;
    frei -= count[len];
    if (frei < 0) throw new InflateFehler('Die gepackten Daten sind beschädigt (ungültige Codetabelle).');
  }

  const offs = new Uint16Array(MAXBITS + 2);
  for (let len = 1; len <= MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
  const symbol = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const len = lengths[offset + i];
    if (len !== 0) symbol[offs[len]++] = i;
  }
  return { count, symbol };
}

let festeTabellen: { len: Huffman; dist: Huffman } | null = null;

function festeHuffmanTabellen(): { len: Huffman; dist: Huffman } {
  if (festeTabellen) return festeTabellen;
  const l = new Uint8Array(288);
  l.fill(8, 0, 144);
  l.fill(9, 144, 256);
  l.fill(7, 256, 280);
  l.fill(8, 280, 288);
  const d = new Uint8Array(30).fill(5);
  festeTabellen = { len: baueHuffman(l, 0, 288), dist: baueHuffman(d, 0, 30) };
  return festeTabellen;
}

/**
 * Entpackt „rohe“ Deflate-Daten (ohne zlib- oder gzip-Kopf), wie sie in
 * ZIP-Dateien stehen.
 *
 * @param erwarteteGroesse Größe des Ergebnisses, falls bekannt (aus dem
 *   ZIP-Verzeichnis). Spart das schrittweise Vergrößern des Puffers.
 * @param maxGroesse Obergrenze für das Ergebnis; schützt vor Dateien, die
 *   sich zu unsinniger Größe aufblähen.
 */
export function inflateRaw(src: Uint8Array, erwarteteGroesse?: number, maxGroesse = 1024 * 1024 * 1024): Uint8Array {
  let out = new Uint8Array(
    erwarteteGroesse !== undefined && erwarteteGroesse >= 0
      ? Math.min(erwarteteGroesse, maxGroesse)
      : Math.min(maxGroesse, Math.max(1024, src.length * 3))
  );
  let outPos = 0;
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;

  const abgeschnitten = (): never => {
    throw new InflateFehler('Die gepackten Daten sind unvollständig.');
  };

  const platz = (n: number): void => {
    if (outPos + n <= out.length) return;
    if (outPos + n > maxGroesse) throw new InflateFehler('Die entpackten Daten sind unplausibel groß.');
    const neu = new Uint8Array(Math.min(maxGroesse, Math.max(out.length * 2, outPos + n)));
    neu.set(out.subarray(0, outPos));
    out = neu;
  };

  const bits = (n: number): number => {
    while (bitCnt < n) {
      if (pos >= src.length) abgeschnitten();
      bitBuf |= src[pos++] << bitCnt;
      bitCnt += 8;
    }
    const wert = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return wert;
  };

  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= MAXBITS; len++) {
      if (bitCnt === 0) {
        if (pos >= src.length) abgeschnitten();
        bitBuf = src[pos++];
        bitCnt = 8;
      }
      code |= bitBuf & 1;
      bitBuf >>>= 1;
      bitCnt--;
      const count = h.count[len];
      if (code - count < first) return h.symbol[index + (code - first)];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new InflateFehler('Die gepackten Daten sind beschädigt (unbekannter Code).');
  };

  const codes = (lencode: Huffman, distcode: Huffman): void => {
    for (;;) {
      let sym = decode(lencode);
      if (sym < 256) {
        if (outPos >= out.length) platz(1);
        out[outPos++] = sym;
      } else if (sym === 256) {
        return;
      } else {
        sym -= 257;
        if (sym >= 29) throw new InflateFehler('Die gepackten Daten sind beschädigt (ungültige Länge).');
        const len = LBASE[sym] + bits(LEXT[sym]);
        const dsym = decode(distcode);
        if (dsym >= 30) throw new InflateFehler('Die gepackten Daten sind beschädigt (ungültiger Abstand).');
        const dist = DBASE[dsym] + bits(DEXT[dsym]);
        if (dist > outPos) throw new InflateFehler('Die gepackten Daten sind beschädigt (Rückverweis vor den Anfang).');
        platz(len);
        // Byte für Byte: Quelle und Ziel dürfen sich überlappen (so entstehen Wiederholungen).
        let von = outPos - dist;
        for (let i = 0; i < len; i++) out[outPos++] = out[von++];
      }
    }
  };

  let last: number;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      // Ungepackter Block: Rest des angefangenen Bytes verwerfen.
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > src.length) abgeschnitten();
      const len = src[pos] | (src[pos + 1] << 8);
      const nlen = src[pos + 2] | (src[pos + 3] << 8);
      pos += 4;
      if (len !== (~nlen & 0xffff)) throw new InflateFehler('Die gepackten Daten sind beschädigt (Blocklänge).');
      if (pos + len > src.length) abgeschnitten();
      platz(len);
      out.set(src.subarray(pos, pos + len), outPos);
      outPos += len;
      pos += len;
    } else if (type === 1) {
      const t = festeHuffmanTabellen();
      codes(t.len, t.dist);
    } else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw new InflateFehler('Die gepackten Daten sind beschädigt (Tabellengröße).');
      const lengths = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) lengths[CL_ORDER[i]] = bits(3);
      const clcode = baueHuffman(lengths, 0, 19);
      const alle = new Uint8Array(nlen + ndist);
      let index = 0;
      while (index < nlen + ndist) {
        const sym = decode(clcode);
        if (sym < 16) {
          alle[index++] = sym;
        } else {
          let wert = 0;
          let wiederholung: number;
          if (sym === 16) {
            if (index === 0) throw new InflateFehler('Die gepackten Daten sind beschädigt (Wiederholung ohne Vorgänger).');
            wert = alle[index - 1];
            wiederholung = 3 + bits(2);
          } else if (sym === 17) {
            wiederholung = 3 + bits(3);
          } else {
            wiederholung = 11 + bits(7);
          }
          if (index + wiederholung > nlen + ndist) {
            throw new InflateFehler('Die gepackten Daten sind beschädigt (Tabelle zu lang).');
          }
          while (wiederholung--) alle[index++] = wert;
        }
      }
      if (alle[256] === 0) throw new InflateFehler('Die gepackten Daten sind beschädigt (Endezeichen fehlt).');
      codes(baueHuffman(alle, 0, nlen), baueHuffman(alle, nlen, ndist));
    } else {
      throw new InflateFehler('Die gepackten Daten sind beschädigt (unbekannte Blockart).');
    }
  } while (!last);

  return outPos === out.length ? out : out.slice(0, outPos);
}
