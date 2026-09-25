/**
 * Zugriff der Oberfläche auf die KI-Einstellungen.
 * ---------------------------------------------------------------------------
 *
 * Der Schlüssel zum KI-Anbieter liegt seit Fassung 0.9 nicht mehr im Browser
 * und nicht mehr in den Vereinsstammdaten, sondern verschlüsselt auf dem Server
 * dieser Installation. Dieser Dienst ist die einzige Stelle, über die die
 * Oberfläche ihn erreicht — und sie erreicht ihn nur schreibend.
 *
 * Wichtig für das Verständnis: Der Schlüssel geht nur in eine Richtung. Er wird
 * beim Speichern hochgeschickt und nie wieder heruntergeladen — die Auskunft
 * vom Server enthält lediglich `hasApiKey`. Die Eingabemaske darf das Feld
 * deshalb nicht mit dem gespeicherten Wert vorbelegen; sie zeigt "hinterlegt"
 * an und bietet an, ihn zu ersetzen.
 *
 * Warum überhaupt weg aus dem Browser? Weil er von dort in die
 * Vereinseinstellungen gespiegelt wurde und damit in jeder Datensicherung und
 * im Cloud-Betrieb zusätzlich in Supabase stand. Ein Verein, der seine
 * Sicherung weitergibt oder verliert, gab damit seinen Schlüssel mit — und auf
 * dessen Rechnung lässt sich Rechenzeit verbrauchen.
 */

import { apiFetch } from './apiClient';

export type AiProvider = 'mistral' | 'gemini';

/** Was der Server über die hinterlegten KI-Zugangsdaten preisgibt. */
export interface AiConfigPublic {
  provider: AiProvider;
  model: string;
  /** true, wenn ein Schlüssel hinterlegt und entschlüsselbar ist. */
  hasApiKey: boolean;
  /**
   * Woher ein vorhandener Schlüssel stammt. 'umgebung' heißt: aus
   * MISTRAL_API_KEY oder GEMINI_API_KEY auf dem Server — dann lässt er sich
   * über die Oberfläche weder ändern noch entfernen, und die Maske sagt das.
   */
  schluesselQuelle: 'konfiguration' | 'umgebung' | 'keine';
  /** true, sobald die KI-Funktionen tatsächlich arbeiten könnten. */
  configured: boolean;
}

/**
 * Eingabe beim Speichern.
 *
 * `apiKey` weggelassen  → der hinterlegte Schlüssel bleibt unverändert
 * `apiKey: ''`          → der hinterlegte Schlüssel wird entfernt
 */
export interface AiConfigInput {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
}

export const LEERE_KI_KONFIGURATION: AiConfigPublic = {
  provider: 'mistral',
  model: '',
  hasApiKey: false,
  schluesselQuelle: 'keine',
  configured: false,
};

async function antwortLesen(antwort: Response): Promise<any> {
  // Siehe smtpConfigService: Antwortet ein Reverse-Proxy mit einer HTML-Seite,
  // soll eine verständliche Meldung erscheinen und nicht der JSON-Parser
  // scheitern.
  try {
    return await antwort.json();
  } catch {
    return {
      success: false,
      error: `Der Server hat unerwartet geantwortet (Status ${antwort.status}).`,
    };
  }
}

export const AiConfigService = {
  /**
   * Holt die hinterlegten Angaben. Gibt null zurück, wenn der Server nicht
   * erreichbar ist — die Maske zeigt dann, dass KI-Funktionen einen Server
   * brauchen, statt eine leere Einrichtung vorzutäuschen.
   */
  async load(): Promise<AiConfigPublic | null> {
    try {
      const antwort = await apiFetch('/api/ai/config');
      if (!antwort.ok) return null;
      const daten = await antwortLesen(antwort);
      return daten?.success ? (daten.config as AiConfigPublic) : null;
    } catch {
      return null;
    }
  },

  async save(
    eingabe: AiConfigInput
  ): Promise<{ success: boolean; config?: AiConfigPublic; error?: string }> {
    try {
      const antwort = await apiFetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eingabe),
      });
      const daten = await antwortLesen(antwort);
      if (antwort.ok && daten?.success) {
        return { success: true, config: daten.config as AiConfigPublic };
      }
      return { success: false, error: daten?.error || 'Speichern fehlgeschlagen.' };
    } catch (fehler: any) {
      return {
        success: false,
        error:
          fehler?.message ||
          'Der Server ist nicht erreichbar. Die KI-Einstellungen konnten nicht gespeichert werden.',
      };
    }
  },

  async remove(): Promise<{ success: boolean; config?: AiConfigPublic; error?: string }> {
    try {
      const antwort = await apiFetch('/api/ai/config', { method: 'DELETE' });
      const daten = await antwortLesen(antwort);
      if (antwort.ok && daten?.success) {
        return { success: true, config: daten.config as AiConfigPublic };
      }
      return { success: false, error: daten?.error || 'Löschen fehlgeschlagen.' };
    } catch (fehler: any) {
      return { success: false, error: fehler?.message || 'Der Server ist nicht erreichbar.' };
    }
  },
};

