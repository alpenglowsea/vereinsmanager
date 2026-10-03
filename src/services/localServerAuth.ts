/**
 * Zugang zum Benutzersystem des eigenen Servers (Betriebsart 3, "gehostet").
 * ---------------------------------------------------------------------------
 *
 * Gegenstück im Server: src/server/localAuth.ts (Anmeldung/Sitzungen) und
 * src/server/db/repositories/localUsers.ts (Konten). Diese Datei kennt keine
 * Zeile SQL — sie ruft nur die dort beschriebenen /api/local-server/*-Routen
 * auf (server.ts) und wertet die Antwort aus.
 *
 * Jeder Aufruf läuft über apiFetch() (services/apiClient.ts), nicht über das
 * gewöhnliche fetch(): Nur apiFetch() hängt den Zugriffsschlüssel der
 * Installation an, den JEDE /api-Route verlangt (auch diese hier) — ohne ihn
 * käme man nicht einmal bis zur eigentlichen Anmeldeprüfung. Das
 * Sitzungstoken selbst hängt apiFetch() ebenfalls automatisch an, sobald es
 * mit setLocalServerSitzung() einmal hinterlegt wurde.
 */

import {
  apiFetch,
  entfernePasswortResetAusAdresse,
  getLocalServerSitzung,
  lesePasswortResetToken,
  setLocalServerSitzung,
} from './apiClient';
import { UserPermissions } from '../types';

/**
 * Ein Konto auf dem eigenen Server, wie es der Server zurückgibt. Bewusst
 * eine eigene, kleine Abschrift von LocalUser (server/db/repositories/
 * localUsers.ts) statt eines Imports von dort: Jene Datei setzt node:sqlite
 * voraus und darf nicht ins Browser-Bündel geraten.
 */
export interface LocalServerUser {
  id: string;
  email: string;
  name: string;
  customRoleName: string;
  permissions: UserPermissions;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerAntwort {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Alle Funktionen unten, die etwas anlegen oder ändern (ersteinrichtung,
 * login, benutzerAnlegen, berechtigungenSetzen, kontoAktivSetzen), geben
 * bewusst EINE Form mit optionalen Feldern zurück
 * (`{ success: boolean; message?: string; user?: LocalServerUser }`) statt
 * einer sauber unterschiedenen Vereinigung
 * (`{ success: true; user } | { success: false; message }`).
 *
 * Die unterschiedene Form ist eigentlich die genauere — aber diese
 * Anwendung prüft ohne `strictNullChecks` (siehe tsconfig.json), und ohne
 * das schlägt `if (!antwort.success) { antwort.message }` beim Zugreifen
 * auf `antwort.message` fehl: „Property 'message' does not exist on type
 * '{ success: true; user: … } | { success: false; message: string }'."
 * TypeScript verengt die Vereinigung dort nicht zuverlässig, wenn
 * `strictNullChecks` aus ist — genau das ist am 27./28.09. passiert. Die
 * eine Form hier vermeidet dieses Problem von vornherein und passt außerdem
 * zum Rest der Anwendung: services/supabaseClient.ts verwendet für seine
 * Erfolg/Fehler-Antworten überall genau dieselbe Form.
 */

async function lesen<T extends object>(antwort: Response): Promise<(ServerAntwort & T) | null> {
  try {
    return await antwort.json();
  } catch {
    return null;
  }
}

/** Ist auf diesem Server noch gar kein Konto eingerichtet? */
export async function statusAbfragen(): Promise<{ setupPending: boolean } | { fehler: string }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/status');
    const daten = await lesen<{ setupPending: boolean }>(antwort);
    if (!antwort.ok || !daten) {
      return { fehler: daten?.error || 'Der Server ist nicht erreichbar.' };
    }
    return { setupPending: daten.setupPending };
  } catch {
    return { fehler: 'Der Server ist nicht erreichbar.' };
  }
}

interface AnmeldeAntwort {
  success: boolean;
  user?: LocalServerUser;
  sessionToken?: string;
  error?: string;
}

