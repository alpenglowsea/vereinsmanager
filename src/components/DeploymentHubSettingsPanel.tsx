import React, { useState, useEffect } from 'react';
import { DeploymentMode } from '../types';
import { StorageService } from '../services/storage';
import {
  CheckCircle2,
  Database,
  ShieldCheck,
  Check,
  Laptop,
  Download,
  RefreshCw
} from 'lucide-react';

interface DeploymentHubSettingsPanelProps {
  currentMode: DeploymentMode;
  onModeChange: (mode: DeploymentMode) => void;
  onDataReload?: () => void;
}

/**
 * Es gibt nur noch den lokalen Betrieb (Schritt 5 der Vereinfachung hat den
 * Cloud-Betrieb entfernt; der eigene Server-Betrieb war bereits zuvor weg).
 * "currentMode" kann trotzdem noch einen alten Wert aus einer früheren
 * Fassung tragen — etwa "cloud", wenn jemand von dort aus aktualisiert hat.
 * Das ändert an der Funktion nichts mehr (jede Operation läuft ohnehin nur
 * noch lokal), aber die Oberfläche soll das nicht stillschweigend als
 * Normalzustand anzeigen, deshalb bleibt die Möglichkeit, explizit auf
 * "local" zurückzusetzen.
 */
export const DeploymentHubSettingsPanel: React.FC<DeploymentHubSettingsPanelProps> = ({
  currentMode,
  onModeChange,
  onDataReload
}) => {
  const isLocalActive = currentMode === 'local';

  const [localStats, setLocalStats] = useState<{
    members: number;
    transactions: number;
    accounts: number;
    inventory: number;
    sepaRuns: number;
    documents: number;
    donations: number;
    calendarEvents: number;
    auditLogs: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await StorageService.getLocalDataStats();
      setLocalStats(stats);
    } catch (e) {
      console.warn('Fehler beim Laden der lokalen Statistiken:', e);
    }
  };

  const handleActivateLocal = () => {
    StorageService.setDeploymentMode('local');
    onModeChange('local');
    onDataReload?.();
  };

  const handleDownloadBackup = async () => {
    try {
      const json = await StorageService.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `VereinsManager_Komplettsicherung_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Fehler beim Erstellen der Sicherungsdatei: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-2xl shrink-0">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Lokaler Offline-Modus
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Alle Vereinsdaten liegen ausschließlich auf diesem Gerät.
              </p>
            </div>
          </div>

          {isLocalActive ? (
            <div className="flex items-center gap-2 text-2xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aktiv auf diesem Gerät</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleActivateLocal}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-2xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Zu lokalem Offline-Modus wechseln
            </button>
          )}
        </div>

        <div className="pt-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Alle Vereinsdaten (Mitglieder, Finanzbuchungen, Bankkonten, Belege, Spendenbescheinigungen
            und Termine) werden ausschließlich lokal und sicher in der Browser-/App-Datenbank
            (IndexedDB) auf Ihrem Computer gespeichert. Es werden zu keinem Zeitpunkt Daten ins
            Internet oder an externe Server übertragen.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>100% DSGVO-autonom</span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Alle Daten bleiben isoliert und vertraulich auf Ihrer lokalen Festplatte.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Vollständig offline</span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Funktioniert jederzeit auch ohne aktive Internetverbindung.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>0,00 € Kosten</span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Dauerhaft kostenfrei und ohne laufende Gebühren oder Abonnements.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lokaler Datenbestand & Sicherheits-Backup */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-600" />
            <span>Aktueller lokaler Datenbestand auf diesem Gerät</span>
          </h4>
          <button
            type="button"
            onClick={loadStats}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Aktualisieren</span>
          </button>
        </div>

        {localStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-2xs">Mitglieder</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.members}</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-2xs">Buchungen</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.transactions}</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-2xs">Finanzkonten</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.accounts}</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-2xs">Inventar</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{localStats.inventory}</div>
            </div>
          </div>
        ) : (
          <div className="text-2xs text-slate-400">Statistiken werden geladen...</div>
        )}

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Diese Daten liegen ausschließlich auf diesem Gerät. Eine regelmäßige Sicherheitskopie ist
          die einzige Möglichkeit, sie vor einem Geräteverlust oder -defekt zu schützen.
        </p>

        <button
          type="button"
          onClick={handleDownloadBackup}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Sicherheits-Backup herunterladen (JSON)</span>
        </button>
      </div>
    </div>
  );
};
