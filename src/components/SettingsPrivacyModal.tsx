import React, { useState } from 'react';
import { ClubSettings, AppUser, UserPermissions } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { FULL_PERMISSIONS } from '../data/roles';
import {
  X,
  ShieldCheck,
  Download,
  Upload,
  Database,
  Building,
  RefreshCw,
  Trash2,
  Lock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Cloud,
  Server,
  Globe,
  ArrowRight,
  Users,
  Shield,
  UserPlus,
  Edit3,
  User as UserIcon,
  Eye,
  EyeOff,
  Check,
  UserCheck,
  UserX,
  Sparkles
} from 'lucide-react';

interface SettingsPrivacyModalProps {
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onDataReload?: () => void;
  onOpenDeploymentHub?: () => void;
  onOpenUserManage?: () => void;
  onClose: () => void;
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

export const SettingsPrivacyModal: React.FC<SettingsPrivacyModalProps> = ({
  settings,
  onSaveSettings,
  onDataReload,
  onOpenDeploymentHub,
  onOpenUserManage,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'club' | 'backup' | 'deployment' | 'users'>('privacy');
  const [formData, setFormData] = useState<ClubSettings>({ ...settings });
  const [newDepartment, setNewDepartment] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>(() => AuthService.getUsers());

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
        setUserFormPermissions({
          canViewMembers: false,
          canEditMembers: false,
          canViewFinances: false,
          canEditFinances: false,
          canExecuteSepa: false,
          canManageDonations: false,
          canManageDocuments: false,
          canManageInventory: false,
          canManageSettings: false,
          canManageUsers: false
        });
        break;
    }
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = userFormUsername.trim().toLowerCase();
    const cleanName = userFormName.trim();

    if (!cleanUsername || !cleanName) {
      setUserMsg({ type: 'error', text: 'Bitte Benutzername und Namen ausfüllen.' });
      return;
    }

    // Check username uniqueness
    const duplicate = usersList.find(u => u.username.toLowerCase() === cleanUsername && u.id !== editingUserId);
    if (duplicate) {
      setUserMsg({ type: 'error', text: `Der Benutzername "${cleanUsername}" ist bereits vergeben.` });
      return;
    }

    if (isCreatingUser && !userFormPassword.trim()) {
      setUserMsg({ type: 'error', text: 'Bitte vergeben Sie ein Passwort für den neuen Benutzer.' });
      return;
    }

    if (isCreatingUser) {
      const newUser: AppUser = {
        id: `user-${Date.now()}`,
        username: cleanUsername,
        name: cleanName,
        email: userFormEmail.trim() || undefined,
        customRoleName: userFormRole.trim() || undefined,
        password: userFormPassword.trim(),
        permissions: { ...userFormPermissions },
        isActive: userFormIsActive,
        createdAt: new Date().toISOString()
      };

      AuthService.saveUser(newUser);
    } else if (editingUserId) {
      const existing = usersList.find(u => u.id === editingUserId);
      if (!existing) return;

      const updated: AppUser = {
        ...existing,
        username: cleanUsername,
        name: cleanName,
        email: userFormEmail.trim() || undefined,
        customRoleName: userFormRole.trim() || undefined,
        password: userFormPassword.trim() || existing.password,
        permissions: { ...userFormPermissions },
        isActive: userFormIsActive,
        updatedAt: new Date().toISOString()
      };

      AuthService.saveUser(updated);
    }

    const refreshed = AuthService.getUsers();
    setUsersList(refreshed);
    setEditingUserId(null);
    setIsCreatingUser(false);
    setUserMsg({ type: 'success', text: 'Benutzer & Berechtigungen wurden erfolgreich gespeichert.' });
    setTimeout(() => setUserMsg(null), 3500);
    onDataReload?.();
  };

