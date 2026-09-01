import { BookingAiSuggestion, TaxSphere } from '../types';
import { findSkr42MainForSub, getSkr42MainCategories, SKR42_STRUCTURE } from '../data/taxSpheres';

const STORAGE_KEY_GEMINI_KEY = 'vm_gemini_api_key';

export interface CategorizeRequest {
  description: string;
  bookingText?: string;
  partner?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
}

export class AiBookingService {
  /**
   * Retrieves the locally saved Gemini API Key
   */
  static getStoredApiKey(): string {
    try {
      return localStorage.getItem(STORAGE_KEY_GEMINI_KEY)?.trim() || '';
    } catch {
      return '';
    }
  }

  /**
   * Saves the Gemini API Key locally in the user's browser / storage
   */
  static setStoredApiKey(apiKey: string): void {
    try {
      if (apiKey && apiKey.trim()) {
        localStorage.setItem(STORAGE_KEY_GEMINI_KEY, apiKey.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
      }
    } catch (e) {
      console.warn('Could not persist Gemini API key to localStorage:', e);
    }
  }

  /**
   * Tests whether an API key or the backend connection is working
   */
  static async testConnection(customApiKey?: string): Promise<{ success: boolean; message: string }> {
    const keyToTest = (customApiKey || this.getStoredApiKey()).trim();

    // 1. Try server endpoint
    try {
      const res = await fetch('/api/test-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: data.message || 'Verbindung zu Google Gemini erfolgreich hergestellt.' };
        }
      }
    } catch {
      // Server might not be running or in static offline mode
    }

    // 2. Direct client fallback test if in standalone / offline environment
    if (keyToTest) {
      try {
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keyToTest)}`;
        const res = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Antworte mit OK.' }] }],
          }),
        });

        if (res.ok) {
          return { success: true, message: 'Verbindung zu Google Gemini erfolgreich hergestellt (Direktmodus).' };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${res.status}: Autorisierung fehlgeschlagen.`;
          return { success: false, message: `Fehler: ${errMsg}` };
        }
      } catch (err: any) {
        return { success: false, message: err?.message || 'Netzwerkfehler bei der Verbindung zu Google Gemini.' };
      }
    }

    return {
      success: false,
      message: 'Kein API-Schlüssel hinterlegt. Bitte geben Sie Ihren Google Gemini API-Schlüssel ein.',
    };
  }

  /**
   * Categorizes a booking based on short user description or existing booking text
   */
  static async categorizeBooking(
    req: CategorizeRequest,
    customApiKey?: string
  ): Promise<BookingAiSuggestion> {
    const effectiveKey = (customApiKey || this.getStoredApiKey()).trim();
    const effectiveType = req.type === 'transfer' ? 'expense' : req.type;

    // 1. Try Backend API first (/api/categorize-booking)
    try {
      const response = await fetch('/api/categorize-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: req.description,
          bookingText: req.bookingText,
          partner: req.partner,
          amount: req.amount,
          type: effectiveType,
          userApiKey: effectiveKey || undefined,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          return this.normalizeSuggestion(json.data, effectiveType);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        // If server returned a meaningful error message
        if (errorData?.error && !errorData.error.includes('Kein Gemini API-Schlüssel')) {
          throw new Error(errorData.error);
        }
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Kein Gemini')) {
        console.warn('Backend categorization attempt warning:', e.message);
      }
    }

    // 2. Direct client fallback for standalone / offline deployment with user BYOK
    if (effectiveKey) {
      return this.directClientCategorize(req, effectiveKey, effectiveType);
    }

    throw new Error(
      'Kein Google Gemini API-Schlüssel gefunden. Bitte hinterlegen Sie Ihren API-Schlüssel in den Einstellungen (1. Allgemeine Einstellungen > KI-Assistent).'
    );
  }

  /**
   * Direct fallback to Google Gemini REST API (used when running as standalone client without node server)
   */
  private static async directClientCategorize(
    req: CategorizeRequest,
    apiKey: string,
    fallbackType?: 'income' | 'expense'
  ): Promise<BookingAiSuggestion> {
    const query = (req.description || req.bookingText || '').trim();
    const prompt = `Du bist ein Steuer- und Buchhaltungsexperte für deutsches Vereinssteuerrecht (§§ 51 ff. AO) und DATEV SKR 42.

Kategorisiere diesen Geschäftsvorfall:
- Text: "${query}"
- Partner: "${req.partner || 'k.A.'}"
- Betrag: ${req.amount ? `${req.amount} EUR` : 'k.A.'}
- Buchungsart: ${fallbackType || 'automatisch ermitteln'}

SPHÄREN:
- "ideell": Mitgliedsbeiträge (3100), Spenden (3200), Zuschüsse (3300), Verband (5100), Verwaltung (5200) (0% USt)
- "vermoegen": Zinsen (3500), Miete/Pacht (3600), Aufwand Vermietung (5500) (0% USt)
- "zweckbetrieb": Eintrittsgelder (4100), Kurse (4200), Sportartikel Selbstkosten (4300), Trainer/Übungsleiter (6500), Sportgeräte/Bälle/Trikots/Platzmieten/Schiedsrichter (6600), Reisekosten Sport (6700) (7% oder 0% USt)
- "wirtschaftlich": Werbung/Sponsoring (4500), Bewirtung/Kiosk/Feste (4600), Fanartikel (4700), Wareneinkauf Feste (7100), Feste/GEMA (7200) (19% USt)

Gib ausschließlich valides JSON mit diesem Schema aus:
{
  "sphere": "ideell" | "vermoegen" | "zweckbetrieb" | "wirtschaftlich",
  "type": "income" | "expense",
  "mainCategoryCode": "6600",
  "mainCategoryName": "Spiel-, Trainings- & Wettkampfbetrieb",
  "subCategoryCode": "6610",
  "subCategoryName": "Sportgeräte, Bälle, Tore, Netze & Trainingsmaterial",
  "subCategoryLabel": "6610 - Sport- & Trainingsgeräte",
  "vatRate": 0 | 7 | 19,
  "suggestedBookingText": "Prägnanter Buchungstext",
  "confidence": 0.95,
  "reasoning": "Kurze Begründung nach Gemeinnützigkeitsrecht"
}`;

    const models = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Keine Antwort vom Modell erhalten.');

        const parsed = JSON.parse(rawText);
        return this.normalizeSuggestion(parsed, fallbackType);
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Die KI konnte die Buchung nicht kategorisieren.');
  }

  /**
   * Normalizes raw AI output to guarantee exact dropdown matching with SKR42_STRUCTURE
   */
  private static normalizeSuggestion(
    raw: any,
    fallbackType?: 'income' | 'expense'
  ): BookingAiSuggestion {
    const rawSphere: string = (raw.sphere || '').toLowerCase();
    const validSpheres: TaxSphere[] = ['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'];
    const sphere: TaxSphere = validSpheres.includes(rawSphere as TaxSphere)
      ? (rawSphere as TaxSphere)
      : 'ideell';

    const type: 'income' | 'expense' =
      raw.type === 'income' || raw.type === 'expense'
        ? raw.type
        : fallbackType || 'expense';

    const mainCats = getSkr42MainCategories(sphere, type);

    // Try finding matched main and sub
    let matchedMain = mainCats.find(
      m =>
        m.code === raw.mainCategoryCode ||
        m.id === raw.mainCategoryId ||
        m.name.toLowerCase().includes((raw.mainCategoryName || '').toLowerCase())
    );

    let subCode = String(raw.subCategoryCode || '');
    let matchedSub = mainCats
      .flatMap(m => m.subCategories)
      .find(
        s =>
          s.code === subCode ||
          s.label.includes(subCode) ||
          s.name.toLowerCase().includes((raw.subCategoryName || '').toLowerCase())
      );

    if (!matchedSub && matchedMain) {
      matchedSub = matchedMain.subCategories[0];
    } else if (matchedSub && !matchedMain) {
      matchedMain = findSkr42MainForSub(matchedSub.label);
    }

    if (!matchedMain && mainCats.length > 0) {
      matchedMain = mainCats[0];
    }
    if (!matchedSub && matchedMain) {
      matchedSub = matchedMain.subCategories[0];
    }

    const defaultVat =
      sphere === 'wirtschaftlich' ? 19 : sphere === 'zweckbetrieb' ? 7 : 0;
    const vatRate = [0, 7, 19].includes(raw.vatRate)
      ? (raw.vatRate as 0 | 7 | 19)
      : matchedSub?.vatRateDefault ?? defaultVat;

    return {
      sphere,
      type,
      mainCategoryId: matchedMain?.id || `HK-${raw.mainCategoryCode || '3100'}`,
      mainCategoryCode: matchedMain?.code || raw.mainCategoryCode || '3100',
      mainCategoryName: matchedMain?.name || raw.mainCategoryName || 'Kategorie',
      subCategoryCode: matchedSub?.code || raw.subCategoryCode || '',
      subCategoryName: matchedSub?.name || raw.subCategoryName || '',
      subCategoryLabel: matchedSub?.label || raw.subCategoryLabel || `${raw.subCategoryCode} - ${raw.subCategoryName}`,
      vatRate,
      suggestedBookingText: raw.suggestedBookingText || '',
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.9,
      reasoning:
        raw.reasoning ||
        `Automatisch zugeordnet zu ${sphere.toUpperCase()} (${matchedSub?.label || 'Konto'}).`,
    };
  }
}
