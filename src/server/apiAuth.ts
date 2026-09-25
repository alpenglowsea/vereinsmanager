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
 *    lässt sich einzeln entziehen.
 *
 * Warum überhaupt zwei? Weil es im Lokalbetrieb keine Anmeldung gibt, die der
 * Server prüfen könnte: Die Benutzer der App liegen in der Datenbank des
 * Browsers, nicht auf dem Server. Er kann dort nichts nachschlagen.
 *
 * ---------------------------------------------------------------------------
 * Warum beim Anmeldetoken ZWEI Rückfragen nötig sind
 * ---------------------------------------------------------------------------
 *
 * Ein gültiges Supabase-Token beweist nur: Diese Person hat ein Konto in
 * diesem Supabase-Projekt. Es beweist NICHT, dass sie zum Verein gehört.
 *
 * Der Unterschied ist keine Spitzfindigkeit. Supabase erlaubt in der
 * Grundeinstellung, dass sich jeder selbst ein Konto anlegt — genau deshalb
 * gibt es den Einrichtungscode und die Einladungen, die über den Eintrag in
 * "club_users" entscheiden. Die Oberfläche zieht diese Grenze längst: Wer
 * angemeldet, aber nicht eingetragen ist, bekommt "Noch nicht freigeschaltet"
 * und null Rechte.
 *
 * Der Server zog sie bis hierher nicht. Ein Fremder mit selbst angelegtem
 * Konto kam damit an dieser Prüfung vorbei und konnte Postfach und
 * KI-Kontingent des Vereins benutzen. Dasselbe galt für ein Mitglied, das der
 * Vorstand gerade deaktiviert hatte: in der App ausgesperrt, sein Token aber
 * noch gültig.
 *
 * Deshalb fragt der Server jetzt zweimal:
 *
 *   1. GET  /auth/v1/user             — ist das Token echt und nicht abgelaufen?
 *   2. POST /rest/v1/rpc/vm_is_member — gehört diese Person zum Verein?
 *
 * "vm_is_member()" steht in supabase_rls.sql und liefert genau das Gewünschte:
 * eingetragen UND aktiv. Sie wird mit dem Token des Anrufers aufgerufen, nicht
 * mit einem Generalschlüssel — der Server bekommt also keine Vollmacht, die er
 * missbrauchen könnte, und die Regel bleibt an einer Stelle: in der Datenbank.
 *
 * Warum nicht gleich nur der zweite Aufruf? Weil PostgREST einem unangemeldeten
 * Aufrufer dieselbe Antwort gibt wie einer fehlenden Funktion — es verbirgt,
 * was er nicht benutzen darf. "Token abgelaufen" und "supabase_rls.sql fehlt"
 * wären dann nicht mehr zu unterscheiden, und der Anwender bekäme den falschen
 * Rat.
 *
 * Was dieser Schutz NICHT leistet: Er unterscheidet nicht, WELCHE Bereiche ein
 * Mitglied sehen darf. Ein Mitglied ohne Finanzrechte kann die Belegerkennung
 * weiterhin anstoßen. Das ließe sich mit vm_can_view() nachziehen; hier geht es
 * zuerst darum, Fremde draußen zu halten. Im Lokalbetrieb gibt es diese
 * Unterscheidung ohnehin nicht — dort benutzen alle denselben Schlüssel.
 */

import crypto from 'node:crypto';

/** Kopfzeile, in der die App den Zugriffsschlüssel mitschickt. */
export const ZUGRIFF_HEADER = 'x-vm-zugriff';

/**
 * Was die Rückfrage bei Supabase ergeben hat.
 *
 * Bewusst mehr als ja/nein: Die Fälle brauchen verschiedene Antworten an den
 * Anwender. "Deine Anmeldung ist abgelaufen" führt zu einer anderen Handlung
 * als "Dein Konto ist für diesen Verein nicht freigeschaltet", und beides ist
 * etwas anderes als "Der Server konnte gerade nicht nachfragen".
 */
