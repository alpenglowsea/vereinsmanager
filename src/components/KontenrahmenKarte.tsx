import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Plus, RotateCcw, Search, Trash2, Check, X } from 'lucide-react';
import type { Skr42MainCategory, Skr42SubCategory } from '../types';
import { useSkr42 } from '../hooks/useSkr42';
import { customCategoryService } from '../services/customCategoryService';
import { kontoBezeichnung, type Steuersatz } from '../utils/kontenrahmen';
import { bestaetige } from '../utils/dialoge';
import { CreateAccountModal } from './CreateAccountModal';

/**
 * Einstellungen → Vereinsstammdaten → „Kontenrahmen (SKR 42)“: Nummernkreise und Konten ansehen, anlegen, umbenennen,
 * Steuersatz-Vorgabe ändern, aus- und einblenden, selbst angelegte löschen. Auch die mitgelieferten Konten lassen sich
 * anpassen; „Zurücksetzen“ holt den Originalnamen. Gleicher Umfang am Handy (Einstellungen → Verein → Kontenrahmen).
 * Regeln: src/utils/kontenrahmen.ts.
 */

type Bearbeitung = { art: 'konto' | 'nummernkreis'; code: string; text: string } | null;

const UST: Steuersatz[] = [0, 7, 19];

const knopf =
  'p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const KontenrahmenKarte: React.FC = () => {
  const kontenrahmen = useSkr42();
  const [suche, setSuche] = useState('');
  const [ausgeblendeteZeigen, setAusgeblendeteZeigen] = useState(false);
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [anlegen, setAnlegen] = useState<{ modus: 'main' | 'sub'; kreis: string } | null>(null);

  const anzahlKonten = kontenrahmen.reduce((n, m) => n + m.subCategories.length, 0);
  const anzahlAusgeblendet = kontenrahmen.reduce(
    (n, m) => n + (m.ausgeblendet ? 1 : 0) + m.subCategories.filter(s => s.ausgeblendet).length,
    0
  );

  // Suche nach Nummer oder Bezeichnung; ein Treffer im Konto zeigt seinen Nummernkreis aufgeklappt.
  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return kontenrahmen
      .map(m => {
        const kreisPasst = !q || m.code.includes(q) || m.name.toLowerCase().includes(q);
        const konten = m.subCategories.filter(
          s =>
            (ausgeblendeteZeigen || !s.ausgeblendet) &&
            (kreisPasst || s.code.includes(q) || kontoBezeichnung(s).toLowerCase().includes(q))
        );
        return { m, konten, sichtbar: (ausgeblendeteZeigen || !m.ausgeblendet) && (kreisPasst || konten.length > 0) };
      })
      .filter(x => x.sichtbar);
  }, [kontenrahmen, suche, ausgeblendeteZeigen]);

  const ausfuehren = async (aktion: () => Promise<string>) => {
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      setMeldung({ text: await aktion(), fehler: false });
      setBearbeitung(null);
    } catch (err: unknown) {
      setMeldung({ text: err instanceof Error ? err.message : String(err), fehler: true });
    } finally {
      setBeschaeftigt(false);
    }
  };

  const buchungenText = (n: number) => (n === 1 ? '1 Buchung trägt' : `${n} Buchungen tragen`);

  const umbenennen = async (art: 'konto' | 'nummernkreis', code: string, name: string) => {
    const n = await customCategoryService.zaehleBuchungen(art, code);
    if (
      n > 0 &&
      !(await bestaetige(
        `${art === 'konto' ? 'Das Konto' : 'Der Nummernkreis'} ${code} steht in ${n} ${n === 1 ? 'Buchung' : 'Buchungen'}. ` +
          `Die neue Bezeichnung „${name.trim()}“ geht auf alle über. Fortfahren?`
      ))
    )
      return;
    await ausfuehren(async () => {
      const r =
        art === 'konto'
          ? await customCategoryService.kontoAendern(code, { name })
          : await customCategoryService.nummernkreisAendern(code, { name });
      return `${code} heißt jetzt „${name.trim()}“.` + (r.buchungen ? ` ${buchungenText(r.buchungen)} die neue Bezeichnung.` : '');
    });
  };

  const zuruecksetzen = (art: 'konto' | 'nummernkreis', code: string, original: string) =>
    umbenennen(art, code, original);

  const loeschen = async (art: 'konto' | 'nummernkreis', kreis: Skr42MainCategory, konto?: Skr42SubCategory) => {
    const text =
      art === 'konto'
        ? `Das selbst angelegte Konto ${konto!.code} „${kontoBezeichnung(konto!)}“ löschen?`
        : `Den selbst angelegten Nummernkreis ${kreis.code} „${kreis.name}“ mit allen seinen Konten löschen?`;
    if (!(await bestaetige(text))) return;
    await ausfuehren(async () => {
      if (art === 'konto') await customCategoryService.deleteCustomSubCategory(kreis.code, konto!.code);
      else await customCategoryService.deleteCustomMainCategory(kreis.code);
      return art === 'konto' ? `Konto ${konto!.code} gelöscht.` : `Nummernkreis ${kreis.code} gelöscht.`;
    });
  };

  const umschalten = (code: string) =>
    setOffen(alt => {
      const neu = new Set(alt);
      if (neu.has(code)) neu.delete(code);
      else neu.add(code);
      return neu;
    });

  const kennzeichen = (eigen?: boolean, angepasst?: boolean, aus?: boolean) => (
    <>
      {eigen && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">eigen</span>}
      {angepasst && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">angepasst</span>}
      {aus && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">ausgeblendet</span>}
    </>
  );

  const namensfeld = (art: 'konto' | 'nummernkreis', code: string) =>
    bearbeitung && bearbeitung.art === art && bearbeitung.code === code ? (
      <span className="flex items-center gap-1 flex-1 min-w-0">
        <input
          autoFocus
          aria-label={`Neue Bezeichnung für ${code}`}
          value={bearbeitung.text}
          onChange={e => setBearbeitung({ ...bearbeitung, text: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void umbenennen(art, code, bearbeitung.text);
            } else if (e.key === 'Escape') setBearbeitung(null);
          }}
          className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
        />
        <button type="button" className={knopf} disabled={beschaeftigt} onClick={() => void umbenennen(art, code, bearbeitung.text)} aria-label="Bezeichnung übernehmen" title="Übernehmen">
          <Check className="w-4 h-4" />
        </button>
        <button type="button" className={knopf} onClick={() => setBearbeitung(null)} aria-label="Abbrechen" title="Abbrechen">
          <X className="w-4 h-4" />
        </button>
      </span>
    ) : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Kontenrahmen (SKR 42)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed max-w-3xl">
              {kontenrahmen.length} Nummernkreise mit {anzahlKonten} Konten, aufsteigend nach Nummer. Bezeichnung und Steuersatz-Vorgabe lassen
              sich ändern, auch bei den mitgelieferten Konten. Eine neue Bezeichnung geht auf alle Buchungen des Kontos über. Ausgeblendetes
              erscheint nicht mehr in der Auswahl; Buchungen darauf bleiben, wie sie sind.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAnlegen({ modus: 'main', kreis: '' })}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Neuer Nummernkreis
          </button>
          <button
            type="button"
            onClick={() => setAnlegen({ modus: 'sub', kreis: kontenrahmen[0]?.code ?? '' })}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Neues Konto
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Konten durchsuchen</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Nummer oder Bezeichnung …"
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={ausgeblendeteZeigen} onChange={e => setAusgeblendeteZeigen(e.target.checked)} />
          Ausgeblendete zeigen{anzahlAusgeblendet ? ` (${anzahlAusgeblendet})` : ''}
        </label>
      </div>

      {meldung && (
        <div
          role={meldung.fehler ? 'alert' : 'status'}
          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            meldung.fehler
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200'
          }`}
        >
          <span className="flex-1">{meldung.text}</span>
          <button type="button" onClick={() => setMeldung(null)} className="cursor-pointer" aria-label="Meldung schließen">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
        {liste.length === 0 && <p className="p-4 text-xs text-slate-500">Nichts gefunden.</p>}
        {liste.map(({ m, konten }) => {
          const aufgeklappt = offen.has(m.code) || suche.trim() !== '';
          return (
            <div key={m.id} className={m.ausgeblendet ? 'opacity-60' : ''}>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/70 dark:bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => umschalten(m.code)}
                  className="flex items-center gap-2 text-left cursor-pointer"
                  aria-expanded={aufgeklappt}
                  aria-label={`${m.code} ${m.name} ${aufgeklappt ? 'zuklappen' : 'aufklappen'}`}
                >
                  {aufgeklappt ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white w-14">{m.code}</span>
                </button>
                {namensfeld('nummernkreis', m.code) ?? (
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {m.type === 'income' ? 'Einnahmen' : 'Ausgaben'} · {m.subCategories.length} {m.subCategories.length === 1 ? 'Konto' : 'Konten'}
                    </span>
                    {kennzeichen(m.isCustom, !!m.originalName, m.ausgeblendet)}
                  </span>
                )}
                <span className="flex items-center shrink-0">
                  <button type="button" className={knopf} title="Konto in diesem Nummernkreis anlegen" aria-label={`Konto in ${m.code} anlegen`} onClick={() => setAnlegen({ modus: 'sub', kreis: m.code })}>
                    <Plus className="w-4 h-4" />
                  </button>
                  <button type="button" className={knopf} title="Bezeichnung ändern" aria-label={`Bezeichnung von ${m.code} ändern`} onClick={() => setBearbeitung({ art: 'nummernkreis', code: m.code, text: m.name })}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {m.originalName && (
                    <button type="button" className={knopf} disabled={beschaeftigt} title={`Zurück auf „${m.originalName}“`} aria-label={`${m.code} auf den Originalnamen zurücksetzen`} onClick={() => void zuruecksetzen('nummernkreis', m.code, m.originalName!)}>
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    className={knopf}
                    disabled={beschaeftigt}
                    title={m.ausgeblendet ? 'Wieder einblenden' : 'Ausblenden'}
                    aria-label={`${m.code} ${m.ausgeblendet ? 'einblenden' : 'ausblenden'}`}
                    onClick={() =>
                      void ausfuehren(async () => {
                        await customCategoryService.nummernkreisAendern(m.code, { ausgeblendet: !m.ausgeblendet });
                        return `Nummernkreis ${m.code} ${m.ausgeblendet ? 'wieder eingeblendet' : 'ausgeblendet'}.`;
                      })
                    }
                  >
                    {m.ausgeblendet ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  {m.isCustom && (
                    <button type="button" className={knopf} disabled={beschaeftigt} title="Löschen" aria-label={`Nummernkreis ${m.code} löschen`} onClick={() => void loeschen('nummernkreis', m)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </span>
              </div>
              {aufgeklappt && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {konten.map(s => (
                    <li key={s.code} className={`flex items-center gap-2 pl-10 pr-3 py-1.5 ${s.ausgeblendet ? 'opacity-60' : ''}`}>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300 w-14 shrink-0">{s.code}</span>
                      {namensfeld('konto', s.code) ?? (
                        <span className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-xs text-slate-800 dark:text-slate-200 truncate" title={s.originalName ? `Original: ${s.originalName}` : undefined}>
                            {kontoBezeichnung(s)}
                          </span>
                          {kennzeichen(s.isCustom, !!s.originalName || s.originalVatRate !== undefined, s.ausgeblendet)}
                        </span>
                      )}
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                        <span className="sr-only">Steuersatz-Vorgabe für {s.code}</span>
                        USt
                        <select
                          value={s.vatRateDefault}
                          disabled={beschaeftigt}
                          onChange={e =>
                            void ausfuehren(async () => {
                              const ust = Number(e.target.value) as Steuersatz;
                              await customCategoryService.kontoAendern(s.code, { vatRateDefault: ust });
                              return `Konto ${s.code}: Steuersatz-Vorgabe jetzt ${ust} %. Bestehende Buchungen bleiben unverändert.`;
                            })
                          }
                          className="px-1.5 py-0.5 text-xs border border-slate-300 rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                          {UST.map(u => (
                            <option key={u} value={u}>
                              {u} %
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="flex items-center shrink-0">
                        <button type="button" className={knopf} title="Bezeichnung ändern" aria-label={`Bezeichnung von Konto ${s.code} ändern`} onClick={() => setBearbeitung({ art: 'konto', code: s.code, text: kontoBezeichnung(s) })}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {(s.originalName || s.originalVatRate !== undefined) && (
                          <button
                            type="button"
                            className={knopf}
                            disabled={beschaeftigt}
                            title={`Zurück auf das Original${s.originalName ? ` „${s.originalName}“` : ''}${s.originalVatRate !== undefined ? `, ${s.originalVatRate} %` : ''}`}
                            aria-label={`Konto ${s.code} auf das Original zurücksetzen`}
                            onClick={() =>
                              void (async () => {
                                if (s.originalVatRate !== undefined) await customCategoryService.kontoAendern(s.code, { vatRateDefault: s.originalVatRate });
                                if (s.originalName) await zuruecksetzen('konto', s.code, s.originalName);
                                else setMeldung({ text: `Konto ${s.code} ist wieder im Original.`, fehler: false });
                              })()
                            }
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={knopf}
                          disabled={beschaeftigt}
                          title={s.ausgeblendet ? 'Wieder einblenden' : 'Ausblenden'}
                          aria-label={`Konto ${s.code} ${s.ausgeblendet ? 'einblenden' : 'ausblenden'}`}
                          onClick={() =>
                            void ausfuehren(async () => {
                              await customCategoryService.kontoAendern(s.code, { ausgeblendet: !s.ausgeblendet });
                              return `Konto ${s.code} ${s.ausgeblendet ? 'wieder eingeblendet' : 'ausgeblendet'}.`;
                            })
                          }
                        >
                          {s.ausgeblendet ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        {s.isCustom && (
                          <button type="button" className={knopf} disabled={beschaeftigt} title="Löschen" aria-label={`Konto ${s.code} löschen`} onClick={() => void loeschen('konto', m, s)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                  {konten.length === 0 && <li className="pl-10 pr-3 py-2 text-xs text-slate-500">Keine sichtbaren Konten.</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <CreateAccountModal
        isOpen={anlegen !== null}
        onClose={() => setAnlegen(null)}
        mode={anlegen?.modus ?? 'sub'}
        currentType={kontenrahmen.find(m => m.code === anlegen?.kreis)?.type ?? 'income'}
        currentMainCatIdOrCode={anlegen?.kreis || undefined}
        onCreatedMain={m => {
          setOffen(alt => new Set(alt).add(m.code));
          setMeldung({ text: `Nummernkreis ${m.code} „${m.name}“ angelegt.`, fehler: false });
        }}
        onCreatedSub={(s, m) => {
          setOffen(alt => new Set(alt).add(m.code));
          setMeldung({ text: `Konto ${s.code} „${kontoBezeichnung(s)}“ in ${m.code} angelegt.`, fehler: false });
        }}
      />
    </div>
  );
};
