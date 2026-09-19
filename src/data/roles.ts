import { AppUser, SecuritySettings, UserPermissions } from '../types';
import { ALL_AREAS_EDIT, permissionsFrom } from '../utils/permissions';

/** Vollzugriff auf alle Bereiche. Auswertungen bleiben lesend. */
export const FULL_PERMISSIONS: UserPermissions = ALL_AREAS_EDIT;

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-demo-admin',
    username: 'admin',
    email: 'vorstand@tsv-musterstadt1890.de',
    name: 'Dr. Michael Sommer',
    password: 'admin',
    customRoleName: '1. Vorsitzender (Admin)',
    permissions: { ...FULL_PERMISSIONS },
    isActive: true,
    createdAt: '2025-01-01T08:00:00.000Z'
  },
  {
    id: 'user-treasurer-1',
    username: 'kassierer',
    email: 'kasse@tsv-musterstadt1890.de',
    name: 'Sabine Weber',
    password: 'kasse',
    customRoleName: 'Schatzmeisterin',
    // Alles ausser Benutzerverwaltung; Einstellungen nur einsehbar.
    permissions: permissionsFrom('edit', { settings: 'view', users: 'none' }),
    isActive: true,
    createdAt: '2025-01-01T08:00:00.000Z'
  },
  {
    id: 'user-auditor-1',
    username: 'pruefer',
    email: 'pruefung@tsv-musterstadt1890.de',
    name: 'Klaus Meier',
    password: 'pruef',
    customRoleName: 'Kassenprüfer (Nur Lesen)',
    // Sieht alles Prüfungsrelevante, kann aber nichts ändern — auch keine
    // Mitglieder anlegen oder bearbeiten.
    permissions: permissionsFrom('view', { users: 'none' }),
    isActive: true,
    createdAt: '2025-01-01T08:00:00.000Z'
  }
];

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  authRequired: true,
  autoLockMinutes: 15
};
