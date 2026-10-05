/**
 * Gemeinsamer Zugang der Oberfläche zu den /api-Endpunkten.
 * ---------------------------------------------------------------------------
 *
 * Jeder Aufruf an den Server läuft über apiFetch() statt über das
 * gewöhnliche fetch() — das hält diese Stelle zentral, falls künftig einmal
 * wieder etwas an jeden Aufruf angehängt werden muss.
 *
 * Frühere Fassungen verlangten hier einen Ausweis (zuletzt einen
 * Zugriffsschlüssel dieser Installation, davor zusätzlich ein Anmeldetoken
 * des Cloud-Betriebs und ein Sitzungstoken des eigenen Server-Betriebs). Der
 * Server nimmt nur noch von diesem einen Rechner (127.0.0.1) Anfragen an —
 * ein zusätzlicher Ausweis bot dort keinen echten Zugewinn mehr und ist
 * entfallen.
 */

/**
 * Ruft einen /api-Endpunkt auf. Verhält sich wie das gewöhnliche fetch():
 * Der Aufrufer bekommt die Antwort, wie sie ist, und wertet sie selbst aus.
 */
export async function apiFetch(pfad: string, init: RequestInit = {}): Promise<Response> {
  return fetch(pfad, init);
}
