import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Settings,
  Mail,
  Building2,
  FileUp,
  Sparkles,
  Info
} from 'lucide-react';
import { ApplicationTemplateSettings, ClubSettings } from '../types';

interface ApplicationTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ClubSettings;
  templateSettings: ApplicationTemplateSettings;
  onSaveTemplateSettings: (updated: ApplicationTemplateSettings) => Promise<void>;
}

export const ApplicationTemplateModal: React.FC<ApplicationTemplateModalProps> = ({
  isOpen,
  onClose,
  settings,
  templateSettings,
  onSaveTemplateSettings
}) => {
  if (!isOpen) return null;

  const [notificationEmail, setNotificationEmail] = useState(
    templateSettings.notificationEmail || settings.email || 'vorstand@musterverein.de'
  );
  const [headerText, setHeaderText] = useState(
    templateSettings.headerText || 'Herzlich willkommen im Verein! Bitte füllen Sie das Beitrittsformular sorgfältig aus.'
  );
  const [fullFee, setFullFee] = useState<number>(templateSettings.defaultFeeRules?.full ?? 18.0);
  const [reducedFee, setReducedFee] = useState<number>(templateSettings.defaultFeeRules?.reduced ?? 12.0);
  const [youthFee, setYouthFee] = useState<number>(templateSettings.defaultFeeRules?.youth ?? 10.0);
  const [familyFee, setFamilyFee] = useState<number>(templateSettings.defaultFeeRules?.family ?? 30.0);
  const [supportingFee, setSupportingFee] = useState<number>(templateSettings.defaultFeeRules?.supporting ?? 25.0);

  const [customPdfDataUrl, setCustomPdfDataUrl] = useState<string | undefined>(
    templateSettings.customPdfTemplateDataUrl
  );
  const [customPdfFileName, setCustomPdfFileName] = useState<string | undefined>(
    templateSettings.customPdfTemplateFileName
  );
  const [customPdfUploadedAt, setCustomPdfUploadedAt] = useState<string | undefined>(
    templateSettings.customPdfTemplateUploadedAt
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // File upload handler
  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Bitte laden Sie ausschließlich eine PDF-Datei (.pdf) hoch.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setCustomPdfDataUrl(result);
      setCustomPdfFileName(file.name);
      setCustomPdfUploadedAt(new Date().toISOString());
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: ApplicationTemplateSettings = {
        ...templateSettings,
        notificationEmail,
        headerText,
        customPdfTemplateDataUrl: customPdfDataUrl,
        customPdfTemplateFileName: customPdfFileName,
        customPdfTemplateUploadedAt: customPdfUploadedAt,
        defaultFeeRules: {
          full: fullFee,
          reduced: reducedFee,
          youth: youthFee,
          family: familyFee,
          supporting: supportingFee
        }
      };
      await onSaveTemplateSettings(updated);
      setSuccessMsg('Einstellungen und PDF-Vorlage erfolgreich gespeichert!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Fehler beim Speichern der Vorlage:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = () => {
    setCustomPdfDataUrl(undefined);
    setCustomPdfFileName(undefined);
    setCustomPdfUploadedAt(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Einstellungen & PDF-Vorlage Aufnahmeantrag
              </h3>
              <p className="text-xs text-slate-400">
                Laden Sie Ihre eigene Vereins-PDF-Vorlage hoch und konfigurieren Sie Standardbeiträge
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* 1. PDF-Vorlage Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileUp className="w-4 h-4 text-blue-600" />
                <span>Eigene PDF-Formularvorlage des Vereins</span>
              </h4>
              {customPdfFileName && (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Aktiv hinterlegt
                </span>
              )}
            </div>

            <p className="text-2xs text-slate-500">
              Sie können das aktuell im Verein gültige Aufnahmeantrags-PDF hochladen. Das System befüllt dieses automatisch mit den Antragsdaten und archiviert das unterschriebene Dokument bei Mitgliedsaufnahme im Dokumentenarchiv.
            </p>

            {customPdfFileName ? (
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-slate-900 font-bold">{customPdfFileName}</strong>
                    <span className="text-2xs text-slate-500">
                      Hochgeladen am:{' '}
                      {customPdfUploadedAt
                        ? new Date(customPdfUploadedAt).toLocaleDateString('de-DE')
                        : '–'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={customPdfDataUrl}
                    download={customPdfFileName}
                    className="p-2 text-slate-600 hover:text-blue-600 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                    title="Herunterladen"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    className="p-2 text-slate-600 hover:text-rose-600 bg-white rounded-lg border border-slate-200 hover:border-rose-300 transition-colors"
                    title="Vorlage entfernen (nutzt Standard-Generator)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
                }`}
                onClick={() => {
                  const input = document.getElementById('pdf-template-upload') as HTMLInputElement;
                  input?.click();
                }}
              >
                <input
                  id="pdf-template-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <strong className="block text-xs text-slate-800 font-bold">
                  PDF-Vorlage hier hineinziehen oder klicken zum Auswählen
                </strong>
                <span className="text-2xs text-slate-500 mt-1 block">
                  Unterstützt: Offizielle Aufnahmeantrag-PDFs Ihres Sportvereins
                </span>
              </div>
            )}
          </div>

          {/* 2. Standard-Beitragssätze */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Standard-Beitragssätze (€ / Monat)</span>
            </h4>
            <p className="text-2xs text-slate-500">
              Diese Beträge werden im Online-Formular vorausgefüllt und können vor Aufnahme angepasst werden.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Vollmitglied (Erwachsener)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    value={fullFee}
                    onChange={e => setFullFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-400 font-bold text-2xs">€</span>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Ermäßigt (Schüler/Student)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    value={reducedFee}
                    onChange={e => setReducedFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-400 font-bold text-2xs">€</span>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Kinder & Jugend (U18)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    value={youthFee}
                    onChange={e => setYouthFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-400 font-bold text-2xs">€</span>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Familienbeitrag
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    value={familyFee}
                    onChange={e => setFamilyFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-400 font-bold text-2xs">€</span>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Fördermitglied (Passiv)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    value={supportingFee}
                    onChange={e => setSupportingFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-400 font-bold text-2xs">€</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Benachrichtigungs-E-Mail */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>E-Mail-Benachrichtigung bei neuen Anträgen</span>
            </h4>

            <div>
              <label className="block text-2xs font-bold text-slate-700 mb-1">
                E-Mail-Adresse d. Vereinsverantwortlichen
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={e => setNotificationEmail(e.target.value)}
                placeholder="mitglied@tsv-musterstadt.de"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <span className="text-2xs text-slate-400 mt-1 block">
                An diese Adresse werden Benachrichtigungen über neu eingegangene Anträge versendet.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Wird gespeichert...' : 'Einstellungen speichern'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
