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
 * Es gibt zwei anerkannte Ausweise. Einer genügt:
 *
 * 1. Der Zugriffsschlüssel dieser Installation, als Kopfzeile "X-VM-Zugriff".
 *    Er entsteht beim ersten Start von selbst (siehe instanceConfig.ts). Im
 *    Lokalbetrieb hängt ihn das Startskript an die Adresse an, die es im
 *    Browser öffnet — dort merkt die App ihn sich. Der Anwender bekommt davon
 *    nichts mit.
 *
 * 2. Das Anmeldetoken von Supabase, als "Authorization: Bearer ...". Das gibt
 *    es nur im Cloud-Betrieb, dafür gehört es zu einer bestimmten Person und
 *    lässt sich einzeln entziehen. Der Server prüft es bei Supabase nach; er
 *    glaubt dem Token nicht einfach.
 *
 * Warum überhaupt zwei? Weil es im Lokalbetrieb keine Anmeldung gibt, die der
 * Server prüfen könnte: Die Benutzer der App liegen in der Datenbank des
 * Browsers, nicht auf dem Server. Er kann dort nichts nachschlagen.
 *
 * Was dieser Schutz NICHT leistet: Er unterscheidet im Lokalbetrieb nicht
 * zwischen den Vorstandsmitgliedern eines Vereins — alle benutzen denselben
 * Schlüssel. Er hält Fremde draußen, nicht die eigenen Leute auseinander.
 */

import crypto from 'node:crypto';

/** Kopfzeile, in der die App den Zugriffsschlüssel mitschickt. */
export const ZUGRIFF_HEADER = 'x-vm-zugriff';

export interface ZugriffsErgebnis {
  erlaubt: boolean;
  /** Womit der Zugriff gewährt wurde — nur für das Protokoll. */
  weg?: 'schluessel' | 'cloud';
  /** Verständlicher Grund für die Ablehnung, geht an die Oberfläche. */
  grund?: string;
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

/** Holt das Token aus "Authorization: Bearer ...". Gibt null zurück, wenn keines da ist. */
export function bearerToken(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;
  const treffer = authorization.match(/^Bearer\s+(.+)$/i);
  const token = treffer?.[1]?.trim();
  return token ? token : null;
}

/**
 * Prüft einen einzelnen Aufruf. Bewusst ohne Express-Bezug, damit sich die
 * Entscheidung testen lässt, ohne einen Server zu starten.
 */
export async function pruefeZugriff(
  kopfzeilen: { zugriffsschluessel?: unknown; authorization?: unknown },
  erwarteterSchluessel: string,
  cloudPruefer: ((token: string) => Promise<boolean>) | null
): Promise<ZugriffsErgebnis> {
  if (schluesselStimmt(kopfzeilen.zugriffsschluessel, erwarteterSchluessel)) {
    return { erlaubt: true, weg: 'schluessel' };
  }

  const token = bearerToken(kopfzeilen.authorization);
  if (token && cloudPruefer) {
    const gueltig = await cloudPruefer(token);
    if (gueltig) return { erlaubt: true, weg: 'cloud' };
    return {
      erlaubt: false,
      grund:
        'Die Anmeldung ist abgelaufen oder ungültig. Bitte in der App neu anmelden und den Vorgang wiederholen.'
    };
  }

  return {
    erlaubt: false,
    grund:
      'Dieser Server nimmt nur Anfragen aus der eigenen Anwendung entgegen. ' +
      'Es fehlt der Zugriffsschlüssel dieser Installation. ' +
      'Er steht in der Startausgabe des Servers und wird in der App unter ' +
      'Einstellungen → Allgemein eingetragen.'
  };
}

// ---------------------------------------------------------------------------
// Prüfung des Supabase-Anmeldetokens
// ---------------------------------------------------------------------------

/**
 * Damit nicht jeder Aufruf eine Rückfrage bei Supabase auslöst, merkt sich der
 * Server ein geprüftes Token für kurze Zeit. Sechzig Sekunden sind der
 * Ausgleich zwischen Geschwindigkeit und der Frage, wie lange ein eben
 * entzogener Zugang noch funktionieren darf.
 */
const CACHE_DAUER_MS = 60_000;
const geprueft = new Map<string, number>();

/** Im Speicher steht nur der Fingerabdruck, nicht das Token selbst. */
function fingerabdruck(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Baut die Prüffunktion für den Cloud-Betrieb. Gibt null zurück, wenn dem
 * Server die Supabase-Daten fehlen — dann bleibt nur der Zugriffsschlüssel.
 *
 * Wichtig: Der Server braucht SUPABASE_URL und SUPABASE_ANON_KEY als eigene
 * Umgebungsvariablen. Die VITE_-Werte gelten nur für den Browser und werden
 * beim Bauen fest eingesetzt; im laufenden Serverprozess gibt es sie nicht.
 */
export function erstelleCloudPruefer(
  url: string | undefined,
  anonKey: string | undefined
): ((token: string) => Promise<boolean>) | null {
  const basis = url?.trim().replace(/\/+$/, '');
  const schluessel = anonKey?.trim();
  if (!basis || !schluessel) return null;

  return async (token: string): Promise<boolean> => {
    const abdruck = fingerabdruck(token);
    const bekanntBis = geprueft.get(abdruck);
    if (bekanntBis && bekanntBis > Date.now()) return true;

    try {
      const antwort = await fetch(`${basis}/auth/v1/user`, {
        headers: {
          apikey: schluessel,
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!antwort.ok) return false;

      geprueft.set(abdruck, Date.now() + CACHE_DAUER_MS);
      // Alte Einträge wegräumen, damit der Speicher nicht unbegrenzt wächst.
      if (geprueft.size > 500) {
        const jetzt = Date.now();
        for (const [eintrag, gueltigBis] of geprueft) {
          if (gueltigBis <= jetzt) geprueft.delete(eintrag);
        }
      }
      return true;
    } catch (fehler) {
      // Supabase nicht erreichbar: Der Aufruf wird abgelehnt. Im Zweifel
      // lieber eine Fehlermeldung als ein ungeprüfter Zugang.
      console.warn('Das Anmeldetoken konnte bei Supabase nicht geprüft werden:', fehler);
      return false;
    }
  };
}

/** Nur für Tests: leert den Zwischenspeicher der geprüften Token. */
export function leereTokenSpeicher(): void {
  geprueft.clear();
}
