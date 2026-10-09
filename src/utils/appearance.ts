/**
 * Farbschema und Schrift der Oberfläche.
 * ---------------------------------------------------------------------------
 *
 * Beides gehört zum Verein (es steht in den Vereinsdaten und reist mit der
 * Datensicherung mit), wird aber zusätzlich auf dem Gerät zwischengespeichert:
 * Der Anmeldebildschirm und der Start erscheinen sonst kurz in den
 * Standardfarben, bevor die Vereinsdaten geladen sind.
 *
 * Gesetzt wird nur ein Merkmal am Wurzelelement (data-farbschema,
 * data-schrift). Was daraus wird, steht in index.css.
 */
import type { ColorSchemeId, FontChoiceId } from '../types';

const CACHE_SCHEME = 'vereinsmanager_farbschema';
const CACHE_FONT = 'vereinsmanager_schrift';

export const DEFAULT_COLOR_SCHEME: ColorSchemeId = 'blau';
export const DEFAULT_FONT_CHOICE: FontChoiceId = 'system';

export interface ColorSchemeInfo {
  id: ColorSchemeId;
  name: string;
  hint: string;
  /** Fünf Farbmuster für die Auswahl in den Einstellungen (hell bis dunkel). */
  swatch: [string, string, string, string, string];
}

export const COLOR_SCHEMES: ColorSchemeInfo[] = [
  { id: 'blau', name: 'Blau', hint: 'Standard', swatch: ['#eff6ff', '#dbeafe', '#3b82f6', '#2563eb', '#1d4ed8'] },
  { id: 'gruen', name: 'Grün', hint: 'Tannengrün', swatch: ['#f0fdf4', '#dcfce7', '#15803d', '#166534', '#14532d'] },
  { id: 'rot', name: 'Rot', hint: 'Weinrot', swatch: ['#fef2f2', '#fee2e2', '#b91c1c', '#991b1b', '#7f1d1d'] },
  { id: 'orange', name: 'Orange', hint: 'Leuchtend', swatch: ['#fff7ed', '#ffedd5', '#fb923c', '#f97316', '#ea6a0c'] },
  { id: 'gelb', name: 'Gelb', hint: 'Leuchtend', swatch: ['#fefce8', '#fef9c3', '#eab308', '#facc15', '#eab308'] },
  { id: 'tuerkis', name: 'Türkis', hint: 'Frisch', swatch: ['#f0fdfa', '#ccfbf1', '#14b8a6', '#0f766e', '#115e59'] },
  { id: 'violett', name: 'Violett', hint: 'Kräftig', swatch: ['#f5f3ff', '#ede9fe', '#8b5cf6', '#7c3aed', '#6d28d9'] },
  { id: 'anthrazit', name: 'Anthrazit', hint: 'Zurückhaltend', swatch: ['#f8fafc', '#f1f5f9', '#475569', '#334155', '#1e293b'] },
];

export interface FontChoiceInfo {
  id: FontChoiceId;
  name: string;
  hint: string;
  /** Schriftfamilie für die Vorschau in der Auswahl. */
  family: string;
}

export const FONT_CHOICES: FontChoiceInfo[] = [
  { id: 'system', name: 'Systemschrift', hint: 'Standard, passt sich dem Gerät an', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  { id: 'source-sans', name: 'Source Sans 3', hint: 'Neutral, serifenlos', family: "'Source Sans 3', sans-serif" },
  { id: 'chakra-petch', name: 'Chakra Petch', hint: 'Technisch, eckig', family: "'Chakra Petch', sans-serif" },
  { id: 'lora', name: 'Lora', hint: 'Fein, mit Serifen', family: "'Lora', Georgia, serif" },
];

export function istFarbschema(wert: unknown): wert is ColorSchemeId {
  return COLOR_SCHEMES.some(s => s.id === wert);
}

export function istSchriftwahl(wert: unknown): wert is FontChoiceId {
  return FONT_CHOICES.some(f => f.id === wert);
}

/** Setzt Farbschema und Schrift am Wurzelelement und merkt sie sich auf dem Gerät. */
export function applyAppearance(scheme?: ColorSchemeId, font?: FontChoiceId): void {
  const farbe = istFarbschema(scheme) ? scheme : DEFAULT_COLOR_SCHEME;
  const schrift = istSchriftwahl(font) ? font : DEFAULT_FONT_CHOICE;
  const root = document.documentElement;
  root.setAttribute('data-farbschema', farbe);
  root.setAttribute('data-schrift', schrift);
  try {
    localStorage.setItem(CACHE_SCHEME, farbe);
    localStorage.setItem(CACHE_FONT, schrift);
  } catch {
    // Zwischenspeicher nicht verfügbar — die Vereinsdaten bleiben maßgeblich.
  }
}

/** Beim Start, noch bevor die Vereinsdaten geladen sind. */
export function applyCachedAppearance(): void {
  let farbe: string | null = null;
  let schrift: string | null = null;
  try {
    farbe = localStorage.getItem(CACHE_SCHEME);
    schrift = localStorage.getItem(CACHE_FONT);
  } catch {
    // ohne Zwischenspeicher gelten die Standardwerte
  }
  const root = document.documentElement;
  root.setAttribute('data-farbschema', istFarbschema(farbe) ? farbe : DEFAULT_COLOR_SCHEME);
  root.setAttribute('data-schrift', istSchriftwahl(schrift) ? schrift : DEFAULT_FONT_CHOICE);
}
