/**
 * Aufnahme eines neuen Mitglieds am Gerät (P29, D-96), Ablauf wie Android
 * (`AntraegeUi.kt`), Aussehen im Stil des Desktops:
 *
 * 1. `AntragAusfuellen`: Das neue Mitglied füllt den Antrag in fünf Schritten
 *    selbst aus und unterschreibt. Das Fenster deckt die ganze App ab;
 *    verlassen geht nur über „Abbrechen (Vereinsvertreter)“.
 * 2. `AntragPruefen`: Der Verein liest die Angaben, sieht Warnungen, vergibt
 *    die Mitgliedsnummer und nimmt die Person auf (Mitglied und PDF im Archiv,
 *    zusammen oder gar nicht) oder verwirft den Antrag.
 *
 * Der Antrag liegt bis dahin nur im Arbeitsspeicher und wird nirgends
 * aufbewahrt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Loader2, PenTool, UserPlus, X } from 'lucide-react';
import type { ClubDocument, ClubSettings, Member } from '../types';
import type { Unterschrift } from '../utils/unterschrift';
import {
  ANTRAG_ARTEN,
  Antrag,
  BEZIEHUNGEN,
  GESCHLECHTER,
  SEITEN_NAMEN,
  SEITE_ERKLAERUNG,
  SEITE_MITGLIEDSCHAFT,
  SEITE_PERSON,
  SEITE_ZAHLUNG,
  SEITE_ZUSAMMENFASSUNG,
  SEPA_TEXT,
  alter,
  antragName,
  artName,
  aufnahmeFehler,
  beitragText,
  datum,
  deutsch,
  dubletten,
  fehler as fehlerAuf,
  ibanGruppiert,
  kontoinhaberMussUnterschreiben,
  leseAntragEinstellungen,
  minderjaehrig,
  mitVerein,
  neuerAntrag,
  vorschlagArt
} from '../utils/antragRegeln';
import { lokalesHeute } from '../utils/mitgliedRegeln';
import { frage } from '../utils/dialoge';
import { StorageService } from '../services/storage';
import { antragPdfErzeugen } from '../services/antragPdfDatei';
import type { Briefpapier } from '../services/meetingPdfService';
import { Vorschau, Zeichenflaeche } from './UnterschriftFeld';

const sparteListe = (s: ClubSettings) => ((s.departments || []).length ? s.departments : ['Hauptverein']);

// ------------------------------------------------------------------ kleine Bausteine

const feldKlasse = (fehler?: string) =>
  `w-full px-3.5 py-2.5 border rounded-xl text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${
    fehler ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-700'
  }`;

const Fehlertext: React.FC<{ text?: string }> = ({ text }) =>
  text ? <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{text}</p> : null;

const Feld: React.FC<{
  label: string;
  wert: string;
  onChange: (v: string) => void;
  fehler?: string;
  hinweis?: string;
  typ?: string;
  breit?: boolean;
  mehrzeilig?: boolean;
}> = ({ label, wert, onChange, fehler, hinweis, typ = 'text', breit, mehrzeilig }) => (
  <label className={`block ${breit ? 'sm:col-span-2' : ''}`}>
    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
    {mehrzeilig ? (
      <textarea value={wert} onChange={e => onChange(e.target.value)} rows={3} className={feldKlasse(fehler)} />
    ) : (
      <input type={typ} value={wert} onChange={e => onChange(e.target.value)} className={feldKlasse(fehler)} />
    )}
    {hinweis && !fehler && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{hinweis}</span>}
    <Fehlertext text={fehler} />
  </label>
);

const Auswahl: React.FC<{
  label: string;
  wert: string;
  optionen: { wert: string; label: string }[];
  onChange: (v: string) => void;
  fehler?: string;
  breit?: boolean;
}> = ({ label, wert, optionen, onChange, fehler, breit }) => (
  <label className={`block ${breit ? 'sm:col-span-2' : ''}`}>
    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
    <select value={wert} onChange={e => onChange(e.target.value)} className={feldKlasse(fehler)}>
      {!optionen.some(o => o.wert === wert) && <option value={wert}>Bitte wählen …</option>}
      {optionen.map(o => (
        <option key={o.wert} value={o.wert}>
          {o.label}
        </option>
      ))}
    </select>
    <Fehlertext text={fehler} />
  </label>
);

const Unterschriftsfeld: React.FC<{ titel: string; u: Unterschrift | null; fehler?: string; onNeu: (u: Unterschrift) => void }> = ({
  titel,
  u,
  fehler,
  onNeu
}) => {
  const [offen, setOffen] = useState(false);
  const da = u && u.strokes.length > 0;
  return (
    <div className="space-y-2">
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{titel}</p>
      {da && (
        <div className="h-20 flex items-center justify-center bg-white border border-slate-300 rounded-xl px-3 text-slate-900">
          <Vorschau u={u} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold border ${
          fehler ? 'border-rose-400 text-rose-700 dark:text-rose-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
        } bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700`}
      >
        <PenTool className="w-4 h-4" />
        {da ? 'Neu unterschreiben' : 'Hier unterschreiben'}
      </button>
      <Fehlertext text={fehler} />
      {offen && <Zeichenflaeche onAbbrechen={() => setOffen(false)} onUebernehmen={neu => { onNeu(neu); setOffen(false); }} />}
    </div>
  );
};

const Zeile: React.FC<{ name: string; wert: string }> = ({ name, wert }) =>
  wert.trim() ? (
    <div className="grid grid-cols-5 gap-3 py-1.5 text-sm">
      <span className="col-span-2 text-slate-500 dark:text-slate-400">{name}</span>
      <span className="col-span-3 text-slate-900 dark:text-white break-words">{wert}</span>
    </div>
  ) : null;

const Abschnitt: React.FC<{ titel: string; children: React.ReactNode }> = ({ titel, children }) => (
  <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
    <h4 className="text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1.5">{titel}</h4>
    {children}
  </section>
);

/** Die Angaben zum Durchlesen (für das neue Mitglied und für die Prüfung durch den Verein). */
const Uebersicht: React.FC<{ a: Antrag; settings: ClubSettings; heute: string }> = ({ a, settings, heute }) => {
  const e = leseAntragEinstellungen(settings);
  return (
    <div className="space-y-3">
      <Abschnitt titel="Person">
        <Zeile name="Name" wert={antragName(a)} />
        <Zeile name="Geburtsdatum" wert={deutsch(a.geburtsdatum)} />
        <Zeile name="Anschrift" wert={`${a.strasse} ${a.hausnummer}, ${a.plz} ${a.ort}`} />
        <Zeile name="Telefon" wert={a.telefon} />
        <Zeile name="E-Mail" wert={a.email} />
      </Abschnitt>
      {minderjaehrig(a, heute) && (
        <Abschnitt titel="Gesetzlicher Vertreter">
          <Zeile name="Name" wert={a.vertreterName} />
          <Zeile name="Beziehung" wert={a.vertreterBeziehung} />
          <Zeile name="Telefon" wert={a.vertreterTelefon} />
          <Zeile name="E-Mail" wert={a.vertreterEmail} />
        </Abschnitt>
      )}
      <Abschnitt titel="Mitgliedschaft">
        <Zeile name="Sparte" wert={a.sparte} />
        <Zeile name="Mitgliedsart" wert={artName(a.mitgliedsart)} />
        <Zeile name="Beitrag" wert={beitragText(e.beitraege[a.mitgliedsart])} />
        <Zeile name="Eintritt" wert={deutsch(a.eintritt)} />
        <Zeile name="Frühere Vereine" wert={a.vorverein} />
        <Zeile name="Anmerkung" wert={a.notiz} />
      </Abschnitt>
      <Abschnitt titel="Zahlung">
        {a.zahlungsart === 'sepa' ? (
          <>
            <Zeile name="Zahlungsart" wert="Lastschrift (SEPA)" />
            <Zeile name="Kontoinhaber" wert={a.kontoinhaber} />
            <Zeile name="IBAN" wert={ibanGruppiert(a.iban)} />
            <Zeile name="BIC" wert={a.bic} />
            <Zeile name="Bank" wert={a.bankname} />
          </>
        ) : (
          <Zeile name="Zahlungsart" wert="Überweisung" />
        )}
      </Abschnitt>
    </div>
  );
};

