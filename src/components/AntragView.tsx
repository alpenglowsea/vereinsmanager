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
import { AlertTriangle, Building2, CheckCircle2, CreditCard, FileText, Loader2, PenTool, User, UserPlus, X } from 'lucide-react';
import type { ClubDocument, ClubSettings, Member } from '../types';
import type { Unterschrift } from '../utils/unterschrift';
import {
  ANTRAG_ARTEN,
  Antrag,
  BEZIEHUNGEN,
  GESCHLECHTER,
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
  ersteFehlerSeite,
  kontoinhaberMussUnterschreiben,
  kontoinhaberVorschlag,
  leseAntragEinstellungen,
  minderjaehrig,
  mitVerein,
  neuerAntrag,
  vorschlagArt
} from '../utils/antragRegeln';
import { lokalesHeute } from '../utils/mitgliedRegeln';
import { naechsteNummerImSchema } from '../utils/nummern';
import { frage } from '../utils/dialoge';
import { StorageService } from '../services/storage';
import { antragPdfErzeugen } from '../services/antragPdfDatei';
import type { Briefpapier } from '../services/meetingPdfService';
import { Vorschau, Zeichenflaeche } from './UnterschriftFeld';
import { useBlobAdresse } from '../utils/pdfVorschau';

const sparteListe = (s: ClubSettings) => ((s.departments || []).length ? s.departments : ['Hauptverein']);

// ------------------------------------------------------------------ kleine Bausteine

const feldKlasse = (fehler?: string) =>
  `w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
    fehler ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-700'
  }`;

