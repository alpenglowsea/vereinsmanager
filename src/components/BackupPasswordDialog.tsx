import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

/**
 * Passwortabfrage beim Einspielen einer verschlüsselten Sicherung.
 *
 * Die Prüfung selbst macht der Aufrufer (`onEntschluesseln`); der Dialog zeigt
 * nur an, ob es geklappt hat. Bei falschem Passwort bleibt er offen, damit man
 * es erneut versuchen kann, ohne die Datei noch einmal auswählen zu müssen.
 */

interface BackupPasswordDialogProps {
  isOpen: boolean;
  dateiName: string;
  /** Gibt null bei Erfolg zurück, sonst die Fehlermeldung. */
  onEntschluesseln: (passwort: string) => Promise<string | null>;
  onAbbrechen: () => void;
}

export const BackupPasswordDialog: React.FC<BackupPasswordDialogProps> = ({
  isOpen,
  dateiName,
  onEntschluesseln,
  onAbbrechen
}) => {
  const [passwort, setPasswort] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (!isOpen) return null;

  const schliessen = () => {
    setPasswort('');
    setFehler(null);
    setZeigen(false);
    onAbbrechen();
  };

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwort || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const meldung = await onEntschluesseln(passwort);
      if (meldung) {
        setFehler(meldung);
      } else {
        setPasswort('');
        setZeigen(false);
      }
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <form
        onSubmit={absenden}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Verschlüsselte Sicherung</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{dateiName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={schliessen}
            disabled={laeuft}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Diese Sicherung ist mit einem Passwort geschützt. Bitte geben Sie das Passwort ein, das beim
            Erstellen vergeben wurde.
          </p>
          <div className="relative">
            <input
              type={zeigen ? 'text' : 'password'}
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="Passwort der Sicherung"
              className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setZeigen(z => !z)}
              className="absolute inset-y-0 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={zeigen ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {zeigen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fehler && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-2xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>{fehler}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={schliessen}
            disabled={laeuft}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={!passwort || laeuft}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {laeuft ? 'Wird entschlüsselt …' : 'Entschlüsseln'}
          </button>
        </div>
      </form>
    </div>
  );
};
