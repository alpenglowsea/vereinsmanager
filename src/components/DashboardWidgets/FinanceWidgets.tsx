import React, { useMemo } from 'react';
import {
  Transaction,
  FinancialAccount,
  Member,
  DonationReceipt,
  TaxSphere,
  ClubSettings
} from '../../types';
import { TAX_SPHERES } from '../../data/taxSpheres';
import {
  Wallet,
  ShieldCheck,
  Percent,
  Layers,
  CreditCard,
  FileSpreadsheet,
  HeartHandshake,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  TrendingDown,
  Building2,
  Receipt
} from 'lucide-react';

// 1. Liquidity & Bank Balances Widget
interface LiquidityWidgetProps {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const LiquidityWidget: React.FC<LiquidityWidgetProps> = ({
  accounts,
  transactions,
  onNavigate
}) => {
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach((acc) => {
      balances[acc.id] = acc.initialBalance || 0;
    });

    transactions.forEach((tx) => {
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

  return (
    <div
      onClick={() => onNavigate('finance')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Gesamtliquidität</span>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
          {totalLiquidity.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>{accounts.length} Konten & Kassen</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center gap-0.5">
          Journal <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};

// 2. Annual Balance Widget (EÜR YTD)
interface AnnualBalanceWidgetProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const AnnualBalanceWidget: React.FC<AnnualBalanceWidgetProps> = ({
  transactions,
  onNavigate
}) => {
  const currentYear = new Date().getFullYear().toString();

  const { income, expense, net } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    (transactions || [])
      .filter((t) => t.type !== 'transfer' && t.date && t.date.startsWith(currentYear))
      .forEach((t) => {
        if (t.amount >= 0) inc += t.amount;
        else exp += Math.abs(t.amount);
      });
    return { income: inc, expense: exp, net: inc - exp };
  }, [transactions, currentYear]);

  return (
    <div
      onClick={() => onNavigate('guv')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Jahres-Saldo ({currentYear})</span>
          <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className={`text-3xl font-black font-mono ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {net >= 0 ? '+' : ''}{net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono">
        <span className="text-emerald-600 dark:text-emerald-400">+{income.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
        <span className="text-rose-600 dark:text-rose-400">-{expense.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
      </div>
    </div>
  );
};

// 3. WGB Limit Monitor Widget (§ 64 AO 45.000 €)
interface WgbLimitWidgetProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const WgbLimitWidget: React.FC<WgbLimitWidgetProps> = ({ transactions, onNavigate }) => {
  const currentYear = new Date().getFullYear().toString();

  const wgbIncome = useMemo(() => {
    return (transactions || [])
      .filter((t) => t.type !== 'transfer' && t.date && t.date.startsWith(currentYear) && t.sphere === 'wirtschaftlich' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, currentYear]);

  const WGB_LIMIT = 45000.0;
  const wgbPercent = Math.min(100, (wgbIncome / WGB_LIMIT) * 100);
  const wgbBuffer = Math.max(0, WGB_LIMIT - wgbIncome);

  return (
    <div
      onClick={() => onNavigate('guv')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">§ 64 AO Freigrenze</span>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
          {wgbPercent.toFixed(1)} % <span className="text-xs font-normal text-slate-500 font-sans">erreicht</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden my-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              wgbPercent > 90 ? 'bg-rose-500' : wgbPercent > 70 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(3, wgbPercent)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="font-mono">{wgbIncome.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {wgbBuffer.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € Puffer
        </span>
      </div>
    </div>
  );
};

// 4. Tax Spheres (SKR 42) Widget
interface TaxSpheresWidgetProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const TaxSpheresWidget: React.FC<TaxSpheresWidgetProps> = ({ transactions, onNavigate }) => {
  const currentYear = new Date().getFullYear().toString();

  const sphereStats = useMemo(() => {
    const spheres: Record<TaxSphere, { income: number; expense: number; net: number }> = {
      ideell: { income: 0, expense: 0, net: 0 },
      vermoegen: { income: 0, expense: 0, net: 0 },
      zweckbetrieb: { income: 0, expense: 0, net: 0 },
      wirtschaftlich: { income: 0, expense: 0, net: 0 }
    };

    (transactions || [])
      .filter((t) => t.type !== 'transfer' && t.date && t.date.startsWith(currentYear))
      .forEach((t) => {
        const sph = t.sphere || 'ideell';
        if (t.amount >= 0) {
          spheres[sph].income += t.amount;
        } else {
          spheres[sph].expense += Math.abs(t.amount);
        }
        spheres[sph].net = spheres[sph].income - spheres[sph].expense;
      });

    return spheres;
  }, [transactions, currentYear]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Steuerliche 4 Sphären (SKR 42)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gemeinnützigkeitsrechtliche Aufteilung</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('guv')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
          >
            EÜR-Bericht <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map((sph) => {
            const info = TAX_SPHERES[sph];
            const stat = sphereStats[sph];

            let borderClr = 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/60 dark:bg-emerald-950/20';
            let badgeClr = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300';
            if (sph === 'vermoegen') {
              borderClr = 'border-blue-200 bg-blue-50/20 dark:border-blue-900/60 dark:bg-blue-950/20';
              badgeClr = 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300';
            }
            if (sph === 'zweckbetrieb') {
              borderClr = 'border-amber-200 bg-amber-50/20 dark:border-amber-900/60 dark:bg-amber-950/20';
              badgeClr = 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300';
            }
            if (sph === 'wirtschaftlich') {
              borderClr = 'border-rose-200 bg-rose-50/20 dark:border-rose-900/60 dark:bg-rose-950/20';
              badgeClr = 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300';
            }

            return (
              <div
                key={sph}
                className={`p-3.5 rounded-xl border ${borderClr} flex flex-col justify-between space-y-2`}
              >
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClr}`}>
                    {info.name.split('.')[0]}. Sphäre
                  </span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                    {info.name.split('.')[1] || info.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-0.5">
                    <div className="text-emerald-600 dark:text-emerald-400 text-2xs font-semibold">
                      +{stat.income.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                    <div className="text-rose-600 dark:text-rose-400 text-2xs font-semibold">
                      -{stat.expense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-sans uppercase block">Saldo</span>
                    <span className={`font-bold ${stat.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {stat.net >= 0 ? '+' : ''}{stat.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-400">
        <span>DATEV SKR 42 Kontenrahmen</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">Vollständig revisionssicher</span>
      </div>
    </div>
  );
};

// 5. SEPA Debit & Payment Monitor Widget
interface SepaMonitorWidgetProps {
  members: Member[];
  settings: ClubSettings;
  onNavigate: (tab: string) => void;
}

export const SepaMonitorWidget: React.FC<SepaMonitorWidgetProps> = ({
  members,
  settings,
  onNavigate
}) => {
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);
  const sepaMembers = useMemo(() => members.filter((m) => m.paymentMethod === 'sepa' && m.status === 'active'), [members]);
  const missingSepaMandates = useMemo(() => {
    return members.filter(
      (m) => m.status === 'active' && m.paymentMethod === 'sepa' && (!m.bankDetails?.iban || !m.bankDetails?.mandateReference)
    );
  }, [members]);

  const totalFeeSumEst = useMemo(() => {
    return activeMembers.reduce((sum, m) => sum + (m.feeAmount || 0), 0);
  }, [activeMembers]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Beitragslauf (SEPA)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">pain.008 Lastschrift-Erzeugung</p>
            </div>
          </div>
          <span className="text-2xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded">
            SEPA XML
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">SEPA-Lastschriftzahler:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {sepaMembers.length} von {activeMembers.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Gläubiger-ID:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold text-2xs">
              {settings.creditorId || 'Nicht hinterlegt'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-600 dark:text-slate-400">Geschätztes Beitragsvolumen:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ~{totalFeeSumEst.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>

          {missingSepaMandates.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-2xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{missingSepaMandates.length} Mandat(e) unvollständig</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate('sepa')}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <CreditCard className="w-4 h-4" />
        <span>Beitragslauf & XML-Export starten</span>
      </button>
    </div>
  );
};

// 6. Recent Journal Transactions Widget
interface RecentTransactionsWidgetProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const RecentTransactionsWidget: React.FC<RecentTransactionsWidgetProps> = ({
  transactions,
  onNavigate
}) => {
  const recent = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Letzte Buchungen im Journal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktuelle Einnahmen & Ausgaben</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('finance')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
          >
            Alle ({transactions.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-2.5 py-2">Datum</th>
                <th className="px-2.5 py-2">Beleg</th>
                <th className="px-2.5 py-2">Partner / Text</th>
                <th className="px-2.5 py-2 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((tx) => {
                const isIncome = tx.amount >= 0;
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-2.5 py-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-2xs">
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-2.5 py-2 font-mono font-bold text-slate-800 dark:text-slate-200 text-2xs">
                      {tx.documentNumber}
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                        {tx.partner}
                      </div>
                      <div className="text-3xs text-slate-400 truncate max-w-[180px]">
                        {tx.bookingText}
                      </div>
                    </td>
                    <td className={`px-2.5 py-2 text-right font-mono font-bold whitespace-nowrap ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isIncome ? '+' : ''}{tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-400">
        <span>GoBD-konformes Journal</span>
        <span className="font-semibold text-blue-600 dark:text-blue-400 cursor-pointer" onClick={() => onNavigate('finance')}>
          + Buchung erfassen
        </span>
      </div>
    </div>
  );
};

// 7. Donations & Zuwendungsbestätigungen Widget
interface DonationsWidgetProps {
  donations: DonationReceipt[];
  onNavigate: (tab: string) => void;
}

export const DonationsWidget: React.FC<DonationsWidgetProps> = ({ donations = [], onNavigate }) => {
  const currentYear = new Date().getFullYear().toString();

  const { totalSum, cashCount, inKindCount } = useMemo(() => {
    let sum = 0;
    let cash = 0;
    let inKind = 0;

    (donations || [])
      .filter((d) => {
        const dDate = d.date || (d as any).donationDate || '';
        return typeof dDate === 'string' && dDate.startsWith(currentYear);
      })
      .forEach((d) => {
        sum += d.amount || 0;
        const isCash = d.type === 'money' || (d as any).donationType === 'cash' || (d as any).type === 'cash';
        if (isCash) cash++;
        else inKind++;
      });

    return { totalSum: sum, cashCount: cash, inKindCount: inKind };
  }, [donations, currentYear]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Spenden & Zuwendungen
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">BMF-Muster ({currentYear})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('donations')}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            Spendenbuch
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <span className="text-2xs text-slate-400 block font-semibold uppercase">Spendenvolumen YTD</span>
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {totalSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-2xs text-slate-400 block">Geldspenden</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{cashCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-2xs text-slate-400 block">Sachspenden</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{inKindCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>Steuerabzugsfähig nach § 10b EStG</span>
        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{donations.length} gesamt</span>
      </div>
    </div>
  );
};

// 8. Monthly Cashflow Widget
interface CashflowWidgetProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const CashflowWidget: React.FC<CashflowWidgetProps> = ({ transactions, onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const data = months.map((m, i) => ({
      name: m,
      monthNum: i + 1,
      income: 0,
      expense: 0,
      net: 0
    }));

    (transactions || [])
      .filter((t) => t.type !== 'transfer' && t.date && t.date.startsWith(currentYear.toString()))
      .forEach((t) => {
        const mIndex = parseInt(t.date.substring(5, 7), 10) - 1;
        if (mIndex >= 0 && mIndex < 12) {
          if (t.amount >= 0) data[mIndex].income += t.amount;
          else data[mIndex].expense += Math.abs(t.amount);
          data[mIndex].net = data[mIndex].income - data[mIndex].expense;
        }
      });

    return data;
  }, [transactions, currentYear]);

  const maxAmount = useMemo(() => {
    return Math.max(1000, ...monthlyData.map((d) => Math.max(d.income, d.expense)));
  }, [monthlyData]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Monatlicher Cashflow ({currentYear})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verlauf Einnahmen vs. Ausgaben</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('finance_analytics')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Finanzanalyse
          </button>
        </div>

        {/* Bar Chart Visualization */}
        <div className="grid grid-cols-12 gap-1 sm:gap-2 pt-4 items-end h-36 border-b border-slate-100 dark:border-slate-800 pb-2">
          {monthlyData.map((m) => {
            const incHeight = (m.income / maxAmount) * 100;
            const expHeight = (m.expense / maxAmount) * 100;

            return (
              <div key={m.name} className="flex flex-col items-center gap-1 h-full justify-end group/bar">
                <div className="w-full flex items-end justify-center gap-0.5 h-28">
                  <div
                    className="w-1/2 bg-emerald-500 hover:bg-emerald-600 rounded-t-xs transition-all duration-300 relative"
                    style={{ height: `${Math.max(2, incHeight)}%` }}
                    title={`${m.name} Einnahmen: +${m.income.toFixed(2)} €`}
                  />
                  <div
                    className="w-1/2 bg-rose-500 hover:bg-rose-600 rounded-t-xs transition-all duration-300 relative"
                    style={{ height: `${Math.max(2, expHeight)}%` }}
                    title={`${m.name} Ausgaben: -${m.expense.toFixed(2)} €`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 group-hover/bar:text-slate-800 dark:group-hover/bar:text-slate-200">
                  {m.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-500" />
            <span>Einnahmen</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-rose-500" />
            <span>Ausgaben</span>
          </div>
        </div>
        <span className="font-semibold text-slate-700 dark:text-slate-300">Ganzjahresübersicht</span>
      </div>
    </div>
  );
};
