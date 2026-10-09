import React, { useState } from 'react';
import { X, Download, Lock, Unlock, AlertTriangle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { kannVerschluesseln, MIN_PASSWORT_LAENGE } from '../services/backupCrypto';

/**
 * Auswahl vor dem Erstellen einer Datensicherung: mit oder ohne Passwort.
 * ---------------------------------------------------------------------------
 *
 * Eine unverschlüsselte Sicherung ist eine Textdatei, die jeder mit einem
 * Texteditor lesen kann — samt Adressen und Bankverbindungen aller Mitglieder.
 * Die Verschlüsselung ist deshalb vorgewählt, aber nicht erzwungen: Wer die
 * Sicherung nur auf einem eigenen, geschützten Datenträger ablegt, kann sie
 * bewusst weglassen.
 *
 * Der Hinweis auf das nicht wiederherstellbare Passwort steht absichtlich
 * mitten im Dialog und verlangt eine Bestätigung — wer das Passwort verliert,
 * verliert die Sicherung.
 */

interface BackupExportDialogProps {
  isOpen: boolean;
  laeuft: boolean;
  onAbbrechen: () => void;
  /** `passwort` ist null bei einer unverschlüsselten Sicherung. */
  onBestaetigen: (passwort: string | null) => void;
}

export const BackupExportDialog: React.FC<BackupExportDialogProps> = ({
  isOpen,
  laeuft,
  onAbbrechen,
  onBestaetigen
}) => {
  const moeglich = kannVerschluesseln();
  const [verschluesseln, setVerschluesseln] = useState(true);
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [verstanden, setVerstanden] = useState(false);

  if (!isOpen) return null;

  const mitPasswort = moeglich && verschluesseln;
  const zuKurz = passwort.length < MIN_PASSWORT_LAENGE;
  const ungleich = passwort !== wiederholung;
  const kannSpeichern = !laeuft && (!mitPasswort || (!zuKurz && !ungleich && verstanden));

  const schliessen = () => {
    setPasswort('');
    setWiederholung('');
    setVerstanden(false);
    setZeigen(false);
    onAbbrechen();
  };

  const absenden = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kannSpeichern) return;
    onBestaetigen(mitPasswort ? passwort : null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <form
        onSubmit={absenden}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Datensicherung erstellen</h3>
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

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Mit Passwort */}
          <label
            className={`block p-3.5 rounded-xl border-2 transition-colors ${
              !moeglich
                ? 'border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                : verschluesseln
                ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 cursor-pointer'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="radio"
                name="exportart"
                disabled={!moeglich}
                checked={mitPasswort}
                onChange={() => setVerschluesseln(true)}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Mit Passwort verschlüsseln (empfohlen)
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-400 mt-1">
                  Die Datei lässt sich ohne das Passwort nicht lesen — auch nicht in einem Texteditor und
                  auch nicht von dieser App. Sinnvoll, wenn die Sicherung auf einen USB-Stick, in eine Cloud
                  oder per E-Mail wandert.
                </p>
              </div>
            </div>
          </label>

          {/* Ohne Passwort */}
          <label
            className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
              !mitPasswort
                ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="radio"
                name="exportart"
                checked={!mitPasswort}
                onChange={() => setVerschluesseln(false)}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Ohne Passwort (unverschlüsselt)
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-400 mt-1">
                  Die Datei ist reiner Text. Wer sie öffnet, liest alle Mitglieder mit Adressen und
                  Bankverbindungen, Spenden und Buchungen im Klartext.
                </p>
              </div>
            </div>
          </label>

          {!moeglich && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-2xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>
                Die Verschlüsselung ist hier nicht verfügbar: Der Browser stellt sie nur bereit, wenn die
                App über „localhost“ oder per „https://“ geöffnet wird. Mit der Desktop-App oder dem
                Aufruf über localhost funktioniert sie.
              </span>
            </div>
          )}

          {!mitPasswort && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-2xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>
                Bewahren Sie eine unverschlüsselte Sicherung nur an einem Ort auf, zu dem ausschließlich
                berechtigte Personen Zugang haben, und verschicken Sie sie nicht per E-Mail.
              </span>
            </div>
          )}

          {mitPasswort && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Passwort für die Sicherung (mindestens {MIN_PASSWORT_LAENGE} Zeichen)
                </label>
                <div className="relative">
                  <input
                    type={zeigen ? 'text' : 'password'}
                    value={passwort}
                    onChange={e => setPasswort(e.target.value)}
                    autoComplete="new-password"
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
                {passwort.length > 0 && zuKurz && (
                  <p className="text-2xs text-rose-600 dark:text-rose-400 mt-1">
                    Noch {MIN_PASSWORT_LAENGE - passwort.length} Zeichen fehlen.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Passwort wiederholen
                </label>
                <input
                  type={zeigen ? 'text' : 'password'}
                  value={wiederholung}
                  onChange={e => setWiederholung(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                {wiederholung.length > 0 && ungleich && (
                  <p className="text-2xs text-rose-600 dark:text-rose-400 mt-1">
                    Die beiden Eingaben stimmen nicht überein.
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 space-y-2">
                <div className="text-2xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    <strong>Das Passwort kann nicht wiederhergestellt werden.</strong> Es gibt keine
                    Hintertür und keine „Passwort vergessen“-Funktion. Wer es verliert, kann die Sicherung
                    nie wieder öffnen. Bewahren Sie es an einem zweiten, sicheren Ort auf — zum Beispiel in
                    einem Passwortmanager oder im Vereinstresor.
                  </span>
                </div>
                <label className="flex items-start gap-2 text-2xs font-semibold text-rose-900 dark:text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verstanden}
                    onChange={e => setVerstanden(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Ich habe verstanden und das Passwort sicher notiert.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-2">
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
            disabled={!kannSpeichern}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {laeuft
                ? 'Wird erstellt …'
                : mitPasswort
                ? 'Verschlüsselte Sicherung speichern'
                : 'Unverschlüsselte Sicherung speichern'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
