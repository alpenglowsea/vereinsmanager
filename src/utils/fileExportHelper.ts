/**
 * File Export & Save Helper with Location Picker support
 * Uses the File System Access API (showSaveFilePicker) when available (Chromium, Edge, Opera, installed PWAs / Electron),
 * allowing users to freely choose their save directory and file name.
 * Gracefully falls back to classic browser download when showSaveFilePicker is not supported or restricted.
 */

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
