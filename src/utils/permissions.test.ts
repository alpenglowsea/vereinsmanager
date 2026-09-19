import { describe, it, expect } from 'vitest';
import {
  ALL_AREAS,
  ALL_AREAS_EDIT,
  ALL_AREAS_NONE,
  AREA_DEFINITIONS,
  ROLE_PRESETS,
  canEdit,
  canView,
  isViewOnlyArea,
  migrateLegacyPermissions,
  permissionsFrom
} from './permissions';

describe('Bereichsdefinitionen', () => {
  it('vergibt jede Bereichskennung nur einmal', () => {
    const ids = AREA_DEFINITIONS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('beschriftet jeden Bereich', () => {
    AREA_DEFINITIONS.forEach(a => {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.group.length).toBeGreaterThan(0);
    });
  });
});

describe('canView / canEdit', () => {
  it('erlaubt Lesen bei "view" und bei "edit"', () => {
    expect(canView(permissionsFrom('view', {}), 'members')).toBe(true);
    expect(canView(permissionsFrom('edit', {}), 'members')).toBe(true);
    expect(canView(permissionsFrom('none', {}), 'members')).toBe(false);
  });

  it('erlaubt Schreiben nur bei "edit"', () => {
    expect(canEdit(permissionsFrom('view', {}), 'members')).toBe(false);
    expect(canEdit(permissionsFrom('edit', {}), 'members')).toBe(true);
  });

  it('kennt für Auswertungsbereiche kein Schreibrecht', () => {
    const all = permissionsFrom('edit', {});
    AREA_DEFINITIONS.filter(a => a.viewOnly).forEach(a => {
      expect(isViewOnlyArea(a.id)).toBe(true);
      expect(all[a.id]).toBe('view');
      expect(canEdit(all, a.id)).toBe(false);
      expect(canView(all, a.id)).toBe(true);
    });
  });

  it('stuft ein erzwungenes "edit" auf Auswertungen auf "view" zurück', () => {
    const p = permissionsFrom('none', { guv: 'edit', finance: 'edit' });
    expect(p.guv).toBe('view');
    expect(p.finance).toBe('edit');
  });
});

describe('Vorlagen', () => {
  it('sperrt bei ALL_AREAS_NONE jeden Bereich', () => {
    ALL_AREAS.forEach(area => {
      expect(canView(ALL_AREAS_NONE, area)).toBe(false);
    });
  });

  it('gibt bei ALL_AREAS_EDIT jeden Bereich frei', () => {
    ALL_AREAS.forEach(area => {
      expect(canView(ALL_AREAS_EDIT, area)).toBe(true);
    });
  });

  it('lässt den Kassenprüfer nichts bearbeiten', () => {
    const pruefer = ROLE_PRESETS.find(p => p.id === 'read_only');
    expect(pruefer).toBeDefined();
    const perms = pruefer!.permissions;
    // Der ausdrückliche Wunsch: Mitglieder ansehen ja, anlegen oder ändern nein.
    expect(canView(perms, 'members')).toBe(true);
    expect(canEdit(perms, 'members')).toBe(false);
    expect(canEdit(perms, 'finance')).toBe(false);
    expect(canEdit(perms, 'sepa')).toBe(false);
    ALL_AREAS.forEach(area => {
      expect(canEdit(perms, area)).toBe(false);
    });
  });

  it('gibt dem Schatzmeister die Finanzen, aber nicht die Benutzerverwaltung', () => {
    const kasse = ROLE_PRESETS.find(p => p.id === 'finance')!.permissions;
    expect(canEdit(kasse, 'finance')).toBe(true);
    expect(canEdit(kasse, 'sepa')).toBe(true);
    expect(canEdit(kasse, 'users')).toBe(false);
    expect(canView(kasse, 'users')).toBe(false);
    expect(canEdit(kasse, 'settings')).toBe(false);
    expect(canView(kasse, 'settings')).toBe(true);
  });

  it('gibt jede Vorlage für jeden Bereich eine Stufe an', () => {
    ROLE_PRESETS.forEach(preset => {
      ALL_AREAS.forEach(area => {
        expect(['none', 'view', 'edit']).toContain(preset.permissions[area]);
      });
    });
  });
});

describe('Übernahme alter Benutzerkonten', () => {
  it('übersetzt ein reines Leserecht auf Finanzen', () => {
    const migrated = migrateLegacyPermissions({
      canViewMembers: true,
      canEditMembers: false,
      canViewFinances: true,
      canEditFinances: false,
      canExecuteSepa: false,
      canManageDonations: false,
      canManageDocuments: true,
      canManageInventory: true,
      canManageSettings: false,
      canManageSurveys: false,
      canManageContacts: true,
      canManageCalendar: true,
      canManageMeetings: true,
      canManageUsers: false
    });
    expect(migrated.members).toBe('view');
    expect(migrated.finance).toBe('view');
    expect(migrated.sepa).toBe('none');
    expect(migrated.documents).toBe('edit');
    expect(migrated.users).toBe('none');
    expect(migrated.guv).toBe('view');
  });

  it('wertet ein fehlendes altes Recht als erlaubt', () => {
    // Wer gestern Zugriff hatte, verliert ihn nicht durch ein Update.
    const migrated = migrateLegacyPermissions({ canViewMembers: true });
    expect(migrated.members).toBe('edit');
    expect(migrated.finance).toBe('edit');
  });

  it('lässt ein Konto im neuen Format unverändert', () => {
    const neu = permissionsFrom('none', { members: 'view', finance: 'edit' });
    const migrated = migrateLegacyPermissions(neu);
    expect(migrated).toEqual(neu);
  });

  it('ergänzt fehlende Bereiche im neuen Format als erlaubt', () => {
    const migrated = migrateLegacyPermissions({ members: 'none' });
    expect(migrated.members).toBe('none');
    expect(migrated.finance).toBe('edit');
    expect(migrated.guv).toBe('view');
  });

  it('gibt ohne gespeicherte Rechte Vollzugriff zurück', () => {
    expect(migrateLegacyPermissions(undefined)).toEqual(ALL_AREAS_EDIT);
    expect(migrateLegacyPermissions(null)).toEqual(ALL_AREAS_EDIT);
  });

  it('liefert für jeden Bereich eine gültige Stufe', () => {
    const migrated = migrateLegacyPermissions({ canManageUsers: false });
    ALL_AREAS.forEach(area => {
      expect(['none', 'view', 'edit']).toContain(migrated[area]);
    });
  });
});
