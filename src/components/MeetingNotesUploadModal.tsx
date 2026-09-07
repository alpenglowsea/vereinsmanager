import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  Eye
} from 'lucide-react';
import { MeetingType, Meeting } from '../types';
import { MeetingAiService, MeetingExtractedData } from '../services/meetingAiService';

interface MeetingNotesUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedData: (data: MeetingExtractedData) => void;
  currentMeetingContext?: {
    title?: string;
    type?: MeetingType;
    date?: string;
  };
}

export const MeetingNotesUploadModal: React.FC<MeetingNotesUploadModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedData,
  currentMeetingContext,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<MeetingType>(currentMeetingContext?.type || 'board');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<MeetingExtractedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setAnalysisError(null);
    setExtractedResult(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await MeetingAiService.analyzeNotes(selectedFile, selectedFile.name, {
        title: currentMeetingContext?.title,
        type: selectedType,
        date: currentMeetingContext?.date,
      });

      setExtractedResult(result);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setAnalysisError(err.message || 'Die Notizen konnten nicht ausgewertet werden.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (extractedResult) {
      onApplyExtractedData(extractedResult);
      onClose();
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setExtractedResult(null);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Notizen hochladen & Protokoll erstellen
              </h2>
              <p className="text-xs text-slate-500">
                Handschriftliche Notizen, Whiteboard-Fotos oder PDF-Scans in ein rechtssicheres Protokoll umwandeln.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* If no result yet */}
          {!extractedResult ? (
            <>
              {/* Meeting Type Selection (if not fixed) */}
              {!currentMeetingContext?.type && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Sitzungsart für die Notizen
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as MeetingType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="board">Vorstandssitzung</option>
                    <option value="general_assembly">Ordentliche Mitgliederversammlung</option>
                    <option value="extraordinary_assembly">Außerordentliche Mitgliederversammlung</option>
                    <option value="committee">Ausschuss / Fachbereich</option>
                    <option value="department">Abteilungsversammlung</option>
                    <option value="other">Sonstige Vereinssitzung</option>
                  </select>
                </div>
              )}

              {/* Upload Dropzone */}
              {!selectedFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/40 hover:bg-rose-50/70 transition-all rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white text-rose-600 shadow-xs border border-rose-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">
                      Notiz-Datei hier ablegen oder durchsuchen
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Unterstützt PDF, JPEG, PNG, WEBP (z. B. Smartphone-Foto von handschriftlichen Notizen oder Flipcharts)
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="mt-2 px-4 py-2 bg-white text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-2xs hover:bg-rose-50"
                  >
                    Datei vom Gerät auswählen
                  </button>
                </div>
              ) : (
                /* Selected File Card */
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
                        {selectedFile.type.startsWith('image/') ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Dokument'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Andere Datei wählen
                    </button>
                  </div>

                  {/* Thumbnail if image */}
                  {filePreviewUrl && (
                    <div className="max-h-48 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                      <img
                        src={filePreviewUrl}
                        alt="Vorschau"
                        className="max-h-48 w-auto object-contain"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Gemini KI-Erkennung:</span> Handschrift, Skizzen, Tagesordnungspunkte, Beschlussanträge und Stimmergebnisse werden automatisch erkannt, sachlich formuliert und strukturiert. Sie können alle Angaben im Anschluss nach Belieben anpassen.
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {analysisError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Analyse fehlgeschlagen: </span>
                    {analysisError}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results Review */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-emerald-900">
                    Notizen erfolgreich durch Gemini analysiert!
                  </h3>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Es wurden {extractedResult.agenda.length} Tagesordnungspunkte und{' '}
                    {extractedResult.agenda.reduce((acc, t) => acc + (t.resolutions?.length || 0), 0)} Beschlüsse identifiziert.
                  </p>
                </div>
              </div>

              {/* Overview of extracted data */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Erkannter Titel:</span>
                    <span className="font-bold text-slate-800">{extractedResult.title || 'Sitzung'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Erkanntes Datum:</span>
                    <span className="font-bold text-slate-800">{extractedResult.date || 'Nicht explizit genannt'}</span>
                  </div>
                  {extractedResult.chairperson && (
                    <div>
                      <span className="text-slate-400 font-semibold block">Versammlungsleitung:</span>
                      <span className="font-medium text-slate-700">{extractedResult.chairperson}</span>
                    </div>
                  )}
                  {extractedResult.location && (
                    <div>
                      <span className="text-slate-400 font-semibold block">Ort:</span>
                      <span className="font-medium text-slate-700">{extractedResult.location}</span>
                    </div>
                  )}
                </div>

                {/* Agenda preview */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-2">
                    Extrahierte Tagesordnungspunkte ({extractedResult.agenda.length}):
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {extractedResult.agenda.map((top, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-rose-700 mr-2">{top.number}:</span>
                          <span className="font-semibold text-slate-800">{top.title}</span>
                          {top.discussionNotes && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {top.discussionNotes}
                            </p>
                          )}
                        </div>
                        {top.resolutions && top.resolutions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 shrink-0">
                            {top.resolutions.length} {top.resolutions.length === 1 ? 'Beschluss' : 'Beschlüsse'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {extractedResult.extractedRawSummary && (
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 bg-white/60 p-2.5 rounded-xl">
                    <span className="font-bold text-slate-700 block mb-0.5">Zusammenfassung der Erkennung:</span>
                    {extractedResult.extractedRawSummary}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          {!extractedResult ? (
            <button
              type="button"
              disabled={!selectedFile || isAnalyzing}
              onClick={handleStartAnalysis}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
                !selectedFile || isAnalyzing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini analysiert Notizen...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Notizen analysieren & Protokoll entwerfen</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Erneut hochladen
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>In Protokoll-Editor übernehmen & bearbeiten</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
