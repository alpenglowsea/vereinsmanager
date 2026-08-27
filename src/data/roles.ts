import { AppUser, SecuritySettings, UserPermissions } from '../types';

export const FULL_PERMISSIONS: UserPermissions = {
  canViewMembers: true,
  canEditMembers: true,
  canViewFinances: true,
  canEditFinances: true,
  canExecuteSepa: true,
  canManageDonations: true,
  canManageDocuments: true,
  canManageInventory: true,
  canManageSettings: true,
  canManageUsers: true,
  canManageCalendar: true
};

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
    permissions: {
      canViewMembers: true,
      canEditMembers: true,
      canViewFinances: true,
      canEditFinances: true,
      canExecuteSepa: true,
      canManageDonations: true,
      canManageDocuments: true,
      canManageInventory: true,
      canManageSettings: false,
      canManageUsers: false,
      canManageCalendar: true
    },
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
    permissions: {
      canViewMembers: true,
      canEditMembers: false,
      canViewFinances: true,
      canEditFinances: false,
      canExecuteSepa: false,
      canManageDonations: false,
      canManageDocuments: true,
      canManageInventory: true,
      canManageSettings: false,
      canManageUsers: false,
      canManageCalendar: true
    },
    isActive: true,
    createdAt: '2025-01-01T08:00:00.000Z'
  }
];

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  authRequired: true,
  autoLockMinutes: 15
};
