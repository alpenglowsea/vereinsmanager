import Papa from 'papaparse';
import { DonationReceipt, ClubSettings } from '../types';
import { generateBmfDonationReceiptPdf } from './donationService';
import { createZip, ZipEntry } from '../utils/zipWriter';
import { createXlsx, XlsxCell } from '../utils/xlsxWriter';
import { saveBlobWithLocationPicker, FileSaveResult } from '../utils/fileExportHelper';

/**
 * Sammel-Export für Zuwendungsbestätigungen: Liste als CSV oder Excel sowie
 * alle PDFs in einer ZIP-Datei. Es wird nichts verändert oder gelöscht.
 */

export const SPENDEN_SPALTEN = [
  'Beleg-Nr.',
  'Art',
  'Datum der Zuwendung',
  'Spender',
  'Spendertyp',
  'Straße',
  'Hausnummer',
  'PLZ',
  'Ort',
  'Land',
  'Betrag / Wert (EUR)',
  'Betrag in Worten',
  'Verzicht auf Erstattung',
  'Sachspende: Bezeichnung',
  'Sachspende: Herkunft',
  'Sachspende: Wertermittlung',
  'Finanzamt',
  'Steuernummer',
  'Freistellungsbescheid vom',
  'Veranlagungszeitraum',
  'Gemeinnütziger Zweck',
  'Unmittelbar gefördert',
  'Ausgestellt von',
  'Ort und Datum der Ausstellung',
  'Notizen'
] as const;

const COL_MONEY = 10;
const COL_DATES = [2, 18];

function jaNein(v: boolean): string {
  return v ? 'Ja' : 'Nein';
}

/** Die Tabelle als einfache Werte; Betrag als Zahl, Datum als YYYY-MM-DD (Text). */
export function baueSpendenTabelle(receipts: DonationReceipt[]): (string | number)[][] {
  return receipts.map(r => [
    r.receiptNumber || '',
    r.type === 'money' ? 'Geldzuwendung' : 'Sachzuwendung',
    r.date || '',
    r.donorName || '',
    r.donorType === 'member' ? 'Mitglied' : 'Extern',
    r.donorAddress?.street || '',
    r.donorAddress?.houseNumber || '',
    r.donorAddress?.zip || '',
    r.donorAddress?.city || '',
    r.donorAddress?.country || '',
    Number.isFinite(r.amount) ? r.amount : 0,
    r.amountInWords || '',
    jaNein(!!r.isWaiverOfRefund),
    r.type === 'goods' ? r.goodsDescription || '' : '',
    r.type === 'goods' ? (r.goodsOrigin === 'business' ? 'Betriebsvermögen' : r.goodsOrigin === 'private' ? 'Privatvermögen' : '') : '',
    r.type === 'goods' ? r.goodsValuationBasis || '' : '',
    r.taxOffice || '',
    r.taxNumber || '',
    r.exemptionDate || '',
    r.assessmentPeriod || '',
    r.promotedPurpose || '',
    jaNein(!!r.isDirectlyPromoted),
    r.issuedBy || '',
    r.cityAndDate || '',
    (r.notes || '').replace(/(\r\n|\n|\r)/g, ' ')
  ]);
}

