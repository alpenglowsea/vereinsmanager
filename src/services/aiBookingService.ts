import { AiConfig, AiProviderType, BookingAiSuggestion, TaxSphere } from '../types';
import { findSkr42MainForSub, getSkr42MainCategories, SKR42_STRUCTURE } from '../data/taxSpheres';

const STORAGE_KEY_GEMINI_KEY = 'vm_gemini_api_key';
const STORAGE_KEY_AI_PROVIDER = 'vm_ai_provider';
const STORAGE_KEY_AI_API_KEY = 'vm_ai_api_key';
const STORAGE_KEY_AI_MODEL = 'vm_ai_model';
const STORAGE_KEY_AI_BASE_URL = 'vm_ai_base_url';

export interface CategorizeRequest {
  description: string;
  bookingText?: string;
  partner?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
}

export class AiBookingService {
  /**
   * Retrieves the comprehensive AI configuration
   */
  static getAiConfig(): AiConfig {
    try {
      const provider = (localStorage.getItem(STORAGE_KEY_AI_PROVIDER) as AiProviderType) || 'gemini';
      const apiKey =
        localStorage.getItem(STORAGE_KEY_AI_API_KEY)?.trim() ||
        localStorage.getItem(STORAGE_KEY_GEMINI_KEY)?.trim() ||
        '';
      const model = localStorage.getItem(STORAGE_KEY_AI_MODEL)?.trim() || '';
      const baseUrl = localStorage.getItem(STORAGE_KEY_AI_BASE_URL)?.trim() || '';
      return { provider, apiKey, model, baseUrl };
    } catch {
      return { provider: 'gemini', apiKey: '' };
    }
  }

  /**
   * Persists the AI configuration locally
   */
  static setAiConfig(config: AiConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY_AI_PROVIDER, config.provider);
      if (config.apiKey?.trim()) {
        localStorage.setItem(STORAGE_KEY_AI_API_KEY, config.apiKey.trim());
        if (config.provider === 'gemini') {
          localStorage.setItem(STORAGE_KEY_GEMINI_KEY, config.apiKey.trim());
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_AI_API_KEY);
        if (config.provider === 'gemini') {
          localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
        }
      }

      if (config.model?.trim()) {
        localStorage.setItem(STORAGE_KEY_AI_MODEL, config.model.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_AI_MODEL);
      }

