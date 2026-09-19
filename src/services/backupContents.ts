/**
 * Was in eine Datensicherung gehört — und wie sie eingespielt wird.
 * ---------------------------------------------------------------------------
 *
 * Diese Datei ist das Verzeichnis aller Datenbereiche der Anwendung. Sie kennt
 * weder die Datenbank noch die Oberfläche und lässt sich deshalb vollständig
 * prüfen, ohne dass ein Browser läuft.
 *
 * Warum es sie gibt
 * ---------------------------------------------------------------------------
 * Die Sicherung war unvollständig: Von 24 Datenbereichen wanderten fünf nicht
 * mit — die Ordnerstruktur des Dokumentenarchivs, die Mitgliederbefragungen
 * samt Antworten und Teilnahme-Links sowie die Ausgabe von Vereinsinventar an
 * Mitglieder. Wer seinen Bestand auf einen anderen Rechner mitnahm, verlor sie
 * stillschweigend.
 *
 * Damit das nicht wiederkommt, steht die Liste hier an einer Stelle, und
 * TypeScript wacht darüber:
 *
 *   - `pruefungAlleStoresGesichert` unten schlägt beim `npm run check` fehl,
 *     sobald ein Datenbereich in STORES steht, aber hier fehlt.
 *   - `SicherungsDaten` zwingt die Sicherung dazu, jeden Bereich zu füllen.
 *
 * Ein vergessener Bereich ist damit kein stiller Datenverlust mehr, sondern
 * eine Fehlermeldung beim Bauen.
 */

/**
 * Namen der Datenbereiche in der Browser-Datenbank.
 *
 * Steht bewusst hier und nicht mehr in storage.ts: So kann die Prüfung unten
 * darauf zugreifen, ohne die gesamte Speicherverwaltung mitzuladen.
 *
 * `as const` ist wesentlich — ohne das wären die Werte für TypeScript einfach
 * "irgendwelche Zeichenketten", und die Vollständigkeitsprüfung liefe ins Leere.
 */
