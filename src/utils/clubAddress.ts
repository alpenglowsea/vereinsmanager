import { Address } from '../types';

/**
 * Die Vereinsadresse kann als Zeichenkette oder als strukturiertes
 * Objekt vorliegen (siehe ClubSettings.address: Address | string).
 *
 * Wird das Objekt versehentlich direkt in eine Zeichenkette eingesetzt,
 * steht im erzeugten Dokument wörtlich "[object Object]". Da davon unter
 * anderem Zuwendungsbestätigungen, Rechnungen und das SEPA-Protokoll
 * betroffen sind, läuft jede Ausgabe der Adresse über diese Funktion.
 *
 * Ergebnis: "Musterstraße 12, 12345 Musterstadt"
 */
export function formatClubAddress(address: Address | string | undefined | null): string {
  if (!address) return '';

  if (typeof address === 'string') return address.trim();

  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = [address.zip, address.city].filter(Boolean).join(' ').trim();

  return [streetLine, cityLine].filter(Boolean).join(', ');
}

/**
 * Nur der Ort – für Formulierungen wie "Musterstadt, den 01.01.2026".
 * Liegt die Adresse als Zeichenkette vor, wird der Teil nach dem letzten
 * Komma als Ort angenommen.
 */
export function extractCity(address: Address | string | undefined | null): string {
  if (!address) return '';

  if (typeof address === 'string') {
    const parts = address.split(',');
    const last = parts[parts.length - 1]?.trim() || '';
    // "12345 Musterstadt" -> "Musterstadt"
    return last.replace(/^\d{4,5}\s+/, '') || address.trim();
  }

  return address.city?.trim() || '';
}
