import React, { useState, useMemo, useEffect } from 'react';
import {
  Transaction,
  FinancialAccount,
  ClubSettings,
  TaxSphere,
  ReceiptAttachment,
  ClubContact
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import { ExportService } from '../services/exportService';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import {
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  Coins,
  Paperclip,
  Upload,
  FileText,
  Trash2,
  Edit2,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  Camera,
  UserPlus,
  UserCheck,
  GripVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export type TransactionSortField =
  | 'date'
  | 'documentNumber'
  | 'partner'
  | 'sphere'
  | 'category'
  | 'receipt'
  | 'amount';

interface FinanceViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
  contacts?: ClubContact[];
  onOpenCreateContactFromTx?: (partnerName: string, isIncome: boolean) => void;
  onOpenCreateTx: () => void;
  onOpenEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onOpenBankImport: () => void;
  onOpenTransactionImport?: () => void;
  onOpenReceiptScanner?: () => void;
  onQuickScanReceipt?: (tx: Transaction) => void;
  onOpenAccountManage: () => void;
  onOpenReceiptViewer: (receipt: ReceiptAttachment, docNum: string, text: string) => void;
  onReorderAccounts?: (accounts: FinancialAccount[]) => void;
  onOpenDetailsTx?: (tx: Transaction) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  accounts,
  settings,
  contacts = [],
  onOpenCreateContactFromTx,
  onOpenCreateTx,
  onOpenEditTx,
  onDeleteTx,
  onOpenBankImport,
  onOpenTransactionImport,
  onOpenReceiptScanner,
  onQuickScanReceipt,
  onOpenAccountManage,
  onOpenReceiptViewer,
  onReorderAccounts,
  onOpenDetailsTx
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedSphere, setSelectedSphere] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [receiptFilter, setReceiptFilter] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Accounts ordering state & Drag and Drop
  const [localAccounts, setLocalAccounts] = useState<FinancialAccount[]>(accounts);
  const [draggedAccountIndex, setDraggedAccountIndex] = useState<number | null>(null);
  const [dragOverAccountIndex, setDragOverAccountIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalAccounts(accounts);
  }, [accounts]);

  const handleAccountDragStart = (e: React.DragEvent, index: number) => {
    setDraggedAccountIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `account_${index}`);
  };

  const handleAccountDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedAccountIndex !== null && draggedAccountIndex !== index) {
      setDragOverAccountIndex(index);
    }
  };

  const handleAccountDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedAccountIndex === null || draggedAccountIndex === targetIndex) {
      setDraggedAccountIndex(null);
      setDragOverAccountIndex(null);
      return;
    }
    const next = [...localAccounts];
    const [moved] = next.splice(draggedAccountIndex, 1);
    next.splice(targetIndex, 0, moved);
    setLocalAccounts(next);
    setDraggedAccountIndex(null);
    setDragOverAccountIndex(null);
    if (onReorderAccounts) {
      onReorderAccounts(next);
    }
  };

  const handleAccountDragEnd = () => {
    setDraggedAccountIndex(null);
    setDragOverAccountIndex(null);
  };

  // Sorting state
  const [sortField, setSortField] = useState<TransactionSortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: TransactionSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  };

  // Transaction details modal state
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);

  const handleRowClick = (tx: Transaction) => {
    if (onOpenDetailsTx) {
      onOpenDetailsTx(tx);
    }
    setSelectedDetailTx(tx);
  };

  // Compute live balance for each account
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      balances[acc.id] = acc.initialBalance || 0;
    });

    transactions.forEach(tx => {
      if (tx.type === 'transfer' && tx.targetAccountId) {
        // Internal transfer: subtract from source, add to target
        if (balances[tx.accountId] !== undefined) {
          balances[tx.accountId] -= Math.abs(tx.amount);
        }
        if (balances[tx.targetAccountId] !== undefined) {
          balances[tx.targetAccountId] += Math.abs(tx.amount);
        }
      } else {
        if (balances[tx.accountId] !== undefined) {
          balances[tx.accountId] += tx.amount;
        }
      }
    });

    return balances;
  }, [accounts, transactions]);

  const totalLiquidAssets = (Object.values(accountBalances) as number[]).reduce((sum: number, b: number) => sum + b, 0);

  // Available Years
  const years = Array.from(new Set(transactions.map(t => t.date.substring(0, 4)))).sort().reverse();

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          t.documentNumber.toLowerCase().includes(q) ||
          t.bookingText.toLowerCase().includes(q) ||
          t.partner.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId && t.targetAccountId !== selectedAccountId) {
        return false;
      }

      if (selectedSphere !== 'all' && t.sphere !== selectedSphere) {
        return false;
      }

      if (selectedType !== 'all') {
        if (selectedType === 'income' && t.amount < 0) return false;
        if (selectedType === 'expense' && t.amount >= 0) return false;
        if (selectedType === 'transfer' && t.type !== 'transfer') return false;
      }

      if (receiptFilter === 'has_receipt' && !t.receipt) return false;
      if (receiptFilter === 'no_receipt' && t.receipt) return false;

      if (selectedYear !== 'all' && !t.date.startsWith(selectedYear)) return false;

      return true;
    });
  }, [transactions, searchQuery, selectedAccountId, selectedSphere, selectedType, receiptFilter, selectedYear]);

  const accMap = useMemo(() => new Map<string, FinancialAccount>(accounts.map(a => [a.id, a])), [accounts]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'documentNumber':
          comparison = (a.documentNumber || '').localeCompare(b.documentNumber || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          });
          break;
        case 'partner': {
          const textA = `${a.partner || ''} ${a.bookingText || ''}`.toLowerCase();
          const textB = `${b.partner || ''} ${b.bookingText || ''}`.toLowerCase();
          comparison = textA.localeCompare(textB);
          break;
        }
        case 'sphere':
          comparison = (a.sphere || '').localeCompare(b.sphere || '');
          break;
        case 'category': {
          const catA = `${a.category || ''} ${accMap.get(a.accountId)?.name || ''}`.toLowerCase();
          const catB = `${b.category || ''} ${accMap.get(b.accountId)?.name || ''}`.toLowerCase();
          comparison = catA.localeCompare(catB);
          break;
        }
        case 'receipt':
          comparison = (a.receipt ? 1 : 0) - (b.receipt ? 1 : 0);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortDirection, accMap]);

  const handleExportCSV = () => {
    ExportService.exportTransactionsCSV(sortedTransactions, accounts, `buchungen_${settings.clubName.replace(/\s/g, '_')}.csv`);
  };

  const getSphereBadge = (sphere: TaxSphere) => {
    const info = TAX_SPHERES[sphere];
    if (!info) return null;

    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (sphere === 'vermoegen') badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (sphere === 'zweckbetrieb') badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    if (sphere === 'wirtschaftlich') badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-3xs font-semibold border ${badgeClass}`}>
        {info.name.split('.')[1]}
      </span>
    );
  };

  const renderSortIndicator = (field: TransactionSortField) => {
    const isActive = sortField === field;
    return (
      <span
        className={`inline-flex items-center text-xs ml-1 transition-colors ${
          isActive ? 'text-blue-600 font-bold' : 'text-slate-300 opacity-60 group-hover/th:opacity-100'
        }`}
      >
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Assets Card */}
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Gesamt-Liquidität</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-emerald-400">
              {totalLiquidAssets.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <span className="text-[11px] text-slate-400">Über {localAccounts.length} Konten & Barkassen (Drag & Drop sortierbar)</span>
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Finanzstatus</span>
            <button
              type="button"
              onClick={onOpenAccountManage}
              className="text-blue-400 hover:underline font-semibold text-xs"
            >
              Konten verwalten →
            </button>
          </div>
        </div>

        {/* Individual Account Cards with Drag & Drop */}
        {localAccounts.map((acc, index) => {
          const balance = accountBalances[acc.id] ?? acc.initialBalance;
          const isSelected = selectedAccountId === acc.id;
          const isDragging = draggedAccountIndex === index;
          const isDragOver = dragOverAccountIndex === index;

          return (
            <div
              key={acc.id}
              draggable
              onDragStart={e => handleAccountDragStart(e, index)}
              onDragOver={e => handleAccountDragOver(e, index)}
              onDragEnter={e => {
                e.preventDefault();
                if (draggedAccountIndex !== null && draggedAccountIndex !== index) {
                  setDragOverAccountIndex(index);
                }
              }}
              onDrop={e => handleAccountDrop(e, index)}
              onDragEnd={handleAccountDragEnd}
              onClick={() => {
                if (draggedAccountIndex === null) {
                  setSelectedAccountId(isSelected ? 'all' : acc.id);
                }
              }}
              className={`p-5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between relative group select-none ${
                isDragging
                  ? 'opacity-40 border-dashed border-blue-500 bg-blue-50/50 scale-[0.98]'
                  : isDragOver
                  ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/80 scale-[1.02]'
                  : isSelected
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 group-hover:text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                    title="Konto per Drag & Drop verschieben"
                  >
                    <GripVertical className="w-4 h-4 pointer-events-none" />
                  </div>
                  <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
                    {acc.accountType === 'cash' ? <Coins className="w-4 h-4 text-amber-600" /> : <Building2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]" title={acc.name}>{acc.name}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase shrink-0">
                  {acc.accountType === 'cash' ? 'Kasse' : 'Bank'}
                </span>
              </div>

              <div className="my-2">
                <div className={`text-2xl font-bold font-mono ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  {balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
                {acc.iban && (
                  <p className="text-[11px] font-mono text-slate-400 truncate">...{acc.iban.slice(-8)}</p>
                )}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Start: {acc.initialBalance.toFixed(0)} €</span>
                <span className="font-semibold text-blue-600">{isSelected ? 'Aktiv gefiltert' : 'Klick: Filtern'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Journal Container */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Header toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">
              Buchungsjournal & Belege
            </h4>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {filteredTransactions.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              title="Buchungsjournal als CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Journal</span>
            </button>

            {onOpenTransactionImport && (
              <button
                type="button"
                onClick={onOpenTransactionImport}
                className="text-xs bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs"
                title="Buchungen direkt aus Excel oder Google Sheets importieren"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel / Sheets Import</span>
              </button>
            )}

            {onOpenReceiptScanner && (
              <button
                type="button"
                onClick={onOpenReceiptScanner}
                className="text-xs bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs"
                title="Physische Belege & Rechnungen mit Kamera scannen & als PDF digitalisieren"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Beleg scannen</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenBankImport}
              className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-xs"
              title="Kontoauszug direkt aus Bank-CSV importieren"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bank-Umsätze</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateTx}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Buchung</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buchungstext, Beleg-Nr., Partner, Kategorie suchen..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Alle Konten & Kassen</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Sphere Filter */}
          <select
            value={selectedSphere}
            onChange={e => setSelectedSphere(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Alle Steuer-Sphären</option>
            <option value="ideell">1. Ideeller Bereich</option>
            <option value="vermoegen">2. Vermögensverwaltung</option>
            <option value="zweckbetrieb">3. Zweckbetrieb</option>
            <option value="wirtschaftlich">4. Wirtschaftl. Geschäftsbetrieb</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Alle Buchungsarten</option>
            <option value="income">🟢 Nur Einnahmen</option>
            <option value="expense">🔴 Nur Ausgaben</option>
            <option value="transfer">🔄 Nur Umbuchungen</option>
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Alle Jahre</option>
            {years.map(yr => (
              <option key={yr} value={yr}>Jahr {yr}</option>
            ))}
          </select>

          {/* Receipt Filter */}
          <select
            value={receiptFilter}
            onChange={e => setReceiptFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Alle Beleg-Status</option>
            <option value="has_receipt">📎 Nur mit Beleg</option>
            <option value="no_receipt">⚠️ Ohne Beleg</option>
          </select>

          {(selectedAccountId !== 'all' || selectedSphere !== 'all' || selectedType !== 'all' || receiptFilter !== 'all' || selectedYear !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedAccountId('all');
                setSelectedSphere('all');
                setSelectedType('all');
                setReceiptFilter('all');
                setSelectedYear('all');
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* Transactions Journal Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 w-28 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Datum sortieren"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Datum</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('documentNumber')}
                  className="px-4 py-3 w-28 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Belegnummer sortieren"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Beleg-Nr.</span>
                    {renderSortIndicator('documentNumber')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('partner')}
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Zahlungspartner & Buchungstext sortieren"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Zahlungspartner & Buchungstext</span>
                    {renderSortIndicator('partner')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sphere')}
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Steuer-Sphäre sortieren"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Steuer-Sphäre</span>
                    {renderSortIndicator('sphere')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Kategorie / Konto sortieren"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Kategorie / Konto</span>
                    {renderSortIndicator('category')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('receipt')}
                  className="px-4 py-3 text-center cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Beleg (vorhanden / fehlend) sortieren"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Beleg</span>
                    {renderSortIndicator('receipt')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-100 hover:text-slate-900 transition-colors group/th"
                  title="Nach Betrag sortieren"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>Betrag (€)</span>
                    {renderSortIndicator('amount')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTransactions.map((tx) => {
                const acc = accMap.get(tx.accountId);
                const isIncome = tx.amount >= 0;

                return (
                  <tr
                    key={tx.id}
                    onClick={() => handleRowClick(tx)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    title="Klicken für vollständige Beleg- & Buchungsdetails"
                  >
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap text-xs">
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap text-xs">
                      {tx.documentNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-xs">
                          {tx.partner}
                        </span>
                        {(() => {
                          if (!tx.partner || tx.type === 'transfer') return null;
                          const trimmed = tx.partner.trim().toLowerCase();
                          const existingContact = contacts.find(
                            c =>
                              (c.displayName || '').trim().toLowerCase() === trimmed ||
                              (c.companyName || '').trim().toLowerCase() === trimmed
                          );

                          if (existingContact) {
                            return (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-3xs font-medium bg-orange-50 text-orange-700 border border-orange-200/80 rounded"
                                title={`Gespeicherter Kontakt: ${existingContact.displayName}`}
                              >
                                <Building2 className="w-2.5 h-2.5" />
                                <span>Kontakt</span>
                              </span>
                            );
                          }

                          if (onOpenCreateContactFromTx) {
                            return (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onOpenCreateContactFromTx(tx.partner, tx.type === 'income');
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-3xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer"
                                title={`»${tx.partner}« ist noch nicht als Kontakt erfasst. Klicken zum Anlegen.`}
                              >
                                <UserPlus className="w-2.5 h-2.5 text-amber-600" />
                                <span>+ Kontakt</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-2xs text-slate-500 truncate max-w-md">
                        {tx.bookingText}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getSphereBadge(tx.sphere)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
                        {tx.category}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span>{acc?.name || tx.accountId}</span>
                        {tx.vatRate > 0 && <span className="text-slate-500 font-mono">({tx.vatRate}% USt)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.receipt ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenReceiptViewer(tx.receipt!, tx.documentNumber, tx.bookingText);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-semibold text-2xs transition-colors"
                          title="Beleg anzeigen (PDF/Bild)"
                        >
                          <Paperclip className="w-3 h-3" />
                          Beleg
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (onQuickScanReceipt) {
                              onQuickScanReceipt(tx);
                            } else {
                              onOpenEditTx(tx);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded text-2xs transition-colors border border-dashed border-slate-200 hover:border-emerald-300"
                          title="Beleg mit Kamera scannen & verknüpfen"
                        >
                          <Camera className="w-2.5 h-2.5 text-emerald-600" />
                          <span className="text-[10px]">Scannen</span>
                        </button>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold text-xs whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isIncome ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenEditTx(tx);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Buchung bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (window.confirm(`Buchung ${tx.documentNumber} (${tx.bookingText}) wirklich löschen?`)) {
                              onDeleteTx(tx.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    Keine Buchungen für die aktuellen Filterkriterien vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
          Zeige {sortedTransactions.length} von {transactions.length} Buchungen
        </div>
      </section>

      {/* Transaction Details Modal */}
      {selectedDetailTx && (
        <TransactionDetailsModal
          isOpen={!!selectedDetailTx}
          transaction={selectedDetailTx}
          accounts={accounts}
          settings={settings}
          contacts={contacts}
          onClose={() => setSelectedDetailTx(null)}
          onEdit={tx => {
            setSelectedDetailTx(null);
            onOpenEditTx(tx);
          }}
          onDelete={id => {
            setSelectedDetailTx(null);
            onDeleteTx(id);
          }}
          onOpenReceiptViewer={onOpenReceiptViewer}
          onQuickScanReceipt={
            onQuickScanReceipt
              ? tx => {
                  setSelectedDetailTx(null);
                  onQuickScanReceipt(tx);
                }
              : undefined
          }
          onOpenCreateContactFromTx={onOpenCreateContactFromTx}
        />
      )}
    </div>
  );
};
