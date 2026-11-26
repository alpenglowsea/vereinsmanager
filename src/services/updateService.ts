import { ABFRAGE_ADRESSE, installationsEndungen, werteAntwortAus, type Pruefergebnis } from '../utils/versionspruefung';

export const CURRENT_APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '2.1.0';

// Bis R2 merkte sich die App eine „installierte Version“ selbst (auch nach
// einem nur vorgetäuschten Update). Der Schlüssel wird nicht mehr gelesen und
// beim Start entfernt. Ebenso der frühere, nie in der Oberfläche einstellbare
// Repository-Schlüssel (seit 25.11. steht das Repository fest in `versionspruefung.ts`).
const ALTER_SCHLUESSEL_VERSION = 'vereinsmanager_installed_version';
const ALTER_SCHLUESSEL_REPO = 'vm_github_repo';

export class UpdateService {
  /**
   * Die Version, die wirklich läuft: in der Desktop-App die des Programms
   * (Tauri), sonst die beim Bauen eingetragene. Keine selbst gespeicherte
   * Angabe mehr (R2): Die konnte nach einem nur vorgetäuschten Update eine
   * Version anzeigen, die gar nicht installiert war.
   */
  static async getCurrentVersion(): Promise<string> {
    try {
      localStorage.removeItem(ALTER_SCHLUESSEL_VERSION);
      localStorage.removeItem(ALTER_SCHLUESSEL_REPO);
    } catch {
      // ohne localStorage nichts aufzuräumen
    }
    try {
      if (typeof window !== 'undefined') {
        const tauri = (window as any).__TAURI__;
        let v: string | undefined;
        if (tauri?.app?.getVersion) {
          v = await tauri.app.getVersion();
        } else if ((window as any).__TAURI_INTERNALS__?.invoke) {
          try {
            v = await (window as any).__TAURI_INTERNALS__.invoke('plugin:app|version');
          } catch {
            // Version nicht ermittelbar: die beim Bauen eingetragene nehmen.
          }
        }
        const sauber = v?.replace(/^v/, '').trim();
        if (sauber) return sauber;
      }
    } catch {
      // Version nicht ermittelbar: die beim Bauen eingetragene nehmen.
    }
    return CURRENT_APP_VERSION;
  }

  static getCurrentVersionSync(): string {
    return CURRENT_APP_VERSION;
  }

  /**
   * Fragt GitHub nach der neuesten veröffentlichten Version. Nur aufrufen, wenn der Anwender
   * „Jetzt prüfen“ angeklickt hat: Das ist die einzige Verbindung der App zu GitHub.
   * Gesendet wird nur die Anfrage selbst, keine Vereinsdaten und keine Kennung der Installation.
   */
  static async pruefeAufNeueVersion(): Promise<{ installiert: string; ergebnis: Pruefergebnis }> {
    const installiert = await this.getCurrentVersion();
    let status = -1;
    let text: string | null = null;
    try {
      const antwort = await fetch(ABFRAGE_ADRESSE, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      status = antwort.status;
      text = await antwort.text();
    } catch {
      // keine Verbindung (offline, Zeitüberschreitung): status bleibt -1
    }
    return { installiert, ergebnis: werteAntwortAus(status, text, installiert, installationsEndungen(navigator.userAgent)) };
  }
}
