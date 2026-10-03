/**
 * Zugriffsschutz für die /api-Endpunkte.
 * ---------------------------------------------------------------------------
 *
 * Bis Fassung 1.2 verlangte kein einziger /api-Aufruf eine Anmeldung. Wer die
 * Adresse eines im Internet erreichbaren Servers kannte, konnte damit
 *
 *   - über das Postfach des Vereins Mails verschicken,
 *   - das KI-Kontingent des Vereins auf dessen Rechnung leerlaufen lassen.
 *
 * Die Ratenbegrenzung begrenzt den Schaden, verhindert ihn aber nicht.
 *
 * Deshalb verlangt der Server jetzt einen Ausweis: den Zugriffsschlüssel
 * dieser Installation, als Kopfzeile "X-VM-Zugriff". Er entsteht beim ersten
 * Start von selbst (siehe instanceConfig.ts). Das Startskript hängt ihn an
 * die Adresse an, die es im Browser öffnet — dort merkt die App ihn sich.
 * Der Anwender bekommt davon nichts mit.
 *
 * Das ist bewusst kein Benutzer-Ausweis, sondern ein Installations-Ausweis:
 * Es gibt in dieser Fassung nur einen Betrieb (lokal, im eigenen Browser),
 * und dort liegen die Benutzer der App in der Datenbank des Browsers, nicht
 * auf dem Server. Er kann dort nichts nachschlagen — es gibt also nichts,
 * wogegen er ein Anmeldetoken prüfen könnte. Die Rechteverwaltung
 * (src/utils/permissions.ts) ist entsprechend eine Bedienhilfe, keine
 * Sicherheitsgrenze: Verbindlich entscheidet hier allein der Zugriffsschlüssel,
 * ob eine Anfrage den Server überhaupt erreicht.
 *
 * Was dieser Schutz NICHT leistet: Er unterscheidet nicht, WER innerhalb der
 * App eine Anfrage ausgelöst hat oder WELCHE Bereiche diese Person sehen
 * darf — alle Benutzer einer Installation benutzen denselben Schlüssel.
 */

import crypto from 'node:crypto';

/** Kopfzeile, in der die App den Zugriffsschlüssel mitschickt. */
export const ZUGRIFF_HEADER = 'x-vm-zugriff';

export interface ZugriffsErgebnis {
  erlaubt: boolean;
  /** Verständlicher Grund für die Ablehnung, geht an die Oberfläche. */
  grund?: string;
  /**
   * Maschinenlesbarer Grund. Die Oberfläche fragt nur bei
   * ZUGRIFF_VERWEIGERT nach dem Zugriffsschlüssel — bei den übrigen Fällen
   * wäre diese Nachfrage sinnlos, weil ein Schlüssel das Problem nicht löst.
   */
  code?: string;
}

/**
 * Vergleicht zwei Schlüssel, ohne über die Dauer des Vergleichs zu verraten,
 * wie viele Zeichen am Anfang schon stimmen.
 *
 * Ein gewöhnlicher Vergleich (a === b) bricht beim ersten Unterschied ab. Wer
 * die Antwortzeit misst, kann daraus Zeichen für Zeichen den richtigen
 * Schlüssel erraten. timingSafeEqual vergleicht immer vollständig.
 *
 * Die Länge verrät dieses Verfahren weiterhin; das ist unvermeidlich und
 * unkritisch, weil die Länge ohnehin feststeht.
 */
export function schluesselStimmt(mitgeschickt: unknown, erwartet: string): boolean {
  if (typeof mitgeschickt !== 'string' || !erwartet) return false;
  const a = Buffer.from(mitgeschickt, 'utf8');
  const b = Buffer.from(erwartet, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Prüft einen einzelnen Aufruf. Bewusst ohne Express-Bezug, damit sich die
 * Entscheidung testen lässt, ohne einen Server zu starten.
 */
export async function pruefeZugriff(
  kopfzeilen: { zugriffsschluessel?: unknown },
  erwarteterSchluessel: string
): Promise<ZugriffsErgebnis> {
  if (schluesselStimmt(kopfzeilen.zugriffsschluessel, erwarteterSchluessel)) {
    return { erlaubt: true };
  }

  return {
    erlaubt: false,
    grund:
      'Dieser Server nimmt nur Anfragen aus der eigenen Anwendung entgegen. ' +
      'Es fehlt der Zugriffsschlüssel dieser Installation. ' +
      'Er steht in der Startausgabe des Servers und wird in der App unter ' +
      'Einstellungen → Allgemein eingetragen.',
    code: 'ZUGRIFF_VERWEIGERT'
  };
}
