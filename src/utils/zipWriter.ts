/**
 * Minimaler ZIP-Schreiber ohne Abhängigkeiten.
 *
 * Warum selbst geschrieben: Dafür gibt es Pakete, aber jedes zusätzliche
 * Paket ist ein Stück fremder Code im Programm, das gepflegt und auf
 * Sicherheitslücken beobachtet werden muss. Das ZIP-Format ist für den hier
 * nötigen Fall (Dateien nur ablegen, nicht verkleinern) sehr einfach.
 *
 * Eigenschaften:
 *  - Methode „Stored“ (ohne Kompression). PDFs sind bereits komprimiert,
 *    eine zweite Kompression würde kaum etwas sparen.
 *  - Dateinamen werden als UTF-8 gekennzeichnet (Bit 11), damit Umlaute
 *    in Windows-Explorer, macOS und Linux richtig ankommen.
 *  - Begrenzung auf das klassische ZIP-Format: höchstens 65 535 Dateien
 *    und je 4 GB. Für Zuwendungsbestätigungen weit mehr als genug; wird
 *    eine Grenze überschritten, gibt es eine klare Fehlermeldung statt
 *    einer beschädigten Datei.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Änderungszeit der Datei; Standard: jetzt. */
  date?: Date;
}

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

export function crc32(data: Uint8Array): number {
  const t = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS-Datum/Uhrzeit (Jahre ab 1980, Sekunden in 2er-Schritten). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 65535) {
    throw new Error('Zu viele Dateien für eine ZIP-Datei (höchstens 65 535).');
  }
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.data.length > 0xffffffff - 1024) {
      throw new Error(`Die Datei „${entry.name}“ ist für das ZIP-Format zu groß.`);
    }
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.date ?? new Date());

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // Kennung „lokaler Dateikopf“
    lv.setUint16(4, 20, true); // Version, die zum Entpacken nötig ist
    lv.setUint16(6, 0x0800, true); // Bit 11: Name ist UTF-8
    lv.setUint16(8, 0, true); // Methode 0 = Stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true); // komprimierte Größe
    lv.setUint32(22, entry.data.length, true); // Originalgröße
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // keine Zusatzfelder
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // Kennung „Zentralverzeichnis“
    cv.setUint16(4, 20, true); // erzeugt mit Version
    cv.setUint16(6, 20, true); // nötig zum Entpacken
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    // 30..45: Zusatzfeld, Kommentar, Datenträger, Attribute = 0
    cv.setUint32(42, offset, true); // Lage des lokalen Dateikopfs
    central.set(nameBytes, 46);

    localParts.push(local, entry.data);
    centralParts.push(central);
    offset += local.length + entry.data.length;
    if (offset > 0xffffffff - 1024) {
      throw new Error('Die ZIP-Datei würde größer als 4 GB.');
    }
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // Kennung „Ende des Zentralverzeichnisses“
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...localParts, ...centralParts, end];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
