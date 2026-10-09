import React from 'react';
import { X, Upload, Camera, FileText, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface NewDocumentChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUpload: () => void;
  onSelectScan: () => void;
}

export const NewDocumentChoiceModal: React.FC<NewDocumentChoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectUpload,
  onSelectScan
}) => {
  if (!isOpen) return null;

  return (
    <div id="new-document-choice-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div id="new-document-choice-modal" className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:border-slate-800 dark:from-slate-800 dark:to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight dark:text-white">
                Neues Dokument erfassen
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wählen Sie die gewünschte Erfassungsmethode für das Vereinsarchiv
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-600/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Choice Cards */}
        <div className="p-6 space-y-4">
          {/* Option 1: Upload */}
          <div
            id="btn-choice-upload-doc"
            onClick={() => {
              onClose();
              onSelectUpload();
            }}
            className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-blue-950/40"
          >
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-blue-100 text-blue-700 rounded-2xl group-hover:scale-105 transition-transform dark:bg-blue-900/40 dark:text-blue-300">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors dark:text-white dark:group-hover:text-blue-300">
                    Bestehendes Dokument hochladen
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium dark:bg-blue-900/40 dark:text-blue-200">
                    Alle Dateiformate
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm dark:text-slate-400">
                  PDFs, Word-, Excel-Dateien, Bilder oder Textdokumente per Drag & Drop oder Dateiauswahl ablegen. Mehrfachauswahl möglich.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0 ml-2 dark:bg-slate-700">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Option 2: Scan with Camera */}
          <div
            id="btn-choice-scan-doc"
            onClick={() => {
              onClose();
              onSelectScan();
            }}
            className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-xs hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-emerald-950/40"
          >
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-emerald-100 text-emerald-700 rounded-2xl group-hover:scale-105 transition-transform dark:bg-emerald-900/40 dark:text-emerald-300">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors dark:text-white dark:group-hover:text-emerald-300">
                    Neues Dokument scannen
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium flex items-center gap-1 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <Sparkles className="w-2.5 h-2.5" />
                    Kamera / Scanner
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm dark:text-slate-400">
                  Papierbelege oder Dokumente mit der Webcam/Kamera abfotografieren, automatisch kontrastieren und als DIN A4 PDF archivieren.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0 ml-2 dark:bg-slate-700">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Info Banner & Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Automatische GoBD-Protokollierung & lokale Archivierung</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-slate-600 hover:text-slate-900 text-xs font-medium dark:text-slate-300 dark:hover:text-white"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
