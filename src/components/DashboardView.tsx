import React, { useMemo } from 'react';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  InventoryItem,
  TaxSphere
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import {
  Users,
  Wallet,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Plus,
  ArrowRight,
  AlertCircle,
  Building2,
  Package,
  Layers,
  Calendar,
  CheckCircle2,
  PieChart,
  Percent,
  Clock,
  Sparkles,
  Paperclip
} from 'lucide-react';

interface DashboardViewProps {
  members: Member[];
  transactions: Transaction[];
  accounts: FinancialAccount[];
  inventory: InventoryItem[];
  settings: ClubSettings;
  onNavigate: (tab: any) => void;
  onOpenCreateMember: () => void;
  onOpenCreateTx: () => void;
  onOpenCreateInventory: () => void;
  onOpenNewDocument?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  transactions,
  accounts,
  inventory,
  settings,
  onNavigate,
  onOpenCreateMember,
  onOpenCreateTx,
  onOpenCreateInventory,
  onOpenNewDocument
}) => {
  const currentYear = new Date().getFullYear().toString();

  // 1. Account Balances & Total Liquidity
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      balances[acc.id] = acc.initialBalance || 0;
    });

    transactions.forEach(tx => {
      if (tx.type === 'transfer' && tx.targetAccountId) {
        if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= Math.abs(tx.amount);
        if (balances[tx.targetAccountId] !== undefined) balances[tx.targetAccountId] += Math.abs(tx.amount);
      } else {
        if (balances[tx.accountId] !== undefined) balances[tx.accountId] += tx.amount;
      }
    });

    return balances;
  }, [accounts, transactions]);

  const totalLiquidity = useMemo(() => {
    return (Object.values(accountBalances) as number[]).reduce((sum: number, b: number) => sum + b, 0);
  }, [accountBalances]);

  // 2. Members KPI
  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const sepaMembers = useMemo(() => members.filter(m => m.paymentMethod === 'sepa' && m.status === 'active'), [members]);
  const missingSepaMandates = useMemo(() => {
    return members.filter(m => m.status === 'active' && m.paymentMethod === 'sepa' && (!m.bankDetails?.iban || !m.bankDetails?.mandateReference));
  }, [members]);

  // 3. Current Year Financials
  const currentYearTxs = useMemo(() => {
    return transactions.filter(t => t.type !== 'transfer' && t.date.startsWith(currentYear));
  }, [transactions, currentYear]);

  const { ytdIncome, ytdExpense, sphereStats, wgbIncome } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let wgbInc = 0;

    const spheres: Record<TaxSphere, { income: number; expense: number; net: number }> = {
      ideell: { income: 0, expense: 0, net: 0 },
      vermoegen: { income: 0, expense: 0, net: 0 },
      zweckbetrieb: { income: 0, expense: 0, net: 0 },
      wirtschaftlich: { income: 0, expense: 0, net: 0 }
    };

    currentYearTxs.forEach(t => {
      const sph = t.sphere || 'ideell';
      if (t.amount >= 0) {
        income += t.amount;
        spheres[sph].income += t.amount;
        if (sph === 'wirtschaftlich') wgbInc += t.amount;
      } else {
        const abs = Math.abs(t.amount);
        expense += abs;
        spheres[sph].expense += abs;
      }
      spheres[sph].net = spheres[sph].income - spheres[sph].expense;
    });

    return {
      ytdIncome: income,
      ytdExpense: expense,
      sphereStats: spheres,
      wgbIncome: wgbInc
    };
  }, [currentYearTxs]);

  const ytdNet = ytdIncome - ytdExpense;

  // 45.000 € Limit WGB
  const WGB_LIMIT = 45000.00;
  const wgbPercent = Math.min(100, (wgbIncome / WGB_LIMIT) * 100);
  const wgbBuffer = Math.max(0, WGB_LIMIT - wgbIncome);

  // 4. Inventory Value
  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
  }, [inventory]);

  // 5. Recent Transactions (last 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [transactions]);

  // 6. Departments breakdown
  const departmentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => {
      const dept = m.department || 'Allgemein';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [members]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & QUICK ACTIONS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-2xs font-bold uppercase tracking-wider">
              {settings.associationNumber || 'Eingetragener Verein (e.V.)'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Geschäftsjahr {currentYear} • SKR 42 Rechnungslegung
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {settings.clubName}
          </h1>
          <p className="text-xs text-slate-500">
            Zentrale Übersicht für Vorstand, Kassenwart & Abteilungsleiter
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="dashboard-btn-create-tx"
            type="button"
            onClick={onOpenCreateTx}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Buchung</span>
          </button>

          <button
            id="dashboard-btn-create-member"
            type="button"
            onClick={onOpenCreateMember}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Mitglied</span>
          </button>

          <button
            id="dashboard-btn-create-inventory"
            type="button"
            onClick={onOpenCreateInventory}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Material</span>
          </button>

          {onOpenNewDocument && (
            <button
              id="dashboard-btn-new-document"
              type="button"
              onClick={onOpenNewDocument}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Neues Dokument</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP METRIC TILES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Mitgliederbestand */}
        <div
          onClick={() => onNavigate('members')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Mitglieder</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {members.length}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="text-emerald-600 font-semibold">{activeMembers.length} aktiv</span>
            <span>{members.length - activeMembers.length} passiv/ruhend</span>
          </div>
        </div>

        {/* Card 2: Gesamtliquidität */}
        <div
          onClick={() => onNavigate('finance')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Liquidität</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600">
            {totalLiquidity.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>{accounts.length} Konten & Kassen</span>
            <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
              Journal <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Jahres-Saldo (EÜR YTD) */}
        <div
          onClick={() => onNavigate('guv')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Jahres-Saldo ({currentYear})</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-black font-mono ${ytdNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {ytdNet >= 0 ? '+' : ''}{ytdNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 pt-2 border-t border-slate-100 font-mono">
            <span className="text-emerald-600">+{ytdIncome.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
            <span className="text-rose-600">-{ytdExpense.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
          </div>
        </div>

        {/* Card 4: WGB 45.000 € Grenze */}
        <div
          onClick={() => onNavigate('guv')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">§ 64 AO Grenze</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {wgbPercent.toFixed(1)} % <span className="text-xs font-normal text-slate-500 font-sans">erreicht</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden my-2">
            <div
              className={`h-full rounded-full ${wgbPercent > 90 ? 'bg-rose-500' : wgbPercent > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(3, wgbPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="font-mono">{wgbIncome.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
            <span className="text-emerald-600 font-semibold">{wgbBuffer.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € Puffer</span>
          </div>
        </div>
      </div>

      {/* 3. MAIN SECTION: 4 SPHÄREN & SEPA BEITRAGSLAUF MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 4 Sphären Übersicht (SKR 42) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Steuerliche Sphären-Übersicht (SKR 42)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('guv')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ausführlicher EÜR-Bericht <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Aufteilung aller Einnahmen und Ausgaben nach den gesetzlichen Sphären des Gemeinnützigkeitsrechts:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map((sph) => {
              const info = TAX_SPHERES[sph];
              const stat = sphereStats[sph];

              let borderClr = 'border-emerald-200 bg-emerald-50/20';
              let badgeClr = 'bg-emerald-100 text-emerald-800';
              if (sph === 'vermoegen') {
                borderClr = 'border-blue-200 bg-blue-50/20';
                badgeClr = 'bg-blue-100 text-blue-800';
              }
              if (sph === 'zweckbetrieb') {
                borderClr = 'border-amber-200 bg-amber-50/20';
                badgeClr = 'bg-amber-100 text-amber-800';
              }
              if (sph === 'wirtschaftlich') {
                borderClr = 'border-rose-200 bg-rose-50/20';
                badgeClr = 'bg-rose-100 text-rose-800';
              }

              return (
                <div
                  key={sph}
                  className={`p-4 rounded-xl border ${borderClr} flex flex-col justify-between space-y-2`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClr}`}>
                        {info.name.split('.')[0]}. Sphäre
                      </span>
                      <h3 className="font-bold text-xs text-slate-900 mt-1">
                        {info.name.split('.')[1] || info.name}
                      </h3>
                      <p className="text-2xs text-slate-500 line-clamp-1">
                        {info.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="text-emerald-600 text-2xs font-semibold">
                        +{stat.income.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </div>
                      <div className="text-rose-600 text-2xs font-semibold">
                        -{stat.expense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-sans uppercase block">Saldo</span>
                      <span className={`font-bold ${stat.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {stat.net >= 0 ? '+' : ''}{stat.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: SEPA Beitragslauf & Kassen-Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Beitragslauf (SEPA)
                </h2>
              </div>
              <span className="text-2xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                pain.008 XML
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Automatische Lastschrift-Erzeugung für Mitgliedsbeiträge
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">SEPA-Lastschriftzahler:</span>
                <span className="font-bold text-slate-900 font-mono">{sepaMembers.length} von {activeMembers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Gläubiger-ID:</span>
                <span className="font-mono text-slate-800 font-semibold">{settings.creditorId || 'Nicht hinterlegt'}</span>
              </div>
              {missingSepaMandates.length > 0 && (
                <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-amber-700 font-semibold text-2xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{missingSepaMandates.length} Mitglied(er) mit unvollständiger IBAN / Mandat</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('sepa')}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Beitragslauf & XML-Export starten</span>
          </button>
        </div>
      </div>

      {/* 4. RECENT TRANSACTIONS & DEPARTMENTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">
                Letzte Buchungen im Journal
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Alle Buchungen ({transactions.length}) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Datum</th>
                  <th className="px-3 py-2.5">Beleg</th>
                  <th className="px-3 py-2.5">Partner / Text</th>
                  <th className="px-3 py-2.5">Kategorie</th>
                  <th className="px-3 py-2.5 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.map(tx => {
                  const isIncome = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                        {tx.documentNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900 truncate max-w-xs">{tx.partner}</div>
                        <div className="text-2xs text-slate-400 truncate max-w-xs">{tx.bookingText}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-2xs font-medium">
                          {tx.category || tx.subCategory || 'Kategorie'}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIncome ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Departments / Sports breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Abteilungen & Sparten
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('member_analytics')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Statistik
            </button>
          </div>

          <div className="space-y-3">
            {departmentBreakdown.slice(0, 5).map(([deptName, count]) => {
              const deptPercent = members.length > 0 ? (count / members.length) * 100 : 0;
              return (
                <div key={deptName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{deptName}</span>
                    <span className="font-mono text-slate-500">{count} ({deptPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${deptPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Inventar & Geräte:</span>
            <span className="font-bold text-slate-800 font-mono">
              {inventory.length} Artikel ({totalInventoryValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