export const STORES = {
  MEMBERS: 'members',
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  INVENTORY: 'inventory',
  SEPA_RUNS: 'sepa_runs',
  DOCUMENTS: 'documents',
  DONATIONS: 'donations',
  FOLDERS: 'folders',
  CALENDAR_EVENTS: 'calendar_events',
  CALENDAR_CATEGORIES: 'calendar_categories',
  ONLINE_APPLICATIONS: 'online_applications',
  APPLICATION_SETTINGS: 'application_settings',
  DASHBOARD_CONFIG: 'dashboard_config',
  CONTACTS: 'contacts',
  INVOICES: 'invoices',
  INVOICE_TEMPLATES: 'invoice_templates',
  MEETINGS: 'meetings',
  MEETING_TEMPLATES: 'meeting_templates',
  MEMBER_INVENTORY: 'member_inventory',
  SURVEYS: 'surveys',
  SURVEY_RESPONSES: 'survey_responses',
  SURVEY_TOKENS: 'survey_tokens'
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

// ---------------------------------------------------------------------------
// Die Bereiche der Sicherung
// ---------------------------------------------------------------------------

/**
 * `liste`  — viele Einträge mit eigener Kennung (Mitglieder, Buchungen …)
 * `einzel` — genau ein Datensatz (Vereinsstammdaten, Vorlagen, Startseite)
 */
export type BereichsArt = 'liste' | 'einzel';

export interface BereichDefinition {
  /** Für Menschen lesbar, erscheint im Bestätigungsdialog. */
  bezeichnung: string;
  art: BereichsArt;
  /**
   * Der zugehörige Datenbereich in der Browser-Datenbank, oder null für
   * Angaben, die woanders liegen (Benutzerkonten und Sicherheitseinstellungen
   * verwaltet der Anmeldedienst im localStorage).
   */
  store: StoreName | null;
}

export const SICHERUNGS_BEREICHE = {
  members: { bezeichnung: 'Mitglieder', art: 'liste', store: STORES.MEMBERS },
  transactions: { bezeichnung: 'Buchungen', art: 'liste', store: STORES.TRANSACTIONS },
  accounts: { bezeichnung: 'Finanzkonten', art: 'liste', store: STORES.ACCOUNTS },
  auditLogs: { bezeichnung: 'Änderungsprotokoll', art: 'liste', store: STORES.AUDIT_LOGS },
  inventory: { bezeichnung: 'Inventar', art: 'liste', store: STORES.INVENTORY },
  memberInventory: {
    bezeichnung: 'Inventar-Ausgaben an Mitglieder',
    art: 'liste',
    store: STORES.MEMBER_INVENTORY
  },
  sepaRuns: { bezeichnung: 'SEPA-Läufe', art: 'liste', store: STORES.SEPA_RUNS },
  documents: { bezeichnung: 'Dokumente', art: 'liste', store: STORES.DOCUMENTS },
  folders: { bezeichnung: 'Dokumentenordner', art: 'liste', store: STORES.FOLDERS },
  donations: { bezeichnung: 'Zuwendungsbestätigungen', art: 'liste', store: STORES.DONATIONS },
  contacts: { bezeichnung: 'Kontakte', art: 'liste', store: STORES.CONTACTS },
  invoices: { bezeichnung: 'Rechnungen', art: 'liste', store: STORES.INVOICES },
  invoiceTemplate: {
    bezeichnung: 'Rechnungsvorlage',
    art: 'einzel',
    store: STORES.INVOICE_TEMPLATES
  },
  meetings: { bezeichnung: 'Sitzungen', art: 'liste', store: STORES.MEETINGS },
  meetingTemplate: {
    bezeichnung: 'Sitzungsvorlage',
    art: 'einzel',
    store: STORES.MEETING_TEMPLATES
  },
  dashboardConfig: { bezeichnung: 'Startseite', art: 'einzel', store: STORES.DASHBOARD_CONFIG },
  calendarEvents: { bezeichnung: 'Termine', art: 'liste', store: STORES.CALENDAR_EVENTS },
  calendarCategories: {
    bezeichnung: 'Terminkategorien',
    art: 'liste',
    store: STORES.CALENDAR_CATEGORIES
  },
  onlineApplications: { bezeichnung: 'Aufnahmeanträge', art: 'liste', store: STORES.ONLINE_APPLICATIONS },
  applicationSettings: {
    bezeichnung: 'Antragsformular',
    art: 'einzel',
    store: STORES.APPLICATION_SETTINGS
  },
  surveys: { bezeichnung: 'Befragungen', art: 'liste', store: STORES.SURVEYS },
  surveyResponses: { bezeichnung: 'Antworten auf Befragungen', art: 'liste', store: STORES.SURVEY_RESPONSES },
  surveyTokens: { bezeichnung: 'Teilnahme-Links', art: 'liste', store: STORES.SURVEY_TOKENS },
  settings: { bezeichnung: 'Vereinsstammdaten', art: 'einzel', store: STORES.SETTINGS },
  users: { bezeichnung: 'Benutzerkonten', art: 'liste', store: null },
  securitySettings: { bezeichnung: 'Sicherheitseinstellungen', art: 'einzel', store: null }
} as const satisfies Record<string, BereichDefinition>;

export type SicherungsSchluessel = keyof typeof SICHERUNGS_BEREICHE;

/**
 * Der Inhalt einer Sicherung. Wer diesen Typ erfüllt, hat keinen Bereich
 * vergessen — genau das prüft der Compiler beim Erzeugen der Sicherung.
 */
export type SicherungsDaten = Record<SicherungsSchluessel, unknown>;

// ---------------------------------------------------------------------------
// Vollständigkeitsprüfung beim Bauen
// ---------------------------------------------------------------------------

type AbgedeckteStores = (typeof SICHERUNGS_BEREICHE)[SicherungsSchluessel]['store'];
type NichtGesicherteStores = Exclude<StoreName, AbgedeckteStores>;

/**
 * Schlägt beim Übersetzen fehl, sobald ein Datenbereich aus STORES oben in
 * SICHERUNGS_BEREICHE fehlt. Die Fehlermeldung nennt den fehlenden Namen.
 *
 * Das ist kein toter Code: Diese eine Zeile ist der Grund, warum ein neuer
 * Datenbereich künftig nicht mehr stillschweigend aus der Sicherung fallen
 * kann. Sie kostet zur Laufzeit nichts.
 */
export const pruefungAlleStoresGesichert: NichtGesicherteStores extends never
  ? true
  : ['Dieser Datenbereich fehlt in SICHERUNGS_BEREICHE:', NichtGesicherteStores] = true;

// ---------------------------------------------------------------------------
// Abgleich zwischen Datei und vorhandenem Bestand
// ---------------------------------------------------------------------------

/** Wie eine Sicherung eingespielt wird. */
export type ImportArt =
  /** Alles ersetzen: Der vorhandene Bestand wird durch die Datei ersetzt. */
  | 'ersetzen'
  /** Nur ergänzen: Vorhandenes bleibt, aus der Datei kommt nur Neues hinzu. */
  | 'ergaenzen';

export interface BereichsVergleich {
  schluessel: SicherungsSchluessel;
  bezeichnung: string;
  art: BereichsArt;
  /** Einträge in der Datei. */
  inDatei: number;
  /** Einträge, die es hier schon gibt. */
  vorhanden: number;
  /** Einträge aus der Datei, die es hier noch nicht gibt. */
  neu: number;
  /** Einträge, die beim Ersetzen überschrieben würden. */
  wirdUeberschrieben: number;
}

function alsListe(wert: unknown): { id?: string }[] {
  return Array.isArray(wert) ? (wert as { id?: string }[]) : [];
}

function vorhandenesEinzelstueck(wert: unknown): boolean {
  return wert !== null && wert !== undefined;
}

/**
 * Vergleicht einen Bereich. Verglichen wird über die Kennung (`id`) — zwei
 * Einträge gelten als derselbe, wenn ihre Kennung übereinstimmt.
 */
export function vergleicheBereich(
  schluessel: SicherungsSchluessel,
  ausDatei: unknown,
  vorhanden: unknown
): BereichsVergleich {
  const definition = SICHERUNGS_BEREICHE[schluessel];

  if (definition.art === 'einzel') {
    const inDatei = vorhandenesEinzelstueck(ausDatei) ? 1 : 0;
    const schonDa = vorhandenesEinzelstueck(vorhanden) ? 1 : 0;
    return {
      schluessel,
      bezeichnung: definition.bezeichnung,
      art: 'einzel',
      inDatei,
      vorhanden: schonDa,
      neu: inDatei && !schonDa ? 1 : 0,
      wirdUeberschrieben: inDatei && schonDa ? 1 : 0
    };
  }

  const datei = alsListe(ausDatei);
  const bestand = alsListe(vorhanden);
  const bekannteKennungen = new Set(bestand.map(e => e?.id).filter(Boolean));

  let neu = 0;
  let ueberschrieben = 0;
  for (const eintrag of datei) {
    if (eintrag?.id && bekannteKennungen.has(eintrag.id)) ueberschrieben += 1;
    else neu += 1;
  }

  return {
    schluessel,
    bezeichnung: definition.bezeichnung,
    art: 'liste',
    inDatei: datei.length,
    vorhanden: bestand.length,
    neu,
    wirdUeberschrieben: ueberschrieben
  };
}

/** Vergleicht alle Bereiche. Die Reihenfolge folgt SICHERUNGS_BEREICHE. */
export function vergleicheSicherung(
  ausDatei: Partial<SicherungsDaten>,
  vorhanden: Partial<SicherungsDaten>
): BereichsVergleich[] {
  return (Object.keys(SICHERUNGS_BEREICHE) as SicherungsSchluessel[]).map(schluessel =>
    vergleicheBereich(schluessel, ausDatei[schluessel], vorhanden[schluessel])
  );
}

// ---------------------------------------------------------------------------
// Zusammenführen
// ---------------------------------------------------------------------------

/**
 * Führt Datei und Bestand zusammen. **Der vorhandene Bestand gewinnt immer.**
 *
 * Das ist die Bedeutung von "nur Fehlendes ergänzen": Was hier schon liegt,
 * wird nicht angefasst — auch dann nicht, wenn die Datei eine neuere Fassung
 * enthält. Sonst wäre es kein Ergänzen, sondern ein teilweises Überschreiben,
 * und niemand könnte mehr vorhersagen, welche Fassung gewinnt.
 */
export function ergaenzeListe<T extends { id?: string }>(ausDatei: T[], vorhanden: T[]): T[] {
  const bekannt = new Set(vorhanden.map(e => e?.id).filter(Boolean));
  const ergaenzt = ausDatei.filter(e => e?.id && !bekannt.has(e.id));
  return [...vorhanden, ...ergaenzt];
}

/**
 * Wie ergaenzeListe, prüft aber zusätzlich den Anmeldenamen.
 *
 * Zwei Konten mit demselben Anmeldenamen, aber unterschiedlicher Kennung wären
 * ein Problem: Bei der Anmeldung entschiede der Zufall, welches genommen wird.
 * Solche Konten aus der Datei bleiben deshalb draußen.
 */
export function ergaenzeBenutzer<T extends { id?: string; username?: string }>(
  ausDatei: T[],
  vorhanden: T[]
): T[] {
  const bekannteKennungen = new Set(vorhanden.map(e => e?.id).filter(Boolean));
  const bekannteNamen = new Set(
    vorhanden.map(e => e?.username?.trim().toLowerCase()).filter(Boolean)
  );
  const ergaenzt = ausDatei.filter(
    e =>
      e?.id &&
      !bekannteKennungen.has(e.id) &&
      !bekannteNamen.has(e?.username?.trim().toLowerCase() || '')
  );
  return [...vorhanden, ...ergaenzt];
}

/** Einzelstück: Beim Ergänzen behält ein vorhandener Datensatz den Vorrang. */
export function ergaenzeEinzelstueck<T>(ausDatei: T | null | undefined, vorhanden: T | null | undefined): T | null {
  if (vorhandenesEinzelstueck(vorhanden)) return vorhanden as T;
  return vorhandenesEinzelstueck(ausDatei) ? (ausDatei as T) : null;
}

// ---------------------------------------------------------------------------
// Kopfdaten einer Sicherungsdatei
// ---------------------------------------------------------------------------

export interface SicherungsKopf {
  app?: string;
  version?: string;
  exportedAt?: string;
  clubName?: string;
}

/**
 * Liest eine Sicherungsdatei ein und prüft, ob sie überhaupt eine ist.
 *
 * Wirft mit einer verständlichen Meldung, wenn nicht — die Datei landet sonst
 * ungeprüft im Einspielvorgang, und der Anwender sieht am Ende nur, dass
 * nichts mehr da ist.
 */
export function leseSicherung(jsonText: string): {
  kopf: SicherungsKopf;
  daten: Partial<SicherungsDaten>;
} {
  let geparst: any;
  try {
    geparst = JSON.parse(jsonText);
  } catch {
    throw new Error(
      'Die Datei ist keine gültige JSON-Datei. Bitte prüfen Sie, ob Sie die richtige Sicherungsdatei ausgewählt haben.'
    );
  }

  if (!geparst || typeof geparst !== 'object') {
    throw new Error('Die Datei enthält keine Datensicherung.');
  }

  const daten = (geparst.data && typeof geparst.data === 'object' ? geparst.data : geparst) as Partial<SicherungsDaten>;

  // Eine Sicherung ohne einen einzigen bekannten Bereich ist keine.
  const bekannteBereiche = (Object.keys(SICHERUNGS_BEREICHE) as SicherungsSchluessel[]).filter(
    s => daten[s] !== undefined
  );
  if (bekannteBereiche.length === 0) {
    throw new Error(
      'Die Datei sieht nicht wie eine Datensicherung des VereinsManagers aus. Es wurde kein einziger bekannter Datenbereich gefunden.'
    );
  }

  return {
    kopf: {
      app: geparst.app,
      version: geparst.version,
      exportedAt: geparst.exportedAt,
      clubName: (daten.settings as { clubName?: string } | undefined)?.clubName
    },
    daten
  };
}
