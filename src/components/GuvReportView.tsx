import React, { useState } from 'react';
import { Transaction, ClubSettings, TaxSphere } from '../types';
import { TAX_SPHERES, findSkr42MainForSub } from '../data/taxSpheres';
import { ExportService } from '../services/exportService';
import {
  FileDown,
  Calendar,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Percent,
  Layers,
  Tag,
  Info,
  Scale,
  Sparkles
} from 'lucide-react';

interface GuvReportViewProps {
  transactions: Transaction[];
  settings: ClubSettings;
}

export const GuvReportView: React.FC<GuvReportViewProps> = ({
  transactions,
  settings
}) => {
  // Extract all available years from transactions
  const years = Array.from(
    new Set(transactions.map(t => t.date.substring(0, 4)))
  ).sort().reverse();

  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(years.includes(currentYear) ? currentYear : (years[0] || currentYear));
  const [expandedSpheres, setExpandedSpheres] = useState<Record<TaxSphere, boolean>>({
    ideell: true,
    vermoegen: true,
    zweckbetrieb: true,
    wirtschaftlich: true
  });
  const [expandedMainCats, setExpandedMainCats] = useState<Record<string, boolean>>({});

  // Filter transactions by year (ignore internal transfers)
  const filteredTxs = transactions.filter(t => {
    if (t.type === 'transfer') return false;
    if (selectedYear === 'all') return true;
    return t.date.startsWith(selectedYear);
  });

  // Spheres
  const spheres: TaxSphere[] = ['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'];

  // Hierarchical reporting data: Sphere -> Main Category -> Sub Category
  interface SubCatData {
    name: string;
    skrCode?: string;
    income: number;
    expense: number;
    txCount: number;
  }

  interface MainCatData {
    id: string;
    code: string;
    name: string;
    income: number;
    expense: number;
    txCount: number;
    subCategories: Record<string, SubCatData>;
  }

  const reportData: Record<TaxSphere, {
    income: number;
    expense: number;
    net: number;
    mainCategories: Record<string, MainCatData>;
  }> = {
    ideell: { income: 0, expense: 0, net: 0, mainCategories: {} },
    vermoegen: { income: 0, expense: 0, net: 0, mainCategories: {} },
    zweckbetrieb: { income: 0, expense: 0, net: 0, mainCategories: {} },
    wirtschaftlich: { income: 0, expense: 0, net: 0, mainCategories: {} }
  };

  filteredTxs.forEach(t => {
    const sph = t.sphere || 'ideell';
    const subCatName = t.subCategory || t.category || 'Sonstige Buchung';
    
    // Resolve main category
    let mainCatKey = t.mainCategory;
    let mainCode = '';
    let mainName = '';

    if (mainCatKey) {
      const parts = mainCatKey.split(' - ');
      mainCode = parts[0] || '';
      mainName = parts[1] || mainCatKey;
    } else {
      const detected = findSkr42MainForSub(subCatName);
      if (detected) {
        mainCatKey = `${detected.code} - ${detected.name}`;
        mainCode = detected.code;
        mainName = detected.name;
      } else {
        mainCatKey = `Allgemein (${sph})`;
        mainCode = '';
        mainName = `Allgemeine Erlöse/Kosten ${sph}`;
      }
    }

    // Initialize Main Category if needed
    if (!reportData[sph].mainCategories[mainCatKey]) {
      reportData[sph].mainCategories[mainCatKey] = {
        id: mainCatKey,
        code: mainCode,
        name: mainName,
        income: 0,
        expense: 0,
        txCount: 0,
        subCategories: {}
      };
    }

    const mainObj = reportData[sph].mainCategories[mainCatKey];
    mainObj.txCount++;

    // Initialize Sub Category if needed
    if (!mainObj.subCategories[subCatName]) {
      mainObj.subCategories[subCatName] = {
        name: subCatName,
        skrCode: t.skrAccount,
        income: 0,
        expense: 0,
        txCount: 0
      };
    }
    const subObj = mainObj.subCategories[subCatName];
    subObj.txCount++;

    if (t.amount >= 0) {
      reportData[sph].income += t.amount;
      mainObj.income += t.amount;
      subObj.income += t.amount;
    } else {
      const abs = Math.abs(t.amount);
      reportData[sph].expense += abs;
      mainObj.expense += abs;
      subObj.expense += abs;
    }
    reportData[sph].net = reportData[sph].income - reportData[sph].expense;
  });

  let totalIncome = 0;
  let totalExpense = 0;
  spheres.forEach(s => {
    totalIncome += reportData[s].income;
    totalExpense += reportData[s].expense;
  });
  const totalNet = totalIncome - totalExpense;

  // =========================================================================
  // 45.000 € Besteuerungsgrenze (§ 64 Abs. 3 AO / Kleinunternehmerregelung)
  // =========================================================================
  const WGB_LIMIT = 45000.00;
  const wgbIncome = reportData.wirtschaftlich.income;
  const wgbPercent = Math.min(100, (wgbIncome / WGB_LIMIT) * 100);
  const wgbExactPercent = (wgbIncome / WGB_LIMIT) * 100;
  const wgbBuffer = Math.max(0, WGB_LIMIT - wgbIncome);
  const isOverLimit = wgbIncome >= WGB_LIMIT;
  const isWarningLimit = wgbPercent >= 75 && !isOverLimit;

  const toggleSphere = (sph: TaxSphere) => {
    setExpandedSpheres(prev => ({ ...prev, [sph]: !prev[sph] }));
  };

  const toggleMainCat = (key: string) => {
    setExpandedMainCats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportPDF = () => {
    ExportService.exportGuvPDF(transactions, settings, selectedYear);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
              SKR 42 / § 4 Abs. 3 EStG / §§ 51 ff. AO
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Steuerliche Sphärenrechnung & DATEV Standardkontenrahmen für Vereine
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Einnahmen-Überschuss-Rechnung (EÜR / GuV)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatische Gliederung nach SKR 42 Haupt- und Nebenkategorien für Vorstand, Finanzamt & Mitgliederversammlung
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer pr-4"
            >
              {years.map(yr => (
                <option key={yr} value={yr}>Geschäftsjahr {yr}</option>
              ))}
              <option value="all">Alle Geschäftsjahre</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <FileDown className="w-4 h-4" />
            <span>EÜR als PDF</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          ANFORDERUNG 3: KACHEL ZUR 45.000 € GRENZE IM WIRTSCHAFTLICHEN GESCHÄFTSBETRIEB
          ========================================================================= */}
      <div className={`p-5 rounded-xl border shadow-xs transition-all ${
        isOverLimit
          ? 'bg-rose-50/80 border-rose-300'
          : isWarningLimit
          ? 'bg-amber-50/80 border-amber-300'
          : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isOverLimit
                  ? 'bg-rose-600 text-white'
                  : isWarningLimit
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                § 64 Abs. 3 AO Besteuerungsgrenze / Kleinunternehmerregelung
              </span>
              <span className={`text-xs font-semibold ${isOverLimit ? 'text-rose-900' : isWarningLimit ? 'text-amber-900' : 'text-slate-300'}`}>
                Wirtschaftlicher Geschäftsbetrieb ({selectedYear})
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h3 className={`text-2xl font-black font-mono tracking-tight ${
                isOverLimit ? 'text-rose-900' : isWarningLimit ? 'text-amber-950' : 'text-white'
              }`}>
                {wgbIncome.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </h3>
              <span className={`text-sm font-semibold ${isOverLimit ? 'text-rose-700' : isWarningLimit ? 'text-amber-800' : 'text-slate-400'}`}>
                von 45.000,00 € Freigrenze
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${isOverLimit ? 'text-rose-800' : isWarningLimit ? 'text-amber-900' : 'text-slate-300'}`}>
              Einnahmen (inkl. USt) aus wirtschaftlichen Geschäftsbetrieben (Kiosk, Sponsoring, Feste) bleiben bis zu <strong>45.000 € im Kalenderjahr</strong> körperschaft- und gewerbesteuerfrei.
            </p>
          </div>

          {/* Progress & Ratio Display */}
          <div className={`p-4 rounded-xl flex-1 max-w-md ${
            isOverLimit
              ? 'bg-white/80 border border-rose-200'
              : isWarningLimit
              ? 'bg-white/80 border border-amber-200'
              : 'bg-slate-800/80 border border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className={`font-semibold flex items-center gap-1.5 ${isOverLimit ? 'text-rose-900' : isWarningLimit ? 'text-amber-900' : 'text-slate-200'}`}>
                <Percent className="w-3.5 h-3.5 text-blue-400" />
                Erreicht: <strong>{wgbExactPercent.toFixed(1)} %</strong>
              </span>
              <span className={`font-mono font-bold ${
                isOverLimit
                  ? 'text-rose-700'
                  : isWarningLimit
                  ? 'text-amber-800'
                  : 'text-emerald-400'
              }`}>
                {isOverLimit ? 'Grenze überschritten!' : `Puffer: ${wgbBuffer.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-3.5 rounded-full bg-slate-700/40 overflow-hidden p-0.5 border border-slate-600/30">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverLimit
                    ? 'bg-rose-500'
                    : isWarningLimit
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, wgbPercent))}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className={isOverLimit ? 'text-rose-700' : isWarningLimit ? 'text-amber-800' : 'text-slate-400'}>
                0 € (Start)
              </span>
              <span className="font-semibold text-center px-2 py-0.5 rounded text-[10px] bg-slate-700/20 text-slate-300">
                {isOverLimit ? 'Steuerpflicht greift' : isWarningLimit ? 'Vorstandswarnung beachten' : 'Gemeinnützigkeit sicher'}
              </span>
              <span className={isOverLimit ? 'text-rose-700' : isWarningLimit ? 'text-amber-800' : 'text-slate-400'}>
                45.000 € (Grenze)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Result Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Gesamteinnahmen (alle Sphären)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-600">
            +{totalIncome.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Summe aller Erträge nach SKR 42</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Gesamtausgaben (alle Sphären)</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-600">
            -{totalExpense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Summe aller Aufwendungen nach SKR 42</p>
        </div>

        <div className={`p-5 rounded-xl border shadow-xs ${totalNet >= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}`}>
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Jahresergebnis (Gesamtsaldo)</span>
            <ShieldCheck className={`w-4 h-4 ${totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          <div className={`text-3xl font-bold font-mono ${totalNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            {totalNet >= 0 ? 'Jahresüberschuss (Rücklagenbildung gem. § 62 AO möglich)' : 'Jahresfehlbetrag (Ausgleich aus freier Rücklage prüfen)'}
          </p>
        </div>
      </div>

      {/* 4 Tax Spheres Detailed Cards with SKR 42 Hierarchy */}
      <div className="space-y-4">
        {spheres.map((sph) => {
          const info = TAX_SPHERES[sph];
          const data = reportData[sph];
          const isExpanded = expandedSpheres[sph];
          const mainEntries = Object.entries(data.mainCategories);

          return (
            <div
              key={sph}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
            >
              {/* Sphere Header Bar */}
              <div
                onClick={() => toggleSphere(sph)}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-8 rounded-full bg-blue-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">
                        {info.name}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                        {info.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {info.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right text-xs hidden sm:block">
                    <div className="text-emerald-600 font-semibold font-mono">
                      + {data.income.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                    <div className="text-rose-600 font-semibold font-mono">
                      - {data.expense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sphären-Saldo</span>
                    <span className={`text-base font-bold font-mono ${data.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {data.net >= 0 ? '+' : ''}{data.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>

                  <div className="p-1 text-slate-400 hover:text-slate-700">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Sphere Content with SKR 42 Main & Subcategories */}
              {isExpanded && (
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-3">
                  {mainEntries.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 italic">
                      Keine Buchungen in dieser steuerlichen Sphäre im ausgewählten Zeitraum ({selectedYear}).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mainEntries.map(([mainKey, mainData]) => {
                        const isMainExpanded = expandedMainCats[mainKey] !== false; // default expanded
                        const subEntries = Object.entries(mainData.subCategories);
                        const mainNet = mainData.income - mainData.expense;

                        return (
                          <div
                            key={mainKey}
                            className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs"
                          >
                            {/* Hauptkategorie Row */}
                            <div
                              onClick={() => toggleMainCat(mainKey)}
                              className="px-4 py-3 bg-slate-100/70 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-200"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-600" />
                                <span className="font-bold text-xs text-slate-900">
                                  {mainKey}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({mainData.txCount} Buchung{mainData.txCount > 1 ? 'en' : ''})
                                </span>
                              </div>

                              <div className="flex items-center gap-5 text-xs font-mono">
                                {mainData.income > 0 && (
                                  <span className="text-emerald-600 font-semibold">
                                    +{mainData.income.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                )}
                                {mainData.expense > 0 && (
                                  <span className="text-rose-600 font-semibold">
                                    -{mainData.expense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                )}
                                <span className={`font-bold pl-2 border-l border-slate-300 ${mainNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {mainNet >= 0 ? '+' : ''}{mainNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                </span>
                                <div className="text-slate-400">
                                  {isMainExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>

                            {/* Nebenkategorien / Konten List */}
                            {isMainExpanded && (
                              <div className="divide-y divide-slate-100 bg-white">
                                {subEntries.map(([subName, subData]) => (
                                  <div
                                    key={subName}
                                    className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/70 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 pl-4">
                                      <Tag className="w-3 h-3 text-slate-400" />
                                      <span className="font-medium text-slate-800">{subName}</span>
                                      <span className="text-[10px] text-slate-400">({subData.txCount} Buchung{subData.txCount > 1 ? 'en' : ''})</span>
                                    </div>

                                    <div className="flex items-center gap-6 font-mono text-xs">
                                      {subData.income > 0 && (
                                        <span className="text-emerald-600 font-semibold">
                                          +{subData.income.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                        </span>
                                      )}
                                      {subData.expense > 0 && (
                                        <span className="text-rose-600 font-semibold">
                                          -{subData.expense.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Legal info footer per sphere */}
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span>
                      {sph === 'wirtschaftlich'
                        ? 'Hinweis: Einnahmen unter 45.000 €/Jahr bleiben ertragsteuerfrei gem. § 64 Abs. 3 AO.'
                        : sph === 'ideell'
                        ? 'Hinweis: Mittel des ideellen Bereichs unterliegen der zeitnahen Mittelverwendung gem. § 55 Abs. 1 Nr. 5 AO.'
                        : 'Ordnungsgemäße Buchführung nach DATEV SKR 42 Standard.'}
                    </span>
                    <span className="font-bold text-slate-700 font-mono">
                      Sphären-Saldo: {data.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
