/**
 * Rückfrage beim Löschen von Mitgliedern, wenn noch Dokumente oder
 * ausgegebenes Material an ihnen hängen (Paket U, T-352). Gleiche Wahl wie
 * Android `DeleteMemberDialog`:
 *
 * - Dokumente mitlöschen (vorgewählt, Datenschutz) oder behalten;
 * - Material zurück ins Inventar (als zurückgegeben gebucht) oder auf ein
 *   anderes Mitglied übertragen.
 *
 * Die allgemeine Frage „wirklich löschen?“ kommt vorher wie bisher.
 */
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Member, MemberInventoryAssignment } from '../types';
import type { MaterialWahl } from '../utils/mitgliedLoeschen';

export interface LoeschWahl {
  dokumente: 'loeschen' | 'behalten';
  material: MaterialWahl;
}

export const MitgliedLoeschenDialog: React.FC<{
  anzahlMitglieder: number;
  dokumente: number;
  material: MemberInventoryAssignment[];
  empfaenger: Member[];
  onLoeschen: (wahl: LoeschWahl) => void;
  onAbbrechen: () => void;
}> = ({ anzahlMitglieder, dokumente, material, empfaenger, onLoeschen, onAbbrechen }) => {
  const [dok, setDok] = useState<'loeschen' | 'behalten'>('loeschen');
  const [uebertragen, setUebertragen] = useState(false);
  const [zielId, setZielId] = useState('');
  const frei = !(material.length > 0 && uebertragen && !zielId);
  const einzahl = anzahlMitglieder === 1;

  const wahl = (): LoeschWahl => ({
    dokumente: dok,
    material: uebertragen && zielId ? { art: 'uebertragen', zielId } : { art: 'zurueck' }
  });

  const radio = 'flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onKeyDown={e => {
        if (e.key === 'Escape') onAbbrechen();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl shrink-0 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {einzahl ? 'Was geschieht mit Dokumenten und Material?' : `${anzahlMitglieder} Mitglieder: Dokumente und Material`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {einzahl ? 'An diesem Mitglied' : 'An diesen Mitgliedern'} hängen noch Einträge. Das Änderungsprotokoll bleibt erhalten.
            </p>
          </div>
        </div>

        {dokumente > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-900 dark:text-white mb-1">
              Dokumente (Unterlagen wie Lizenzen, Aufnahmeanträge): {dokumente}
            </legend>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Aus Datenschutzgründen werden sie in der Regel mitgelöscht.</p>
            <label className={radio}>
              <input type="radio" name="dokumente" checked={dok === 'loeschen'} onChange={() => setDok('loeschen')} />
              {dokumente === 1 ? 'Dokument mitlöschen' : 'Dokumente mitlöschen'}
            </label>
            <label className={radio}>
              <input type="radio" name="dokumente" checked={dok === 'behalten'} onChange={() => setDok('behalten')} />
              {dokumente === 1 ? 'Dokument behalten' : 'Dokumente behalten'}
            </label>
          </fieldset>
        )}

        {material.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-900 dark:text-white mb-1">Noch ausgegebenes Material: {material.length}</legend>
            <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc pl-4">
              {material.slice(0, 6).map(a => (
                <li key={a.id}>
                  {a.itemName || 'Gegenstand'} ({`${a.quantity} ${a.unit || ''}`.trim()})
                </li>
              ))}
              {material.length > 6 && <li>und {material.length - 6} weitere</li>}
            </ul>
            <label className={radio}>
              <input type="radio" name="material" checked={!uebertragen} onChange={() => setUebertragen(false)} />
              Zurück ins Inventar (als zurückgegeben gebucht)
            </label>
            <label className={radio}>
              <input type="radio" name="material" checked={uebertragen} onChange={() => setUebertragen(true)} />
              Auf ein anderes Mitglied übertragen
            </label>
            {uebertragen && (
              <select
                value={zielId}
                onChange={e => setZielId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="">Mitglied wählen …</option>
                {empfaenger.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.lastName}, {m.firstName} ({m.memberNumber})
                  </option>
                ))}
              </select>
            )}
          </fieldset>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onAbbrechen}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!frei}
            title={frei ? undefined : 'Bitte zuerst das Mitglied wählen, das das Material übernimmt.'}
            onClick={() => onLoeschen(wahl())}
            className="px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-rose-600 hover:bg-rose-700"
          >
            {einzahl ? 'Mitglied löschen' : `${anzahlMitglieder} Mitglieder löschen`}
          </button>
        </div>
      </div>
    </div>
  );
};