      if (config.baseUrl?.trim()) {
        localStorage.setItem(STORAGE_KEY_AI_BASE_URL, config.baseUrl.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_AI_BASE_URL);
      }
    } catch (e) {
      console.warn('Could not persist AI config:', e);
    }
  }

  /**
   * Retrieves the locally saved API Key (backward compatible)
   */
  static getStoredApiKey(): string {
    return this.getAiConfig().apiKey;
  }

  /**
   * Saves the API Key locally in the user's browser / storage (backward compatible)
   */
  static setStoredApiKey(apiKey: string): void {
    const current = this.getAiConfig();
    this.setAiConfig({ ...current, apiKey });
  }

  /**
   * Tests whether an API key or the backend connection is working for the given provider
   */
  static async testConnection(
    customApiKey?: string,
    customProvider?: AiProviderType,
    customModel?: string,
    customBaseUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    const current = this.getAiConfig();
    const provider = customProvider || current.provider || 'gemini';
    const keyToTest = (customApiKey !== undefined ? customApiKey : current.apiKey).trim();
    const model = customModel !== undefined ? customModel : current.model;
    const baseUrl = customBaseUrl !== undefined ? customBaseUrl : current.baseUrl;

    // 1. Try server endpoint first
    try {
      const res = await fetch('/api/test-ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: keyToTest,
          provider,
          model,
          baseUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return {
            success: true,
            message: data.message || `Verbindung zu ${provider.toUpperCase()} erfolgreich hergestellt.`,
          };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error) {
          return { success: false, message: `Fehler: ${errData.error}` };
        }
      }
    } catch {
      // Server might not be running or in static offline mode
    }

    // 2. Direct client fallback test if in standalone / offline environment
    if (provider === 'openai') {
      if (!keyToTest) return { success: false, message: 'Bitte geben Sie Ihren OpenAI API-Schlüssel ein.' };
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keyToTest}`,
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Antworte mit OK.' }],
            max_tokens: 10,
          }),
        });
        if (res.ok) {
          return { success: true, message: `Verbindung zu OpenAI (${model || 'gpt-4o-mini'}) erfolgreich.` };
        }
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData?.error?.message || `Fehler HTTP ${res.status}` };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Netzwerkfehler bei Verbindung zu OpenAI.' };
      }
    }

    if (provider === 'anthropic') {
      if (!keyToTest) return { success: false, message: 'Bitte geben Sie Ihren Anthropic API-Schlüssel ein.' };
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keyToTest,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Antworte mit OK.' }],
          }),
        });
        if (res.ok) {
          return { success: true, message: `Verbindung zu Anthropic Claude erfolgreich.` };
        }
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData?.error?.message || `Fehler HTTP ${res.status}` };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Netzwerkfehler bei Verbindung zu Anthropic.' };
      }
    }

    if (provider === 'custom') {
      const base = (baseUrl?.trim() || 'http://localhost:11434/v1').replace(/\/+$/, '');
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (keyToTest) headers['Authorization'] = `Bearer ${keyToTest}`;
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model || 'llama3.2',
            messages: [{ role: 'user', content: 'Antworte mit OK.' }],
            max_tokens: 10,
          }),
        });
        if (res.ok) {
          return { success: true, message: `Verbindung zum benutzerdefinierten Endpunkt erfolgreich.` };
        }
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData?.error?.message || `Fehler HTTP ${res.status}` };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Verbindung zum Endpunkt fehlgeschlagen.' };
      }
    }

    // Default: Gemini client fallback
    if (keyToTest) {
      const candidateModels = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
      let lastErrMsg = '';

      for (const m of candidateModels) {
        try {
          const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(keyToTest)}`;
          const res = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Antworte mit OK.' }] }],
            }),
          });

          if (res.ok) {
            return { success: true, message: `Verbindung zu Google Gemini erfolgreich hergestellt (${m}).` };
          } else {
            const errData = await res.json().catch(() => ({}));
            lastErrMsg = errData.error?.message || `HTTP ${res.status}: Autorisierung fehlgeschlagen.`;
          }
        } catch (err: any) {
          lastErrMsg = err?.message || 'Netzwerkfehler bei der Verbindung zu Google Gemini.';
        }
      }

      return { success: false, message: `Fehler: ${lastErrMsg || 'Autorisierung fehlgeschlagen.'}` };
    }

    return {
      success: false,
      message: 'Kein API-Schlüssel hinterlegt. Bitte geben Sie Ihren API-Schlüssel ein.',
    };
  }

  /**
   * Categorizes a booking based on short user description or existing booking text
   */
  static async categorizeBooking(
    req: CategorizeRequest,
    customApiKey?: string
  ): Promise<BookingAiSuggestion> {
    const aiConfig = this.getAiConfig();
    const effectiveKey = (customApiKey || aiConfig.apiKey).trim();
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
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
          aiBaseUrl: aiConfig.baseUrl,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          return this.normalizeSuggestion(json.data, effectiveType);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
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
      'Kein API-Schlüssel hinterlegt. Bitte hinterlegen Sie Ihren API-Schlüssel in den Einstellungen (1. Allgemeine Einstellungen > KI-Assistent).'
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

SPHÄREN (DATEV SKR 42 - 5-stellig):
- "ideell": Mitgliedsbeiträge (40000), Spenden (40450), Zuschüsse (40700), Verband (66100), Verwaltung/Büro (68100) (0% USt)
- "vermoegen": Miete/Pacht Vereinsheim (46100), Zinsen (47000), Erhaltung Vermietung (62150) (0% USt)
- "zweckbetrieb": Eintrittsgelder (41100), Kurse (41200), Sportartikel (41400), Trainer/Übungsleiter gem. § 3 Nr. 26 EStG (60040), Sportgeräte/Bälle/Trikots (65100), Hallenmieten (62100), Reisekosten Sport (63100) (7% oder 0% USt)
- "wirtschaftlich": Bewirtung/Kiosk/Feste (43100/43200), Werbung/Sponsoring (44100), Merchandising (45100), Wareneinkauf Feste/Getränke (51000/51100), Steuern (73100) (19% USt)

Gib ausschließlich valides JSON mit diesem Schema aus:
{
  "sphere": "ideell" | "vermoegen" | "zweckbetrieb" | "wirtschaftlich",
  "type": "income" | "expense",
  "mainCategoryCode": "65000",
  "mainCategoryName": "Spielbetrieb, Sportgeräte & Trikots",
  "subCategoryCode": "65100",
  "subCategoryName": "Sportgeräte & Trainingsmaterial",
  "subCategoryLabel": "65100 - Sportgeräte & Trainingsmaterial",
  "vatRate": 0 | 7 | 19,
  "suggestedBookingText": "Prägnanter Buchungstext",
  "confidence": 0.95,
  "reasoning": "Kurze Begründung nach Gemeinnützigkeitsrecht"
}`;

    const models = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
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
