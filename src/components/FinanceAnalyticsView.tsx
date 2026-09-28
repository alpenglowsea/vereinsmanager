import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Transaction, FinancialAccount, ClubSettings } from '../types';
import { SPENDEN_HAUPTKONTO_CODE, DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Layers,
  Gift
} from 'lucide-react';

interface FinanceAnalyticsViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  settings: ClubSettings;
}

// ---------------------------------------------------------------------------
// Farben. Einnahmen/Ausgaben/Spenden sind an den Farben festgemacht, die
// überall sonst in der Buchungsübersicht für diese Bedeutung stehen (grün/
// rot). Spenden bekommen bewusst Blau statt eines dritten Grün-/Rottons —
// Blau lässt sich auch bei Rot-Grün-Sehschwäche von beiden unterscheiden.
// ---------------------------------------------------------------------------
const COLOR_INCOME = '#059669'; // emerald-600
const COLOR_EXPENSE = '#e11d48'; // rose-600
const COLOR_DONATION = '#2563eb'; // blue-600
const COLOR_NET = '#0f172a'; // slate-900

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const formatEUR = (value: number, decimals = 2): string =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;

const formatEURCompact = (value: number): string =>
  `${Math.round(value).toLocaleString('de-DE')} €`;

/**
 * Eine Buchung gilt als "Spende", wenn sie (oder bei Splittbuchungen: der
 * jeweilige Teilbetrag) auf dem Nummernkreis "Spenden, Schenkungen &
 * Zuwendungen" (40400) liegt. Spenden werden in den Auswertungen separat
 * ausgewiesen und NICHT unter "Einnahmen" mitgezählt, damit eine Spende
 * nicht doppelt auftaucht (siehe SPENDEN_HAUPTKONTO_CODE in taxSpheres.ts).
 */
const isSpendenBooking = (mainCategory?: string): boolean => {
  if (!mainCategory) return false;
  const code = mainCategory.split(' - ')[0]?.trim();
  return code === SPENDEN_HAUPTKONTO_CODE;
};

interface BookingLine {
  monthIdx: number; // 0 = Januar
  amount: number; // immer positiv
  isIncome: boolean;
  isSpende: boolean;
  department: string; // '' = keiner Sparte zugeordnet
  account: string; // Konto (SKR 42), z.B. "40010 - Laufende Mitgliedsbeiträge"
}

