import React, { useState } from 'react';
import { AppUser, ClubSettings } from '../types';
import { AuthService } from '../services/authService';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Lock, LogOut } from 'lucide-react';

interface ForcedPasswordChangeScreenProps {
  settings?: ClubSettings;
  user: AppUser;
}

/**
 * Pflicht-Passwortänderung im gehosteten Betrieb.
 * ---------------------------------------------------------------------------
 *
 * Wird angezeigt, sobald AppUser.mustChangePassword gesetzt ist — das ist
 * genau dann der Fall, wenn ein Vorstand ein neues Konto mit einem
 * Anfangspasswort angelegt hat (siehe LocalServerUserAdminPanel) und die
 * betroffene Person sich damit zum ersten Mal anmeldet. Der Schirm blockiert
 * bewusst die ganze Anwendung, bis ein eigenes Passwort gesetzt ist — das
 * Anfangspasswort kennt (mindestens) auch der Vorstand, der es vergeben hat.
 *
 * Eingebunden in App.tsx, direkt hinter dem Anmelde-Gate und vor jedem
 * anderen Bildschirm: siehe dort `if (currentUser?.mustChangePassword) {...}`.
 *
 * Nach einer erfolgreichen Änderung meldet AuthService.changePasswordSelfhosted
 * automatisch mit dem neuen Passwort erneut an und benachrichtigt seine
 * Listener (onAuthStateChanged) — App.tsx aktualisiert daraufhin authSession
 * von selbst, mustChangePassword ist dann false, und dieser Schirm
 * verschwindet ohne dass diese Komponente selbst etwas dafür tun müsste.
 */
export const ForcedPasswordChangeScreen: React.FC<ForcedPasswordChangeScreenProps> = ({
  settings,
  user
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clubName = settings?.clubName || 'VereinsManager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword !== newPasswordConfirm) {
      setErrorMsg('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('Das neue Passwort muss sich vom bisherigen unterscheiden.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.changePasswordSelfhosted(currentPassword, newPassword);
      if (!res.success) {
        setErrorMsg(res.message || 'Das Passwort konnte nicht geändert werden.');
        setLoading(false);
      }
      // Bei Erfolg keine weitere Aktion nötig — der Schirm verschwindet von
      // selbst (siehe Erklärung oben), loading bleibt bewusst an, bis das
      // geschieht, damit die Maske nicht kurz "fertig" aussieht und dann
      // doch noch etwas passiert.
    } catch {
      setErrorMsg('Unerwarteter Fehler beim Ändern des Passworts.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
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
              Passwort ändern erforderlich
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Willkommen, {user.name || user.email}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-full text-2xs font-bold text-purple-100">
              <KeyRound className="w-3 h-3" />
              <span>Gehosteter Betrieb · Eigener Server</span>
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

            <div className="flex items-start gap-2 p-3 bg-purple-50/80 border border-purple-200/80 rounded-xl text-2xs text-purple-900 leading-relaxed">
              <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                Ihr Konto wurde mit einem Anfangspasswort eingerichtet. Bevor Sie
                fortfahren können, legen Sie bitte Ihr eigenes, nur Ihnen bekanntes
                Passwort fest.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Bisheriges (Anfangs-)Passwort *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Neues Passwort *</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Wiederholen *</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Passwort ändern & anmelden</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Abmelden: Falls jemand das Anfangspasswort gerade nicht zur
                Hand hat, soll niemand in dieser Maske gefangen sein. */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => AuthService.logout()}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold hover:underline cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
