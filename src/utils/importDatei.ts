/**
 * Eine Datei für die Importe einlesen: Excel (.xlsx) oder Text (CSV/TSV).
 *
 * Wie Android `Tabellen.ausDatei`: Am Inhalt erkannt, nicht an der Endung.
 * Eine Excel-Datei kommt als fertige Tabelle zurück (die Import-Fenster
 * brauchen dann keinen CSV-Leser), alles andere als Text für den bisherigen
 * Weg. Text wird wie am Handy erst als UTF-8, sonst als Windows-1252
 * gelesen (R1, 22.11.2026); dann gibt es einen Hinweis für die Vorschau.
 */
import { istZip } from './zipReader';
import { istAltesOfficeFormat, istXlsx, leseXlsx, XlsxFehler, type Tabelle } from './xlsxReader';

export type ImportDatei =
  | { art: 'tabelle'; tabelle: Tabelle }
  /** `hinweis`: gesetzt, wenn die Datei nicht UTF-8 war und als Windows-1252 gelesen wurde */
  | { art: 'text'; text: string; hinweis?: string };

/** Hinweis wie am Handy (`MemberImportScreen`), wenn die Datei als Windows-1252 gelesen wurde. */
export const HINWEIS_WINDOWS_1252 = 'Die Datei war nicht UTF-8 und wurde als Windows-1252 gelesen. Prüfen Sie Umlaute in der Vorschau.';

/**
 * Text wie Android `MemberCsv.decode`: zuerst streng als UTF-8; enthält die
 * Datei Bytes, die in UTF-8 ungültig sind (typisch für ältere Bank- und
 * Excel-Exporte unter Windows), als Windows-1252. Ein Byte-Order-Mark wird
 * entfernt.
 */
export function dekodiereText(bytes: Uint8Array): { text: string; windows1252: boolean } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), windows1252: false };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), windows1252: true };
  }
}

/** Für das `accept` der Dateiauswahl: Excel zusätzlich zu den bisherigen Endungen. */
export const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Liest die Bytes einer gewählten Datei und erkennt Excel oder Text. */
export async function leseImportBytes(bytes: Uint8Array): Promise<ImportDatei> {
  if (istAltesOfficeFormat(bytes)) {
    throw new XlsxFehler(
      'Das ist eine ältere Excel-Datei (.xls) oder eine mit Passwort geschützte Datei. Bitte in Excel als „Excel-Arbeitsmappe (.xlsx)“ ohne Passwort oder als CSV speichern und erneut wählen.'
    );
  }
  if (istZip(bytes)) {
    if (istXlsx(bytes)) return { art: 'tabelle', tabelle: await leseXlsx(bytes) };
    throw new XlsxFehler('Die Datei ist ein ZIP-Archiv, aber keine Excel-Tabelle (.xlsx). Bitte eine .xlsx- oder CSV-Datei wählen.');
  }
  const { text, windows1252 } = dekodiereText(bytes);
  return windows1252 ? { art: 'text', text, hinweis: HINWEIS_WINDOWS_1252 } : { art: 'text', text };
}

/** Wie `leseImportBytes`, direkt aus der gewählten Datei. */
export async function leseImportDatei(datei: Blob): Promise<ImportDatei> {
  return leseImportBytes(new Uint8Array(await datei.arrayBuffer()));
}
