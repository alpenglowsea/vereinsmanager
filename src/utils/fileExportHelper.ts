/**
 * File Export & Save Helper with Location Picker support
 * Uses the File System Access API (showSaveFilePicker) when available (Chromium, Edge, Opera, installed PWAs / Electron),
 * allowing users to freely choose their save directory and file name.
 * Gracefully falls back to classic browser download when showSaveFilePicker is not supported or restricted.
 */

import { createZip, ZipEntry } from './zipWriter';

export interface FileSaveResult {
  success: boolean;
  cancelled?: boolean;
  method: 'picker' | 'download';
  fileName: string;
  error?: string;
}

export async function saveBlobWithLocationPicker(
  blob: Blob,
  suggestedName: string,
  options: {
    description: string;
    mimeType: string;
    extension: string;
  }
): Promise<FileSaveResult> {
  const cleanExt = options.extension.startsWith('.') ? options.extension : `.${options.extension}`;

  // 1. Try File System Access API (allows picking destination directory)
  if (typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: options.description,
            accept: {
              [options.mimeType]: [cleanExt]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        success: true,
        cancelled: false,
        method: 'picker',
        fileName: handle.name || suggestedName
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User deliberately cancelled the save dialog
        return {
          success: false,
          cancelled: true,
          method: 'picker',
          fileName: suggestedName
        };
      }
      // Permission issues or security error inside an iframe sandbox: fallback to standard download
      console.warn('showSaveFilePicker error, falling back to download:', err);
    }
  }

  // 2. Standard browser download fallback
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    return {
      success: true,
      cancelled: false,
      method: 'download',
      fileName: suggestedName
    };
  } catch (err: any) {
    return {
      success: false,
      cancelled: false,
      method: 'download',
      fileName: suggestedName,
      error: err?.message || 'Fehler beim Herunterladen der Datei'
    };
  }
}

// ---------------------------------------------------------------------------
// Bequeme Einstiegspunkte – ALLE Speichern-/Herunterladen-Knöpfe der App
// laufen über diese Funktionen, damit überall dasselbe passiert: Wo der
// Browser/das Fenster es kann, erscheint der Dialog „Speichern unter“ (frei
// wählbarer Ordner und Dateiname); sonst wird wie bisher normal heruntergeladen.
// ---------------------------------------------------------------------------

const DATEITYPEN: Record<string, { description: string; mimeType: string }> = {
  pdf: { description: 'PDF-Dokument (*.pdf)', mimeType: 'application/pdf' },
  csv: { description: 'CSV-Tabelle (*.csv)', mimeType: 'text/csv' },
  xml: { description: 'XML-Datei (*.xml)', mimeType: 'application/xml' },
  ics: { description: 'Kalenderdatei (*.ics)', mimeType: 'text/calendar' },
  png: { description: 'PNG-Bild (*.png)', mimeType: 'image/png' },
  jpg: { description: 'JPEG-Bild (*.jpg)', mimeType: 'image/jpeg' },
  jpeg: { description: 'JPEG-Bild (*.jpeg)', mimeType: 'image/jpeg' },
  webp: { description: 'WebP-Bild (*.webp)', mimeType: 'image/webp' },
  zip: { description: 'ZIP-Archiv (*.zip)', mimeType: 'application/zip' },
  xlsx: { description: 'Excel-Tabelle (*.xlsx)', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  json: { description: 'JSON-Datei (*.json)', mimeType: 'application/json' },
  txt: { description: 'Textdatei (*.txt)', mimeType: 'text/plain' },
  docx: { description: 'Word-Dokument (*.docx)', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { description: 'Word-Dokument (*.doc)', mimeType: 'application/msword' }
};

/** Dateiendung in Kleinbuchstaben ohne Punkt; leer, wenn keine erkennbar. */
export function dateiEndung(fileName: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(fileName || '');
  return m ? m[1].toLowerCase() : '';
}

/**
 * Speichert eine Datei mit „Speichern unter“-Dialog. Art und Endung werden
 * aus dem Dateinamen abgeleitet. Schlägt das Speichern fehl (nicht: wird
 * abgebrochen), erscheint eine Meldung. Liefert das Ergebnis zurück.
 */
export async function saveBlobAs(blob: Blob, fileName: string): Promise<FileSaveResult> {
  const ext = dateiEndung(fileName);
  const typ = DATEITYPEN[ext];
  const result = await saveBlobWithLocationPicker(blob, fileName, {
    description: typ?.description || (ext ? `Datei (*.${ext})` : 'Datei'),
    mimeType: typ?.mimeType || blob.type || 'application/octet-stream',
    extension: ext ? `.${ext}` : '.bin'
  });
  if (!result.success && !result.cancelled) {
    console.error('Speichern fehlgeschlagen:', result.error);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`Die Datei „${fileName}“ konnte nicht gespeichert werden: ${result.error || 'unbekannter Fehler'}`);
    }
  }
  return result;
}

