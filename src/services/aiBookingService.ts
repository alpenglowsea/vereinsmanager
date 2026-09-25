/**
 * KI-Zuordnung von Buchungen nach SKR 42.
 * ---------------------------------------------------------------------------
 *
 * Seit Fassung 0.9 hält die Oberfläche KEINEN KI-Schlüssel mehr. Er liegt
 * verschlüsselt auf dem Server dieser Installation; jeder KI-Aufruf geht über
 * /api. Das ist der ganze Zweck des Umbaus: Was der Browser nicht kennt, kann
 * er auch nicht in eine Datensicherung schreiben.
 *
 * Vorher lag der Schlüssel an drei Stellen gleichzeitig — im Browser-Speicher,
 * in den Vereinseinstellungen (und damit in jeder Sicherung sowie in Supabase)
 * und ersatzweise in der .env des Servers. Zusätzlich rief die Oberfläche die
 * Anbieter bei Bedarf direkt auf, mit dem Schlüssel im Gepäck. Genau diese
 * Direktaufrufe sind hier entfallen; sie waren der Grund, warum der Schlüssel
 * überhaupt im Browser liegen musste.
 *
 * Was das kostet: Ohne erreichbaren Server gibt es keine KI-Funktionen mehr.
 * Bei allen Betriebsarten — Startskript, Docker, Desktop-Fassung — läuft der
 * Server ohnehin mit. Nur wer die gebaute Oberfläche auf einen reinen
 * Dateispeicher legt, steht ohne da; dort funktioniert seit Fassung 0.9 aber
 * auch der E-Mail-Versand nicht.
 *
 * Die KI-Einstellungen selbst (Anbieter, Modell, Adresse) werden über
 * src/services/aiConfigService.ts verwaltet.
 */

import { BookingAiSuggestion, TaxSphere } from '../types';
import { apiFetch } from './apiClient';
import { findSkr42MainForSub, getSkr42MainCategories } from '../data/taxSpheres';

export interface CategorizeRequest {
  description: string;
  bookingText?: string;
  partner?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
}

export class AiBookingService {
  /**
   * Prüft, ob sich mit den hinterlegten KI-Zugangsdaten arbeiten lässt.
   *
   * Die Angaben dürfen mitgeschickt werden, weil in den Einstellungen gerade
   * etwas eingetippt sein kann, das noch nicht gespeichert ist. Bleiben sie
   * leer, prüft der Server das, was bei ihm hinterlegt ist — der Normalfall
   * an einer eingerichteten Installation, denn den Schlüssel kennt die
   * Oberfläche dort nicht.
   */
  static async testConnection(entwurf?: {
    apiKey?: string;
    provider?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch('/api/test-ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: entwurf?.apiKey ?? '',
          provider: entwurf?.provider,
          model: entwurf?.model ?? '',
          baseUrl: entwurf?.baseUrl ?? '',
        }),
      });

      const daten = await res.json().catch(() => ({}));
      if (res.ok && daten?.success) {
        return { success: true, message: daten.message || 'Verbindung erfolgreich hergestellt.' };
      }
      return {
        success: false,
        message: daten?.error || `Die Prüfung ist fehlgeschlagen (HTTP ${res.status}).`,
      };
    } catch (fehler: any) {
      // Kein Ausweichweg mehr: Ohne Server gibt es keine KI-Funktionen.
      return {
        success: false,
        message:
          fehler?.message ||
          'Der Server ist nicht erreichbar. KI-Funktionen brauchen den mitgelieferten Server.',
      };
    }
  }

  /**
   * Ordnet einen Geschäftsvorfall einer steuerlichen Sphäre und einem
   * SKR-42-Konto zu. Anbieter, Modell und Schlüssel bestimmt allein der Server.
   */
  static async categorizeBooking(req: CategorizeRequest): Promise<BookingAiSuggestion> {
    const effectiveType = req.type === 'transfer' ? 'expense' : req.type;

    const response = await apiFetch('/api/categorize-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: req.description,
        bookingText: req.bookingText,
        partner: req.partner,
        amount: req.amount,
        type: effectiveType,
      }),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.success || !json?.data) {
      // Die Meldung des Servers unverändert weiterreichen: Sie unterscheidet
      // zwischen "kein Schlüssel hinterlegt", "Schlüssel abgelehnt" und
      // "Anbieter antwortet nicht" — der Anwender braucht genau diesen
      // Unterschied, um zu wissen, was zu tun ist.
      throw new Error(
        json?.error ||
          'Die KI-Zuordnung ist fehlgeschlagen. Bitte die KI-Einstellungen prüfen.'
      );
    }

    return this.normalizeSuggestion(json.data, effectiveType);
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

    const subCode = String(raw.subCategoryCode || '');
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
