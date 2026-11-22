import React, { useState, useEffect, useRef } from 'react';
import { AppUpdateInfo } from '../types';
import { UpdateService } from '../services/updateService';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';

export const AppVersionBadge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>(() => {
    const current = UpdateService.getCurrentVersionSync();
    return {
      currentVersion: current,
      latestVersion: current,
      isUpdateAvailable: false
    };
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initial check on mount
  useEffect(() => {
    fetchUpdateInfo();
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUpdateInfo = async () => {
    setLoading(true);
    try {
      const info = await UpdateService.checkForUpdates();
      setUpdateInfo(info);
    } catch (e) {
      console.warn('Update check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Neue Version: zur Download-Seite auf GitHub. Eine Installation aus der
   * App heraus gibt es nicht; bis R2 wurde sie nur vorgetäuscht (siehe
   * CHANGELOG). Für Windows der neueste Stand direkt.
   */
  const downloadAdresse =
    (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
      ? updateInfo.downloadUrls?.windows
      : undefined) ||
    updateInfo.githubUrl ||
    'https://github.com/alpenglowsea/vereinsmanager/releases/latest';

  return (
    <div className="relative w-full">
      {/* ========================================================================= */}
      {/* VERSION TILE IN SIDEBAR (Unter "Einstellungen") */}
      {/* ========================================================================= */}
      <button
        ref={buttonRef}
        id="nav-btn-version"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border cursor-pointer select-none relative group ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-600 shadow-md ring-1 ring-blue-500/30'
            : updateInfo.isUpdateAvailable
            ? 'bg-slate-800/90 text-amber-300 border-amber-500/40 hover:bg-slate-800 hover:border-amber-400'
            : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
        }`}
        title="Klicken für Versionsinformationen und neue Versionen"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            {updateInfo.isUpdateAvailable ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}

            {/* Kleiner roter Benachrichtigungspunkt bei Update */}
            {updateInfo.isUpdateAvailable && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-ping" />
            )}
          </div>

          <div className="text-left truncate">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-slate-200 text-2xs">
                Version {updateInfo.currentVersion}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {updateInfo.isUpdateAvailable ? (
                <span className="text-amber-400 font-semibold">Update verfügbar: v{updateInfo.latestVersion}</span>
              ) : (
                <span>Aktuell & geprüft</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {updateInfo.isUpdateAvailable ? (
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          ) : (
            <span className="text-[9px] text-slate-500 font-mono dark:text-slate-400">v{updateInfo.currentVersion}</span>
          )}
        </div>
      </button>

      {/* ========================================================================= */}
      {/* SPRECHBLASE / POPOVER FÜR 1-KLICK-UPDATES */}
      {/* ========================================================================= */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 bottom-full mb-2 w-72 sm:w-84 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 text-slate-900 dark:text-slate-100"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Sprechblasen-Dreieck nach unten zum Button */}
          <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 transform rotate-45" />

          {/* Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>VereinsManager</span>
                  <span className="text-2xs font-mono font-normal px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded">
                    v{updateInfo.currentVersion}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 space-y-3.5 max-h-96 overflow-y-auto text-xs">

            <div className="space-y-3">
              {updateInfo.isUpdateAvailable ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-2">
                    <div className="font-bold text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{updateInfo.releaseTitle || `Update v${updateInfo.latestVersion} verfügbar`}</span>
                    </div>

                    {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
                      <ul className="text-2xs text-slate-600 dark:text-slate-300 space-y-1 pl-1">
                        {updateInfo.releaseNotes.slice(0, 3).map((note, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Ehrlich: herunterladen statt vorgetäuschter 1-Klick-Installation */}
                  <div className="space-y-1.5">
                    <a
                      href={downloadAdresse}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Neue Version herunterladen (GitHub)</span>
                    </a>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Die App aktualisiert sich nicht selbst. Laden Sie das Installationsprogramm herunter und führen Sie es aus.
                      Erstellen Sie vorher eine Datensicherung (Einstellungen → Datensicherung). Öffnet sich die Seite nicht,
                      rufen Sie diese Adresse im Browser auf: <span className="font-mono break-all select-all">{downloadAdresse}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5 text-2xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Keine neuere Version gefunden. (Ohne Internetverbindung lässt sich das nicht prüfen.)</span>
                </div>
              )}
            </div>

            {/* General Actions & Links */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-2xs">
              <button
                type="button"
                onClick={fetchUpdateInfo}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 cursor-pointer dark:text-slate-400"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Prüfen</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={updateInfo.githubUrl || 'https://github.com/alpenglowsea/vereinsmanager/releases'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-bold"
                >
                  <span>Changelog</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
