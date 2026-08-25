import React from 'react';
import { Member } from '../types';
import {
  Users,
  PieChart as PieIcon,
  TrendingUp,
  Award,
  CreditCard,
  Building2,
  Calendar
} from 'lucide-react';

interface MemberAnalyticsViewProps {
  members: Member[];
}

export const MemberAnalyticsView: React.FC<MemberAnalyticsViewProps> = ({ members }) => {
  const total = members.length;
  const activeCount = members.filter(m => m.status === 'active').length;
  const passiveCount = members.filter(m => m.status === 'passive').length;
  const honoraryCount = members.filter(m => m.status === 'honorary').length;
  const terminatedCount = members.filter(m => m.status === 'terminated').length;

  // Projected Annual Fee Revenue
  const totalYearlyFee = members.reduce((sum, m) => {
    if (m.status === 'terminated') return sum;
    let multiplier = 1;
    if (m.feePeriod === 'monthly') multiplier = 12;
    else if (m.feePeriod === 'quarterly') multiplier = 4;
    else if (m.feePeriod === 'half_yearly') multiplier = 2;
    return sum + (m.feeAmount * multiplier);
  }, 0);

  // Department distribution
  const deptMap: Record<string, number> = {};
  const deptFeeMap: Record<string, number> = {};
  members.forEach(m => {
    deptMap[m.department] = (deptMap[m.department] || 0) + 1;
    let mult = m.feePeriod === 'monthly' ? 12 : m.feePeriod === 'quarterly' ? 4 : m.feePeriod === 'half_yearly' ? 2 : 1;
    deptFeeMap[m.department] = (deptFeeMap[m.department] || 0) + (m.feeAmount * mult);
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
  members.forEach(m => {
    if (typeMap[m.membershipType]) {
      typeMap[m.membershipType].count++;
    }
  });

  // Age Groups distribution
  const now = new Date();
  const ageGroups = {
    kids: { label: 'Kinder (< 14 J.)', count: 0, color: 'bg-emerald-400' },
    teens: { label: 'Jugend (14-18 J.)', count: 0, color: 'bg-teal-500' },
    adults: { label: 'Erwachsene (19-59 J.)', count: 0, color: 'bg-blue-600' },
    seniors: { label: 'Senioren (60+ J.)', count: 0, color: 'bg-amber-600' },
    unknown: { label: 'Ohne Geburtsdatum', count: 0, color: 'bg-slate-400' }
  };

  members.forEach(m => {
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
    sepa: { label: 'SEPA-Lastschrift', count: members.filter(m => m.paymentMethod === 'sepa').length, color: 'bg-blue-600' },
    transfer: { label: 'Überweisung / Selbstzahler', count: members.filter(m => m.paymentMethod === 'transfer').length, color: 'bg-indigo-500' },
    standing_order: { label: 'Dauerauftrag', count: members.filter(m => m.paymentMethod === 'standing_order').length, color: 'bg-emerald-500' },
    cash: { label: 'Barzahlung', count: members.filter(m => m.paymentMethod === 'cash').length, color: 'bg-amber-500' }
  };

  // Gender breakdown
  const genderMap = {
    m: { label: 'Männlich', count: members.filter(m => m.gender === 'm').length },
    w: { label: 'Weiblich', count: members.filter(m => m.gender === 'w').length },
    d: { label: 'Divers', count: members.filter(m => m.gender === 'd').length },
    none: { label: 'Keine Angabe', count: members.filter(m => m.gender === 'none' || !m.gender).length }
  };

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
            <span className="font-semibold text-emerald-600">{activeCount} aktiv</span> • <span>{passiveCount} passiv</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Jahresbeiträge (Soll)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900">
            {totalYearlyFee.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
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

      {/* Grid: Charts & Distributions */}
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
                      <strong className="text-slate-900">{count}</strong> ({pct}%) • <span className="font-mono">{fee.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/J.</span>
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

        {/* 2. Age Pyramid Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Altersstruktur der Mitglieder
            </h3>
          </div>

          <div className="space-y-3.5">
            {Object.entries(ageGroups).map(([key, group]) => {
              const pct = total > 0 ? Math.round((group.count / total) * 100) : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{group.label}</span>
                    <span className="text-slate-500 text-[11px]">
                      <strong className="text-slate-900">{group.count}</strong> Mitglieder ({pct}%)
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

        {/* 4. Payment Methods & Gender */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Zahlungswege & Lastschrifteinzug
            </h3>
            <div className="space-y-2">
              {Object.entries(paymentMap).map(([key, item]) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-slate-600 font-semibold">{item.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              Geschlechterverteilung
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-blue-50 text-blue-900 rounded-lg">
                <div className="font-bold font-mono text-lg">{genderMap.m.count}</div>
                <div className="text-[11px] text-blue-700 font-medium">Männlich</div>
              </div>
              <div className="p-2.5 bg-rose-50 text-rose-900 rounded-lg">
                <div className="font-bold font-mono text-lg">{genderMap.w.count}</div>
                <div className="text-[11px] text-rose-700 font-medium">Weiblich</div>
              </div>
              <div className="p-2.5 bg-purple-50 text-purple-900 rounded-lg">
                <div className="font-bold font-mono text-lg">{genderMap.d.count}</div>
                <div className="text-[11px] text-purple-700 font-medium">Divers</div>
              </div>
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                <div className="font-bold font-mono text-lg">{genderMap.none.count}</div>
                <div className="text-[11px] text-slate-500 font-medium">Keine Angabe</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
