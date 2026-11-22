/**
 * Kleine, echte Dateien für den Testverein: ein einseitiges PDF mit ein paar
 * Textzeilen und ein PNG-Bild. Beide werden hier Byte für Byte gebaut, ohne
 * Bibliothek und ohne Zufall – dieselben Eingaben ergeben immer dieselbe
 * Datei. So bleibt die Testdatei im Repository bei jedem Neuerzeugen gleich,
 * und ein Test kann das prüfen.
 *
 * Die PDFs sind Platzhalter („Testdaten“ steht darauf). Sie sollen nur zeigen,
 * wie Belege, Rechnungen und Bestätigungen in der Dokumentenverwaltung liegen,
 * und klein bleiben (je etwa 1 KB).
 */

// ---------------------------------------------------------------------------
// Base64 (ohne Buffer, damit die Datei auch im Browser übersetzbar bleibt)
// ---------------------------------------------------------------------------

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Text für einen PDF-String: Klammern und Rückstrich maskiert, Umlaute und
 * das Euro-Zeichen als Oktalcode der WinAnsi-Kodierung. Andere Zeichen
 * außerhalb von ASCII werden zu „?“. Damit besteht die ganze Datei aus
 * ASCII, und die Byte-Positionen im Verzeichnis (xref) stimmen.
 */
const WIN_ANSI: Record<string, string> = {
  ä: '\\344',
  ö: '\\366',
  ü: '\\374',
  Ä: '\\304',
  Ö: '\\326',
  Ü: '\\334',
  ß: '\\337',
  '€': '\\200',
  '–': '\\226',
  '§': '\\247',
  '„': '\\204',
  '“': '\\223'
};

function pdfText(t: string): string {
  let aus = '';
  for (const z of t) {
    if (z === '(' || z === ')' || z === '\\') aus += '\\' + z;
    else if (WIN_ANSI[z]) aus += WIN_ANSI[z];
    else if (z.charCodeAt(0) >= 32 && z.charCodeAt(0) < 127) aus += z;
    else aus += '?';
  }
  return aus;
}

