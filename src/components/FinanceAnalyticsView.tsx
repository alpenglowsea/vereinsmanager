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
import { DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import jsPDF from 'jspdf';
import { AuswFilter, GESAMT, berechne, csv, dateiname, filterText, mix } from '../services/finanzAuswertung';
import { pdfSeiten, zeichnePdf } from '../services/finanzDiagramme';
import { lokalesHeute } from '../utils/mitgliedRegeln';
import { saveTextAs, savePdfAs } from '../utils/fileExportHelper';
import { melde } from '../utils/dialoge';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Layers,
  Gift,
  Download,
  FileText
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

const formatEUR = (value: number, decimals = 2): string =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;

const formatEURCompact = (value: number): string =>
  `${Math.round(value).toLocaleString('de-DE')} €`;

export const FinanceAnalyticsView: React.FC<FinanceAnalyticsViewProps> = ({
  transactions,
  accounts,
  settings
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedSphere, setSelectedSphere] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [incomeMixDepartment, setIncomeMixDepartment] = useState<string>(GESAMT);
  const [expenseMixDepartment, setExpenseMixDepartment] = useState<string>(GESAMT);

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

  // Alle Zahlen aus einer Rechnung wie am Handy (P25, `finanzAuswertung.ts`):
  // Einnahme/Ausgabe nach Buchungsart (D-77), Spende nur als Einnahme auf
  // 40400 (D-76), Bereichsfilter je Teilbetrag (D-78), Verlauf als echter
  // Kontostand mit Anfangsbestand (D-75). Umbuchungen zählen nicht mit.
  const filter = useMemo<AuswFilter>(
    () => ({
      jahr: selectedYear === 'all' ? null : selectedYear,
      sphaere: selectedSphere === 'all' ? null : selectedSphere,
      kontoId: selectedAccountId === 'all' ? null : selectedAccountId
    }),
    [selectedYear, selectedSphere, selectedAccountId]
  );
  const auswertung = useMemo(
    () => berechne(transactions, accounts, filter, departmentList, lokalesHeute()),
    [transactions, accounts, filter, departmentList]
  );
  const alleJahre = filter.jahr === null;

  // 1. Säulen je Monat: Einnahmen und Spenden über, Ausgaben unter der
  //    Nulllinie (stackOffset="sign", damit Recharts getrennt ab null stapelt).
  const monthlyData = useMemo(
    () => auswertung.monate.map(m => ({ month: m.name, Einnahmen: m.einnahmen, Ausgaben: -m.ausgaben, Spenden: m.spenden })),
    [auswertung]
  );

  // 2. Kennzahlen und Torte
  const yearTotals = auswertung.kennzahlen;
  const pieData = useMemo(
    () =>
      [
        { name: 'Einnahmen', value: yearTotals.einnahmen, color: COLOR_INCOME },
        { name: 'Ausgaben', value: yearTotals.ausgaben, color: COLOR_EXPENSE },
        { name: 'Spenden', value: yearTotals.spenden, color: COLOR_DONATION }
      ].filter(d => d.value > 0),
    [yearTotals]
  );

  // 3. + 4. Einnahmen-/Ausgaben-Mix nach Konto, je Kachel eigene Sparte
  const incomeMixData = useMemo(
    () => mix(auswertung.posten, true, incomeMixDepartment).map(a => ({ name: a.name, value: a.wert })),
    [auswertung, incomeMixDepartment]
  );
  const expenseMixData = useMemo(
    () => mix(auswertung.posten, false, expenseMixDepartment).map(a => ({ name: a.name, value: a.wert })),
    [auswertung, expenseMixDepartment]
  );

  // 5. Kontostand-Verlauf (bei „Alle Jahre“: Anfang und Jahresenden)
  const cashflowData = useMemo(() => auswertung.verlauf.map(p => ({ month: p.name, Kontostand: p.stand })), [auswertung]);

  // 6. Sparten
  const departmentSummaryData = useMemo(
    () => auswertung.sparten.map(x => ({ name: x.name, Einnahmen: x.einnahmen, Ausgaben: x.ausgaben, Summe: x.summe })),
    [auswertung]
  );

  const hasData = !auswertung.keineBuchungen;

  // Ausgabe wie am Handy (D-80): CSV mit allen Zahlen, PDF mit den Diagrammen
  // (die Mixe im PDF zeigen den Gesamtverein)
  const verein = settings.clubName || 'Verein';
  const handleCsv = async () => {
    try {
      await saveTextAs(
        csv(auswertung, accounts, mix(auswertung.posten, true), mix(auswertung.posten, false)),
        dateiname(auswertung, verein, 'csv'),
        'text/csv'
      );
    } catch (err) {
      console.error(err);
      void melde('Die CSV-Datei konnte nicht gespeichert werden.');
    }
  };
  const handlePdf = async () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      zeichnePdf(doc, pdfSeiten(auswertung, verein, filterText(filter, accounts), lokalesHeute().split('-').reverse().join('.')));
      await savePdfAs(doc, dateiname(auswertung, verein, 'pdf'));
    } catch (err) {
      console.error(err);
      void melde('Das PDF konnte nicht erstellt werden.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Auswertungs-Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>Jahr {y}</option>
            ))}
            <option value="all">Alle Jahre</option>
          </select>

          <select
            value={selectedSphere}
            onChange={e => setSelectedSphere(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
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
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
          >
            <option value="all">Alle Konten & Kassen</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCsv}
            disabled={!hasData}
            title="Alle Zahlen der Auswertung als CSV-Datei"
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={!hasData}
            title="Auswertung mit Diagrammen als PDF (A4)"
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-xs text-center dark:bg-slate-900 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Für die gewählten Filter liegen keine Buchungen vor.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Einnahmen</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                +{formatEUR(yearTotals.einnahmen)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Ohne Spenden</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Spenden</span>
                <Gift className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                +{formatEUR(yearTotals.spenden)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Nummernkreis 40400</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Ausgaben</span>
                <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                -{formatEUR(yearTotals.ausgaben)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Im gewählten Zeitraum</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Saldo</span>
                <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              {(() => {
                const net = yearTotals.einnahmen + yearTotals.spenden - yearTotals.ausgaben;
                return (
                  <div className={`text-2xl font-bold font-mono ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {net >= 0 ? '+' : ''}{formatEUR(net)}
                  </div>
                );
              })()}
              <div className="text-[11px] text-slate-400 mt-2">Einnahmen + Spenden − Ausgaben</div>
            </div>
          </div>

          {/* 1. Monatliche Übersicht */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1 dark:text-white">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Einnahmen, Ausgaben & Spenden nach Monat
            </h3>
            <p className="text-xs text-slate-400 mb-4">{alleJahre ? 'Alle Jahre zusammen, je Monat' : 'Monatliche Gegenüberstellung der Zahlungsströme'}</p>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1 dark:text-white">
                <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Jahresübersicht: Einnahmen, Ausgaben & Spenden
              </h3>
              <p className="text-xs text-slate-400 mb-4">Anteil an allen Bewegungen im gewählten Zeitraum</p>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1 dark:text-white">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Kontostand-Verlauf
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {alleJahre ? 'Anfangsbestand plus Buchungen, jeweils am Jahresende' : 'Anfangsbestand plus Buchungen, jeweils am Monatsende'}
              </p>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 dark:text-white">
                  <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Einnahmen-Mix nach Konto
                </h3>
                <select
                  value={incomeMixDepartment}
                  onChange={e => setIncomeMixDepartment(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-2xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 shrink-0 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                >
                  <option value={GESAMT}>Gesamtverein (alle Sparten)</option>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 dark:text-white">
                  <Layers className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Ausgaben-Mix nach Konto
                </h3>
                <select
                  value={expenseMixDepartment}
                  onChange={e => setExpenseMixDepartment(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-2xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 shrink-0 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                >
                  <option value={GESAMT}>Gesamtverein (alle Sparten)</option>
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
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1 dark:text-white">
              <BarChart3 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
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
