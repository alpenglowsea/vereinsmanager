/**
 * ZIP-Leser ohne Abhängigkeiten, Gegenstück zu `zipWriter.ts`.
 *
 * Wofür: das Sicherungspaket (Format 1.3.0, siehe BACKUP_FORMAT.md
 * Abschnitt 8), das die Android-Fassung schreibt – eine ZIP-Datei mit
 * `sicherung.json` und den Belegen, Dokumenten und Fotos als Dateien,
 * wahlweise mit Passwort.
 *
 * Was er kann:
 *  - Einträge „gespeichert“ (ohne Kompression) und „Deflate“
 *  - Verschlüsselung WinZip-AES (AE-1 und AE-2; 128, 192, 256 Bit). So
 *    schreibt es Android (Bibliothek zip4j): je Eintrag ein eigenes Salz,
 *    Schlüssel aus dem Passwort mit PBKDF2-HMAC-SHA1 (1000 Runden), Inhalt
 *    mit AES im Zählermodus, dahinter eine Echtheitsprüfung (HMAC-SHA1,
 *    10 Byte).
 *  - große Archive (ZIP64-Angaben im Verzeichnis)
 *
 * Was er bewusst nicht kann: die alte ZIP-Verschlüsselung („ZipCrypto“, gilt
 * als unsicher und wird von der App nie geschrieben) und andere
 * Kompressionsverfahren.
 *
 * Gelesen wird über das Inhaltsverzeichnis am Ende der Datei. Android schreibt
 * die Größen erst NACH den Daten eines Eintrags; im Verzeichnis am Ende stehen
 * sie zuverlässig.
 */
import { inflateRaw, InflateFehler } from './inflate';
import { winzipAesCtr } from './aes';
import { crc32 } from './zipWriter';

export type ZipFehlerArt = 'format' | 'passwort-fehlt' | 'passwort-falsch' | 'beschaedigt' | 'nicht-unterstuetzt';

export class ZipFehler extends Error {
  art: ZipFehlerArt;
  constructor(art: ZipFehlerArt, message: string) {
    super(message);
    this.name = 'ZipFehler';
    this.art = art;
  }
}

interface AesAngaben {
  /** 1 = AE-1 (mit CRC), 2 = AE-2 (ohne CRC). */
  version: number;
  /** 1 = 128 Bit, 2 = 192 Bit, 3 = 256 Bit. */
  staerke: number;
  /** Eigentliches Kompressionsverfahren des Inhalts (0 oder 8). */
  methode: number;
}

export interface ZipEintrag {
  name: string;
  istOrdner: boolean;
  verschluesselt: boolean;
  /** Größe des entpackten Inhalts in Byte. */
  groesse: number;
  /** Nur für den Leser selbst. */
  intern: {
    flags: number;
    methode: number;
    crc: number;
    gepackt: number;
    kopfPosition: number;
    aes: AesAngaben | null;
  };
}

export interface ZipArchiv {
  /** Einträge in der Reihenfolge, in der sie in der Datei stehen. */
  eintraege: ZipEintrag[];
  /** Liest und entpackt einen Eintrag; bei verschlüsselten Einträgen mit Passwort. */
  lies(eintrag: ZipEintrag, passwort?: string): Promise<Uint8Array>;
}

const SIG_LOKAL = 0x04034b50;
const SIG_ZENTRAL = 0x02014b50;
const SIG_ENDE = 0x06054b50;
const SIG_ENDE64 = 0x06064b50;
const SIG_ENDE64_ZEIGER = 0x07064b50;

