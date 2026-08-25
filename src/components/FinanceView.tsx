import React, { useState, useMemo } from 'react';
import {
  Transaction,
  FinancialAccount,
  ClubSettings,
  TaxSphere,
  ReceiptAttachment
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import { ExportService } from '../services/exportService';
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
  Camera
} from 'lucide-react';

interface FinanceViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
  onOpenCreateTx: () => void;
  onOpenEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onOpenBankImport: () => void;
  onOpenTransactionImport?: () => void;
  onOpenReceiptScanner?: () => void;
  onQuickScanReceipt?: (tx: Transaction) => void;
  onOpenAccountManage: () => void;
  onOpenReceiptViewer: (receipt: ReceiptAttachment, docNum: string, text: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  accounts,
  settings,
  onOpenCreateTx,
  onOpenEditTx,
  onDeleteTx,
  onOpenBankImport,
  onOpenTransactionImport,
  onOpenReceiptScanner,
  onQuickScanReceipt,
  onOpenAccountManage,
  onOpenReceiptViewer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedSphere, setSelectedSphere] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [receiptFilter, setReceiptFilter] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

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

  const handleExportCSV = () => {
    ExportService.exportTransactionsCSV(filteredTransactions, accounts, `buchungen_${settings.clubName.replace(/\s/g, '_')}.csv`);
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

  const accMap = useMemo(() => new Map<string, FinancialAccount>(accounts.map(a => [a.id, a])), [accounts]);

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
            <span className="text-[11px] text-slate-400">Über {accounts.length} Konten & Barkassen</span>
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

        {/* Individual Account Cards */}
        {accounts.map(acc => {
          const balance = accountBalances[acc.id] ?? acc.initialBalance;
          const isSelected = selectedAccountId === acc.id;
          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccountId(isSelected ? 'all' : acc.id)}
              className={`p-5 rounded-xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700">
                    {acc.accountType === 'cash' ? <Coins className="w-4 h-4 text-amber-600" /> : <Building2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">{acc.name}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">
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
                <th className="px-4 py-3 w-28">Datum</th>
                <th className="px-4 py-3 w-28">Beleg-Nr.</th>
                <th className="px-4 py-3">Zahlungspartner & Buchungstext</th>
                <th className="px-4 py-3">Steuer-Sphäre</th>
                <th className="px-4 py-3">Kategorie / Konto</th>
                <th className="px-4 py-3 text-center">Beleg</th>
                <th className="px-4 py-3 text-right">Betrag (€)</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const acc = accMap.get(tx.accountId);
                const isIncome = tx.amount >= 0;

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap text-xs">
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap text-xs">
                      {tx.documentNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 text-xs truncate max-w-xs">
                        {tx.partner}
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
                          onClick={() => onOpenReceiptViewer(tx.receipt!, tx.documentNumber, tx.bookingText)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-semibold text-2xs transition-colors"
                          title="Beleg anzeigen (PDF/Bild)"
                        >
                          <Paperclip className="w-3 h-3" />
                          Beleg
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickScanReceipt ? onQuickScanReceipt(tx) : onOpenEditTx(tx)}
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
                          onClick={() => onOpenEditTx(tx)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Buchung bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
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

              {filteredTransactions.length === 0 && (
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
          Zeige {filteredTransactions.length} von {transactions.length} Buchungen
        </div>
      </section>
    </div>
  );
};
