import React, { useState } from 'react';
import {
  X,
  Upload,
  Trash2,
  Check,
  FileText,
  Sliders,
  Info,
  ScrollText,
  Building
} from 'lucide-react';
import { MeetingTemplateSettings, ClubSettings } from '../types';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';

import VeraenderbaresFenster from './VeraenderbaresFenster';
interface MeetingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateSettings: MeetingTemplateSettings;
  clubSettings: ClubSettings;
  onSaveTemplate: (settings: MeetingTemplateSettings) => Promise<void>;
  /** Liegt in der Rechnungsvorlage ein Briefpapier? Dann gilt es auch hier (D-123). */
  rechnungsBriefpapier?: boolean;
  onOpenBriefpapier?: () => void;
}

export const MeetingTemplateModal: React.FC<MeetingTemplateModalProps> = ({
  isOpen,
  onClose,
  templateSettings,
  clubSettings,
  onSaveTemplate,
  rechnungsBriefpapier,
  onOpenBriefpapier
}) => {
  const [formData, setFormData] = useState<MeetingTemplateSettings>(templateSettings || DEFAULT_MEETING_TEMPLATE);
  const [activeTab, setActiveTab] = useState<'upload' | 'layout'>('upload');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

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

  const hasCustomBlanko = Boolean(formData.customBlankoDataUrl) || Boolean(rechnungsBriefpapier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <VeraenderbaresFenster kennung="sitzungsvorlage" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl dark:bg-rose-900/40 dark:text-rose-300">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Protokoll-Vorlage & Vereins-Briefpapier konfigurieren
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hinterlegen Sie Ihr offizielles Vereins-Briefpapier für rechtssichere Protokolle oder nutzen Sie den BGB-Standard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer dark:hover:text-slate-300 dark:hover:bg-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>1. Briefpapier</span>
            {hasCustomBlanko && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'layout'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
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
              {/* Ein gemeinsames Briefpapier für alle Dokumente, gepflegt in der
                  Einstellungen (D-123, wie Android). Das Hochladen hier entfällt. */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex items-start gap-3 dark:bg-rose-950/70 dark:border-rose-800/60">
                <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
                <div className="text-xs text-rose-900 space-y-2 dark:text-rose-100">
                  <p className="font-semibold">Ein Briefpapier für alle Dokumente</p>
                  <p className="text-rose-800 leading-relaxed dark:text-rose-200">
                    Das Briefpapier wird unter Einstellungen → Vereinsstammdaten → Briefpapier hinterlegt und gilt für Rechnungen, Einladungen, Protokolle, Registerauszüge und den Aufnahmeantrag.
                    {rechnungsBriefpapier ? ' Dort ist zurzeit eines hinterlegt.' : ' Dort ist zurzeit keines hinterlegt.'}
                  </p>
                  {onOpenBriefpapier && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBriefpapier();
                      }}
                      className="text-xs px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-semibold text-rose-700 hover:bg-rose-50 dark:bg-slate-900 dark:border-rose-800/60 dark:text-rose-300"
                    >
                      Zu den Einstellungen
                    </button>
                  )}
                </div>
              </div>

              {formData.customBlankoDataUrl && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 dark:border-amber-800/60 dark:bg-amber-950/40">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-20 bg-white border border-amber-200 rounded-lg shadow-xs overflow-hidden flex items-center justify-center dark:bg-slate-900 dark:border-amber-800/60">
                      {formData.customBlankoDataUrl.startsWith('data:image') ? (
                        <img src={formData.customBlankoDataUrl} alt="Älteres Briefpapier" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Älteres Briefpapier nur für Sitzungen: {formData.customBlankoFileName || 'Briefpapier'}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-300">
                        {rechnungsBriefpapier
                          ? 'Wird nicht mehr verwendet, weil in den Einstellungen ein Briefpapier liegt. Kann entfernt werden.'
                          : 'Wird weiter verwendet, bis in den Einstellungen ein Briefpapier hinterlegt ist.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveBlanko}
                    className="text-xs px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg font-semibold text-rose-700 hover:bg-rose-100 flex items-center gap-1 cursor-pointer dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 dark:hover:bg-rose-900/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Entfernen
                  </button>
                </div>
              )}

              {/* Standard Briefkopf Vorschau falls kein eigenes */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Standard-Briefkopf des Vereins (Fallback)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hasCustomBlanko ? 'Wird durch Briefpapier ersetzt' : 'Aktiv, da kein Briefpapier hinterlegt'}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1 dark:bg-slate-900 dark:border-slate-800">
                  <div className="font-bold text-slate-800 dark:text-slate-100">{clubSettings.clubName}</div>
                  <div className="text-slate-500 text-[11px] dark:text-slate-400">
                    {[clubSettings.associationNumber, clubSettings.taxOffice, clubSettings.taxNumber ? `St.-Nr.: ${clubSettings.taxNumber}` : '']
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT & RÄNDER */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 dark:bg-slate-800 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 dark:text-slate-100">
                  Druckränder & Abstände (in mm)
                </h4>
                <p className="text-xs text-slate-500 mb-4 dark:text-slate-400">
                  Passen Sie den oberen Abstand an, falls Ihr Vereins-Briefpapier bereits ein großes Logo oder einen Briefkopf enthält, damit der Protokolltext nicht darübergedruckt wird.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Rand Oben (Header)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={formData.marginTop}
                        onChange={(e) => setFormData({ ...formData, marginTop: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 font-mono dark:text-slate-400">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Rand Unten (Footer)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={80}
                        value={formData.marginBottom}
                        onChange={(e) => setFormData({ ...formData, marginBottom: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 font-mono dark:text-slate-400">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Rand Links
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={formData.marginLeft}
                        onChange={(e) => setFormData({ ...formData, marginLeft: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 font-mono dark:text-slate-400">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Rand Rechts
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={formData.marginRight}
                        onChange={(e) => setFormData({ ...formData, marginRight: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 font-mono dark:text-slate-400">mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rechtliche Optionen */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 dark:bg-slate-800 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 dark:text-slate-100">
                  Rechtliche Bestandteile & Ausgabeeinstellungen
                </h4>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showSignaturesBlock}
                    onChange={(e) => setFormData({ ...formData, showSignaturesBlock: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:text-rose-400 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Offizielle Unterschriftenzeilen am Protokollende drucken
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Erzeugt zwei Unterzeichnerzeilen (Versammlungsleiter & Schriftführer) gem. § 58 BGB und Satzungsvorgaben.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showRegisterExtractNotice}
                    onChange={(e) => setFormData({ ...formData, showRegisterExtractNotice: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:text-rose-400 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Beglaubigungs- und Registervermerk bei Auszügen aktivieren
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Wichtig für Notariate und das Amtsgericht (Vereinsregister) bei Vorstandswahlen und Satzungsänderungen.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showClubHeader}
                    onChange={(e) => setFormData({ ...formData, showClubHeader: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:text-rose-400 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Standard-Vereinskopfzeile drucken (falls kein Briefpapier hinterlegt)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Druckt Vereinsname, Vereinsregisternummer und Steuernummer oben ab.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFormData(DEFAULT_MEETING_TEMPLATE)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors dark:text-slate-400 dark:hover:text-slate-100"
            >
              Auf Standardwerte zurücksetzen
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700"
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
      </VeraenderbaresFenster>
    </div>
  );
};
