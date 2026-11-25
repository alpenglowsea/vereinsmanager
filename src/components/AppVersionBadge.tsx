import React, { useState, useEffect, useRef } from 'react';
import { UpdateService } from '../services/updateService';
import { ergebnisText, VERSIONEN_SEITE, type Pruefergebnis } from '../utils/versionspruefung';
import { Sparkles, RefreshCw, ExternalLink, X, ShieldCheck, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';

/**
 * Versionsanzeige unten in der Seitenleiste, mit Versionsprüfung.
 *
 * Seit 25.11.2026 prüft die App **nur auf Klick** („Jetzt prüfen“ im aufgeklappten Fenster). Vorher fragte sie bei jedem
 * Start von selbst bei GitHub nach. Das Ergebnis gilt bis zum Beenden der App; gespeichert wird nichts.
 */
export const AppVersionBadge: React.FC = () => {
  const [offen, setOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [installiert, setInstalliert] = useState(UpdateService.getCurrentVersionSync());
  const [ergebnis, setErgebnis] = useState<Pruefergebnis | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const fensterRef = useRef<HTMLDivElement>(null);
  const knopfRef = useRef<HTMLButtonElement>(null);

  // Nur die installierte Version lesen (aus dem Programm selbst, ohne Netz).
  useEffect(() => {
    UpdateService.getCurrentVersion().then(setInstalliert).catch(() => {});
  }, []);

  useEffect(() => {
    const ausserhalb = (event: MouseEvent) => {
      if (fensterRef.current && !fensterRef.current.contains(event.target as Node) && knopfRef.current && !knopfRef.current.contains(event.target as Node)) {
        setOffen(false);
      }
    };
    if (offen) document.addEventListener('mousedown', ausserhalb);
    return () => document.removeEventListener('mousedown', ausserhalb);
  }, [offen]);

  const pruefen = async () => {
    setLaeuft(true);
    setKopiert(false);
    try {
      const r = await UpdateService.pruefeAufNeueVersion();
      setInstalliert(r.installiert);
      setErgebnis(r.ergebnis);
    } finally {
      setLaeuft(false);
    }
  };

  const neu = ergebnis?.art === 'neuer' ? ergebnis : null;
  const seite = neu?.seite ?? VERSIONEN_SEITE;

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(seite);
      setKopiert(true);
    } catch {
      // Zwischenablage nicht erreichbar: Die Adresse steht markierbar daneben.
    }
  };

  const unterzeile = laeuft
    ? 'Prüfe …'
    : !ergebnis
      ? 'Klicken: nach Updates suchen'
      : neu
        ? `Neue Version: ${neu.version}`
        : ergebnis.art === 'fehler'
          ? 'Prüfung fehlgeschlagen'
          : ergebnis.art === 'keineVeroeffentlicht'
            ? 'Geprüft: nichts veröffentlicht'
            : 'Geprüft: aktuell';

  return (
    <div className="relative w-full">
      <button
        ref={knopfRef}
        id="nav-btn-version"
        type="button"
        onClick={() => setOffen(!offen)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border cursor-pointer select-none relative group ${
          offen
            ? 'bg-slate-800 text-white border-slate-600 shadow-md ring-1 ring-blue-500/30'
            : neu
              ? 'bg-slate-800/90 text-amber-300 border-amber-500/40 hover:bg-slate-800 hover:border-amber-400'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
        }`}
        title="Version anzeigen und auf Wunsch nach einer neuen Version suchen"
      >
        <div className="flex items-center gap-2 min-w-0">
          {neu ? <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          <div className="text-left truncate">
            <div className="font-bold text-slate-200 text-2xs leading-tight">Version {installiert}</div>
            <div className={`text-[9px] truncate ${neu ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>{unterzeile}</div>
          </div>
        </div>
        {neu && <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 shrink-0" />}
      </button>

      {offen && (
        <div
          ref={fensterRef}
          className="absolute left-0 bottom-full mb-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden text-slate-900 dark:text-slate-100"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs font-bold">
              VereinsManager <span className="text-2xs font-mono font-normal px-1.5 bg-slate-200 dark:bg-slate-800 rounded">{installiert}</span>
            </div>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto text-xs">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Die App verbindet sich nur mit GitHub, wenn Sie auf „Jetzt prüfen“ klicken. Gefragt wird nur, welche Version die neueste ist;
              Vereinsdaten werden nicht übertragen. GitHub sieht dabei, wie bei jedem Seitenaufruf, die Internetadresse dieses Anschlusses.
            </p>

            <button
              type="button"
              onClick={pruefen}
              disabled={laeuft}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${laeuft ? 'animate-spin' : ''}`} />
              <span>{laeuft ? 'Prüfe …' : ergebnis ? 'Erneut prüfen' : 'Jetzt prüfen'}</span>
            </button>

            {ergebnis && !laeuft && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2 text-[11px] leading-relaxed ${
                  neu
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100'
                    : ergebnis.art === 'fehler'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-100'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-100'
                }`}
              >
                {neu ? (
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
                ) : ergebnis.art === 'fehler' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span>{ergebnisText(ergebnis, installiert)}</span>
              </div>
            )}

            {neu && (
              <div className="space-y-1.5">
                <a
                  href={seite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Zur Download-Seite (GitHub)</span>
                </a>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Die App aktualisiert sich nicht selbst. Erstellen Sie vorher eine Datensicherung (Einstellungen → Datensicherung), laden Sie dann
                  das Installationsprogramm herunter und führen Sie es aus. Öffnet sich die Seite nicht, rufen Sie diese Adresse im Browser auf:{' '}
                  <span className="font-mono break-all select-all">{seite}</span>
                </p>
                <button type="button" onClick={kopieren} className="text-2xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <Copy className="w-3 h-3" />
                  <span>{kopiert ? 'Adresse kopiert' : 'Adresse kopieren'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