/**
 * Richtet das allererste Konto ein und meldet es gleich an. Nur möglich,
 * solange noch kein Konto besteht (siehe statusAbfragen) — danach lehnt der
 * Server das ab.
 */
export async function ersteinrichtung(
  email: string,
  name: string,
  password: string
): Promise<{ success: boolean; message?: string; user?: LocalServerUser }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });
    const daten = await lesen<AnmeldeAntwort>(antwort);
    if (!antwort.ok || !daten?.success || !daten.user || !daten.sessionToken) {
      return { success: false, message: daten?.error || 'Die Ersteinrichtung ist fehlgeschlagen.' };
    }
    setLocalServerSitzung(daten.sessionToken);
    return { success: true, user: daten.user };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; message?: string; user?: LocalServerUser }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const daten = await lesen<AnmeldeAntwort>(antwort);
    if (!antwort.ok || !daten?.success || !daten.user || !daten.sessionToken) {
      return { success: false, message: daten?.error || 'Anmeldung fehlgeschlagen.' };
    }
    setLocalServerSitzung(daten.sessionToken);
    return { success: true, user: daten.user };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

/**
 * Meldet ab. Löscht das hinterlegte Sitzungstoken IMMER, auch wenn der
 * Aufruf an den Server fehlschlägt (etwa weil er gerade nicht erreichbar
 * ist) — sonst bliebe die Oberfläche in einem Zustand hängen, in dem sie
 * sich für angemeldet hält, aber nichts mehr funktioniert.
 */
export async function logout(): Promise<void> {
  const sitzung = getLocalServerSitzung();
  setLocalServerSitzung('');
  if (!sitzung) return;
  try {
    await apiFetch('/api/local-server/auth/logout', { method: 'POST' });
  } catch {
    // Der Schlüssel ist bereits gelöscht — mehr lässt sich hier nicht tun.
  }
}

export function hatLocalServerSitzung(): boolean {
  return getLocalServerSitzung().length > 0;
}

/**
 * Liest das eigene Konto anhand des hinterlegten Sitzungstokens — die
 * Grundlage für AuthService.init() im gehosteten Betrieb: Beim Start der App
 * steht noch kein Passwort zur Verfügung, wohl aber (falls vorhanden) ein
 * gültiges Sitzungstoken aus einem früheren Besuch.
 */
export async function eigenesKontoLesen(): Promise<LocalServerUser | null> {
  if (!hatLocalServerSitzung()) return null;
  try {
    const antwort = await apiFetch('/api/local-server/auth/me');
    if (!antwort.ok) {
      // Sitzung abgelaufen, Konto deaktiviert, o.ä. — das lokal gespeicherte
      // Token taugt dann nichts mehr und sollte nicht erneut versucht werden.
      setLocalServerSitzung('');
      return null;
    }
    const daten = await lesen<{ user: LocalServerUser }>(antwort);
    return daten?.user || null;
  } catch {
    // Netzwerkfehler: Das Token BEHALTEN, nicht löschen — der Server ist
    // vielleicht nur gerade kurz nicht erreichbar, nicht die Sitzung ungültig.
    return null;
  }
}

