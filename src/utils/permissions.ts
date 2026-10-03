import { AccessLevel, PermissionArea, UserPermissions } from '../types';

/**
 * Berechtigungen je Navigationsbereich.
 *
 * Bewusst dreistufig statt zweier Häkchen: Mit getrennten Feldern für
 * "lesen" und "schreiben" liesse sich "darf bearbeiten, aber nicht sehen"
 * einstellen. Das ergibt keinen Sinn, und irgendwer stellt es irgendwann
 * trotzdem ein. Eine Stufenleiter kann diesen Zustand nicht abbilden.
 *
 * ACHTUNG: Das ist eine Bedienhilfe, keine Sicherheitsgrenze. Alles läuft
 * im Browser des Nutzers. Verbindlich durchsetzen kann nur der Server
 * (Supabase Row Level Security).
 */

export interface AreaDefinition {
  id: PermissionArea;
  label: string;
  /** Überschrift in der Rechteverwaltung. */
  group: string;
  /**
   * Bereiche, die nur anzeigen: Auswertungen und Berichte. Dort gibt es
   * nichts zu bearbeiten, deshalb bietet die Maske nur zwei Stufen an.
   */
  viewOnly?: boolean;
  description: string;
}

export const AREA_DEFINITIONS: AreaDefinition[] = [
  {
    id: 'dashboard',
    label: 'Übersicht (Dashboard)',
    group: 'Start',
    viewOnly: true,
    description: 'Startseite mit den Kacheln. Gesperrte Bereiche liefern auch keine Kacheln.'
  },

  {
    id: 'members',
    label: 'Mitgliederverwaltung',
    group: 'Mitglieder',
    description: 'Mitgliederliste, Stammdaten, Eintritte und Kündigungen'
  },
  {
    id: 'online_applications',
    label: 'Online-Aufnahmeanträge',
    group: 'Mitglieder',
    description: 'Eingegangene Anträge prüfen, annehmen oder ablehnen'
  },
  {
    id: 'member_analytics',
    label: 'Mitglieder-Statistiken',
    group: 'Mitglieder',
    viewOnly: true,
    description: 'Altersstruktur, Entwicklung und Abteilungsverteilung'
  },
  {
    id: 'member_surveys',
    label: 'Mitgliederbefragungen',
    group: 'Mitglieder',
    description: 'Umfragen anlegen, versenden und auswerten'
  },

  {
    id: 'finance',
    label: 'Buchungen & Kassenbuch',
    group: 'Finanzen',
    description: 'Einnahmen und Ausgaben erfassen, Belege zuordnen'
  },
  {
    id: 'sepa',
    label: 'SEPA-Beitragslauf',
    group: 'Finanzen',
    description: 'Lastschriftdatei erzeugen und Beiträge einziehen'
  },
  {
    id: 'invoices',
    label: 'Rechnungen',
    group: 'Finanzen',
    description: 'Rechnungen nach DIN 5008 erstellen und versenden'
  },
  {
    id: 'donations',
    label: 'Zuwendungsbestätigungen',
    group: 'Finanzen',
    description: 'Geld- und Sachspendenbescheinigungen nach BMF-Muster'
  },
  {
    id: 'guv',
    label: 'EÜR / GuV & Sphären',
    group: 'Finanzen',
    viewOnly: true,
    description: 'Einnahmenüberschussrechnung und die vier Steuersphären'
  },
  {
    id: 'finance_analytics',
    label: 'Finanz-Auswertungen',
    group: 'Finanzen',
    viewOnly: true,
    description: 'Cashflow, Kategorienverteilung und Jahresvergleiche'
  },

  {
    id: 'contacts',
    label: 'Kontakte & Partner',
    group: 'Kontakte, Termine & Sitzungen',
    description: 'Lieferanten, Sponsoren, Spender und Partner'
  },
  {
    id: 'calendar',
    label: 'Vereinskalender',
    group: 'Kontakte, Termine & Sitzungen',
    description: 'Termine planen und Einladungen versenden'
  },
  {
    id: 'meetings',
    label: 'Sitzungsdienst & Beschlussbuch',
    group: 'Kontakte, Termine & Sitzungen',
    description: 'Sitzungen vorbereiten, Protokolle und Beschlüsse führen'
  },

  {
    id: 'inventory',
    label: 'Inventar & Material',
    group: 'Inventar & Dokumente',
    description: 'Vereinsausstattung, Geräte und Prüffristen'
  },
  {
    id: 'documents',
    label: 'Dokumentenarchiv',
    group: 'Inventar & Dokumente',
    description: 'Belege und Dateien ablegen, Ordner verwalten'
  },

  {
    id: 'settings',
    label: 'Vereinseinstellungen',
    group: 'System',
    description: 'Stammdaten, Konten, Beitragsstaffeln und Datenschutz'
  },
  {
    id: 'users',
    label: 'Benutzer & Rechte',
    group: 'System',
    description: 'Konten anlegen, Passwörter vergeben, Berechtigungen setzen'
  }
];

