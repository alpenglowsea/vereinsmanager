/**
 * Eigener Rückfragedialog statt `window.confirm()` (D-147).
 *
 * `confirm()` und `alert()` sehen in jedem Browser anders aus, lassen sich in
 * manchen Umgebungen unterdrücken und blockieren die ganze Anwendung. Ob sie
 * in der Desktop-Fassung (Tauri) zuverlässig erscheinen, war nicht geprüft.
 *
 * Mit `bestaetigungsWort` muss der Anwender ein Wort eintippen, bevor der
 * Knopf frei wird (wie bei Android vor „Alle Daten löschen“).
 */
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface BestaetigungsDialogProps {
  titel: string;
  text: React.ReactNode;
  bestaetigenText: string;
  /** `null`: kein Abbrechen-Knopf (reine Mitteilung). */
  abbrechenText?: string | null;
  /** Roter Knopf für endgültige Aktionen. */
  gefahr?: boolean;
  /** Muss eingetippt werden, bevor bestätigt werden kann (z. B. „LÖSCHEN“). */
  bestaetigungsWort?: string;
  onBestaetigen: () => void;
  onAbbrechen: () => void;
  /** Dritter Knopf für eine zweite Möglichkeit (z. B. „Nur die Bestätigung löschen“). */
  alternativText?: string;
  onAlternative?: () => void;
}

export const BestaetigungsDialog: React.FC<BestaetigungsDialogProps> = ({
  titel,
  text,
  bestaetigenText,
  abbrechenText = 'Abbrechen',
  gefahr = false,
  bestaetigungsWort,
  onBestaetigen,
  onAbbrechen,
  alternativText,
  onAlternative
}) => {
  const [eingabe, setEingabe] = useState('');
  const frei = !bestaetigungsWort || eingabe.trim() === bestaetigungsWort;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onKeyDown={e => {
        if (e.key === 'Escape') onAbbrechen();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              gefahr
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{titel}</h3>
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{text}</div>
          </div>
        </div>

        {bestaetigungsWort && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Zur Bestätigung bitte <span className="font-mono font-bold">{bestaetigungsWort}</span> eintippen:
            </label>
            <input
              type="text"
              autoFocus
              value={eingabe}
              onChange={e => setEingabe(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && frei) onBestaetigen();
              }}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          {abbrechenText !== null && (
            <button
              type="button"
              autoFocus={!bestaetigungsWort}
              onClick={onAbbrechen}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {abbrechenText}
            </button>
          )}
          {alternativText && onAlternative && (
            <button
              type="button"
              onClick={onAlternative}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {alternativText}
            </button>
          )}
          <button
            type="button"
            disabled={!frei}
            autoFocus={abbrechenText === null}
            onClick={onBestaetigen}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              gefahr ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {bestaetigenText}
          </button>
        </div>
      </div>
    </div>
  );
};
