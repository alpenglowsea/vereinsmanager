import React, { useState, useEffect, useRef } from 'react';
import { AppUpdateInfo, DeploymentMode } from '../types';
import { UpdateService, CURRENT_APP_VERSION } from '../services/updateService';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  Laptop,
  Cloud,
  Server,
  Terminal,
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw,
  CheckCheck
} from 'lucide-react';

interface AppVersionBadgeProps {
  currentMode: DeploymentMode;
  onOpenDeploymentHub?: () => void;
}

export const AppVersionBadge: React.FC<AppVersionBadgeProps> = ({
  currentMode,
  onOpenDeploymentHub
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>({
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    isUpdateAvailable: false
  });

  // Desktop In-App Updater State
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStepText, setUpdateStepText] = useState('');
  const [updateFinished, setUpdateFinished] = useState(false);

  // Docker Command Copy State
  const [copiedDocker, setCopiedDocker] = useState(false);

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

  const handleToggleSimulateUpdate = () => {
    const currentlySimulated = UpdateService.isUpdateSimulated();
    UpdateService.setSimulateUpdate(!currentlySimulated);
    fetchUpdateInfo();
  };

  // 1-Click Desktop In-App Auto-Update (Tauri)
  const handleExecuteDesktopUpdate = async () => {
    setIsUpdating(true);
    setUpdateProgress(5);
    setUpdateStepText('Starte Update-Prozess...');

    const res = await UpdateService.executeDesktopInAppUpdate((prog, text) => {
      setUpdateProgress(prog);
      setUpdateStepText(text);
    });

    if (res.success) {
      setUpdateFinished(true);
      setTimeout(() => {
        setIsUpdating(false);
        setUpdateFinished(false);
        setIsOpen(false);
        fetchUpdateInfo();
        window.location.reload();
      }, 1500);
    } else {
      setIsUpdating(false);
      alert('Update-Fehler: ' + (res.error || 'Unbekannter Fehler'));
    }
  };

  // 1-Click Cloud Reload (Zero-Touch)
  const handleExecuteCloudReload = () => {
    UpdateService.executeCloudReload();
  };

  // Copy Docker update command
  const handleCopyDockerCommand = () => {
    const cmd = UpdateService.getDockerUpdateCommand();
    navigator.clipboard.writeText(cmd);
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 3000);
  };

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
        title="Klicken für Versionsinformationen & 1-Klick-Updates"
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
            <span className="text-[9px] text-slate-500 font-mono">v{updateInfo.currentVersion}</span>
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

            {/* =================================================================== */}
            {/* FALL 1: LOKALER DESKTOP-MODUS */}
            {/* =================================================================== */}
            {currentMode === 'local' && (
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

                    {/* 1-Click Update Action or Progress Bar */}
                    {isUpdating ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-2xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                            <span>{updateStepText}</span>
                          </span>
                          <span>{updateProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${updateProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : updateFinished ? (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-2xs font-bold">
                        <CheckCheck className="w-4 h-4 text-emerald-500" />
                        <span>Update erfolgreich! Starte neu...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExecuteDesktopUpdate}
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Update jetzt per 1-Klick installieren</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5 text-2xs text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Ihre Desktop-App ist auf dem neuesten Stand. Alle Module sind aktuell.</span>
                  </div>
                )}
              </div>
            )}

            {/* =================================================================== */}
            {/* FALL 2: CLOUD-BETRIEB (ZERO-TOUCH WEB-APP) */}
            {/* =================================================================== */}
            {currentMode === 'cloud' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Zero-Touch Cloud-Updates</span>
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    Vollautomatisch
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-2xs text-emerald-950 dark:text-emerald-200">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-900 dark:text-emerald-100">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Automatische Hoster-Bereitstellung</span>
                  </div>
                  <p className="leading-relaxed">
                    Im Cloud-Modus wird die Web-App bei jedem neuen Release auf GitHub direkt von Ihrem Webhoster (Netlify, Vercel, Hetzner, etc.) aktualisiert.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteCloudReload}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>App jetzt neu laden (Sofort-Aktualisierung)</span>
                </button>
              </div>
            )}

            {/* =================================================================== */}
            {/* FALL 3: EIGENER SERVER & DOCKER (LÖSUNG B) */}
            {/* =================================================================== */}
            {currentMode === 'selfhosted' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                    <Server className="w-3.5 h-3.5" />
                    <span>Eigener Server (Docker)</span>
                  </span>
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-bold ${
                    updateInfo.isUpdateAvailable
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                      : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                  }`}>
                    {updateInfo.isUpdateAvailable ? `Neu: v${updateInfo.latestVersion}` : 'Server aktuell'}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-1.5 text-2xs text-blue-950 dark:text-blue-200">
                  <div className="flex items-center justify-between font-bold">
                    <span>Installierte Server-Version:</span>
                    <span className="font-mono">v{updateInfo.currentVersion}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>Neueste GitHub-Version:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">v{updateInfo.latestVersion}</span>
                  </div>
                  <p className="pt-1 text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Führen Sie auf Ihrem Server / NAS den folgenden Befehl im VereinsManager-Verzeichnis aus:
                  </p>
                </div>

                {/* 1-Klick Terminal Copy Box */}
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-blue-400" />
                      <span>docker-compose Update:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyDockerCommand}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-2xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedDocker ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDocker ? 'Kopiert!' : 'Kopieren'}</span>
                    </button>
                  </div>
                  <code className="block bg-slate-900 p-2 rounded text-2xs font-mono text-emerald-300 overflow-x-auto whitespace-nowrap">
                    docker compose pull && docker compose up -d
                  </code>
                </div>
              </div>
            )}

            {/* General Actions & Links */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-2xs">
              <button
                type="button"
                onClick={fetchUpdateInfo}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Prüfen</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Simulation button for demo & testing */}
                <button
                  type="button"
                  onClick={handleToggleSimulateUpdate}
                  className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 font-mono"
                  title="Testen: Schaltet simuliertes Update für Demozwecke ein/aus"
                >
                  {UpdateService.isUpdateSimulated() ? '🔴 Demo-Update aktiv' : '🧪 Demo-Update testen'}
                </button>

                <a
                  href={updateInfo.githubUrl || 'https://github.com/strelitzerfc/vereinsmanager/releases'}
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
