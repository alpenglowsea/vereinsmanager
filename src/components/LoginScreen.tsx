import React, { useState } from 'react';
import { AppUser, ClubSettings, DeploymentMode } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Building2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HardDrive,
  Cloud,
  Server,
  UserPlus,
  Mail,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface LoginScreenProps {
  settings?: ClubSettings;
  deploymentMode: DeploymentMode;
  onLoginSuccess: (user: AppUser) => void;
  onOpenDeploymentHub?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  deploymentMode,
  onLoginSuccess,
  onOpenDeploymentHub
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regClubName, setRegClubName] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clubName = settings?.clubName || 'VereinsManager';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!usernameInput.trim()) {
      setErrorMsg('Bitte geben Sie Ihren Benutzernamen oder Ihre E-Mail ein.');
      return;
    }
    if (!passwordInput) {
      setErrorMsg('Bitte geben Sie Ihr Passwort ein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.login(usernameInput, passwordInput);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || 'Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler bei der Anmeldung.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await AuthService.loginDemo();
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg('Demo-Zugang konnte nicht geladen werden.');
      }
    } catch {
      setErrorMsg('Fehler beim Demo-Login.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regClubName.trim()) {
      setErrorMsg('Bitte geben Sie den Namen Ihres Vereins ein.');
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg('Bitte Ihren Namen (Vorstand/Ansprechpartner) eingeben.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Bitte eine gültige E-Mail-Adresse angeben.');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setErrorMsg('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Das Passwort muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.register({
        clubName: regClubName,
        name: regFullName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
        customRoleName: '1. Vorsitzender (Admin)'
      });

      if (res.success && res.user) {
        // Initialize the live club settings with the entered club name
        await StorageService.initLiveClub(regClubName, regFullName, regEmail);
        setSuccessMsg(res.message || 'Konto erfolgreich angelegt! Anmeldung erfolgt...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 600);
      } else {
        setErrorMsg(res.message || 'Registrierung fehlgeschlagen.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unerwarteter Fehler bei der Registrierung.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setActiveTab('login');
    setUsernameInput('admin');
    setPasswordInput('admin');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-3 ring-4 ring-white/10">
              <Building2 className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              {activeTab === 'login' ? clubName : 'Neues Vereinskonto anlegen'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {activeTab === 'login'
                ? 'VereinsManager – Sichere Vereinsverwaltung'
                : 'Kostenlos starten & Verein nach DSGVO verwalten'}
            </p>

            {/* Tab Switcher */}
            <div className="mt-5 grid grid-cols-2 p-1 bg-slate-800/80 border border-slate-700/60 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'register'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Registrieren</span>
              </button>
            </div>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-7 space-y-5">
            {/* Feedback Messages */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}
            {successMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{successMsg}</div>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Benutzername oder E-Mail
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="z. B. admin oder vorstand@verein.de"
                        autoComplete="username"
                        autoFocus
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Passwort
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Anmelden</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-2xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    Oder Demo testen
                  </span>
                </div>

                {/* Demo Access Action Box */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Getrennter Demo-Modus (Sandbox)</span>
                  </div>
                  <p className="text-2xs text-amber-800/90 leading-relaxed">
                    Testen Sie alle Funktionen mit fiktiven Beispieldaten (<code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded text-amber-900 font-semibold">TSV Musterstadt</code>). Echte Vereinsdaten bleiben strikt getrennt.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      disabled={loading}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      <span>Demo-Modus starten</span>
                    </button>
                    <button
                      type="button"
                      onClick={fillDemoCredentials}
                      className="py-2 px-3 bg-white hover:bg-amber-100/50 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      title="Demo-Zugangsdaten eintragen"
                    >
                      admin / admin
                    </button>
                  </div>
                </div>

                {/* Switch to Register */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  >
                    Noch kein Vereinskonto? Jetzt registrieren →
                  </button>
                </div>
              </>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <>
                <form onSubmit={handleRegister} className="space-y-3.5">
                  {/* Mode explanation banner */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-2xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      {deploymentMode === 'local' && <HardDrive className="w-3.5 h-3.5 text-emerald-600" />}
                      {deploymentMode === 'cloud' && <Cloud className="w-3.5 h-3.5 text-blue-600" />}
                      {deploymentMode === 'selfhosted' && <Server className="w-3.5 h-3.5 text-purple-600" />}
                      <span>
                        Betriebsmodus:{' '}
                        {deploymentMode === 'local'
                          ? 'Lokaler Speicher (IndexedDB)'
                          : deploymentMode === 'cloud'
                          ? 'Supabase Cloud (EU)'
                          : 'Docker Selbsthosting'}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      {deploymentMode === 'local' &&
                        'Ihre Daten verbleiben verschlüsselt auf diesem Gerät. Bei Bedarf jederzeit in die Cloud übertragbar.'}
                      {deploymentMode === 'cloud' &&
                        'Das Benutzerkonto wird in Supabase angelegt und die Vereinsdaten werden in der Cloud gesichert.'}
                      {deploymentMode === 'selfhosted' &&
                        'Das Konto wird auf Ihrer eigenen Vereins-Serverinfrastruktur angelegt.'}
                    </p>
                  </div>

                  {/* Club Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Vereinsname *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regClubName}
                        onChange={(e) => setRegClubName(e.target.value)}
                        placeholder="z. B. SV Eintracht 1924 e.V."
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Vor- & Nachname (Vorstand / Admin) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="z. B. Klaus Weber"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      E-Mail-Adresse *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="vorstand@mein-verein.de"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Username & Password Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="vorstand"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Passwort *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Passwort wiederholen *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Vereinskonto erstellen & starten</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Back to login button */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                  >
                    ← Bereits registriert? Zum Login
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer Info */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500">
            <div className="flex items-center gap-1.5">
              {deploymentMode === 'local' && (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold text-slate-700">Lokal (Browser-Speicher)</span>
                </>
              )}
              {deploymentMode === 'cloud' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-700">Cloud (Supabase EU)</span>
                </>
              )}
              {deploymentMode === 'selfhosted' && (
                <>
                  <Server className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-semibold text-slate-700">Docker Selbsthosting</span>
                </>
              )}
            </div>

            {onOpenDeploymentHub && (
              <button
                type="button"
                onClick={onOpenDeploymentHub}
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
              >
                Betriebsmodus ändern
              </button>
            )}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-3.5 text-center text-2xs text-slate-400">
          DSGVO-konform • Rollen & Rechte unter Einstellungen verwaltbar
        </div>
      </div>
    </div>
  );
};
