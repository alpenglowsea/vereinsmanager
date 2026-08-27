import React, { useState } from 'react';
import { AppUser, SecuritySettings, UserPermissions } from '../types';
import { AuthService } from '../services/authService';
import { FULL_PERMISSIONS } from '../data/roles';
import {
  X,
  UserPlus,
  Shield,
  ShieldCheck,
  Edit3,
  Trash2,
  Lock,
  Clock,
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
  User,
  Eye,
  EyeOff,
  Sparkles,
  Key,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';

interface UserManageModalProps {
  currentUserId?: string;
  onClose: () => void;
  onUserChanged?: () => void;
}

interface PermissionItem {
  key: keyof UserPermissions;
  label: string;
  category: 'Mitglieder' | 'Finanzen & SEPA' | 'Dokumente & Inventar' | 'System & Verwaltung';
  description: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  // Mitglieder
  {
    key: 'canViewMembers',
    label: 'Mitglieder einsehen',
    category: 'Mitglieder',
    description: 'Zugriff auf Mitgliederliste, Kontaktdaten und Jubiläen'
  },
  {
    key: 'canEditMembers',
    label: 'Mitglieder anlegen & bearbeiten',
    category: 'Mitglieder',
    description: 'Neueintritte erfassen, Daten ändern und Kündigungen verarbeiten'
  },

  // Finanzen
  {
    key: 'canViewFinances',
    label: 'Finanzen & Kassenbuch einsehen',
    category: 'Finanzen & SEPA',
    description: 'Einsicht in Buchungsjournal, Kontenstände und EÜR/GuV'
  },
  {
    key: 'canEditFinances',
    label: 'Buchungen erfassen & ändern',
    category: 'Finanzen & SEPA',
    description: 'Neue Einnahmen/Ausgaben anlegen, Belege zuordnen und stornieren'
  },
  {
    key: 'canExecuteSepa',
    label: 'SEPA-Beitragslauf ausführen',
    category: 'Finanzen & SEPA',
    description: 'SEPA-Lastschrift-XML generieren und Buchungen erzeugen'
  },
  {
    key: 'canManageDonations',
    label: 'Spendenbescheinigungen ausstellen',
    category: 'Finanzen & SEPA',
    description: 'Geld- und Sachzuwendungsbestätigungen nach BMF-Muster erstellen'
  },

  // Dokumente & Inventar
  {
    key: 'canManageDocuments',
    label: 'Dokumentenarchiv & Belege verwalten',
    category: 'Dokumente & Inventar',
    description: 'Dateien hochladen, Ordner erstellen und Belege archivieren'
  },
  {
    key: 'canManageInventory',
    label: 'Inventar & Material verwalten',
    category: 'Dokumente & Inventar',
    description: 'Vereinsausstattung, Geräte und Wartungsintervalle pflegen'
  },

  // System
  {
    key: 'canManageSettings',
    label: 'Vereinseinstellungen ändern',
    category: 'System & Verwaltung',
    description: 'Stammdaten, Bankkonten, Beitragsstaffeln und Datenschutz verwalten'
  },
  {
    key: 'canManageUsers',
    label: 'Benutzerkonten & Rechte verwalten',
    category: 'System & Verwaltung',
    description: 'Benutzer anlegen, Passwörter vergeben und Berechtigungen festlegen'
  }
];

const DEFAULT_BLANK_PERMISSIONS: UserPermissions = {
  canViewMembers: true,
  canEditMembers: false,
  canViewFinances: false,
  canEditFinances: false,
  canExecuteSepa: false,
  canManageDonations: false,
  canManageDocuments: false,
  canManageInventory: false,
  canManageSettings: false,
  canManageUsers: false
};

export const UserManageModal: React.FC<UserManageModalProps> = ({
  currentUserId,
  onClose,
  onUserChanged
}) => {
  const [users, setUsers] = useState<AppUser[]>(() => AuthService.getUsers());
  const [security, setSecurity] = useState<SecuritySettings>(() => AuthService.getSecuritySettings());
  const [activeTab, setActiveTab] = useState<'users' | 'security'>('users');

  // Editor State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form Fields
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formCustomRoleName, setFormCustomRoleName] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>({ ...DEFAULT_BLANK_PERMISSIONS });
  const [showPassword, setShowPassword] = useState(false);

  // Status Message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const reloadUsers = () => {
    const updated = AuthService.getUsers();
    setUsers(updated);
    if (onUserChanged) onUserChanged();
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingUserId(null);
    setFormUsername('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormCustomRoleName('Mitarbeiter');
    setFormIsActive(true);
    setFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS, canViewMembers: true });
    setShowPassword(false);
  };

  const startEdit = (user: AppUser) => {
    setIsCreating(false);
    setEditingUserId(user.id);
    setFormUsername(user.username);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(user.password || '');
    setFormCustomRoleName(user.customRoleName || '');
    setFormIsActive(user.isActive);
    setFormPermissions({
      ...DEFAULT_BLANK_PERMISSIONS,
      ...(user.permissions || {})
    });
    setShowPassword(false);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingUserId(null);
  };

  // Toggle single permission
  const togglePermission = (key: keyof UserPermissions) => {
    setFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Quick Preset Handlers
  const applyPreset = (preset: 'all' | 'finance' | 'read_only' | 'members' | 'none') => {
    switch (preset) {
      case 'all':
        setFormPermissions({ ...FULL_PERMISSIONS });
        break;
      case 'finance':
        setFormPermissions({
          canViewMembers: true,
          canEditMembers: true,
          canViewFinances: true,
          canEditFinances: true,
          canExecuteSepa: true,
          canManageDonations: true,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'read_only':
        setFormPermissions({
          canViewMembers: true,
          canEditMembers: false,
          canViewFinances: true,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'members':
        setFormPermissions({
          canViewMembers: true,
          canEditMembers: true,
          canViewFinances: false,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: true,
          canManageInventory: true,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'none':
        setFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS });
        break;
    }
  };

  // Save User
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const cleanUsername = formUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setStatusMsg({ type: 'error', text: 'Bitte einen Benutzernamen angeben.' });
      return;
    }

    if (!formName.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte den vollständigen Namen angeben.' });
      return;
    }

    // Check username uniqueness
    const existing = users.find(u => u.username.toLowerCase() === cleanUsername && u.id !== editingUserId);
    if (existing) {
      setStatusMsg({ type: 'error', text: `Der Benutzername "${cleanUsername}" ist bereits vergeben.` });
      return;
    }

    if (isCreating && !formPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'Bitte vergeben Sie ein Passwort für den neuen Benutzer.' });
      return;
    }

    const userToSave: AppUser = {
      id: editingUserId || `user-${Date.now()}`,
      username: cleanUsername,
      name: formName.trim(),
      email: formEmail.trim(),
      password: formPassword.trim(),
      customRoleName: formCustomRoleName.trim() || 'Benutzer',
      isActive: formIsActive,
      permissions: { ...formPermissions },
      createdAt: editingUserId ? (users.find(u => u.id === editingUserId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    AuthService.saveUser(userToSave);
    reloadUsers();
    cancelEdit();
    setStatusMsg({ type: 'success', text: `Benutzer "${userToSave.name}" erfolgreich gespeichert.` });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Delete User
  const handleDeleteUser = (user: AppUser) => {
    if (users.length <= 1) {
      alert('Der letzte verbleibende Benutzer kann nicht gelöscht werden.');
      return;
    }
    if (user.id === currentUserId) {
      alert('Sie können Ihr eigenes aktuell angemeldetes Benutzerkonto nicht löschen.');
      return;
    }
    if (window.confirm(`Benutzer "${user.name}" (${user.username}) wirklich unwiderruflich löschen?`)) {
      AuthService.deleteUser(user.id);
      reloadUsers();
      setStatusMsg({ type: 'success', text: `Benutzer "${user.name}" wurde gelöscht.` });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Toggle Active state
  const handleToggleActive = (user: AppUser) => {
    if (user.id === currentUserId && user.isActive) {
      alert('Sie können Ihr eigenes aktives Benutzerkonto nicht deaktivieren.');
      return;
    }
    const updated: AppUser = {
      ...user,
      isActive: !user.isActive,
      updatedAt: new Date().toISOString()
    };
    AuthService.saveUser(updated);
    reloadUsers();
  };

  // Save Security Settings
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    AuthService.saveSecuritySettings(security);
    setStatusMsg({ type: 'success', text: 'Sicherheitseinstellungen erfolgreich aktualisiert.' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Count active permissions for summary
  const countPermissions = (perms: UserPermissions) => {
    return Object.values(perms || {}).filter(Boolean).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-slate-200 my-6 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Benutzer & Rechteverwaltung
              </h2>
              <p className="text-xs text-slate-500">
                Individuelle Zugriffsrechte pro Benutzer festlegen und verwalten
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-3 pt-2 text-xs font-semibold text-slate-600 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('users'); cancelEdit(); }}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Benutzerkonten & Rechte ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('security'); cancelEdit(); }}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'security' ? 'border-blue-600 text-blue-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Sitzungssperre & Anmeldeschutz</span>
          </button>
        </div>

        {/* Notifications */}
        {statusMsg && (
          <div className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: USERS & PERMISSIONS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* If creating or editing a user, show the full editor */}
              {(isCreating || editingUserId) ? (
                <form onSubmit={handleSaveUser} className="space-y-6 bg-slate-50/80 border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <User className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {isCreating ? 'Neuen Benutzer anlegen' : `Benutzer bearbeiten: ${formName || formUsername}`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>

                  {/* Basic User Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Benutzername (für Login) *
                      </label>
                      <input
                        type="text"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="z. B. schatzmeister oder m.sommer"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Passwort *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder="Passwort eingeben..."
                          required={isCreating}
                          className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vollständiger Name *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="z. B. Sabine Weber"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bezeichnung / Funktion
                      </label>
                      <input
                        type="text"
                        value={formCustomRoleName}
                        onChange={(e) => setFormCustomRoleName(e.target.value)}
                        placeholder="z. B. Schatzmeisterin, Kassenprüfer, Geschäftsstelle"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-Mail-Adresse (optional)
                      </label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="kontakt@verein.de"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-slate-200 rounded-xl w-full">
                        <input
                          type="checkbox"
                          checked={formIsActive}
                          onChange={(e) => setFormIsActive(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          Benutzerkonto ist aktiv (Login möglich)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Granular Permissions Section */}
                  <div className="space-y-4 pt-3 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          Individuelle Zugriffsrechte für diesen Benutzer
                        </h4>
                        <p className="text-2xs text-slate-500">
                          Keine starren Rollen – wählen Sie genau die Module, die dieser Benutzer sehen oder bearbeiten darf.
                        </p>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-2xs text-slate-400 font-bold mr-1">Schnellwahl:</span>
                        <button
                          type="button"
                          onClick={() => applyPreset('all')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-2xs font-semibold transition-colors cursor-pointer"
                        >
                          Vollzugriff
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('finance')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-2xs font-semibold transition-colors cursor-pointer"
                        >
                          Finanzen & Kasse
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('read_only')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-2xs font-semibold transition-colors cursor-pointer"
                        >
                          Prüfer (Nur Lesen)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('members')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-2xs font-semibold transition-colors cursor-pointer"
                        >
                          Mitglieder
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('none')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-rose-600 border border-slate-200 rounded text-2xs font-semibold transition-colors cursor-pointer"
                        >
                          Alle abwählen
                        </button>
                      </div>
                    </div>

                    {/* Permissions Grid Grouped by Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(['Mitglieder', 'Finanzen & SEPA', 'Dokumente & Inventar', 'System & Verwaltung'] as const).map(cat => {
                        const items = PERMISSION_ITEMS.filter(p => p.category === cat);
                        return (
                          <div key={cat} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                            <div className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
                              {cat}
                            </div>
                            <div className="space-y-2">
                              {items.map(item => {
                                const isChecked = Boolean(formPermissions[item.key]);
                                return (
                                  <label
                                    key={item.key}
                                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                      isChecked ? 'bg-blue-50/60 border border-blue-200/60' : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(item.key)}
                                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 leading-tight">
                                        {item.label}
                                      </div>
                                      <div className="text-2xs text-slate-500 mt-0.5 leading-snug">
                                        {item.description}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      {isCreating ? 'Benutzer erstellen' : 'Änderungen speichern'}
                    </button>
                  </div>
                </form>
              ) : (
                /* User List Table */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Vorhandene Benutzerkonten
                      </h3>
                      <p className="text-xs text-slate-500">
                        Klicken Sie auf einen Benutzer, um Passwörter oder individuelle Berechtigungen anzupassen.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCreate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Neuen Benutzer anlegen</span>
                    </button>
                  </div>

                  {/* List of Users */}
                  <div className="space-y-3">
                    {users.map(user => {
                      const permCount = countPermissions(user.permissions);
                      const isCurrent = user.id === currentUserId;

                      return (
                        <div
                          key={user.id}
                          onClick={() => startEdit(user)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                            user.isActive
                              ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                              : 'bg-slate-50/60 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Left User Details */}
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform ${
                                user.permissions.canManageUsers
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : user.permissions.canEditFinances
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {user.name}
                                  </span>
                                  {user.customRoleName && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-2xs font-semibold border border-slate-200">
                                      {user.customRoleName}
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-2xs font-bold">
                                      Sie (Aktuell)
                                    </span>
                                  )}
                                  {!user.isActive && (
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-2xs font-bold">
                                      Deaktiviert
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                                  <span>Login: <strong>{user.username}</strong></span>
                                  {user.email && <span className="hidden sm:inline">• {user.email}</span>}
                                </div>

                                {/* Permissions Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                  <span className="text-2xs text-slate-400 font-medium mr-1">
                                    Rechte ({permCount}/10):
                                  </span>
                                  {user.permissions.canManageUsers && (
                                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-2xs font-semibold">
                                      Admin / Benutzer
                                    </span>
                                  )}
                                  {user.permissions.canEditFinances && (
                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-2xs font-semibold">
                                      Kassenbuch & Buchungen
                                    </span>
                                  )}
                                  {user.permissions.canExecuteSepa && (
                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-2xs font-semibold">
                                      SEPA
                                    </span>
                                  )}
                                  {user.permissions.canEditMembers && (
                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-2xs font-semibold">
                                      Mitglieder
                                    </span>
                                  )}
                                  {user.permissions.canManageDonations && (
                                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-2xs font-semibold">
                                      Spenden
                                    </span>
                                  )}
                                  {!user.permissions.canEditFinances && user.permissions.canViewFinances && (
                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-2xs font-semibold">
                                      Kassenprüfung (Lesen)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right Action Buttons */}
                            <div
                              className="flex items-center gap-2 self-end sm:self-center shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => startEdit(user)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200 cursor-pointer shadow-2xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Rechte bearbeiten</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleActive(user)}
                                disabled={isCurrent && user.isActive}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                                  user.isActive
                                    ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                } disabled:opacity-30`}
                                title={user.isActive ? 'Konto sperren' : 'Konto reaktivieren'}
                              >
                                {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isCurrent || users.length <= 1}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 disabled:opacity-20 cursor-pointer"
                                title="Benutzer löschen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SECURITY & SESSION LOCK */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Globale Anmelde- und Sitzungssicherheit
                  </h3>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Auth Required Toggle */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={security.authRequired}
                      onChange={(e) => setSecurity(prev => ({ ...prev, authRequired: e.target.checked }))}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Anmeldeschutz aktivieren (Passwort-Login beim Start)
                      </div>
                      <div className="text-2xs text-slate-500 mt-0.5">
                        Wenn aktiviert, wird vor dem Öffnen der Vereinsdaten immer der Login-Bildschirm angezeigt.
                      </div>
                    </div>
                  </label>

                  {/* Auto Lock Timer */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <label className="text-xs font-bold text-slate-800">
                        Automatische Sitzungssperre bei Inaktivität
                      </label>
                    </div>
                    <p className="text-2xs text-slate-500">
                      Sperrt das System automatisch, wenn für eine bestimmte Zeit keine Tastatur- oder Mauseingabe erfolgt.
                    </p>
                    <select
                      value={security.autoLockMinutes}
                      onChange={(e) => setSecurity(prev => ({ ...prev, autoLockMinutes: Number(e.target.value) }))}
                      className="w-full sm:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600"
                    >
                      <option value="0">Deaktiviert (Keine automatische Sperre)</option>
                      <option value="5">Nach 5 Minuten Inaktivität</option>
                      <option value="15">Nach 15 Minuten Inaktivität (Empfohlen)</option>
                      <option value="30">Nach 30 Minuten Inaktivität</option>
                      <option value="60">Nach 60 Minuten Inaktivität</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Sicherheitseinstellungen speichern
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500 shrink-0">
          <span>Rechteverwaltung wird sofort im Browser bzw. in der Datenbank gespeichert.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
