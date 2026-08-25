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
  Globe
} from 'lucide-react';

interface DeploymentHubModalProps {
  currentMode: DeploymentMode;
  onModeChange: (mode: DeploymentMode) => void;
  onDataReload: () => void;
  onClose: () => void;
}

export const DeploymentHubModal: React.FC<DeploymentHubModalProps> = ({
  currentMode,
  onModeChange,
  onDataReload,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'docker' | 'local' | 'auth'>('cloud');
  const [selectedMode, setSelectedMode] = useState<DeploymentMode>(currentMode);
  
  // Supabase Config State
  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [migrationStatus, setMigrationStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);

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
  }, []);

  const loadAuth = async () => {
    const session = await getAuthSession();
    setAuthSession(session);
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
        ? 'Verbindung zu Supabase erfolgreich hergestellt!'
        : `Fehler: ${res.error || 'Verbindung fehlgeschlagen'}`
    });

    if (res.success) {
      StorageService.setDeploymentMode('cloud');
      setSelectedMode('cloud');
      onModeChange('cloud');
      onDataReload();
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    const res = await testSupabaseConnection(config.url, config.anonKey);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.success
        ? 'Verbindung zu Supabase (Frankfurt) erfolgreich aktiv!'
        : `Fehler: ${res.error || 'Verbindung fehlgeschlagen'}`
    });
  };

  const handleSwitchMode = (mode: DeploymentMode) => {
    setSelectedMode(mode);
    StorageService.setDeploymentMode(mode);
    onModeChange(mode);
    onDataReload();
  };

  const handleMigrateToCloud = async () => {
    if (!window.confirm('Möchten Sie alle lokal gespeicherten Mitglieder, Finanzbuchungen, Konten und das Inventar jetzt in Ihre Supabase Cloud-Datenbank übertragen?')) {
      return;
    }

    setMigrationStatus({ loading: true });
    try {
      const res = await StorageService.migrateLocalToCloud();
      setMigrationStatus({
        loading: false,
        success: true,
        message: `Erfolgreich übertragen: ${res.members} Mitglieder, ${res.transactions} Buchungen, ${res.accounts} Konten, ${res.inventory} Inventargegenstände.`
      });
      onModeChange('cloud');
      onDataReload();
    } catch (err: any) {
      setMigrationStatus({
        loading: false,
        success: false,
        message: err.message || 'Fehler bei der Datenübertragung.'
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
        onDataReload();
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
    onDataReload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Betriebsmodus & Deployment Hub</h2>
              <p className="text-xs text-slate-500">
                Wählen Sie zwischen 1-Klick Cloud (IONOS + Supabase EU), Docker-Selbsthosting oder lokalem Einzelplatz.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-6 bg-slate-100/60 border-b border-slate-200">
          {/* Cloud Option */}
          <div
            onClick={() => {
              setActiveTab('cloud');
              if (config.isConfigured) handleSwitchMode('cloud');
            }}
            className={`cursor-pointer rounded-xl p-4 transition-all border-2 relative ${
              selectedMode === 'cloud'
                ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Cloud className="w-5 h-5" />
              </span>
              {selectedMode === 'cloud' && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktiv
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Option A: 1-Klick Cloud</h3>
            <p className="text-xs text-slate-500 mt-1">
              IONOS Deploy Now + Supabase EU (Frankfurt). Echtzeit-Sync für den gesamten Vorstand.
            </p>
            <div className="mt-3 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              Empfohlen für Vereine (~1€/Monat)
            </div>
          </div>

          {/* Docker Option */}
          <div
            onClick={() => {
              setActiveTab('docker');
              handleSwitchMode('selfhosted');
            }}
            className={`cursor-pointer rounded-xl p-4 transition-all border-2 relative ${
              selectedMode === 'selfhosted'
                ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Server className="w-5 h-5" />
              </span>
              {selectedMode === 'selfhosted' && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktiv
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Option B: Selbsthoster</h3>
            <p className="text-xs text-slate-500 mt-1">
              Docker / docker-compose auf eigenem Synology NAS, Raspberry Pi oder Linux vServer.
            </p>
            <div className="mt-3 text-[11px] text-blue-700 font-medium">
              100% Eigene Datenhoheit
            </div>
          </div>

          {/* Local Option */}
          <div
            onClick={() => {
              setActiveTab('local');
              handleSwitchMode('local');
            }}
            className={`cursor-pointer rounded-xl p-4 transition-all border-2 relative ${
              selectedMode === 'local'
                ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white/80 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <HardDrive className="w-5 h-5" />
              </span>
              {selectedMode === 'local' && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktiv
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Option C: Lokaler Einzelplatz</h3>
            <p className="text-xs text-slate-500 mt-1">
              Browser-interne IndexedDB. Funktioniert 100% offline ohne Server oder Cloud.
            </p>
            <div className="mt-3 text-[11px] text-amber-700 font-medium">
              0,00 € Kosten & 0 Einrichtung
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'cloud'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4" /> Supabase & IONOS Setup
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'auth'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" /> Vorstand / Benutzer (Auth)
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'docker'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" /> Docker & NAS Anleitung
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'local'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" /> Lokale Datensicherung
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: CLOUD SETUP (SUPABASE & IONOS) */}
          {activeTab === 'cloud' && (
            <div className="space-y-6">
              
              {/* Instructions banner */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-sm text-emerald-900 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-950">100% DSGVO-konforme Cloud in Frankfurt am Main</div>
                  <div className="text-xs text-emerald-800 mt-1">
                    Mit Supabase in der Region <strong>Central EU (Frankfurt) / eu-central-1</strong> liegen alle Mitglieder- und Finanzdaten sicher verschlüsselt auf deutschen Servern. In Kombination mit IONOS Deploy Now (ab ~1 €/Monat) ist die Web-App blitzschnell erreichbar.
                  </div>
                </div>
              </div>

              {/* Supabase Credentials Form */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    Supabase Projekt-Zugangsdaten
                  </h4>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
                  >
                    Supabase Dashboard öffnen <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supabase Project URL (z.B. https://xyzcompany.supabase.co)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://xyzcompany.supabase.co"
                      value={config.url}
                      onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supabase Anon / Public Key
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.anonKey}
                      onChange={e => setConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={testStatus.loading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                      >
                        {testStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Speichern & Aktivieren
                      </button>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus.loading || !config.url || !config.anonKey}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
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
                          handleSwitchMode('local');
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                      >
                        Verbindung trennen
                      </button>
                    )}
                  </div>
                </form>

                {testStatus.message && (
                  <div
                    className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      testStatus.success
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {testStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testStatus.message}</span>
                  </div>
                )}
              </div>

              {/* 1-Click Migration Section */}
              <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-600" />
                      1-Klick Datenübertragung (Lokal &rarr; Supabase Cloud)
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl">
                      Übertragen Sie alle aktuell im Browser erfassten Mitglieder, Buchungen, Finanzkonten und Inventare mit einem Klick in Ihre Supabase-Datenbank.
                    </p>
                  </div>
                  <button
                    onClick={handleMigrateToCloud}
                    disabled={migrationStatus.loading || !config.isConfigured}
                    className={`px-4 py-2 text-xs font-bold rounded-lg shadow transition-all flex items-center gap-2 shrink-0 ${
                      config.isConfigured
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {migrationStatus.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Lokale Vereinsdaten jetzt hochladen
                  </button>
                </div>

                {migrationStatus.message && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      migrationStatus.success
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {migrationStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span>{migrationStatus.message}</span>
                  </div>
                )}
              </div>

              {/* SQL Schema Script Helper */}
              <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      Supabase SQL Initialisierungs-Skript
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Führen Sie dieses Skript einmalig im Supabase <strong>SQL Editor</strong> aus, um alle Tabellen und RLS-Sicherheitsregeln zu erstellen.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySql}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedSql ? 'Kopiert!' : 'SQL kopieren'}
                    </button>
                    <button
                      onClick={handleDownloadSql}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      .sql Herunterladen
                    </button>
                  </div>
                </div>

                <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-40 border border-slate-800">
                  {SUPABASE_SCHEMA_SQL.slice(0, 700)}...
                </pre>
              </div>

              {/* IONOS Deploy Now Guide */}
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-blue-600" />
                  Schritt-für-Schritt: IONOS Deploy Now Verknüpfung (~1€ / Monat)
                </h4>
                <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
                  <li>
                    Loggen Sie sich bei <strong>IONOS Deploy Now</strong> ein und wählen Sie <strong>"Neues Projekt"</strong>.
                  </li>
                  <li>
                    Wählen Sie Ihr Git-Repository aus und wählen Sie das Template <strong>Vite / Static</strong>.
                  </li>
                  <li>
                    Build Command: <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">npm run build</code> | Output Directory: <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">dist</code>
                  </li>
                  <li>
                    Fügen Sie in IONOS die Umgebungsvariablen <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> und <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> hinzu.
                  </li>
                  <li>
                    Klicken Sie auf <strong>Deploy</strong>. IONOS erstellt automatisch ein SSL-Zertifikat und stellt die App unter Ihrer Vereinsdomain bereit.
                  </li>
                </ol>
              </div>

            </div>
          )}

          {/* TAB 2: VORSTAND & BENUTZERVERWALTUNG (AUTH) */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              
              {authSession.isAuthenticated ? (
                <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                        {authSession.user?.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{authSession.user?.email}</div>
                        <div className="text-xs text-slate-600">
                          Rolle: <span className="font-semibold text-emerald-700">{authSession.user?.role || 'Vorstandsmitglied'}</span>
                          {authSession.user?.clubName && ` • ${authSession.user.clubName}`}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Angemeldet über Supabase Auth
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-rose-600 border border-slate-200 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Abmelden
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <div className="flex justify-center mb-4">
                    <div className="inline-flex p-1 bg-slate-200 rounded-lg text-xs font-semibold">
                      <button
                        onClick={() => { setAuthMode('login'); setAuthStatus({}); }}
                        className={`px-4 py-1.5 rounded-md transition-all ${
                          authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Anmelden
                      </button>
                      <button
                        onClick={() => { setAuthMode('register'); setAuthStatus({}); }}
                        className={`px-4 py-1.5 rounded-md transition-all ${
                          authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Neuen Vorstand anlegen
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-Mail-Adresse</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="email"
                          required
                          placeholder="vorstand@mein-verein.de"
                          value={authEmail}
                          onChange={e => setAuthEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Passwort</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {authMode === 'register' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Vorstandsfunktion / Rolle</label>
                          <select
                            value={authRole}
                            onChange={e => setAuthRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Vereinsname</label>
                          <input
                            type="text"
                            placeholder="TSV Musterstadt 1890 e.V."
                            value={authClub}
                            onChange={e => setAuthClub(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={authStatus.loading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      {authStatus.loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {authMode === 'login' ? 'Jetzt Anmelden' : 'Vorstandsmitglied registrieren'}
                    </button>
                  </form>

                  {authStatus.error && (
                    <div className="mt-3 p-3 bg-rose-100 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authStatus.error}</span>
                    </div>
                  )}

                  {authStatus.success && (
                    <div className="mt-3 p-3 bg-emerald-100 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{authStatus.success}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Hinweis zur Benutzerverwaltung:</div>
                <p>
                  Vorstandsmitglieder können im Supabase Dashboard unter <strong>Authentication &rarr; Users</strong> verwaltet werden. Einladungen können direkt per E-Mail verschickt werden.
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: DOCKER & NAS */}
          {activeTab === 'docker' && (
            <div className="space-y-6">
              
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-950 flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Docker-Container für NAS (Synology/QNAP) & vServer</div>
                  <div className="text-xs text-blue-800 mt-1">
                    Mit dem bereitgestellten <code className="font-mono font-bold">docker-compose.yml</code> können Sie den VereinsManager auf Ihrem eigenen Server starten.
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    docker-compose.yml
                  </h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`version: '3.8'

services:
  vereinsmanager:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vereinsmanager_app
    restart: unless-stopped
    ports:
      - "8080:80"`);
                      setCopiedDocker(true);
                      setTimeout(() => setCopiedDocker(false), 3000);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedDocker ? 'Kopiert!' : 'docker-compose kopieren'}
                  </button>
                </div>

                <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto border border-slate-800">
{`version: '3.8'

services:
  vereinsmanager:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vereinsmanager_app
    restart: unless-stopped
    ports:
      - "8080:80"`}
                </pre>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="font-bold text-slate-900">Starten im Terminal:</div>
                <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono rounded-lg">
                  docker compose up -d --build
                </div>
                <p className="text-slate-500">
                  Die App läuft anschließend unter <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">http://[Ihre-Server-IP]:8080</code>.
                </p>
              </div>

            </div>
          )}

          {/* TAB 4: LOKALER EINZELPLATZ */}
          {activeTab === 'local' && (
            <div className="space-y-6">
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-950 flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Lokaler Einzelplatzmodus (100% Offline & DSGVO-Sicher)</div>
                  <div className="text-xs text-amber-800 mt-1">
                    In diesem Modus werden alle Daten ausschließlich im lokalen Browser (IndexedDB) Ihres Rechners gespeichert. Es werden keinerlei Daten an Server übertragen.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    Datensicherung herunterladen (JSON)
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Exportieren Sie alle Vereinsdaten in eine verschlüsselte Sicherungsdatei.
                  </p>
                  <button
                    onClick={async () => {
                      const json = await StorageService.exportFullBackup();
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `VereinsManager_Sicherung_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    Komplett-Backup herunterladen
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Jederzeit in die Cloud wechseln
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Sie können später jederzeit ohne Datenverlust auf Supabase & IONOS umsteigen.
                  </p>
                  <button
                    onClick={() => setActiveTab('cloud')}
                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    Zum Cloud-Setup wechseln
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Aktueller Betriebsmodus: <strong className="text-slate-800">{
              selectedMode === 'cloud' ? 'Cloud (Supabase EU)' : selectedMode === 'selfhosted' ? 'Selbsthoster (Docker)' : 'Lokal (IndexedDB)'
            }</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
};