/** Beginnt die Datei wie eine ZIP-Datei („PK“ 03 04)? */
export function istZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function oeffneZip(bytes: Uint8Array): ZipArchiv {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number): number => dv.getUint16(p, true);
  const u32 = (p: number): number => dv.getUint32(p, true);
  const u64 = (p: number): number => {
    const hi = u32(p + 4);
    if (hi > 0x1fffff) throw new ZipFehler('nicht-unterstuetzt', 'Die ZIP-Datei ist zu groß.');
    return hi * 0x100000000 + u32(p);
  };
  const kaputt = (text: string): never => {
    throw new ZipFehler('format', text);
  };

  if (bytes.length < 22) kaputt('Die Datei ist keine ZIP-Datei oder unvollständig.');

  // Ende-Eintrag suchen (steht ganz am Schluss, davor höchstens ein Kommentar).
  let ende = -1;
  const untergrenze = Math.max(0, bytes.length - 22 - 0xffff);
  for (let p = bytes.length - 22; p >= untergrenze; p--) {
    if (u32(p) === SIG_ENDE) {
      ende = p;
      break;
    }
  }
  if (ende < 0) kaputt('Die Datei ist keine ZIP-Datei oder unvollständig (das Inhaltsverzeichnis fehlt).');

  let anzahl = u16(ende + 10);
  let verzGroesse = u32(ende + 12);
  let verzPosition = u32(ende + 16);

  if (anzahl === 0xffff || verzGroesse === 0xffffffff || verzPosition === 0xffffffff) {
    const zeiger = ende - 20;
    if (zeiger < 0 || u32(zeiger) !== SIG_ENDE64_ZEIGER) kaputt('Die ZIP-Datei ist beschädigt (ZIP64-Angaben fehlen).');
    const ende64 = u64(zeiger + 8);
    if (ende64 + 56 > bytes.length || u32(ende64) !== SIG_ENDE64) kaputt('Die ZIP-Datei ist beschädigt (ZIP64-Angaben).');
    anzahl = u64(ende64 + 32);
    verzGroesse = u64(ende64 + 40);
    verzPosition = u64(ende64 + 48);
  }
  if (verzPosition + verzGroesse > bytes.length) kaputt('Die ZIP-Datei ist unvollständig.');

  const text = new TextDecoder('utf-8');
  const eintraege: ZipEintrag[] = [];
  let p = verzPosition;
  for (let i = 0; i < anzahl; i++) {
    if (p + 46 > bytes.length || u32(p) !== SIG_ZENTRAL) kaputt('Die ZIP-Datei ist beschädigt (Inhaltsverzeichnis).');
    const flags = u16(p + 8);
    const methode = u16(p + 10);
    const crc = u32(p + 16);
    let gepackt = u32(p + 20);
    let groesse = u32(p + 24);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const kommentarLen = u16(p + 32);
    let kopfPosition = u32(p + 42);
    if (p + 46 + nameLen + extraLen + kommentarLen > bytes.length) kaputt('Die ZIP-Datei ist beschädigt (Inhaltsverzeichnis).');
    const name = text.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    // Zusatzfelder: ZIP64-Größen und die AES-Angaben.
    let aes: AesAngaben | null = null;
    let x = p + 46 + nameLen;
    const xEnde = x + extraLen;
    while (x + 4 <= xEnde) {
      const id = u16(x);
      const len = u16(x + 2);
      const daten = x + 4;
      if (daten + len > xEnde) break;
      if (id === 0x0001) {
        let q = daten;
        if (groesse === 0xffffffff && q + 8 <= daten + len) {
          groesse = u64(q);
          q += 8;
        }
        if (gepackt === 0xffffffff && q + 8 <= daten + len) {
          gepackt = u64(q);
          q += 8;
        }
        if (kopfPosition === 0xffffffff && q + 8 <= daten + len) {
          kopfPosition = u64(q);
        }
      } else if (id === 0x9901 && len >= 7) {
        aes = { version: u16(daten), staerke: bytes[daten + 4], methode: u16(daten + 5) };
      }
      x = daten + len;
    }

    eintraege.push({
      name,
      istOrdner: name.endsWith('/'),
      verschluesselt: (flags & 1) === 1,
      groesse,
      intern: { flags, methode, crc, gepackt, kopfPosition, aes }
    });
    p += 46 + nameLen + extraLen + kommentarLen;
  }
  eintraege.sort((a, b) => a.intern.kopfPosition - b.intern.kopfPosition);

  const lies = async (eintrag: ZipEintrag, passwort?: string): Promise<Uint8Array> => {
    const e = eintrag.intern;
    const kopf = e.kopfPosition;
    if (kopf + 30 > bytes.length || u32(kopf) !== SIG_LOKAL) {
      throw new ZipFehler('beschaedigt', `Die ZIP-Datei ist beschädigt (Eintrag „${eintrag.name}“).`);
    }
    const start = kopf + 30 + u16(kopf + 26) + u16(kopf + 28);
    const stop = start + e.gepackt;
    if (stop > bytes.length) {
      throw new ZipFehler('beschaedigt', `Die ZIP-Datei ist unvollständig (Eintrag „${eintrag.name}“).`);
    }
    let roh = bytes.subarray(start, stop);
    let methode = e.methode;
    let crcPruefen = true;

    if (eintrag.verschluesselt) {
      if (methode !== 99 || !e.aes) {
        throw new ZipFehler(
          'nicht-unterstuetzt',
          'Die ZIP-Datei verwendet die alte ZIP-Verschlüsselung. Unterstützt wird nur AES, wie es der VereinsManager schreibt.'
        );
      }
      if (!passwort) throw new ZipFehler('passwort-fehlt', 'Die Datei ist durch ein Passwort geschützt.');
      roh = await entschluessle(roh, e.aes, passwort, eintrag.name);
      methode = e.aes.methode;
      // AE-2 schreibt keine CRC; die Echtheitsprüfung (HMAC) ersetzt sie.
      crcPruefen = e.aes.version === 1;
    }

    let daten: Uint8Array;
    if (methode === 0) {
      daten = roh.slice();
    } else if (methode === 8) {
      try {
        daten = inflateRaw(roh, eintrag.groesse);
      } catch (err) {
        if (err instanceof InflateFehler) {
          throw new ZipFehler('beschaedigt', `Eintrag „${eintrag.name}“: ${err.message}`);
        }
        throw err;
      }
    } else {
      throw new ZipFehler(
        'nicht-unterstuetzt',
        `Eintrag „${eintrag.name}“ ist mit einem nicht unterstützten Verfahren gepackt (Nr. ${methode}).`
      );
    }

    if (daten.length !== eintrag.groesse) {
      throw new ZipFehler('beschaedigt', `Eintrag „${eintrag.name}“ hat nicht die erwartete Größe.`);
    }
    if (crcPruefen && crc32(daten) !== e.crc) {
      throw new ZipFehler('beschaedigt', `Eintrag „${eintrag.name}“ ist beschädigt (Prüfsumme stimmt nicht).`);
    }
    return daten;
  };

  return { eintraege, lies };
}

