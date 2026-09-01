import React, { useState, useEffect } from 'react';
import { DeploymentMode, SupabaseConfig, UserAuthSession } from '../types';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  clearStoredSupabaseConfig,
  testSupabaseConnection,
  getAuthSession,
  signInUser,
  signUpUser,
  signOutUser,
  sendPasswordReset,
  SUPABASE_SCHEMA_SQL
} from '../services/supabaseClient';
import { StorageService } from '../services/storage';
import {
  X,
  Cloud,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Key,
  Database,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  User,
  Lock,
  Mail,
  LogOut,
  Info,
  Layers,
  Terminal,
  Globe,
  HelpCircle,
  FileText,
  Check,
  Sparkles,
  Laptop,
  FolderSync,
  ArrowLeftRight,
  Upload,
  Play,
  Share2,
  Users,
  CheckCheck,
  Building2,
  Network,
  Cpu
} from 'lucide-react';

interface DeploymentHubModalProps {
  currentMode: DeploymentMode;
  onModeChange: (mode: DeploymentMode) => void;
  onDataReload?: () => void;
  onClose: () => void;
}

export const DeploymentHubModal: React.FC<DeploymentHubModalProps> = ({
  currentMode,
  onModeChange,
  onDataReload,
  onClose
}) => {
  // Config state
  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const isCloudConfigured = Boolean(config.isConfigured && config.url && config.anonKey);

  // Determine actual runtime active mode
  const isCloudActive = currentMode === 'cloud' && isCloudConfigured;
  const isSelfhostedActive = currentMode === 'selfhosted';
  const isLocalActive = !isCloudActive && !isSelfhostedActive;

  // Active tab state: default to current active mode
  const [activeTab, setActiveTab] = useState<'desktop' | 'cloud' | 'docker' | 'migration' | 'auth'>(
    isCloudActive ? 'cloud' : isSelfhostedActive ? 'docker' : 'desktop'
  );

  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [migrationStatus, setMigrationStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [selfhostedStatus, setSelfhostedStatus] = useState<{ success?: boolean; message?: string }>({});
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);

  // Local data statistics
  const [localStats, setLocalStats] = useState<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    documents: number;
    donations: number;
    calendarEvents: number;
    auditLogs: number;
  } | null>(null);

  // Auth State
  const [authSession, setAuthSession] = useState<UserAuthSession>({ user: null, isAuthenticated: false });
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('Kassenwart / Vorstand');
  const [authClub, setAuthClub] = useState('');
  const [authStatus, setAuthStatus] = useState<{ loading: boolean; error?: string; success?: string }>({ loading: false });

  useEffect(() => {
    loadAuth();
    loadStats();
  }, []);

  const loadAuth = async () => {
    const session = await getAuthSession();
    setAuthSession(session);
  };

  const loadStats = async () => {
    try {
      const stats = await StorageService.getLocalDataStats();
      setLocalStats(stats);
    } catch (e) {
      console.warn('Fehler beim Laden der lokalen Statistiken:', e);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(config.url, config.anonKey);
    setTestStatus({ loading: true });
    const res = await testSupabaseConnection(config.url, config.anonKey);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.success
        ? 'Verbindung zu Supabase erfolgreich hergestellt & aktiv!'
        : `Fehler: ${res.error || 'Verbindung fehlgeschlagen'}`
    });

    if (res.success) {
      StorageService.setDeploymentMode('cloud');
      onModeChange('cloud');
      onDataReload?.();
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    const res = await testSupabaseConnection(config.url, config.anonKey);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.success
        ? 'Verbindung zu Supabase (Frankfurt / EU) erfolgreich hergestellt!'
        : `Fehler: ${res.error || 'Verbindung fehlgeschlagen'}`
    });
  };

  const handleActivateSelfhosted = () => {
    StorageService.setDeploymentMode('selfhosted');
    onModeChange('selfhosted');
    setSelfhostedStatus({
      success: true,
      message: 'Modus „Eigener Server / NAS“ wurde als aktiver Betriebsmodus festgelegt.'
    });
    onDataReload?.();
  };

  const handleActivateLocal = () => {
    StorageService.setDeploymentMode('local');
    onModeChange('local');
    onDataReload?.();
  };

  const handleDownloadBackup = async () => {
    try {
      const json = await StorageService.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `VereinsManager_Komplettsicherung_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Fehler beim Erstellen der Sicherungsdatei: ' + err.message);
    }
  };

  const handleMigrateToCloud = async () => {
    if (!config.isConfigured) {
      setActiveTab('cloud');
      alert('Bitte tragen Sie zuerst im Tab „Cloud-Setup“ Ihre Supabase Project URL und den Anon Key ein.');
      return;
    }

    if (!window.confirm('Möchten Sie alle lokal gespeicherten Vereinsdaten (Mitglieder, Buchungsjournal, Finanzkonten, Inventar, SEPA-Läufe und Einstellungen) jetzt in Ihre Supabase Cloud-Datenbank übertragen?')) {
      return;
    }

    setMigrationStatus({ loading: true });
    try {
      const res = await StorageService.migrateLocalToCloud();
      setMigrationStatus({
        loading: false,
        success: true,
        message: `Lückenlose Migration erfolgreich: ${res.members} Mitglieder, ${res.transactions} Buchungen, ${res.accounts} Konten, ${res.inventory} Inventargegenstände und Vereinsstammdaten wurden sicher in die Cloud synchronisiert.`
      });
      onModeChange('cloud');
      onDataReload?.();
      loadStats();
    } catch (err: any) {
      setMigrationStatus({
        loading: false,
        success: false,
        message: err.message || 'Fehler bei der Datenübertragung. Prüfen Sie, ob das SQL-Schema in Supabase ausgeführt wurde.'
      });
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStatus({ loading: true });

    if (authMode === 'login') {
      const res = await signInUser(authEmail, authPassword);
      if (res.success) {
        setAuthStatus({ loading: false, success: 'Erfolgreich angemeldet!' });
        await loadAuth();
        onDataReload?.();
      } else {
        setAuthStatus({ loading: false, error: res.error || 'Anmeldung fehlgeschlagen' });
      }
    } else if (authMode === 'register') {
      const res = await signUpUser(authEmail, authPassword, authRole, authClub);
      if (res.success) {
        setAuthStatus({
          loading: false,
          success: res.message || 'Konto erfolgreich angelegt! Sie können sich jetzt anmelden.'
        });
        await loadAuth();
      } else {
        setAuthStatus({ loading: false, error: res.error || 'Registrierung fehlgeschlagen' });
      }
    } else if (authMode === 'forgot') {
      const res = await sendPasswordReset(authEmail);
      if (res.success) {
        setAuthStatus({ loading: false, success: 'Link zum Zurücksetzen des Passworts wurde per E-Mail versendet.' });
      } else {
        setAuthStatus({ loading: false, error: res.error || 'Fehler beim Senden' });
      }
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    await loadAuth();
    setAuthStatus({ loading: false, success: 'Erfolgreich abgemeldet.' });
    onDataReload?.();
  };

  const dockerComposeContent = `version: '3.8'

services:
  vereinsmanager:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vereinsmanager_app
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - VITE_DEPLOYMENT_MODE=selfhosted
      # Optional: Bei zentraler PostgreSQL-Datenbank
      # - VITE_SUPABASE_URL=https://ihr-server:8000
      # - VITE_SUPABASE_ANON_KEY=ihr-anon-key`;

  const handleCopyDocker = () => {
    navigator.clipboard.writeText(dockerComposeContent);
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 3000);
  };

  const handleDownloadDocker = () => {
    const blob = new Blob([dockerComposeContent], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header (shrink-0) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Betriebsmodus & Deployment Hub
                </h2>
                <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Umzugs- & Cloud-Zentrale
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Klicken Sie auf eine Kachel oder einen Reiter, um die Schritt-für-Schritt-Anleitung anzuzeigen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Cards (shrink-0) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 sm:p-5 bg-slate-100/70 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
          
          {/* 1. Lokale Desktop-App */}
          <div
            onClick={() => setActiveTab('desktop')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isLocalActive
                ? 'bg-white dark:bg-slate-900 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : activeTab === 'desktop'
                ? 'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-600'
                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Laptop className="w-5 h-5" />
                </span>
                {isLocalActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                    <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">
                    Anleitung ansehen
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Lokale Desktop-App</h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                App herunterladen (.exe, .dmg, .AppImage) & sofort 100% offline loslegen. Keine Server nötig.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-2xs text-amber-700 dark:text-amber-400 font-bold">
              <span>0,00 € Kosten • Offline</span>
              <span className="text-slate-400 font-normal">Standard</span>
            </div>
          </div>

          {/* 2. Cloud-Betrieb */}
          <div
            onClick={() => setActiveTab('cloud')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isCloudActive
                ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : activeTab === 'cloud'
                ? 'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-600'
                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Cloud className="w-5 h-5" />
                </span>
                {isCloudActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">
                    {isCloudConfigured ? 'Konfiguriert (Inaktiv)' : 'Nicht konfiguriert'}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Cloud-Betrieb (Multi-User)</h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Echtzeit-Synchronisation für den gesamten Vorstand über beliebigen Hoster (oder Desktop-App) + DSGVO-Cloud.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-2xs text-emerald-700 dark:text-emerald-400 font-bold">
              <span>DSGVO-konform (EU)</span>
              <span className="text-emerald-600">Empfohlen für Vorstände</span>
            </div>
          </div>

          {/* 3. Eigener Server / Docker */}
          <div
            onClick={() => setActiveTab('docker')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isSelfhostedActive
                ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : activeTab === 'docker'
                ? 'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-600'
                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Server className="w-5 h-5" />
                </span>
                {isSelfhostedActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-full flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                    <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">
                    Anleitung ansehen
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Eigener Server / NAS (Docker)</h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Betrieb im eigenen Vereinsheim auf Synology NAS, QNAP, Raspberry Pi oder Linux vServer via Docker.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-2xs text-blue-700 dark:text-blue-400 font-bold">
              <span>100% Eigene Datenhoheit</span>
              <span className="text-slate-400 font-normal">Selbsthoster</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation (shrink-0 & cleanly separated) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 overflow-x-auto shrink-0 z-10">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'desktop'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>1. Lokale Desktop-App</span>
          </button>
          
          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'cloud'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>2. Cloud-Setup (Alle Hoster)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('docker')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'docker'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>3. Eigener Server & Docker</span>
          </button>

          <button
            onClick={() => setActiveTab('migration')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'migration'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>🔄 1-Klick Daten-Umzug & Migration</span>
          </button>

          <button
            onClick={() => setActiveTab('auth')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'auth'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>👥 Vorstand & Benutzer (Auth)</span>
          </button>
        </div>

        {/* Tab Content Container (Flex-1 & Scrollable only) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6">

          {/* ========================================================================= */}
          {/* TAB: 1. LOKALE DESKTOP-APP */}
          {/* ========================================================================= */}
          {activeTab === 'desktop' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Introduction Banner */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3">
                <Laptop className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-950 dark:text-amber-100 text-xs sm:text-sm">
                    Modus 1: Eigenständige Desktop-App für Windows, macOS und Linux
                  </div>
                  <div className="mt-1 leading-relaxed">
                    Die App kann als eigenständiges Programm direkt auf Ihrem PC oder Mac installiert werden. 
                    Keine Server-Einrichtung und kein Terminal nötig – alle Daten werden 100% lokal und privat auf Ihrem Computer gespeichert.
                  </div>
                </div>
              </div>

              {/* Status & Activation Bar */}
              {isLocalActive ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Dieser Browser/PC arbeitet aktuell im lokalen Offline-Modus (IndexedDB).</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Backup herunterladen</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Aktuell ist ein anderer Modus aktiv. Möchten Sie zu diesem lokalen Offline-Modus zurückkehren?
                  </div>
                  <button
                    type="button"
                    onClick={handleActivateLocal}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Lokalen Modus aktivieren</span>
                  </button>
                </div>
              )}

              {/* Download Packages Section */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Fertige Installationspakete herunterladen</span>
                  </h4>
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    GitHub Releases
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">Windows (.exe / .msi)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Für Windows 10 & 11. Einfache 1-Klick Installation mit Desktop-Verknüpfung.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">macOS (.dmg)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Für Apple Silicon (M1/M2/M3) & Intel Macs. Einfach in den Programme-Ordner ziehen.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">Linux (.AppImage / .deb)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Für Ubuntu, Debian, Fedora, Arch & Co. Direkt ausführbar.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-2xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Wie werden neue Versionen automatisch gebaut?
                  </div>
                  <p>
                    Sobald Sie im GitHub Repository einen neuen Versions-Tag erstellen (z. B. <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded font-mono">v1.0.0</code>) oder den Release-Workflow manuell starten, baut <strong>GitHub Actions</strong> vollautomatisch alle Installationsdateien und hängt sie an das Release an.
                  </p>
                </div>
              </div>

              {/* Local Portable Start Scripts */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Alternativ: Start per 1-Klick Start-Skript
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-2xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">start-windows.bat</div>
                    <p className="text-slate-500 dark:text-slate-400">Doppelklick startet die App lokal unter Windows.</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">start-mac-linux.sh</div>
                    <p className="text-slate-500 dark:text-slate-400">Startet die App per Shell-Skript auf macOS oder Linux.</p>
                  </div>
                </div>
              </div>

              {/* Quick Jump to Migration */}
              <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sie möchten Ihre lokalen Daten später in die Cloud oder auf den Server mitnehmen?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Nutzen Sie unseren 1-Klick Daten-Umzug. Ihre bestehenden Mitglieder, Buchungen und Konten werden ohne Datenverlust übertragen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('migration')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>Zum 1-Klick Umzug</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: 2. CLOUD-SETUP (UNIVERSELL FÜR ALLE HOSTER) */}
          {/* ========================================================================= */}
          {activeTab === 'cloud' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Concept explanation */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                    Modus 2: Universelle Cloud-Architektur (100% DSGVO-konform in Frankfurt am Main)
                  </div>
                  <div className="mt-1 leading-relaxed">
                    Der VereinsManager trennt Frontend und Datenbank modular: Ihre Daten liegen verschlüsselt in einer PostgreSQL-Cloud-Datenbank (z.B. Supabase Region Frankfurt / EU). 
                    Das Frontend können Sie bei <strong>jedem beliebigen Webhoster</strong> (Hetzner, Strato, IONOS, Netlify, Vercel, Cloudflare, eigener Server) oder <strong>direkt als Desktop-App</strong> nutzen!
                  </div>
                </div>
              </div>

              {/* SCHRITT A: Supabase Datenbank einrichten */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                      A
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Kostenlose Cloud-Datenbank anlegen (Supabase)
                    </h4>
                  </div>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1"
                  >
                    <span>supabase.com öffnen</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside leading-relaxed">
                  <li>
                    Erstellen Sie ein kostenloses Konto auf <strong>supabase.com</strong> und klicken Sie auf <strong>"New Project"</strong>.
                  </li>
                  <li>
                    Wählen Sie als Region <strong>Central EU (Frankfurt / eu-central-1)</strong> für maximale DSGVO-Konformität.
                  </li>
                  <li>
                    Öffnen Sie links den <strong>SQL Editor</strong>, fügen Sie das folgende Initialisierungs-Skript ein und klicken Sie auf <strong>Run</strong>:
                  </li>
                </ol>

                {/* SQL Schema Script Box */}
                <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>supabase_schema.sql (Tabellen, Indizes & RLS-Rechte)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopySql}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-2xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSql ? 'Kopiert!' : 'SQL kopieren'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSql}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-2xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>.sql Datei</span>
                      </button>
                    </div>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-lg text-2xs font-mono text-emerald-300/90 overflow-x-auto max-h-32 border border-slate-800">
                    {SUPABASE_SCHEMA_SQL.slice(0, 600)}...
                  </pre>
                </div>
              </div>

              {/* SCHRITT B: Verbindungsdaten in der App hinterlegen */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                    B
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Supabase-Zugangsdaten in dieser App eintragen
                  </h4>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Project URL (unter Project Settings &rarr; API)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://xyzcompany.supabase.co"
                      value={config.url}
                      onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Anon / Public API Key (unter Project Settings &rarr; API)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.anonKey}
                      onChange={e => setConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={testStatus.loading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {testStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Speichern & Aktivieren
                      </button>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus.loading || !config.url || !config.anonKey}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testStatus.loading ? 'animate-spin' : ''}`} />
                        Verbindung testen
                      </button>
                    </div>

                    {config.isConfigured && (
                      <button
                        type="button"
                        onClick={() => {
                          clearStoredSupabaseConfig();
                          setConfig({ url: '', anonKey: '', isConfigured: false });
                          handleActivateLocal();
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold cursor-pointer"
                      >
                        Verbindung trennen
                      </button>
                    )}
                  </div>
                </form>

                {testStatus.message && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                      testStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {testStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testStatus.message}</span>
                  </div>
                )}

                {/* Tipp: Desktop-App synchronisieren */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-white">💡 Wichtig & Zeitsparend:</span> Sie müssen die Web-App nicht zwingend im Internet hosten! 
                  Sie können die <strong>Desktop-App</strong> auf den Laptops aller Vorstandsmitglieder installieren und überall dieselbe Supabase-URL eintragen. Schon arbeiten alle Vorstände in Echtzeit synchron!
                </div>
              </div>

              {/* SCHRITT C: Webhosting bei beliebigem Hoster (Optional) */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                    C
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Web-App bei einem beliebigen Hoster bereitstellen (Optional für Browser-Zugriff)
                    </h4>
                    <p className="text-2xs text-slate-500 dark:text-slate-400">
                      Funktioniert mit jedem modernen Webhoster, Cloud-Provider oder eigenem Webspace.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <span className="text-2xs font-bold text-slate-400 uppercase">1. Build Command</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">npm run build</div>
                    <p className="text-2xs text-slate-500">Erstellt die produktionsfertige Web-App.</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <span className="text-2xs font-bold text-slate-400 uppercase">2. Output / Publish Directory</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">dist</div>
                    <p className="text-2xs text-slate-500">Der Ordner, den der Hoster ausliefert.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Umgebungsvariablen beim Hoster hinterlegen (Environment Variables):
                  </label>
                  <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-2xs space-y-1 border border-slate-800">
                    <div><span className="text-emerald-400">VITE_SUPABASE_URL</span> = https://ihr-projekt.supabase.co</div>
                    <div><span className="text-emerald-400">VITE_SUPABASE_ANON_KEY</span> = eyJhbGciOiJIUzI1Ni...</div>
                    <div><span className="text-emerald-400">VITE_DEPLOYMENT_MODE</span> = cloud</div>
                  </div>
                </div>

                {/* Hoster-Tabelle */}
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Beliebte Hosting-Optionen im Vergleich:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-2xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">Hetzner / Strato / IONOS</div>
                      <p className="text-slate-500 dark:text-slate-400">
                        Deutsche Rechenzentren, eigene Vereinsdomain (.de) inklusive, ca. 1-2 €/Monat.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">Netlify / Vercel / Cloudflare</div>
                      <p className="text-slate-500 dark:text-slate-400">
                        0,00 € Free-Tier, weltweites CDN, automatisches SSL-Zertifikat, 1-Klick GitHub Deploy.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">Eigener Webspace / FTP</div>
                      <p className="text-slate-500 dark:text-slate-400">
                        Einfach nach <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">npm run build</code> den Inhalt des <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">dist/</code> Ordners per FTP hochladen.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: 3. DOCKER & EIGENER SERVER (VOLLSTÄNDIGE SCHRITT-FÜR-SCHRITT ANLEITUNG) */}
          {/* ========================================================================= */}
          {activeTab === 'docker' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Header Box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-blue-950 dark:text-blue-100 text-xs sm:text-sm">
                    Modus 3: Eigener Server & Docker (Synology NAS, QNAP, Raspberry Pi & Linux vServer)
                  </div>
                  <div className="mt-1 leading-relaxed">
                    Betreiben Sie den VereinsManager auf Ihrer eigenen Hardware mit 100% Datenkontrolle direkt im Vereinsheim oder auf Ihrem privaten Server. 
                    Keine fremden Cloud-Dienste, keine monatlichen Abo-Gebühren.
                  </div>
                </div>
              </div>

              {/* Status / Activation Card */}
              {isSelfhostedActive ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-200 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Modus „Eigener Server / NAS“ ist auf dieser Instanz als aktiver Betriebsmodus gesetzt.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleActivateLocal}
                    className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Auf Standard zurücksetzen
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      Möchten Sie diesen Computer/Browser auf den Modus „Eigener Server“ umstellen?
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Markiert diesen Client für den Einsatz im lokalen Vereinsheim-Netzwerk / Docker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleActivateSelfhosted}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>Als aktiven Server-Modus festlegen</span>
                  </button>
                </div>
              )}

              {selfhostedStatus.message && (
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-blue-200 dark:border-blue-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{selfhostedStatus.message}</span>
                </div>
              )}

              {/* SCHRITT 1: Voraussetzungen & Vorbereitung */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Schritt 1: Systemvoraussetzungen
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span>Unterstützte Hardware</span>
                    </div>
                    <ul className="text-2xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                      <li>Synology NAS mit DSM 7+ (Container Manager)</li>
                      <li>QNAP NAS (Container Station)</li>
                      <li>Raspberry Pi 4 oder 5 (64-Bit OS)</li>
                      <li>Beliebiger Linux vServer (Ubuntu, Debian, AlmaLinux)</li>
                      <li>Windows / Mac mit Docker Desktop</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-emerald-600" />
                      <span>Benötigte Software</span>
                    </div>
                    <ul className="text-2xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                      <li>Docker Engine (Version 20.10 oder neuer)</li>
                      <li>Docker Compose (Version 2.0+)</li>
                      <li>Git (zum Klonen des Quellcodes)</li>
                      <li>Freier Port auf dem Server (Standard: 8080)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SCHRITT 2: docker-compose.yml Konfiguration */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Schritt 2: Bereitstellungsdatei (docker-compose.yml)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDocker}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-2xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedDocker ? 'Kopiert!' : 'Kopieren'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadDocker}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-2xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.yml Datei</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Erstellen Sie im Projektordner eine Datei namens <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">docker-compose.yml</code> mit folgendem Inhalt:
                </p>

                <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800">
                  <pre className="text-2xs font-mono text-blue-300 overflow-x-auto">
                    {dockerComposeContent}
                  </pre>
                </div>
              </div>

              {/* SCHRITT 3: Schritt-für-Schritt Installation Terminal */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Schritt 3: Installation & Start über die Kommandozeile
                  </h4>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                      1. Repository auf den Server klonen:
                    </div>
                    <div className="p-3 bg-slate-950 text-emerald-400 font-mono rounded-xl border border-slate-800 text-2xs">
                      git clone https://github.com/ihr-verein/vereinsmanager.git<br />
                      cd vereinsmanager
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                      2. Container im Hintergrund bauen & starten:
                    </div>
                    <div className="p-3 bg-slate-950 text-emerald-400 font-mono rounded-xl border border-slate-800 text-2xs">
                      docker compose up -d --build
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                      3. Status & Logs überprüfen:
                    </div>
                    <div className="p-3 bg-slate-950 text-emerald-400 font-mono rounded-xl border border-slate-800 text-2xs">
                      docker compose ps<br />
                      docker compose logs -f vereinsmanager
                    </div>
                  </div>
                </div>
              </div>

              {/* SCHRITT 4: Anleitung für Synology & QNAP NAS */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Schritt 4: Klick-Anleitungen für NAS-Systeme
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Synology */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Synology NAS (Container Manager)</span>
                    </div>
                    <ol className="text-2xs text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>Öffnen Sie im Synology DSM den <strong>Container Manager</strong>.</li>
                      <li>Klicken Sie links auf <strong>Projekt</strong> &rarr; <strong>Erstellen</strong>.</li>
                      <li>Geben Sie als Projektname <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">vereinsmanager</code> ein.</li>
                      <li>Wählen Sie den Ordnerpfad (z.B. <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">/docker/vereinsmanager</code>).</li>
                      <li>Fügen Sie den Inhalt der <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">docker-compose.yml</code> ein.</li>
                      <li>Klicken Sie auf <strong>Projekt erstellen und starten</strong>.</li>
                    </ol>
                  </div>

                  {/* QNAP */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>QNAP NAS (Container Station)</span>
                    </div>
                    <ol className="text-2xs text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>Öffnen Sie im QTS die <strong>Container Station</strong>.</li>
                      <li>Wählen Sie <strong>Anwendungen (Applications)</strong> &rarr; <strong>Erstellen</strong>.</li>
                      <li>Vergeben Sie den Anwendungsnamen <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">vereinsmanager</code>.</li>
                      <li>Fügen Sie das YAML-Skript aus Schritt 2 ein.</li>
                      <li>Klicken Sie auf <strong>Erstellen</strong>. Die Anwendung startet automatisch.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* SCHRITT 5: Netzwerk, Fernzugriff & Sicherheit */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    5
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Schritt 5: Zugriff, Netzwerk & Sicherheit
                  </h4>
                </div>

                <div className="space-y-2.5 text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-blue-600" />
                      <span>Lokaler Zugriff im Vereinsheim:</span>
                    </div>
                    <p>
                      Geben Sie im Webbrowser eines beliebigen Computers im Vereinsheim-Netzwerk ein: 
                      <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono ml-1 font-bold text-blue-700 dark:text-blue-300">
                        http://[Server-IP]:8080
                      </code> (z.B. <code className="font-mono">http://192.168.178.50:8080</code>).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sicherer Fernzugriff für den Vorstand (Unterwegs & von zu Hause):</span>
                    </div>
                    <p>
                      Für maximalen Datenschutz empfehlen wir den Zugriff von außen über ein sicheres <strong>VPN</strong> (z.B. FRITZ!Box WireGuard VPN oder Tailscale). Dadurch müssen keine unsicheren Ports im Router ins Internet geöffnet werden.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: 🔄 1-KLICK DATEN-UMZUG & MIGRATION */}
          {/* ========================================================================= */}
          {activeTab === 'migration' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Migration Guidance Banner */}
              <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/80">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Nahtloser Umzug von der lokalen App in die Cloud oder auf den eigenen Server
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Sie haben die lokale App ausprobiert und bereits Mitglieder, Buchungen oder Konten eingepflegt? 
                      Mit unserem 1-Klick Migrationsassistenten nehmen Sie Ihren gesamten Datenbestand lückenlos mit – ganz ohne doppelte Arbeit oder Datenverlust!
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Summary Card (Live Counts) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Aktueller Datenbestand auf diesem Gerät
                    </h4>
                  </div>
                  <button
                    onClick={loadStats}
                    className="text-2xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Aktualisieren
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="text-2xs text-slate-500 dark:text-slate-400">Mitglieder</div>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {localStats?.members ?? '–'}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="text-2xs text-slate-500 dark:text-slate-400">Buchungen</div>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {localStats?.transactions ?? '–'}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="text-2xs text-slate-500 dark:text-slate-400">Bankkonten</div>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {localStats?.accounts ?? '–'}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="text-2xs text-slate-500 dark:text-slate-400">Inventar / SEPA</div>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {(localStats?.inventory ?? 0) + (localStats?.sepaRuns ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1 & Step 2 Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1: Backup Download */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Schritt 1: Sicherheits-Backup
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      1-Klick Komplettsicherung herunterladen
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Sichern Sie vor jedem Umzug alle Vereinsdaten in einer verschlüsselten JSON-Sicherungsdatei auf Ihrer Festplatte.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Komplett-Backup (.json) sichern</span>
                  </button>
                </div>

                {/* Step 2: Direct Cloud Transfer */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Schritt 2: Direkte Cloud-Übertragung
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Alle Daten in Supabase Cloud hochladen
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Überträgt alle Mitglieder, Buchungen und Konten direkt in Ihre zentrale Postgres-Cloud-Datenbank.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleMigrateToCloud}
                      disabled={migrationStatus.loading}
                      className="w-full py-2.5 px-4 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                    >
                      {migrationStatus.loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      <span>
                        {config.isConfigured
                          ? '🚀 Lokale Daten jetzt in Cloud übertragen'
                          : '⚙️ Cloud-Zugang einrichten & übertragen'}
                      </span>
                    </button>

                    {!config.isConfigured && (
                      <div className="text-center text-2xs text-amber-600 dark:text-amber-400 font-medium">
                        Hinweis: Tragen Sie zuerst im Tab „Cloud-Setup“ Ihre Supabase-URL ein.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Migration Status Message */}
              {migrationStatus.message && (
                <div
                  className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in ${
                    migrationStatus.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  {migrationStatus.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{migrationStatus.message}</span>
                </div>
              )}

              {/* Data Safety & Guarantee Note */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-2xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    100% Datenerhalt garantiert:
                  </div>
                  <p>
                    Ihre lokalen Daten auf diesem Computer werden beim Umzug <strong>niemals gelöscht</strong>. Sie verbleiben als zusätzliche Sicherheitskopie in der lokalen IndexedDB-Datenbank.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: 👥 VORSTAND & BENUTZERVERWALTUNG (AUTH) */}
          {/* ========================================================================= */}
          {activeTab === 'auth' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {authSession.isAuthenticated ? (
                <div className="p-6 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                        {authSession.user?.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{authSession.user?.email}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Rolle: <span className="font-bold text-emerald-700 dark:text-emerald-400">{authSession.user?.role || 'Vorstandsmitglied'}</span>
                          {authSession.user?.clubName && ` • ${authSession.user.clubName}`}
                        </div>
                        <div className="text-2xs text-slate-400 mt-0.5">
                          Angemeldet über Supabase Auth (Cloud)
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Abmelden
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                  <div className="flex justify-center mb-5">
                    <div className="inline-flex p-1 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setAuthStatus({ loading: false }); }}
                        className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                          authMode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Anmelden
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('register'); setAuthStatus({ loading: false }); }}
                        className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                          authMode === 'register' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Neuen Vorstand anlegen
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-Mail-Adresse</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          required
                          placeholder="vorstand@mein-verein.de"
                          value={authEmail}
                          onChange={e => setAuthEmail(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Passwort</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {authMode === 'register' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vorstandsfunktion / Rolle</label>
                          <select
                            value={authRole}
                            onChange={e => setAuthRole(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-medium"
                          >
                            <option value="1. Vorsitzender">1. Vorsitzender</option>
                            <option value="2. Vorsitzender">2. Vorsitzender</option>
                            <option value="Kassenwart / Schatzmeister">Kassenwart / Schatzmeister</option>
                            <option value="Schriftführer">Schriftführer</option>
                            <option value="Sportwart / Abteilungsleiter">Sportwart / Abteilungsleiter</option>
                            <option value="Jugendwart">Jugendwart</option>
                            <option value="Zeugwart">Zeugwart</option>
                            <option value="Kassenprüfer (Leserechte)">Kassenprüfer (Leserechte)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vereinsname</label>
                          <input
                            type="text"
                            placeholder="TSV Musterstadt 1890 e.V."
                            value={authClub}
                            onChange={e => setAuthClub(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={authStatus.loading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authStatus.loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{authMode === 'login' ? 'Jetzt Anmelden' : 'Vorstandsmitglied registrieren'}</span>
                    </button>
                  </form>

                  {authStatus.error && (
                    <div className="mt-3.5 p-3 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-2xs rounded-xl flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authStatus.error}</span>
                    </div>
                  )}

                  {authStatus.success && (
                    <div className="mt-3.5 p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-2xs rounded-xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{authStatus.success}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-2xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">Hinweis zur Benutzerverwaltung:</div>
                <p>
                  Vorstandsmitglieder und Passwörter können im Supabase Dashboard unter <strong>Authentication &rarr; Users</strong> verwaltet werden. Einladungen können direkt per E-Mail an neue Vorstandsmitglieder verschickt werden.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer (shrink-0) */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Tatsächlicher Systemstatus: </span>
            <strong className="text-slate-900 dark:text-white font-bold">{
              isCloudActive ? '☁️ Cloud (Supabase EU aktiv & verbunden)' : isSelfhostedActive ? '🐳 Eigener Server / NAS (Docker aktiv)' : '💻 Lokale Desktop-App (IndexedDB aktiv)'
            }</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
};
