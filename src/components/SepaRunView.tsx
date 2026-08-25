import React, { useState, useMemo, useEffect } from 'react';
import {
  Member,
  ClubSettings,
  FinancialAccount,
  SepaPeriodFilter,
  SepaCollectionItem,
  SepaRunConfig,
  SepaRunHistory
} from '../types';
import { SepaService } from '../services/sepaService';
import { StorageService } from '../services/storage';
import {
  CreditCard,
  Download,
  FileDown,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  History,
  ShieldCheck,
  FileCode,
  DollarSign,
  Users,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Trash2,
  ArrowRight,
  BookOpen,
  Eye,
  X
} from 'lucide-react';

interface SepaRunViewProps {
  members: Member[];
  settings: ClubSettings;
  accounts: FinancialAccount[];
  onOpenSettings: () => void;
  onRefreshData?: () => void;
}

export const SepaRunView: React.FC<SepaRunViewProps> = ({
  members,
  settings,
  accounts,
  onOpenSettings,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Config State
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const [periodFilter, setPeriodFilter] = useState<SepaPeriodFilter>('monthly_1');
  const [targetYear, setTargetYear] = useState<number>(currentYear);
  const [targetMonth, setTargetMonth] = useState<number>(currentMonth);
  const [targetQuarter, setTargetQuarter] = useState<1 | 2 | 3 | 4>(
    Math.ceil(currentMonth / 3) as 1 | 2 | 3 | 4
  );
  
  // Default execution date: 5 banking days ahead
  const defaultExecDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  }, []);

  const [executionDate, setExecutionDate] = useState<string>(defaultExecDate);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [remittanceTemplate, setRemittanceTemplate] = useState<string>(
    'Mitgliedsbeitrag {month}/{year} - {memberNumber}'
  );

  // Collection Items State
  const [items, setItems] = useState<SepaCollectionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [validityFilter, setValidityFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // History State
  const [historyRuns, setHistoryRuns] = useState<SepaRunHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // XML Preview Modal State
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [generatedXmlContent, setGeneratedXmlContent] = useState<string>('');
  const [copiedXml, setCopiedXml] = useState(false);

  // Booking Modal State
  const [isBookingRunning, setIsBookingRunning] = useState(false);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState<string>(
    accounts[0]?.id || ''
  );
  const [lastExecutedRun, setLastExecutedRun] = useState<SepaRunHistory | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Calculate default run title
  const computedTitle = useMemo(() => {
    if (customTitle.trim()) return customTitle;
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    switch (periodFilter) {
      case 'monthly_1':
        return `Monatsbeitrag ${monthNames[targetMonth - 1]} ${targetYear} (1. d. M.)`;
      case 'monthly_15':
        return `Monatsbeitrag ${monthNames[targetMonth - 1]} ${targetYear} (15. d. M.)`;
      case 'monthly_all':
        return `Monatsbeitrag ${monthNames[targetMonth - 1]} ${targetYear} (Alle)`;
      case 'quarterly':
        return `Quartalsbeitrag Q${targetQuarter} ${targetYear}`;
      case 'half_yearly':
        return `Halbjahresbeitrag H${targetMonth <= 6 ? 1 : 2} ${targetYear}`;
      case 'yearly':
        return `Jahresbeitrag ${targetYear}`;
      case 'all':
      default:
        return `SEPA-Sammellastschrift ${monthNames[targetMonth - 1]} ${targetYear}`;
    }
  }, [customTitle, periodFilter, targetMonth, targetYear, targetQuarter]);

  // Re-generate collection items whenever criteria changes
  const refreshCollectionItems = () => {
    const config: Partial<SepaRunConfig> = {
      periodFilter,
      targetYear,
      targetMonth: periodFilter.startsWith('monthly') ? targetMonth : undefined,
      targetQuarter: periodFilter === 'quarterly' ? targetQuarter : undefined,
      executionDate,
      remittanceTemplate
    };

    const built = SepaService.buildCollectionItems(members, config);
    setItems(built);
  };

  useEffect(() => {
    refreshCollectionItems();
  }, [members, periodFilter, targetYear, targetMonth, targetQuarter, executionDate, remittanceTemplate]);

  // Load SEPA Runs history
  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const runs = await StorageService.getSepaRuns();
      setHistoryRuns(runs);
    } catch (err) {
      console.error('Failed to load SEPA runs history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filtered Items in UI Table
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search
      const matchSearch =
        item.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.memberNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.iban.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.accountHolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mandateReference.toLowerCase().includes(searchQuery.toLowerCase());

      // Department
      const matchDept = selectedDepartment === 'all' || item.department === selectedDepartment;

      // Validity
      const matchValidity =
        validityFilter === 'all' ||
        (validityFilter === 'valid' && item.isValid) ||
        (validityFilter === 'invalid' && !item.isValid);

      return matchSearch && matchDept && matchValidity;
    });
  }, [items, searchQuery, selectedDepartment, validityFilter]);

  // Aggregated Stats
  const stats = useMemo(() => {
    const totalCount = items.length;
    const selectedItems = items.filter(i => i.selected);
    const validSelected = selectedItems.filter(i => i.isValid);
    const invalidCount = items.filter(i => !i.isValid).length;

    const totalSelectedAmount = selectedItems.reduce((sum, i) => sum + i.amount, 0);
    const validSelectedAmount = validSelected.reduce((sum, i) => sum + i.amount, 0);

    return {
      totalCount,
      selectedCount: selectedItems.length,
      validSelectedCount: validSelected.length,
      invalidCount,
      totalSelectedAmount,
      validSelectedAmount
    };
  }, [items]);

  // Toggle selection
  const handleToggleSelectAll = (checked: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleToggleItem = (memberId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.memberId === memberId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdateItemAmount = (memberId: string, newAmount: number) => {
    setItems(prev =>
      prev.map(item =>
        item.memberId === memberId ? { ...item, amount: Math.max(0, newAmount) } : item
      )
    );
  };

  // Creditor check
  const isCreditorConfigured = Boolean(
    settings.creditorId &&
    settings.creditorIban &&
    settings.creditorIban.trim().length >= 15
  );

  // Helper to construct complete SepaRunConfig
  const getRunConfig = (): SepaRunConfig => ({
    runId: `sepa-run-${Date.now()}`,
    runTitle: computedTitle,
    periodFilter,
    targetYear,
    targetMonth,
    targetQuarter,
    executionDate,
    creditorId: settings.creditorId,
    creditorName: settings.clubName,
    creditorIban: settings.creditorIban || '',
    creditorBic: settings.creditorBic,
    remittanceTemplate,
    autoBook: false
  });

  // Generate XML and trigger download
  const handleGenerateAndDownloadXml = async () => {
    const validItems = items.filter(i => i.selected && i.isValid);
    if (validItems.length === 0) {
      alert('Keine gültigen Lastschriftposten ausgewählt.');
      return;
    }

    try {
      const runConfig = getRunConfig();
      const xml = SepaService.generateSepaXml(runConfig, validItems);
      const filename = `SEPA_${computedTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${executionDate}.xml`;

      // Trigger file download in browser
      SepaService.downloadSepaXmlFile(xml, filename);

      // Save to History Store
      const runRecord: SepaRunHistory = {
        id: `sepa-${Date.now()}`,
        title: computedTitle,
        periodFilter,
        targetYear,
        targetMonth: periodFilter.startsWith('monthly') ? targetMonth : undefined,
        executionDate,
        createdAt: new Date().toISOString(),
        totalAmount: stats.validSelectedAmount,
        totalTransactions: validItems.length,
        items: items,
        xmlContent: xml,
        isBooked: false
      };

      await StorageService.saveSepaRun(runRecord);
      setLastExecutedRun(runRecord);
      await loadHistory();

      setSuccessToast(`SEPA-XML "${filename}" erfolgreich generiert & heruntergeladen.`);
      setTimeout(() => setSuccessToast(null), 4500);
    } catch (err: any) {
      alert(`Fehler bei der SEPA-XML-Erstellung: ${err.message}`);
    }
  };

  // Preview XML Modal
  const handleOpenXmlPreview = () => {
    const validItems = items.filter(i => i.selected && i.isValid);
    if (validItems.length === 0) {
      alert('Bitte wählen Sie mindestens einen gültigen Posten aus.');
      return;
    }

    try {
      const runConfig = getRunConfig();
      const xml = SepaService.generateSepaXml(runConfig, validItems);
      setGeneratedXmlContent(xml);
      setXmlModalOpen(true);
    } catch (err: any) {
      alert(`Fehler bei der XML-Generierung: ${err.message}`);
    }
  };

  // Generate & Download Audit PDF Report
  const handleDownloadPdfReport = () => {
    const validItems = items.filter(i => i.selected && i.isValid);
    if (validItems.length === 0) {
      alert('Keine gültigen Lastschriften ausgewählt.');
      return;
    }

    try {
      const runConfig = getRunConfig();
      SepaService.exportSepaPdfReport(runConfig, validItems, settings);
    } catch (err: any) {
      alert(`Fehler beim PDF-Export: ${err.message}`);
    }
  };

  // Book SEPA run to Accounting
  const handleBookToLedger = async (run: SepaRunHistory) => {
    if (!selectedTargetAccountId) {
      alert('Bitte wählen Sie ein Vereinskonto für die Gutschrift aus.');
      return;
    }

    if (
      !window.confirm(
        `Möchten Sie ${run.totalTransactions} Lastschriften in Höhe von insgesamt €${run.totalAmount.toFixed(
          2
        )} jetzt als Einnahmen-Buchungen auf das gewählte Vereinskonto übertragen?`
      )
    ) {
      return;
    }

    try {
      setIsBookingRunning(true);
      const createdTxs = await StorageService.bookSepaRunTransactions(
        run,
        selectedTargetAccountId
      );
      await loadHistory();
      if (onRefreshData) onRefreshData();

      setSuccessToast(
        `Erfolgreich ${createdTxs.length} Buchungen für den Beitragslauf "${run.title}" verbucht!`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      alert(`Fehler beim automatischen Verbuchen: ${err.message}`);
    } finally {
      setIsBookingRunning(false);
    }
  };

  const handleDeleteHistoryRun = async (id: string) => {
    if (window.confirm('Diesen archivierten Beitragslauf aus der Historie entfernen?')) {
      await StorageService.deleteSepaRun(id);
      await loadHistory();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 relative pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-700 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                SEPA-Lastschrift & Beitragslauf
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                pain.008.001.02 Standard
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Erstellen Sie standardkonforme SEPA-XML-Dateien für das Online-Banking Ihrer Bank (Sparkasse, Volksbank, etc.)
            </p>
          </div>
        </div>

        {/* View Tab Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Neuer Beitragslauf</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historie & Protokolle ({historyRuns.length})</span>
          </button>
        </div>
      </div>

      {/* Warning banner if creditor settings are incomplete */}
      {!isCreditorConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Gläubigerdaten noch nicht vollständig hinterlegt
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Für die Generierung von bankfähigen SEPA-XML-Dateien benötigen Sie eine gültige <strong>Gläubiger-ID (CI)</strong> und die <strong>Vereins-IBAN</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Jetzt eintragen</span>
          </button>
        </div>
      )}

      {/* TAB 1: CREATE RUN */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Step 1: Interval & Configuration Matrix */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Zahlungsrhythmus & Fälligkeit wählen</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Monatliche Mitglieder wählen zw. 1. und 15.
              </span>
            </div>

            {/* Interval Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Monthly (1st) */}
              <button
                type="button"
                onClick={() => setPeriodFilter('monthly_1')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  periodFilter === 'monthly_1'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">Monatlich (1. d. M.)</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Einzug zum Monatsanfang (1. Kalendertag)
                </p>
                {periodFilter === 'monthly_1' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>

              {/* 2. Monthly (15th) */}
              <button
                type="button"
                onClick={() => setPeriodFilter('monthly_15')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  periodFilter === 'monthly_15'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">Monatlich (15. d. M.)</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Einzug zur Monatsmitte (15. Kalendertag)
                </p>
                {periodFilter === 'monthly_15' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>

              {/* 3. Quarterly */}
              <button
                type="button"
                onClick={() => setPeriodFilter('quarterly')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  periodFilter === 'quarterly'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">Vierteljährlich (Quartal)</span>
                  <Calendar className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Einzug für Q1, Q2, Q3 oder Q4
                </p>
                {periodFilter === 'quarterly' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>

              {/* 4. Yearly & others */}
              <button
                type="button"
                onClick={() => setPeriodFilter('yearly')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  periodFilter === 'yearly'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">Jährlich (Hauptlauf)</span>
                  <Calendar className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Jahresbeitrag für alle Vollzahler
                </p>
                {periodFilter === 'yearly' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>
            </div>

            {/* Additional Secondary Interval Options (Halbjährlich, Alle monatlichen, Alle) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-medium mr-1">Weitere Filter:</span>
              <button
                type="button"
                onClick={() => setPeriodFilter('half_yearly')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  periodFilter === 'half_yearly'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Halbjährlich
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('monthly_all')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  periodFilter === 'monthly_all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Alle monatlichen Zahler (1. & 15. kombiniert)
              </button>

              <button
                type="button"
                onClick={() => setPeriodFilter('all')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  periodFilter === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Alle SEPA-Mitglieder
              </button>
            </div>

            {/* Detailed Parameters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              {/* Year */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beitragsjahr *
                </label>
                <select
                  value={targetYear}
                  onChange={e => setTargetYear(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month or Quarter depending on filter */}
              {periodFilter.startsWith('monthly') ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Beitragsmonat *
                  </label>
                  <select
                    value={targetMonth}
                    onChange={e => setTargetMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {[
                      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
                    ].map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{idx + 1}. {m}</option>
                    ))}
                  </select>
                </div>
              ) : periodFilter === 'quarterly' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quartal *
                  </label>
                  <select
                    value={targetQuarter}
                    onChange={e => setTargetQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1. Quartal (Jan - Mär)</option>
                    <option value={2}>2. Quartal (Apr - Jun)</option>
                    <option value={3}>3. Quartal (Jul - Sep)</option>
                    <option value={4}>4. Quartal (Okt - Dez)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Zeitraum
                  </label>
                  <input
                    type="text"
                    disabled
                    value={periodFilter === 'yearly' ? `Gesamtjahr ${targetYear}` : `Halbjahr ${targetMonth <= 6 ? '1' : '2'} / ${targetYear}`}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-medium"
                  />
                </div>
              )}

              {/* Target Execution Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SEPA-Fälligkeitsdatum *
                </label>
                <input
                  type="date"
                  value={executionDate}
                  onChange={e => setExecutionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Remittance Info Template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verwendungszweck-Vorlage
                </label>
                <input
                  type="text"
                  value={remittanceTemplate}
                  onChange={e => setRemittanceTemplate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. Beitrag {month}/{year}"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Live Summary & Action Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Einzugssumme (Gültig)
              </p>
              <h3 className="text-3xl font-bold font-mono text-emerald-700">
                €{stats.validSelectedAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-slate-500 text-[11px] mt-2 font-medium">
                Aus {stats.validSelectedCount} ausgewählten Lastschriften
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Fällige Mitglieder
              </p>
              <h3 className="text-3xl font-bold font-mono text-slate-900">
                {items.length}
              </h3>
              <p className="text-blue-600 text-[11px] mt-2 font-medium">
                {stats.selectedCount} von {items.length} markiert
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Mandats- & IBAN-Status
              </p>
              <div className="flex items-center gap-2 mt-2">
                {stats.invalidCount === 0 ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Alle {items.length} Posten fehlerfrei</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{stats.invalidCount} fehlerhaft / unvollständig</span>
                  </div>
                )}
              </div>
              <p className="text-slate-400 text-[11px] mt-1">
                {stats.invalidCount > 0 ? 'Bitte IBANs korrigieren' : 'EPC / ISO 20022 validiert'}
              </p>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-800 p-5 rounded-2xl text-white shadow-md flex flex-col justify-between">
              <div>
                <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">
                  Beitragslauf ausführen
                </p>
                <div className="text-sm font-bold mt-1 truncate">
                  {computedTitle}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleGenerateAndDownloadXml}
                  disabled={stats.validSelectedCount === 0 || !isCreditorConfigured}
                  className="flex-1 bg-white hover:bg-blue-50 text-blue-900 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>XML herunterladen</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdfReport}
                  disabled={stats.validSelectedCount === 0}
                  className="bg-blue-800/80 hover:bg-blue-800 text-white p-2.5 rounded-xl text-xs font-bold transition-all border border-blue-600/50"
                  title="Prüfprotokoll (PDF) herunterladen"
                >
                  <FileDown className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenXmlPreview}
                  disabled={stats.validSelectedCount === 0 || !isCreditorConfigured}
                  className="bg-blue-800/80 hover:bg-blue-800 text-white p-2.5 rounded-xl text-xs font-bold transition-all border border-blue-600/50"
                  title="XML-Vorschau anzeigen"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Member List Table with Search & Filtering */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Control Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Mitglied, Nr., IBAN suchen..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedDepartment}
                  onChange={e => setSelectedDepartment(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Alle Sparten</option>
                  {settings.departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={validityFilter}
                  onChange={e => setValidityFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Alle Posten ({items.length})</option>
                  <option value="valid">Nur Gültige</option>
                  <option value="invalid">Nur Fehlerhafte</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="hover:text-blue-600 px-2 py-1 hover:bg-slate-200/60 rounded"
                >
                  Alle markieren
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="hover:text-blue-600 px-2 py-1 hover:bg-slate-200/60 rounded"
                >
                  Alle abwählen
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every(i => i.selected)}
                        onChange={e => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3 px-3">Mitglied</th>
                    <th className="py-3 px-3">Sparte</th>
                    <th className="py-3 px-3">Zahlungsweise & Fälligkeit</th>
                    <th className="py-3 px-3">IBAN & Mandat</th>
                    <th className="py-3 px-3 text-right">Betrag (€)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">Keine Mitglieder für diesen Filter gefunden</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Passen Sie den Zahlungsrhythmus oder die Suchfilter oben an.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => (
                      <tr
                        key={item.memberId}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          !item.selected ? 'opacity-50 bg-slate-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.memberId)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Member Name & Number */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.memberName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.memberNumber}
                            {item.accountHolder !== item.memberName && (
                              <span className="text-slate-500 block">
                                Inhaber: {item.accountHolder}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {item.department}
                          </span>
                        </td>

                        {/* Interval & Due Day */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">
                            {item.feePeriod === 'monthly' ? 'Monatlich' : item.feePeriod === 'quarterly' ? 'Quartal' : item.feePeriod === 'half_yearly' ? 'Halbjährlich' : 'Jährlich'}
                          </div>
                          {item.feePeriod === 'monthly' && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              Fällig am {item.monthlyDueDay}. des Monats
                            </span>
                          )}
                        </td>

                        {/* IBAN & Mandate */}
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-slate-800 text-[11px]">
                            {item.iban ? item.iban : <span className="text-rose-600 italic">Fehlt</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Ref: {item.mandateReference} ({item.mandateDate ? new Date(item.mandateDate).toLocaleDateString('de-DE') : 'Kein Datum'})
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={item.amount}
                            onChange={e => handleUpdateItemAmount(item.memberId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right font-mono font-bold text-slate-900 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </td>

                        {/* Validation Status */}
                        <td className="py-3 px-4 text-center">
                          {item.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Gültig
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800"
                              title={item.validationErrors.join(', ')}
                            >
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {item.validationErrors[0] || 'Ungültig'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 font-medium">
                Zeigt <strong>{filteredItems.length}</strong> von <strong>{items.length}</strong> Posten ({stats.validSelectedCount} zur Abbuchung markiert)
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-slate-900">
                  Gesamtsumme ausgewählt: €{stats.validSelectedAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY & ARCHIVE */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Archivierte SEPA-Beitragsläufe</h3>
                <p className="text-xs text-slate-500">
                  Historie aller exportierten Lastschriftdateien mit Wieder-Download und Buchhaltungs-Übernahme
                </p>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Aktualisieren"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {historyRuns.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-600" />
                <h4 className="font-bold text-slate-700 text-sm">Noch keine Beitragsläufe exportiert</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Sobald Sie Ihren ersten SEPA-Beitragslauf generieren, wird dieser hier mit Prüfprotokoll und XML-Archiv hinterlegt.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Ersten Beitragslauf starten
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {historyRuns.map(run => (
                  <div key={run.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-bold text-slate-900 text-sm">{run.title}</h4>
                        {run.isBooked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            In Buchhaltung verbucht
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                            XML exportiert
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                        <span>Erstellt: <strong>{new Date(run.createdAt).toLocaleString('de-DE')}</strong></span>
                        <span>•</span>
                        <span>Fälligkeit: <strong>{new Date(run.executionDate).toLocaleDateString('de-DE')}</strong></span>
                        <span>•</span>
                        <span>Posten: <strong>{run.totalTransactions} Lastschriften</strong></span>
                      </div>
                    </div>

                    {/* Right sum and actions */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono text-slate-900">
                          €{run.totalAmount.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Download XML */}
                        {run.xmlContent && (
                          <button
                            type="button"
                            onClick={() => SepaService.downloadSepaXmlFile(run.xmlContent!, `SEPA_${run.title.replace(/\s+/g, '_')}.xml`)}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                            title="SEPA-XML erneut herunterladen"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

                        {/* Download PDF */}
                        <button
                          type="button"
                          onClick={() => {
                            const validItems = run.items.filter(i => i.selected && i.isValid);
                            const histConfig: SepaRunConfig = {
                              runId: run.id,
                              runTitle: run.title,
                              periodFilter: run.periodFilter,
                              targetYear: run.targetYear,
                              targetMonth: run.targetMonth || 1,
                              executionDate: run.executionDate,
                              creditorId: settings.creditorId,
                              creditorName: settings.clubName,
                              creditorIban: settings.creditorIban || '',
                              creditorBic: settings.creditorBic,
                              remittanceTemplate: 'Mitgliedsbeitrag {PERIOD} {MEMBER_NO}',
                              autoBook: false
                            };
                            SepaService.exportSepaPdfReport(histConfig, validItems, settings);
                          }}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                          title="Protokoll (PDF) erneut herunterladen"
                        >
                          <FileDown className="w-4 h-4 text-blue-600" />
                        </button>

                        {/* Book into accounting if not booked yet */}
                        {!run.isBooked && (
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedTargetAccountId}
                              onChange={e => setSelectedTargetAccountId(e.target.value)}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                            >
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleBookToLedger(run)}
                              disabled={isBookingRunning}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Verbuchen</span>
                            </button>
                          </div>
                        )}

                        {/* Delete history record */}
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryRun(run.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Aus Historie löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* XML PREVIEW MODAL */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    SEPA-XML Vorschau (pain.008.001.02)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ISO 20022 XML-Dokument für {stats.validSelectedCount} Lastschriftposten
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedXmlContent);
                    setCopiedXml(true);
                    setTimeout(() => setCopiedXml(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedXml ? 'Kopiert!' : 'XML kopieren'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setXmlModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* XML Code Body */}
            <div className="p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-emerald-400 leading-relaxed max-h-[65vh] select-all">
              <pre>{generatedXmlContent}</pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Größe: <strong>{(new Blob([generatedXmlContent]).size / 1024).toFixed(1)} KB</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  SepaService.downloadSepaXmlFile(generatedXmlContent, `SEPA_${computedTitle.replace(/\s+/g, '_')}.xml`);
                  setXmlModalOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Herunterladen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
