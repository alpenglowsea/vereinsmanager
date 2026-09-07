import React, { useState, useRef } from 'react';
import { InvoiceTemplateSettings, ClubSettings } from '../types';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  FileText,
  Eye,
  Trash2,
  Download,
  Info,
  Sliders,
  Sparkles,
  QrCode
} from 'lucide-react';

interface InvoiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: InvoiceTemplateSettings;
  clubSettings: ClubSettings;
  onSaveTemplate: (updated: InvoiceTemplateSettings) => Promise<void>;
  onTestExport?: (template: InvoiceTemplateSettings) => void;
}

export const InvoiceTemplateModal: React.FC<InvoiceTemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  clubSettings,
  onSaveTemplate,
  onTestExport
}) => {
  const [formData, setFormData] = useState<InvoiceTemplateSettings>({ ...template });
  const [activeTab, setActiveTab] = useState<'upload' | 'layout' | 'texts'>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file) return;

    // We accept PNG, JPG, WEBP or PDF
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Bitte laden Sie eine Bilddatei (PNG, JPG, WEBP) oder ein PDF Ihres Briefpapiers hoch.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFormData(prev => ({
        ...prev,
        customBlankoDataUrl: dataUrl,
        customBlankoFileName: file.name,
        customBlankoUploadedAt: new Date().toISOString()
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveCustomBlanko = () => {
    setFormData(prev => ({
      ...prev,
      customBlankoDataUrl: undefined,
      customBlankoFileName: undefined,
      customBlankoUploadedAt: undefined
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveTemplate(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save template settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasCustomBlanko = Boolean(formData.customBlankoDataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Rechnungsvorlage & Blanko-Briefpapier konfigurieren
              </h3>
              <p className="text-xs text-slate-500">
                Laden Sie Ihr eigenes Vereins-Briefpapier hoch oder nutzen Sie den integrierten DIN 5008 Standard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>1. Eigene Blanko-Vorlage (Briefpapier)</span>
            {hasCustomBlanko && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'layout'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Ränder & Layout-Optionen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('texts')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'texts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Standard-Texte & Zahlungsziel</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: UPLOAD BLANKO VORLAGE */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-semibold">Wie funktioniert die eigene Blanko-Vorlage?</p>
                  <p className="text-blue-800 leading-relaxed">
                    Laden Sie Ihr offizielles Vereins-Briefpapier (z.B. als hochauflösendes PNG, JPG oder PDF) hoch.
                    Die Vereinsverwaltung hinterlegt diese Vorlage als ganzseitigen Hintergrund und druckt automatisch
                    die Empfängeranschrift, Rechnungsdaten, Positionsliste, Summen und den GiroCode passgenau darauf.
                  </p>
                </div>
              </div>

              {/* Upload Box / Dropzone */}
              {!hasCustomBlanko ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    dragOver
                      ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Blanko-Briefpapier hier ablegen oder klicken
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Unterstützte Formate: PNG, JPG, WEBP (Empfohlen: DIN A4, 210 x 297 mm, mind. 1200 x 1700 px)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs bg-white border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg shadow-2xs font-semibold hover:bg-slate-50"
                  >
                    Datei vom Computer auswählen
                  </button>
                </div>
              ) : (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-20 bg-white border border-emerald-200 rounded-lg shadow-xs overflow-hidden flex items-center justify-center relative group">
                      {formData.customBlankoDataUrl?.startsWith('data:image') ? (
                        <img
                          src={formData.customBlankoDataUrl}
                          alt="Briefpapier Vorschau"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Eigene Vorlage aktiv
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {formData.customBlankoFileName || 'Hochgeladener Vereinsbriefbogen'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Wird beim Schreiben und Exportieren von Rechnungen automatisch als Hintergrund verwendet.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
                    >
                      Vorlage austauschen
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCustomBlanko}
                      className="text-xs bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Entfernen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Standard Template Card */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Integrierte Standard-Vorlage (DIN 5008)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Wird automatisch genutzt, falls kein eigenes Briefpapier hochgeladen ist.
                      </p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    !hasCustomBlanko
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {!hasCustomBlanko ? 'Standard aktiv' : 'Als Fallback bereit'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enthält automatisch den Vereinsnamen ({clubSettings.clubName}), Falt- und Lochmarken nach DIN 5008,
                  ein Adressfenster, eine strukturierte Fußzeile mit Steuernummer, Vereinsregister und Bankverbindung
                  sowie den GiroCode (EPC-QR-Code).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: RÄNDER & LAYOUT */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Seitenränder für den Rechnungsdruck (in Millimeter)
                </h4>
                <p className="text-xs text-slate-500">
                  Passen Sie den oberen Abstand an, falls Ihr Briefpapier einen hohen Header oder ein großes Logo hat.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Oberer Rand (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={formData.marginTop}
                    onChange={(e) => setFormData(prev => ({ ...prev, marginTop: Number(e.target.value) || 45 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standard: 45 mm</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unterer Rand (mm)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="70"
                    value={formData.marginBottom}
                    onChange={(e) => setFormData(prev => ({ ...prev, marginBottom: Number(e.target.value) || 25 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standard: 25 mm</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linker Rand (mm)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="50"
                    value={formData.marginLeft}
                    onChange={(e) => setFormData(prev => ({ ...prev, marginLeft: Number(e.target.value) || 20 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standard: 20 mm</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rechter Rand (mm)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="50"
                    value={formData.marginRight}
                    onChange={(e) => setFormData(prev => ({ ...prev, marginRight: Number(e.target.value) || 20 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standard: 20 mm</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="border-t border-slate-200 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Druckelemente
                </h4>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.showGiroCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, showGiroCode: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">GiroCode (Bezahl-QR-Code) drucken</p>
                      <p className="text-[11px] text-slate-500">
                        Ermöglicht dem Empfänger das sofortige Überweisen per Fotoüberweisung in Banking-Apps.
                      </p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.showFoldingMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, showFoldingMarks: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Falt- und Lochmarken nach DIN 5008</p>
                    <p className="text-[11px] text-slate-500">
                      Diskrete Markierungen am linken Rand für einfaches Falzen in DIN-Lang-Umschläge.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: TEXTE & ZAHLUNGSZIEL */}
          {activeTab === 'texts' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard-Zahlungsziel (Tage)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={formData.defaultPaymentTermsDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultPaymentTermsDays: Number(e.target.value) || 14 }))}
                  className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard-Einleitungstext für neue Rechnungen
                </label>
                <textarea
                  rows={3}
                  value={formData.defaultIntroText}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultIntroText: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wird beim Erstellen einer neuen Rechnung automatisch vorausgefüllt und kann individuell angepasst werden.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard-Schlusstext & Zahlungsanweisung
                </label>
                <textarea
                  rows={3}
                  value={formData.defaultOutroText}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultOutroText: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            {onTestExport && (
              <button
                type="button"
                onClick={() => onTestExport(formData)}
                className="text-xs border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Test-PDF mit Vorlage erzeugen</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 px-4 py-2 font-medium transition-colors cursor-pointer"
            >
              Abbrechen
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Wird gespeichert...' : 'Einstellungen speichern'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