const Fehlertext: React.FC<{ text?: string }> = ({ text }) =>
  text ? <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{text}</p> : null;

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
    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</span>
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
    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</span>
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
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{titel}</p>
      {da && (
        <div className="h-20 flex items-center justify-center bg-white border border-slate-300 rounded-xl px-3 text-slate-900">
          <Vorschau u={u} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
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
const PdfAnsicht: React.FC<{ titel: string; dataUrl: string; onSchliessen: () => void }> = ({ titel, dataUrl, onSchliessen }) => {
  // Blob-Adresse statt Data-URL, sonst bleibt die Vorschau leer (T-261)
  const adresse = useBlobAdresse(dataUrl);
  return (
    <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> {titel}
          </h3>
          <button type="button" onClick={onSchliessen} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
            Schließen
          </button>
        </div>
        {adresse && <iframe src={adresse} title={titel} className="flex-1 w-full border-0 bg-slate-100" />}
      </div>
    </div>
  );
};

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
  // Höchster bisher erreichter Schritt: bis dorthin lassen sich die Reiter frei anklicken
  const [erreicht, setErreicht] = useState(SEITE_PERSON);
  const [zeigeFehler, setZeigeFehler] = useState(false);
  const [abgegeben, setAbgegeben] = useState(false);
  const [ansicht, setAnsicht] = useState<{ titel: string; dataUrl: string } | null>(null);

  const satzungDok = einst.satzungDokId ? dokumente.find(d => d.id === einst.satzungDokId) : undefined;
  const datenschutzDok = einst.datenschutzDokId ? dokumente.find(d => d.id === einst.datenschutzDokId) : undefined;
  const f = zeigeFehler ? fehlerAuf(seite, a, heute, sparten) : {};
  const minder = minderjaehrig(a, heute);
  const set = (w: Partial<Antrag>) => setA(prev => ({ ...prev, ...w }));
  const reiterHatFehler = (s: number) => zeigeFehler && s !== SEITE_ZUSAMMENFASSUNG && s <= erreicht && Object.keys(fehlerAuf(s, a, heute, sparten)).length > 0;

  // Die Escape-Taste tut nichts: Verlassen nur über „Abbrechen (Vereinsvertreter)“.
  useEffect(() => {
    const sperre = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', sperre, true);
    return () => window.removeEventListener('keydown', sperre, true);
  }, []);

  /** Beim Verlassen eines Schritts: Vorschläge eintragen, die sich aus ihm ergeben. */
  const mitVorschlaegen = (von: number, x: Antrag): Antrag => {
    let neu = x;
    if (von === SEITE_PERSON && neu.mitgliedsart === 'full') {
      const v = vorschlagArt(alter(neu.geburtsdatum, heute));
      if (v) neu = { ...neu, mitgliedsart: v };
    }
    // Kontoinhaber vorschlagen; bei unter 18 der gesetzliche Vertreter (T-258)
    if (von < SEITE_ZAHLUNG && neu.zahlungsart === 'sepa' && !neu.kontoinhaber.trim()) neu = { ...neu, kontoinhaber: kontoinhaberVorschlag(neu, heute) };
    return neu;
  };

  const gehe = (ziel: number) => {
    setA(prev => mitVorschlaegen(seite, prev));
    setSeite(ziel);
    document.getElementById('antrag-inhalt')?.scrollTo({ top: 0 });
  };

  const weiter = () => {
    if (seite === SEITE_ZUSAMMENFASSUNG) {
      const erste = ersteFehlerSeite(a, heute, sparten);
      if (erste !== null) {
        setZeigeFehler(true);
        gehe(erste);
        return;
      }
      onAbgegeben(a);
      setAbgegeben(true);
      return;
    }
    if (Object.keys(fehlerAuf(seite, a, heute, sparten)).length) {
      setZeigeFehler(true);
      return;
    }
    setZeigeFehler(false);
    setErreicht(e => Math.max(e, seite + 1));
    gehe(seite + 1);
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
  const reiter: { nr: number; titel: string; icon: React.ReactNode }[] = [
    { nr: SEITE_PERSON, titel: '1. Person', icon: <User className="w-4 h-4" /> },
    { nr: SEITE_MITGLIEDSCHAFT, titel: '2. Mitgliedschaft', icon: <Building2 className="w-4 h-4" /> },
    { nr: SEITE_ZAHLUNG, titel: '3. Zahlung', icon: <CreditCard className="w-4 h-4" /> },
    { nr: SEITE_ERKLAERUNG, titel: '4. Erklärungen & Unterschrift', icon: <PenTool className="w-4 h-4" /> },
    { nr: SEITE_ZUSAMMENFASSUNG, titel: '5. Prüfen & Abgeben', icon: <CheckCircle2 className="w-4 h-4" /> }
  ];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Aufnahmeantrag"
    >
      {ansicht && <PdfAnsicht titel={ansicht.titel} dataUrl={ansicht.dataUrl} onSchliessen={() => setAnsicht(null)} />}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 my-8 dark:bg-slate-900 dark:border-slate-800">
        {/* Kopf */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/40 dark:text-blue-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{abgegeben ? 'Antrag abgegeben' : 'Aufnahmeantrag'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{verein ? `Mitgliedschaft im ${verein}` : 'Antrag auf Mitgliedschaft'}</p>
            </div>
          </div>
          {!abgegeben && (
            <button
              type="button"
              onClick={() => void abbrechen()}
              className="shrink-0 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Abbrechen (Vereinsvertreter)
            </button>
          )}
        </div>

        {/* Reiter wie „Neues Mitglied anlegen“ */}
        {!abgegeben && (
          <div className="flex border-b border-slate-200 bg-white px-6 gap-2 pt-2 overflow-x-auto text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {reiter.map(r => {
              const aktiv = seite === r.nr;
              const fehlt = reiterHatFehler(r.nr);
              const frei = r.nr <= erreicht;
              return (
                <button
                  key={r.nr}
                  type="button"
                  disabled={!frei}
                  onClick={() => gehe(r.nr)}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    fehlt
                      ? aktiv
                        ? 'border-rose-600 text-rose-600 font-semibold dark:text-rose-400'
                        : 'border-transparent text-rose-600 dark:text-rose-400'
                      : aktiv
                      ? 'border-blue-600 text-blue-600 font-semibold dark:text-blue-400'
                      : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r.icon}
                  {r.titel}
                  {fehlt && <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" title="Hier fehlt noch etwas" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Inhalt */}
        <div id="antrag-inhalt" className="p-6 max-h-[60vh] overflow-y-auto space-y-5">
          {abgegeben ? (
            <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-2 dark:bg-blue-950/40 dark:border-blue-900">
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Vielen Dank!
              </h3>
              <p className="text-sm text-blue-900 dark:text-blue-200">
                Ihr Antrag ist ausgefüllt und unterschrieben. Bitte geben Sie den Platz jetzt an den Vereinsvertreter zurück. Er prüft den Antrag und nimmt
                Sie als Mitglied auf.
              </p>
            </div>
          ) : seite === SEITE_ZUSAMMENFASSUNG ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Bitte prüfen Sie Ihre Angaben. Stimmt etwas nicht, wechseln Sie oben in den Abschnitt und ändern es. Mit „Antrag abgeben“ ist der Antrag
                fertig.
              </p>
              <Uebersicht a={a} settings={settings} heute={heute} />
            </>
          ) : (
            <>
              {seite === SEITE_PERSON && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Feld label="Vorname *" wert={a.vorname} onChange={v => set({ vorname: v })} fehler={f.vorname} />
                    <Feld label="Nachname *" wert={a.nachname} onChange={v => set({ nachname: v })} fehler={f.nachname} />
                    <Auswahl label="Geschlecht" wert={a.geschlecht} optionen={GESCHLECHTER} onChange={v => set({ geschlecht: v as Antrag['geschlecht'] })} />
                    <Feld label="Geburtsdatum *" typ="date" wert={a.geburtsdatum} onChange={v => set({ geburtsdatum: v })} fehler={f.geburtsdatum} />
                    <Feld label="Staatsangehörigkeit" wert={a.staatsangehoerigkeit} onChange={v => set({ staatsangehoerigkeit: v })} />
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Anschrift & Kontakt</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Feld label="Straße *" wert={a.strasse} onChange={v => set({ strasse: v })} fehler={f.strasse} />
                      <Feld label="Hausnummer *" wert={a.hausnummer} onChange={v => set({ hausnummer: v })} fehler={f.hausnummer} />
                      <Feld label="Postleitzahl *" wert={a.plz} onChange={v => set({ plz: v })} fehler={f.plz} />
                      <Feld label="Ort *" wert={a.ort} onChange={v => set({ ort: v })} fehler={f.ort} />
                      <Feld label="Land" wert={a.land} onChange={v => set({ land: v })} />
                      <div className="hidden sm:block" />
                      <Feld label="Telefon (freiwillig)" typ="tel" wert={a.telefon} onChange={v => set({ telefon: v })} />
                      <Feld label="E-Mail (freiwillig)" typ="email" wert={a.email} onChange={v => set({ email: v })} fehler={f.email} />
                    </div>
                  </div>
                  {minder && datum(a.geburtsdatum) && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-4 dark:bg-amber-950/30 dark:border-amber-900">
                      <div>
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Gesetzlicher Vertreter</h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          Unter 18 Jahren stellt ein Elternteil oder gesetzlicher Vertreter den Antrag und unterschreibt ihn.
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Auswahl label="Sparte *" wert={a.sparte} optionen={sparten.map(x => ({ wert: x, label: x }))} onChange={v => set({ sparte: v })} fehler={f.sparte} />
                    <Auswahl
                      label="Mitgliedsart *"
                      wert={a.mitgliedsart}
                      optionen={ANTRAG_ARTEN.map(x => ({ wert: x.art, label: x.label }))}
                      onChange={v => set({ mitgliedsart: v as Antrag['mitgliedsart'] })}
                      fehler={f.mitgliedsart}
                    />
                  </div>
                  {vorschlag && a.mitgliedsart !== vorschlag && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
                      <span>Hinweis: Für Personen unter 18 Jahren gibt es die Art „{artName(vorschlag)}“.</span>
                      <button type="button" onClick={() => set({ mitgliedsart: vorschlag })} className="font-bold underline">
                        Diese Art übernehmen
                      </button>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ihr Mitgliedsbeitrag</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{beitragText(einst.beitraege[a.mitgliedsart])}</span>
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
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Zahlungsart</span>
                    <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
                      {(['sepa', 'transfer'] as const).map(z => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => set({ zahlungsart: z, kontoinhaber: a.kontoinhaber || (z === 'sepa' ? kontoinhaberVorschlag(a, heute) : '') })}
                          className={`px-4 py-2 text-sm font-semibold ${
                            a.zahlungsart === z ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {z === 'sepa' ? 'Lastschrift (SEPA)' : 'Überweisung'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {a.zahlungsart === 'sepa' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Feld
                          label="Kontoinhaber *"
                          wert={a.kontoinhaber}
                          onChange={v => set({ kontoinhaber: v })}
                          fehler={f.kontoinhaber}
                          hinweis={minder ? 'Meist der gesetzliche Vertreter; bitte ändern, wenn das Konto einer anderen Person gehört' : 'Name der Person, von deren Konto abgebucht wird'}
                          breit
                        />
                        <Feld label="IBAN *" wert={a.iban} onChange={v => set({ iban: v })} fehler={f.iban} hinweis="z. B. DE89 3704 0044 0532 0130 00" breit />
                        <Feld label="BIC (freiwillig)" wert={a.bic} onChange={v => set({ bic: v })} fehler={f.bic} />
                        <Feld label="Name der Bank (freiwillig)" wert={a.bankname} onChange={v => set({ bankname: v })} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed p-3 bg-slate-50 border border-slate-200 rounded-xl dark:bg-slate-800 dark:border-slate-700">
                        {mitVerein(SEPA_TEXT, verein)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Bitte überweisen Sie den Beitrag nach Aufforderung durch den Verein. Es wird kein Lastschriftmandat erteilt.
                    </p>
                  )}
                </>
              )}

              {seite === SEITE_ERKLAERUNG && (
                <>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 dark:bg-slate-800 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Einwilligung zur Datenverarbeitung</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{mitVerein(einst.datenschutz, verein)}</p>
                    {datenschutzDok && (
                      <button
                        type="button"
                        onClick={() => setAnsicht({ titel: 'Datenschutz', dataUrl: datenschutzDok.dataUrl })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> Datenschutz-Vordruck ansehen
                      </button>
                    )}
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                      <input type="checkbox" checked={a.datenschutz} onChange={e => set({ datenschutz: e.target.checked })} className="w-4 h-4" />
                      Ich willige ein.
                    </label>
                    <Fehlertext text={f.datenschutz} />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 dark:bg-slate-800 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Satzung</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{mitVerein(einst.satzung, verein)}</p>
                    {satzungDok && (
                      <button
                        type="button"
                        onClick={() => setAnsicht({ titel: 'Satzung', dataUrl: satzungDok.dataUrl })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> Satzung ansehen
                      </button>
                    )}
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                      <input type="checkbox" checked={a.satzung} onChange={e => set({ satzung: e.target.checked })} className="w-4 h-4" />
                      Ich erkenne die Satzung an.
                    </label>
                    <Fehlertext text={f.satzung} />
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Unterschrift</h4>
                    {/* Unter 18 unterschreibt allein der gesetzliche Vertreter (T-258) */}
                    {minder ? (
                      <Unterschriftsfeld
                        titel={`Unterschrift gesetzlicher Vertreter (${a.vertreterName})`}
                        u={a.vertreterUnterschrift}
                        fehler={f.vertreterUnterschrift}
                        onNeu={u => set({ vertreterUnterschrift: u })}
                      />
                    ) : (
                      <Unterschriftsfeld
                        titel={`Unterschrift ${antragName(a) || 'Antragsteller'}`}
                        u={a.unterschrift}
                        fehler={f.unterschrift}
                        onNeu={u => set({ unterschrift: u })}
                      />
                    )}
                    {kontoinhaberMussUnterschreiben(a, heute) && (
                      <>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
            </>
          )}
        </div>

        {/* Fuß wie „Neues Mitglied anlegen“ */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 dark:bg-slate-800 dark:border-slate-800">
          <div className="text-xs">
            {offeneFehler && (
              <span className="text-rose-600 font-medium flex items-center gap-1 dark:text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Bitte die rot markierten Angaben prüfen
              </span>
            )}
          </div>
          {abgegeben ? (
            <button type="button" onClick={onWeiter} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              Weiter (Vereinsvertreter)
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={seite === SEITE_PERSON}
                onClick={() => {
                  setZeigeFehler(false);
                  gehe(seite - 1);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Zurück
              </button>
              <button type="button" onClick={weiter} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
                {seite === SEITE_ZUSAMMENFASSUNG ? 'Antrag abgeben' : 'Weiter'}
              </button>
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
  briefpapier: Briefpapier | null;
  onAufgenommen: (m: Member) => void;
  onVerworfen: () => void;
  onSchliessen: () => void;
}> = ({ antrag: a, settings, members, briefpapier, onAufgenommen, onVerworfen, onSchliessen }) => {
  const heute = useMemo(() => lokalesHeute(), []);
  const sparten = sparteListe(settings);
  // Höchste vergebene Mitgliedsnummer + 1, wie im Mitgliedsformular (T-257)
  const vorschlagNummer = useMemo(() => naechsteNummerImSchema(members.map(m => m.memberNumber), 'M-0101'), [members]);
  const [nummer, setNummer] = useState(vorschlagNummer);
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
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">Nächste freie Nummer: {vorschlagNummer}</span>
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