/** PDF eines Dokuments im Fenster zeigen (Satzung, Datenschutz-Vordruck). */
const PdfAnsicht: React.FC<{ titel: string; dataUrl: string; onSchliessen: () => void }> = ({ titel, dataUrl, onSchliessen }) => (
  <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-slate-950">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{titel}</h3>
      <button type="button" onClick={onSchliessen} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold">
        Schließen
      </button>
    </div>
    <iframe src={dataUrl} title={titel} className="flex-1 w-full border-0 bg-slate-100" />
  </div>
);

// ------------------------------------------------------------------ Ausfüllen durch das neue Mitglied

export const AntragAusfuellen: React.FC<{
  settings: ClubSettings;
  dokumente: ClubDocument[];
  onAbgegeben: (a: Antrag) => void;
  onWeiter: () => void;
  onAbbruch: () => void;
}> = ({ settings, dokumente, onAbgegeben, onWeiter, onAbbruch }) => {
  const heute = useMemo(() => lokalesHeute(), []);
  const sparten = sparteListe(settings);
  const einst = leseAntragEinstellungen(settings);
  const verein = settings.clubName || '';
  const [a, setA] = useState<Antrag>(() => neuerAntrag({ eintritt: heute, sparte: sparten.length === 1 ? sparten[0] : '' }));
  const [seite, setSeite] = useState(SEITE_PERSON);
  const [zeigeFehler, setZeigeFehler] = useState(false);
  const [abgegeben, setAbgegeben] = useState(false);
  const [ansicht, setAnsicht] = useState<{ titel: string; dataUrl: string } | null>(null);

  const satzungDok = einst.satzungDokId ? dokumente.find(d => d.id === einst.satzungDokId) : undefined;
  const datenschutzDok = einst.datenschutzDokId ? dokumente.find(d => d.id === einst.datenschutzDokId) : undefined;
  const f = zeigeFehler ? fehlerAuf(seite, a, heute, sparten) : {};
  const minder = minderjaehrig(a, heute);
  const set = (w: Partial<Antrag>) => setA(prev => ({ ...prev, ...w }));

  // Die Escape-Taste tut nichts: Verlassen nur über „Abbrechen (Vereinsvertreter)“.
  useEffect(() => {
    const sperre = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', sperre, true);
    return () => window.removeEventListener('keydown', sperre, true);
  }, []);

  const weiter = () => {
    const fe = fehlerAuf(seite, a, heute, sparten);
    if (Object.keys(fe).length) {
      setZeigeFehler(true);
      return;
    }
    setZeigeFehler(false);
    if (seite === SEITE_ZUSAMMENFASSUNG) {
      onAbgegeben(a);
      setAbgegeben(true);
      return;
    }
    let neu = a;
    if (seite === SEITE_PERSON && a.mitgliedsart === 'full') {
      const v = vorschlagArt(alter(a.geburtsdatum, heute));
      if (v) neu = { ...neu, mitgliedsart: v };
    }
    if (seite === SEITE_ZAHLUNG - 1 && neu.zahlungsart === 'sepa' && !neu.kontoinhaber.trim()) neu = { ...neu, kontoinhaber: antragName(neu) };
    setA(neu);
    setSeite(seite + 1);
    document.getElementById('antrag-inhalt')?.scrollTo({ top: 0 });
  };

  const abbrechen = async () => {
    const ja = await frage({
      titel: 'Antrag abbrechen?',
      text: 'Alle bisherigen Eingaben gehen verloren. Dies ist nur für Vereinsvertreter gedacht.',
      bestaetigenText: 'Abbrechen (Vereinsvertreter)',
      abbrechenText: 'Weiter ausfüllen',
      gefahr: true
    });
    if (ja) onAbbruch();
  };

  const vorschlag = vorschlagArt(alter(a.geburtsdatum, heute));
  const offeneFehler = Object.keys(f).length > 0;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-slate-50 dark:bg-slate-950" role="dialog" aria-modal="true" aria-label="Aufnahmeantrag">
      {ansicht && <PdfAnsicht titel={ansicht.titel} dataUrl={ansicht.dataUrl} onSchliessen={() => setAnsicht(null)} />}
      {/* Kopf mit Fortschritt */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{verein}</p>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{abgegeben ? 'Antrag abgegeben' : 'Aufnahmeantrag'}</h2>
            </div>
            {!abgegeben && (
              <button
                type="button"
                onClick={() => void abbrechen()}
                className="shrink-0 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                Abbrechen (Vereinsvertreter)
              </button>
            )}
          </div>
          {!abgegeben && (
            <div className="mt-3 space-y-1.5">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < seite ? 'bg-blue-600' : i === seite ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Schritt {seite} von 5 · {SEITEN_NAMEN[seite]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Inhalt */}
      <div id="antrag-inhalt" className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {abgegeben ? (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-6 space-y-2">
              <h3 className="text-2xl font-extrabold text-blue-900 dark:text-blue-200">Vielen Dank!</h3>
              <p className="text-base text-blue-900 dark:text-blue-200">
                Ihr Antrag ist ausgefüllt und unterschrieben. Bitte geben Sie den Platz jetzt an den Vereinsvertreter zurück. Er prüft den Antrag
                und nimmt Sie als Mitglied auf.
              </p>
            </div>
          ) : seite === SEITE_ZUSAMMENFASSUNG ? (
            <>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Bitte alles noch einmal prüfen</h3>
              <Uebersicht a={a} settings={settings} heute={heute} />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Stimmt etwas nicht, gehen Sie mit „Zurück“ zu der Seite und ändern es. Mit „Antrag abgeben“ ist der Antrag fertig.
              </p>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              {seite === SEITE_PERSON && (
                <>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Angaben zur Person</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Felder mit * sind Pflicht.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Feld label="Vorname *" wert={a.vorname} onChange={v => set({ vorname: v })} fehler={f.vorname} />
                    <Feld label="Nachname *" wert={a.nachname} onChange={v => set({ nachname: v })} fehler={f.nachname} />
                    <Auswahl label="Geschlecht" wert={a.geschlecht} optionen={GESCHLECHTER} onChange={v => set({ geschlecht: v as Antrag['geschlecht'] })} />
                    <Feld label="Geburtsdatum *" typ="date" wert={a.geburtsdatum} onChange={v => set({ geburtsdatum: v })} fehler={f.geburtsdatum} />
                    <Feld label="Staatsangehörigkeit" wert={a.staatsangehoerigkeit} onChange={v => set({ staatsangehoerigkeit: v })} />
                    <div />
                    <Feld label="Straße *" wert={a.strasse} onChange={v => set({ strasse: v })} fehler={f.strasse} />
                    <Feld label="Hausnummer *" wert={a.hausnummer} onChange={v => set({ hausnummer: v })} fehler={f.hausnummer} />
                    <Feld label="Postleitzahl *" wert={a.plz} onChange={v => set({ plz: v })} fehler={f.plz} />
                    <Feld label="Ort *" wert={a.ort} onChange={v => set({ ort: v })} fehler={f.ort} />
                    <Feld label="Land" wert={a.land} onChange={v => set({ land: v })} />
                    <div />
                    <Feld label="Telefon (freiwillig)" typ="tel" wert={a.telefon} onChange={v => set({ telefon: v })} />
                    <Feld label="E-Mail (freiwillig)" typ="email" wert={a.email} onChange={v => set({ email: v })} fehler={f.email} />
                  </div>
                  {minder && datum(a.geburtsdatum) && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Gesetzlicher Vertreter</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Da Sie noch nicht 18 Jahre alt sind, muss ein Elternteil oder gesetzlicher Vertreter den Antrag mit unterschreiben.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Feld label="Name des Vertreters *" wert={a.vertreterName} onChange={v => set({ vertreterName: v })} fehler={f.vertreterName} />
                        <Auswahl
                          label="Beziehung"
                          wert={a.vertreterBeziehung}
                          optionen={BEZIEHUNGEN.map(b => ({ wert: b, label: b === 'Sonstige' ? 'Sonstige/r' : b }))}
                          onChange={v => set({ vertreterBeziehung: v })}
                        />
                        <Feld label="Telefon des Vertreters (freiwillig)" typ="tel" wert={a.vertreterTelefon} onChange={v => set({ vertreterTelefon: v })} />
                        <Feld
                          label="E-Mail des Vertreters (freiwillig)"
                          typ="email"
                          wert={a.vertreterEmail}
                          onChange={v => set({ vertreterEmail: v })}
                          fehler={f.vertreterEmail}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {seite === SEITE_MITGLIEDSCHAFT && (
                <>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Mitgliedschaft</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Auswahl label="Sparte *" wert={a.sparte} optionen={sparten.map(s => ({ wert: s, label: s }))} onChange={v => set({ sparte: v })} fehler={f.sparte} />
                    <Auswahl
                      label="Mitgliedsart *"
                      wert={a.mitgliedsart}
                      optionen={ANTRAG_ARTEN.map(x => ({ wert: x.art, label: x.label }))}
                      onChange={v => set({ mitgliedsart: v as Antrag['mitgliedsart'] })}
                      fehler={f.mitgliedsart}
                    />
                  </div>
                  {vorschlag && a.mitgliedsart !== vorschlag && (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
                      <span>Hinweis: Für Personen unter 18 Jahren gibt es die Art „{artName(vorschlag)}“.</span>
                      <button type="button" onClick={() => set({ mitgliedsart: vorschlag })} className="font-bold underline">
                        Diese Art übernehmen
                      </button>
                    </div>
                  )}
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl px-5 py-4">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Ihr Beitrag</p>
                    <p className="text-2xl font-extrabold text-amber-900 dark:text-amber-200">{beitragText(einst.beitraege[a.mitgliedsart])}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Feld label="Eintrittsdatum *" typ="date" wert={a.eintritt} onChange={v => set({ eintritt: v })} fehler={f.eintritt} />
                    <Feld label="Frühere Vereine (freiwillig)" wert={a.vorverein} onChange={v => set({ vorverein: v })} />
                    <Feld label="Anmerkungen (freiwillig)" wert={a.notiz} onChange={v => set({ notiz: v })} mehrzeilig breit />
                  </div>
                </>
              )}

              {seite === SEITE_ZAHLUNG && (
                <>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Zahlung des Beitrags</h3>
                  <div className="flex gap-2">
                    {(['sepa', 'transfer'] as const).map(z => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => set({ zahlungsart: z })}
                        className={`px-4 py-2.5 rounded-xl text-base font-bold border ${
                          a.zahlungsart === z
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {z === 'sepa' ? 'Lastschrift (SEPA)' : 'Überweisung'}
                      </button>
                    ))}
                  </div>
                  {a.zahlungsart === 'sepa' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Feld
                          label="Kontoinhaber *"
                          wert={a.kontoinhaber}
                          onChange={v => set({ kontoinhaber: v })}
                          fehler={f.kontoinhaber}
                          hinweis="Name der Person, von deren Konto abgebucht wird"
                          breit
                        />
                        <Feld label="IBAN *" wert={a.iban} onChange={v => set({ iban: v })} fehler={f.iban} hinweis="z. B. DE89 3704 0044 0532 0130 00" breit />
                        <Feld label="BIC (freiwillig)" wert={a.bic} onChange={v => set({ bic: v })} fehler={f.bic} />
                        <Feld label="Name der Bank (freiwillig)" wert={a.bankname} onChange={v => set({ bankname: v })} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{mitVerein(SEPA_TEXT, verein)}</p>
                    </>
                  ) : (
                    <p className="text-base text-slate-700 dark:text-slate-300">
                      Bitte überweisen Sie den Beitrag nach Aufforderung durch den Verein. Es wird kein Lastschriftmandat erteilt.
                    </p>
                  )}
                </>
              )}

              {seite === SEITE_ERKLAERUNG && (
                <>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Einwilligung und Satzung</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{mitVerein(einst.datenschutz, verein)}</p>
                    {datenschutzDok && (
                      <button type="button" onClick={() => setAnsicht({ titel: 'Datenschutz', dataUrl: datenschutzDok.dataUrl })} className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline">
                        <FileText className="w-4 h-4" /> Datenschutz-Vordruck ansehen
                      </button>
                    )}
                    <label className="flex items-center gap-3 text-base font-semibold text-slate-900 dark:text-white cursor-pointer">
                      <input type="checkbox" checked={a.datenschutz} onChange={e => set({ datenschutz: e.target.checked })} className="w-5 h-5" />
                      Ich willige ein.
                    </label>
                    <Fehlertext text={f.datenschutz} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{mitVerein(einst.satzung, verein)}</p>
                    {satzungDok && (
                      <button type="button" onClick={() => setAnsicht({ titel: 'Satzung', dataUrl: satzungDok.dataUrl })} className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline">
                        <FileText className="w-4 h-4" /> Satzung ansehen
                      </button>
                    )}
                    <label className="flex items-center gap-3 text-base font-semibold text-slate-900 dark:text-white cursor-pointer">
                      <input type="checkbox" checked={a.satzung} onChange={e => set({ satzung: e.target.checked })} className="w-5 h-5" />
                      Ich erkenne die Satzung an.
                    </label>
                    <Fehlertext text={f.satzung} />
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-5">
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Unterschriften</h3>
                    <Unterschriftsfeld
                      titel={`Unterschrift ${antragName(a) || 'Antragsteller'}`}
                      u={a.unterschrift}
                      fehler={f.unterschrift}
                      onNeu={u => set({ unterschrift: u })}
                    />
                    {minder && (
                      <Unterschriftsfeld
                        titel={`Unterschrift gesetzlicher Vertreter (${a.vertreterName})`}
                        u={a.vertreterUnterschrift}
                        fehler={f.vertreterUnterschrift}
                        onNeu={u => set({ vertreterUnterschrift: u })}
                      />
                    )}
                    {kontoinhaberMussUnterschreiben(a, heute) && (
                      <>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Das Konto gehört einer anderen Person. Der Kontoinhaber unterschreibt das Lastschriftmandat selbst.
                        </p>
                        <Unterschriftsfeld
                          titel={`Unterschrift Kontoinhaber (${a.kontoinhaber})`}
                          u={a.kontoinhaberUnterschrift}
                          fehler={f.kontoinhaberUnterschrift}
                          onNeu={u => set({ kontoinhaberUnterschrift: u })}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fuß mit Knöpfen */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="max-w-3xl mx-auto">
          {abgegeben ? (
            <button type="button" onClick={onWeiter} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold">
              Weiter (Vereinsvertreter)
            </button>
          ) : (
            <div className="space-y-2">
              {offeneFehler && (
                <p className="text-sm text-rose-600 dark:text-rose-400 text-right">Bitte die rot markierten Angaben ergänzen oder berichtigen.</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={seite === SEITE_PERSON}
                  onClick={() => {
                    setZeigeFehler(false);
                    setSeite(seite - 1);
                  }}
                  className="flex-1 py-3.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-base font-bold disabled:opacity-40"
                >
                  Zurück
                </button>
                <button type="button" onClick={weiter} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold">
                  {seite === SEITE_ZUSAMMENFASSUNG ? 'Antrag abgeben' : 'Weiter'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ Prüfen durch den Verein

export const AntragPruefen: React.FC<{
  antrag: Antrag;
  settings: ClubSettings;
  members: Member[];
  naechsteNummer: string;
  briefpapier: Briefpapier | null;
  onAufgenommen: (m: Member) => void;
  onVerworfen: () => void;
  onSchliessen: () => void;
}> = ({ antrag: a, settings, members, naechsteNummer, briefpapier, onAufgenommen, onVerworfen, onSchliessen }) => {
  const heute = useMemo(() => lokalesHeute(), []);
  const sparten = sparteListe(settings);
  const [nummer, setNummer] = useState(naechsteNummer);
  const [meldung, setMeldung] = useState('');
  const [busy, setBusy] = useState(false);
  const doppelt = useMemo(() => dubletten(a, members), [a, members]);
  const offen = fehlerAuf(SEITE_ZUSAMMENFASSUNG, a, heute, sparten);
  const ersterOffen = Object.values(offen)[0];

  const aufnehmen = async () => {
    const problem = aufnahmeFehler(a, nummer, heute, sparten, members);
    if (problem) {
      setMeldung(problem);
      return;
    }
    setBusy(true);
    setMeldung('');
    try {
      const pdf = antragPdfErzeugen(a, settings, nummer, heute, briefpapier);
      const r = await StorageService.antragAufnehmen(a, nummer, pdf.dataUrl, pdf.groesse);
      onAufgenommen(r.member);
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : 'Die Aufnahme ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const verwerfen = async () => {
    const ja = await frage({
      titel: 'Antrag verwerfen?',
      text: 'Der Antrag wird gelöscht und nirgends aufbewahrt.',
      bestaetigenText: 'Verwerfen',
      gefahr: true
    });
    if (ja) onVerworfen();
  };

  const unterschriften: [string, Unterschrift | null][] = [
    ['Antragsteller', a.unterschrift],
    ['Gesetzlicher Vertreter', a.vertreterUnterschrift],
    ['Kontoinhaber', a.kontoinhaberUnterschrift]
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" /> Antrag prüfen: {antragName(a)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Die Angaben sind hier nicht änderbar. Stimmt etwas nicht, nehmen Sie die Person auf und korrigieren sie danach im Mitgliedsformular. Bei
              groben Fehlern: Antrag verwerfen und neu ausfüllen lassen.
            </p>
          </div>
          <button
            type="button"
            onClick={onSchliessen}
            title="Schließen; der Antrag bleibt bis zum Aufnehmen oder Verwerfen erhalten (nur bis die App beendet wird)."
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {doppelt.length > 0 && (
            <div className="flex gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-sm text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Achtung: möglicherweise schon Mitglied</p>
                {doppelt.map(m => (
                  <p key={m.id}>
                    {m.firstName} {m.lastName} (Nr. {m.memberNumber})
                  </p>
                ))}
              </div>
            </div>
          )}
          {ersterOffen && (
            <div className="flex gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-sm text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>Der Antrag ist unvollständig: {ersterOffen}</p>
            </div>
          )}
          <Uebersicht a={a} settings={settings} heute={heute} />
          <Abschnitt titel="Unterschriften">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
              {unterschriften
                .filter(([, u]) => u && u.strokes.length)
                .map(([name, u]) => (
                  <div key={name}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{name}</p>
                    <div className="h-16 flex items-center justify-center bg-white border border-slate-200 rounded-xl px-2 text-slate-900">
                      <Vorschau u={u!} />
                    </div>
                  </div>
                ))}
            </div>
          </Abschnitt>
          <Abschnitt titel="Aufnahme">
            <label className="block mt-1">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mitgliedsnummer</span>
              <input
                value={nummer}
                onChange={e => setNummer(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white"
              />
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Vorschlag der App; Sie können sie ändern.</span>
            </label>
          </Abschnitt>
        </div>

        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {meldung && <p className="text-sm text-rose-600 dark:text-rose-400 text-right">{meldung}</p>}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void verwerfen()}
              className="px-4 py-2.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 dark:bg-slate-800 dark:border-rose-800 dark:text-rose-300 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              Antrag verwerfen
            </button>
            <button
              type="button"
              disabled={busy || Boolean(ersterOffen)}
              onClick={() => void aufnehmen()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Als Mitglied aufnehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
