/**
 * Zugriff der Oberfläche auf die SMTP-Zugangsdaten.
 * ---------------------------------------------------------------------------
 *
 * Die Zugangsdaten zum Postfach liegen seit Fassung 1.3 nicht mehr in den
 * Vereinsstammdaten, sondern auf dem Server dieser Installation. Dieser Dienst
 * ist die einzige Stelle, über die die Oberfläche sie erreicht.
 *
 * Wichtig für das Verständnis: Das Passwort geht nur in eine Richtung. Es wird
 * beim Speichern hochgeschickt und nie wieder heruntergeladen — die Auskunft
 * vom Server enthält lediglich `hasPassword`. Deshalb darf die Eingabemaske
 * das Passwortfeld auch nicht mit dem gespeicherten Wert vorbelegen; sie zeigt
 * "hinterlegt" an und bietet an, es zu ersetzen.
 */

import { apiFetch } from './apiClient';

/** Was der Server über die hinterlegten Zugangsdaten preisgibt. */
export interface SmtpConfigPublic {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  /** true, wenn ein Passwort hinterlegt und entschlüsselbar ist. */
  hasPassword: boolean;
  /** true, sobald ein Hostname hinterlegt ist. */
  configured: boolean;
}

/**
 * Eingabe beim Speichern.
 *
 * `password` weggelassen  → das hinterlegte Passwort bleibt unverändert
 * `password: ''`          → das hinterlegte Passwort wird entfernt
 */
export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  password?: string;
}

export const LEERE_SMTP_KONFIGURATION: SmtpConfigPublic = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  fromEmail: '',
  fromName: '',
  hasPassword: false,
  configured: false,
};

async function antwortLesen(antwort: Response): Promise<any> {
  // Der Server antwortet auf /api immer mit JSON — auch im Fehlerfall. Geht
  // doch einmal etwas schief (Reverse-Proxy meldet sich mit einer HTML-Seite),
  // soll die Oberfläche eine verständliche Meldung zeigen und nicht am
  // JSON-Parser scheitern.
  try {
    return await antwort.json();
  } catch {
    return {
      success: false,
      error: `Der Server hat unerwartet geantwortet (Status ${antwort.status}).`,
    };
  }
}

export const SmtpConfigService = {
  /**
   * Holt die hinterlegten Angaben. Gibt null zurück, wenn der Server nicht
   * erreichbar ist — das ist in der Desktop-Fassung (ohne Backend) der
   * Normalfall und kein Grund für eine Fehlermeldung.
   */
  async load(): Promise<SmtpConfigPublic | null> {
    try {
      const antwort = await apiFetch('/api/smtp/config');
      if (!antwort.ok) return null;
      const daten = await antwortLesen(antwort);
      return daten?.success ? (daten.config as SmtpConfigPublic) : null;
    } catch {
      return null;
    }
  },

  async save(
    eingabe: SmtpConfigInput
  ): Promise<{ success: boolean; config?: SmtpConfigPublic; error?: string }> {
    try {
      const antwort = await apiFetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eingabe),
      });
      const daten = await antwortLesen(antwort);
      if (antwort.ok && daten?.success) {
        return { success: true, config: daten.config as SmtpConfigPublic };
      }
      return { success: false, error: daten?.error || 'Speichern fehlgeschlagen.' };
    } catch (fehler: any) {
      return {
        success: false,
        error:
          fehler?.message ||
          'Der Server ist nicht erreichbar. Die Zugangsdaten konnten nicht gespeichert werden.',
      };
    }
  },

  async remove(): Promise<{ success: boolean; error?: string }> {
    try {
      const antwort = await apiFetch('/api/smtp/config', { method: 'DELETE' });
      const daten = await antwortLesen(antwort);
      if (antwort.ok && daten?.success) return { success: true };
      return { success: false, error: daten?.error || 'Löschen fehlgeschlagen.' };
    } catch (fehler: any) {
      return { success: false, error: fehler?.message || 'Der Server ist nicht erreichbar.' };
    }
  },

  /**
   * Prüft die auf dem Server hinterlegten Zugangsdaten. Es werden bewusst
   * keine Zugangsdaten mitgeschickt: Getestet wird genau das, was später auch
   * beim Versand verwendet wird. Vor dem Testen muss also gespeichert werden.
   */
  async test(testEmpfaenger?: string): Promise<{ success: boolean; message: string }> {
    try {
      const antwort = await apiFetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testRecipient: testEmpfaenger?.trim() || undefined }),
      });
      const daten = await antwortLesen(antwort);
      if (antwort.ok && daten?.success) {
        return { success: true, message: daten.message || 'Verbindung erfolgreich aufgebaut.' };
      }
      return {
        success: false,
        message:
          daten?.error || 'Verbindung fehlgeschlagen. Bitte Zugangsdaten und Port überprüfen.',
      };
    } catch (fehler: any) {
      return {
        success: false,
        message: fehler?.message || 'Netzwerkfehler beim Verbindungstest zum Server.',
      };
    }
  },
};
