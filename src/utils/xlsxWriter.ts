import { createZip } from './zipWriter';

/**
 * Minimaler Excel-Schreiber (.xlsx) ohne Abhängigkeiten.
 *
 * Eine .xlsx-Datei ist ein ZIP mit ein paar XML-Dateien. Dieser Schreiber
 * erzeugt genau eine Tabelle mit Kopfzeile (fett, fixiert), Text-, Zahl-,
 * Betrags- und Datumszellen. Text wird als „inlineStr“ abgelegt — Excel,
 * LibreOffice und Numbers lesen das; es spart die gemeinsame Textliste.
 *
 * Sicherheit: Text steht in Excel als Text, nie als Formel. Eine
 * Spendernamen-Zelle, die mit „=“ beginnt, wird also nicht ausgeführt.
 */

export type XlsxCell =
  | { t: 'text'; v: string }
  | { t: 'number'; v: number }
  | { t: 'money'; v: number }
  | { t: 'date'; v: string } // YYYY-MM-DD
  | null;

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: XlsxCell[][];
  /** Spaltenbreiten in Zeichen; fehlt der Wert, wird aus dem Inhalt geschätzt. */
  widths?: number[];
}

function xmlEscape(s: string): string {
  // Zeichen, die in XML 1.0 verboten sind, entfernen (Steuerzeichen außer Tab/Zeilenumbruch).
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Spaltenbuchstaben: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Excel-Tageszahl (1900-System) für ein Datum YYYY-MM-DD; null bei ungültigem Wert. */
export function excelDateSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 86400000) + 25569; // 25569 = 01.01.1970 in Excel-Zählung
}

// Stil-Nummern (siehe styles.xml unten)
const STYLE_HEADER = 1;
const STYLE_MONEY = 2;
const STYLE_DATE = 3;

function cellXml(ref: string, cell: XlsxCell): string {
  if (!cell) return '';
  switch (cell.t) {
    case 'text':
      if (cell.v === '') return '';
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`;
    case 'number':
      return Number.isFinite(cell.v) ? `<c r="${ref}"><v>${cell.v}</v></c>` : '';
    case 'money':
      return Number.isFinite(cell.v) ? `<c r="${ref}" s="${STYLE_MONEY}"><v>${cell.v}</v></c>` : '';
    case 'date': {
      const serial = excelDateSerial(cell.v);
      return serial === null ? '' : `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`;
    }
  }
}

function cellLength(cell: XlsxCell): number {
  if (!cell) return 0;
  if (cell.t === 'text') return cell.v.length;
  if (cell.t === 'date') return 10;
  return String(cell.v).length + 2;
}

export function createXlsx(sheet: XlsxSheet): Uint8Array {
  const encoder = new TextEncoder();
  const colCount = sheet.headers.length;

  const widths = sheet.headers.map((h, i) => {
    if (sheet.widths?.[i]) return sheet.widths[i];
    let w = h.length + 2;
    for (const row of sheet.rows) w = Math.max(w, Math.min(cellLength(row[i] ?? null) + 2, 60));
    return Math.min(Math.max(w, 8), 60);
  });

  let rowsXml = '<row r="1">';
  sheet.headers.forEach((h, i) => {
    rowsXml += `<c r="${columnLetter(i)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(h)}</t></is></c>`;
  });
  rowsXml += '</row>';
  sheet.rows.forEach((row, r) => {
    const rowNo = r + 2;
    let cells = '';
    for (let c = 0; c < colCount; c++) cells += cellXml(`${columnLetter(c)}${rowNo}`, row[c] ?? null);
    rowsXml += `<row r="${rowNo}">${cells}</row>`;
  });

  const lastRef = `${columnLetter(Math.max(colCount - 1, 0))}${sheet.rows.length + 1}`;
  const colsXml = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/>` +
    `</worksheet>`;

  // Blattname: höchstens 31 Zeichen, ohne \ / ? * [ ] :
  const safeName = (sheet.name.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Tabelle').slice(0, 31);

  const files: Record<string, string> = {
    '[Content_Types].xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`,
    '_rels/.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    'xl/worksheets/sheet1.xml': sheetXml,
    'xl/workbook.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${xmlEscape(safeName)}" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
    // Stile: 0 Standard, 1 Kopfzeile (fett, grau hinterlegt), 2 Betrag (#.##0,00), 3 Datum (landesübliche Kurzform)
    'xl/styles.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
      `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="4">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
      `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
      `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
      `</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
  };

  return createZip(Object.entries(files).map(([name, text]) => ({ name, data: encoder.encode(text) })));
}
