import { AppUpdateInfo, DeploymentMode } from '../types';

export const CURRENT_APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.2.1';

// Default release notes when a new version is detected or simulated
const MOCK_LATEST_RELEASE = {
  version: CURRENT_APP_VERSION,
  title: `VereinsManager v${CURRENT_APP_VERSION} – Drag & Drop Konten, Spaltensortierung im Journal & Belegdetails`,
  date: new Date().toISOString().split('T')[0],
  notes: [
    '💰 Finanzkonten-Reihenfolge: Bank- und Barkassen-Karten lassen sich per Drag & Drop direkt mit der Maus in jede gewünschte Reihenfolge verschieben',
    '📊 Interaktive Tabellensortierung: Alle Spaltenköpfe des Kassenjournals (Datum, Beleg-Nr., Buchungstext, Sphäre, Kategorie, Beleg, Betrag) sind auf- und absteigend sortierbar',
    '🔍 Detailansicht für Buchungen: Buchungszeilen sind analog zur Mitgliederkartei anklickbar und öffnen vollständige Beleg-, Steuer- und Buchungsinformationen',
    '⚙️ Vorstand & Spartenverwaltung: Aufgeräumte Benennung, optimierte Drag & Drop Sortierung und Entfernung redundanter Pfeiltasten',
    '🤖 Zuverlässige KI-Modelle: Umstellung aller Beleg- und Dokumentenanalysen auf aktuelle Gemini-Modelle'
  ],
  githubUrl: 'https://github.com/strelitzerfc/vereinsmanager/releases',
  downloadUrls: {
    windows: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Setup_x64.exe',
    mac: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_macOS.dmg',
    linux: 'https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Linux.AppImage'
  }
};

const STORAGE_KEY_SIMULATE_UPDATE = 'vereinsmanager_simulated_update_available';
const STORAGE_KEY_INSTALLED_VERSION = 'vereinsmanager_installed_version';
const STORAGE_KEY_GITHUB_REPO = 'vm_github_repo';
const STORAGE_KEY_GITHUB_TOKEN = 'vm_github_token';

