/**
 * Gemeinsamer Zugang der Oberfläche zu den /api-Endpunkten.
 * ---------------------------------------------------------------------------
 *
 * Seit Fassung 1.3 nimmt der Server keine Anfrage mehr ohne Ausweis an. Diese
 * Datei ist die einzige Stelle, die diesen Ausweis anhängt — jeder Aufruf an
 * den Server läuft über apiFetch().
 *
 * Es gibt zwei Ausweise, einer genügt:
 *
 *   1. Der Zugriffsschlüssel dieser Installation. Im Lokalbetrieb hängt ihn
 *      das Startskript an die Adresse an, die es im Browser öffnet
 *      (…#zugriff=…). Die App liest ihn beim Start einmal aus und merkt ihn
 *      sich im Browser. Der Anwender bemerkt davon nichts.
 *
 *   2. Das Anmeldetoken aus dem Cloud-Betrieb. Ist jemand über Supabase
 *      angemeldet, genügt das — der Server fragt bei Supabase nach.
 *
 * Warum im Browser gespeichert (localStorage) und nicht im Speicher der
 * laufenden Seite? Weil sonst jedes Neuladen den Schlüssel verlöre und die
 * Adresse ihn erneut mitbringen müsste. Er steht damit auf demselben Gerät,
 * auf dem ohnehin die Vereinsdaten liegen; er eröffnet keinen Zugang, den der
 * Besitzer dieses Browsers nicht ohnehin hätte.
 */

import { getSupabaseClient } from './supabaseClient';

const SPEICHER_SCHLUESSEL = 'vm_zugriffsschluessel';

/** Kopfzeile, in der der Zugriffsschlüssel mitgeschickt wird. */
const ZUGRIFF_HEADER = 'X-VM-Zugriff';

/** Antwortschlüssel des Servers, wenn der Ausweis fehlt oder nicht stimmt. */
export const CODE_ZUGRIFF_VERWEIGERT = 'ZUGRIFF_VERWEIGERT';

function sicherLesen(): string {
  try {
    return localStorage.getItem(SPEICHER_SCHLUESSEL) || '';
  } catch {
    // Privater Modus oder gesperrte Website-Daten: Dann gibt es eben keinen
    // gespeicherten Schlüssel. Kein Grund, die App anzuhalten.
    return '';
  }
}

export function getZugriffsschluessel(): string {
  return sicherLesen();
}

export function hatZugriffsschluessel(): boolean {
  return sicherLesen().length > 0;
}

export function setZugriffsschluessel(wert: string): void {
  try {
    const sauber = wert.trim();
    if (sauber) localStorage.setItem(SPEICHER_SCHLUESSEL, sauber);
    else localStorage.removeItem(SPEICHER_SCHLUESSEL);
  } catch {
    // siehe sicherLesen()
  }
}

/**
 * Liest einen Zugriffsschlüssel aus der Adresszeile (…#zugriff=…), merkt ihn
 * sich und entfernt ihn wieder aus der Adresse.
 *
 * Der Schlüssel steht bewusst hinter dem Rautezeichen und nicht als
 * gewöhnlicher Parameter: Alles hinter der Raute schickt der Browser nicht an
 * den Server und trägt es auch nicht in Serverprotokolle ein.
 *
 * Wird einmal beim Start aufgerufen (src/main.tsx).
 */
export function uebernehmeSchluesselAusAdresse(): void {
  try {
    const roh = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!roh) return;

    const teile = new URLSearchParams(roh);
    const schluessel = teile.get('zugriff');
    if (!schluessel) return;

    setZugriffsschluessel(schluessel);

    // Nur den eigenen Wert entfernen. Supabase legt beim Anmelden ebenfalls
    // Angaben hinter der Raute ab; die dürfen nicht verlorengehen.
    teile.delete('zugriff');
    const rest = teile.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`
    );
  } catch {
    // Eine Adresse, die sich nicht auswerten lässt, ist kein Grund, den Start
    // der Anwendung zu verhindern.
  }
}

/** Anmeldetoken des Cloud-Betriebs, falls jemand angemeldet ist. */
async function cloudToken(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Ruft einen /api-Endpunkt auf und hängt den Ausweis an. Ansonsten verhält es
 * sich wie das gewöhnliche fetch(): Der Aufrufer bekommt die Antwort, wie sie
 * ist, und wertet sie selbst aus.
 */
export async function apiFetch(pfad: string, init: RequestInit = {}): Promise<Response> {
  const kopfzeilen = new Headers(init.headers);

  const schluessel = sicherLesen();
  if (schluessel) kopfzeilen.set(ZUGRIFF_HEADER, schluessel);

  // Beide Ausweise mitschicken, wenn beide vorhanden sind. Wäre nur der
  // Schlüssel dabei und dieser veraltet — etwa nach einem Neuaufbau des
  // Containers —, scheiterte der Aufruf, obwohl die Person angemeldet ist.
  // Die Sitzung liegt bereits im Browser; die Abfrage löst keinen
  // Netzwerkaufruf aus, solange das Token gültig ist.
  const token = await cloudToken();
  if (token) kopfzeilen.set('Authorization', `Bearer ${token}`);

  return fetch(pfad, { ...init, headers: kopfzeilen });
}

/**
 * Erkennt am Antwortkörper, ob der Ausweis das Problem war. Damit kann eine
 * Maske gezielt auf die Eingabe des Zugriffsschlüssels hinweisen, statt nur
 * einen Fehler anzuzeigen.
 */
export function istZugriffsFehler(daten: unknown): boolean {
  return Boolean(
    daten && typeof daten === 'object' && (daten as { code?: string }).code === CODE_ZUGRIFF_VERWEIGERT
  );
}
