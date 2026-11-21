/**
 * Einstellungen zum Aufnahmeantrag (P29, wie Android `AntragEinstellungenKarten`):
 * Texte im Antrag, Satzung und Datenschutz-Vordruck als PDF, leeres
 * Antragsformular zum Ausdrucken. Die Beiträge je Mitgliedsart stehen in der
 * Karte darüber (Beitragsvorgaben).
 *
 * Die Texte werden mit „Vereinsstammdaten speichern“ gespeichert, wie alles
 * auf dieser Seite. Satzung und Datenschutz-Vordruck wirken sofort, weil dabei
 * ein Dokument im Archiv entsteht.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Eye, FileDown, FileText, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { ClubDocument, ClubSettings } from '../types';
import { BEILAGEN, Beilage, STANDARD_DATENSCHUTZ, STANDARD_SATZUNG, beilageFehler } from '../utils/antragRegeln';
import { lokalesHeute } from '../utils/mitgliedRegeln';
import { StorageService } from '../services/storage';
import { antragPdfErzeugen } from '../services/antragPdfDatei';
import { briefpapierFuerSitzungen } from '../services/meetingPdfService';
import { saveBlobAs } from '../utils/fileExportHelper';
import { DocumentViewerModal } from './DocumentViewerModal';

const textKlasse =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white leading-relaxed';
const knopfKlasse =
  'inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold disabled:opacity-40';

function leseDatei(datei: File): Promise<{ dataUrl: string; kopf: Uint8Array }> {
  return Promise.all([
    new Promise<string>((ok, fehler) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fehler(r.error);
      r.readAsDataURL(datei);
    }),
    datei.slice(0, 8).arrayBuffer().then(b => new Uint8Array(b))
  ]).then(([dataUrl, kopf]) => ({ dataUrl, kopf }));
}

export const AntragEinstellungenKarte: React.FC<{
  /** Die gespeicherten Vereinsdaten (für Beilagen und das leere Formular) */
  settings: ClubSettings;
  datenschutz: string;
  satzung: string;
  onDatenschutz: (t: string) => void;
  onSatzung: (t: string) => void;
  /** Nach dem Hinterlegen oder Entfernen einer Beilage (Kennung oder null) */
  onBeilage: (feld: 'applicationStatuteDocId' | 'applicationPrivacyDocId', id: string | null) => void;
}> = ({ settings, datenschutz, satzung, onDatenschutz, onSatzung, onBeilage }) => {
  const [doks, setDoks] = useState<Partial<Record<Beilage, ClubDocument | null>>>({});
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<ClubDocument | null>(null);
  const waehle = useRef<Beilage | null>(null);
  const eingabe = useRef<HTMLInputElement | null>(null);

  const satzungId = settings.applicationStatuteDocId || '';
  const datenschutzId = settings.applicationPrivacyDocId || '';
  useEffect(() => {
    let ab = false;
    void Promise.all([
      satzungId ? StorageService.getDocument(satzungId) : Promise.resolve(null),
      datenschutzId ? StorageService.getDocument(datenschutzId) : Promise.resolve(null)
    ]).then(([s, d]) => {
      if (!ab) setDoks({ satzung: s, datenschutz: d });
    });
    return () => {
      ab = true;
    };
  }, [satzungId, datenschutzId]);

  const hochladen = async (b: Beilage, datei: File) => {
    setBusy(b);
    setMeldung(null);
    try {
      const { dataUrl, kopf } = await leseDatei(datei);
      const f = beilageFehler(kopf, datei.size);
      if (f) {
        setMeldung({ text: `Die Datei lässt sich nicht übernehmen: ${f}`, fehler: true });
        return;
      }
      const { dokument } = await StorageService.antragBeilageSetzen(b, dataUrl, datei.name, datei.size);
      setDoks(prev => ({ ...prev, [b]: dokument }));
      onBeilage(BEILAGEN[b].feld, dokument.id);
      setMeldung({ text: `${BEILAGEN[b].titel} hinterlegt (im Archiv als „${dokument.title}“).`, fehler: false });
    } catch (err) {
      setMeldung({ text: `Die Datei lässt sich nicht übernehmen: ${err instanceof Error ? err.message : String(err)}`, fehler: true });
    } finally {
      setBusy(null);
    }
  };

  const entfernen = async (b: Beilage) => {
    setBusy(b);
    try {
      await StorageService.antragBeilageEntfernen(b);
      setDoks(prev => ({ ...prev, [b]: null }));
      onBeilage(BEILAGEN[b].feld, null);
      setMeldung({ text: `${BEILAGEN[b].titel} wird im Antrag nicht mehr angeboten. Das Dokument bleibt im Archiv.`, fehler: false });
    } finally {
      setBusy(null);
    }
  };

  const leeresFormular = async () => {
    setBusy('leer');
    setMeldung(null);
    try {
      const [rechnung, sitzung] = await Promise.all([StorageService.getInvoiceTemplate(), StorageService.getMeetingTemplate()]);
      const pdf = antragPdfErzeugen(null, settings, '', lokalesHeute(), briefpapierFuerSitzungen(sitzung ?? undefined, rechnung ?? undefined));
      await saveBlobAs(pdf.blob, 'Aufnahmeantrag-leer.pdf');
    } catch (err) {
      setMeldung({ text: `Das PDF ließ sich nicht erstellen: ${err instanceof Error ? err.message : String(err)}`, fehler: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Aufnahmeantrag</h3>
        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
          Für „Neues Mitglied aufnehmen“ im Menü Mitglieder. Die Beiträge stehen in der Karte darüber. „{'{verein}'}“ wird durch den Vereinsnamen ersetzt. Bitte
          lassen Sie die Texte von jemandem prüfen, der sich mit Vereins- und Datenschutzrecht auskennt.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Einwilligung zur Datenverarbeitung</label>
        <textarea rows={6} value={datenschutz} onChange={e => onDatenschutz(e.target.value)} className={textKlasse} />
        <button type="button" onClick={() => onDatenschutz(STANDARD_DATENSCHUTZ)} className="inline-flex items-center gap-1 text-2xs font-bold text-blue-700 dark:text-blue-400 hover:underline">
          <RotateCcw className="w-3 h-3" /> Standardtext wiederherstellen
        </button>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Anerkennung der Satzung</label>
        <textarea rows={2} value={satzung} onChange={e => onSatzung(e.target.value)} className={textKlasse} />
        <button type="button" onClick={() => onSatzung(STANDARD_SATZUNG)} className="inline-flex items-center gap-1 text-2xs font-bold text-blue-700 dark:text-blue-400 hover:underline">
          <RotateCcw className="w-3 h-3" /> Standardtext wiederherstellen
        </button>
        <p className="text-2xs text-slate-500 dark:text-slate-400">Die Texte gelten nach „Vereinsstammdaten speichern“ unten auf der Seite.</p>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Satzung und Datenschutz-Vordruck</h4>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
            Beides als PDF (höchstens 10 MB). Das neue Mitglied kann die Dateien in Schritt 4 des Antrags öffnen. Ein neuer Upload legt eine neue Fassung
            mit Datum im Titel im Dokumentenarchiv ab; frühere Fassungen bleiben dort erhalten. Wirkt sofort; ungespeicherte Änderungen auf dieser
            Seite bitte vorher speichern, sonst gehen sie verloren.
          </p>
        </div>
        <input
          ref={eingabe}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => {
            const datei = e.target.files?.[0];
            const b = waehle.current;
            e.target.value = '';
            if (datei && b) void hochladen(b, datei);
          }}
        />
        {(Object.keys(BEILAGEN) as Beilage[]).map(b => {
          const dok = doks[b];
          return (
            <div key={b} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> {BEILAGEN[b].titel}
                </p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{dok ? `Aktuell: ${dok.title} (${dok.fileName})` : 'Noch nichts hinterlegt.'}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    waehle.current = b;
                    eingabe.current?.click();
                  }}
                  className={knopfKlasse}
                >
                  {busy === b ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {dok ? 'Neue Fassung' : 'PDF hochladen'}
                </button>
                {dok && (
                  <>
                    <button type="button" onClick={() => setAnsicht(dok)} className={knopfKlasse}>
                      <Eye className="w-3.5 h-3.5" /> Ansehen
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => void entfernen(b)} className={knopfKlasse}>
                      <Trash2 className="w-3.5 h-3.5" /> Entfernen
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Leeres Antragsformular</h4>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
            Zum Ausdrucken, wenn jemand den Antrag lieber auf Papier ausfüllt. Mit dem Briefpapier aus der Karte „Briefpapier“, falls dort eines liegt, und mit
            den gespeicherten Beiträgen und Texten.
          </p>
        </div>
        <button type="button" disabled={busy !== null} onClick={() => void leeresFormular()} className={`${knopfKlasse} shrink-0`}>
          {busy === 'leer' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          Als PDF speichern
        </button>
      </div>

      {meldung && (
        <p className={`text-xs font-semibold ${meldung.fehler ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{meldung.text}</p>
      )}
      {ansicht && <DocumentViewerModal document={ansicht} onClose={() => setAnsicht(null)} />}
    </div>
  );
};