// ---------------------------------------------------------------------------
// Einmalige Übernahme aus dem Browser-Speicher
// ---------------------------------------------------------------------------

/**
 * Die Namen, unter denen frühere Fassungen den Schlüssel im Browser ablegten.
 * Sie werden hier nur noch gelesen, um sie ein letztes Mal zu leeren.
 */
const ALTE_BROWSER_FELDER = {
  provider: 'vm_ai_provider',
  apiKey: 'vm_ai_api_key',
  geminiKey: 'vm_gemini_api_key',
  model: 'vm_ai_model',
  baseUrl: 'vm_ai_base_url',
} as const;

/**
 * Anbieter aus einer früheren Fassung, die es nicht mehr gibt. Ein von dort
 * übernommener Schlüssel wird als Gemini-Schlüssel eingetragen, wenn er von
 * Google stammte — sonst gar nicht, denn ein OpenAI-Schlüssel nützt bei
 * Mistral nichts und eine falsche Zuordnung führt nur zu einer
 * Fehlermeldung, die niemand versteht.
 */
function anbieterNochGueltig(roh: string): AiProvider | null {
  if (roh === 'mistral' || roh === 'gemini') return roh;
  return null;
}

function sicherLesen(name: string): string {
  try {
    return localStorage.getItem(name)?.trim() || '';
  } catch {
    return '';
  }
}

function sicherLoeschen(name: string): void {
  try {
    localStorage.removeItem(name);
  } catch {
    // Privater Modus oder gesperrte Website-Daten: Dann gibt es dort ohnehin
    // nichts, was jemand auslesen könnte.
  }
}

/**
 * Verschiebt einen noch im Browser liegenden KI-Schlüssel einmalig auf den
 * Server und löscht ihn lokal.
 *
 * Warum automatisch und nicht per Nachfrage? Der Schlüssel liegt ohnehin schon
 * in diesem Browser. Ihn wegzuräumen ist für den Verein strikt eine
 * Verbesserung — es gibt nichts zu entscheiden. Eine Rückfrage hieße nur:
 * "Darf es sicherer werden?"
 *
 * Gelöscht wird lokal ausdrücklich NUR dann, wenn der Server das Speichern
 * bestätigt hat. Andernfalls stünde der Verein ohne Schlüssel da und müsste
 * ihn beim Anbieter neu erzeugen.
 *
 * Läuft still im Hintergrund. Schlägt etwas fehl, passiert nichts weiter —
 * beim nächsten Start wird es erneut versucht.
 */
export async function uebernehmeSchluesselAusBrowser(): Promise<
  'nichts-zu-tun' | 'uebernommen' | 'fehlgeschlagen'
> {
  const schluessel =
    sicherLesen(ALTE_BROWSER_FELDER.apiKey) || sicherLesen(ALTE_BROWSER_FELDER.geminiKey);

  // Bewusst OHNE eine Merk-Markierung "schon erledigt". Eine solche Markierung
  // hatte ich zuerst eingebaut — sie war ein Fehler: Wird ein Schlüssel später
  // aus den Vereinsstammdaten hierher gerettet (siehe storage.ts), käme die
  // Übernahme nie wieder dazu, ihn anzufassen. Der Lauf kostet ohne Schlüssel
  // nur einen Blick in den Browser-Speicher.
  if (!schluessel) {
    // Anbieter, Modell und Adresse sollen nicht als Karteileichen liegen
    // bleiben — sie stehen jetzt auf dem Server.
    sicherLoeschen(ALTE_BROWSER_FELDER.provider);
    sicherLoeschen(ALTE_BROWSER_FELDER.model);
    sicherLoeschen(ALTE_BROWSER_FELDER.baseUrl);
    return 'nichts-zu-tun';
  }

  const vorhanden = await AiConfigService.load();
  if (!vorhanden) return 'fehlgeschlagen'; // Server nicht erreichbar — später erneut

  // Steht auf dem Server schon ein Schlüssel, gilt dieser. Der im Browser ist
  // dann eine Altlast und wird nur noch entfernt.
  if (!vorhanden.hasApiKey) {
    const rohAnbieter = sicherLesen(ALTE_BROWSER_FELDER.provider);
    const provider = anbieterNochGueltig(rohAnbieter);

    // Stammt der alte Schlüssel von einem Anbieter, den es nicht mehr gibt,
    // wird er nicht übernommen — nur aufgeräumt. Ein OpenAI-Schlüssel wäre
    // hier wertlos und stiftete beim nächsten Versuch nur Verwirrung.
    if (provider) {
      const ergebnis = await AiConfigService.save({
        provider,
        model: sicherLesen(ALTE_BROWSER_FELDER.model),
        apiKey: schluessel,
      });
      if (!ergebnis.success) return 'fehlgeschlagen';
    }
  }

  for (const name of Object.values(ALTE_BROWSER_FELDER)) sicherLoeschen(name);
  return 'uebernommen';
}
