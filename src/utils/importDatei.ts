/**
 * Eine Datei für die Importe einlesen: Excel (.xlsx) oder Text (CSV/TSV).
 *
 * Wie Android `Tabellen.ausDatei`: Am Inhalt erkannt, nicht an der Endung.
 * Eine Excel-Datei kommt als fertige Tabelle zurück (die Import-Fenster
 * brauchen dann keinen CSV-Leser), alles andere als Text für den bisherigen
 * Weg. So bleibt das Verhalten bei CSV-Dateien genau wie vorher.
 */
import { istZip } from './zipReader';
import { istAltesOfficeFormat, istXlsx, leseXlsx, XlsxFehler, type Tabelle } from './xlsxReader';

export type ImportDatei = { art: 'tabelle'; tabelle: Tabelle } | { art: 'text'; text: string };

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
  // Wie bisher `file.text()`: UTF-8, ungültige Zeichen werden ersetzt
  return { art: 'text', text: new TextDecoder('utf-8').decode(bytes) };
}

/** Wie `leseImportBytes`, direkt aus der gewählten Datei. */
export async function leseImportDatei(datei: Blob): Promise<ImportDatei> {
  return leseImportBytes(new Uint8Array(await datei.arrayBuffer()));
}
