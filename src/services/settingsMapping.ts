/**
 * Übersetzung der Vereinsstammdaten zwischen App und Supabase.
 * ---------------------------------------------------------------------------
 *
 * Warum eine eigene Datei?
 *
 * Diese Zuordnung war die Ursache eines stillen Datenverlusts: In der
 * Supabase-Fassung wurden von Hand 13 Felder aufgezählt, die übrigen fehlten.
 * Wer im Cloud-Betrieb Vorstandsmitglieder, Vereinslogo, Freistellungsdaten
 * oder den KI-Schlüssel eintrug, verlor sie beim nächsten Laden wieder — ohne
 * Fehlermeldung, ohne Hinweis.
 *
 * Deshalb steht die Zuordnung jetzt an genau einer Stelle, und zwar als
 * vollständige Liste:
 *
 *     const SPALTEN: Record<SynchronisierteFelder, string> = { ... }
 *
 * `Record<SynchronisierteFelder, string>` verlangt von TypeScript, dass jedes
 * Feld aus ClubSettings hier vorkommt. Wer künftig ein Feld hinzufügt und es
 * hier vergisst, bekommt beim `npm run check` einen Fehler — statt Monate
 * später einen Anruf aus einem Verein, dem Daten fehlen.
 *
 * Die Datei kennt bewusst weder Supabase noch den Browser. Dadurch lässt sich
 * die Zuordnung in beide Richtungen prüfen, ohne dass eine Datenbank läuft
 * (siehe settingsMapping.test.ts).
 */

import { ClubSettings } from '../types';

/**
 * Felder, die absichtlich NICHT in die Cloud wandern.
 *
 * `theme` ist die Wahl zwischen hellem und dunklem Erscheinungsbild. Sie
 * gehört zum Gerät, nicht zum Verein: Sonst zwänge das Vorstandsmitglied mit
 * dem Dunkelmodus allen anderen seine Ansicht auf. Die Einstellung liegt
 * ohnehin im Browser (localStorage `vereinsmanager_theme`); das Feld in
 * ClubSettings wird nur mitgeschrieben, aber nicht zur Anzeige benutzt.
 */
export const NICHT_SYNCHRONISIERT = ['theme'] as const;
type NichtSynchronisiert = (typeof NICHT_SYNCHRONISIERT)[number];

export type SynchronisierteFelder = Exclude<keyof ClubSettings, NichtSynchronisiert>;

/**
 * Feldname in der App → Spaltenname in Supabase.
 *
 * Diese Liste MUSS vollständig sein; TypeScript erzwingt das. Kommt ein neues
 * Feld zu ClubSettings hinzu, gehört es
 *   1. hier hinein und
 *   2. als Spalte in supabase_schema.sql (dort gibt es dafür einen
 *      ALTER-TABLE-Abschnitt, der sich gefahrlos erneut ausführen lässt).
 */
export const SPALTEN: Record<SynchronisierteFelder, string> = {
  clubName: 'club_name',
  clubLogoUrl: 'club_logo_url',
  associationNumber: 'association_number',
  taxNumber: 'tax_number',
  creditorId: 'creditor_id',
  creditorIban: 'creditor_iban',
  creditorBic: 'creditor_bic',
  creditorAccountId: 'creditor_account_id',
  address: 'address',
  clubAddress: 'club_address',
  chairman: 'chairman',
  treasurer: 'treasurer',
  boardMembers: 'board_members',
  email: 'email',
  phone: 'phone',
  website: 'website',
  departments: 'departments',
  currency: 'currency',
  dateFormat: 'date_format',
  fiscalYearStart: 'fiscal_year_start',
  taxOffice: 'tax_office',
  taxExemptionDate: 'tax_exemption_date',
  taxAssessmentPeriod: 'tax_assessment_period',
  promotedPurposes: 'promoted_purposes'
};

const FELD_PAARE = Object.entries(SPALTEN) as [SynchronisierteFelder, string][];

/**
 * Pflichtfelder der Oberfläche. Steht in der Datenbank nichts, bekommen sie
 * einen leeren Wert — sonst müsste jede Maske mit `undefined` rechnen.
 */
const GRUNDGERUEST: ClubSettings = {
  clubName: '',
  associationNumber: '',
  taxNumber: '',
  creditorId: '',
  address: '',
  chairman: '',
  treasurer: '',
  email: '',
  departments: []
};

/**
 * App → Datenbank.
 *
 * Fehlende Werte werden als `null` geschrieben und nicht weggelassen. Das ist
 * wichtig: Beim Speichern ändert PostgREST nur die Spalten, die im Auftrag
 * stehen. Ein weggelassenes Feld bliebe in der Datenbank auf seinem alten
 * Wert — wer eine Angabe löscht, bekäme sie beim nächsten Laden zurück.
 */
export function mapSettingsToDb(settings: ClubSettings): Record<string, unknown> {
  const zeile: Record<string, unknown> = {
    id: 'main',
    updated_at: new Date().toISOString()
  };

  for (const [feld, spalte] of FELD_PAARE) {
    const wert = settings[feld];
    zeile[spalte] = wert === undefined ? null : wert;
  }

  return zeile;
}

/**
 * Datenbank → App.
 *
 * `null` in der Datenbank bedeutet "nicht gesetzt" und wird zu einem fehlenden
 * Feld, nicht zu `null`. Sonst stünde in den Eingabefeldern der Oberfläche das
 * Wort "null".
 */
export function mapSettingsFromDb(zeile: Record<string, unknown>): ClubSettings {
  const gelesen: Record<string, unknown> = {};

  for (const [feld, spalte] of FELD_PAARE) {
    const wert = zeile[spalte];
    if (wert !== null && wert !== undefined) {
      gelesen[feld] = wert;
    }
  }

  return { ...GRUNDGERUEST, ...gelesen } as ClubSettings;
}
