import { AppUpdateInfo } from '../types';

export const CURRENT_APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.1.0';

// Ersatzangaben, wenn GitHub zu einer neuen Version keine Beschreibung liefert
const MOCK_LATEST_RELEASE = {
  version: CURRENT_APP_VERSION,
  title: 'Neue Version des VereinsManagers',
  date: new Date().toISOString().split('T')[0],
  // Keine erfundenen Inhalte: was eine neue Version bringt, steht auf GitHub
  notes: ['Die Änderungen stehen auf der GitHub-Seite der Version.'],
  githubUrl: 'https://github.com/alpenglowsea/vereinsmanager/releases',
  downloadUrls: {
    windows: 'https://github.com/alpenglowsea/vereinsmanager/releases/latest',
    mac: 'https://github.com/alpenglowsea/vereinsmanager/releases/latest',
    linux: 'https://github.com/alpenglowsea/vereinsmanager/releases/latest'
  }
};

// Bis R2 merkte sich die App eine „installierte Version“ selbst (auch nach
// einem nur vorgetäuschten Update). Der Schlüssel wird nicht mehr gelesen und
// beim Start entfernt.
const ALTER_SCHLUESSEL_VERSION = 'vereinsmanager_installed_version';
const STORAGE_KEY_GITHUB_REPO = 'vm_github_repo';

export class UpdateService {
  static getGitHubRepo(): string {
    try {
      return localStorage.getItem(STORAGE_KEY_GITHUB_REPO)?.trim() || 'alpenglowsea/vereinsmanager';
    } catch {
      return 'alpenglowsea/vereinsmanager';
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
    } catch (err) {
      console.warn('GitHub-Repository konnte nicht gespeichert werden:', err);
    }
  }

  /**
   * Die Version, die wirklich läuft: in der Desktop-App die des Programms
   * (Tauri), sonst die beim Bauen eingetragene. Keine selbst gespeicherte
   * Angabe mehr (R2): Die konnte nach einem nur vorgetäuschten Update eine
   * Version anzeigen, die gar nicht installiert war.
   */
  static async getCurrentVersion(): Promise<string> {
    try {
      localStorage.removeItem(ALTER_SCHLUESSEL_VERSION);
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
   * Prüft, ob die App in einer nativen Tauri-Desktop-Umgebung läuft
   */
  static isRunningInTauri(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
  }

  /**
   * Universelle Update-Prüfung für alle 3 Modi
   */
  static async checkForUpdates(): Promise<AppUpdateInfo> {
    const currentVer = await this.getCurrentVersion();
    const repo = this.getGitHubRepo();

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

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
      } catch {
        // Abruf fehlgeschlagen (offline oder Limit erreicht): naechste Quelle probieren.
      }

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
        } catch {
          // Abruf fehlgeschlagen (offline oder Limit erreicht): naechste Quelle probieren.
        }
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
        } catch {
          // Abruf fehlgeschlagen (offline oder Limit erreicht): naechste Quelle probieren.
        }
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
        } catch {
          // Abruf fehlgeschlagen (offline oder Limit erreicht): letzte Quelle.
        }
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
            if (name.endsWith('.exe')) {
              windowsUrl = asset.browser_download_url;
            } else if (name.endsWith('.dmg')) {
              macUrl = asset.browser_download_url;
            } else if (name.endsWith('.appimage')) {
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
          isUpdateAvailable: isNewer,
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
          isUpdateAvailable: isNewer,
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

    // Keine Auskunft von GitHub (offline o. Ä.): kein Update anzeigen
    return {
      currentVersion: currentVer,
      latestVersion: currentVer,
      isUpdateAvailable: false,
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
}
