import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Member } from '../types';
import {
  MitgliedsArt,
  aktiveArten,
  anzahlMitglieder,
  artLoeschen,
  artVerschieben,
  artWiederherstellen,
  neueArt
} from '../utils/mitgliedsarten';
import { VORGABE_PERIODEN, VorgabePeriode } from '../utils/beitragsVorgaben';

/** Beitragsvorgaben als Eingabetexte je Kennung (Komma statt Punkt). */
export type VorgabenEingabe = Record<string, { amount: string; period: VorgabePeriode }>;

interface Props {
  arten: MitgliedsArt[];
  onArten: (arten: MitgliedsArt[]) => void;
  vorgaben: VorgabenEingabe;
  onVorgaben: (v: VorgabenEingabe) => void;
  /** `name.<id>`, `beitrag.<id>`, `liste` */
  fehler: Record<string, string>;
  members: Member[];
  /** Vorgemerkte Umzüge beim Löschen: von Kennung → nach Kennung; ausgeführt beim Speichern. */
  verschiebungen: Record<string, string>;
  onVerschiebungen: (v: Record<string, string>) => void;
}

const eingabe = 'px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-white';
const knopf =
  'p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed';

/**
 * Mitgliedsarten bearbeiten (Wunsch Johannes, 25.11.2026): Name, Beitragsvorgabe
 * und drei Schalter je Art, Reihenfolge, neue Art, löschen mit Vorschlag zum
 * Verschieben. Gilt erst mit „Speichern“ unten auf der Seite.
 */
