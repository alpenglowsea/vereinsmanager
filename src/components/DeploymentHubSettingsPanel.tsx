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

interface DeploymentHubSettingsPanelProps {
  currentMode: DeploymentMode;
  onModeChange: (mode: DeploymentMode) => void;
  onDataReload?: () => void;
}

export const DeploymentHubSettingsPanel: React.FC<DeploymentHubSettingsPanelProps> = ({
  currentMode,
  onModeChange,
  onDataReload
}) => {
  // Config state
  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const isCloudConfigured = Boolean(config.isConfigured && config.url && config.anonKey);

  // Determine actual runtime active mode
  const isCloudActive = currentMode === 'cloud' && isCloudConfigured;
  const isSelfhostedActive = currentMode === 'selfhosted';
  const isLocalActive = !isCloudActive && !isSelfhostedActive;

  // Active sub-tab state inside Betriebsmodi
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
      alert('Bitte tragen Sie zuerst im Reiter „2. Cloud-Setup“ Ihre Supabase Project URL und den Anon Key ein.');
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-600 dark:bg-emerald-500 text-white rounded-2xl shadow-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Betriebsmodi & Deployment Hub
                </h3>
                <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Umzugs- & Cloud-Zentrale
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Konfigurieren Sie die Betriebsart für Ihren Verein: Lokale Desktop-App, DSGVO-Cloud (Multi-User) oder eigener Docker-Server.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-2xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Aktiver Status: </span>
            <strong className="text-slate-900 dark:text-white font-bold">
              {isCloudActive
                ? 'Cloud (Supabase EU aktiv)'
                : isSelfhostedActive
                ? 'Eigener Server / Docker'
                : 'Lokale IndexedDB (Offline)'}
            </strong>
          </div>
        </div>

        {/* Mode Selector Cards (3 Core Pillars) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-5">
          {/* 1. Lokale Desktop-App */}
          <div
            onClick={() => setActiveTab('desktop')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isLocalActive
                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                : activeTab === 'desktop'
                ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-400 dark:border-slate-600'
                : 'bg-slate-50/60 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
                  <Laptop className="w-5 h-5" />
                </span>
                {isLocalActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                    <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 rounded-full font-medium">
                    Anleitung
                  </span>
                )}
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">1. Lokale Desktop-App</h4>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                App herunterladen (.exe, .dmg, .AppImage) & sofort 100% offline loslegen. Keine Server nötig.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-2xs text-amber-700 dark:text-amber-400 font-bold">
              <span>0,00 € Kosten • Offline</span>
              <span className="text-slate-400 font-normal">Standard</span>
            </div>
          </div>

          {/* 2. Cloud-Betrieb */}
          <div
            onClick={() => setActiveTab('cloud')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isCloudActive
                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                : activeTab === 'cloud'
                ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-400 dark:border-slate-600'
                : 'bg-slate-50/60 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl">
                  <Cloud className="w-5 h-5" />
                </span>
                {isCloudActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 rounded-full font-medium">
                    {isCloudConfigured ? 'Konfiguriert' : 'Nicht konfiguriert'}
                  </span>
                )}
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">2. Cloud-Betrieb (Multi-User)</h4>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Echtzeit-Synchronisation für den gesamten Vorstand über Webhoster oder Desktop + DSGVO-Cloud.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-2xs text-emerald-700 dark:text-emerald-400 font-bold">
              <span>DSGVO-konform (EU)</span>
              <span className="text-emerald-600 dark:text-emerald-400">Vorstände</span>
            </div>
          </div>

          {/* 3. Eigener Server / Docker */}
          <div
            onClick={() => setActiveTab('docker')}
            className={`cursor-pointer rounded-2xl p-4 transition-all border-2 relative flex flex-col justify-between ${
              isSelfhostedActive
                ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                : activeTab === 'docker'
                ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-400 dark:border-slate-600'
                : 'bg-slate-50/60 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-xl">
                  <Server className="w-5 h-5" />
                </span>
                {isSelfhostedActive ? (
                  <span className="px-2.5 py-0.5 text-2xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-full flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                    <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Aktiver Modus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 rounded-full font-medium">
                    Anleitung
                  </span>
                )}
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">3. Eigener Server (Docker)</h4>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Betrieb im Vereinsheim auf Synology NAS, QNAP, Raspberry Pi oder Linux vServer via Docker.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-2xs text-blue-700 dark:text-blue-400 font-bold">
              <span>100% Datenhoheit</span>
              <span className="text-slate-400 font-normal">Selbsthoster</span>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pt-6 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'desktop'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>1. Lokale Desktop-App</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cloud'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>2. Cloud-Setup (Alle Hoster)</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('docker')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'docker'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>3. Eigener Server & Docker</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('migration')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'migration'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>🔄 1-Klick Daten-Umzug</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'auth'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>👥 Vorstand & Benutzer (Auth)</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Content Area */}
      <div className="space-y-6">

        {/* ========================================================================= */}
        {/* SUB-TAB: 1. LOKALE DESKTOP-APP */}
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
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">Windows (.exe / .msi)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Für Windows 10 & 11. Einfache 1-Klick Installation mit Desktop-Verknüpfung und automatischem Auto-Updater.
                    </p>
                  </div>
                  <a
                    href="https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Setup_x64.exe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-2xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>.exe herunterladen</span>
                  </a>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">macOS (.dmg)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Für Apple Silicon (M1/M2/M3/M4) & Intel Macs. Einfach in den Programme-Ordner ziehen.
                    </p>
                  </div>
                  <a
                    href="https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_macOS.dmg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-2xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>.dmg herunterladen</span>
                  </a>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">Linux (.AppImage / .deb)</div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Für Ubuntu, Debian, Fedora, Arch & Co. Sofort ohne Installation direkt ausführbar.
                    </p>
                  </div>
                  <a
                    href="https://github.com/strelitzerfc/vereinsmanager/releases/latest/download/VereinsManager_Linux.AppImage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-2xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>.AppImage laden</span>
                  </a>
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
        {/* SUB-TAB: 2. CLOUD-SETUP */}
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

            {/* SCHRITT B: Zugangsdaten eintragen & Verbindung aktivieren */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                  B
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Verbindungsdaten eintragen & Cloud-Modus aktivieren
                </h4>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Kopieren Sie aus Ihrem Supabase Dashboard unter <strong>Project Settings &rarr; API</strong> die Project URL und den <code>anon public</code> API Key:
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Project URL (Supabase API URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://abcdefghijklm.supabase.co"
                    value={config.url}
                    onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Anon / Public Key (API Key)
                  </label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={config.anonKey}
                    onChange={e => setConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={testStatus.loading}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {testStatus.loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Speichern & Cloud aktivieren</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus.loading || !config.url || !config.anonKey}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verbindung testen</span>
                  </button>

                  {isCloudConfigured && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Möchten Sie die Cloud-Verbindungsdaten entfernen und zur lokalen Offline-Datenbank zurückkehren?')) {
                          clearStoredSupabaseConfig();
                          setConfig(getStoredSupabaseConfig());
                          StorageService.setDeploymentMode('local');
                          onModeChange('local');
                          onDataReload?.();
                        }
                      }}
                      className="px-3 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-colors cursor-pointer ml-auto"
                    >
                      Verbindung trennen
                    </button>
                  )}
                </div>
              </form>

              {testStatus.message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    testStatus.success
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {testStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>

            {/* SCHRITT C: Webhosting Optionen */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                  C
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Frontend bei beliebigem Hoster bereitstellen
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Klassischer Webspace</span>
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Hetzner, Strato, IONOS, ALL-INKL, Host Europe oder netcup. Einfach den Inhalt des <code>dist/</code> Ordners per SFTP hochladen.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Moderne Cloud-Plattformen</span>
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Netlify, Vercel, Cloudflare Pages oder Render. Automatische Builds direkt bei Git-Push.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-amber-600" />
                    <span>Hybrid: Desktop + Cloud</span>
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sie können auch die lokale Desktop-App mit der Supabase-Cloud verbinden und haben so eine native App mit Vorstandssynchronisation!
                  </p>
                </div>
              </div>

              {/* Zero-Touch Updates Info for Cloud */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 text-2xs text-emerald-900 dark:text-emerald-200">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                    Zero-Touch Updates im Cloud-Betrieb
                  </div>
                  <p className="leading-relaxed">
                    Im Cloud-/Webhosting-Betrieb ist für Benutzer kein manuelles Herunterladen oder Installieren von Updates nötig. 
                    Sobald ein Update auf Ihrem Webhoster oder via Git-Push bereitgestellt wird, lädt der Browser automatisch im Hintergrund die neueste Version (Service Worker / PWA Auto-Reload) – 100% wartungsfrei für alle Vorstandsmitglieder.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-TAB: 3. EIGENER SERVER & DOCKER */}
        {/* ========================================================================= */}
        {activeTab === 'docker' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Introduction Banner */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800/60 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-3">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-blue-950 dark:text-blue-100 text-xs sm:text-sm">
                  Modus 3: Betrieb auf eigenem Vereinsheim-Server, NAS oder Linux vServer
                </div>
                <div className="mt-1 leading-relaxed">
                  Mit Docker betreiben Sie den VereinsManager komplett autonom auf Ihrer eigenen Hardware. 
                  Alle Daten bleiben im Vereinsheim oder auf Ihrem gemieteten Server – ideal für maximale digitale Souveränität.
                </div>
              </div>
            </div>

            {/* Mode Switcher / Status Bar */}
            {isSelfhostedActive ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-200 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Dieser Computer/Browser ist aktuell auf den Modus „Eigener Server (Docker)“ eingestellt.</span>
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
                    docker compose logs -f
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                    4. Aufruf im Vereinsheim-Browser:
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 rounded-xl border border-blue-200 dark:border-blue-800 text-2xs">
                    Öffnen Sie <code className="font-bold font-mono">http://IP-DES-SERVERS:8080</code> (z.B. <code className="font-mono">http://192.168.178.50:8080</code> oder Ihre Vereinsheim-Domain).
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-TAB: 4. 1-KLICK DATEN-UMZUG & MIGRATION */}
        {/* ========================================================================= */}
        {activeTab === 'migration' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Overview Banner */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <FolderSync className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                  Lückenlose Daten-Migration: Von Offline nach Cloud mit einem Klick
                </div>
                <div className="mt-1 leading-relaxed">
                  Sie haben die VereinsManager-App bisher lokal genutzt und möchten jetzt alle Mitglieder, Finanzbuchungen, Bankkonten, Belege und Inventargegenstände in Ihre Cloud übertragen? 
                  Der Assistent übernimmt den gesamten Datenumzug vollautomatisch.
                </div>
              </div>
            </div>

            {/* Local Data Stats Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Aktueller lokaler Datenbestand auf diesem Gerät</span>
                </h4>
                <button
                  type="button"
                  onClick={loadStats}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Aktualisieren</span>
                </button>
              </div>

              {localStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Mitglieder</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.members}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Buchungen</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.transactions}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Finanzkonten</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.accounts}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-slate-500 dark:text-slate-400 text-2xs">Inventar</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.inventory}</div>
                  </div>
                </div>
              ) : (
                <div className="text-2xs text-slate-400">Statistiken werden geladen...</div>
              )}
            </div>

            {/* Migration Action Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                <span>Migration jetzt durchführen</span>
              </h4>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Klicken Sie auf den Button unten, um den Transfer zu starten. 
                Ihre lokalen Daten bleiben als Offline-Sicherung erhalten und werden nicht gelöscht.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleMigrateToCloud}
                  disabled={migrationStatus.loading || !config.isConfigured}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {migrationStatus.loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>Lokale Daten jetzt in die Cloud übertragen</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Sicherheits-Backup (JSON)</span>
                </button>
              </div>

              {!config.isConfigured && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-2xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Bitte konfigurieren Sie zuerst im Reiter <strong>„2. Cloud-Setup“</strong> die Zugangsdaten zu Ihrer Supabase-Datenbank.</span>
                </div>
              )}

              {migrationStatus.message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    migrationStatus.success
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {migrationStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{migrationStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-TAB: 5. VORSTAND & BENUTZER (AUTH) */}
        {/* ========================================================================= */}
        {activeTab === 'auth' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Banner */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/50 rounded-2xl border border-purple-200 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-200 flex items-start gap-3">
              <User className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-purple-950 dark:text-purple-100 text-xs sm:text-sm">
                  Multi-User & Vorstandskonten (Supabase Auth)
                </div>
                <div className="mt-1 leading-relaxed">
                  Im Cloud-Modus können sich mehrere Vorstände (Kassenwart, 1. Vorsitzender, Schriftführer) mit individuellen Login-Daten anmelden und synchron arbeiten.
                </div>
              </div>
            </div>

            {authSession.isAuthenticated && authSession.user ? (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
                      {authSession.user.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {authSession.user.email}
                      </div>
                      <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Angemeldet & Berechtigt</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Abmelden</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-2xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div><strong>Benutzer-ID:</strong> <span className="font-mono">{authSession.user.id}</span></div>
                  <div><strong>Letzte Anmeldung:</strong> {authSession.user.lastSignIn ? new Date(authSession.user.lastSignIn).toLocaleString('de-DE') : 'Jetzt'}</div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-3 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Anmelden
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Neues Vorstandskonto registrieren
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      authMode === 'forgot'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Passwort vergessen
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-Mail-Adresse</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        placeholder="vorstand@mein-verein.de"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Passwort</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        required={authMode !== 'forgot'}
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
    </div>
  );
};
