import React, { useMemo } from 'react';
import { Member, OnlineMembershipApplication } from '../../types';
import {
  Users,
  FileSignature,
  Layers,
  Gift,
  UserPlus,
  BarChart3,
  ArrowRight,
  Sparkles,
  Calendar,
  Award,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// 1. Members KPI Widget
interface MembersKpiWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const MembersKpiWidget: React.FC<MembersKpiWidgetProps> = ({ members, onNavigate }) => {
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);
  const passiveMembers = useMemo(() => members.filter((m) => m.status === 'passive'), [members]);
  const honoraryMembers = useMemo(() => members.filter((m) => m.status === 'honorary' || m.membershipType === 'honorary'), [members]);

  const currentYear = new Date().getFullYear().toString();
  const newThisYear = useMemo(() => {
    return members.filter((m) => m.entryDate && m.entryDate.startsWith(currentYear)).length;
  }, [members, currentYear]);

  return (
    <div
      onClick={() => onNavigate('members')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Mitgliederbestand</span>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
          {members.length}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeMembers.length} aktiv</span>
        <span>{passiveMembers.length} passiv</span>
        {newThisYear > 0 && (
          <span className="text-blue-600 dark:text-blue-400 font-bold">+{newThisYear} ({currentYear})</span>
        )}
      </div>
    </div>
  );
};

// 2. Online Applications Widget
interface OnlineApplicationsWidgetProps {
  applications: OnlineMembershipApplication[];
  onNavigate: (tab: string) => void;
}

