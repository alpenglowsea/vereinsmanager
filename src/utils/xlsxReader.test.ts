import { describe, it, expect } from 'vitest';
import { istXlsx, leseXlsx, leseXlsxZeilen, tabelleAusZeilen, zahlText, zellArt, xmlText, XlsxFehler } from './xlsxReader';
import { leseImportBytes, HINWEIS_WINDOWS_1252 } from './importDatei';
import { LIBREOFFICE_XLSX_BASE64 } from './xlsxTestdaten';
import { baueTestZip } from './zipTestHelper';
import { BankImportService } from '../services/bankImport';

const echteDatei = (): Uint8Array => new Uint8Array(Buffer.from(LIBREOFFICE_XLSX_BASE64, 'base64'));
const enc = (s: string) => new TextEncoder().encode(s);

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Eine von Hand gebaute Mappe; ZIP mit Node (zlib), nicht mit dem eigenen Schreiber. */
function mappe(teile: { blatt: string; shared?: string; styles?: string; workbook?: string; rels?: string; weitere?: Record<string, string> }): Uint8Array {
  const workbook =
    teile.workbook ?? `<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels =
    teile.rels ??
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>';
  const eintraege = [
    { name: '[Content_Types].xml', data: enc('<Types/>') },
    { name: 'xl/workbook.xml', data: enc(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(rels) },
    { name: 'xl/worksheets/sheet1.xml', data: enc(`<?xml version="1.0"?><worksheet ${NS}><sheetData>${teile.blatt}</sheetData></worksheet>`) }
  ];
  if (teile.shared) eintraege.push({ name: 'xl/sharedStrings.xml', data: enc(`<sst ${NS}>${teile.shared}</sst>`) });
  if (teile.styles) eintraege.push({ name: 'xl/styles.xml', data: enc(`<styleSheet ${NS}>${teile.styles}</styleSheet>`) });
  for (const [n, t] of Object.entries(teile.weitere ?? {})) eintraege.push({ name: n, data: enc(t) });
  return baueTestZip(eintraege);
}

describe('Excel-Dateien lesen (P28, wie Android Xlsx)', () => {
  it('liest eine von LibreOffice geschriebene Datei: erstes Blatt, Datum, Uhrzeit, Formelergebnis, WAHR/FALSCH, Text mit Sonderzeichen', async () => {
    const bytes = echteDatei();
    expect(istXlsx(bytes)).toBe(true);
    const t = await leseXlsx(bytes);
    expect(t.headers).toEqual(['Buchungstag', 'Empfänger', 'Verwendungszweck', 'Betrag', 'Uhrzeit', 'Doppelt', 'Formel', 'Ja/Nein', 'Betrag_2']);
    // Leere Zeilen fallen weg; das zweite Blatt wird nicht gelesen
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0]).toEqual({
      Buchungstag: '2026-03-01',
      Empfänger: 'Müller & Söhne <GmbH>',
      Verwendungszweck: 'Beitrag März',
      Betrag: '-1234,5',
      Uhrzeit: '14:30',
      Doppelt: 'x',
      Formel: '-2469',
      'Ja/Nein': 'WAHR',
      Betrag_2: '7'
    });
    expect(t.rows[1]).toMatchObject({ Buchungstag: '2026-12-31', Verwendungszweck: '', Betrag: '0,1', Uhrzeit: '08:05', Formel: '0,3', 'Ja/Nein': 'FALSCH', Betrag_2: '1500000' });
    expect(t.rows[2]).toMatchObject({ Buchungstag: '', Empfänger: 'Nur Text', Betrag_2: '007' });
    expect(JSON.stringify(t)).not.toContain('Darf nicht');
  });

  it('nimmt das erste Blatt laut Arbeitsbuch, auch wenn es nicht sheet1.xml heißt', async () => {
    const zip = mappe({
      blatt: '<row r="1"><c r="A1" t="inlineStr"><is><t>Falsch</t></is></c></row>',
      workbook: `<workbook ${NS}><sheets><sheet name="Erstes" sheetId="7" r:id="rId9"/><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      rels:
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Target="/xl/worksheets/sheet7.xml"/></Relationships>',
      weitere: { 'xl/worksheets/sheet7.xml': `<worksheet ${NS}><sheetData><row><c t="inlineStr"><is><t>Richtig</t></is></c></row></sheetData></worksheet>` }
    });
    expect(await leseXlsxZeilen(zip)).toEqual([['Richtig']]);
  });

  it('liest Text in der Zelle, gemeinsame Texte ohne Lautschrift, Lücken und Zellen ohne Spaltenangabe', async () => {
    const zip = mappe({
      shared: '<si><t>Na</t><rPh><t>ナ</t></rPh></si><si><r><t>Teil</t></r><r><t xml:space="preserve"> zwei</t></r></si>',
      blatt:
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c t="inlineStr"><is><t>&#x4E2D;&amp;&#252;</t></is></c><c t="str"><v>Formeltext</v></c><c t="e"><v>#NV</v></c><c><v>3</v></c></row>'
    });
    expect(await leseXlsxZeilen(zip)).toEqual([
      ['Na', '', 'Teil zwei'],
      ['中&ü', 'Formeltext', '', '3']
    ]);
  });

  it('erkennt Datum und Uhrzeit an eigenen Zahlenformaten, Text in Anführungszeichen zählt nicht', async () => {
    const zip = mappe({
      styles:
        '<numFmts><numFmt numFmtId="164" formatCode="[$-407]DD.MM.YYYY"/><numFmt numFmtId="165" formatCode="&quot;Stand &quot;0.00"/><numFmt numFmtId="166" formatCode="hh:mm"/></numFmts>' +
        '<cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="166"/><xf numFmtId="14"/></cellXfs>',
      blatt: '<row><c s="1"><v>45000.75</v></c><c s="2"><v>12.5</v></c><c s="3"><v>0.5</v></c><c s="4"><v>1</v></c><c s="9"><v>2</v></c></row>'
    });
    expect(await leseXlsxZeilen(zip)).toEqual([['2023-03-15', '12,5', '12:00', '1899-12-31', '2']]);
  });

  it('Zahlen wie am Handy: Rechenreste weg, Exponent aufgelöst, kein Tausenderpunkt', () => {
    expect(zahlText('0.30000000000000004', 'n')).toBe('0,3');
    expect(zahlText('1.5E-3', 'n')).toBe('0,0015');
    expect(zahlText('1E3', 'n')).toBe('1000');
    expect(zahlText('-0', 'n')).toBe('0');
    expect(zahlText('abc', 'n')).toBe('abc');
    expect(zellArt(22, new Map())).toBe('d');
    expect(zellArt(20, new Map())).toBe('t');
    expect(zellArt(4, new Map())).toBe('n');
    expect(xmlText('&lt;a&gt; &unbekannt; &#65;')).toBe('<a> &unbekannt; A');
  });

  it('Überschriften wie am Handy: doppelte mit _2, leere heißen „Spalte“, leere Zeilen entfallen', () => {
    expect(tabelleAusZeilen([[], ['A', '', 'A'], [' ', ''], ['1', '2']])).toEqual({
      headers: ['A', 'Spalte', 'A_2'],
      rows: [{ A: '1', Spalte: '2', A_2: '' }]
    });
  });

  it('Importweg: Excel als Tabelle, CSV als Text, alte .xls und fremde ZIPs mit verständlicher Meldung', async () => {
    const excel = await leseImportBytes(echteDatei());
    expect(excel.art).toBe('tabelle');
    const csv = await leseImportBytes(enc('\uFEFFDatum;Betrag\n01.03.2026;12,50'));
    expect(csv).toEqual({ art: 'text', text: 'Datum;Betrag\n01.03.2026;12,50' });
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    await expect(leseImportBytes(xls)).rejects.toThrow(/ältere Excel-Datei/);
    const fremd = baueTestZip([{ name: 'a.txt', data: enc('x') }]);
    expect(istXlsx(fremd)).toBe(false);
    await expect(leseImportBytes(fremd)).rejects.toBeInstanceOf(XlsxFehler);
  });
});

