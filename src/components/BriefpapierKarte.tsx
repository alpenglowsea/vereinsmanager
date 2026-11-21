import React, { useEffect, useRef, useState } from 'react';
import { Check, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import type { InvoiceTemplateSettings } from '../types';
import { StorageService } from '../services/storage';
import { frage } from '../utils/dialoge';

/**
 * Briefpapier des Vereins (Einstellungen).
 *
 * Ein Briefpapier für alle Dokumente: Rechnungen, Sitzungen, Aufnahmeantrag.
 * Gespeichert wird es wie bisher in der Rechnungsvorlage (Felder
 * customBlanko… und marginTop) – so finden alle PDF-Erzeuger es ohne Umbau,
 * und bestehende Sicherungen bleiben gültig. Früher lag der Upload in der
 * Rechnungsvorlage; dort war er schwer zu finden.
 *
 * Änderungen wirken sofort (ohne „Vereinsstammdaten speichern“), genau wie das
 * Hinterlegen von Satzung und Datenschutz-Vordruck.
 */

const knopfKlasse =
  'inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold disabled:opacity-40';

const RAND_MIN = 20;
const RAND_MAX = 100;
const RAND_STANDARD = 45;

export const BriefpapierKarte: React.FC<{
  /** Nach dem Speichern: neue Vorlage an die App, damit Rechnungen sie sofort nutzen */
  onGeaendert?: (neu: InvoiceTemplateSettings) => void;
}> = ({ onGeaendert }) => {
  const [vorlage, setVorlage] = useState<InvoiceTemplateSettings | null>(null);
  const [rand, setRand] = useState('');
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const eingabe = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let ab = false;
    void StorageService.getInvoiceTemplate().then(v => {
      if (ab) return;
      setVorlage(v);
      setRand(String(v.marginTop || RAND_STANDARD));
    });
    return () => {
      ab = true;
    };
  }, []);

  const speichern = async (aenderung: Partial<InvoiceTemplateSettings>, text: string) => {
    if (!vorlage) return;
    setBusy(true);
    setMeldung(null);
    try {
      // Immer den neuesten Stand holen: Die Rechnungsvorlage könnte inzwischen
      // an anderer Stelle geändert worden sein (Texte, Farben).
      const aktuell = await StorageService.getInvoiceTemplate();
      const neu = { ...aktuell, ...aenderung };
      await StorageService.saveInvoiceTemplate(neu);
      setVorlage(neu);
      setMeldung({ text, fehler: false });
      onGeaendert?.(neu);
    } catch (err) {
      setMeldung({ text: `Speichern fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`, fehler: true });
    } finally {
      setBusy(false);
    }
  };

  const hochladen = (datei: File) => {
    // Nur PNG und JPEG: jsPDF kann ein PDF- oder WEBP-Briefpapier nicht als
    // Hintergrund zeichnen (D-45).
    if (datei.type !== 'image/png' && datei.type !== 'image/jpeg') {
      setMeldung({
        text: 'Bitte das Briefpapier als Bild im Format PNG oder JPG hochladen. Ein PDF lässt sich vorher z. B. über „Exportieren als Bild“ umwandeln.',
        fehler: true
      });
      return;
    }
    const r = new FileReader();
    r.onload = () =>
      void speichern(
        { customBlankoDataUrl: String(r.result), customBlankoFileName: datei.name, customBlankoUploadedAt: new Date().toISOString() },
        'Briefpapier gespeichert. Es gilt ab sofort für Rechnungen, Sitzungen und den Aufnahmeantrag.'
      );
    r.onerror = () => setMeldung({ text: 'Die Datei ließ sich nicht lesen.', fehler: true });
    r.readAsDataURL(datei);
  };

  const entfernen = async () => {
    const ja = await frage({
      titel: 'Briefpapier entfernen?',
      text: 'Danach nutzen alle Dokumente wieder die eingebaute Standardvorlage (DIN 5008).',
      bestaetigenText: 'Entfernen',
      gefahr: true
    });
    if (ja)
      await speichern(
        { customBlankoDataUrl: undefined, customBlankoFileName: undefined, customBlankoUploadedAt: undefined },
        'Briefpapier entfernt. Es gilt wieder die Standardvorlage.'
      );
  };

  const randSpeichern = () => {
    const zahl = Math.round(Number(rand.replace(',', '.')));
    if (!Number.isFinite(zahl) || zahl < RAND_MIN || zahl > RAND_MAX) {
      setMeldung({ text: `Der obere Rand muss zwischen ${RAND_MIN} und ${RAND_MAX} mm liegen.`, fehler: true });
      return;
    }
    if (vorlage && zahl === vorlage.marginTop) return;
    void speichern({ marginTop: zahl }, `Oberer Rand auf ${zahl} mm gesetzt.`);
  };

  const bild = vorlage?.customBlankoDataUrl?.startsWith('data:image') ? vorlage.customBlankoDataUrl : '';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Briefpapier</h3>
        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
          Ihr Vereinsbriefpapier als Bild (PNG oder JPG, am besten DIN A4 mit mindestens 1200 × 1700 Pixeln). Es liegt als Hintergrund unter Rechnungen,
          Sitzungsunterlagen und dem Aufnahmeantrag. Ohne eigenes Briefpapier gilt die eingebaute Standardvorlage nach DIN 5008. Wirkt sofort.
        </p>
      </div>

      <input
        ref={eingabe}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={e => {
          const datei = e.target.files?.[0];
          e.target.value = '';
          if (datei) hochladen(datei);
        }}
      />

      <div className="flex flex-col sm:flex-row gap-5">
        {/* Vorschau im Seitenverhältnis A4 */}
        <div className="w-28 shrink-0 aspect-[210/297] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex items-center justify-center">
          {bild ? (
            <img src={bild} alt="Vorschau des Briefpapiers" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div>
            {bild ? (
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Eigenes Briefpapier aktiv
              </p>
            ) : (
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Standardvorlage (DIN 5008) aktiv</p>
            )}
            <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">
              {bild ? vorlage?.customBlankoFileName || 'Hochgeladenes Briefpapier' : 'Noch kein eigenes Briefpapier hinterlegt.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !vorlage} onClick={() => eingabe.current?.click()} className={knopfKlasse}>
              <Upload className="w-3.5 h-3.5" /> {bild ? 'Austauschen' : 'Hochladen'}
            </button>
            {bild && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void entfernen()}
                className={`${knopfKlasse} text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60`}
              >
                <Trash2 className="w-3.5 h-3.5" /> Entfernen
              </button>
            )}
          </div>

          <div className="max-w-xs">
            <label htmlFor="briefpapier-rand" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Oberer Rand (mm)
            </label>
            <div className="flex gap-2">
              <input
                id="briefpapier-rand"
                type="number"
                min={RAND_MIN}
                max={RAND_MAX}
                value={rand}
                disabled={busy || !vorlage}
                onChange={e => setRand(e.target.value)}
                onBlur={randSpeichern}
                onKeyDown={e => {
                  if (e.key === 'Enter') randSpeichern();
                }}
                className="w-24 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
              Ab hier beginnt der Text, damit er Ihren Briefkopf nicht überdeckt; gilt auf allen Seiten. Standard: {RAND_STANDARD} mm.
            </p>
          </div>
        </div>
      </div>

      {meldung && (
        <p className={`text-xs font-semibold ${meldung.fehler ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{meldung.text}</p>
      )}
    </div>
  );
};