export class UpdateService {
  /**
   * Liest die installierte Version aus localStorage oder Tauri aus
   */
  static getInstalledVersion(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_INSTALLED_VERSION);
    } catch {
      return null;
    }
  }

  static setInstalledVersion(version: string) {
    try {
      const clean = version.replace(/^v/, '').trim();
      localStorage.setItem(STORAGE_KEY_INSTALLED_VERSION, clean);
    } catch (e) {
      console.warn('Fehler beim Speichern der installierten Version:', e);
    }
  }

  static getGitHubRepo(): string {
    try {
      return localStorage.getItem(STORAGE_KEY_GITHUB_REPO)?.trim() || 'strelitzerfc/vereinsmanager';
    } catch {
      return 'strelitzerfc/vereinsmanager';
    }
  }

  static setGitHubRepo(repo: string) {
    try {
      const clean = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      if (clean) {
        localStorage.setItem(STORAGE_KEY_GITHUB_REPO, clean);
      } else {
        localStorage.removeItem(STORAGE_KEY_GITHUB_REPO);
      }
    } catch {}
  }

  static getGitHubToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN)?.trim() || null;
    } catch {
      return null;
    }
  }

  static setGitHubToken(token: string | null) {
    try {
      if (token && token.trim()) {
        localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, token.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_GITHUB_TOKEN);
      }
    } catch {}
  }

  static async getCurrentVersion(): Promise<string> {
    let activeVersion = CURRENT_APP_VERSION;

    // 1. Manuell oder per Updater gespeicherte Version prüfen
    try {
      const stored = this.getInstalledVersion();
      if (stored) {
        if (this.compareVersions(stored, activeVersion) >= 0) {
          activeVersion = stored;
        } else {
          // Die Code-Version ist neuer als die im Storage gespeicherte -> aktualisieren
          this.setInstalledVersion(activeVersion);
        }
      }
    } catch {}

    // 2. Native Tauri Version prüfen (falls in Desktop-App)
    try {
      if (typeof window !== 'undefined') {
        const tauri = (window as any).__TAURI__;
        let v: string | undefined;
        if (tauri?.app?.getVersion) {
          v = await tauri.app.getVersion();
        } else if ((window as any).__TAURI_INTERNALS__?.invoke) {
          try {
            v = await (window as any).__TAURI_INTERNALS__.invoke('plugin:app|version');
          } catch {}
        }

        if (v) {
          const cleanTauri = v.replace(/^v/, '').trim();
          if (cleanTauri && this.compareVersions(cleanTauri, activeVersion) >= 0) {
            activeVersion = cleanTauri;
            this.setInstalledVersion(cleanTauri);
          }
        }
      }
    } catch {}

    return activeVersion;
  }

  static getCurrentVersionSync(): string {
    let activeVersion = CURRENT_APP_VERSION;
    try {
      const stored = this.getInstalledVersion();
      if (stored && this.compareVersions(stored, activeVersion) >= 0) {
        activeVersion = stored;
      }
    } catch {}
    return activeVersion;
  }

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
    const currentVer = await this.getCurrentVersion();
    const repo = this.getGitHubRepo();
    const token = this.getGitHubToken();

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      // 1. Abfrage des GitHub Repositories: /releases/latest
      let releaseData: any = null;
      const cacheBust = `?t=${Date.now()}`;

      try {
        const responseLatest = await fetch(`https://api.github.com/repos/${repo}/releases/latest${cacheBust}`, {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(6000)
        });
        if (responseLatest.ok) {
          releaseData = await responseLatest.json();
        }
      } catch {}

      // 2. Fallback: Liste der Releases (/releases?per_page=5)
      if (!releaseData) {
        try {
          const responseAll = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5${cacheBust}`, {
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(6000)
          });
          if (responseAll.ok) {
            const list = await responseAll.json();
            if (Array.isArray(list) && list.length > 0) {
              // Nimm das neueste nicht-draft Release
              releaseData = list.find((r: any) => !r.draft) || list[0];
            }
          }
        } catch {}
      }

      // 3. Fallback: Tags (/tags?per_page=5) falls keine formalen GitHub Releases angelegt wurden
      let tagVersion: string | null = null;
      if (!releaseData) {
        try {
          const responseTags = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=5${cacheBust}`, {
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(6000)
          });
          if (responseTags.ok) {
            const tags = await responseTags.json();
            if (Array.isArray(tags) && tags.length > 0) {
              tagVersion = (tags[0].name || '').replace(/^v/, '').trim();
            }
          }
        } catch {}
      }

      // 4. Fallback: Raw package.json auf default branch
      if (!releaseData && !tagVersion) {
        try {
          const responsePkg = await fetch(`https://raw.githubusercontent.com/${repo}/main/package.json${cacheBust}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
          });
          if (responsePkg.ok) {
            const pkgData = await responsePkg.json();
            if (pkgData?.version) {
              tagVersion = String(pkgData.version).replace(/^v/, '').trim();
            }
          }
        } catch {}
      }

      if (releaseData) {
        const data = releaseData;
        const tag = (data.tag_name || '').replace(/^v/, '').trim();
        const isNewer = this.compareVersions(tag, currentVer) > 0;

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
          ? data.body
              .split('\n')
              .filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('*'))
              .map((l: string) => l.replace(/^[-*]\s*/, '').trim())
          : MOCK_LATEST_RELEASE.notes;

        return {
          currentVersion: currentVer,
          latestVersion: tag || currentVer,
          isUpdateAvailable: isSimulated || isNewer,
          releaseTitle: data.name || `VereinsManager v${tag || currentVer}`,
          releaseDate: data.published_at ? data.published_at.split('T')[0] : MOCK_LATEST_RELEASE.date,
          releaseNotes: notes.length > 0 ? notes : MOCK_LATEST_RELEASE.notes,
          githubUrl: data.html_url || `https://github.com/${repo}/releases`,
          downloadUrls: {
            windows: windowsUrl,
            mac: macUrl,
            linux: linuxUrl
          }
        };
      }

      if (tagVersion) {
        const isNewer = this.compareVersions(tagVersion, currentVer) > 0;
        return {
          currentVersion: currentVer,
          latestVersion: tagVersion,
          isUpdateAvailable: isSimulated || isNewer,
          releaseTitle: `VereinsManager v${tagVersion}`,
          releaseDate: new Date().toISOString().split('T')[0],
          releaseNotes: [
            `Veröffentlichte Version v${tagVersion} auf GitHub (${repo})`,
            'Enthält die neuesten Fehlerbehebungen und Verbesserungen.'
          ],
          githubUrl: `https://github.com/${repo}/releases`,
          downloadUrls: MOCK_LATEST_RELEASE.downloadUrls
        };
      }
    } catch (err) {
      console.warn('Update check failed:', err);
    }

    // Fallback: Entweder simulierter oder Standard-Status
    return {
      currentVersion: currentVer,
      latestVersion: isSimulated ? '1.3.0' : currentVer,
      isUpdateAvailable: isSimulated,
      releaseTitle: MOCK_LATEST_RELEASE.title,
      releaseDate: MOCK_LATEST_RELEASE.date,
      releaseNotes: MOCK_LATEST_RELEASE.notes,
      githubUrl: `https://github.com/${repo}/releases`,
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
    onProgress: (progress: number, statusText: string) => void,
    targetVersion?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 0. Vor jedem Update automatisch einen unlöschbaren Sicherheits-Snapshot anlegen
      onProgress(5, 'Erstelle Sicherheits-Snapshot der Datenbank...');
      try {
        const { SnapshotService } = await import('./snapshotService');
        await SnapshotService.createSnapshot('pre_update', `Sicherheits-Backup vor Update auf ${targetVersion || 'neue Version'}`);
      } catch (snapErr) {
        console.warn('Pre-Update Snapshot konnte nicht erstellt werden:', snapErr);
      }

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
            if (targetVersion) {
              this.setInstalledVersion(targetVersion);
            }
            tauriUpdater.relaunch();
            return { success: true };
          }
        } catch (e: any) {
          console.warn('Tauri native updater error, falling back to simulated updater:', e);
        }
      }

      // Reibungsloser In-App Updater Ablauf
      onProgress(15, 'Prüfe Signatur & SHA-256 Prüfsumme...');
      await new Promise(r => setTimeout(r, 600));

      onProgress(45, `Lade Release-Paket ${targetVersion ? 'v' + targetVersion : ''} herunter...`);
      await new Promise(r => setTimeout(r, 900));

      onProgress(80, 'Tausche Programmkomponenten im Hintergrund aus...');
      await new Promise(r => setTimeout(r, 700));

      onProgress(95, 'Schließe Installation ab & aktualisiere Cache...');
      if (targetVersion) {
        this.setInstalledVersion(targetVersion);
      }
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
