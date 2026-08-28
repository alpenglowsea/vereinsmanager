import React, { useState, useEffect } from 'react';
import { ClubSettings, AppUser, UserPermissions } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { FULL_PERMISSIONS } from '../data/roles';
import paypalQrImage from '../assets/paypal-original.jpg';
import {
  Settings,
  Building,
  Database,
  Globe,
  Users,
  Shield,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Lock,
  CreditCard,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Edit3,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  UserCheck,
  UserX,
  Sparkles,
  Server,
  HardDrive,
  Cloud,
  CheckCheck,
  Mail,
  Phone,
  Calendar,
  Layers,
  Heart,
  ExternalLink,
  Copy,
  Coffee,
  QrCode,
  ZoomIn,
  X,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';

interface SettingsViewProps {
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onDataReload?: () => void;
  onOpenDeploymentHub?: () => void;
  onOpenUserManage?: () => void;
  currentTheme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
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
    description: 'Stammdaten, Bankkonten, Beitragsstaffeln und Systemoptionen verwalten'
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

type SettingsTab = 'general' | 'club' | 'users' | 'backup' | 'deployment' | 'support';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDataReload,
  onOpenDeploymentHub,
  currentTheme,
  onThemeChange
}) => {
  // Tab sequence:
  // 1. Allgemeine Einstellungen
  // 2. Vereinsstammdaten
  // 3. Benutzer & Rechte
  // 4. Datensicherung und Import
  // 5. Betriebsmodi
  // 6. Projekt unterstützen
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Form State for Club & General Settings
  const [formData, setFormData] = useState<ClubSettings>({
    ...settings,
    currency: settings.currency || 'EUR',
    dateFormat: settings.dateFormat || 'DD.MM.YYYY',
    fiscalYearStart: settings.fiscalYearStart || '01-01',
    theme: currentTheme || settings.theme || 'light'
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ...settings,
      currency: settings.currency || prev.currency || 'EUR',
      dateFormat: settings.dateFormat || prev.dateFormat || 'DD.MM.YYYY',
      fiscalYearStart: settings.fiscalYearStart || prev.fiscalYearStart || '01-01',
      theme: currentTheme || settings.theme || prev.theme || 'light'
    }));
  }, [settings, currentTheme]);

  const [newDepartment, setNewDepartment] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>(() => AuthService.getUsers());
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // User In-Place Editing State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormRole, setUserFormRole] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormPermissions, setUserFormPermissions] = useState<UserPermissions>({ ...DEFAULT_BLANK_PERMISSIONS });
  const [userFormIsActive, setUserFormIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const startEditUser = (user: AppUser) => {
    setEditingUserId(user.id);
    setIsCreatingUser(false);
    setUserFormUsername(user.username);
    setUserFormName(user.name);
    setUserFormEmail(user.email || '');
    setUserFormRole(user.customRoleName || '');
    setUserFormPassword('');
    setUserFormPermissions({ ...user.permissions });
    setUserFormIsActive(user.isActive !== false);
    setShowPassword(false);
    setUserMsg(null);
  };

  const startCreateUser = () => {
    setEditingUserId(null);
    setIsCreatingUser(true);
    setUserFormUsername('');
    setUserFormName('');
    setUserFormEmail('');
    setUserFormRole('');
    setUserFormPassword('');
    setUserFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS });
    setUserFormIsActive(true);
    setShowPassword(false);
    setUserMsg(null);
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setIsCreatingUser(false);
    setUserMsg(null);
  };

  const toggleUserPermission = (key: keyof UserPermissions) => {
    setUserFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyPreset = (preset: 'all' | 'finance' | 'read_only' | 'members' | 'none') => {
    switch (preset) {
      case 'all':
        setUserFormPermissions({ ...FULL_PERMISSIONS });
        break;
      case 'finance':
        setUserFormPermissions({
          canViewMembers: true,
          canEditMembers: false,
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
        setUserFormPermissions({
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
        setUserFormPermissions({
          canViewMembers: true,
          canEditMembers: true,
          canViewFinances: false,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: true,
          canManageInventory: false,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
      case 'none':
        setUserFormPermissions({ ...DEFAULT_BLANK_PERMISSIONS });
        break;
    }
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormUsername.trim() || !userFormName.trim()) {
      setUserMsg({ type: 'error', text: 'Benutzername und vollständiger Name sind Pflichtfelder.' });
      return;
    }

    if (isCreatingUser) {
      if (!userFormPassword.trim()) {
        setUserMsg({ type: 'error', text: 'Bitte vergeben Sie ein initiales Passwort für das neue Konto.' });
        return;
      }
      try {
        const newUser: AppUser = {
          id: `user-${Date.now()}`,
          username: userFormUsername.trim().toLowerCase(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword.trim(),
          customRoleName: userFormRole.trim() || 'Benutzer',
          permissions: userFormPermissions,
          isActive: userFormIsActive,
          createdAt: new Date().toISOString()
        };
        AuthService.saveUser(newUser);
        setUsersList(AuthService.getUsers());
        setIsCreatingUser(false);
        setUserMsg({ type: 'success', text: `Benutzer "${userFormName}" erfolgreich angelegt.` });
        setTimeout(() => setUserMsg(null), 3500);
        onDataReload?.();
      } catch (err: any) {
        setUserMsg({ type: 'error', text: err.message || 'Fehler beim Anlegen des Benutzers.' });
      }
    } else if (editingUserId) {
      try {
        const existing = usersList.find(u => u.id === editingUserId);
        const updatedUser: AppUser = {
          id: editingUserId,
          username: userFormUsername.trim().toLowerCase(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword.trim() || (existing?.password || ''),
          customRoleName: userFormRole.trim() || 'Benutzer',
          permissions: userFormPermissions,
          isActive: userFormIsActive,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        AuthService.saveUser(updatedUser);
        setUsersList(AuthService.getUsers());
        setEditingUserId(null);
        setUserMsg({ type: 'success', text: `Benutzer "${userFormName}" erfolgreich aktualisiert.` });
        setTimeout(() => setUserMsg(null), 3500);
        onDataReload?.();
      } catch (err: any) {
        setUserMsg({ type: 'error', text: err.message || 'Fehler beim Aktualisieren des Benutzers.' });
      }
    }
  };

  const handleDeleteUser = (user: AppUser) => {
    if (usersList.length <= 1) {
      alert('Der letzte verbleibende Administrator kann nicht gelöscht werden.');
      return;
    }
    if (window.confirm(`Benutzerkonto "${user.name}" (${user.username}) wirklich unwiderruflich löschen?`)) {
      AuthService.deleteUser(user.id);
      setUsersList(AuthService.getUsers());
      if (editingUserId === user.id) {
        setEditingUserId(null);
      }
      setUserMsg({ type: 'success', text: `Benutzer "${user.name}" wurde gelöscht.` });
      setTimeout(() => setUserMsg(null), 3000);
      onDataReload?.();
    }
  };

  const handleSaveClub = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setStatusMsg({ type: 'success', text: 'Einstellungen & Vereinsstammdaten wurden erfolgreich gespeichert.' });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Bitte laden Sie eine Bilddatei hoch (PNG, JPG, SVG, WebP).' });
      setTimeout(() => setStatusMsg(null), 3500);
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'Das Logo darf maximal 5 MB groß sein.' });
      setTimeout(() => setStatusMsg(null), 3500);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const updated = { ...formData, clubLogoUrl: result };
        setFormData(updated);
        onSaveSettings(updated);
        setStatusMsg({ type: 'success', text: 'Vereinslogo erfolgreich hochgeladen & als App-Logo übernommen!' });
        setTimeout(() => setStatusMsg(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    const updated = { ...formData, clubLogoUrl: undefined };
    setFormData(updated);
    onSaveSettings(updated);
    setStatusMsg({ type: 'success', text: 'Vereinslogo entfernt. Standard App-Logo wird wieder verwendet.' });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    if (formData.departments.includes(newDepartment.trim())) return;
    const updatedDepts = [...formData.departments, newDepartment.trim()];
    setFormData(prev => ({
      ...prev,
      departments: updatedDepts
    }));
    setNewDepartment('');
  };

  const handleRemoveDepartment = (dept: string) => {
    if (formData.departments.length <= 1) {
      alert('Mindestens eine Sparte/Abteilung muss vorhanden sein.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== dept)
    }));
  };

  // Full Backup Export
  const handleExportBackup = async () => {
    try {
      const json = await StorageService.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `VereinsManager_Sicherung_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMsg({ type: 'success', text: 'Komplette Datensicherung erfolgreich heruntergeladen.' });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Fehler beim Erstellen der Sicherung.' });
    }
  };

  // Full Backup Import
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Achtung: Durch das Einspielen der Sicherung werden die aktuellen lokalen Daten überschrieben. Fortfahren?')) {
      return;
    }

    try {
      const text = await file.text();
      const result = await StorageService.importFullBackup(text);
      onDataReload?.();
      setStatusMsg({
        type: 'success',
        text: `Sicherung erfolgreich wiederhergestellt (${result.membersCount} Mitglieder, ${result.transactionsCount} Buchungen).`
      });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Fehler beim Import: ${err.message || 'Ungültige Datei'}` });
    }
  };

  // Reset to Demo
  const handleResetToDemo = async () => {
    if (window.confirm('Möchten Sie die Datenbank wirklich auf die Muster-Vereinsdaten zurücksetzen?')) {
      await StorageService.resetToDemoData();
      onDataReload?.();
      setStatusMsg({ type: 'success', text: 'Muster-Vereinsdaten wurden erfolgreich geladen.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Wipe All
  const handleWipeAll = async () => {
    if (window.confirm('ACHTUNG: Möchten Sie wirklich ALLE Mitglieder, Buchungen und Konten löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      await StorageService.clearAllData();
      onDataReload?.();
      setStatusMsg({ type: 'success', text: 'Alle lokalen Daten wurden gelöscht.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Theme selection handler
  const handleSelectTheme = (theme: 'light' | 'dark' | 'system') => {
    onThemeChange(theme);
    setFormData(prev => ({ ...prev, theme }));
    onSaveSettings({ ...formData, theme });
    setStatusMsg({
      type: 'success',
      text: `Designmodus auf "${theme === 'dark' ? 'Dunkel (Dark Mode)' : theme === 'light' ? 'Hell (Light Mode)' : 'System'}" gesetzt.`
    });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl shadow-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Systemeinstellungen
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Konfigurieren Sie Erscheinungsbild, Vereinsstammdaten, Zugriffsrechte, Backups und Betriebsmodi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Schnell-Backup</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with exact requested sequence */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 pt-6 text-xs font-bold text-slate-600 dark:text-slate-400">
          {/* 1. Allgemeine Einstellungen */}
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>1. Allgemeine Einstellungen</span>
          </button>

          {/* 2. Vereinsstammdaten */}
          <button
            type="button"
            onClick={() => setActiveTab('club')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'club'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>2. Vereinsstammdaten</span>
          </button>

          {/* 3. Benutzer & Rechte */}
          <button
            type="button"
            onClick={() => {
              setUsersList(AuthService.getUsers());
              setActiveTab('users');
            }}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Benutzer & Rechte</span>
          </button>

          {/* 4. Datensicherung und Import */}
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>4. Datensicherung und Import</span>
          </button>

          {/* 5. Betriebsmodi */}
          <button
            type="button"
            onClick={() => setActiveTab('deployment')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'deployment'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>5. Betriebsmodi</span>
          </button>

          {/* 6. Projekt unterstützen */}
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`pb-3.5 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'support'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 dark:border-rose-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === 'support' ? 'text-rose-500 fill-rose-500' : 'text-rose-400'}`} />
            <span>6. Projekt unterstützen</span>
          </button>
        </div>
      </div>

      {/* Status & Feedback Toast Message */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* TAB 1: ALLGEMEINE EINSTELLUNGEN (inkl. Dark Mode Funktion) */}
      {activeTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Dark Mode & Erscheinungsbild Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800/60">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Erscheinungsbild & Dark Mode
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Wählen Sie zwischen hellem Modus, augenfreundlichem Dunkelmodus oder automatischer Anpassung.
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Theme Choice Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Light Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'light'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <Sun className="w-4 h-4" />
                    </div>
                    {currentTheme === 'light' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Heller Modus (Light)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Klassisches helles Design mit klaren Kontrasten, optimal für helle Räume und Tageslicht.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Standard-Ansicht</span>
                </div>
              </button>

              {/* Dark Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'dark'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl">
                      <Moon className="w-4 h-4" />
                    </div>
                    {currentTheme === 'dark' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Dunkler Modus (Dark)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Augenschonendes Nacht-Design mit tiefen Schieferfarben für ermüdungsfreies Arbeiten.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Augenschonend</span>
                </div>
              </button>

              {/* System Theme */}
              <button
                type="button"
                onClick={() => handleSelectTheme('system')}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  currentTheme === 'system'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl">
                      <Laptop className="w-4 h-4" />
                    </div>
                    {currentTheme === 'system' && (
                      <span className="p-1 bg-blue-600 text-white rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    System-Standard (Auto)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                    Übernimmt automatisch die Hell-/Dunkel-Einstellung Ihres Betriebssystems oder Browsers.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Automatisch synchron</span>
                </div>
              </button>
            </div>
          </div>

          {/* General Preferences & Form */}
          <form onSubmit={handleSaveClub} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Regionale Anzeige & Standardeinstellungen
                </h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Währung, Datumsformate und Standardwerte für die tägliche Vereinsarbeit.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hauptwährung
                </label>
                <select
                  value={formData.currency || 'EUR'}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EUR">Euro (€ - EUR)</option>
                  <option value="CHF">Schweizer Franken (CHF)</option>
                  <option value="USD">US Dollar ($ - USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Datumsformat
                </label>
                <select
                  value={formData.dateFormat || 'DD.MM.YYYY'}
                  onChange={e => setFormData({ ...formData, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD.MM.YYYY">TT.MM.JJJJ (z.B. 28.08.2026)</option>
                  <option value="YYYY-MM-DD">JJJJ-MM-TT (z.B. 2026-08-28)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Geschäftsjahresbeginn
                </label>
                <select
                  value={formData.fiscalYearStart || '01-01'}
                  onChange={e => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="01-01">01. Januar (Kalenderjahr)</option>
                  <option value="07-01">01. Juli (Saisonjahr Sport)</option>
                  <option value="10-01">01. Oktober (Herbststart)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Zentrale Kontakt-E-Mail
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kontakt@tsv-musterstadt.de"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Telefonnummer Geschäftsstelle
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+49 (0) 1234 56789"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vereins-Website
                </label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.tsv-musterstadt1890.de"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Allgemeine Einstellungen speichern
              </button>
            </div>
          </form>

          {/* System & Architecture Info */}
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-5 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Lokale Datenbank & Revisionssicherheit</span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
              VereinsManager arbeitet standardmäßig vollkommen autark und offline-fähig in der verschlüsselten Browser-IndexedDB Ihres Rechners. Revisionssichere Änderungsprotokolle für Mitglieder und Buchungen werden lokal mitgeführt.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: VEREINSSTAMMDATEN */}
      {activeTab === 'club' && (
        <form onSubmit={handleSaveClub} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Offizielle Vereinsstammdaten
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Diese Angaben erscheinen auf Anträgen, Spendenquittungen, Rechnungen und im SEPA-Lastschriftlauf.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vereinslogo Upload Box */}
            <div className="col-span-1 md:col-span-2 p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  {/* Logo Preview Avatar */}
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
                    <img
                      src={formData.clubLogoUrl || '/logo_transparent.png'}
                      alt="Vereinslogo Vorschau"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                          e.currentTarget.src = '/logo_transparent.png';
                        }
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Vereinswappen & Logo
                      </h4>
                      {formData.clubLogoUrl ? (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-300/60 dark:border-emerald-800/60">
                          Eigenes Logo aktiv
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-800/60">
                          Standard-Logo
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                      Ersetzt das Standard-Logo oben links in der Menüleiste neben dem Schriftzug „VereinsManager“. Unterstützt PNG, JPG, SVG und WebP (max. 5 MB).
                    </p>
                  </div>
                </div>

                {/* Upload & Remove Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formData.clubLogoUrl ? 'Logo ändern' : 'Logo hochladen'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.clubLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Eigenes Logo entfernen & Standard wiederherstellen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Entfernen</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Offizieller Vereinsname *
              </label>
              <input
                type="text"
                required
                value={formData.clubName}
                onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. TSV Musterstadt 1890 e.V."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vereinsregisternummer (VR-Nr.)
              </label>
              <input
                type="text"
                value={formData.associationNumber}
                onChange={e => setFormData({ ...formData, associationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. VR 48219 Amtsgericht Musterstadt"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Steuernummer (Finanzamt)
              </label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={e => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 112/5840/1922"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Zuständiges Finanzamt
              </label>
              <input
                type="text"
                value={formData.taxOffice || ''}
                onChange={e => setFormData({ ...formData, taxOffice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Finanzamt Musterstadt"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Datum Freistellungsbescheid (Gemeinnützigkeit)
              </label>
              <input
                type="text"
                value={formData.taxExemptionDate || ''}
                onChange={e => setFormData({ ...formData, taxExemptionDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 15.03.2024"
              />
            </div>

            {/* SEPA Creditor & Banking Box */}
            <div className="col-span-1 md:col-span-2 p-4 sm:p-5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300">
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>SEPA-Gläubiger- & Vereinskonto-Stammdaten (für Lastschriften)</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Diese Angaben werden als Gläubiger (Creditor) in die offiziellen SEPA XML-Dateien (pain.008) für Ihre Bank eingebettet.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gläubiger-ID (CI) *
                  </label>
                  <input
                    type="text"
                    value={formData.creditorId}
                    onChange={e => setFormData({ ...formData, creditorId: e.target.value.toUpperCase().trim() })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="DE98ZZZ09999999999"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vereins-IBAN (Gutschrift) *
                  </label>
                  <input
                    type="text"
                    value={formData.creditorIban || ''}
                    onChange={e => setFormData({ ...formData, creditorIban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="DE02 1203 0000 0012 3456 78"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vereins-BIC / SWIFT
                  </label>
                  <input
                    type="text"
                    value={formData.creditorBic || ''}
                    onChange={e => setFormData({ ...formData, creditorBic: e.target.value.toUpperCase().trim() })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="BYLADEM1001"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vereinsanschrift (Straße, Hausnr., PLZ, Ort)
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Sportplatzweg 12, 12345 Musterstadt"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1. Vorsitzender / Vertretungsberechtigter Vorstand
              </label>
              <input
                type="text"
                value={formData.chairman}
                onChange={e => setFormData({ ...formData, chairman: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. Michael Sommer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Schatzmeister / Kassenwart
              </label>
              <input
                type="text"
                value={formData.treasurer}
                onChange={e => setFormData({ ...formData, treasurer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Sabine Weber"
              />
            </div>
          </div>

          {/* Department configuration */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Abteilungen & Sparten ({formData.departments.length})
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.departments.map(dept => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
                >
                  <span>{dept}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDepartment(dept)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={newDepartment}
                onChange={e => setNewDepartment(e.target.value)}
                placeholder="Neue Sparte hinzufügen (z.B. Badminton)"
                className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDepartment();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddDepartment}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Hinzufügen
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Vereinsstammdaten speichern
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BENUTZER & RECHTE */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Feedback Alert if present */}
          {userMsg && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in ${
                userMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              {userMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{userMsg.text}</span>
            </div>
          )}

          {/* In-Place User Editor Form */}
          {(isCreatingUser || editingUserId) ? (
            <form
              onSubmit={handleSaveUserForm}
              className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 rounded-3xl p-6 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xs">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {isCreatingUser
                        ? 'Neues Vereinskonto anlegen'
                        : `Rechte & Daten bearbeiten: ${userFormName || userFormUsername}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Passen Sie Zugriffsrechte, Zugangsdaten und Rollenbezeichnung für dieses Vorstandsmitglied an.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>

              {/* User Data Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vollständiger Name *
                  </label>
                  <input
                    type="text"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    placeholder="z. B. Sabine Weber"
                    required
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Benutzername (Login) *
                  </label>
                  <input
                    type="text"
                    value={userFormUsername}
                    onChange={(e) => setUserFormUsername(e.target.value)}
                    placeholder="z. B. s.weber oder schatzmeister"
                    required
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Funktion / Rollenbezeichnung
                  </label>
                  <input
                    type="text"
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value)}
                    placeholder="z. B. Schatzmeisterin, Kassenprüfer, Geschäftsstelle"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isCreatingUser ? 'Passwort *' : 'Neues Passwort (leer lassen = unverändert)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      placeholder={isCreatingUser ? 'Sicheres Passwort vergeben...' : 'Nur ausfüllen bei Änderung'}
                      required={isCreatingUser}
                      className="w-full px-3.5 py-2 pr-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail-Adresse (optional)
                  </label>
                  <input
                    type="email"
                    value={userFormEmail}
                    onChange={(e) => setUserFormEmail(e.target.value)}
                    placeholder="kontakt@verein.de"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-3 cursor-pointer bg-slate-50 dark:bg-slate-800 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl w-full hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={userFormIsActive}
                      onChange={(e) => setUserFormIsActive(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Konto aktiv</span>
                      <span className="text-2xs text-slate-500 dark:text-slate-400">Benutzer kann sich am System anmelden</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 1-Click Role Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    1-Klick Rollen-Vorlagen:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Admin (Vollzugriff)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('finance')}
                      className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Kassenwart (Finanzen & SEPA)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('members')}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Mitgliederwart (Pflege)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('read_only')}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Kassenprüfer (Nur Lesen)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('none')}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Granulare Funktionsberechtigungen:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PERMISSION_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        userFormPermissions[item.key]
                          ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={userFormPermissions[item.key]}
                        onChange={() => toggleUserPermission(item.key)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold leading-tight">
                          {item.label}
                        </div>
                        <div className="text-2xs opacity-75 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  {isCreatingUser ? 'Konto anlegen' : 'Änderungen speichern'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Vereinsbenutzer & Rollenverwaltung
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verwalten Sie Login-Zugänge für Vorstände, Abteilungsleiter, Kassenprüfer und Mitarbeiter.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startCreateUser}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Neuen Benutzer anlegen</span>
                </button>
              </div>

              {/* Users List */}
              <div className="space-y-3">
                {usersList.map((user) => {
                  const permCount = Object.values(user.permissions).filter(Boolean).length;
                  const isFullAdmin = user.permissions.canManageUsers && user.permissions.canManageSettings;

                  return (
                    <div
                      key={user.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                          isFullAdmin
                            ? 'bg-rose-600 text-white'
                            : user.permissions.canEditFinances
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {user.name}
                            </span>
                            {user.isActive === false && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Inaktiv
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-white dark:bg-slate-700 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600 text-2xs text-slate-700 dark:text-slate-300">
                              {user.username}
                            </span>
                            {user.customRoleName && (
                              <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                                • {user.customRoleName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                          {isFullAdmin ? 'Vollzugriff (Admin)' : `${permCount} Rechte aktiv`}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                          title="Benutzer bearbeiten"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={usersList.length <= 1}
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Benutzer löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DATENSICHERUNG UND IMPORT */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Datensicherung & Wiederherstellung
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Erstellen Sie Sicherungskopien aller Vereinsdaten oder stellen Sie einen früheren Stand wieder her.
                </p>
              </div>
            </div>

            {/* Export Backup Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Vollständige Datensicherung herunterladen (JSON)</span>
                </h4>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Exportiert alle Mitglieder, Kassenbuchungen, Belegdateien, Konten, Spendenquittungen, Anträge und Revisionsprotokolle in eine unverschlüsselte JSON-Datei.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Sicherung herunterladen</span>
              </button>
            </div>

            {/* Import Backup Card */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Datensicherung wiederherstellen (JSON)</span>
                </h4>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  Spielt eine zuvor erstellte JSON-Sicherungsdatei wieder in die lokale IndexedDB Ihres Browsers ein.
                </p>
              </div>
              <div className="relative shrink-0">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Sicherung einspielen</span>
                </div>
              </div>
            </div>

            {/* Database Danger Zone */}
            <div className="border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 bg-rose-50/50 dark:bg-rose-950/20 space-y-4">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Datenbankverwaltung & Zurücksetzen</span>
              </h4>
              <p className="text-2xs text-rose-800 dark:text-rose-300">
                Verwenden Sie diese Aktionen, um zu Testzwecken Beispieldaten zu laden oder den lokalen Datenbestand vollständig zu leeren.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Musterdaten laden (TSV Musterstadt)</span>
                </button>

                <button
                  type="button"
                  onClick={handleWipeAll}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Alle lokalen Daten löschen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BETRIEBSMODI (cloud gestrichen) */}
      {activeTab === 'deployment' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Betriebsmodi & Bereitstellung
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wählen Sie die für Ihren Verein optimale Betriebsart für maximale Flexibilität und Datenschutz.
                </p>
              </div>
            </div>

            {/* 3 Modes Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mode 1: 1-Klick Hosting */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-xl w-fit mb-3">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    1-Klick Hosting
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Echtzeit-Synchronisation in einem EU-Rechenzentrum (Frankfurt) mit Webhosting. Mehrere Vorstände arbeiten zeitgleich am PC oder Smartphone.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-2xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>DSGVO-konform (EU-Server)</span>
                </div>
              </div>

              {/* Mode 2: Selbsthoster Docker */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-xl w-fit mb-3">
                    <Server className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Selbsthoster (Docker)
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Betrieb im eigenen Vereinsheim auf Synology NAS, QNAP oder einem Linux-Server via Docker & docker-compose.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-2xs text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>100% eigene Infrastruktur</span>
                </div>
              </div>

              {/* Mode 3: Lokaler Einzelplatz */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded-xl w-fit mb-3">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Lokaler Einzelplatz
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    100% Offline in der lokalen Browser-Datenbank. Keine Server-Kosten, kein Setup und sofort einsatzbereit.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-2xs text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Kostenlos & Offline</span>
                </div>
              </div>
            </div>

            {/* Link to Deployment Hub Modal */}
            {onOpenDeploymentHub && (
              <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Deployment & Betriebsmodi-Hub konfigurieren</span>
                  </h4>
                  <p className="text-2xs sm:text-xs text-slate-400 mt-1">
                    Tragen Sie Verbindungsdaten ein, generieren Sie Datenbank-Tabellen oder exportieren Sie Docker-Compose-Dateien.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenDeploymentHub}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <span>Hub öffnen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: PROJEKT UNTERSTÜTZEN & SPENDEN */}
      {activeTab === 'support' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-amber-500/10 dark:from-rose-950/40 dark:via-slate-900 dark:to-amber-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-rose-500 text-white rounded-2xl shadow-md shadow-rose-500/20 shrink-0">
                  <Heart className="w-7 h-7 fill-white/20" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 mb-2">
                    <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Gemeinnützige Software & Open-Source-Initiative</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Projekt & Weiterentwicklung unterstützen
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    VereinsManager wurde entwickelt, um Vereinen, Vorständen und Ehrenamtlichen eine moderne, DSGVO-konforme und kostenfreie Verwaltungssoftware an die Hand zu geben. Ihre freiwillige finanzielle Unterstützung sichert die kontinuierliche Pflege und künftige Erweiterungen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid: QR-Code Card + Info Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: PayPal QR Code Card (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col items-center text-center space-y-5">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    PayPal Spenden-QR-Code
                  </span>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Direkt & Sicher
                </span>
              </div>

              {/* Embedded QR Code Image - Size matched to frame and Clickable with Zoom Preview */}
              <div
                onClick={() => setQrModalOpen(true)}
                className="w-full max-w-[280px] sm:max-w-[320px] aspect-square bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer overflow-hidden p-2 flex items-center justify-center transition-all duration-200 hover:border-blue-500 hover:shadow-md"
                title="Klicken, um den QR-Code vergrößert anzuzeigen"
              >
                <img
                  src={paypalQrImage}
                  alt="PayPal QR Code zur finanziellen Projektunterstützung"
                  className="w-full h-full object-contain rounded-xl select-none pointer-events-none"
                />
                
                {/* Hover Overlay Badge */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-white">
                  <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-full shadow-md">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold bg-slate-900/80 px-3 py-1 rounded-full shadow-xs">
                    Klicken zum Vergrößern
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  Mit Smartphone oder PayPal-App scannen
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                  Öffnen Sie Ihre Smartphone-Kamera oder die PayPal-App und richten Sie sie auf den QR-Code, um einen beliebigen Betrag zu spenden.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full pt-3 flex flex-col sm:flex-row gap-2 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="https://paypal.me/strelitzerfc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Direkt zu PayPal</span>
                </a>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  title="Vergrößern"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Großansicht</span>
                </button>
                <a
                  href={paypalQrImage}
                  download="paypal-original.jpg"
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                  title="QR-Code herunterladen"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right: Why support & Thank you (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* General Project Support Highlights */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-800/60">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Wofür wird Ihre Unterstützung verwendet?
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Jeder Beitrag fließt direkt in den Erhalt und die Weiterentwicklung der Software:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      <CheckCheck className="w-4 h-4 shrink-0" />
                      <span>Kontinuierliche Pflege</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Laufende Wartung, technische Fehlerbehebungen und stetige Anpassungen an moderne Browser- und Systemstandards.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Datensicherheit & Stabilität</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Strikter Schutz sensibler Vereinsdaten, zuverlässige Speicherkonzepte und Einhaltung moderner Sicherheitsstandards.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      <Server className="w-4 h-4 shrink-0" />
                      <span>Infrastruktur & Bereitstellung</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Zuverlässige Bereitstellung, Vorlagen für Selbsthosting und praxisorientierte Dokumentationen für Administratoren.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <Heart className="w-4 h-4 shrink-0" />
                      <span>Freier Zugang fürs Ehrenamt</span>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Das Projekt dauerhaft unabhängig und ohne kommerzielle Abo-Barrieren für gemeinnützige Vereine zugänglich halten.
                    </p>
                  </div>
                </div>
              </div>

              {/* Thank You Box */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 space-y-3 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <Heart className="w-4 h-4 fill-rose-400" />
                  <span>Ein herzliches Dankeschön!</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Ob 5 €, 15 € oder ein regelmäßiger Kaffeebeitrag: Jeder Beitrag stärkt die ehrenamtliche Arbeit und hilft dabei, Vereinsverwaltung für alle einfacher, schneller und verlässlicher zu gestalten.
                </p>
                <div className="pt-2 flex items-center gap-2 text-2xs text-slate-400 font-medium">
                  <span>VereinsManager Entwicklerteam</span>
                  <span>•</span>
                  <span>Mit Engagement für das Vereinswesen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR QR CODE */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-5 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <QrCode className="w-3.5 h-3.5" />
                <span>PayPal Spenden-QR-Code</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Direkt mit PayPal scannen
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Richten Sie die Smartphone-Kamera oder die PayPal-App auf das Bild.
              </p>
            </div>

            {/* High-Resolution Large QR Display */}
            <div className="w-72 h-72 sm:w-80 sm:h-80 bg-white p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner flex items-center justify-center">
              <img
                src={paypalQrImage}
                alt="PayPal QR Code vergrößert"
                className="w-full h-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="https://paypal.me/strelitzerfc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Auf PayPal öffnen</span>
              </a>
              <a
                href={paypalQrImage}
                download="paypal-original.jpg"
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Herunterladen</span>
              </a>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
