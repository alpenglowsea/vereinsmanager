/**
 * Gemeinsamer Zugang der Oberfläche zu den /api-Endpunkten.
 * ---------------------------------------------------------------------------
 *
 * Seit Fassung 1.3 nimmt der Server keine Anfrage mehr ohne Ausweis an. Diese
 * Datei ist die einzige Stelle, die diesen Ausweis anhängt — jeder Aufruf an
 * den Server läuft über apiFetch().
 *
 * Der Ausweis ist der Zugriffsschlüssel dieser Installation. Im Lokalbetrieb
 * hängt ihn das Startskript an die Adresse an, die es im Browser öffnet
 * (…#zugriff=…). Die App liest ihn beim Start einmal aus und merkt ihn sich
 * im Browser. Der Anwender bemerkt davon nichts.
 *
 * Warum im Browser gespeichert (localStorage) und nicht im Speicher der
 * laufenden Seite? Weil sonst jedes Neuladen den Schlüssel verlöre und die
 * Adresse ihn erneut mitbringen müsste. Er steht damit auf demselben Gerät,
 * auf dem ohnehin die Vereinsdaten liegen; er eröffnet keinen Zugang, den der
 * Besitzer dieses Browsers nicht ohnehin hätte.
 *
 * Frühere Fassungen kannten hier zwei weitere, davon unabhängige Ausweise:
 * das Anmeldetoken des Cloud-Betriebs (Supabase) und das Sitzungstoken des
 * eigenen Server-Betriebs (Betriebsart 3). Mit beiden Betriebsarten sind auch
 * diese Ausweise entfallen — es gibt nur noch den einen, oben beschriebenen.
 */

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

    // Nur den eigenen Wert entfernen, nicht die ganze Raute — sie könnte noch
    // andere Angaben tragen.
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

/**
 * Ruft einen /api-Endpunkt auf und hängt den Ausweis an. Ansonsten verhält es
 * sich wie das gewöhnliche fetch(): Der Aufrufer bekommt die Antwort, wie sie
 * ist, und wertet sie selbst aus.
 */
export async function apiFetch(pfad: string, init: RequestInit = {}): Promise<Response> {
  const kopfzeilen = new Headers(init.headers);

  const schluessel = sicherLesen();
  if (schluessel) kopfzeilen.set(ZUGRIFF_HEADER, schluessel);

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