export const MitgliedsartenKarte: React.FC<Props> = ({ arten, onArten, vorgaben, onVorgaben, fehler, members, verschiebungen, onVerschiebungen }) => {
  const [neuName, setNeuName] = useState('');
  const [loeschFrage, setLoeschFrage] = useState<{ id: string; ziel: string } | null>(null);
  const aktiv = aktiveArten(arten);
  const geloeschte = arten.filter(a => a.geloescht);

  // Mitglieder je Art, vorgemerkte Umzüge schon eingerechnet
  const anzahl = (id: string) => {
    const umgezogen = Object.entries(verschiebungen);
    let n = umgezogen.some(([von]) => von === id) ? 0 : anzahlMitglieder(members, id);
    for (const [von, nach] of umgezogen) if (nach === id) n += anzahlMitglieder(members, von);
    return n;
  };

  const aendern = (id: string, teil: Partial<MitgliedsArt>) => onArten(arten.map(a => (a.id === id ? { ...a, ...teil } : a)));
  const nurEinerUnter18 = (id: string, an: boolean) =>
    onArten(arten.map(a => (a.id === id ? { ...a, unter18: an } : an ? { ...a, unter18: false } : a)));

  const hinzufuegen = () => {
    const n = neuName.trim();
    if (!n) return;
    const a = neueArt(arten, n);
    onArten([...arten, a]);
    onVorgaben({ ...vorgaben, [a.id]: { amount: '0', period: 'monthly' } });
    setNeuName('');
  };

  const loeschen = (id: string, ziel: string | null) => {
    onArten(artLoeschen(arten, id));
    if (ziel) onVerschiebungen({ ...verschiebungen, [id]: ziel });
    setLoeschFrage(null);
  };

  const wiederherstellen = (id: string) => {
    onArten(artWiederherstellen(arten, id));
    const { [id]: _weg, ...rest } = verschiebungen;
    onVerschiebungen(rest);
    if (!vorgaben[id]) onVorgaben({ ...vorgaben, [id]: { amount: '0', period: 'monthly' } });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Mitgliedsarten</h3>
        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
          Die Arten, die Ihr Verein führt, mit ihrem Beitrag. Der Beitrag wird beim Anlegen eines neuen Mitglieds vorgeschlagen; bestehende Mitglieder
          bleiben unverändert. Die erste Art ist die Vorgabe für neue Mitglieder. Ein neuer Name gilt überall in der App, auch bei bestehenden Mitgliedern.
        </p>
        <ul className="text-2xs text-slate-500 dark:text-slate-400 mt-1 list-disc pl-4 space-y-0.5">
          <li><b>beitragsfrei</b>: Wer diese Art bekommt, zahlt keinen Beitrag (z. B. Ehrenmitglied).</li>
          <li><b>unter 18 vorschlagen</b>: Diese Art schlägt die App für Kinder und Jugendliche vor, im Aufnahmeantrag und beim Import. Nur eine Art.</li>
          <li><b>im Aufnahmeantrag</b>: Das neue Mitglied kann diese Art im Antrag ankreuzen.</li>
        </ul>
      </div>

      <div className="space-y-3">
        {aktiv.map((a, i) => {
          const v = vorgaben[a.id] ?? { amount: '0', period: 'monthly' as VorgabePeriode };
          const n = anzahl(a.id);
          return (
            <div key={a.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={a.name}
                    maxLength={60}
                    onChange={e => aendern(a.id, { name: e.target.value })}
                    aria-label="Name der Mitgliedsart"
                    className={`w-full ${eingabe} ${fehler[`name.${a.id}`] ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'}`}
                  />
                  {fehler[`name.${a.id}`] && <p className="text-2xs text-rose-600 dark:text-rose-400 mt-0.5">{fehler[`name.${a.id}`]}</p>}
                  <p className="text-2xs text-slate-400 mt-0.5">{n === 1 ? '1 Mitglied' : `${n} Mitglieder`}{i === 0 ? ' · Vorgabe für neue Mitglieder' : ''}</p>
                </div>
                {a.beitragsfrei ? (
                  <div className="sm:col-span-5 text-xs text-slate-500 dark:text-slate-400 pt-2">beitragsfrei</div>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={v.amount}
                          onChange={e => onVorgaben({ ...vorgaben, [a.id]: { ...v, amount: e.target.value } })}
                          aria-label={`Beitrag ${a.name}`}
                          className={`w-full pl-3 pr-7 text-right ${eingabe} ${fehler[`beitrag.${a.id}`] ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                      </div>
                      {fehler[`beitrag.${a.id}`] && <p className="text-2xs text-rose-600 dark:text-rose-400 mt-0.5">{fehler[`beitrag.${a.id}`]}</p>}
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={v.period}
                        onChange={e => onVorgaben({ ...vorgaben, [a.id]: { ...v, period: e.target.value as VorgabePeriode } })}
                        aria-label={`Zahlweise ${a.name}`}
                        className={`w-full ${eingabe} border-slate-300 dark:border-slate-700`}
                      >
                        {VORGABE_PERIODEN.map(pp => (
                          <option key={pp.period} value={pp.period}>{pp.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="sm:col-span-2 flex items-center justify-end gap-0.5">
                  <button type="button" className={knopf} disabled={i === 0} onClick={() => onArten(artVerschieben(arten, a.id, -1))} title="Nach oben">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className={knopf} disabled={i === aktiv.length - 1} onClick={() => onArten(artVerschieben(arten, a.id, 1))} title="Nach unten">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className={knopf}
                    disabled={aktiv.length <= 1}
                    title={aktiv.length <= 1 ? 'Mindestens eine Art muss bleiben' : 'Art löschen'}
                    onClick={() => {
                      const andere = aktiv.filter(x => x.id !== a.id);
                      if (n === 0) loeschen(a.id, null);
                      else setLoeschFrage({ id: a.id, ziel: andere[0]?.id ?? '' });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-slate-600 dark:text-slate-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!a.beitragsfrei} onChange={e => aendern(a.id, { beitragsfrei: e.target.checked })} />
                  beitragsfrei
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!a.unter18} onChange={e => nurEinerUnter18(a.id, e.target.checked)} />
                  unter 18 vorschlagen
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!a.imAntrag} onChange={e => aendern(a.id, { imAntrag: e.target.checked })} />
                  im Aufnahmeantrag
                </label>
              </div>
              {loeschFrage?.id === a.id && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                  <p>
                    {n === 1 ? 'Ein Mitglied ist' : `${n} Mitglieder sind`} als „{a.name}“ eingetragen. Sollen sie in eine andere Art verschoben werden?
                    Ohne Verschieben behalten sie die Art; sie heißt dann „{a.name} (gelöscht)“.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={loeschFrage.ziel}
                      onChange={e => setLoeschFrage({ id: a.id, ziel: e.target.value })}
                      aria-label="Verschieben nach"
                      className={`${eingabe} border-amber-300 dark:border-amber-800`}
                    >
                      {aktiv.filter(x => x.id !== a.id).map(x => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => loeschen(a.id, loeschFrage.ziel)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg">
                      Verschieben und löschen
                    </button>
                    <button type="button" onClick={() => loeschen(a.id, null)} className="px-3 py-1.5 bg-white border border-amber-300 font-bold rounded-lg dark:bg-slate-900 dark:border-amber-800">
                      Ohne Verschieben löschen
                    </button>
                    <button type="button" onClick={() => setLoeschFrage(null)} className="px-3 py-1.5 font-bold">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {fehler.liste && <p className="text-xs text-rose-600 dark:text-rose-400">{fehler.liste}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={neuName}
          maxLength={60}
          placeholder="Neue Art, z. B. Senioren"
          onChange={e => setNeuName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              hinzufuegen();
            }
          }}
          className={`flex-1 min-w-[12rem] ${eingabe} border-slate-300 dark:border-slate-700`}
        />
        <button
          type="button"
          onClick={hinzufuegen}
          disabled={!neuName.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" />
          Hinzufügen
        </button>
      </div>

      {geloeschte.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400">Gelöschte Arten</p>
          {geloeschte.map(a => {
            const ziel = verschiebungen[a.id];
            const n = anzahlMitglieder(members, a.id);
            return (
              <div key={a.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {a.name}
                  {ziel
                    ? ` – ${n === 1 ? '1 Mitglied wird' : `${n} Mitglieder werden`} beim Speichern nach „${aktiv.find(x => x.id === ziel)?.name ?? ziel}“ verschoben`
                    : n > 0
                      ? ` – ${n === 1 ? '1 Mitglied' : `${n} Mitglieder`} noch so eingetragen`
                      : ''}
                </span>
                <button type="button" onClick={() => wiederherstellen(a.id)} className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 dark:text-blue-400">
                  <RotateCcw className="w-3 h-3" />
                  Wiederherstellen
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MitgliedsartenKarte;
