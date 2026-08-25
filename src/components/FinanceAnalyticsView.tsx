import React, { useState } from 'react';
import { Transaction, FinancialAccount, TaxSphere } from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';

interface FinanceAnalyticsViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
}

export const FinanceAnalyticsView: React.FC<FinanceAnalyticsViewProps> = ({
  transactions,
  accounts
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedSphere, setSelectedSphere] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Filter transactions (excluding internal transfers from P&L calculations)
  const filteredTxs = transactions.filter(t => {
    if (t.type === 'transfer') return false;
    if (selectedYear !== 'all' && !t.date.startsWith(selectedYear)) return false;
    if (selectedSphere !== 'all' && t.sphere !== selectedSphere) return false;
    if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId) return false;
    return true;
  });

  // 1. Monthly Breakdown (12 Months)
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthlyData = months.map((monthName, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const txsInMonth = filteredTxs.filter(t => {
      if (selectedYear === 'all') return t.date.substring(5, 7) === monthNum;
      return t.date.startsWith(`${selectedYear}-${monthNum}`);
    });

    let income = 0;
    let expense = 0;
    txsInMonth.forEach(t => {
      if (t.amount >= 0) income += t.amount;
      else expense += Math.abs(t.amount);
    });

    return {
      month: monthName,
      income,
      expense,
      net: income - expense
    };
  });

  const maxMonthlyVal = Math.max(
    ...monthlyData.map(m => Math.max(m.income, m.expense)),
    100
  );

  // 2. Tax Sphere Breakdown
  const sphereTotals: Record<TaxSphere, { income: number; expense: number }> = {
    ideell: { income: 0, expense: 0 },
    vermoegen: { income: 0, expense: 0 },
    zweckbetrieb: { income: 0, expense: 0 },
    wirtschaftlich: { income: 0, expense: 0 }
  };

  filteredTxs.forEach(t => {
    const s = t.sphere || 'ideell';
    if (t.amount >= 0) sphereTotals[s].income += t.amount;
    else sphereTotals[s].expense += Math.abs(t.amount);
  });

  const totalIncome = Object.values(sphereTotals).reduce((sum, v) => sum + v.income, 0);
  const totalExpense = Object.values(sphereTotals).reduce((sum, v) => sum + v.expense, 0);

  // 3. Top Expense Categories
  const expenseCatMap: Record<string, number> = {};
  filteredTxs.filter(t => t.amount < 0).forEach(t => {
    expenseCatMap[t.category] = (expenseCatMap[t.category] || 0) + Math.abs(t.amount);
  });
  const topExpenseCategories = Object.entries(expenseCatMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // 4. Top Income Categories
  const incomeCatMap: Record<string, number> = {};
  filteredTxs.filter(t => t.amount > 0).forEach(t => {
    incomeCatMap[t.category] = (incomeCatMap[t.category] || 0) + t.amount;
  });
  const topIncomeCategories = Object.entries(incomeCatMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Auswertungs-Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="2025">Jahr 2025</option>
            <option value="2024">Jahr 2024</option>
            <option value="all">Alle Jahre</option>
          </select>

          {/* Sphere filter */}
          <select
            value={selectedSphere}
            onChange={e => setSelectedSphere(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Steuer-Sphären</option>
            <option value="ideell">1. Ideeller Bereich</option>
            <option value="vermoegen">2. Vermögensverwaltung</option>
            <option value="zweckbetrieb">3. Zweckbetrieb</option>
            <option value="wirtschaftlich">4. Wirtschaftlicher Geschäftsbetrieb</option>
          </select>

          {/* Account filter */}
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Konten & Kassen</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Einnahmen</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-600">
            +{totalIncome.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Im gewählten Zeitraum</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Ausgaben</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-600">
            -{totalExpense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Im gewählten Zeitraum</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Perioden-Saldo</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className={`text-3xl font-bold font-mono ${totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalIncome - totalExpense >= 0 ? '+' : ''}{(totalIncome - totalExpense).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Cashflow / Netto-Überschuss</div>
        </div>
      </div>

      {/* Monthly Cashflow Bar Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Monatlicher Verlauf: Einnahmen vs. Ausgaben
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Monatliche Gegenüberstellung der Zahlungsströme</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>Einnahmen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-500" />
              <span>Ausgaben</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Graphics */}
        <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end h-48 pt-6 border-b border-slate-200">
          {monthlyData.map((m, idx) => {
            const incHeightPct = Math.max(4, Math.round((m.income / maxMonthlyVal) * 100));
            const expHeightPct = Math.max(4, Math.round((m.expense / maxMonthlyVal) * 100));

            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                <div className="absolute -top-12 bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap shadow-lg">
                  <div className="text-emerald-400 font-bold">+{m.income.toFixed(0)} €</div>
                  <div className="text-rose-400 font-bold">-{m.expense.toFixed(0)} €</div>
                </div>

                <div className="flex gap-1 items-end w-full justify-center h-full pb-1">
                  {/* Income bar */}
                  <div
                    className="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t-sm hover:bg-emerald-600 transition-all duration-300"
                    style={{ height: m.income > 0 ? `${incHeightPct}%` : '2px' }}
                  />
                  {/* Expense bar */}
                  <div
                    className="w-2.5 sm:w-3.5 bg-rose-500 rounded-t-sm hover:bg-rose-600 transition-all duration-300"
                    style={{ height: m.expense > 0 ? `${expHeightPct}%` : '2px' }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-2">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Spheres & Categories Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Tax Spheres Shares */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Einnahmen nach den 4 steuerlichen Sphären
          </h3>

          <div className="space-y-3">
            {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sph => {
              const info = TAX_SPHERES[sph];
              const inc = sphereTotals[sph].income;
              const exp = sphereTotals[sph].expense;
              const pct = totalIncome > 0 ? Math.round((inc / totalIncome) * 100) : 0;

              return (
                <div key={sph} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{info.name}</span>
                    <span className="font-mono text-slate-600">
                      <strong className="text-emerald-700">+{inc.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>Ausgaben: -{exp.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                    <span className={`font-semibold ${inc - exp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Saldo: {inc - exp >= 0 ? '+' : ''}{(inc - exp).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Top Expense Categories */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            Größte Ausgabenposten (Top Kategorien)
          </h3>

          <div className="space-y-3">
            {topExpenseCategories.map(([cat, amount]) => {
              const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-xs">{cat}</span>
                    <span className="font-mono font-bold text-rose-700 whitespace-nowrap">
                      -{amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topExpenseCategories.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                Keine Ausgaben im gewählten Zeitraum vorhanden.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
