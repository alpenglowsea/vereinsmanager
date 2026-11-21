import React, { useState } from 'react';
import { InvoiceTemplateSettings, ClubSettings } from '../types';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  FileText,
  Eye,
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

  if (!isOpen) return null;

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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/40 dark:text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Rechnungsvorlage & Blanko-Briefpapier konfigurieren
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Laden Sie Ihr eigenes Vereins-Briefpapier hoch oder nutzen Sie den integrierten DIN 5008 Standard.
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
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
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
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
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
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Standard-Texte & Zahlungsziel</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BRIEFPAPIER – nur Anzeige; Upload und oberer Rand liegen in den Einstellungen */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 dark:bg-blue-950/70 dark:border-blue-800/60">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 dark:text-blue-400" />
                <div className="text-xs text-blue-900 space-y-1 dark:text-blue-100">
                  <p className="font-semibold">Das Briefpapier ist umgezogen</p>
                  <p className="text-blue-800 leading-relaxed dark:text-blue-200">
                    Hochladen, Austauschen und den oberen Rand stellen Sie jetzt unter <strong>Einstellungen → Vereinsstammdaten → Briefpapier</strong> ein.
                    Es gilt dort für alle Dokumente: Rechnungen, Sitzungsunterlagen und den Aufnahmeantrag.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-white flex items-center gap-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="w-16 h-20 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center shrink-0 dark:bg-slate-800 dark:border-slate-700">
                  {formData.customBlankoDataUrl?.startsWith('data:image') ? (
                    <img src={formData.customBlankoDataUrl} alt="Briefpapier Vorschau" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      hasCustomBlanko
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                    }`}
                  >
                    {hasCustomBlanko && <Check className="w-3 h-3" />}
                    {hasCustomBlanko ? 'Eigenes Briefpapier aktiv' : 'Standardvorlage (DIN 5008) aktiv'}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1 truncate dark:text-white">
                    {hasCustomBlanko ? formData.customBlankoFileName || 'Hochgeladener Vereinsbriefbogen' : `Briefkopf mit ${clubSettings.clubName}`}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                    {hasCustomBlanko
                      ? `Oberer Rand: ${formData.marginTop} mm.`
                      : 'Mit Falt- und Lochmarken, Adressfenster, Fußzeile mit Bankverbindung und GiroCode.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RÄNDER & LAYOUT */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Den oberen Rand passend zum Briefpapier stellen Sie unter Einstellungen → Vereinsstammdaten → Briefpapier ein.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Akzentfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(formData.accentColor || '') ? formData.accentColor : '#1e40af'}
                      onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="h-9 w-14 rounded border border-slate-200 dark:border-slate-800"
                    />
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{formData.accentColor || '#1e40af'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Vereinsname, Linien und Gesamtbetrag im PDF.</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="border-t border-slate-200 pt-5 space-y-3 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 dark:text-slate-100">
                  Druckelemente
                </h4>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:border-slate-800 dark:hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.showGiroCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, showGiroCode: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                  />
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">GiroCode (Bezahl-QR-Code) drucken</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ermöglicht dem Empfänger das sofortige Überweisen per Fotoüberweisung in Banking-Apps.
                      </p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:border-slate-800 dark:hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.showFoldingMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, showFoldingMarks: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Falt- und Lochmarken nach DIN 5008</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Standard-Zahlungsziel (Tage)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={formData.defaultPaymentTermsDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultPaymentTermsDays: Number(e.target.value) || 14 }))}
                  className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Standard-Einleitungstext für neue Rechnungen
                </label>
                <textarea
                  rows={3}
                  value={formData.defaultIntroText}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultIntroText: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wird beim Erstellen einer neuen Rechnung automatisch vorausgefüllt und kann individuell angepasst werden.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Standard-Schlusstext & Zahlungsanweisung
                </label>
                <textarea
                  rows={3}
                  value={formData.defaultOutroText}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultOutroText: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Hinweis für Kleinunternehmer (§ 19 UStG)
                </label>
                <textarea
                  rows={2}
                  value={formData.smallBusinessNotice ?? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}
                  onChange={(e) => setFormData(prev => ({ ...prev, smallBusinessNotice: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Steht unter den Summen jeder Rechnung, bei der „Kleinunternehmer“ angehakt ist. Gleiches Feld wie in der Handy-App.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            {onTestExport && (
              <button
                type="button"
                onClick={() => onTestExport(formData)}
                className="text-xs border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-700 dark:text-slate-200"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Test-PDF mit Vorlage erzeugen</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 px-4 py-2 font-medium transition-colors cursor-pointer dark:text-slate-300 dark:hover:text-white"
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
