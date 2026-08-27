import React, { useState, useMemo, useEffect } from 'react';
import { Member, ClubSettings } from '../types';
import {
  Users,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  Calendar,
  UserPlus,
  UserMinus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  ChevronDown,
  X,
  Search
} from 'lucide-react';

interface MemberAnalyticsViewProps {
  members: Member[];
  settings?: ClubSettings;
}

const MONTH_NAMES_DE = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
];

const MONTH_NAMES_FULL_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Helper to parse year from ISO/date string
const extractYear = (dateStr?: string): number | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.getFullYear();
  }
  const parts = dateStr.split(/[-./]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return parseInt(parts[0], 10);
    if (parts[2].length === 4) return parseInt(parts[2], 10);
  }
  return null;
};

// Helper to parse month (0-11) from ISO/date string
const extractMonth = (dateStr?: string): number | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.getMonth();
  }
  const parts = dateStr.split(/[-./]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return parseInt(parts[1], 10) - 1;
    if (parts[2].length === 4) return parseInt(parts[1], 10) - 1;
  }
  return null;
};

export const MemberAnalyticsView: React.FC<MemberAnalyticsViewProps> = ({ members, settings }) => {
  const currentYear = new Date().getFullYear();

  // Filter States for Fluctuation Card
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [activeListTab, setActiveListTab] = useState<'all' | 'entries' | 'exits'>('all');
  const [listSearchQuery, setListSearchQuery] = useState<string>('');

  // Filter State for Age Structure Card (by gender)
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'all' | 'm' | 'w' | 'd' | 'none'>('all');

  // Collect all distinct years where actual entries or exits occurred (filtered by department if applicable or all members)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    members.forEach((m) => {
      // Entry year
      const ey = extractYear(m.entryDate);
      if (ey && ey > 1950 && ey <= currentYear + 1) {
        yearsSet.add(ey);
      }
      // Exit year
      if (m.exitDate) {
        const xy = extractYear(m.exitDate);
        if (xy && xy > 1950 && xy <= currentYear + 1) {
          yearsSet.add(xy);
        }
      } else if (m.status === 'terminated') {
        const uy = extractYear(m.updatedAt || m.createdAt);
        if (uy && uy > 1950 && uy <= currentYear + 1) {
          yearsSet.add(uy);
        }
      }
    });

    const sorted = Array.from(yearsSet).sort((a, b) => b - a);
    return sorted;
  }, [members, currentYear]);

  // Ensure selectedYear defaults to the latest available year or currentYear if present
  useEffect(() => {
    if (selectedYear !== 'all') {
      const yearNum = parseInt(selectedYear, 10);
      if (!isNaN(yearNum) && availableYears.length > 0 && !availableYears.includes(yearNum)) {
        // Switch to the most recent available year or 'all'
        setSelectedYear(availableYears[0].toString());
      }
    }
  }, [availableYears, selectedYear]);

  // Collect all distinct departments
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    (settings?.departments || []).forEach((d) => {
      if (d && d.trim()) set.add(d.trim());
    });
    members.forEach((m) => {
      if (m.department && m.department.trim()) set.add(m.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [members, settings]);

  // Evaluate Entries and Exits based on Selected Year and Department
  const {
    filteredEntries,
    filteredExits,
    netChange,
    monthlyBreakdown,
    yearlyBreakdown,
    multiYearTrend,
    allTimelineEvents
  } = useMemo(() => {
    const isAllYears = selectedYear === 'all';
    const targetYearNum = !isAllYears ? parseInt(selectedYear, 10) : null;

    // Filtered entries
    const entries = members.filter((m) => {
      if (selectedDepartment !== 'all' && m.department !== selectedDepartment) {
        return false;
      }
      if (!m.entryDate) return false;
      const y = extractYear(m.entryDate);
      if (isAllYears) return y !== null;
      return y === targetYearNum;
    });

    // Filtered exits
    const exits = members.filter((m) => {
      if (selectedDepartment !== 'all' && m.department !== selectedDepartment) {
        return false;
      }
      if (m.exitDate) {
        const y = extractYear(m.exitDate);
        if (isAllYears) return y !== null;
        return y === targetYearNum;
      }
      // If marked as terminated without explicit exitDate, check if updated in target year
      if (m.status === 'terminated') {
        const y = extractYear(m.updatedAt || m.createdAt);
        if (isAllYears) return true;
        return y === targetYearNum;
      }
      return false;
    });

    // Net change
    const net = entries.length - exits.length;

    // Monthly breakdown: if selectedYear === 'all', aggregate across all recorded years; otherwise for the chosen target year
    const monthly = Array.from({ length: 12 }, (_, monthIdx) => {
      const mEntries = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        const em = extractMonth(m.entryDate);
        if (em !== monthIdx) return false;
        if (isAllYears) return true;
        const ey = extractYear(m.entryDate);
        return ey === targetYearNum;
      });

      const mExits = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        if (m.exitDate) {
          const xm = extractMonth(m.exitDate);
          if (xm !== monthIdx) return false;
          if (isAllYears) return true;
          const xy = extractYear(m.exitDate);
          return xy === targetYearNum;
        }
        if (m.status === 'terminated') {
          const um = extractMonth(m.updatedAt || m.createdAt);
          if (um !== monthIdx) return false;
          if (isAllYears) return true;
          const uy = extractYear(m.updatedAt || m.createdAt);
          return uy === targetYearNum;
        }
        return false;
      });

      return {
        monthIndex: monthIdx,
        monthName: MONTH_NAMES_DE[monthIdx],
        fullName: MONTH_NAMES_FULL_DE[monthIdx],
        entries: mEntries.length,
        exits: mExits.length,
        net: mEntries.length - mExits.length
      };
    });

    // Multi-year comparison trend for all recorded years (chronological for chart, reverse for table)
    const sortedYearsAsc = [...availableYears].sort((a, b) => a - b);
    const yearlyBreakdown = sortedYearsAsc.map((yr) => {
      const yEntries = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        return extractYear(m.entryDate) === yr;
      }).length;

      const yExits = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        if (m.exitDate) return extractYear(m.exitDate) === yr;
        if (m.status === 'terminated') return extractYear(m.updatedAt || m.createdAt) === yr;
        return false;
      }).length;

      return {
        year: yr,
        label: yr.toString(),
        fullName: `Jahr ${yr}`,
        entries: yEntries,
        exits: yExits,
        net: yEntries - yExits
      };
    });

    const recentYears = availableYears.slice(0, 5).reverse();
    const multiYear = recentYears.map((yr) => {
      const yEntries = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        return extractYear(m.entryDate) === yr;
      }).length;

      const yExits = members.filter((m) => {
        if (selectedDepartment !== 'all' && m.department !== selectedDepartment) return false;
        if (m.exitDate) return extractYear(m.exitDate) === yr;
        if (m.status === 'terminated') return extractYear(m.updatedAt || m.createdAt) === yr;
        return false;
      }).length;

      return {
        year: yr,
        entries: yEntries,
        exits: yExits,
        net: yEntries - yExits
      };
    });

    // All events combined with metadata for detailed list
    const entryEvents = entries.map((m) => ({
      id: `entry-${m.id}`,
      type: 'entry' as const,
      date: m.entryDate,
      member: m
    }));

    const exitEvents = exits.map((m) => ({
      id: `exit-${m.id}`,
      type: 'exit' as const,
      date: m.exitDate || m.updatedAt || m.createdAt,
      member: m
    }));

    const combined = [...entryEvents, ...exitEvents].sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });

    return {
      filteredEntries: entries,
      filteredExits: exits,
      netChange: net,
      monthlyBreakdown: monthly,
      yearlyBreakdown,
      multiYearTrend: multiYear,
      allTimelineEvents: combined
    };
  }, [members, selectedYear, selectedDepartment, availableYears, currentYear]);

  // Filtered list events based on tab and search
  const displayedEvents = useMemo(() => {
    return allTimelineEvents.filter((ev) => {
      if (activeListTab === 'entries' && ev.type !== 'entry') return false;
      if (activeListTab === 'exits' && ev.type !== 'exit') return false;
      if (listSearchQuery.trim()) {
        const q = listSearchQuery.toLowerCase().trim();
        const fullName = `${ev.member.firstName} ${ev.member.lastName}`.toLowerCase();
        const num = (ev.member.memberNumber || '').toLowerCase();
        const dept = (ev.member.department || '').toLowerCase();
        return fullName.includes(q) || num.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [allTimelineEvents, activeListTab, listSearchQuery]);

  // Overall General Statistics
  const total = members.length;
  const activeCount = members.filter((m) => m.status === 'active').length;
  const passiveCount = members.filter((m) => m.status === 'passive').length;

  // Projected Annual Fee Revenue
  const totalYearlyFee = members.reduce((sum, m) => {
    if (m.status === 'terminated') return sum;
    let multiplier = 1;
    if (m.feePeriod === 'monthly') multiplier = 12;
    else if (m.feePeriod === 'quarterly') multiplier = 4;
    else if (m.feePeriod === 'half_yearly') multiplier = 2;
    return sum + m.feeAmount * multiplier;
  }, 0);

  // Department distribution
  const deptMap: Record<string, number> = {};
  const deptFeeMap: Record<string, number> = {};
  members.forEach((m) => {
    deptMap[m.department] = (deptMap[m.department] || 0) + 1;
    const mult =
      m.feePeriod === 'monthly'
        ? 12
        : m.feePeriod === 'quarterly'
        ? 4
        : m.feePeriod === 'half_yearly'
        ? 2
        : 1;
    deptFeeMap[m.department] = (deptFeeMap[m.department] || 0) + m.feeAmount * mult;
  });
  const deptList = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);

  // Membership Type distribution
  const typeMap: Record<string, { label: string; count: number; color: string }> = {
    full: { label: 'Vollmitglied (Erwachsene)', count: 0, color: 'bg-blue-500' },
    youth: { label: 'Jugend / Kinder', count: 0, color: 'bg-emerald-500' },
    reduced: { label: 'Ermäßigt (Student/Rentner)', count: 0, color: 'bg-amber-500' },
    family: { label: 'Familienbeitrag', count: 0, color: 'bg-indigo-500' },
    supporting: { label: 'Fördermitglied / Sponsor', count: 0, color: 'bg-purple-500' },
    honorary: { label: 'Ehrenmitglied', count: 0, color: 'bg-rose-500' }
  };
  members.forEach((m) => {
    if (typeMap[m.membershipType]) {
      typeMap[m.membershipType].count++;
    }
  });

  // Gender breakdown
  const genderMap = {
    m: { label: 'Männlich', count: members.filter((m) => m.gender === 'm').length },
    w: { label: 'Weiblich', count: members.filter((m) => m.gender === 'w').length },
    d: { label: 'Divers', count: members.filter((m) => m.gender === 'd').length },
    none: { label: 'Keine Angabe', count: members.filter((m) => m.gender === 'none' || !m.gender).length }
  };

  // Filtered members for Age Groups distribution (based on selectedGenderFilter)
  const ageFilteredMembers = useMemo(() => {
    if (selectedGenderFilter === 'all') return members;
    return members.filter((m) => {
      if (selectedGenderFilter === 'none') {
        return !m.gender || m.gender === 'none';
      }
      return m.gender === selectedGenderFilter;
    });
  }, [members, selectedGenderFilter]);

  const ageFilteredTotal = ageFilteredMembers.length;

  // Age Groups distribution
  const now = new Date();
  const ageGroups = {
    kids: { label: 'Kinder (< 14 J.)', count: 0, color: 'bg-emerald-400' },
    teens: { label: 'Jugend (14-18 J.)', count: 0, color: 'bg-teal-500' },
    adults: { label: 'Erwachsene (19-59 J.)', count: 0, color: 'bg-blue-600' },
    seniors: { label: 'Senioren (60+ J.)', count: 0, color: 'bg-amber-600' },
    unknown: { label: 'Ohne Geburtsdatum', count: 0, color: 'bg-slate-400' }
  };

  ageFilteredMembers.forEach((m) => {
    if (!m.birthDate) {
      ageGroups.unknown.count++;
      return;
    }
    const bdate = new Date(m.birthDate);
    let age = now.getFullYear() - bdate.getFullYear();
    const mDiff = now.getMonth() - bdate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < bdate.getDate())) age--;

    if (age < 14) ageGroups.kids.count++;
    else if (age <= 18) ageGroups.teens.count++;
    else if (age < 60) ageGroups.adults.count++;
    else ageGroups.seniors.count++;
  });

  // Payment Methods
  const paymentMap = {
    sepa: {
      label: 'SEPA-Lastschrift',
      count: members.filter((m) => m.paymentMethod === 'sepa').length,
      color: 'bg-blue-600'
    },
    transfer: {
      label: 'Überweisung / Selbstzahler',
      count: members.filter((m) => m.paymentMethod === 'transfer').length,
      color: 'bg-indigo-500'
    },
    standing_order: {
      label: 'Dauerauftrag',
      count: members.filter((m) => m.paymentMethod === 'standing_order').length,
      color: 'bg-emerald-500'
    },
    cash: {
      label: 'Barzahlung',
      count: members.filter((m) => m.paymentMethod === 'cash').length,
      color: 'bg-amber-500'
    }
  };

  // Find max monthly value for bar height scaling
  const maxMonthlyVal = Math.max(
    ...monthlyBreakdown.map((m) => Math.max(m.entries, m.exits)),
    1
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Mitglieder Gesamt</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900">{total}</div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
            <span className="font-semibold text-emerald-600">{activeCount} aktiv</span> •{' '}
            <span>{passiveCount} passiv</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Jahresbeiträge (Soll)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900">
            {totalYearlyFee.toLocaleString('de-DE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}{' '}
            €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Prognostiziertes Beitragsaufkommen / Jahr
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">SEPA-Quote</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900">
            {total > 0 ? Math.round((paymentMap.sepa.count / total) * 100) : 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {paymentMap.sepa.count} von {total} per Lastschrift
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Sparten & Abteilungen</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900">{deptList.length}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            Größte: {deptList[0]?.[0] || '–'} ({deptList[0]?.[1] || 0})
          </div>
        </div>
      </div>

      {/* FEATURED: Fluktuation & Zu-/Abgänge (Hauptkachel mit Filtern) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header with Filters */}
        <div className="p-5 sm:p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Zu- und Abgänge (Mitglieder-Fluktuation)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mitgliederentwicklung, Ein- und Austritte im zeitlichen Verlauf filtern und analysieren
            </p>
          </div>

          {/* Interactive Filters: Jahr & Sparte */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold hidden sm:inline">Filter:</span>
            </div>

            {/* Jahr Filter */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden pr-7 cursor-pointer appearance-none shadow-2xs"
              >
                <option value="all">Alle Jahre</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr.toString()}>
                    Jahr {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Sparte Filter */}
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden pr-7 cursor-pointer appearance-none max-w-[180px] truncate shadow-2xs"
              >
                <option value="all">Alle Sparten ({availableDepartments.length})</option>
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Reset Filter Button if active */}
            {(selectedYear !== currentYear.toString() || selectedDepartment !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear(currentYear.toString());
                  setSelectedDepartment('all');
                }}
                className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
                title="Filter zurücksetzen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body: KPI Metrics + Charts + List */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* 1. Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Zugänge */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>Zugänge (Eintritte)</span>
                </div>
                <div className="text-3xl font-black font-mono text-emerald-950">
                  +{filteredEntries.length}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                  {selectedYear === 'all' ? 'Gesamter Zeitraum' : `Im Jahr ${selectedYear}`}
                  {selectedDepartment !== 'all' ? ` • ${selectedDepartment}` : ''}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>

            {/* Abgänge */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">
                  <UserMinus className="w-4 h-4 text-rose-600" />
                  <span>Abgänge (Austritte)</span>
                </div>
                <div className="text-3xl font-black font-mono text-rose-950">
                  -{filteredExits.length}
                </div>
                <div className="text-[11px] text-rose-700 mt-1 font-medium">
                  Kündigungen / Austritte
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-6 h-6" />
              </div>
            </div>

            {/* Netto Saldo / Veränderung */}
            <div
              className={`border rounded-xl p-4 flex items-center justify-between ${
                netChange > 0
                  ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                  : netChange < 0
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1">
                  {netChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-amber-600" />
                  )}
                  <span>Netto-Veränderung</span>
                </div>
                <div className="text-3xl font-black font-mono">
                  {netChange > 0 ? `+${netChange}` : netChange}
                </div>
                <div className="text-[11px] opacity-80 mt-1 font-medium">
                  {netChange > 0
                    ? 'Positives Mitgliederwachstum'
                    : netChange < 0
                    ? 'Rückläufige Mitgliederzahl'
                    : 'Bestand unverändert'}
                </div>
              </div>
              <div
                className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold text-sm font-mono ${
                  netChange > 0
                    ? 'bg-blue-100 border-blue-200 text-blue-700'
                    : netChange < 0
                    ? 'bg-amber-100 border-amber-200 text-amber-700'
                    : 'bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                {netChange > 0 ? `+${netChange}` : `${netChange}`}
              </div>
            </div>
          </div>

          {/* 2. Visual Charts Row: Monthly Breakdown & Multi-Year History */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Trend Bar Chart */}
            <div className="lg:col-span-8 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    {selectedYear === 'all'
                      ? 'Monatlicher Verlauf (Alle Jahre kumuliert)'
                      : `Monatlicher Verlauf (Jahr ${selectedYear})`}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedYear === 'all'
                      ? 'Gegenüberstellung von Eintritten (Grün) und Austritten (Rot) pro Monat (über alle erfassten Jahre summiert)'
                      : 'Gegenüberstellung von Eintritten (Grün) und Austritten (Rot) pro Monat'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                    <span>Zugänge</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                    <span>Abgänge</span>
                  </div>
                </div>
              </div>

              {/* 12 Months Columns */}
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-4 border-t border-slate-200">
                {monthlyBreakdown.map((m) => {
                  const entryHeightPct = maxMonthlyVal > 0 ? (m.entries / maxMonthlyVal) * 100 : 0;
                  const exitHeightPct = maxMonthlyVal > 0 ? (m.exits / maxMonthlyVal) * 100 : 0;

                  return (
                    <div
                      key={m.monthIndex}
                      className="flex flex-col items-center group relative"
                      title={`${m.fullName}${selectedYear === 'all' ? ' (alle Jahre)' : ` ${selectedYear}`}: +${m.entries} Zugänge, -${m.exits} Abgänge (Netto: ${m.net > 0 ? `+${m.net}` : m.net})`}
                    >
                      {/* Bar Container */}
                      <div className="w-full h-32 bg-white rounded-lg border border-slate-200 flex items-end justify-center gap-1 p-1 shadow-2xs group-hover:border-blue-400 transition-colors relative">
                        {/* Entry Bar (Green) */}
                        <div
                          style={{ height: `${Math.max(entryHeightPct, m.entries > 0 ? 12 : 0)}%` }}
                          className={`w-1/2 max-w-[12px] bg-emerald-500 rounded-t-xs transition-all duration-500 flex items-center justify-center ${
                            m.entries > 0 ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {m.entries > 0 && (
                            <span className="text-[9px] font-bold text-white font-mono leading-none pb-0.5">
                              {m.entries}
                            </span>
                          )}
                        </div>

                        {/* Exit Bar (Red) */}
                        <div
                          style={{ height: `${Math.max(exitHeightPct, m.exits > 0 ? 12 : 0)}%` }}
                          className={`w-1/2 max-w-[12px] bg-rose-500 rounded-t-xs transition-all duration-500 flex items-center justify-center ${
                            m.exits > 0 ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {m.exits > 0 && (
                            <span className="text-[9px] font-bold text-white font-mono leading-none pb-0.5">
                              {m.exits}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Month Label */}
                      <span className="text-[11px] font-bold text-slate-700 mt-1.5">
                        {m.monthName}
                      </span>

                      {/* Net Mini Badge */}
                      <span
                        className={`text-[9px] font-mono px-1 rounded font-bold ${
                          m.net > 0
                            ? 'text-emerald-700 bg-emerald-100'
                            : m.net < 0
                            ? 'text-rose-700 bg-rose-100'
                            : 'text-slate-400'
                        }`}
                      >
                        {m.net > 0 ? `+${m.net}` : m.net === 0 ? '0' : `${m.net}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Multi-Year Comparison Trend Table */}
            <div className="lg:col-span-4 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Mehrjahres-Entwicklung
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  Vergleich der erfassten Jahre {selectedDepartment !== 'all' ? `(${selectedDepartment})` : ''}
                </p>
              </div>

              <div className="space-y-2">
                {multiYearTrend.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Keine Ein- oder Austrittsdaten für die gewählte Auswahl vorhanden.
                  </div>
                ) : (
                  multiYearTrend.map((row) => (
                    <div
                      key={row.year}
                      onClick={() => setSelectedYear(row.year.toString())}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        selectedYear === row.year.toString()
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs font-mono">{row.year}</span>
                        {selectedYear === row.year.toString() && (
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded font-bold">
                            Ausgewählt
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono font-bold">
                        <span className={selectedYear === row.year.toString() ? 'text-emerald-200' : 'text-emerald-600'}>
                          +{row.entries}
                        </span>
                        <span className={selectedYear === row.year.toString() ? 'text-rose-200' : 'text-rose-600'}>
                          -{row.exits}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            selectedYear === row.year.toString()
                              ? 'bg-white/20 text-white'
                              : row.net > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.net < 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.net > 0 ? `+${row.net}` : `${row.net}`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Tipp: Klicke auf ein Jahr, um die Detailansicht umzuschalten.
              </p>
            </div>
          </div>

          {/* 3. Detailed Event Timeline & Table */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveListTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeListTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Alle Ereignisse ({allTimelineEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('entries')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    activeListTab === 'entries'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nur Zugänge ({filteredEntries.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('exits')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    activeListTab === 'exits'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Nur Abgänge ({filteredExits.length})</span>
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="In Liste suchen..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                {listSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setListSearchQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Events Table */}
            {displayedEvents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                Keine Ein- oder Austritte für den gewählten Filterzeitraum ({selectedYear === 'all' ? 'Alle Jahre' : selectedYear},{' '}
                {selectedDepartment === 'all' ? 'Alle Sparten' : selectedDepartment}) gefunden.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 pl-3">Ereignis</th>
                      <th className="p-2.5">Datum</th>
                      <th className="p-2.5">Mitglied</th>
                      <th className="p-2.5">Mitglieds-Nr.</th>
                      <th className="p-2.5">Sparte</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedEvents.map((ev) => {
                      const isEntry = ev.type === 'entry';
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 pl-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                isEntry
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isEntry ? (
                                <>
                                  <UserPlus className="w-3 h-3 text-emerald-600" />
                                  <span>Eintritt</span>
                                </>
                              ) : (
                                <>
                                  <UserMinus className="w-3 h-3 text-rose-600" />
                                  <span>Austritt</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">
                            {ev.date
                              ? new Date(ev.date).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })
                              : '–'}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">
                            {ev.member.firstName} {ev.member.lastName}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            #{ev.member.memberNumber || '–'}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                              {ev.member.department || 'Ohne Sparte'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                ev.member.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : ev.member.status === 'passive'
                                  ? 'bg-slate-100 text-slate-700'
                                  : ev.member.status === 'terminated'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {ev.member.status === 'active'
                                ? 'Aktiv'
                                : ev.member.status === 'passive'
                                ? 'Passiv'
                                : ev.member.status === 'terminated'
                                ? 'Ausgetreten'
                                : ev.member.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid: Other Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Department Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Mitglieder & Beitragsaufkommen nach Abteilung
            </h3>
          </div>

          <div className="space-y-3.5">
            {deptList.map(([dept, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const fee = deptFeeMap[dept] || 0;
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{dept}</span>
                    <span className="text-slate-500 text-[11px]">
                      <strong className="text-slate-900">{count}</strong> ({pct}%) •{' '}
                      <span className="font-mono">
                        {fee.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/J.
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Age Pyramid Breakdown with Gender Filter */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Altersstruktur der Mitglieder
              </h3>
              {selectedGenderFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedGenderFilter('all')}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                >
                  Filter aufheben
                </button>
              )}
            </div>

            {/* Interactive Gender Filter Tiles */}
            <div className="mb-4">
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                <span>Filter nach Geschlecht:</span>
                {selectedGenderFilter !== 'all' && (
                  <span className="text-blue-600 font-bold">
                    {genderMap[selectedGenderFilter].label} ({ageFilteredTotal})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {/* Männlich */}
                <button
                  type="button"
                  onClick={() => setSelectedGenderFilter(selectedGenderFilter === 'm' ? 'all' : 'm')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer text-center ${
                    selectedGenderFilter === 'm'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/40'
                      : 'bg-blue-50/70 hover:bg-blue-100 border-blue-200/60 text-blue-950'
                  }`}
                  title={selectedGenderFilter === 'm' ? 'Filter aufheben' : 'Nach männlichen Mitgliedern filtern'}
                >
                  <div className={`font-bold font-mono text-base leading-tight ${selectedGenderFilter === 'm' ? 'text-white' : 'text-blue-900'}`}>
                    {genderMap.m.count}
                  </div>
                  <div className={`text-[10px] font-medium truncate mt-0.5 ${selectedGenderFilter === 'm' ? 'text-blue-100 font-bold' : 'text-blue-700'}`}>
                    Männlich
                  </div>
                </button>

                {/* Weiblich */}
                <button
                  type="button"
                  onClick={() => setSelectedGenderFilter(selectedGenderFilter === 'w' ? 'all' : 'w')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer text-center ${
                    selectedGenderFilter === 'w'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-400/40'
                      : 'bg-rose-50/70 hover:bg-rose-100 border-rose-200/60 text-rose-950'
                  }`}
                  title={selectedGenderFilter === 'w' ? 'Filter aufheben' : 'Nach weiblichen Mitgliedern filtern'}
                >
                  <div className={`font-bold font-mono text-base leading-tight ${selectedGenderFilter === 'w' ? 'text-white' : 'text-rose-900'}`}>
                    {genderMap.w.count}
                  </div>
                  <div className={`text-[10px] font-medium truncate mt-0.5 ${selectedGenderFilter === 'w' ? 'text-rose-100 font-bold' : 'text-rose-700'}`}>
                    Weiblich
                  </div>
                </button>

                {/* Divers */}
                <button
                  type="button"
                  onClick={() => setSelectedGenderFilter(selectedGenderFilter === 'd' ? 'all' : 'd')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer text-center ${
                    selectedGenderFilter === 'd'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-400/40'
                      : 'bg-purple-50/70 hover:bg-purple-100 border-purple-200/60 text-purple-950'
                  }`}
                  title={selectedGenderFilter === 'd' ? 'Filter aufheben' : 'Nach diversen Mitgliedern filtern'}
                >
                  <div className={`font-bold font-mono text-base leading-tight ${selectedGenderFilter === 'd' ? 'text-white' : 'text-purple-900'}`}>
                    {genderMap.d.count}
                  </div>
                  <div className={`text-[10px] font-medium truncate mt-0.5 ${selectedGenderFilter === 'd' ? 'text-purple-100 font-bold' : 'text-purple-700'}`}>
                    Divers
                  </div>
                </button>

                {/* Keine Angabe */}
                <button
                  type="button"
                  onClick={() => setSelectedGenderFilter(selectedGenderFilter === 'none' ? 'all' : 'none')}
                  className={`p-2 rounded-lg border transition-all cursor-pointer text-center ${
                    selectedGenderFilter === 'none'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                  title={selectedGenderFilter === 'none' ? 'Filter aufheben' : 'Nach Mitgliedern ohne Angabe filtern'}
                >
                  <div className={`font-bold font-mono text-base leading-tight ${selectedGenderFilter === 'none' ? 'text-white' : 'text-slate-800'}`}>
                    {genderMap.none.count}
                  </div>
                  <div className={`text-[10px] font-medium truncate mt-0.5 ${selectedGenderFilter === 'none' ? 'text-slate-200 font-bold' : 'text-slate-500'}`}>
                    K. A.
                  </div>
                </button>
              </div>
            </div>

            {/* Age Group Bars */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {Object.entries(ageGroups).map(([key, group]) => {
                const pct = ageFilteredTotal > 0 ? Math.round((group.count / ageFilteredTotal) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{group.label}</span>
                      <span className="text-slate-500 text-[11px]">
                        <strong className="text-slate-900">{group.count}</strong> {group.count === 1 ? 'Mitglied' : 'Mitglieder'} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`${group.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Membership Type Share */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-600" />
              Verteilung nach Mitgliedschaftstyp
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(typeMap).map(([key, item]) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={key} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-slate-500 font-medium truncate">{item.label}</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-bold font-mono text-slate-900">{item.count}</span>
                    <span className="text-xs font-semibold text-slate-600">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className={`${item.color} h-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Payment Methods */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Zahlungswege & Lastschrifteinzug
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                {total > 0 ? Math.round((paymentMap.sepa.count / total) * 100) : 0}% SEPA
              </span>
            </div>

            {/* Itemized Colored Bar Rows */}
            <div className="space-y-3 pt-1">
              {Object.entries(paymentMap).map(([key, item]) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                        <span className="font-medium text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        <strong className="text-slate-900 font-mono">{item.count}</strong> {item.count === 1 ? 'Mitglied' : 'Mitglieder'}{' '}
                        <span className="font-semibold text-slate-700 font-mono">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
