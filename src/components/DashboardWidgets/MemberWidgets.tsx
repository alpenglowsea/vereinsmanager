import React, { useMemo } from 'react';
import { ClubDocument, Member } from '../../types';
import { erinnerungen, WARN_TAGE } from '../../utils/unterlagen';
import {
  Users,
  Layers,
  Gift,
  UserPlus,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import { mitglieder as mitgliederDaten, tageBis } from '../../utils/dashboardRegeln';
import { heuteIso } from '../../utils/kalenderRegeln';

// 1. Members KPI Widget
interface MembersKpiWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const MembersKpiWidget: React.FC<MembersKpiWidgetProps> = ({ members, onNavigate }) => {
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);
  const passiveMembers = useMemo(() => members.filter((m) => m.status === 'passive'), [members]);
  // Bestand und Zugänge wie Android: nur aktuelle Mitglieder, Jahr nach lokalem Datum (D-135, D-138)
  const heute = heuteIso();
  const currentYear = heute.slice(0, 4);
  const d = useMemo(() => mitgliederDaten(members, heute), [members, heute]);
  const newThisYear = d.neuImJahr;

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
          {d.bestand}
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

// 3. Departments Widget
interface DepartmentsWidgetProps {
  members: Member[];
  onNavigate: (tab: string) => void;
}

export const DepartmentsWidget: React.FC<DepartmentsWidgetProps> = ({ members, onNavigate }) => {
  // Nur aktuelle Mitglieder; Prozent bezogen auf sie (D-135)
  const heute = heuteIso();
  const d = useMemo(() => mitgliederDaten(members, heute), [members, heute]);

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
          {d.sparten.map(({ name: deptName, anzahl: count, prozent: deptPercent }) => {
            return (
              <div key={deptName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                    {deptName}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-2xs">
                    {count} ({deptPercent}%)
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
        <span>{d.spartenAnzahl} Sparten registriert</span>
        <span className="font-mono">{d.bestand} Mitglieder</span>
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
  // Geburtstage und Mitgliedsjubiläen (10/25/40/50 Jahre) der nächsten 30 Tage nach der
  // Rechnung des Kalenders: heute zählt mit, der 29.2. wird zum 28.2. (D-133, D-141)
  const heute = heuteIso();
  const upcomingBirthdays = useMemo(
    () =>
      mitgliederDaten(members, heute).anstehend.map((b) => ({
        item: b,
        diffDays: tageBis(heute, b.date),
        dateFormatted: `${b.date.slice(8, 10)}.${b.date.slice(5, 7)}.`
      })),
    [members, heute]
  );

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
                Geburtstage & Jubiläen
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
                key={b.item.id}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    {b.dateFormatted}
                  </span>
                  <div className="truncate">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {b.item.memberName}
                    </span>
                    <span className="text-2xs text-slate-400 block">
                      {b.item.type === 'birthday'
                        ? `wird ${b.item.years} Jahre${b.item.isMilestone ? ' 🎉' : ''}`
                        : `${b.item.years} Jahre im Verein 🎖️`}
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
          <p className="text-xs text-slate-400 py-3 text-center">In den nächsten 30 Tagen steht nichts an.</p>
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
  // Nur aktuelle Mitglieder, jüngstes Eintrittsdatum zuerst (wie Android)
  const heute = heuteIso();
  const recent = useMemo(() => mitgliederDaten(members, heute).neueste, [members, heute]);

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
                {(m.entryDate || '').slice(0, 10).split('-').reverse().join('.')}
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
  // Altersgruppen und Geschlechter der aktuellen Mitglieder, Alter auf den Tag genau (D-135, D-139)
  const heute = heuteIso();
  const d = useMemo(() => mitgliederDaten(members, heute), [members, heute]);
  const farben: Record<string, string> = {
    kids: 'bg-emerald-500',
    teens: 'bg-teal-500',
    adults: 'bg-blue-500',
    seniors: 'bg-purple-500',
    unknown: 'bg-slate-400'
  };

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

        {/* Altersgruppen wie Android; „Ohne Geburtsdatum“ nur, wenn es solche Mitglieder gibt */}
        <div className="space-y-2">
          {d.altersgruppen
            .filter((g) => g.schluessel !== 'unknown' || g.anzahl > 0)
            .map((g) => (
              <div key={g.schluessel} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{g.bezeichnung}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{g.anzahl} ({g.prozent}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${farben[g.schluessel]}`} style={{ width: `${g.prozent}%` }} />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>
          Geschlechter: {d.maenner} m • {d.frauen} w{d.divers > 0 ? ` • ${d.divers} d` : ''}
          {d.ohneAngabe > 0 ? ` • ${d.ohneAngabe} ohne Angabe` : ''}
        </span>
        <span className="font-bold text-blue-600 dark:text-blue-400">BLSV / DOSB konform</span>
      </div>
    </div>
  );
};

// Unterlagen laufen ab (Paket U): Lizenzen u. a. mit „gültig bis“ in den
// nächsten 90 Tagen oder schon abgelaufen, dazu fällige Führungszeugnisse.
interface UnterlagenWidgetProps {
  members: Member[];
  documents: ClubDocument[];
  onOpenMember?: (memberId: string) => void;
}

export const UnterlagenAblaufWidget: React.FC<UnterlagenWidgetProps> = ({ members, documents, onOpenMember }) => {
  const heute = heuteIso();
  const liste = useMemo(() => erinnerungen(members, documents, heute), [members, documents, heute]);
  const tage = (d: string) => tageBis(heute, d);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unterlagen laufen ab</h3>
          <p className="text-2xs text-slate-500 dark:text-slate-400">Lizenzen, Nachweise und Führungszeugnisse · nächste {WARN_TAGE} Tage</p>
        </div>
      </div>
      {liste.length > 0 ? (
        <div className="space-y-2">
          {liste.slice(0, 8).map((e, i) => (
            <button
              type="button"
              key={`${e.memberId}-${e.documentId ?? e.art}-${i}`}
              onClick={() => onOpenMember?.(e.memberId)}
              className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer"
            >
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-white">{e.memberName}</span>
                <span className="text-2xs text-slate-500 dark:text-slate-400 block truncate">{e.text}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                  e.abgelaufen
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                }`}
              >
                {e.abgelaufen ? `abgelaufen ${e.datum.slice(8, 10)}.${e.datum.slice(5, 7)}.${e.datum.slice(0, 4)}` : tage(e.datum) === 0 ? 'heute' : `in ${tage(e.datum)} T.`}
              </span>
            </button>
          ))}
          {liste.length > 8 && <p className="text-2xs text-slate-400 text-center">… und {liste.length - 8} weitere</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-400 py-3 text-center">In den nächsten {WARN_TAGE} Tagen läuft nichts ab.</p>
      )}
    </div>
  );
};