/** YYYY-MM-DD → TT.MM.JJJJ; alles andere bleibt unverändert. */
export function deutschesDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** 1234.5 → "1234,50" (deutsches Komma, ohne Tausenderpunkt: Excel liest das als Zahl). */
export function deutscherBetrag(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/**
 * Schutz vor „CSV-Injection“: Beginnt ein Text mit = + - @, würde Excel ihn
 * beim Öffnen als Formel auslesen. Ein vorangestelltes Hochkomma macht ihn
 * zum reinen Text.
 */
export function csvTextSicher(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function baueSpendenCsv(receipts: DonationReceipt[]): string {
  const zeilen = baueSpendenTabelle(receipts).map(row =>
    row.map((v, i) => {
      if (i === COL_MONEY) return deutscherBetrag(Number(v));
      if (COL_DATES.includes(i)) return deutschesDatum(String(v));
      return csvTextSicher(String(v));
    })
  );
  return Papa.unparse({ fields: [...SPENDEN_SPALTEN], data: zeilen }, { delimiter: ';' });
}

export function baueSpendenXlsx(receipts: DonationReceipt[]): Uint8Array {
  const rows: XlsxCell[][] = baueSpendenTabelle(receipts).map(row =>
    row.map((v, i): XlsxCell => {
      if (i === COL_MONEY) return { t: 'money', v: Number(v) };
      if (COL_DATES.includes(i)) return v ? { t: 'date', v: String(v) } : null;
      return { t: 'text', v: String(v) };
    })
  );
  return createXlsx({ name: 'Zuwendungsbestätigungen', headers: [...SPENDEN_SPALTEN], rows });
}

/** Umlaute ausschreiben und alles Unsichere durch _ ersetzen – für Dateinamen. */
export function dateinameTeil(s: string): string {
  return (s || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Dateinamen im ZIP, eindeutig auch bei doppelten Nummern/Namen. */
export function pdfDateinamen(receipts: DonationReceipt[]): string[] {
  const benutzt = new Set<string>();
  return receipts.map(r => {
    const basis = `Zuwendungsbestaetigung_${dateinameTeil(r.receiptNumber) || 'ohne-Nr'}_${dateinameTeil(r.donorName) || 'Spender'}`;
    let name = `${basis}.pdf`;
    let n = 2;
    while (benutzt.has(name.toLowerCase())) name = `${basis}_${n++}.pdf`;
    benutzt.add(name.toLowerCase());
    return name;
  });
}

export function zipDateiname(settings: ClubSettings, anzahl: number): string {
  const verein = dateinameTeil(settings.clubName) || 'Verein';
  return `Zuwendungsbestaetigungen_${verein}_${anzahl}_Stueck.zip`;
}

const tabelleDatum = () => new Date().toISOString().slice(0, 10);

export async function exportiereSpendenCsv(receipts: DonationReceipt[], settings: ClubSettings): Promise<FileSaveResult> {
  const blob = new Blob(['﻿' + baueSpendenCsv(receipts)], { type: 'text/csv;charset=utf-8;' });
  return saveBlobWithLocationPicker(blob, `Zuwendungen_${dateinameTeil(settings.clubName) || 'Verein'}_${tabelleDatum()}.csv`, {
    description: 'CSV-Tabelle (*.csv)',
    mimeType: 'text/csv',
    extension: '.csv'
  });
}

export async function exportiereSpendenXlsx(receipts: DonationReceipt[], settings: ClubSettings): Promise<FileSaveResult> {
  const bytes = baueSpendenXlsx(receipts);
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveBlobWithLocationPicker(blob, `Zuwendungen_${dateinameTeil(settings.clubName) || 'Verein'}_${tabelleDatum()}.xlsx`, {
    description: 'Excel-Tabelle (*.xlsx)',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx'
  });
}

/**
 * Erzeugt alle PDFs und packt sie in eine ZIP-Datei. Zwischen den PDFs wird
 * die Oberfläche kurz freigegeben (setTimeout 0), damit der Fortschritt
 * angezeigt werden kann und das Fenster nicht „hängt“.
 */
export async function exportiereSpendenZip(
  receipts: DonationReceipt[],
  settings: ClubSettings,
  onFortschritt?: (fertig: number, gesamt: number) => void
): Promise<FileSaveResult> {
  const namen = pdfDateinamen(receipts);
  const eintraege: ZipEntry[] = [];
  for (let i = 0; i < receipts.length; i++) {
    const pdf = generateBmfDonationReceiptPdf(receipts[i], settings);
    eintraege.push({ name: namen[i], data: new Uint8Array(pdf.output('arraybuffer')) });
    onFortschritt?.(i + 1, receipts.length);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const blob = new Blob([createZip(eintraege) as BlobPart], { type: 'application/zip' });
  return saveBlobWithLocationPicker(blob, zipDateiname(settings, receipts.length), {
    description: 'ZIP-Archiv (*.zip)',
    mimeType: 'application/zip',
    extension: '.zip'
  });
}