/** Text (CSV, XML, ICS …) speichern. Bei CSV wird die Markierung für Excel (BOM) vorangestellt. */
export function saveTextAs(content: string, fileName: string, mimeType = 'text/plain'): Promise<FileSaveResult> {
  const mitBom = dateiEndung(fileName) === 'csv' && !content.startsWith('﻿') ? '﻿' : '';
  return saveBlobAs(new Blob([mitBom + content], { type: `${mimeType};charset=utf-8` }), fileName);
}

/** Ein mit jsPDF erzeugtes Dokument speichern (ersetzt doc.save). */
export function savePdfAs(doc: { output: (type: 'blob') => Blob }, fileName: string): Promise<FileSaveResult> {
  return saveBlobAs(doc.output('blob'), fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/** Eine Datei speichern, die als Data-URL (data:…;base64,…) vorliegt. */
export async function saveDataUrlAs(dataUrl: string, fileName: string): Promise<FileSaveResult> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return saveBlobAs(blob, fileName);
  } catch (err: any) {
    const result: FileSaveResult = {
      success: false,
      method: 'download',
      fileName,
      error: err?.message || 'Die Datei konnte nicht gelesen werden'
    };
    if (typeof window !== 'undefined') window.alert(`Die Datei „${fileName}“ konnte nicht gespeichert werden: ${result.error}`);
    return result;
  }
}

/**
 * Mehrere Dateien (als Data-URL) in EINER ZIP-Datei speichern – ein einziger
 * „Speichern unter“-Dialog statt vieler. Doppelte Namen werden nummeriert.
 */
export async function saveDataUrlsAsZip(
  dateien: { dataUrl: string; name: string }[],
  zipName: string
): Promise<FileSaveResult> {
  try {
    const benutzt = new Set<string>();
    const eintraege: ZipEntry[] = [];
    for (const d of dateien) {
      const bytes = new Uint8Array(await (await (await fetch(d.dataUrl)).blob()).arrayBuffer());
      const punkt = d.name.lastIndexOf('.');
      const stamm = punkt > 0 ? d.name.slice(0, punkt) : d.name;
      const endung = punkt > 0 ? d.name.slice(punkt) : '';
      let name = d.name;
      let n = 2;
      while (benutzt.has(name.toLowerCase())) name = `${stamm}_${n++}${endung}`;
      benutzt.add(name.toLowerCase());
      eintraege.push({ name: name.replace(/[\\/:*?"<>|]/g, '_'), data: bytes });
    }
    return await saveBlobAs(new Blob([createZip(eintraege) as BlobPart], { type: 'application/zip' }), zipName);
  } catch (err: any) {
    if (typeof window !== 'undefined') window.alert(`Die ZIP-Datei konnte nicht erstellt werden: ${err?.message || 'unbekannter Fehler'}`);
    return { success: false, method: 'download', fileName: zipName, error: err?.message || 'ZIP-Fehler' };
  }
}
