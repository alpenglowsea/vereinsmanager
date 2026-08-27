import React, { useState, useRef } from 'react';
import {
  CalendarEvent,
  CalendarEventCategory
} from '../types';
import { CalendarService } from '../services/calendarService';
import {
  Upload,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  FileCode,
  Check,
  Loader2,
  Info
} from 'lucide-react';

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CalendarEventCategory[];
  onImportSuccess: (events: CalendarEvent[]) => Promise<void>;
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedEvents, setParsedEvents] = useState<CalendarEvent[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessContent = (content: string, filename: string) => {
    setIsParsing(true);
    setParseErrors([]);
    setParsedEvents([]);

    try {
      const lowerName = filename.toLowerCase();
      let result: { events: CalendarEvent[]; errors: string[] };

      if (lowerName.endsWith('.csv') || (!lowerName.endsWith('.ics') && !lowerName.endsWith('.ical') && content.includes(';'))) {
        result = CalendarService.parseCsv(content, categories);
      } else {
        result = CalendarService.parseIcs(content, categories);
      }

      setParsedEvents(result.events);
      setParseErrors(result.errors);
    } catch (err: any) {
      setParseErrors([err.message || 'Fehler beim Parsen der Kalenderdaten.']);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      handleProcessContent(text, file.name);
    };
    reader.readAsText(file);
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
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      handleProcessContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleTextParse = () => {
    if (!rawText.trim()) return;
    const isCsv = rawText.includes(';') || rawText.includes('Titel,');
    handleProcessContent(rawText, isCsv ? 'input.csv' : 'input.ics');
  };

  const handleExecuteImport = async () => {
    if (parsedEvents.length === 0) return;
    setIsImporting(true);
    try {
      await onImportSuccess(parsedEvents);
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Kalender importieren</h3>
              <p className="text-xs text-slate-500">Unterstützt iCal (.ics, .ical), Google Kalender, Outlook und CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4 flex gap-2 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'file'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Datei-Upload (.ics / .csv)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'text'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Text / iCal einfügen</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'file' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50 scale-99'
                  : selectedFileName
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics,.ical,.csv,text/calendar,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">
                {selectedFileName ? selectedFileName : 'Klicken oder Datei hierher ziehen'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Format: <strong>.ics</strong>, <strong>.ical</strong> oder <strong>.csv</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                iCalendar-Daten oder CSV-Inhalt hier einfügen:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:Punktspiel 1. Herren&#10;DTSTART:20260912T150000&#10;LOCATION:Sportplatz&#10;END:VEVENT&#10;END:VCALENDAR"
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
              />
              <button
                type="button"
                onClick={handleTextParse}
                disabled={!rawText.trim() || isParsing}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors disabled:opacity-40"
              >
                Inhalt analysieren & prüfen
              </button>
            </div>
          )}

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-800">
              <div className="font-bold flex items-center gap-1 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Hinweise beim Einlesen:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700 pl-1">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview of Parsed Events */}
          {parsedEvents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Gefundene Termine ({parsedEvents.length})</span>
                </h4>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Bereit zum Importieren
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {parsedEvents.map((evt, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900">{evt.title}</span>
                        {evt.location && <span className="text-slate-400 ml-1.5 font-normal">📍 {evt.location}</span>}
                      </div>
                    </div>
                    <div className="text-slate-500 font-medium">
                      {evt.startDate} {evt.startTime && `• ${evt.startTime} Uhr`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedEvents.length > 0
              ? `${parsedEvents.length} Termine werden zur Vereinsdatenbank hinzugefügt.`
              : 'Wählen Sie eine Kalenderdatei aus.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={parsedEvents.length === 0 || isImporting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isImporting ? 'Importiere...' : `${parsedEvents.length} Termine importieren`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
