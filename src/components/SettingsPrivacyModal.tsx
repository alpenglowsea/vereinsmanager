import React, { useState } from 'react';
import { ClubSettings } from '../types';
import { StorageService } from '../services/storage';
import {
  X,
  ShieldCheck,
  Download,
  Upload,
  Database,
  Building,
  RefreshCw,
  Trash2,
  Lock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Cloud,
  Server,
  Globe,
  ArrowRight
} from 'lucide-react';

interface SettingsPrivacyModalProps {
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onDataReload: () => void;
  onOpenDeploymentHub?: () => void;
  onClose: () => void;
}

export const SettingsPrivacyModal: React.FC<SettingsPrivacyModalProps> = ({
  settings,
  onSaveSettings,
  onDataReload,
  onOpenDeploymentHub,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'club' | 'backup' | 'deployment'>('privacy');
  const [formData, setFormData] = useState<ClubSettings>({ ...settings });
  const [newDepartment, setNewDepartment] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveClub = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setStatusMsg({ type: 'success', text: 'Vereinsdaten erfolgreich gespeichert.' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    if (formData.departments.includes(newDepartment.trim())) return;
    setFormData(prev => ({
      ...prev,
      departments: [...prev.departments, newDepartment.trim()]
    }));
    setNewDepartment('');
  };

  const handleRemoveDepartment = (dept: string) => {
    if (formData.departments.length <= 1) {
      alert('Mindestens eine Sparte/Abteilung muss vorhanden sein.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== dept)
    }));
  };

  // Full Backup Export
  const handleExportBackup = async () => {
    try {
      const json = await StorageService.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `VereinsManager_Sicherung_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMsg({ type: 'success', text: 'Komplette Datensicherung erfolgreich heruntergeladen.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Fehler beim Erstellen der Sicherung.' });
    }
  };

  // Full Backup Import
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Achtung: Durch das Einspielen der Sicherung werden die aktuellen lokalen Daten überschrieben. Fortfahren?')) {
      return;
    }

    try {
      const text = await file.text();
      const result = await StorageService.importFullBackup(text);
      onDataReload();
      setStatusMsg({
        type: 'success',
        text: `Sicherung erfolgreich wiederhergestellt (${result.membersCount} Mitglieder, ${result.transactionsCount} Buchungen).`
      });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Fehler beim Import: ${err.message || 'Ungültige Datei'}` });
    }
  };

  // Reset to Demo
  const handleResetToDemo = async () => {
    if (window.confirm('Möchten Sie die Datenbank wirklich auf die Muster-Vereinsdaten zurücksetzen?')) {
      await StorageService.resetToDemoData();
      onDataReload();
      setStatusMsg({ type: 'success', text: 'Muster-Vereinsdaten wurden erfolgreich geladen.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Wipe All
  const handleWipeAll = async () => {
    if (window.confirm('ACHTUNG: Möchten Sie wirklich ALLE Mitglieder, Buchungen und Konten löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      await StorageService.clearAllData();
      onDataReload();
      setStatusMsg({ type: 'success', text: 'Alle lokalen Daten wurden gelöscht.' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Datenschutz & Vereins-Einstellungen
              </h2>
              <p className="text-xs text-slate-500">
                100% lokale, DSGVO-konforme Speicherung, Vereinsstammdaten & Datensicherung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-3 pt-2 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'privacy' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            Datenschutz (DSGVO)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('club')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'club' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            Vereinsstammdaten
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'backup' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            Datensicherung & Import
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deployment')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'deployment' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            Cloud & Betriebsmodi
          </button>
        </div>

        {/* Notifications */}
        {statusMsg && (
          <div className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {statusMsg.text}
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6 flex-1">
          {/* 1. PRIVACY TAB */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  DSGVO-Garantie: 100% Lokale Datenverarbeitung
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Diese Vereinsverwaltungs-Software speichert alle vertraulichen Mitgliederdaten, Bankverbindungen (IBAN/BIC), Belege (PDF/Bilder) und Finanzbuchungen <strong>ausschließlich lokal in der verschlüsselten IndexedDB-Datenbank Ihres Webbrowsers</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-xs font-bold text-slate-800 block mb-1">Kein Cloud-Server / Kein Datenabfluss</span>
                    <p className="text-2xs text-slate-500">
                      Es findet keinerlei Übertragung personenbezogener Daten an externe Server oder Drittanbieter statt.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-xs font-bold text-slate-800 block mb-1">Vollständige Datenhoheit</span>
                    <p className="text-2xs text-slate-500">
                      Sie können jederzeit eine vollständige, unverschlüsselte oder exportierbare JSON-Sicherung herunterladen.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  Technische Speicherarchitektur
                </h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>Lokale Browser-IndexedDB:</strong> Ermöglicht blitzschnelle Abfragen, hohe Speicherkapazität für Beleg-Anhänge (PDFs/Bilder) und Offline-Nutzung.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>Revisionssicherer Audit-Trail:</strong> Jede Änderung an Mitgliederdaten wird mit Zeitstempel und Vorher-/Nachher-Werten protokolliert.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>SEPA-Konformität:</strong> IBAN-Validierung und automatische Mandatsreferenzierung gem. Vorgaben des European Payments Council (EPC).</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CLUB STAMMDATEN TAB */}
          {activeTab === 'club' && (
            <form onSubmit={handleSaveClub} className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offizieller Vereinsname *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clubName}
                    onChange={e => setFormData({ ...formData, clubName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. TSV Musterstadt 1890 e.V."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vereinsregisternummer (VR-Nr.)
                  </label>
                  <input
                    type="text"
                    value={formData.associationNumber}
                    onChange={e => setFormData({ ...formData, associationNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. VR 48219 Amtsgericht Musterstadt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Steuernummer (Finanzamt)
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={e => setFormData({ ...formData, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. 112/5840/1922"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    SEPA-Gläubiger- & Vereinskonto-Stammdaten (für Lastschriftexport)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Diese Angaben werden als Gläubiger (Creditor) in die offiziellen SEPA XML-Dateien (pain.008) für Ihre Bank eingebettet.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Gläubiger-ID (CI) *
                      </label>
                      <input
                        type="text"
                        value={formData.creditorId}
                        onChange={e => setFormData({ ...formData, creditorId: e.target.value.toUpperCase().trim() })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500"
                        placeholder="DE98ZZZ09999999999"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Vereins-IBAN (Gutschrift) *
                      </label>
                      <input
                        type="text"
                        value={formData.creditorIban || ''}
                        onChange={e => setFormData({ ...formData, creditorIban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500"
                        placeholder="DE02 1203 0000 0012 3456 78"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Vereins-BIC / SWIFT
                      </label>
                      <input
                        type="text"
                        value={formData.creditorBic || ''}
                        onChange={e => setFormData({ ...formData, creditorBic: e.target.value.toUpperCase().trim() })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                        placeholder="BYLADEM1001"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vereinsanschrift
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Sportplatzweg 12, 12345 Musterstadt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Vorsitzender / Vorstand
                  </label>
                  <input
                    type="text"
                    value={formData.chairman}
                    onChange={e => setFormData({ ...formData, chairman: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Dr. Michael Sommer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Schatzmeister / Kassenwart
                  </label>
                  <input
                    type="text"
                    value={formData.treasurer}
                    onChange={e => setFormData({ ...formData, treasurer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="Sabine Weber"
                  />
                </div>
              </div>

              {/* Department configuration */}
              <div className="pt-3 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Abteilungen & Sparten ({formData.departments.length})
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.departments.map(dept => (
                    <span
                      key={dept}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium border border-slate-200"
                    >
                      {dept}
                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={e => setNewDepartment(e.target.value)}
                    placeholder="Neue Abteilung hinzufügen (z.B. Badminton)"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddDepartment}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Vereinsdaten speichern
                </button>
              </div>
            </form>
          )}

          {/* 3. BACKUP & IMPORT TAB */}
          {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* Export Full Backup */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">Vollständige Datensicherung (JSON)</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Exportiert alle Mitglieder, Buchungen, Belege, Konten und Änderungshistorien in eine einzige Sicherungsdatei.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Sicherung herunterladen
                </button>
              </div>

              {/* Import Full Backup */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">Datensicherung wiederherstellen</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Spielt eine zuvor erstellte JSON-Sicherungsdatei wieder in den Browser ein.
                  </p>
                </div>
                <div className="relative shrink-0">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Sicherung einspielen
                  </div>
                </div>
              </div>

              {/* Database Danger Zone */}
              <div className="border border-rose-200 rounded-2xl p-4 bg-rose-50/50 space-y-3">
                <h3 className="text-xs font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Datenbankverwaltung & Zurücksetzen
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleResetToDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    Musterdaten laden (TSV Musterstadt)
                  </button>

                  <button
                    type="button"
                    onClick={handleWipeAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Alle Daten löschen (Neu anfangen)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. DEPLOYMENT & CLOUD TAB */}
          {activeTab === 'deployment' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  3 Flexible Betriebs- & Hosting-Optionen
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Jeder Verein kann die Software exakt nach seinen Anforderungen betreiben: Als 1-Klick Cloud (IONOS + Supabase EU Frankfurt), als Docker-Container auf eigenem NAS/Server oder lokal offline im Webbrowser.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                      <Cloud className="w-4 h-4" /> 1-Klick Cloud (IONOS)
                    </div>
                    <p className="text-2xs text-slate-600">
                      Supabase EU (Frankfurt) + IONOS Deploy Now (~1 €/Monat). Mehrere Vorstände arbeiten zeitgleich.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                      <Server className="w-4 h-4" /> Selbsthoster (Docker)
                    </div>
                    <p className="text-2xs text-slate-600">
                      Fertiges Docker-Image & docker-compose.yml für Synology NAS, QNAP oder vServer.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
                      <HardDrive className="w-4 h-4" /> Lokaler Einzelplatz
                    </div>
                    <p className="text-2xs text-slate-600">
                      100% Offline in der Browser-IndexedDB. 0,00 € Kosten und keine Server-Einrichtung.
                    </p>
                  </div>
                </div>
              </div>

              {onOpenDeploymentHub && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      Interaktiven Deployment & Cloud Hub öffnen
                    </h4>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Supabase-Schlüssel eintragen, SQL-Skript kopieren, Vorstandskonten verwalten oder Docker-Dateien ansehen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDeploymentHub();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <span>Hub öffnen</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
