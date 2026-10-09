import { useState, useMemo, ChangeEvent, DragEvent, FC } from 'react';
import { Member, ClubSettings } from '../types';
import {
  parseCSVToRows,
  autoDetectMapping,
  convertRowsToMembers,
  generateSampleCSVTemplate,
  ColumnMapping,
  ParsedMemberRow
} from '../services/memberImportService';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Download,
  Users,
  Settings2,
  Table,
  Check,
  Search,
  HelpCircle,
  FileText,
  ClipboardPaste
} from 'lucide-react';

interface MemberImportModalProps {
  existingMembers: Member[];
  settings: ClubSettings;
  onImport: (members: Member[]) => void;
  onClose: () => void;
}

export const MemberImportModal: FC<MemberImportModalProps> = ({
  existingMembers,
  settings,
  onImport,
  onClose
}) => {
  // Step state: 1 = upload/paste, 2 = mapping & defaults, 3 = preview & confirm
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeInputMode, setActiveInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultDepartment, setDefaultDepartment] = useState<string>(settings.departments[0] || 'Hauptverein');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip' | 'create_always'>('update');
  const [searchPreview, setSearchPreview] = useState('');
  const [parsedList, setParsedList] = useState<ParsedMemberRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Process raw text into headers & rows
  const processRawCSV = (text: string, sourceName: string) => {
    setErrorMsg(null);
    try {
      const { headers, rows } = parseCSVToRows(text);
      if (headers.length === 0 || rows.length === 0) {
        setErrorMsg('Die Datei enthält keine lesbaren Datenzeilen. Bitte überprüfen Sie das Format.');
        return;
      }

      setFileName(sourceName);
      setCsvHeaders(headers);
      setRawRows(rows);

      // Auto-detect columns
      const autoMap = autoDetectMapping(headers);
      setMapping(autoMap);

      // Advance to step 2 (Column Mapping)
      setStep(2);
    } catch (err: any) {
      setErrorMsg(`Fehler beim Verarbeiten der CSV-Daten: ${err.message || 'Ungültiges Dateiformat'}`);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    processRawCSV(text, file.name);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const text = await file.text();
      processRawCSV(text, file.name);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Bitte fügen Sie den aus Google Sheets oder Excel kopierten Tabellentext in das Textfeld ein.');
      return;
    }
    processRawCSV(pastedText, 'Zwischenablage / Google Sheets');
  };

  const handleDownloadSample = () => {
    const sampleCSV = generateSampleCSVTemplate(settings);
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mitglieder_vorlage_google_sheets_${settings.clubName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert to preview rows when moving to step 3
  const handleProceedToPreview = () => {
    const converted = convertRowsToMembers(rawRows, mapping, existingMembers, settings, defaultDepartment);
    setParsedList(converted);
    setStep(3);
  };

  // Toggle selection in preview
  const toggleRow = (id: string) => {
    setParsedList(prev => prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedList(prev => prev.map(item => ({ ...item, selected: select })));
  };

  // Filtered preview rows based on search
  const filteredPreview = useMemo(() => {
    return parsedList.filter(item => {
      if (duplicateStrategy === 'skip' && item.isDuplicate) return false;
      if (!searchPreview.trim()) return true;
      const q = searchPreview.toLowerCase();
      return (
        item.member.memberNumber.toLowerCase().includes(q) ||
        item.member.firstName.toLowerCase().includes(q) ||
        item.member.lastName.toLowerCase().includes(q) ||
        item.member.department.toLowerCase().includes(q) ||
        item.member.email.toLowerCase().includes(q) ||
        item.member.address.city.toLowerCase().includes(q)
      );
    });
  }, [parsedList, searchPreview, duplicateStrategy]);

  const selectedCount = parsedList.filter(i => i.selected && (duplicateStrategy !== 'skip' || !i.isDuplicate)).length;
  const duplicateCount = parsedList.filter(i => i.isDuplicate).length;
  const warningsCount = parsedList.filter(i => i.hasWarnings).length;

  // Execute Import
  const handleExecuteImport = () => {
    const toImport: Member[] = [];

    parsedList.forEach(item => {
      if (!item.selected) return;

      if (item.isDuplicate) {
        if (duplicateStrategy === 'skip') {
          return;
        } else if (duplicateStrategy === 'create_always') {
          // Force fresh new ID and adjusted number
          toImport.push({
            ...item.member,
            id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
          });
          return;
        }
      }

      toImport.push(item.member);
    });

    if (toImport.length === 0) {
      alert('Keine Mitglieder zum Importieren ausgewählt.');
      return;
    }

    onImport(toImport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-slate-200 my-4 max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shadow-xs dark:bg-blue-900/40 dark:text-blue-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Mitglieder per CSV & Google Sheets importieren
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatischer Import mit intelligenter Spaltenerkennung und Duplikatsprüfung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200"
              title="Muster-Vorlage im CSV-Format für Google Sheets oder Excel herunterladen"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Muster-Vorlage (.csv)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 py-2.5 gap-6 text-xs font-semibold dark:border-slate-800 dark:bg-slate-700/70">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              1
            </span>
            <span>Datei wählen / Einfügen</span>
          </div>

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              2
            </span>
            <span>Spalten zuordnen</span>
          </div>

          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              3
            </span>
            <span>Vorschau & Importieren</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
              <div>
                <strong className="block font-bold">Import-Hinweis</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD OR PASTE */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Input Mode Selector */}
              <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-100 max-w-md dark:border-slate-800 dark:bg-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('file')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeInputMode === 'file' ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  CSV-Datei hochladen
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeInputMode === 'paste' ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Aus Google Sheets einfügen
                </button>
              </div>

              {activeInputMode === 'file' ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-50/50 scale-[0.99] dark:bg-blue-950/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-xs dark:bg-blue-900/40 dark:text-blue-400">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1 dark:text-white">
                    CSV-Datei hierher ziehen oder auswählen
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mb-5 leading-relaxed dark:text-slate-400">
                    Unterstützt Google Sheets CSV-Exporte, Excel-CSV (.csv, .tsv) mit automatischer Erkennung von Trennzeichen (Semikolon, Komma oder Tabulator).
                  </p>

                  <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>CSV-Datei vom Computer auswählen</span>
                    <input
                      type="file"
                      accept=".csv, .tsv, .txt, text/csv, text/tab-separated-values"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-xs text-blue-900 leading-relaxed flex items-start gap-3 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-100">
                    <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 dark:text-blue-400" />
                    <div>
                      <strong>Tipp für Google Sheets:</strong> Markieren Sie in Ihrer Google-Tabelle einfach alle Zeilen (inklusive Spaltenüberschriften in Zeile 1), drücken Sie <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-mono text-[11px] dark:bg-slate-900 dark:border-blue-700/60">Strg + C</kbd> (oder <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-mono text-[11px] dark:bg-slate-900 dark:border-blue-700/60">Cmd + C</kbd>) und fügen Sie den Inhalt hier direkt mit <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-mono text-[11px] dark:bg-slate-900 dark:border-blue-700/60">Strg + V</kbd> ein.
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                      Tabellendaten aus Google Sheets / Excel einfügen:
                    </label>
                    <textarea
                      rows={10}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={`Mitgliedsnummer\tVorname\tNachname\tGeburtsdatum\tStraße\tPLZ\tOrt\tSparte\tBeitrag\tIBAN\nM-01\tMax\tMustermann\t15.04.1988\tHauptstraße 14\t12345\tMusterstadt\tFußball\t120\tDE12500...`}
                      className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                    >
                      <Table className="w-4 h-4" />
                      <span>Eingefügte Daten einlesen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-300">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 dark:text-slate-100">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  So einfach exportieren Sie aus Google Sheets:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500 pl-1 dark:text-slate-400">
                  <li>Öffnen Sie Ihre Mitglieder-Tabelle in Google Sheets.</li>
                  <li>Klicken Sie oben im Menü auf <strong>Datei → Herunterladen → Kommagetrennte Werte (.csv)</strong>.</li>
                  <li>Wählen Sie die heruntergeladene CSV-Datei hier aus.</li>
                </ol>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING & DEFAULTS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between dark:bg-blue-950/40 dark:border-blue-800/60">
                <div>
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">
                    Spaltenzuordnung ({fileName})
                  </h4>
                  <p className="text-[11px] text-blue-700 mt-0.5 dark:text-blue-300">
                    {rawRows.length} Zeilen gefunden. Überprüfen Sie, welche Spalte aus Ihrer Google-Tabelle welchem VereinsManager-Feld entspricht.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-700 hover:underline font-medium dark:text-blue-300"
                >
                  Andere Datei wählen
                </button>
              </div>

              {/* Defaults Grid */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 dark:bg-slate-800 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 dark:text-slate-100">
                  <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Standardwerte für nicht zugeordnete Spalten
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 dark:text-slate-300">
                      Standard-Sparte / Abteilung
                    </label>
                    <select
                      value={defaultDepartment}
                      onChange={(e) => setDefaultDepartment(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    >
                      {settings.departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mapping Selector Fields */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs dark:border-slate-800">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between dark:bg-slate-700 dark:border-slate-800 dark:text-slate-100">
                  <span>VereinsManager Feld</span>
                  <span>Spalte in Ihrer Tabelle</span>
                </div>

                <div className="p-4 divide-y divide-slate-100 text-xs space-y-3 dark:divide-slate-800">
                  {/* Name fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 dark:text-slate-100">
                        Vorname <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={mapping.firstName || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, firstName: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1 dark:text-slate-100">
                        Nachname <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={mapping.lastName || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, lastName: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Alternative Full Name */}
                  {(!mapping.firstName || !mapping.lastName) && (
                    <div className="pt-3 pb-3">
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Alternativ: Vollständiger Name (wird automatisch in Vor- und Nachname aufgeteilt)
                      </label>
                      <select
                        value={mapping.fullName || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, fullName: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Member number & Birth date */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 pb-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Mitgliedsnummer (optional)
                      </label>
                      <select
                        value={mapping.memberNumber || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, memberNumber: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Automatisch fortlaufend generieren –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Geburtsdatum
                      </label>
                      <select
                        value={mapping.birthDate || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, birthDate: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Geschlecht
                      </label>
                      <select
                        value={mapping.gender || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, gender: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 pb-3">
                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Straße (oder komplette Anschrift)
                      </label>
                      <select
                        value={mapping.street || mapping.fullAddress || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, street: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        PLZ
                      </label>
                      <select
                        value={mapping.zip || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, zip: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Ort / Stadt
                      </label>
                      <select
                        value={mapping.city || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, city: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 pb-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        E-Mail-Adresse
                      </label>
                      <select
                        value={mapping.email || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, email: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Telefon / Mobilnummer
                      </label>
                      <select
                        value={mapping.phone || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, phone: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sparte, Status & Beitrag */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 pb-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Sparte / Abteilung
                      </label>
                      <select
                        value={mapping.department || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, department: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Standard verwenden ({defaultDepartment}) –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Mitgliedsstatus
                      </label>
                      <select
                        value={mapping.status || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, status: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Standard: Aktiv –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Beitragshöhe (€)
                      </label>
                      <select
                        value={mapping.feeAmount || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, feeAmount: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Automatisch nach Tarif berechnen –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 pb-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        IBAN (für SEPA-Lastschrift)
                      </label>
                      <select
                        value={mapping.iban || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, iban: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Nicht zugeordnet –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-200">
                        Eintrittsdatum
                      </label>
                      <select
                        value={mapping.entryDate || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, entryDate: e.target.value || undefined }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        <option value="">– Heutiges Datum verwenden –</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 Bottom Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPreview}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2"
                >
                  <span>Zur Vorschau & Duplikatsprüfung</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & DUPLICATE RESOLUTION */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary Stats Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-800">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                    Gefundene Datensätze
                  </span>
                  <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                    {parsedList.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                    {selectedCount} zum Import ausgewählt
                  </div>
                </div>

                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 dark:bg-amber-950/70 dark:border-amber-800/60">
                  <span className="text-[11px] font-bold uppercase text-amber-600 block mb-1 dark:text-amber-400">
                    Bestehende Mitglieder
                  </span>
                  <div className="text-2xl font-mono font-bold text-amber-900 dark:text-amber-100">
                    {duplicateCount}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-1 dark:text-amber-300">
                    Übereinstimmung über Nr. oder Name
                  </div>
                </div>

                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 dark:bg-blue-950/70 dark:border-blue-800/60">
                  <span className="text-[11px] font-bold uppercase text-blue-600 block mb-1 dark:text-blue-400">
                    Hinweise & Warnungen
                  </span>
                  <div className="text-2xl font-mono font-bold text-blue-900 dark:text-blue-100">
                    {warningsCount}
                  </div>
                  <div className="text-[11px] text-blue-700 mt-1 dark:text-blue-300">
                    z. B. unvollständige IBAN oder fehlende Namen
                  </div>
                </div>
              </div>

              {/* Duplicate Strategy selector */}
              {duplicateCount > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs dark:bg-amber-950/40 dark:border-amber-800/60">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5 dark:text-amber-100">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Umgang mit {duplicateCount} bereits vorhandenen Mitgliedern:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer font-medium ${duplicateStrategy === 'update' ? 'bg-white border-amber-400 text-amber-900 shadow-xs dark:bg-slate-900 dark:text-amber-100' : 'border-amber-200 text-amber-800 dark:border-amber-800/60 dark:text-amber-200'}`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="update"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="text-blue-600 focus:ring-blue-500 dark:text-blue-400"
                      />
                      <span>Bestehende Stammdaten aktualisieren (Merge)</span>
                    </label>

                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer font-medium ${duplicateStrategy === 'skip' ? 'bg-white border-amber-400 text-amber-900 shadow-xs dark:bg-slate-900 dark:text-amber-100' : 'border-amber-200 text-amber-800 dark:border-amber-800/60 dark:text-amber-200'}`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="skip"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="text-blue-600 focus:ring-blue-500 dark:text-blue-400"
                      />
                      <span>Duplikate überspringen (Nur neue)</span>
                    </label>

                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer font-medium ${duplicateStrategy === 'create_always' ? 'bg-white border-amber-400 text-amber-900 shadow-xs dark:bg-slate-900 dark:text-amber-100' : 'border-amber-200 text-amber-800 dark:border-amber-800/60 dark:text-amber-200'}`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        value="create_always"
                        checked={duplicateStrategy === 'create_always'}
                        onChange={() => setDuplicateStrategy('create_always')}
                        className="text-blue-600 focus:ring-blue-500 dark:text-blue-400"
                      />
                      <span>Immer als neues Mitglied anlegen</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Search & Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col dark:border-slate-800">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 dark:bg-slate-800 dark:border-slate-800">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchPreview}
                      onChange={(e) => setSearchPreview(e.target.value)}
                      placeholder="In Vorschau suchen..."
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(true)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded font-medium transition-colors dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-600"
                    >
                      Alle auswählen
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(false)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded font-medium transition-colors dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-600"
                    >
                      Keine
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-800">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={parsedList.length > 0 && parsedList.every(i => i.selected)}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:text-blue-400"
                          />
                        </th>
                        <th className="p-3">Nr.</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Sparte</th>
                        <th className="p-3">Beitrag</th>
                        <th className="p-3">Wohnort / Kontakt</th>
                        <th className="p-3">Status / IBAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPreview.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => toggleRow(row.id)}
                          className={`hover:bg-slate-50 cursor-pointer transition-colors dark:hover:bg-slate-800 ${
                            row.selected ? 'bg-blue-50/30 dark:bg-blue-950/30' : 'opacity-60 bg-slate-50/50 dark:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRow(row.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:text-blue-400"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700 text-[11px] dark:text-slate-200">
                            {row.member.memberNumber}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {row.member.lastName}, {row.member.firstName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {row.isDuplicate && (
                                <span className="inline-block font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded mr-1 dark:text-amber-300 dark:bg-amber-900/40">
                                  Bestehend
                                </span>
                              )}
                              {row.hasWarnings && (
                                <span className="inline-block text-rose-600 font-semibold dark:text-rose-400" title={row.warnings.join(', ')}>
                                  ⚠️ {row.warnings[0]}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[11px] dark:bg-slate-700 dark:text-slate-200">
                              {row.member.department}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-900 text-[11px] dark:text-white">
                            {row.member.feeAmount.toFixed(2)} €
                          </td>
                          <td className="p-3 text-slate-600 text-[11px] dark:text-slate-300">
                            <div>{row.member.address.zip} {row.member.address.city || '–'}</div>
                            <div className="text-slate-400 truncate max-w-[140px]">{row.member.email || row.member.phone}</div>
                          </td>
                          <td className="p-3 text-[11px]">
                            {row.member.bankDetails.iban ? (
                              <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-medium dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/50">
                                SEPA
                              </span>
                            ) : (
                              <span className="text-slate-400">Keine Bankdaten</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Zurück zur Zuordnung
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">{selectedCount}</strong> Mitglieder ausgewählt
                  </span>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Jetzt {selectedCount} Mitglied(er) importieren</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