export async function eigenesPasswortAendern(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const daten = await lesen<{ message?: string }>(antwort);
    if (!antwort.ok || !daten?.success) {
      return { success: false, message: daten?.error || 'Das Passwort konnte nicht geändert werden.' };
    }
    // Eine erfolgreiche Passwortänderung beendet serverseitig die aktuelle
    // Sitzung (siehe setPassword in repositories/localUsers.ts) — das
    // gespeicherte Token gilt also nicht mehr und muss verworfen werden.
    setLocalServerSitzung('');
    return { success: true, message: daten.message };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

/**
 * Liest ein mitgeschicktes "Passwort vergessen"-Token aus der Adresszeile —
 * nur eine Weiterleitung an apiClient.ts, damit die Oberfläche für alles
 * rund um den eigenen Server bei einer einzigen Datei bleiben kann.
 */
export function passwortResetTokenAusAdresse(): string | null {
  return lesePasswortResetToken();
}

/** Siehe apiClient.ts — nach erfolgreichem Zurücksetzen aufzurufen. */
export function entferneResetTokenAusAdresse(): void {
  entfernePasswortResetAusAdresse();
}

/**
 * Fordert einen Link zum Zurücksetzen des Passworts an. Dieser Server kann
 * seit der Entfernung von SMTP keine E-Mails mehr verschicken — die Antwort
 * ist deshalb für jede Adresse dieselbe ehrliche Absage (code
 * "KEIN_EMAIL_VERSAND", siehe server.ts).
 */
export async function passwortVergessenAnfordern(
  email: string
): Promise<{ success: boolean; message?: string; code?: string }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const daten = await lesen<{ message?: string }>(antwort);
    if (!antwort.ok || !daten?.success) {
      return { success: false, message: daten?.error || 'Die Anfrage ist fehlgeschlagen.', code: daten?.code };
    }
    return { success: true, message: daten.message };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

/** Löst einen per E-Mail verschickten Link ein und setzt das neue Passwort. */
export async function passwortMitTokenZuruecksetzen(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const antwort = await apiFetch('/api/local-server/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const daten = await lesen<{ message?: string }>(antwort);
    if (!antwort.ok || !daten?.success) {
      return { success: false, message: daten?.error || 'Das Passwort konnte nicht geändert werden.' };
    }
    return { success: true, message: daten.message };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

export async function benutzerListe(): Promise<LocalServerUser[]> {
  try {
    const antwort = await apiFetch('/api/local-server/users');
    if (!antwort.ok) return [];
    const daten = await lesen<{ users: LocalServerUser[] }>(antwort);
    return daten?.users || [];
  } catch {
    return [];
  }
}

export async function benutzerAnlegen(params: {
  email: string;
  name: string;
  password: string;
  customRoleName?: string;
}): Promise<{ success: boolean; message?: string; user?: LocalServerUser }> {
  try {
    const antwort = await apiFetch('/api/local-server/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const daten = await lesen<{ user: LocalServerUser }>(antwort);
    if (!antwort.ok || !daten?.success || !daten.user) {
      return { success: false, message: daten?.error || 'Das Konto konnte nicht angelegt werden.' };
    }
    return { success: true, user: daten.user };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

export async function berechtigungenSetzen(
  id: string,
  permissions: UserPermissions
): Promise<{ success: boolean; message?: string; user?: LocalServerUser }> {
  try {
    const antwort = await apiFetch(`/api/local-server/users/${encodeURIComponent(id)}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    });
    const daten = await lesen<{ user: LocalServerUser }>(antwort);
    if (!antwort.ok || !daten?.success || !daten.user) {
      return { success: false, message: daten?.error || 'Die Berechtigungen konnten nicht gesetzt werden.' };
    }
    return { success: true, user: daten.user };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}

/**
 * Sperrt (isActive: false) oder gibt (isActive: true) ein Konto frei. Der
 * Server prüft dabei serverseitig, ob das erlaubt ist (kein Konto darf sich
 * selbst sperren, das letzte Konto mit "Benutzer & Rechte" bleibt geschützt)
 * — hier kommt nur die Fehlermeldung an, falls eine der beiden Regeln greift.
 */
export async function kontoAktivSetzen(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; message?: string; user?: LocalServerUser }> {
  try {
    const antwort = await apiFetch(`/api/local-server/users/${encodeURIComponent(id)}/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    const daten = await lesen<{ user: LocalServerUser }>(antwort);
    if (!antwort.ok || !daten?.success || !daten.user) {
      return { success: false, message: daten?.error || 'Das Konto konnte nicht geändert werden.' };
    }
    return { success: true, user: daten.user };
  } catch {
    return { success: false, message: 'Der Server ist nicht erreichbar.' };
  }
}