/** Einseitiges A4-PDF: fette Überschrift, darunter Zeilen in Normalschrift. */
export function pdfDatei(titel: string, zeilen: string[]): { dataUrl: string; groesse: number } {
  const inhalt = [
    'BT',
    '/F2 16 Tf',
    '56 780 Td',
    `(${pdfText(titel)}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    ...zeilen.flatMap((z, i) => (i === 0 ? [`(${pdfText(z)}) Tj`] : ['0 -16 Td', `(${pdfText(z)}) Tj`])),
    '0 -32 Td',
    '/F1 9 Tf',
    `(${pdfText('Testdaten des VereinsManagers – Platzhalter, kein echter Beleg.')}) Tj`,
    'ET'
  ].join('\n');

  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const positionen: number[] = [];
  objekte.forEach((o, i) => {
    positionen.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const p of positionen) pdf += `${String(p).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return { dataUrl: `data:application/pdf;base64,${base64(bytes)}`, groesse: bytes.length };
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of daten) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(daten: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const x of daten) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function block(typ: string, daten: Uint8Array): number[] {
  const kopf = Array.from(typ, z => z.charCodeAt(0));
  const mitTyp = new Uint8Array([...kopf, ...daten]);
  return [...u32(daten.length), ...mitTyp, ...u32(crc32(mitTyp))];
}

/**
 * zlib-Strom ohne Kompression („stored“-Blöcke). Größer als nötig, aber
 * gültig und ohne Bibliothek zu bauen; die Bilder sind ohnehin klein.
 */
function zlibUnkomprimiert(roh: Uint8Array): Uint8Array {
  const teile: number[] = [0x78, 0x01];
  for (let i = 0; i < roh.length || i === 0; i += 65535) {
    const stueck = roh.subarray(i, Math.min(i + 65535, roh.length));
    const letzter = i + 65535 >= roh.length ? 1 : 0;
    teile.push(letzter, stueck.length & 0xff, stueck.length >>> 8, ~stueck.length & 0xff, (~stueck.length >>> 8) & 0xff);
    for (const b of stueck) teile.push(b);
    if (roh.length === 0) break;
  }
  teile.push(...u32(adler32(roh)));
  return new Uint8Array(teile);
}

export type Farbe = [number, number, number];

/** Zeichenfläche mit RGB-Bildpunkten; `malen` setzt sie, danach wird ein PNG daraus. */
export class Bild {
  readonly punkte: Uint8Array;
  constructor(
    readonly breite: number,
    readonly hoehe: number,
    hintergrund: Farbe
  ) {
    this.punkte = new Uint8Array(breite * hoehe * 3);
    this.rechteck(0, 0, breite, hoehe, hintergrund);
  }

  punkt(x: number, y: number, f: Farbe): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.breite || yi >= this.hoehe) return;
    const i = (yi * this.breite + xi) * 3;
    this.punkte[i] = f[0];
    this.punkte[i + 1] = f[1];
    this.punkte[i + 2] = f[2];
  }

  rechteck(x: number, y: number, b: number, h: number, f: Farbe): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + b; xx++) this.punkt(xx, yy, f);
  }

  /** Linie mit Strichstärke `dicke` (in Bildpunkten). */
  linie(x1: number, y1: number, x2: number, y2: number, f: Farbe, dicke = 1): void {
    const schritte = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    const r = Math.floor(dicke / 2);
    for (let s = 0; s <= schritte; s++) {
      const x = x1 + ((x2 - x1) * s) / schritte;
      const y = y1 + ((y2 - y1) * s) / schritte;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) this.punkt(x + dx, y + dy, f);
    }
  }

  /**
   * Als PNG. `schwarzWeiss`: ein Bit je Bildpunkt (dunkel = schwarz) – für
   * Unterschriften, die so nur ein Vierundzwanzigstel des Platzes brauchen.
   */
  alsPng(schwarzWeiss = false): string {
    const zeile = schwarzWeiss ? Math.ceil(this.breite / 8) : this.breite * 3;
    const roh = new Uint8Array((zeile + 1) * this.hoehe);
    for (let y = 0; y < this.hoehe; y++) {
      const start = y * (zeile + 1);
      roh[start] = 0; // Filter: keiner
      if (!schwarzWeiss) {
        roh.set(this.punkte.subarray(y * zeile, (y + 1) * zeile), start + 1);
        continue;
      }
      for (let x = 0; x < this.breite; x++) {
        const i = (y * this.breite + x) * 3;
        const hell = this.punkte[i] + this.punkte[i + 1] + this.punkte[i + 2] >= 384;
        if (hell) roh[start + 1 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    const ihdr = new Uint8Array([...u32(this.breite), ...u32(this.hoehe), ...(schwarzWeiss ? [1, 0] : [8, 2]), 0, 0, 0]);
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...block('IHDR', ihdr),
      ...block('IDAT', zlibUnkomprimiert(roh)),
      ...block('IEND', new Uint8Array(0))
    ]);
    return `data:image/png;base64,${base64(bytes)}`;
  }
}

/**
 * Unterschrift als Linienzüge (Format wie `utils/unterschrift.ts`: Punkte
 * [x, y] auf 0..1 bezogen) und als PNG. Die Form ergibt sich aus dem Namen,
 * damit jede Person „ihre“ Unterschrift hat und nichts zufällig ist.
 */
export function unterschrift(name: string): { aspect: number; strokes: number[][][]; dataUrl: string } {
  const aspect = 3;
  let saat = 0;
  for (const z of name) saat = (saat * 31 + z.charCodeAt(0)) >>> 0;
  const r4 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  const zug: number[][] = [];
  const schleifen = 4 + (saat % 3);
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = 0.06 + t * 0.78;
    const y = 0.55 + Math.sin(t * Math.PI * schleifen + (saat % 7)) * 0.22 * (1 - t * 0.4);
    zug.push([r4(x), r4(y)]);
  }
  const strich: number[][] = [
    [0.1, 0.85],
    [r4(0.55 + (saat % 5) * 0.05), 0.82]
  ];
  const strokes = [zug, strich];

  const bild = new Bild(240, 80, [255, 255, 255]);
  const blau: Farbe = [20, 40, 120];
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      bild.linie(s[i - 1][0] * 240, s[i - 1][1] * 80, s[i][0] * 240, s[i][1] * 80, blau, 2);
    }
  }
  return { aspect, strokes, dataUrl: bild.alsPng(true) };
}