async function entschluessle(roh: Uint8Array, aes: AesAngaben, passwort: string, name: string): Promise<Uint8Array> {
  const schluesselLaenge = aes.staerke === 1 ? 16 : aes.staerke === 2 ? 24 : aes.staerke === 3 ? 32 : 0;
  if (schluesselLaenge === 0) {
    throw new ZipFehler('nicht-unterstuetzt', `Eintrag „${name}“: unbekannte AES-Schlüssellänge.`);
  }
  const salzLaenge = schluesselLaenge / 2;
  if (roh.length < salzLaenge + 2 + 10) {
    throw new ZipFehler('beschaedigt', `Eintrag „${name}“ ist unvollständig.`);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new ZipFehler(
      'nicht-unterstuetzt',
      'Passwortgeschützte Sicherungen können in diesem Fenster nicht geöffnet werden (die Verschlüsselungsfunktion des Browsers fehlt).'
    );
  }

  const salz = roh.subarray(0, salzLaenge);
  const pruefwert = roh.subarray(salzLaenge, salzLaenge + 2);
  const chiffre = roh.subarray(salzLaenge + 2, roh.length - 10);
  const echtheit = roh.subarray(roh.length - 10);

  // Aus Passwort und Salz entstehen: AES-Schlüssel, HMAC-Schlüssel und zwei
  // Byte, an denen sich ein falsches Passwort sofort erkennen lässt.
  const grundlage = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passwort) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const abgeleitet = new Uint8Array(
    await subtle.deriveBits(
      { name: 'PBKDF2', salt: salz.slice() as BufferSource, iterations: 1000, hash: 'SHA-1' },
      grundlage,
      (2 * schluesselLaenge + 2) * 8
    )
  );
  const aesSchluessel = abgeleitet.subarray(0, schluesselLaenge);
  const hmacSchluessel = abgeleitet.subarray(schluesselLaenge, 2 * schluesselLaenge);
  const erwartet = abgeleitet.subarray(2 * schluesselLaenge);
  if (erwartet[0] !== pruefwert[0] || erwartet[1] !== pruefwert[1]) {
    throw new ZipFehler('passwort-falsch', 'Das Passwort ist falsch.');
  }

  // Erst die Echtheit prüfen, dann entschlüsseln: So wird veränderter oder
  // beschädigter Inhalt gar nicht erst verarbeitet.
  const hmacKey = await subtle.importKey(
    'raw',
    hmacSchluessel.slice() as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const mac = new Uint8Array(await subtle.sign('HMAC', hmacKey, chiffre.slice() as BufferSource));
  let abweichung = 0;
  for (let i = 0; i < 10; i++) abweichung |= mac[i] ^ echtheit[i];
  if (abweichung !== 0) {
    throw new ZipFehler(
      'beschaedigt',
      `Eintrag „${name}“ ist beschädigt oder wurde verändert (die Echtheitsprüfung ist fehlgeschlagen).`
    );
  }

  return winzipAesCtr(aesSchluessel, chiffre);
}
