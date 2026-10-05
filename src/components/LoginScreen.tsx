import React, { useState } from 'react';
import { ClubSettings } from '../types';
import { AuthService } from '../services/authService';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  HardDrive
} from 'lucide-react';

interface LoginScreenProps {
  settings?: ClubSettings;
  onLoginSuccess: () => void;
}

/**
 * Anmeldebildschirm im lokalen Betrieb.
 *
 * Es gibt genau ein Passwort pro Gerät (siehe authService.ts) — keine
 * einzelnen Benutzerkonten, keine Bereichsrechte mehr. "Registrieren" legt
 * dieses eine Passwort fest; das geht nur, solange noch keines existiert.
 * Was danach mit den Vereinsdaten passiert (neuer Verein oder Import einer
 * Sicherung), entscheidet erst das EinrichtungsModal NACH der Anmeldung.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ settings, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clubName = settings?.clubName || 'VereinsManager';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!usernameInput.trim() || !passwordInput) {
      setErrorMsg('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.meldeAn(usernameInput, passwordInput);
      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMsg(res.message || 'Anmeldung fehlgeschlagen.');
      }
    } catch {
      setErrorMsg('Unerwarteter Fehler bei der Anmeldung.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await AuthService.loginDemo();
      onLoginSuccess();
    } catch {
      setErrorMsg('Fehler beim Demo-Login.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setErrorMsg('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (!regPassword) {
      setErrorMsg('Bitte ein Passwort vergeben.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.registriere(regUsername, regPassword);
      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMsg(res.message || 'Registrierung fehlgeschlagen.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unerwarteter Fehler bei der Registrierung.');
    } finally {
      setLoading(false);
    }
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

            <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3 ring-4 ring-white/10 p-1.5 overflow-hidden">
              <img
                src={settings?.clubLogoUrl || '/logo_transparent.png'}
                alt={clubName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                    e.currentTarget.src = '/logo_transparent.png';
                  }
                }}
              />
            </div>

            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              {activeTab === 'login' ? clubName : 'Gerätepasswort anlegen'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {activeTab === 'login'
                ? 'VereinsManager – Sichere Vereinsverwaltung'
                : 'Einmalig für dieses Gerät'}
            </p>

            {/* Tab Switcher */}
            <div className="mt-5 grid grid-cols-2 p-1 bg-slate-800/80 border border-slate-700/60 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Anmelden</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg(null);
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'register'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Registrieren</span>
              </button>
            </div>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-7 space-y-5">
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Benutzername</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        autoComplete="username"
                        autoFocus
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Passwort</label>
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

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-2xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    Oder Demo testen
                  </span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Getrennter Demo-Modus</span>
                  </div>
                  <p className="text-2xs text-amber-800/90 leading-relaxed">
                    Testen Sie alle Funktionen mit fiktiven Beispieldaten. Echte Vereinsdaten bleiben strikt getrennt.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      disabled={loading}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      <span>Demo-Modus starten</span>
                    </button>
                  </div>
                </div>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  >
                    Noch kein Konto auf diesem Gerät? Jetzt anlegen →
                  </button>
                </div>
              </>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <>
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Benutzername *</label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="z. B. vorstand"
                      autoFocus
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Passwort *</label>
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

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Passwort wiederholen *</label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>

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
                        <span>Konto anlegen & starten</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                  >
                    ← Bereits eingerichtet? Zum Login
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer Info */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center gap-1.5 text-2xs text-slate-500">
            <HardDrive className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold text-slate-700">Nur dieses Gerät</span>
          </div>
        </div>
      </div>
    </div>
  );
};