  const handleToggleUserActive = (user: AppUser) => {
    const currentSession = AuthService.getSession();
    if (currentSession?.user.id === user.id && user.isActive) {
      alert('Sie können Ihr eigenes aktives Administratorkonto nicht deaktivieren.');
      return;
    }
    const updated = { ...user, isActive: !user.isActive };
    AuthService.saveUser(updated);
    setUsersList(AuthService.getUsers());
    onDataReload?.();
  };

  const handleDeleteUser = (user: AppUser) => {
    const currentSession = AuthService.getSession();
    if (currentSession?.user.id === user.id) {
      alert('Sie können Ihr eigenes Konto nicht löschen.');
      return;
    }
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
    setStatusMsg({ type: 'success', text: 'Vereinsdaten erfolgreich gespeichert.' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    if (formData.departments.includes(newDepartment.trim())) return;
    setFormData(prev => ({
      ...prev,
      departments: [...prev.departments, newDepartment.trim()]
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
      setTimeout(() => setStatusMsg(null), 3000);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Datenschutz & Vereins-Einstellungen
              </h2>
              <p className="text-xs text-slate-500">
                100% lokale, DSGVO-konforme Speicherung, Vereinsstammdaten & Datensicherung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-3 pt-2 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'privacy' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            Datenschutz (DSGVO)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('club')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'club' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            Vereinsstammdaten
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'backup' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            Datensicherung & Import
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deployment')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'deployment' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            Cloud & Betriebsmodi
          </button>
          <button
            type="button"
            onClick={() => {
              setUsersList(AuthService.getUsers());
              setActiveTab('users');
            }}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Benutzer & Rechte
          </button>
        </div>

        {/* Notifications */}
        {statusMsg && (
          <div className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {statusMsg.text}
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6 flex-1">
          {/* 1. PRIVACY TAB */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  DSGVO-Garantie: 100% Lokale Datenverarbeitung
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Diese Vereinsverwaltungs-Software speichert alle vertraulichen Mitgliederdaten, Bankverbindungen (IBAN/BIC), Belege (PDF/Bilder) und Finanzbuchungen <strong>ausschließlich lokal in der verschlüsselten IndexedDB-Datenbank Ihres Webbrowsers</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-xs font-bold text-slate-800 block mb-1">Kein Cloud-Server / Kein Datenabfluss</span>
                    <p className="text-2xs text-slate-500">
                      Es findet keinerlei Übertragung personenbezogener Daten an externe Server oder Drittanbieter statt.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-xs font-bold text-slate-800 block mb-1">Vollständige Datenhoheit</span>
                    <p className="text-2xs text-slate-500">
                      Sie können jederzeit eine vollständige, unverschlüsselte oder exportierbare JSON-Sicherung herunterladen.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Zugriffsschutz & Benutzerverwaltung
                  </h3>
                  {onOpenUserManage && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenUserManage();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <span>Benutzer verwalten</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Steuern Sie über Rollen (Admin, Kassenwart, Schriftführer, Kassenprüfer), wer Zugriff auf Finanzen, Mitgliederdaten und SEPA-Lastschriften hat.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  Technische Speicherarchitektur
                </h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>Lokale Browser-IndexedDB:</strong> Ermöglicht blitzschnelle Abfragen, hohe Speicherkapazität für Beleg-Anhänge (PDFs/Bilder) und Offline-Nutzung.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>Revisionssicherer Audit-Trail:</strong> Jede Änderung an Mitgliederdaten wird mit Zeitstempel und Vorher-/Nachher-Werten protokolliert.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>SEPA-Konformität:</strong> IBAN-Validierung und automatische Mandatsreferenzierung gem. Vorgaben des European Payments Council (EPC).</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CLUB STAMMDATEN TAB */}
          {activeTab === 'club' && (
            <form onSubmit={handleSaveClub} className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offizieller Vereinsname *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clubName}
                    onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. TSV Musterstadt 1890 e.V."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vereinsregisternummer (VR-Nr.)
                  </label>
                  <input
                    type="text"
                    value={formData.associationNumber}
                    onChange={e => setFormData({ ...formData, associationNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. VR 48219 Amtsgericht Musterstadt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Steuernummer (Finanzamt)
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={e => setFormData({ ...formData, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. 112/5840/1922"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    SEPA-Gläubiger- & Vereinskonto-Stammdaten (für Lastschriftexport)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Diese Angaben werden als Gläubiger (Creditor) in die offiziellen SEPA XML-Dateien (pain.008) für Ihre Bank eingebettet.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Gläubiger-ID (CI) *
                      </label>
                      <input
                        type="text"
                        value={formData.creditorId}
                        onChange={e => setFormData({ ...formData, creditorId: e.target.value.toUpperCase().trim() })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500"
                        placeholder="DE98ZZZ09999999999"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Vereins-IBAN (Gutschrift) *
                      </label>
                      <input
                        type="text"
                        value={formData.creditorIban || ''}
                        onChange={e => setFormData({ ...formData, creditorIban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500"
                        placeholder="DE02 1203 0000 0012 3456 78"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Vereins-BIC / SWIFT
                      </label>
                      <input
                        type="text"
                        value={formData.creditorBic || ''}
                        onChange={e => setFormData({ ...formData, creditorBic: e.target.value.toUpperCase().trim() })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                        placeholder="BYLADEM1001"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vereinsanschrift
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Sportplatzweg 12, 12345 Musterstadt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Vorsitzender / Vorstand
                  </label>
                  <input
                    type="text"
                    value={formData.chairman}
                    onChange={e => setFormData({ ...formData, chairman: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Dr. Michael Sommer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Schatzmeister / Kassenwart
                  </label>
                  <input
                    type="text"
                    value={formData.treasurer}
                    onChange={e => setFormData({ ...formData, treasurer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Sabine Weber"
                  />
                </div>
              </div>

              {/* Department configuration */}
              <div className="pt-3 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Abteilungen & Sparten ({formData.departments.length})
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.departments.map(dept => (
                    <span
                      key={dept}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium border border-slate-200"
                    >
                      {dept}
                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={e => setNewDepartment(e.target.value)}
                    placeholder="Neue Abteilung hinzufügen (z.B. Badminton)"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddDepartment}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Vereinsdaten speichern
                </button>
              </div>
            </form>
          )}

          {/* 3. BACKUP & IMPORT TAB */}
          {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* Export Full Backup */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">Vollständige Datensicherung (JSON)</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Exportiert alle Mitglieder, Buchungen, Belege, Konten und Änderungshistorien in eine einzige Sicherungsdatei.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Sicherung herunterladen
                </button>
              </div>

              {/* Import Full Backup */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">Datensicherung wiederherstellen</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Spielt eine zuvor erstellte JSON-Sicherungsdatei wieder in den Browser ein.
                  </p>
                </div>
                <div className="relative shrink-0">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Sicherung einspielen
                  </div>
                </div>
              </div>

              {/* Database Danger Zone */}
              <div className="border border-rose-200 rounded-2xl p-4 bg-rose-50/50 space-y-3">
                <h3 className="text-xs font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Datenbankverwaltung & Zurücksetzen
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleResetToDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    Musterdaten laden (TSV Musterstadt)
                  </button>

                  <button
                    type="button"
                    onClick={handleWipeAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Alle Daten löschen (Neu anfangen)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. DEPLOYMENT & CLOUD TAB */}
          {activeTab === 'deployment' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  3 Flexible Betriebs- & Hosting-Optionen
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Jeder Verein kann die Software exakt nach seinen Anforderungen betreiben: Als 1-Klick Cloud (IONOS + Supabase EU Frankfurt), als Docker-Container auf eigenem NAS/Server oder lokal offline im Webbrowser.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                      <Cloud className="w-4 h-4" /> 1-Klick Cloud (IONOS)
                    </div>
                    <p className="text-2xs text-slate-600">
                      Supabase EU (Frankfurt) + IONOS Deploy Now (~1 €/Monat). Mehrere Vorstände arbeiten zeitgleich.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                      <Server className="w-4 h-4" /> Selbsthoster (Docker)
                    </div>
                    <p className="text-2xs text-slate-600">
                      Fertiges Docker-Image & docker-compose.yml für Synology NAS, QNAP oder vServer.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
                      <HardDrive className="w-4 h-4" /> Lokaler Einzelplatz
                    </div>
                    <p className="text-2xs text-slate-600">
                      100% Offline in der Browser-IndexedDB. 0,00 € Kosten und keine Server-Einrichtung.
                    </p>
                  </div>
                </div>
              </div>

              {onOpenDeploymentHub && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      Interaktiven Deployment & Cloud Hub öffnen
                    </h4>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Supabase-Schlüssel eintragen, SQL-Skript kopieren, Vorstandskonten verwalten oder Docker-Dateien ansehen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDeploymentHub();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <span>Hub öffnen</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. USERS & PERMISSIONS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Feedback Alert if present */}
              {userMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                    userMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {userMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{userMsg.text}</span>
                </div>
              )}

              {/* In-Place User Editor (When creating or editing a user) */}
              {(isCreatingUser || editingUserId) ? (
                <form
                  onSubmit={handleSaveUserForm}
                  className="bg-slate-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-2xs">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {isCreatingUser
                            ? 'Neues Vereinskonto anlegen'
                            : `Rechte & Daten bearbeiten: ${userFormName || userFormUsername}`}
                        </h3>
                        <p className="text-2xs text-slate-500">
                          Passen Sie Zugriffsrechte und Login-Informationen für dieses Mitglied an.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={cancelEditUser}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>

                  {/* Basic User Data Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vollständiger Name *
                      </label>
                      <input
                        type="text"
                        value={userFormName}
                        onChange={(e) => setUserFormName(e.target.value)}
                        placeholder="z. B. Sabine Weber"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Benutzername (Login) *
                      </label>
                      <input
                        type="text"
                        value={userFormUsername}
                        onChange={(e) => setUserFormUsername(e.target.value)}
                        placeholder="z. B. s.weber oder schatzmeister"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Funktion / Rollenbezeichnung
                      </label>
                      <input
                        type="text"
                        value={userFormRole}
                        onChange={(e) => setUserFormRole(e.target.value)}
                        placeholder="z. B. Schatzmeisterin, Kassenprüfer, Geschäftsstelle"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isCreatingUser ? 'Passwort *' : 'Neues Passwort (leer lassen = unverändert)'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={userFormPassword}
                          onChange={(e) => setUserFormPassword(e.target.value)}
                          placeholder={isCreatingUser ? 'Sicheres Passwort vergeben...' : 'Nur ausfüllen bei Änderung'}
                          required={isCreatingUser}
                          className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-Mail-Adresse (optional)
                      </label>
                      <input
                        type="email"
                        value={userFormEmail}
                        onChange={(e) => setUserFormEmail(e.target.value)}
                        placeholder="kontakt@verein.de"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div className="flex items-end pb-0.5">
                      <label className="flex items-center gap-2.5 cursor-pointer bg-white px-3 py-2 border border-slate-200 rounded-xl w-full hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={userFormIsActive}
                          onChange={(e) => setUserFormIsActive(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 block">Konto aktiv</span>
                          <span className="text-2xs text-slate-500">Benutzer kann sich anmelden</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Granular Permissions Section */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          Individuelle Zugriffsrechte für diesen Benutzer
                        </h4>
                        <p className="text-2xs text-slate-500">
                          Wählen Sie genau die Module, die dieser Benutzer sehen oder bearbeiten darf.
                        </p>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-2xs text-slate-400 font-bold mr-1">Vorlagen:</span>
                        <button
                          type="button"
                          onClick={() => applyPreset('all')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-2xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Vollzugriff
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('finance')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-2xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Finanzen & Kasse
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('read_only')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-2xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Kassenprüfer
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('members')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-2xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Mitglieder
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('none')}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg text-2xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          Alle abwählen
                        </button>
                      </div>
                    </div>

                    {/* Permissions Grid Grouped by Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {(['Mitglieder', 'Finanzen & SEPA', 'Dokumente & Inventar', 'System & Verwaltung'] as const).map((cat) => {
                        const items = PERMISSION_ITEMS.filter((p) => p.category === cat);
                        return (
                          <div
                            key={cat}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs"
                          >
                            <div className="text-2xs font-extrabold uppercase tracking-wider text-slate-400">
                              {cat}
                            </div>
                            <div className="space-y-1.5">
                              {items.map((item) => {
                                const isChecked = Boolean(userFormPermissions[item.key]);
                                return (
                                  <label
                                    key={item.key}
                                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-blue-50/70 border border-blue-200'
                                        : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleUserPermission(item.key)}
                                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0 cursor-pointer"
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

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div>
                      {editingUserId && usersList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const u = usersList.find((x) => x.id === editingUserId);
                            if (u) handleDeleteUser(u);
                          }}
                          className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Benutzer löschen</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelEditUser}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isCreatingUser ? 'Benutzer erstellen' : 'Rechte speichern'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* User Overview List */
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
                        <Shield className="w-5 h-5 text-blue-600" />
                        Benutzerkonten & individuelle Rechteverwaltung
                      </div>
                      <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                        Klicken Sie auf einen Benutzer oder auf „Rechte anpassen“, um individuelle Berechtigungen (Finanzen, Mitglieder, Kassenprüfung, Spenden) sofort zu vergeben.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={startCreateUser}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Neuen Benutzer anlegen</span>
                    </button>
                  </div>

                  {/* Registered Users List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Registrierte Benutzerkonten ({usersList.length})
                      </h4>
                      <span className="text-2xs text-slate-500">
                        Klick auf Zeile öffnet die Rechteverwaltung
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {usersList.map((user) => {
                        const permCount = Object.values(user.permissions || {}).filter(Boolean).length;
                        const isCurrentSession = AuthService.getSession()?.user.id === user.id;

                        return (
                          <div
                            key={user.id}
                            onClick={() => startEditUser(user)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                              user.isActive !== false
                                ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                                : 'bg-slate-50 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Left User Avatar & Details */}
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform ${
                                    user.permissions.canManageUsers
                                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                      : user.permissions.canEditFinances
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                                  }`}
                                >
                                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                      {user.name}
                                    </span>
                                    {user.customRoleName && (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-2xs font-semibold border border-slate-200">
                                        {user.customRoleName}
                                      </span>
                                    )}
                                    {isCurrentSession && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-2xs font-bold">
                                        Sie (Aktuell)
                                      </span>
                                    )}
                                    {user.isActive === false && (
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-2xs font-bold">
                                        Deaktiviert
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                                    <span>
                                      Login: <strong className="text-slate-700">{user.username}</strong>
                                    </span>
                                    {user.email && (
                                      <span className="hidden sm:inline text-slate-400 font-sans">
                                        • {user.email}
                                      </span>
                                    )}
                                  </div>

                                  {/* Permission Chips Preview */}
                                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                    <span className="text-2xs text-slate-400 font-medium mr-1">
                                      Rechte ({permCount}/10):
                                    </span>
                                    {user.permissions.canManageUsers && (
                                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-2xs font-semibold">
                                        Admin
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
                                  onClick={() => startEditUser(user)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200 cursor-pointer shadow-2xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Rechte anpassen</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleUserActive(user)}
                                  disabled={isCurrentSession && user.isActive}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                                    user.isActive !== false
                                      ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  } disabled:opacity-30`}
                                  title={user.isActive !== false ? 'Konto deaktivieren' : 'Konto reaktivieren'}
                                >
                                  {user.isActive !== false ? 'Sperren' : 'Aktivieren'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={isCurrentSession || usersList.length <= 1}
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