export const ALL_AREAS: PermissionArea[] = AREA_DEFINITIONS.map(a => a.id);

export const AREA_LABEL: Record<PermissionArea, string> = AREA_DEFINITIONS.reduce(
  (acc, a) => {
    acc[a.id] = a.label;
    return acc;
  },
  {} as Record<PermissionArea, string>
);

const VIEW_ONLY = new Set(AREA_DEFINITIONS.filter(a => a.viewOnly).map(a => a.id));

export const isViewOnlyArea = (area: PermissionArea): boolean => VIEW_ONLY.has(area);

// --- Abfragen ------------------------------------------------------------

export const canView = (permissions: UserPermissions, area: PermissionArea): boolean =>
  permissions[area] === 'view' || permissions[area] === 'edit';

export const canEdit = (permissions: UserPermissions, area: PermissionArea): boolean =>
  permissions[area] === 'edit' && !isViewOnlyArea(area);

// --- Vorlagen ------------------------------------------------------------

function fill(level: AccessLevel): UserPermissions {
  return ALL_AREAS.reduce((acc, area) => {
    acc[area] = isViewOnlyArea(area) && level === 'edit' ? 'view' : level;
    return acc;
  }, {} as UserPermissions);
}

export const ALL_AREAS_EDIT: UserPermissions = fill('edit');
export const ALL_AREAS_NONE: UserPermissions = fill('none');

/** Setzt einzelne Bereiche abweichend von einer Grundstufe. */
export function permissionsFrom(
  base: AccessLevel,
  overrides: Partial<Record<PermissionArea, AccessLevel>>
): UserPermissions {
  const result = fill(base);
  (Object.keys(overrides) as PermissionArea[]).forEach(area => {
    const wanted = overrides[area];
    if (!wanted) return;
    result[area] = isViewOnlyArea(area) && wanted === 'edit' ? 'view' : wanted;
  });
  return result;
}

// --- Rollenvorlagen ------------------------------------------------------

export interface RolePreset {
  id: string;
  label: string;
  description: string;
  permissions: UserPermissions;
}

/**
 * Startpunkte für die Rechtevergabe. Nach dem Anwenden lässt sich jeder
 * Bereich einzeln nachjustieren — die Vorlage ist keine feste Rolle.
 */
export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'all',
    label: 'Vorstand (alles)',
    description: 'Vollzugriff einschliesslich Einstellungen und Benutzerverwaltung',
    permissions: ALL_AREAS_EDIT
  },
  {
    id: 'finance',
    label: 'Schatzmeister/in',
    description: 'Finanzen und Mitglieder vollständig, keine Benutzerverwaltung',
    permissions: permissionsFrom('edit', { settings: 'view', users: 'none' })
  },
  {
    id: 'members',
    label: 'Mitgliederverwaltung',
    description: 'Mitglieder und Termine bearbeiten, Finanzen gesperrt',
    permissions: permissionsFrom('edit', {
      finance: 'none',
      sepa: 'none',
      invoices: 'none',
      donations: 'none',
      guv: 'none',
      finance_analytics: 'none',
      settings: 'none',
      users: 'none'
    })
  },
  {
    id: 'read_only',
    label: 'Kassenprüfer/in (nur lesen)',
    description: 'Sieht alles Prüfungsrelevante, kann nichts ändern',
    permissions: permissionsFrom('view', { users: 'none' })
  },
  {
    id: 'none',
    label: 'Kein Zugriff',
    description: 'Alle Bereiche gesperrt — als Ausgangspunkt zum einzelnen Freischalten',
    permissions: permissionsFrom('none', { dashboard: 'view' })
  }
];

