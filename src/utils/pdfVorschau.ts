/**
 * PDF-Vorschau im eingebetteten Fenster (iframe), T-261.
 *
 * Dokumente liegen als Data-URL („data:application/pdf;base64,…“) im
 * Speicher. Chromium – und damit das Desktop-Fenster unter Windows – zeigt
 * solche Adressen im iframe nicht zuverlässig an: Adressen über etwa 2 MB
 * werden abgewiesen, und PDF aus Data-URLs wird je nach Version blockiert.
 * Deshalb wird die Datei in einen Blob umgewandelt und über eine kurzlebige
 * Blob-Adresse („blob:…“) gezeigt. Die Adresse wird beim Schließen wieder
 * freigegeben.
 */
import { useEffect, useState } from 'react';

/** Data-URL in einen Blob umwandeln; null, wenn sie nicht lesbar ist. */
export function dataUrlAlsBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  const typ = m[1] || 'application/octet-stream';
  try {
    if (m[3]) {
      const bin = atob(m[4]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: typ });
    }
    return new Blob([decodeURIComponent(m[4])], { type: typ });
  } catch {
    return null;
  }
}

/**
 * Blob-Adresse für eine Data-URL (oder die Adresse unverändert, wenn sie
 * keine Data-URL ist). Leer, solange nichts da ist.
 */
export function useBlobAdresse(dataUrl: string | null | undefined): string {
  const [adresse, setAdresse] = useState('');
  useEffect(() => {
    if (!dataUrl) {
      setAdresse('');
      return;
    }
    if (!dataUrl.startsWith('data:')) {
      setAdresse(dataUrl);
      return;
    }
    const blob = dataUrlAlsBlob(dataUrl);
    if (!blob) {
      setAdresse(dataUrl);
      return;
    }
    const url = URL.createObjectURL(blob);
    setAdresse(url);
    return () => URL.revokeObjectURL(url);
  }, [dataUrl]);
  return adresse;
}
