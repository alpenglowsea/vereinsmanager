import { useState, useMemo, ChangeEvent, DragEvent, FC } from 'react';
import { Transaction, FinancialAccount, ClubSettings, TaxSphere } from '../types';
import {
  parseCSVToRows,
  autoDetectTransactionMapping,
  convertRowsToTransactions,
  generateSampleTransactionCSVTemplate,
  TransactionColumnMapping,
  ParsedTransactionRow,
  pruefeImportZeile
} from '../services/transactionImportService';
import { useSkr42 } from '../hooks/useSkr42';
import { kontoNachNummer, kontoFelder } from '../utils/importRegeln';
import { SkrKontoAuswahl } from './SkrKontoAuswahl';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Settings2,
  Table,
  Check,
  Search,
  FileText,
  ClipboardPaste,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Info
} from 'lucide-react';
import { saveBlobAs } from '../utils/fileExportHelper';
import { melde } from '../utils/dialoge';
import { leseImportDatei, XLSX_ACCEPT } from '../utils/importDatei';

import VeraenderbaresFenster from './VeraenderbaresFenster';
interface TransactionImportModalProps {
  existingTransactions: Transaction[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
  onImport: (transactions: Transaction[]) => void;
  onClose: () => void;
}

export const TransactionImportModal: FC<TransactionImportModalProps> = ({
  existingTransactions,
  accounts,
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
  const [mapping, setMapping] = useState<TransactionColumnMapping>({});
  
  // Default fallbacks
  const [defaultAccountId, setDefaultAccountId] = useState<string>(accounts[0]?.id || 'acc-1');
  const [defaultType, setDefaultType] = useState<'auto' | 'income' | 'expense'>('auto');
  const [defaultSphere, setDefaultSphere] = useState<TaxSphere>('ideell');
  const [defaultVatRate, setDefaultVatRate] = useState<0 | 7 | 19>(0);
  // „Bestehende Buchungen aktualisieren“ gab es nur als Auswahl, ohne Wirkung; entfernt (P17)
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'create_always'>('skip');
  const skr = useSkr42();
  const [sammelKonto, setSammelKonto] = useState('');
  const [sammelHinweis, setSammelHinweis] = useState<string | null>(null);
  
  // Step 3 preview state
  const [searchPreview, setSearchPreview] = useState('');
  const [filterPreviewStatus, setFilterPreviewStatus] = useState<'all' | 'valid' | 'duplicates' | 'warnings' | 'fehler'>('all');
  const [parsedList, setParsedList] = useState<ParsedTransactionRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Kopfzeilen und Zeilen übernehmen (aus CSV-Text oder aus einer Excel-Datei, P28)
  const uebernimmTabelle = (headers: string[], rows: Record<string, string>[], sourceName: string) => {
    if (headers.length === 0 || rows.length === 0) {
      setErrorMsg('Die Datei enthält keine lesbaren Buchungszeilen. Bitte überprüfen Sie das Format.');
      return;
    }

    setFileName(sourceName);
    setCsvHeaders(headers);
    setRawRows(rows);

    // Auto-detect columns
    const autoMap = autoDetectTransactionMapping(headers);
    setMapping(autoMap);

    // Advance to step 2 (Column Mapping)
    setStep(2);
  };

  // Process raw text into headers & rows
  const processRawCSV = (text: string, sourceName: string) => {
    setErrorMsg(null);
    try {
      const { headers, rows } = parseCSVToRows(text);
      uebernimmTabelle(headers, rows, sourceName);
    } catch (err: any) {
      setErrorMsg(`Fehler beim Verarbeiten der CSV-Daten: ${err.message || 'Ungültiges Dateiformat'}`);
    }
  };

  // Gewählte Datei: Excel (.xlsx) als Tabelle, sonst Text wie bisher (P28)
  const verarbeiteDatei = async (file: File) => {
    setErrorMsg(null);
    try {
      const d = await leseImportDatei(file);
      if (d.art === 'text' && d.hinweis) void melde(d.hinweis, 'Hinweis zur Datei');
      if (d.art === 'tabelle') uebernimmTabelle(d.tabelle.headers, d.tabelle.rows, file.name);
      else processRawCSV(d.text, file.name);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await verarbeiteDatei(file);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await verarbeiteDatei(file);
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Bitte fügen Sie den aus Google Sheets oder Excel kopierten Tabellentext in das Textfeld ein.');
      return;
    }
    processRawCSV(pastedText, 'Zwischenablage / Google Sheets');
  };

  const handleDownloadSample = () => {
    const sampleCSV = generateSampleTransactionCSVTemplate(settings, accounts);
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    void saveBlobAs(blob, `buchungen_vorlage_skr42_${settings.clubName.replace(/\s+/g, '_')}.csv`);
  };

  // Convert to preview rows when moving to step 3
  const handleProceedToPreview = () => {
    const converted = convertRowsToTransactions(
      rawRows,
      mapping,
      existingTransactions,
      accounts,
      settings,
      defaultAccountId,
      defaultSphere,
      defaultVatRate,
      defaultType,
      skr
    );

    // Duplikate sind abgewählt (D-65); auf Wunsch doch alle neu anlegen.
    // Zeilen mit Fehler bleiben in jedem Fall abgewählt.
    if (duplicateStrategy === 'create_always') {
      converted.forEach(c => {
        if (c.isDuplicate && c.fehler.length === 0) c.selected = true;
      });
    }

    setParsedList(converted);
    setStep(3);
  };

  // Auswahl in der Vorschau; Zeilen mit Fehler erst nach der Berichtigung
  const toggleRow = (id: string) => {
    setParsedList(prev => prev.map(item => (item.id === id && item.fehler.length === 0 ? { ...item, selected: !item.selected } : item)));
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedList(prev => prev.map(item => ({ ...item, selected: select && item.fehler.length === 0 })));
  };

  // Änderungen in der Vorschau. Sphäre und Konto sind unabhängig voneinander
  // (siehe Hinweis bei Skr42MainCategory in src/types.ts). Nach jeder Änderung
  // wird die Zeile neu geprüft (Fehler, Duplikat).
  const aendereZeile = (id: string, aendern: (t: Transaction) => Transaction, auswahlNeu = false) => {
    setParsedList(prev => prev.map(item => {
      if (item.id !== id) return item;
      const vorher = item.fehler.length > 0;
      return pruefeImportZeile({ ...item, transaction: aendern(item.transaction), kontoVorschlag: false }, existingTransactions, auswahlNeu || vorher);
    }));
  };

  const updateRowSphere = (id: string, newSphere: TaxSphere) => {
    aendereZeile(id, t => ({ ...t, sphere: newSphere }));
  };

  // Datum berichtigen (D-67)
  const updateRowDate = (id: string, date: string) => {
    aendereZeile(id, t => ({ ...t, date }));
  };

  // Konto des Kontenrahmens mit seiner Umsatzsteuer (D-69)
  const updateRowKonto = (id: string, code: string) => {
    const k = kontoNachNummer(code, skr);
    aendereZeile(id, t => k
      ? { ...t, ...kontoFelder(k) }
      : { ...t, mainCategory: '', subCategory: '', category: '', skrAccount: '' });
  };

  const updateRowAccount = (id: string, newAccountId: string) => {
    aendereZeile(id, t => ({ ...t, accountId: newAccountId }));
  };

  // Artwechsel: Vorzeichen anpassen; ein Konto der anderen Richtung entfällt
  const updateRowType = (id: string, newType: 'income' | 'expense' | 'transfer') => {
    aendereZeile(id, t => {
      const absAmount = Math.abs(t.amount);
      const k = t.skrAccount ? kontoNachNummer(t.skrAccount, skr) : null;
      const passt = !!k && newType !== 'transfer' && k.main.type === newType;
      return {
        ...t,
        type: newType,
        amount: newType === 'expense' ? -absAmount : absAmount,
        ...(passt ? {} : { mainCategory: '', subCategory: '', category: '', skrAccount: '' })
      };
    });
  };

  // Ein Konto für alle angehakten Zeilen derselben Richtung
  const setzeSammelKonto = () => {
    const k = kontoNachNummer(sammelKonto, skr);
    if (!k) return;
    let gesetzt = 0;
    let andere = 0;
    const neu = parsedList.map(item => {
      if (!item.selected) return item;
      if (item.transaction.type !== k.main.type) { andere++; return item; }
      gesetzt++;
      return pruefeImportZeile({ ...item, transaction: { ...item.transaction, ...kontoFelder(k) }, kontoVorschlag: false }, existingTransactions);
    });
    setParsedList(neu);
    setSammelHinweis(
      `Konto ${k.sub.code} auf ${gesetzt} Zeile(n) gesetzt.` +
      (andere > 0 ? ` ${andere} angehakte Zeile(n) haben eine andere Art und blieben unverändert.` : '')
    );
  };

  // Filtered preview rows based on search and status filter
  const filteredPreview = useMemo(() => {
    return parsedList.filter(item => {
      if (filterPreviewStatus === 'duplicates' && !item.isDuplicate) return false;
      if (filterPreviewStatus === 'warnings' && !item.hasWarnings) return false;
      if (filterPreviewStatus === 'valid' && (item.isDuplicate || item.hasWarnings || item.fehler.length > 0)) return false;
      if (filterPreviewStatus === 'fehler' && item.fehler.length === 0) return false;

      if (!searchPreview.trim()) return true;
      const q = searchPreview.toLowerCase();
      return (
        item.transaction.documentNumber.toLowerCase().includes(q) ||
        item.transaction.bookingText.toLowerCase().includes(q) ||
        item.transaction.partner.toLowerCase().includes(q) ||
        item.transaction.category.toLowerCase().includes(q) ||
        (item.transaction.subCategory && item.transaction.subCategory.toLowerCase().includes(q)) ||
        (item.transaction.notes && item.transaction.notes.toLowerCase().includes(q))
      );
    });
  }, [parsedList, searchPreview, filterPreviewStatus]);

  // Selected stats
  const selectedRows = useMemo(() => parsedList.filter(p => p.selected && p.fehler.length === 0), [parsedList]);
  const fehlerAnzahl = parsedList.filter(p => p.fehler.length > 0).length;

  const previewStats = useMemo(() => {
    let incomeSum = 0;
    let expenseSum = 0;
    const sphereCounts: Record<TaxSphere, number> = {
      ideell: 0,
      vermoegen: 0,
      zweckbetrieb: 0,
      wirtschaftlich: 0
    };

    selectedRows.forEach(row => {
      const amt = row.transaction.amount;
      if (row.transaction.type === 'transfer') return; // Umbuchungen sind weder Einnahme noch Ausgabe
      if (row.transaction.type === 'income') incomeSum += Math.abs(amt);
      else expenseSum += Math.abs(amt);
      sphereCounts[row.transaction.sphere]++;
    });

    return {
      count: selectedRows.length,
      incomeSum,
      expenseSum,
      netBalance: incomeSum - expenseSum,
      sphereCounts
    };
  }, [selectedRows]);

  // Final Import Action
  const handleExecuteImport = () => {
    if (selectedRows.length === 0) {
      void melde('Bitte markieren Sie mindestens eine Buchung zum Importieren.');
      return;
    }

    const transactionsToImport = selectedRows.filter(r => r.transaction.date).map(r => r.transaction);
    onImport(transactionsToImport);
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <VeraenderbaresFenster kennung="buchungen-import" className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden border border-slate-200 my-6 max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl dark:bg-emerald-900/40 dark:text-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Buchungen aus Excel & Google Sheets importieren
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded uppercase font-mono dark:bg-emerald-900/40 dark:text-emerald-200">
                  SKR 42 Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Stapelimport von Bankauszügen, Kassenbüchern, Rechnungslisten und historischen EÜR-Journalen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors dark:hover:text-slate-300 dark:hover:bg-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 dark:bg-slate-700 dark:border-slate-800">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 1 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-300 text-slate-600 dark:bg-slate-500 dark:text-slate-300'
                }`}
              >
                1
              </div>
              <span className={`text-xs font-semibold ${step >= 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                1. Quelle & Tabelle
              </span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 transition-colors ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 2 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-300 text-slate-600 dark:bg-slate-500 dark:text-slate-300'
                }`}
              >
                2
              </div>
              <span className={`text-xs font-semibold ${step >= 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                2. Spalten & SKR 42
              </span>
            </div>

            <div className={`flex-1 h-0.5 mx-3 transition-colors ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`} />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 3 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-300 text-slate-600 dark:bg-slate-500 dark:text-slate-300'
                }`}
              >
                3
              </div>
              <span className={`text-xs font-semibold ${step >= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                3. Prüfung & Import
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-800/50">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800 animate-in fade-in dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: UPLOAD / PASTE TABULAR DATA                       */}
          {/* ======================================================== */}
          {step === 1 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Header Box with sample download */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Unterstützt Google Sheets, Microsoft Excel & Bank-CSV
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                    Laden Sie eine Excel- oder CSV-Datei hoch oder kopieren Sie Zeilen direkt aus Ihrer Tabellenkalkulation per Strg+C / Strg+V.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shrink-0 shadow-2xs dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800/60"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>SKR 42 Vorlage (.csv)</span>
                </button>
              </div>

              {/* Input Mode Selector (File Upload vs. Direct Paste) */}
              <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('file')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeInputMode === 'file'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Excel- oder CSV-Datei hochladen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                    activeInputMode === 'paste'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Direkt aus Sheets / Excel einfügen (Strg+V)</span>
                </button>
              </div>

              {/* Mode 1: File Upload */}
              {activeInputMode === 'file' && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`p-10 border-2 border-dashed rounded-b-2xl bg-white text-center transition-all dark:bg-slate-900 ${
                    isDragging ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/50' : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'
                  }`}
                >
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xs dark:bg-emerald-950/40 dark:text-emerald-400">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1 dark:text-slate-100">
                    Buchungsdatei hier ablegen oder durchsuchen
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 dark:text-slate-400">
                    Akzeptiert Excel-Dateien (.xlsx, erste Tabelle) und .csv-Dateien (mit Semikolon, Tabulator oder Komma getrennt) aus Google Sheets, Sparkasse, Volksbank, Lexware usw.
                  </p>

                  <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                    <FileText className="w-4 h-4" />
                    <span>Datei vom Computer auswählen</span>
                    <input
                      type="file"
                      accept={`.csv,.txt,.tsv,${XLSX_ACCEPT}`}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Mode 2: Paste from Clipboard */}
              {activeInputMode === 'paste' && (
                <div className="p-6 bg-white rounded-b-2xl border border-t-0 border-slate-200 space-y-4 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Tipp: Markieren Sie in Google Sheets oder Excel Ihre Zeilen samt Kopfzeile, drücken Sie <b>Strg+C</b> und fügen Sie den Inhalt hier ein.
                    </span>
                    <span className="font-mono text-slate-400">
                      {pastedText ? `${pastedText.split('\n').filter(l => l.trim()).length} Zeilen` : '0 Zeilen'}
                    </span>
                  </div>

                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Datum&#9;Belegnummer&#9;Zahlungspartner&#9;Buchungstext&#9;Betrag&#9;Sphäre&#10;15.01.2025&#9;BE-001&#9;Mitglieder&#9;Mitgliedsbeitrag Q1&#9;3450,00&#9;Ideeller Bereich..."
                    className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      disabled={!pastedText.trim()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                    >
                      <span>Tabelle verarbeiten & zuordnen</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Instructions & Help Box */}
              <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-200/80 flex items-start gap-3 dark:bg-slate-700/80 dark:border-slate-800">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 dark:text-slate-400" />
                <div className="text-xs text-slate-600 space-y-1 dark:text-slate-300">
                  <span className="font-bold text-slate-800 dark:text-slate-100">So funktioniert der Import aus Google Sheets & Excel:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                    <li><b>Google Sheets:</b> Datei → Herunterladen → Microsoft Excel (.xlsx) oder Kommagetrennte Werte (.csv) oder einfach Zeilen markieren und kopieren.</li>
                    <li><b>Microsoft Excel:</b> Die .xlsx-Datei direkt wählen (gelesen wird die erste Tabelle) oder Zeilen markieren und kopieren.</li>
                    <li><b>SKR 42:</b> Eine Kontonummer (z. B. 40000) wird übernommen, die Umsatzsteuer kommt aus dem Konto. Ohne Nummer schlägt die App das Konto der letzten Buchung desselben Partners vor; in der Vorschau lässt es sich je Zeile oder für mehrere Zeilen zugleich wählen.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: COLUMN MAPPING & DEFAULT SETTINGS                 */}
          {/* ======================================================== */}
          {step === 2 && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Spaltenzuordnung & Standard-Vorgaben
                    </h3>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold dark:bg-blue-900/40 dark:text-blue-200">
                      {rawRows.length} Datenzeilen erkannt
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                    Datei: <span className="font-mono text-slate-700 font-semibold dark:text-slate-200">{fileName}</span> ({csvHeaders.length} Spalten)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors dark:border-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                  >
                    ← Andere Datei wählen
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span>Weiter zur Vorschau</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Standard Fallbacks & Import Options */}
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs space-y-4 dark:bg-emerald-950/50 dark:border-emerald-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  <Settings2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                  <span>Standard-Vorgaben für fehlende Spaltenwerte</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Default Target Account */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Standard-Finanzkonto / Kasse
                    </label>
                    <select
                      value={defaultAccountId}
                      onChange={(e) => setDefaultAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.accountType === 'cash' ? 'Kasse' : 'Bank'})
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">Wird genutzt, falls Spalte fehlt</span>
                  </div>

                  {/* Default Transaction Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Standard-Buchungsart
                    </label>
                    <select
                      value={defaultType}
                      onChange={(e) => setDefaultType(e.target.value as 'auto' | 'income' | 'expense')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                    >
                      <option value="auto">Automatisch (Vorzeichen +/-)</option>
                      <option value="income">Immer Einnahme (+)</option>
                      <option value="expense">Immer Ausgabe (-)</option>
                    </select>
                    <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">Fallback bei fehlender Spalte</span>
                  </div>

                  {/* Default Sphere */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Standard-Sphäre (SKR 42)
                    </label>
                    <select
                      value={defaultSphere}
                      onChange={(e) => setDefaultSphere(e.target.value as TaxSphere)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                    >
                      <option value="ideell">1. Ideeller Bereich</option>
                      <option value="vermoegen">2. Vermögensverwaltung</option>
                      <option value="zweckbetrieb">3. Zweckbetrieb</option>
                      <option value="wirtschaftlich">4. Wirtschaftl. Geschäftsbetrieb</option>
                    </select>
                    <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">Fallback bei unklarer Zuordnung</span>
                  </div>

                  {/* Default VAT Rate */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Standard-USt / MwSt
                    </label>
                    <select
                      value={defaultVatRate}
                      onChange={(e) => setDefaultVatRate(parseInt(e.target.value, 10) as 0 | 7 | 19)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                    >
                      <option value="0">0% (Steuerfrei gem. § 4 UStG)</option>
                      <option value="7">7% (Ermäßigter Steuersatz)</option>
                      <option value="19">19% (Regelsteuersatz)</option>
                    </select>
                    <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">Umsatzsteuersatz</span>
                  </div>

                  {/* Duplicate Strategy */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                      Duplikat-Prüfung
                    </label>
                    <select
                      value={duplicateStrategy}
                      onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                    >
                      <option value="skip">Duplikate abwählen (empfohlen)</option>
                      <option value="create_always">Alle als neu importieren</option>
                    </select>
                    <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">Gleiches Datum und Betrag, dazu gleiche Belegnummer, gleicher Partner oder gleicher Text</span>
                  </div>
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-100">
                    Zuordnung der Tabellenspalten
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Die KI / Regelautomatik hat Spalten automatisch vorgeschlagen
                  </span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Field 1: Date */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Buchungsdatum *</label>
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Pflichtfeld</span>
                    </div>
                    <select
                      value={mapping.date || ''}
                      onChange={(e) => setMapping({ ...mapping, date: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">z.B. 15.01.2025 oder 2025-01-15</p>
                  </div>

                  {/* Field 2: Amount */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Betrag / Umsatz *</label>
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Pflichtfeld</span>
                    </div>
                    <select
                      value={mapping.amount || ''}
                      onChange={(e) => setMapping({ ...mapping, amount: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">z.B. 150,00 oder -45,50 €</p>
                  </div>

                  {/* Field 3: Transaction Type (Buchungsart) */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Buchungsart / Typ</label>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">E/A / Soll/Haben</span>
                    </div>
                    <select
                      value={mapping.type || ''}
                      onChange={(e) => setMapping({ ...mapping, type: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Automatisch anhand Vorzeichen --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">z.B. Einnahme, Ausgabe, Umbuchung, Soll/Haben</p>
                  </div>

                  {/* Field 3: Booking Text */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Buchungstext / Zweck *</label>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Wichtig</span>
                    </div>
                    <select
                      value={mapping.bookingText || ''}
                      onChange={(e) => setMapping({ ...mapping, bookingText: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Verwendungszweck der Buchung</p>
                  </div>

                  {/* Field 4: Partner */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Zahlungspartner</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.partner || ''}
                      onChange={(e) => setMapping({ ...mapping, partner: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Empfänger, Mitglied oder Lieferant</p>
                  </div>

                  {/* Field 5: Document Number */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Belegnummer</label>
                      <span className="text-[10px] text-slate-400">Auto-Generiert</span>
                    </div>
                    <select
                      value={mapping.documentNumber || ''}
                      onChange={(e) => setMapping({ ...mapping, documentNumber: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Automatisch vergeben (BE-2025-...) --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">z.B. BE-2025-001 oder RE-8849</p>
                  </div>

                  {/* Field 6: Sphere */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Steuerliche Sphäre</label>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">SKR 42</span>
                    </div>
                    <select
                      value={mapping.sphere || ''}
                      onChange={(e) => setMapping({ ...mapping, sphere: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Automatisch erkennen / Standard --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Ideell, Vermögen, Zweckbetrieb, WGB</p>
                  </div>

                  {/* Field 7: Main Category */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Nummernkreis / Kontoname</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.category || ''}
                      onChange={(e) => setMapping({ ...mapping, category: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Automatisch erkennen --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Nur genutzt, wenn keine SKR-Nummer da ist (genauer Kontoname)</p>
                  </div>

                  {/* Field 8: Sub Category (SKR 42 Konto) */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">SKR-42-Konto</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.subCategory || ''}
                      onChange={(e) => setMapping({ ...mapping, subCategory: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Automatisch zuordnen --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Kontonummer, z. B. 40000, 40450, 43150 (sonst Vorschlag aus früheren Buchungen)</p>
                  </div>

                  {/* Field 9: Account */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Konto / Kasse</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.account || ''}
                      onChange={(e) => setMapping({ ...mapping, account: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Standard-Konto verwenden --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Bankname, Girokonto, Kasse</p>
                  </div>

                  {/* Field 10: Tax Rate */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">MwSt-Satz (%)</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.vatRate || ''}
                      onChange={(e) => setMapping({ ...mapping, vatRate: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Standard verwenden (0%) --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">0, 7 oder 19 %</p>
                  </div>

                  {/* Field 11: Notes */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-100">Notizen / Kommentar</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <select
                      value={mapping.notes || ''}
                      onChange={(e) => setMapping({ ...mapping, notes: e.target.value || undefined })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h} {rawRows[0]?.[h] ? `("${rawRows[0][h]}")` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Interne Bemerkungen</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: PREVIEW, VALIDATION & CONFIRMATION TABLE          */}
          {/* ======================================================== */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Top Summary Dashboard KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Count */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ausgewählt</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-1 dark:text-white">
                      {previewStats.count} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">von {parsedList.length}</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl dark:bg-blue-950/40 dark:text-blue-400">
                    <Table className="w-5 h-5" />
                  </div>
                </div>

                {/* Incomes */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Gesamteinnahmen</span>
                    <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 dark:text-emerald-400">
                      +{previewStats.incomeSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl dark:bg-emerald-950/40 dark:text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                {/* Expenses */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Gesamtausgaben</span>
                    <div className="text-2xl font-bold font-mono text-rose-600 mt-1 dark:text-rose-400">
                      -{previewStats.expenseSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl dark:bg-rose-950/40 dark:text-rose-400">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>

                {/* Net Saldo */}
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Import-Saldo</span>
                    <div className={`text-2xl font-bold font-mono mt-1 ${previewStats.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {previewStats.netBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl">
                    <Scale className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Table Toolbar & Search */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchPreview}
                    onChange={(e) => setSearchPreview(e.target.value)}
                    placeholder="Buchungstext, Beleg-Nr., Partner suchen..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-white dark:focus:bg-slate-800"
                  />
                </div>

                {/* Filter Selector */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterPreviewStatus === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Alle ({parsedList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterPreviewStatus === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40'
                    }`}
                  >
                    Gültig ({parsedList.filter(p => !p.isDuplicate && !p.hasWarnings && p.fehler.length === 0).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('duplicates')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterPreviewStatus === 'duplicates'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40'
                    }`}
                  >
                    Duplikate ({parsedList.filter(p => p.isDuplicate).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('warnings')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterPreviewStatus === 'warnings'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/40'
                    }`}
                  >
                    Hinweise ({parsedList.filter(p => p.hasWarnings).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('fehler')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filterPreviewStatus === 'fehler'
                        ? 'bg-rose-700 text-white'
                        : 'bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:bg-rose-900/60'
                    }`}
                  >
                    Fehler ({fehlerAnzahl})
                  </button>
                </div>

                {/* Bulk selection toggle */}
                <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-xs text-emerald-700 hover:underline font-semibold dark:text-emerald-300"
                  >
                    Alle markieren
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-xs text-slate-500 hover:underline font-semibold dark:text-slate-400"
                  >
                    Alle abwählen
                  </button>
                </div>
              </div>

              {/* Konto für mehrere Zeilen zugleich (D-69) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Konto (SKR 42) für alle angehakten Zeilen:</span>
                <SkrKontoAuswahl
                  value={sammelKonto}
                  skr={skr}
                  onChange={code => { setSammelKonto(code); setSammelHinweis(null); }}
                  leerText="– Konto wählen –"
                  className="px-2 py-1 border border-slate-200 rounded-md text-xs bg-white max-w-xs dark:bg-slate-800 dark:border-slate-800"
                />
                <button
                  type="button"
                  disabled={!sammelKonto}
                  onClick={setzeSammelKonto}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  Setzen
                </button>
                {sammelHinweis && <span className="text-slate-600 dark:text-slate-300">{sammelHinweis}</span>}
                {fehlerAnzahl > 0 && (
                  <span className="text-rose-700 font-semibold dark:text-rose-300">
                    {fehlerAnzahl} Zeile(n) mit Fehler werden erst nach der Berichtigung übernommen.
                  </span>
                )}
              </div>

              {/* Interactive Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:bg-slate-800 dark:border-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.length > 0 && selectedRows.length === parsedList.length - fehlerAnzahl}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer dark:border-slate-700 dark:text-emerald-400"
                          />
                        </th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Datum</th>
                        <th className="p-3">Beleg-Nr.</th>
                        <th className="p-3">Partner / Buchungstext</th>
                        <th className="p-3">Art</th>
                        <th className="p-3 text-right">Betrag (€)</th>
                        <th className="p-3">Sphäre</th>
                        <th className="p-3">Konto (SKR 42)</th>
                        <th className="p-3">Finanzkonto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans dark:divide-slate-800">
                      {filteredPreview.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400">
                            Keine Buchungen für den aktuellen Filter gefunden.
                          </td>
                        </tr>
                      ) : (
                        filteredPreview.map((item) => {
                          const tx = item.transaction;
                          const isIncome = tx.type !== 'expense';

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                item.selected
                                  ? item.isDuplicate
                                    ? 'bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70'
                                    : 'bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/80'
                                  : 'bg-slate-50/60 opacity-60 hover:opacity-100 dark:bg-slate-800/60'
                              }`}
                            >
                              {/* Selection checkbox */}
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  disabled={item.fehler.length > 0}
                                  title={item.fehler.length > 0 ? 'Erst den Fehler berichtigen' : undefined}
                                  onChange={() => toggleRow(item.id)}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer dark:border-slate-700 dark:text-emerald-400"
                                />
                              </td>

                              {/* Status Badge */}
                              <td className="p-3 whitespace-nowrap">
                                {item.fehler.length > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800/60"
                                    title={[...item.fehler, ...item.warnings].join('; ')}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    Fehler
                                  </span>
                                ) : item.isDuplicate ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800/60"
                                    title={item.warnings.join('; ')}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    Duplikat?
                                  </span>
                                ) : item.hasWarnings ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-800/60"
                                    title={item.warnings.join('; ')}
                                  >
                                    <Info className="w-3 h-3" />
                                    Hinweis
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800/60">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Gültig
                                  </span>
                                )}
                              </td>

                              {/* Date */}
                              <td className="p-3 whitespace-nowrap">
                                <input
                                  type="date"
                                  value={tx.date}
                                  onChange={(e) => updateRowDate(item.id, e.target.value)}
                                  className={`text-xs font-mono px-1.5 py-1 border rounded-md bg-white dark:bg-slate-800 ${tx.date ? 'border-slate-200 dark:border-slate-800' : 'border-rose-500'}`}
                                />
                              </td>

                              {/* Document Number */}
                              <td className="p-3 whitespace-nowrap font-mono font-bold text-slate-700 dark:text-slate-200">
                                {tx.documentNumber}
                              </td>

                              {/* Partner & Booking text */}
                              <td className="p-3 max-w-xs">
                                <div className="font-bold text-slate-900 truncate dark:text-white" title={tx.partner}>
                                  {tx.partner}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate dark:text-slate-400" title={tx.bookingText}>
                                  {tx.bookingText}
                                </div>
                                {item.fehler.map(f => (
                                  <div key={f} className="text-[11px] text-rose-600 font-semibold whitespace-normal dark:text-rose-400">{f}</div>
                                ))}
                                {item.warnings.map(w => (
                                  <div key={w} className="text-[11px] text-amber-700 whitespace-normal dark:text-amber-300">{w}</div>
                                ))}
                              </td>

                              {/* Transaction Type Selector / Toggle */}
                              <td className="p-3 whitespace-nowrap">
                                <select
                                  value={tx.type}
                                  onChange={(e) => updateRowType(item.id, e.target.value as 'income' | 'expense' | 'transfer')}
                                  className={`text-2xs font-bold px-2 py-1 rounded-md border focus:outline-none cursor-pointer ${
                                    tx.type === 'income'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200'
                                      : tx.type === 'expense'
                                      ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200'
                                      : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-200'
                                  }`}
                                >
                                  <option value="income">Einnahme</option>
                                  <option value="expense">Ausgabe</option>
                                  <option value="transfer">Umbuchung</option>
                                </select>
                              </td>

                              {/* Amount */}
                              <td className="p-3 text-right whitespace-nowrap">
                                <span
                                  className={`font-bold font-mono text-sm ${
                                    isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isIncome ? '+' : ''}
                                  {tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                              </td>

                              {/* Sphere Selector */}
                              <td className="p-3 whitespace-nowrap">
                                <select
                                  value={tx.sphere}
                                  onChange={(e) => updateRowSphere(item.id, e.target.value as TaxSphere)}
                                  className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                                >
                                  <option value="ideell">1. Ideell</option>
                                  <option value="vermoegen">2. Vermögen</option>
                                  <option value="zweckbetrieb">3. Zweckbetrieb</option>
                                  <option value="wirtschaftlich">4. Wirtschaftl.</option>
                                </select>
                              </td>

                              {/* Konto des Kontenrahmens (D-69) */}
                              <td className="p-3 max-w-[240px]">
                                {tx.type === 'transfer' ? (
                                  <span className="text-[11px] text-slate-400">Umbuchung – kein Konto</span>
                                ) : (
                                  <>
                                    <SkrKontoAuswahl
                                      value={tx.skrAccount || ''}
                                      typ={tx.type}
                                      skr={skr}
                                      onChange={(code) => updateRowKonto(item.id, code)}
                                      className={`w-full text-[11px] px-1.5 py-0.5 bg-white border rounded text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-100 ${tx.skrAccount ? 'border-slate-200 dark:border-slate-800' : 'border-amber-400'}`}
                                    />
                                    <div className="text-[10px] text-slate-500 mt-0.5 dark:text-slate-400">
                                      USt {tx.vatRate} %{item.kontoVorschlag ? ' · aus früherer Buchung' : ''}
                                    </div>
                                  </>
                                )}
                              </td>

                              {/* Account */}
                              <td className="p-3 whitespace-nowrap">
                                <select
                                  value={tx.accountId}
                                  onChange={(e) => updateRowAccount(item.id, e.target.value)}
                                  className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                                >
                                  {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-200"
              >
                ← Zurück zu Schritt {step - 1}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors dark:border-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              Abbrechen
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={activeInputMode === 'paste' && !pastedText.trim()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <span>Weiter zur Spaltenzuordnung</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedToPreview}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <span>Vorschau & Prüfung laden ({rawRows.length} Zeilen)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={selectedRows.length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{selectedRows.length} Buchungen jetzt importieren</span>
              </button>
            )}
          </div>
        </div>

      </VeraenderbaresFenster>
    </div>
  );
};