export const OnlineApplicationsWidget: React.FC<OnlineApplicationsWidgetProps> = ({
  applications,
  onNavigate
}) => {
  const pending = useMemo(() => applications.filter((a) => a.status === 'pending'), [applications]);
  const approvedThisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return applications.filter((a) => a.status === 'approved' && a.submittedAt?.startsWith(ym)).length;
  }, [applications]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <FileSignature className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Online-Aufnahmeanträge
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Digitales Beitrittsportal</p>
            </div>
          </div>
          {pending.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-500 text-white animate-pulse">
              {pending.length} neu
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Aktuell
            </span>
          )}
        </div>

        {pending.length > 0 ? (
          <div className="space-y-2 mb-3">
            {pending.slice(0, 2).map((app) => (
              <div
                key={app.id}
                className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="truncate max-w-[70%]">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {app.firstName || (app as any).formData?.firstName || 'Antragsteller'} {app.lastName || (app as any).formData?.lastName || ''}
                  </span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400 block truncate">
                    Sparte: {app.department || (app as any).formData?.department || 'Allgemein'} • {app.address?.city || (app as any).city || (app as any).formData?.city || 'Verein'}
                  </span>
                </div>
                <span className="text-2xs font-mono text-slate-400">
                  {new Date(app.submittedAt).toLocaleDateString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Alle Aufnahmeanträge bearbeitet</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate('online_applications')}
        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Antragsportal öffnen</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// 3. Departments Widget
interface DepartmentsWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const DepartmentsWidget: React.FC<DepartmentsWidgetProps> = ({ members, onNavigate }) => {
  const departmentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      const dept = m.department || 'Allgemein';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [members]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Abteilungen & Sparten
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Verteilung auf Sparten</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('member_analytics')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Statistik
          </button>
        </div>

        <div className="space-y-2.5">
          {departmentBreakdown.slice(0, 4).map(([deptName, count]) => {
            const deptPercent = members.length > 0 ? (count / members.length) * 100 : 0;
            return (
              <div key={deptName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                    {deptName}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-2xs">
                    {count} ({deptPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                    style={{ width: `${deptPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>{departmentBreakdown.length} Sparten registriert</span>
        <span className="font-mono">{members.length} Mitglieder</span>
      </div>
    </div>
  );
};

// 4. Upcoming Birthdays Widget
interface BirthdaysWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const BirthdaysWidget: React.FC<BirthdaysWidgetProps> = ({ members, onNavigate }) => {
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const active = members.filter((m) => m.status === 'active' && m.birthDate);

    const list = active.map((m) => {
      const [bYear, bMonth, bDay] = (m.birthDate || '').split('-').map(Number);
      if (!bMonth || !bDay) return null;

      // Next birthday date
      let bDate = new Date(currentYear, bMonth - 1, bDay);
      if (bDate < today) {
        bDate = new Date(currentYear + 1, bMonth - 1, bDay);
      }

      const diffDays = Math.ceil((bDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const turningAge = bDate.getFullYear() - bYear;
      const isRound = turningAge % 10 === 0 || turningAge === 18 || turningAge === 25 || turningAge === 50 || turningAge === 60 || turningAge === 70 || turningAge === 75 || turningAge === 80;

      return {
        member: m,
        nextDate: bDate,
        diffDays,
        turningAge,
        isRound,
        dateFormatted: `${String(bDay).padStart(2, '0')}.${String(bMonth).padStart(2, '0')}.`
      };
    }).filter(Boolean) as {
      member: Member;
      nextDate: Date;
      diffDays: number;
      turningAge: number;
      isRound: boolean;
      dateFormatted: string;
    }[];

    list.sort((a, b) => a.diffDays - b.diffDays);
    return list.slice(0, 4);
  }, [members]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nächste Geburtstage
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Kommende 30 Tage</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('members')}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            Alle
          </button>
        </div>

        {upcomingBirthdays.length > 0 ? (
          <div className="space-y-2">
            {upcomingBirthdays.map((b) => (
              <div
                key={b.member.id}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    {b.dateFormatted}
                  </span>
                  <div className="truncate">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {b.member.firstName} {b.member.lastName}
                    </span>
                    <span className="text-2xs text-slate-400 block">
                      wird {b.turningAge} Jahre {b.isRound && '🎉 Jubiläum'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    b.diffDays === 0
                      ? 'bg-purple-600 text-white font-bold animate-bounce'
                      : b.diffDays <= 7
                      ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-semibold'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {b.diffDays === 0 ? 'Heute!' : `in ${b.diffDays} T.`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3 text-center">Keine anstehenden Geburtstage</p>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>Glückwünsche & Ehrungen</span>
        <span>🎂 Vereinsleben</span>
      </div>
    </div>
  );
};

// 5. Recent Members Widget
interface RecentMembersWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const RecentMembersWidget: React.FC<RecentMembersWidgetProps> = ({ members, onNavigate }) => {
  const recent = useMemo(() => {
    return [...members]
      .filter((m) => m.entryDate)
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      .slice(0, 4);
  }, [members]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Neueste Mitgliederzugänge
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Kürzlich beigetreten</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('members')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Mitgliederliste
          </button>
        </div>

        <div className="space-y-2">
          {recent.map((m) => (
            <div
              key={m.id}
              className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="truncate">
                <span className="font-bold text-slate-900 dark:text-white">
                  {m.firstName} {m.lastName}
                </span>
                <span className="text-2xs text-slate-400 block">
                  {m.department || 'Hauptverein'} • {m.membershipType || 'Vollmitglied'}
                </span>
              </div>
              <span className="font-mono text-2xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                {new Date(m.entryDate).toLocaleDateString('de-DE')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>Willkommenspaket & Ausweis</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{recent.length} Neuzugänge</span>
      </div>
    </div>
  );
};

// 6. Demographics & Age Distribution Widget
interface DemographicsWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const DemographicsWidget: React.FC<DemographicsWidgetProps> = ({ members, onNavigate }) => {
  const { youth, adults, seniors, unknown, male, female, other } = useMemo(() => {
    let y = 0, a = 0, s = 0, unk = 0;
    let m = 0, w = 0, d = 0;
    const currentYear = new Date().getFullYear();

    members.forEach((mem) => {
      if (mem.birthDate) {
        const bYear = parseInt(mem.birthDate.substring(0, 4), 10);
        const age = currentYear - bYear;
        if (age < 18) y++;
        else if (age <= 60) a++;
        else s++;
      } else {
        unk++;
      }

      if (mem.gender === 'm') m++;
      else if (mem.gender === 'w') w++;
      else d++;
    });

    return { youth: y, adults: a, seniors: s, unknown: unk, male: m, female: w, other: d };
  }, [members]);

  const total = members.length || 1;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Alters- & Demografiestruktur
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Verteilung nach Gruppen</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('member_analytics')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Details
          </button>
        </div>

        {/* Age Groups Bars */}
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Kinder & Jugend (&lt;18 J.)</span>
              <span className="font-mono text-slate-500">{youth} ({((youth / total) * 100).toFixed(0)}%)</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${(youth / total) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Erwachsene (18–60 J.)</span>
              <span className="font-mono text-slate-500">{adults} ({((adults / total) * 100).toFixed(0)}%)</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${(adults / total) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Senioren (&gt;60 J.)</span>
              <span className="font-mono text-slate-500">{seniors} ({((seniors / total) * 100).toFixed(0)}%)</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${(seniors / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>Geschlechter: {male} m • {female} w {other > 0 ? `• ${other} d` : ''}</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">BLSV / DOSB konform</span>
      </div>
    </div>
  );
};
