import React, { useRef, useState } from 'react';
import {
  Building2,
  User,
  Mail,
  Upload,
  Database,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { BereichsVergleich, ImportArt, SicherungsKopf } from '../services/backupContents';
import { BackupImportDialog } from './BackupImportDialog';
import { BackupPasswordDialog } from './BackupPasswordDialog';
import { istVerschluesselt, entschluessleSicherung } from '../services/backupCrypto';

/**
 * Erscheint nach erfolgreicher Anmeldung/Registrierung, wenn auf diesem Gerät
 * noch kein Verein eingerichtet ist (siehe StorageService.brauchtEinrichtung).
 *
 * Bewusst NACH der Anmeldung statt davor: Das Gerätepasswort steht damit in
 * jedem Fall schon fest, bevor hier irgendetwas mit Vereinsdaten passiert —
 * unabhängig davon, ob jemand gerade ein neues Konto angelegt oder sich mit
 * einem vorhandenen angemeldet hat (z. B. nach "Alle lokalen Daten löschen").
 */

interface EinrichtungsModalProps {
  onFertig: () => void;
}

type Ansicht = 'wahl' | 'neuerVerein' | 'import';

export const EinrichtungsModal: React.FC<EinrichtungsModalProps> = ({ onFertig }) => {
  const [ansicht, setAnsicht] = useState<Ansicht>('wahl');

  // --- Neuen Verein anlegen ---
  const [clubName, setClubName] = useState('');
  const [chairmanName, setChairmanName] = useState('');
  const [email, setEmail] = useState('');
  const [anlegenLaeuft, setAnlegenLaeuft] = useState(false);
  const [anlegenFehler, setAnlegenFehler] = useState<string | null>(null);

  const handleNeuerVerein = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnlegenFehler(null);

    if (!clubName.trim()) {
      setAnlegenFehler('Bitte geben Sie den Namen Ihres Vereins ein.');
      return;
    }
    if (!chairmanName.trim()) {
      setAnlegenFehler('Bitte Ihren Namen (Vorstand/Ansprechpartner) eingeben.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setAnlegenFehler('Bitte eine gültige E-Mail-Adresse angeben.');
      return;
    }

    setAnlegenLaeuft(true);
    try {
      await StorageService.initLiveClub(clubName, chairmanName, email);
      onFertig();
    } catch (err: any) {
      setAnlegenFehler(err?.message || 'Der Verein konnte nicht angelegt werden.');
    } finally {
      setAnlegenLaeuft(false);
    }
  };

  // --- Daten importieren ---
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFehler, setImportFehler] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importVorschau, setImportVorschau] = useState<{
    dateiName: string;
    text: string;
    kopf: SicherungsKopf;
    vergleich: BereichsVergleich[];
  } | null>(null);

  // Verschlüsselte Sicherung: wartet auf das Passwort
  const [passwortAbfrage, setPasswortAbfrage] = useState<{ dateiName: string; text: string } | null>(null);

  const processBackupFile = async (file: File) => {
    setImportFehler(null);

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setImportFehler('Bitte wählen Sie eine gültige .json-Sicherungsdatei aus.');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      if (istVerschluesselt(text)) {
        setPasswortAbfrage({ dateiName: file.name, text });
        return;
      }
      const { kopf, vergleich } = await StorageService.analysiereSicherung(text);
      setImportVorschau({ dateiName: file.name, text, kopf, vergleich });
    } catch (err: any) {
      console.error('Import-Vorschau fehlgeschlagen:', err);
      setImportFehler(err?.message || 'Die Datei konnte nicht gelesen werden.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Gibt null bei Erfolg zurück, sonst die Fehlermeldung für den Dialog. */
  const entschluesseleSicherung = async (passwort: string): Promise<string | null> => {
    if (!passwortAbfrage) return 'Keine Datei ausgewählt.';
    try {
      const klartext = await entschluessleSicherung(passwortAbfrage.text, passwort);
      const { kopf, vergleich } = await StorageService.analysiereSicherung(klartext);
      setImportVorschau({ dateiName: passwortAbfrage.dateiName, text: klartext, kopf, vergleich });
      setPasswortAbfrage(null);
      return null;
    } catch (err: any) {
      return err?.message || 'Die Sicherung konnte nicht entschlüsselt werden.';
    }
  };

  const fuehreImportAus = async (art: ImportArt) => {
    if (!importVorschau) return;
    setImportFehler(null);
    setImporting(true);
    try {
      await StorageService.importFullBackup(importVorschau.text, 'live', art);
      setImportVorschau(null);
      onFertig();
    } catch (err: any) {
      console.error('Import error on Einrichtungs-Modal:', err);
      setImportFehler(`Fehler beim Einspielen der Datensicherung: ${err?.message || 'Ungültige Datei'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processBackupFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processBackupFile(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 antialiased">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              {ansicht === 'wahl' && 'Noch kein Verein auf diesem Gerät'}
              {ansicht === 'neuerVerein' && 'Neuen Verein anlegen'}
              {ansicht === 'import' && 'Datensicherung importieren'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {ansicht === 'wahl' && 'Wie möchten Sie starten?'}
              {ansicht === 'neuerVerein' && 'Angaben zu Ihrem Verein'}
              {ansicht === 'import' && 'JSON-Sicherung von einem anderen Gerät laden'}
            </p>
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            {ansicht === 'wahl' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setAnsicht('neuerVerein')}
                  className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Neuen Verein anlegen</div>
                    <div className="text-xs text-slate-500">Mit leerem Datenbestand starten</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAnsicht('import')}
                  className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Vorhandene Daten importieren</div>
                    <div className="text-xs text-slate-500">Datensicherung (.json) von einem anderen Gerät</div>
                  </div>
                </button>
              </div>
            )}

            {ansicht === 'neuerVerein' && (
              <form onSubmit={handleNeuerVerein} className="space-y-3.5">
                {anlegenFehler && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed font-medium">{anlegenFehler}</div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Vereinsname *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      placeholder="z. B. SV Eintracht 1924 e.V."
                      required
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Vor- & Nachname (Vorstand / Ansprechpartner) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={chairmanName}
                      onChange={(e) => setChairmanName(e.target.value)}
                      placeholder="z. B. Klaus Weber"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">E-Mail-Adresse *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vorstand@mein-verein.de"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={anlegenLaeuft}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {anlegenLaeuft ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Verein anlegen & starten</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setAnsicht('wahl'); setAnlegenFehler(null); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold pt-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Zurück</span>
                </button>
              </form>
            )}

            {ansicht === 'import' && (
              <div className="space-y-4">
                {importFehler && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed font-medium">{importFehler}</div>
                  </div>
                )}

                <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Nahtloser Umzug auf dieses Gerät</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-normal">
                    Laden Sie hier die auf einem anderen Gerät exportierte{' '}
                    <span className="font-semibold text-slate-800">.json-Datensicherung</span> hoch. Ihr
                    Gerätepasswort bleibt dabei unverändert — nur die Vereinsdaten werden übernommen.
                  </p>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !importing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50/70 scale-[1.01]'
                      : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {importing ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <div className="text-xs font-bold text-slate-800">Datensicherung wird importiert...</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="mt-1">
                        <span className="text-xs font-bold text-blue-600 hover:underline">
                          JSON-Sicherung auswählen
                        </span>
                        <span className="text-xs text-slate-500"> oder Datei hierher ziehen</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setAnsicht('wahl'); setImportFehler(null); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold pt-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Zurück</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BackupImportDialog
        isOpen={Boolean(importVorschau)}
        dateiName={importVorschau?.dateiName || ''}
        kopf={importVorschau?.kopf || {}}
        vergleich={importVorschau?.vergleich || []}
        laeuft={importing}
        onAbbrechen={() => setImportVorschau(null)}
        onBestaetigen={fuehreImportAus}
      />

      {passwortAbfrage && (
        <BackupPasswordDialog
          isOpen
          dateiName={passwortAbfrage.dateiName}
          onEntschluesseln={entschluesseleSicherung}
          onAbbrechen={() => setPasswortAbfrage(null)}
        />
      )}
    </div>
  );
};