// --- Übernahme aus dem alten Modell --------------------------------------

/**
 * Das frühere Modell kannte zehn Ja/Nein-Rechte ohne Bereichsbezug.
 * Gespeicherte Benutzerkonten tragen es noch, deshalb wird es hier
 * übersetzt statt verworfen.
 *
 * Grundsatz wie schon zuvor: Was nicht eindeutig verboten war, bleibt
 * erlaubt. Wer gestern Zugriff hatte, verliert ihn nicht durch ein
 * Update — einschränken kann der Vorstand jederzeit nachträglich.
 */
interface LegacyPermissions {
  canViewMembers?: boolean;
  canEditMembers?: boolean;
  canManageSurveys?: boolean;
  canViewFinances?: boolean;
  canEditFinances?: boolean;
  canExecuteSepa?: boolean;
  canManageDonations?: boolean;
  canManageContacts?: boolean;
  canManageCalendar?: boolean;
  canManageMeetings?: boolean;
  canManageDocuments?: boolean;
  canManageInventory?: boolean;
  canManageSettings?: boolean;
  canManageUsers?: boolean;
}

function looksLegacy(value: unknown): value is LegacyPermissions {
  if (!value || typeof value !== 'object') return false;
  return 'canViewMembers' in (value as object) || 'canManageUsers' in (value as object);
}

export function migrateLegacyPermissions(raw: unknown): UserPermissions {
  if (!raw || typeof raw !== 'object') return ALL_AREAS_EDIT;

  if (!looksLegacy(raw)) {
    // Bereits im neuen Format — fehlende Bereiche gelten als erlaubt.
    const given = raw as Partial<UserPermissions>;
    return ALL_AREAS.reduce((acc, area) => {
      const level = given[area];
      acc[area] =
        level === 'none' || level === 'view' || level === 'edit'
          ? isViewOnlyArea(area) && level === 'edit'
            ? 'view'
            : level
          : isViewOnlyArea(area)
            ? 'view'
            : 'edit';
      return acc;
    }, {} as UserPermissions);
  }

  const l = raw as LegacyPermissions;
  const yes = (v: boolean | undefined) => v !== false; // fehlend = erlaubt
  const level = (view: boolean, edit: boolean): AccessLevel =>
    edit ? 'edit' : view ? 'view' : 'none';

  const viewMembers = yes(l.canViewMembers);
  const editMembers = yes(l.canEditMembers);
  const viewFinances = yes(l.canViewFinances);
  const editFinances = yes(l.canEditFinances);

  return {
    dashboard: 'view',
    members: level(viewMembers, editMembers),
    online_applications: level(viewMembers, editMembers),
    member_analytics: viewMembers ? 'view' : 'none',
    member_surveys: level(yes(l.canManageSurveys), yes(l.canManageSurveys)),
    finance: level(viewFinances, editFinances),
    sepa: level(yes(l.canExecuteSepa), yes(l.canExecuteSepa)),
    invoices: level(viewFinances, editFinances),
    donations: level(yes(l.canManageDonations), yes(l.canManageDonations)),
    guv: viewFinances ? 'view' : 'none',
    finance_analytics: viewFinances ? 'view' : 'none',
    contacts: level(yes(l.canManageContacts), yes(l.canManageContacts)),
    calendar: level(yes(l.canManageCalendar), yes(l.canManageCalendar)),
    meetings: level(yes(l.canManageMeetings), yes(l.canManageMeetings)),
    inventory: level(yes(l.canManageInventory), yes(l.canManageInventory)),
    documents: level(yes(l.canManageDocuments), yes(l.canManageDocuments)),
    settings: level(yes(l.canManageSettings), yes(l.canManageSettings)),
    users: level(yes(l.canManageUsers), yes(l.canManageUsers))
  };
}
