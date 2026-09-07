import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Trash2,
  Check,
  FileText,
  Sliders,
  Sparkles,
  Info,
  ScrollText,
  Building
} from 'lucide-react';
import { MeetingTemplateSettings, ClubSettings } from '../types';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';

interface MeetingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateSettings: MeetingTemplateSettings;
  clubSettings: ClubSettings;
  onSaveTemplate: (settings: MeetingTemplateSettings) => Promise<void>;
}

export const MeetingTemplateModal: React.FC<MeetingTemplateModalProps> = ({
  isOpen,
  onClose,
  templateSettings,
  clubSettings,
  onSaveTemplate
}) => {
  const [formData, setFormData] = useState<MeetingTemplateSettings>(templateSettings || DEFAULT_MEETING_TEMPLATE);
  const [activeTab, setActiveTab] = useState<'upload' | 'layout'>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Bitte laden Sie eine Bilddatei (PNG, JPG, WEBP) oder ein PDF Ihres Briefpapiers hoch.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFormData((prev) => ({
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveBlanko = () => {
    setFormData((prev) => ({
      ...prev,
      customBlankoDataUrl: '',
      customBlankoFileName: '',
      customBlankoUploadedAt: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveTemplate(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save meeting template settings:', err);
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
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Protokoll-Vorlage & Vereins-Briefpapier konfigurieren
              </h3>
              <p className="text-xs text-slate-500">
                Hinterlegen Sie Ihr offizielles Vereins-Briefpapier für rechtssichere Protokolle oder nutzen Sie den BGB-Standard.
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
                ? 'border-rose-600 text-rose-600'
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
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Ränder, Abstände & Pflichtfelder</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: UPLOAD BLANKO VORLAGE */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 space-y-1">
                  <p className="font-semibold">Wie funktioniert die eigene Blanko-Vorlage für Protokolle?</p>
                  <p className="text-rose-800 leading-relaxed">
                    Laden Sie Ihr offizielles Vereins-Briefpapier (als PNG, JPG oder PDF) hoch.
                    Die Vereinsverwaltung hinterlegt diese Vorlage als ganzseitigen Hintergrund für alle
                    Vorstands- und Mitgliederversammlungsprotokolle und druckt Tagesordnung, Beschlüsse,
                    Abstimmungsergebnisse und Unterschriftszeilen passgenau in den Inhaltsbereich.
                  </p>
                </div>
              </div>

              {/* Upload Dropzone */}
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
                      ? 'border-rose-500 bg-rose-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-rose-400 hover:bg-slate-50/50'
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
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Vereins-Briefpapier hier ablegen oder klicken
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
                          <Check className="w-3 h-3" /> Eigene Briefpapier-Vorlage aktiv
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {formData.customBlankoFileName || 'Hochgeladenes Vereins-Briefpapier'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Wird beim Erstellen und Exportieren aller Sitzungsprotokolle automatisch als Hintergrund verwendet.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Ersetzen
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveBlanko}
                      className="text-xs px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg font-semibold text-rose-700 hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Entfernen
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
                  </div>
                </div>
              )}

              {/* Standard Briefkopf Vorschau falls kein eigenes */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Standard-Briefkopf des Vereins (Fallback)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {hasCustomBlanko ? 'Wird durch Briefpapier ersetzt' : 'Aktiv, da kein Briefpapier hinterlegt'}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-slate-800">{clubSettings.clubName}</div>
                  <div className="text-slate-500 text-[11px]">
                    {clubSettings.associationNumber} • {clubSettings.taxOffice} • St.-Nr.: {clubSettings.taxNumber}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT & RÄNDER */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Druckränder & Abstände (in mm)
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Passen Sie den oberen Abstand an, falls Ihr Vereins-Briefpapier bereits ein großes Logo oder einen Briefkopf enthält, damit der Protokolltext nicht darübergedruckt wird.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rand Oben (Header)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={formData.marginTop}
                        onChange={(e) => setFormData({ ...formData, marginTop: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-500 font-mono">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rand Unten (Footer)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={80}
                        value={formData.marginBottom}
                        onChange={(e) => setFormData({ ...formData, marginBottom: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-500 font-mono">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rand Links
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={formData.marginLeft}
                        onChange={(e) => setFormData({ ...formData, marginLeft: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-500 font-mono">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rand Rechts
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={formData.marginRight}
                        onChange={(e) => setFormData({ ...formData, marginRight: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="text-xs text-slate-500 font-mono">mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rechtliche Optionen */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Rechtliche Bestandteile & Ausgabeeinstellungen
                </h4>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showSignaturesBlock}
                    onChange={(e) => setFormData({ ...formData, showSignaturesBlock: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Offizielle Unterschriftenzeilen am Protokollende drucken
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Erzeugt zwei Unterzeichnerzeilen (Versammlungsleiter & Schriftführer) gem. § 58 BGB und Satzungsvorgaben.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showRegisterExtractNotice}
                    onChange={(e) => setFormData({ ...formData, showRegisterExtractNotice: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Beglaubigungs- und Registervermerk bei Auszügen aktivieren
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Wichtig für Notariate und das Amtsgericht (Vereinsregister) bei Vorstandswahlen und Satzungsänderungen.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showClubHeader}
                    onChange={(e) => setFormData({ ...formData, showClubHeader: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Standard-Vereinskopfzeile drucken (falls kein Briefpapier hinterlegt)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Druckt Vereinsname, Vereinsregisternummer und Steuernummer oben ab.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFormData(DEFAULT_MEETING_TEMPLATE)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Auf Standardwerte zurücksetzen
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Vorlage speichern'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