describe('Excel im Bankimport (P28, echter Aufrufweg)', () => {
  it('die LibreOffice-Datei ergibt Buchungszeilen mit Datum, Betrag und Partner', async () => {
    const d = await leseImportBytes(echteDatei());
    if (d.art !== 'tabelle') throw new Error('keine Tabelle');
    const zeilen = BankImportService.parseBankZeilen(d.tabelle.rows, []);
    // Die dritte Zeile hat weder Datum noch Betrag und zählt nicht
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toMatchObject({ date: '2026-03-01', amount: -1234.5, partner: 'Müller & Söhne <GmbH>', bookingText: 'Beitrag März' });
    expect(zeilen[1]).toMatchObject({ date: '2026-12-31', amount: 0.1, partner: 'Sportshop' });
  });
});

describe('CSV in Windows-Kodierung (R1, wie Android MemberCsv.decode)', () => {
  it('liest ungültiges UTF-8 als Windows-1252 und gibt den Hinweis; gültiges UTF-8 ohne Hinweis', async () => {
    // „Müller;12 €“ in Windows-1252: ü = FC, € = 80 (in Latin-1 wäre 80 ein Steuerzeichen)
    const win = new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x3b, 0x31, 0x32, 0x20, 0x80]);
    expect(await leseImportBytes(win)).toEqual({ art: 'text', text: 'Müller;12 €', hinweis: HINWEIS_WINDOWS_1252 });
    const utf8 = await leseImportBytes(enc('Müller;12 €'));
    expect(utf8).toEqual({ art: 'text', text: 'Müller;12 €' });
  });
});