export type CloudBefund =
  /** Angemeldet und im Verein eingetragen — durchlassen. */
  | 'mitglied'
  /** Token abgelaufen, gefälscht oder aus einem fremden Projekt. */
  | 'token-ungueltig'
  /** Echte Anmeldung, aber nicht (oder nicht mehr) in club_users. */
  | 'kein-mitglied'
  /** vm_is_member() gibt es nicht — supabase_rls.sql wurde nie eingespielt. */
  | 'regeln-fehlen'
  /** Supabase war nicht erreichbar. Keine Aussage möglich. */
  | 'nicht-pruefbar';

export type CloudPruefer = (token: string) => Promise<CloudBefund>;

export interface ZugriffsErgebnis {
  erlaubt: boolean;
  /** Womit der Zugriff gewährt wurde — nur für das Protokoll. */
  weg?: 'schluessel' | 'cloud';
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

/** Holt das Token aus "Authorization: Bearer ...". Gibt null zurück, wenn keines da ist. */
export function bearerToken(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;
  const treffer = authorization.match(/^Bearer\s+(.+)$/i);
  const token = treffer?.[1]?.trim();
  return token ? token : null;
}

/** Text und Code zu jeder Ablehnung. An einer Stelle, damit sie zusammenbleiben. */
const ABLEHNUNG: Record<Exclude<CloudBefund, 'mitglied'>, { grund: string; code: string }> = {
  'token-ungueltig': {
    grund:
      'Die Anmeldung ist abgelaufen oder ungültig. Bitte in der App neu anmelden ' +
      'und den Vorgang wiederholen.',
    code: 'ANMELDUNG_ABGELAUFEN'
  },
  'kein-mitglied': {
    grund:
      'Dieses Benutzerkonto ist für diesen Verein nicht freigeschaltet. Ein ' +
      'Vorstandsmitglied kann es unter Einstellungen → Benutzer freischalten. ' +
      'Wurde der Zugang gerade entzogen, ist das die erwartete Antwort.',
    code: 'NICHT_FREIGESCHALTET'
  },
  'regeln-fehlen': {
    grund:
      'Der Server kann nicht prüfen, wer zum Verein gehört: In der Datenbank ' +
      'fehlt die Funktion vm_is_member(). Bitte supabase_rls.sql im ' +
      'SQL-Editor von Supabase erneut einspielen.',
    code: 'SCHUTZREGELN_FEHLEN'
  },
  'nicht-pruefbar': {
    grund:
      'Die Anmeldung konnte gerade nicht geprüft werden — Supabase war nicht ' +
      'erreichbar. Bitte in einem Moment noch einmal versuchen.',
    code: 'PRUEFUNG_FEHLGESCHLAGEN'
  }
};

/**
 * Prüft einen einzelnen Aufruf. Bewusst ohne Express-Bezug, damit sich die
 * Entscheidung testen lässt, ohne einen Server zu starten.
 */
export async function pruefeZugriff(
  kopfzeilen: { zugriffsschluessel?: unknown; authorization?: unknown },
  erwarteterSchluessel: string,
  cloudPruefer: CloudPruefer | null
): Promise<ZugriffsErgebnis> {
  if (schluesselStimmt(kopfzeilen.zugriffsschluessel, erwarteterSchluessel)) {
    return { erlaubt: true, weg: 'schluessel' };
  }

  const token = bearerToken(kopfzeilen.authorization);
  if (token && cloudPruefer) {
    const befund = await cloudPruefer(token);
    if (befund === 'mitglied') return { erlaubt: true, weg: 'cloud' };
    return { erlaubt: false, ...ABLEHNUNG[befund] };
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

// ---------------------------------------------------------------------------
// Prüfung des Supabase-Anmeldetokens
// ---------------------------------------------------------------------------

/**
 * Damit nicht jeder Aufruf zwei Rückfragen bei Supabase auslöst, merkt sich der
 * Server ein geprüftes Token für kurze Zeit. Sechzig Sekunden sind der
 * Ausgleich zwischen Geschwindigkeit und der Frage, wie lange ein eben
 * entzogener Zugang noch funktionieren darf.
 *
 * Gemerkt wird nur der Erfolg. Eine Ablehnung wird bei jedem Aufruf neu
 * geprüft — sonst bliebe ein gerade freigeschaltetes Mitglied eine Minute
 * lang ausgesperrt, ohne zu verstehen, warum.
 */
const CACHE_DAUER_MS = 60_000;
const geprueft = new Map<string, number>();

/** Im Speicher steht nur der Fingerabdruck, nicht das Token selbst. */
function fingerabdruck(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function merkeErfolg(abdruck: string): void {
  geprueft.set(abdruck, Date.now() + CACHE_DAUER_MS);
  // Alte Einträge wegräumen, damit der Speicher nicht unbegrenzt wächst.
  if (geprueft.size > 500) {
    const jetzt = Date.now();
    for (const [eintrag, gueltigBis] of geprueft) {
      if (gueltigBis <= jetzt) geprueft.delete(eintrag);
    }
  }
}

/**
 * Wertet die Antwort von vm_is_member() aus.
 *
 * PostgREST liefert bei einer Funktion mit einfachem Rückgabewert genau diesen
 * Wert als Körper: "true" oder "false".
 */
async function werteMitgliedsAntwortAus(antwort: Response): Promise<CloudBefund> {
  // 404 heißt bei PostgREST nicht nur "Adresse falsch", sondern auch
  // "diese Funktion kenne ich nicht" (Fehlerschlüssel PGRST202). Das ist der
  // Fall, wenn supabase_rls.sql nie oder nur teilweise eingespielt wurde.
  if (antwort.status === 404) return 'regeln-fehlen';

  if (!antwort.ok) {
    // 401 oder 403 nach einer bestandenen Tokenprüfung ergibt keinen Sinn und
    // deutet auf ein Einrichtungsproblem hin. Nicht durchlassen — aber auch
    // nicht als "kein Mitglied" ausgeben; das wäre eine Behauptung, die durch
    // nichts gedeckt ist.
    return 'nicht-pruefbar';
  }

  const text = (await antwort.text()).trim();
  if (text === 'true') return 'mitglied';
  if (text === 'false') return 'kein-mitglied';

  // Alles andere verstehen wir nicht. Im Zweifel nicht durchlassen.
  console.warn('Unerwartete Antwort von vm_is_member():', text.slice(0, 200));
  return 'nicht-pruefbar';
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
): CloudPruefer | null {
  const basis = url?.trim().replace(/\/+$/, '');
  const schluessel = anonKey?.trim();
  if (!basis || !schluessel) return null;

  return async (token: string): Promise<CloudBefund> => {
    const abdruck = fingerabdruck(token);
    const bekanntBis = geprueft.get(abdruck);
    if (bekanntBis && bekanntBis > Date.now()) return 'mitglied';

    const ausweis = {
      apikey: schluessel,
      Authorization: `Bearer ${token}`
    };

    try {
      // Schritt 1: Ist das Token überhaupt echt?
      const anmeldung = await fetch(`${basis}/auth/v1/user`, {
        headers: ausweis,
        signal: AbortSignal.timeout(8000)
      });
      if (!anmeldung.ok) return 'token-ungueltig';

      // Schritt 2: Gehört diese Person zum Verein?
      const mitgliedschaft = await fetch(`${basis}/rest/v1/rpc/vm_is_member`, {
        method: 'POST',
        headers: { ...ausweis, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(8000)
      });

      const befund = await werteMitgliedsAntwortAus(mitgliedschaft);
      if (befund === 'mitglied') merkeErfolg(abdruck);
      return befund;
    } catch (fehler) {
      // Supabase nicht erreichbar: Der Aufruf wird abgelehnt. Im Zweifel
      // lieber eine Fehlermeldung als ein ungeprüfter Zugang.
      console.warn('Das Anmeldetoken konnte bei Supabase nicht geprüft werden:', fehler);
      return 'nicht-pruefbar';
    }
  };
}

/** Nur für Tests: leert den Zwischenspeicher der geprüften Token. */
export function leereTokenSpeicher(): void {
  geprueft.clear();
}