export const FinanceAnalyticsView: React.FC<FinanceAnalyticsViewProps> = ({
  transactions,
  accounts,
  settings
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedSphere, setSelectedSphere] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [incomeMixDepartment, setIncomeMixDepartment] = useState<string>('Gesamtverein');
  const [expenseMixDepartment, setExpenseMixDepartment] = useState<string>('Gesamtverein');

  const departmentList = useMemo(
    () => (settings.departments && settings.departments.length > 0 ? settings.departments : DEFAULT_DEPARTMENTS),
    [settings.departments]
  );

  // Verfügbare Jahre aus den vorhandenen Buchungen ermitteln, statt sie
  // fest einzutragen — sonst veraltet die Auswahl mit jedem neuen Jahr.
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 4) years.add(t.date.substring(0, 4));
    });
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYear]);

  // Umbuchungen zwischen eigenen Konten fließen nicht in die Auswertung ein.
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      if (t.type === 'transfer') return false;
      if (selectedYear !== 'all' && !t.date.startsWith(selectedYear)) return false;
      if (selectedSphere !== 'all' && t.sphere !== selectedSphere) return false;
      if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId) return false;
      return true;
    });
  }, [transactions, selectedYear, selectedSphere, selectedAccountId]);

  // Buchungen zu einzelnen Zeilen aufgelöst: bei Splittbuchungen eine Zeile
  // je Teilbetrag (mit eigener Sparte/Kontierung), sonst eine Zeile je
  // Buchung. Sphäre und Kontierung spielen hier keine Rolle mehr für die
  // Kontenauswahl — nur noch für die Einordnung Einnahme/Ausgabe/Spende.
  const lines = useMemo<BookingLine[]>(() => {
    const result: BookingLine[] = [];
    filteredTxs.forEach(t => {
      const isIncome = t.amount >= 0;
      const monthIdx = Number(t.date.substring(5, 7)) - 1;
      if (t.isSplit && t.splits && t.splits.length > 0) {
        t.splits.forEach(s => {
          result.push({
            monthIdx,
            amount: Math.abs(s.amount || 0),
            isIncome,
            isSpende: isSpendenBooking(s.mainCategory || t.mainCategory),
            department: s.department || t.department || '',
            account: s.subCategory || s.category || t.subCategory || t.category || ''
          });
        });
      } else {
        result.push({
          monthIdx,
          amount: Math.abs(t.amount),
          isIncome,
          isSpende: isSpendenBooking(t.mainCategory),
          department: t.department || '',
          account: t.subCategory || t.category || ''
        });
      }
    });
    return result;
  }, [filteredTxs]);

  // -------------------------------------------------------------------------
  // 1. Einnahmen/Ausgaben/Spenden nach Monat (gestapeltes Säulendiagramm).
  //    Einnahmen und Spenden stapeln sich oberhalb der Nulllinie, Ausgaben
  //    (negativ) unterhalb. Damit Recharts positive und negative Werte
  //    wirklich getrennt ab der Nulllinie stapelt (statt sie fortlaufend zu
  //    einem einzigen, sich überlappenden Balken aufzuaddieren), braucht das
  //    <BarChart> zusätzlich zur stackId noch stackOffset="sign" — siehe
  //    JSX weiter unten.
  // -------------------------------------------------------------------------
  const monthlyData = useMemo(() => {
    return MONTHS.map((name, idx) => {
      const monthLines = lines.filter(l => l.monthIdx === idx);
      let einnahmen = 0;
      let ausgaben = 0;
      let spenden = 0;
      monthLines.forEach(l => {
        if (l.isSpende) spenden += l.amount;
        else if (l.isIncome) einnahmen += l.amount;
        else ausgaben += l.amount;
      });
      return { month: name, Einnahmen: einnahmen, Ausgaben: -ausgaben, Spenden: spenden };
    });
  }, [lines]);

  // -------------------------------------------------------------------------
  // 2. Einnahmen/Ausgaben/Spenden Jahresübersicht (Kreisdiagramm)
  // -------------------------------------------------------------------------
  const yearTotals = useMemo(() => {
    let einnahmen = 0;
    let ausgaben = 0;
    let spenden = 0;
    lines.forEach(l => {
      if (l.isSpende) spenden += l.amount;
      else if (l.isIncome) einnahmen += l.amount;
      else ausgaben += l.amount;
    });
    return { einnahmen, ausgaben, spenden };
  }, [lines]);

  const pieData = useMemo(
    () =>
      [
        { name: 'Einnahmen', value: yearTotals.einnahmen, color: COLOR_INCOME },
        { name: 'Ausgaben', value: yearTotals.ausgaben, color: COLOR_EXPENSE },
        { name: 'Spenden', value: yearTotals.spenden, color: COLOR_DONATION }
      ].filter(d => d.value > 0),
    [yearTotals]
  );

  // -------------------------------------------------------------------------
  // 3. + 4. Einnahmen-/Ausgaben-Mix (horizontale Balken). Die Y-Achse zeigt
  //    die Konten (SKR 42), auf denen in der gewählten Periode tatsächlich
  //    gebucht wurde — nicht jedes mögliche Konto des Kontenrahmens. Jede
  //    Kachel hat eine eigene Sparten-Auswahl ("Gesamtverein" = alle
  //    Buchungen, mit und ohne Sparte).
  // -------------------------------------------------------------------------
  const incomeMixData = useMemo(() => {
    const relevant = lines.filter(
      l => l.isIncome && !l.isSpende && (incomeMixDepartment === 'Gesamtverein' || l.department === incomeMixDepartment)
    );
    const totals = new Map<string, number>();
    relevant.forEach(l => {
      totals.set(l.account, (totals.get(l.account) || 0) + l.amount);
    });
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [lines, incomeMixDepartment]);

  const expenseMixData = useMemo(() => {
    const relevant = lines.filter(
      l => !l.isIncome && (expenseMixDepartment === 'Gesamtverein' || l.department === expenseMixDepartment)
    );
    const totals = new Map<string, number>();
    relevant.forEach(l => {
      totals.set(l.account, (totals.get(l.account) || 0) + l.amount);
    });
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [lines, expenseMixDepartment]);

  // -------------------------------------------------------------------------
  // 5. Cashflow-Trend Gesamtverein über das Jahr nach Monaten (kumulierter
  //    Kontostand-Verlauf, Fieberkurve). Spenden zählen hier mit — echter
  //    Geldfluss kennt keine Unterscheidung zwischen "Einnahme" und "Spende".
  // -------------------------------------------------------------------------
  const cashflowData = useMemo(() => {
    let running = 0;
    return MONTHS.map((name, idx) => {
      const net = lines
        .filter(l => l.monthIdx === idx)
        .reduce((sum, l) => sum + (l.isIncome ? l.amount : -l.amount), 0);
      running += net;
      return { month: name, Kontostand: running };
    });
  }, [lines]);

  // -------------------------------------------------------------------------
  // 6. Einnahmen, Ausgaben und deren Summe nach Sparte (gruppierte,
  //    senkrechte Balken). Einnahmen und Spenden werden hier zusammen
  //    ausgewiesen, Ausgaben als positiver Balken (nicht als Fläche
  //    unterhalb der Nulllinie wie in Diagramm 1). Summe kann negativ sein,
  //    wenn eine Sparte mehr ausgibt als einnimmt.
  // -------------------------------------------------------------------------
  const departmentSummaryData = useMemo(() => {
    const buckets = ['Gesamtverein', ...departmentList];
    return buckets.map(name => {
      const bucketLines = name === 'Gesamtverein' ? lines : lines.filter(l => l.department === name);
      const einnahmenUndSpenden = bucketLines.filter(l => l.isIncome).reduce((s, l) => s + l.amount, 0);
      const ausgaben = bucketLines.filter(l => !l.isIncome).reduce((s, l) => s + l.amount, 0);
      return { name, Einnahmen: einnahmenUndSpenden, Ausgaben: ausgaben, Summe: einnahmenUndSpenden - ausgaben };
    });
  }, [lines, departmentList]);

  const hasData = filteredTxs.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Auswertungs-Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>Jahr {y}</option>
            ))}
            <option value="all">Alle Jahre</option>
          </select>

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

      {!hasData ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-sm text-slate-500">
            Für die gewählten Filter liegen keine Buchungen vor.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Einnahmen</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600">
                +{formatEUR(yearTotals.einnahmen)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Ohne Spenden</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Spenden</span>
                <Gift className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600">
                +{formatEUR(yearTotals.spenden)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Nummernkreis 40400</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Ausgaben</span>
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600">
                -{formatEUR(yearTotals.ausgaben)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Im gewählten Zeitraum</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Cashflow-Saldo</span>
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
              {(() => {
                const net = yearTotals.einnahmen + yearTotals.spenden - yearTotals.ausgaben;
                return (
                  <div className={`text-2xl font-bold font-mono ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {net >= 0 ? '+' : ''}{formatEUR(net)}
                  </div>
                );
              })()}
              <div className="text-[11px] text-slate-400 mt-2">Einnahmen + Spenden − Ausgaben</div>
            </div>
          </div>

          {/* 1. Monatliche Übersicht */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Einnahmen, Ausgaben & Spenden nach Monat
            </h3>
            <p className="text-xs text-slate-400 mb-4">Monatliche Gegenüberstellung der Zahlungsströme</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatEURCompact} axisLine={false} tickLine={false} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="Einnahmen" name="Einnahmen" stackId="monat" fill={COLOR_INCOME} />
                <Bar dataKey="Spenden" name="Spenden" stackId="monat" fill={COLOR_DONATION} />
                <Bar dataKey="Ausgaben" name="Ausgaben" stackId="monat" fill={COLOR_EXPENSE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Jahresübersicht */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                <PieChartIcon className="w-4 h-4 text-emerald-600" />
                Jahresübersicht: Einnahmen, Ausgaben & Spenden
              </h3>
              <p className="text-xs text-slate-400 mb-4">Anteile im gewählten Zeitraum</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={(props: any) => `${props.name} ${Math.round((props.percent || 0) * 100)}%`}
                    labelLine={false}
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 5. Cashflow-Trend */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-blue-600" />
                Cashflow-Trend Gesamtverein
              </h3>
              <p className="text-xs text-slate-400 mb-4">Kumulierter Kontostand-Verlauf über das Jahr (Fieberkurve)</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cashflowData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatEURCompact} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Line type="monotone" dataKey="Kontostand" name="Kontostand" stroke={COLOR_NET} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3. Einnahmen-Mix */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Einnahmen-Mix nach Konto
                </h3>
                <select
                  value={incomeMixDepartment}
                  onChange={e => setIncomeMixDepartment(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-2xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 shrink-0"
                >
                  <option value="Gesamtverein">Gesamtverein (alle Sparten)</option>
                  {departmentList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400 mb-4">Ohne Spenden; nur Konten mit tatsächlichen Buchungen im gewählten Zeitraum</p>
              {incomeMixData.length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center italic">Keine Einnahmen für diese Auswahl.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, incomeMixData.length * 36)}>
                  <BarChart data={incomeMixData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatEURCompact} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Einnahmen" fill={COLOR_INCOME} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 4. Ausgaben-Mix */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-600" />
                  Ausgaben-Mix nach Konto
                </h3>
                <select
                  value={expenseMixDepartment}
                  onChange={e => setExpenseMixDepartment(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-2xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 shrink-0"
                >
                  <option value="Gesamtverein">Gesamtverein (alle Sparten)</option>
                  {departmentList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400 mb-4">Nur Konten mit tatsächlichen Buchungen im gewählten Zeitraum</p>
              {expenseMixData.length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center italic">Keine Ausgaben für diese Auswahl.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, expenseMixData.length * 36)}>
                  <BarChart data={expenseMixData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatEURCompact} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Ausgaben" fill={COLOR_EXPENSE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 6. Einnahmen, Ausgaben und Summe nach Sparte */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              Einnahmen, Ausgaben und Summe nach Sparte
            </h3>
            <p className="text-xs text-slate-400 mb-4">"Gesamtverein" = Summe über alle Buchungen; Einnahmen inkl. Spenden; Summe = Einnahmen − Ausgaben</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={departmentSummaryData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatEURCompact} axisLine={false} tickLine={false} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="Einnahmen" name="Einnahmen (inkl. Spenden)" fill={COLOR_INCOME} />
                <Bar dataKey="Ausgaben" name="Ausgaben" fill={COLOR_EXPENSE} />
                <Bar dataKey="Summe" name="Summe" fill={COLOR_NET} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};
