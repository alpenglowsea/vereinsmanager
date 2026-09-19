import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, FileJson, Layers, RefreshCw } from 'lucide-react';
import { BereichsVergleich, ImportArt, SicherungsKopf } from '../services/backupContents';

/**
 * Bestätigung vor dem Einspielen einer Datensicherung.
 * ---------------------------------------------------------------------------
 *
 * Bis Fassung 1.2 genügte es, eine Datei auf den Anmeldebildschirm zu ziehen —
 * und der gesamte Datenbestand war ersetzt. Ohne Rückfrage, ohne Anzeige, was
 * in der Datei steht, ohne Weg zurück. Die häufigsten Fälle sind dabei nicht
 * böswillig, sondern banal: die falsche Datei erwischt, eine Sicherung von
 * vorletztem Jahr genommen, zwei Vereine auf einem Rechner verwechselt.
 *
 * Dieser Dialog zeigt vorher, was passieren würde, und verlangt eine
 * ausdrückliche Bestätigung.
 */

interface BackupImportDialogProps {
  isOpen: boolean;
  dateiName: string;
  kopf: SicherungsKopf;
  vergleich: BereichsVergleich[];
  laeuft: boolean;
  onAbbrechen: () => void;
  onBestaetigen: (art: ImportArt) => void;
}

function formatiereDatum(iso?: string): string {
  if (!iso) return 'unbekannt';
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return 'unbekannt';
  return datum.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const BackupImportDialog: React.FC<BackupImportDialogProps> = ({
  isOpen,
  dateiName,
  kopf,
  vergleich,
  laeuft,
  onAbbrechen,
  onBestaetigen
}) => {
  const [art, setArt] = useState<ImportArt>('ersetzen');
  const [verstanden, setVerstanden] = useState(false);

  if (!isOpen) return null;

  // Nur Bereiche zeigen, in denen überhaupt etwas ist — sonst steht der
  // Anwender vor 26 Zeilen, von denen 20 Nullen enthalten.
  const zeilen = vergleich.filter(b => b.inDatei > 0 || b.vorhanden > 0);

  const summeDatei = vergleich.reduce((s, b) => s + b.inDatei, 0);
  const summeVorhanden = vergleich.reduce((s, b) => s + b.vorhanden, 0);
  const summeNeu = vergleich.reduce((s, b) => s + b.neu, 0);
  const summeUeberschrieben = vergleich.reduce((s, b) => s + b.wirdUeberschrieben, 0);

  const bestandVorhanden = summeVorhanden > 0;
  const bestaetigungNoetig = art === 'ersetzen' && bestandVorhanden;
  const kannEinspielen = !laeuft && (!bestaetigungNoetig || verstanden);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Kopf */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Datensicherung einspielen
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{dateiName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={laeuft}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Was steckt in der Datei */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Verein</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white break-words">
                {kopf.clubName || 'nicht angegeben'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Erstellt am</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                {formatiereDatum(kopf.exportedAt)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Einträge</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                {summeDatei} in der Datei · {summeVorhanden} hier vorhanden
              </div>
            </div>
          </div>

          {/* Wahl der Importart */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              Wie soll eingespielt werden?
            </h4>

            <label
              className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                art === 'ersetzen'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="importart"
                  checked={art === 'ersetzen'}
                  onChange={() => {
                    setArt('ersetzen');
                    setVerstanden(false);
                  }}
                  className="mt-0.5 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Alles ersetzen
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Der hier vorhandene Bestand wird durch den Inhalt der Datei ersetzt. Richtig
                    beim Umzug auf einen anderen Rechner und beim Wiederherstellen nach einem
                    Schaden.
                    {summeUeberschrieben > 0 && (
                      <>
                        {' '}
                        <strong>{summeUeberschrieben} vorhandene Einträge</strong> werden dabei
                        überschrieben.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                art === 'ergaenzen'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="importart"
                  checked={art === 'ergaenzen'}
                  onChange={() => setArt('ergaenzen')}
                  className="mt-0.5 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Nur Fehlendes ergänzen
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Was hier schon liegt, bleibt unverändert — auch dann, wenn die Datei eine
                    andere Fassung enthält. Aus der Datei kommen{' '}
                    <strong>{summeNeu} Einträge</strong> hinzu, die es hier noch nicht gibt.
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Abgleich */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
              Abgleich mit dem vorhandenen Bestand
            </h4>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">Bereich</th>
                    <th className="text-right font-bold px-3 py-2">in der Datei</th>
                    <th className="text-right font-bold px-3 py-2">hier</th>
                    <th className="text-right font-bold px-3 py-2">
                      {art === 'ersetzen' ? 'wird überschrieben' : 'kommt hinzu'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {zeilen.map(bereich => (
                    <tr key={bereich.schluessel} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-1.5">{bereich.bezeichnung}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{bereich.inDatei}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{bereich.vorhanden}</td>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                          art === 'ersetzen'
                            ? bereich.wirdUeberschrieben > 0
                              ? 'text-amber-700 dark:text-amber-300'
                              : ''
                            : bereich.neu > 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : ''
                        }`}
                      >
                        {art === 'ersetzen' ? bereich.wirdUeberschrieben : bereich.neu}
                      </td>
                    </tr>
                  ))}
                  {zeilen.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                        Die Datei enthält keine Einträge.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
              Verglichen wird über die Kennung jedes Eintrags. Bereiche, die in der Datei gar nicht
              vorkommen, bleiben unangetastet — eine ältere Sicherung löscht also nichts, was sie
              noch nicht kannte.
            </p>
          </div>

          {/* Sicherheitskopie */}
          <div className="flex items-start gap-2 p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-900 dark:text-emerald-200">
              Vor dem Einspielen wird automatisch eine <strong>Sicherheitskopie</strong> des
              jetzigen Bestands angelegt. Sie liegt in einer eigenen Datenbank und lässt sich unter
              Einstellungen → Datensicherung zurückholen.
            </p>
          </div>

          {/* Ausdrückliche Bestätigung beim Ersetzen */}
          {bestaetigungNoetig && (
            <label className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/70 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={verstanden}
                onChange={e => setVerstanden(e.target.checked)}
                className="mt-0.5 cursor-pointer"
              />
              <span className="text-[11px] text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Mir ist bewusst, dass der hier vorhandene Bestand mit{' '}
                <strong>{summeVorhanden} Einträgen</strong> ersetzt wird
                {kopf.clubName ? <> — durch die Daten von „{kopf.clubName}"</> : null}.
              </span>
            </label>
          )}
        </div>

        {/* Fuß */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={laeuft}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onBestaetigen(art)}
            disabled={!kannEinspielen}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
              art === 'ersetzen' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {laeuft && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {laeuft
              ? 'Wird eingespielt...'
              : art === 'ersetzen'
                ? 'Bestand ersetzen'
                : 'Fehlendes ergänzen'}
          </button>
        </div>
      </div>
    </div>
  );
};
