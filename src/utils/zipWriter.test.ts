import { describe, it, expect } from 'vitest';
import { createZip, crc32 } from './zipWriter';
import { createXlsx, columnLetter, excelDateSerial } from './xlsxWriter';

/** Liest das Zentralverzeichnis einer ZIP-Datei – unabhängig vom Schreiber. */
function liesZip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const endPos = zip.length - 22;
  expect(v.getUint32(endPos, true)).toBe(0x06054b50);
  const anzahl = v.getUint16(endPos + 10, true);
  let pos = v.getUint32(endPos + 16, true);
  const out: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < anzahl; i++) {
    expect(v.getUint32(pos, true)).toBe(0x02014b50);
    const crc = v.getUint32(pos + 16, true);
    const size = v.getUint32(pos + 24, true);
    const nameLen = v.getUint16(pos + 28, true);
    const lokal = v.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(zip.slice(pos + 46, pos + 46 + nameLen));
    expect(v.getUint32(lokal, true)).toBe(0x04034b50);
    const lNameLen = v.getUint16(lokal + 26, true);
    const start = lokal + 30 + lNameLen;
    out.push({ name, data: zip.slice(start, start + size), crc });
    pos += 46 + nameLen;
  }
  return out;
}

describe('ZIP-Schreiber', () => {
  it('berechnet die Prüfsumme richtig (Standard-Prüfwert)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('legt Dateien mit Umlauten im Namen unverändert ab', () => {
    const a = new TextEncoder().encode('Hallo');
    const b = new Uint8Array([0, 1, 2, 255, 254]);
    const dateien = liesZip(createZip([{ name: 'Größe/ä.txt', data: a }, { name: 'b.bin', data: b }]));
    expect(dateien.map(d => d.name)).toEqual(['Größe/ä.txt', 'b.bin']);
    expect(Array.from(dateien[0].data)).toEqual(Array.from(a));
    expect(Array.from(dateien[1].data)).toEqual(Array.from(b));
    expect(dateien[1].crc).toBe(crc32(b));
  });

  it('erzeugt auch ein leeres Archiv', () => {
    expect(liesZip(createZip([]))).toEqual([]);
  });
});

describe('Excel-Schreiber', () => {
  it('rechnet Spaltenbuchstaben und Datumszahlen richtig', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
    expect(excelDateSerial('1970-01-01')).toBe(25569);
    expect(excelDateSerial('2025-03-15')).toBe(45731);
    expect(excelDateSerial('kein Datum')).toBeNull();
  });

  it('enthält die nötigen Teile und schützt vor Formeln und Sonderzeichen', () => {
    const xlsx = createXlsx({
      name: 'Test/[1]',
      headers: ['Name', 'Betrag', 'Datum'],
      rows: [[{ t: 'text', v: '=1+1 & <b>' }, { t: 'money', v: 12.5 }, { t: 'date', v: '2025-03-15' }]]
    });
    const dateien = liesZip(xlsx);
    const namen = dateien.map(d => d.name);
    for (const n of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
      expect(namen).toContain(n);
    }
    const sheet = new TextDecoder().decode(dateien.find(d => d.name === 'xl/worksheets/sheet1.xml')!.data);
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain('=1+1 &amp; &lt;b&gt;');
    expect(sheet).toContain('<v>12.5</v>');
    expect(sheet).toContain('<v>45731</v>');
    const wb = new TextDecoder().decode(dateien.find(d => d.name === 'xl/workbook.xml')!.data);
    expect(wb).toContain('name="Test  1"');
  });
});
