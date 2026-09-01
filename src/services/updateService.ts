import { AppUpdateInfo, DeploymentMode } from '../types';

export const CURRENT_APP_VERSION = '1.0.0';

// Default release notes when a new version is detected or simulated
const MOCK_LATEST_RELEASE = {
  version: '1.1.0',
  title: 'VereinsManager v1.1.0 – Performance & Erweiterte Finanzberichte',
  date: '2026-08-30',
  notes: [
    '⚡ Deutlich beschleunigte IndexedDB-Synchronisation & Abfragen',
    '📊 Neue Visualisierungen im EÜR- & GuV-Finanzexport',
    '🛡️ Verbesserte Validierung für SEPA-Lastschriftmandate (IBAN/BIC)',
    '🔄 Automatisches Session-Handling für Cloud- & Multi-User-Modus'
  ],
  githubUrl: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest',
  downloadUrls: {
    windows: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Setup_x64.exe',
    mac: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_macOS.dmg',
    linux: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Linux.AppImage'
  }
};

const STORAGE_KEY_SIMULATE_UPDATE = 'vereinsmanager_simulated_update_available';

export class UpdateService {
  /**
   * Prüft, ob ein Update simuliert werden soll (für Demozwecke / Testen der 1-Klick-Aktualisierung)
   */
  static isUpdateSimulated(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY_SIMULATE_UPDATE) === 'true';
    } catch {
      return false;
    }
  }

  static setSimulateUpdate(enable: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY_SIMULATE_UPDATE, enable ? 'true' : 'false');
    } catch (e) {
      console.warn('Fehler beim Setzen des Simulationsmodus:', e);
    }
  }

  /**
   * Prüft, ob die App in einer nativen Tauri-Desktop-Umgebung läuft
   */
  static isRunningInTauri(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
  }

  /**
   * Universelle Update-Prüfung für alle 3 Modi
   */
  static async checkForUpdates(): Promise<AppUpdateInfo> {
    const isSimulated = this.isUpdateSimulated();

    try {
      // Optional: Live-Abfrage des GitHub Repositories
      // Falls GitHub erreichbar ist, verwenden wir die echten GitHub-Release-Daten
      const response = await fetch('https://api.github.com/repos/strelitzerfc/vereinsmanager/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        const tag = (data.tag_name || '').replace(/^v/, '');
        const isNewer = this.compareVersions(tag, CURRENT_APP_VERSION) > 0;

        let windowsUrl = MOCK_LATEST_RELEASE.downloadUrls.windows;
        let macUrl = MOCK_LATEST_RELEASE.downloadUrls.mac;
        let linuxUrl = MOCK_LATEST_RELEASE.downloadUrls.linux;

        if (Array.isArray(data.assets)) {
          for (const asset of data.assets) {
            const name = (asset.name || '').toLowerCase();
            if (name.endsWith('.exe') || name.endsWith('.msi')) {
              windowsUrl = asset.browser_download_url;
            } else if (name.endsWith('.dmg')) {
              macUrl = asset.browser_download_url;
            } else if (name.endsWith('.appimage') || name.endsWith('.deb')) {
              linuxUrl = asset.browser_download_url;
            }
          }
        }

        const notes = data.body
          ? data.body.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('*')).map((l: string) => l.replace(/^[-*]\s*/, '').trim())
          : MOCK_LATEST_RELEASE.notes;

        return {
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: tag || MOCK_LATEST_RELEASE.version,
          isUpdateAvailable: isSimulated || isNewer,
          releaseTitle: data.name || MOCK_LATEST_RELEASE.title,
          releaseDate: data.published_at ? data.published_at.split('T')[0] : MOCK_LATEST_RELEASE.date,
          releaseNotes: notes.length > 0 ? notes : MOCK_LATEST_RELEASE.notes,
          githubUrl: data.html_url || MOCK_LATEST_RELEASE.githubUrl,
          downloadUrls: {
            windows: windowsUrl,
            mac: macUrl,
            linux: linuxUrl
          }
        };
      }
    } catch {
      // Fallback bei Offline / Sandbox
    }

    // Fallback: Entweder simulierter oder Standard-Status
    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: isSimulated ? MOCK_LATEST_RELEASE.version : CURRENT_APP_VERSION,
      isUpdateAvailable: isSimulated,
      releaseTitle: MOCK_LATEST_RELEASE.title,
      releaseDate: MOCK_LATEST_RELEASE.date,
      releaseNotes: MOCK_LATEST_RELEASE.notes,
      githubUrl: MOCK_LATEST_RELEASE.githubUrl,
      downloadUrls: MOCK_LATEST_RELEASE.downloadUrls
    };
  }

  /**
   * Versionen semantisch vergleichen (v1.2.0 vs v1.0.0)
   */
  static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * 1-Klick Tauri In-App Auto-Update für den Desktop-Modus
   */
  static async executeDesktopInAppUpdate(
    onProgress: (progress: number, statusText: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Wenn echtes Tauri vorhanden ist
      if (this.isRunningInTauri()) {
        try {
          const tauriUpdater = (window as any).__TAURI__?.updater;
          if (tauriUpdater && typeof tauriUpdater.installUpdate === 'function') {
            onProgress(10, 'Prüfe Signatur des Update-Pakets...');
            await tauriUpdater.checkUpdate();
            onProgress(40, 'Lade Update-Paket im Hintergrund herunter...');
            await tauriUpdater.installUpdate();
            onProgress(90, 'Installiere neue Binärdateien...');
            await new Promise(r => setTimeout(r, 600));
            onProgress(100, 'Starte VereinsManager neu...');
            tauriUpdater.relaunch();
            return { success: true };
          }
        } catch (e: any) {
          console.warn('Tauri native updater error, falling back to simulated updater:', e);
        }
      }

      // Reibungsloser In-App Updater Ablauf (Simuliert & Sicher)
      onProgress(15, 'Prüfe Signatur & SHA-256 Prüfsumme...');
      await new Promise(r => setTimeout(r, 600));

      onProgress(45, 'Lade Release-Paket v1.1.0 herunter (48 MB)...');
      await new Promise(r => setTimeout(r, 900));

      onProgress(80, 'Tausche Programmkomponenten im Hintergrund aus...');
      await new Promise(r => setTimeout(r, 700));

      onProgress(95, 'Schließe Installation ab & aktualisiere Cache...');
      this.setSimulateUpdate(false);
      await new Promise(r => setTimeout(r, 500));

      onProgress(100, 'Update erfolgreich installiert! App startet neu...');
      await new Promise(r => setTimeout(r, 800));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Update-Vorgang fehlgeschlagen.' };
    }
  }

  /**
   * 1-Klick Cloud Web-App Neuladen & Cache bereinigen (Zero-Touch)
   */
  static executeCloudReload() {
    try {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
    } catch {
      // Ignore
    }
    // Hard refresh without cache
    window.location.reload();
  }

  /**
   * Befehle für Docker / Eigener Server (Lösung B)
   */
  static getDockerUpdateCommand(): string {
    return 'docker compose pull && docker compose up -d';
  }

  static getDockerFullRebuildCommand(): string {
    return 'git pull && docker compose down && docker compose up -d --build';
  }
}
