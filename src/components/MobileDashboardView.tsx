/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Member, Transaction, FinancialAccount, Meeting, OnlineMembershipApplication, CalendarEvent, PermissionArea } from '../types';
import { StorageService } from '../services/storage';
import { Users, Wallet, ScrollText, CalendarDays, FileSignature, AlertTriangle, Check, ChevronRight } from 'lucide-react';
import type { MobileTab } from './MobileShell';

/**
 * Die Start-Kacheln der Mobil-Ansicht.
 * ---------------------------------------------------------------------------
 * Bewusst dieselben Berechnungen wie die Desktop-Kacheln (MembersKpiWidget,
 * LiquidityWidget, MeetingsKpiWidget, UpcomingEventsWidget in
 * DashboardWidgets/), damit hier niemals eine andere Zahl steht als am
 * Desktop. Kein eigenes, zweites Regelwerk — nur eine schlankere Darstellung
 * ohne die frei konfigurierbaren, per Drag & Drop anordenbaren Kacheln, die
 * auf einem Touchscreen ohnehin keinen Sinn ergäben.
 *
 * Jede Kachel erscheint nur, wenn mayAccess() den jeweiligen Bereich erlaubt
 * — exakt die gleiche Prüfung wie am Desktop (dort über WIDGET_AREA in
 * DashboardView.tsx).
 */

/** Heutiges Datum als YYYY-MM-DD in der LOKALEN Zeitzone. */
function localDateKey(d: Date = new Date()): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

interface MobileDashboardViewProps {
  members: Member[];
  transactions: Transaction[];
  accounts: FinancialAccount[];
  meetings: Meeting[];
  applications: OnlineMembershipApplication[];
  /** Wird von App.tsx hochgezählt, sobald ein Termin gespeichert wurde. */
  calendarRefreshKey?: number;
  mayAccess: (area: PermissionArea) => boolean;
  onNavigateTab: (tab: MobileTab) => void;
}

export function MobileDashboardView({
  members,
  transactions,
  accounts,
  meetings,
  applications,
  calendarRefreshKey,
  mayAccess,
  onNavigateTab
}: MobileDashboardViewProps) {
  // --- Mitglieder ----------------------------------------------------------
  const currentMembers = useMemo(
    () =>
      members.filter(
        m => m.status !== 'terminated' && m.membershipType !== 'ausgetreten' && m.membershipType !== 'terminated'
      ),
    [members]
  );
  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const passiveMembers = useMemo(() => members.filter(m => m.status === 'passive'), [members]);
  const currentYear = new Date().getFullYear().toString();
  const newThisYear = useMemo(
    () => members.filter(m => m.entryDate && m.entryDate.startsWith(currentYear)).length,
    [members, currentYear]
  );

  // --- Finanzen: Kontostand, identische Rechnung wie LiquidityWidget -------
  const totalLiquidity = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
      balances[acc.id] = acc.initialBalance || 0;
    });
    transactions.forEach(tx => {
      if (tx.type === 'transfer' && tx.targetAccountId) {
        if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= Math.abs(tx.amount);
        if (balances[tx.targetAccountId] !== undefined) balances[tx.targetAccountId] += Math.abs(tx.amount);
      } else if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] += tx.amount;
      }
    });
    return (Object.values(balances) as number[]).reduce((sum, b) => sum + b, 0);
  }, [accounts, transactions]);

  // --- Sitzungsdienst --------------------------------------------------------
  const { upcomingMeetings, openProtocols } = useMemo(() => {
    const today = localDateKey();
    let upcoming = 0;
    let open = 0;
    meetings.forEach(m => {
      if (m.date >= today && m.status !== 'cancelled') upcoming++;
      if (m.status === 'draft' || m.status === 'review') open++;
    });
    return { upcomingMeetings: upcoming, openProtocols: open };
  }, [meetings]);

  // --- Termine: eigener Ladevorgang, wie am Desktop (UpcomingEventsWidget) --
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setIsLoadingEvents(true);
    StorageService.getCalendarEvents()
      .then(loaded => {
        if (!cancelled) setEvents(loaded || []);
      })
      .catch(err => {
        console.warn('Termine für die mobile Übersicht konnten nicht geladen werden:', err);
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEvents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarRefreshKey]);

  const upcomingEvents = useMemo(() => {
    const today = localDateKey();
    return events
      .filter(evt => (evt.endDate || evt.startDate) >= today)
      .sort((a, b) => {
        const byDate = a.startDate.localeCompare(b.startDate);
        if (byDate !== 0) return byDate;
        return (a.startTime || '').localeCompare(b.startTime || '');
      })
      .slice(0, 3);
  }, [events]);

  // --- Offene Aufnahmeanträge ------------------------------------------------
  const pendingApplications = useMemo(() => applications.filter(a => a.status === 'pending'), [applications]);

  const hasAnyTile =
    mayAccess('members') || mayAccess('finance') || mayAccess('calendar') || mayAccess('meetings');

  return (
    <div className="p-4 space-y-3 pb-6">
      {mayAccess('online_applications') && pendingApplications.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigateTab('members')}
          className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left cursor-pointer"
        >
          <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
            <FileSignature className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-900">
              {pendingApplications.length === 1
                ? '1 neuer Aufnahmeantrag'
                : `${pendingApplications.length} neue Aufnahmeanträge`}
            </p>
            <p className="text-2xs text-amber-700">Zur Prüfung freigegeben</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
        </button>
      )}

      {mayAccess('members') && (
        <button
          type="button"
          onClick={() => onNavigateTab('members')}
          className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer active:bg-slate-50"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-2xs font-bold uppercase tracking-wider">Mitgliederbestand</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">{currentMembers.length}</div>
          <div className="flex items-center gap-3 mt-1.5 text-2xs text-slate-500">
            <span className="text-emerald-600 font-semibold">{activeMembers.length} aktiv</span>
            <span>{passiveMembers.length} passiv</span>
            {newThisYear > 0 && (
              <span className="text-blue-600 font-bold">
                +{newThisYear} ({currentYear})
              </span>
            )}
          </div>
        </button>
      )}

      {mayAccess('finance') && (
        <button
          type="button"
          onClick={() => onNavigateTab('finance')}
          className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer active:bg-slate-50"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-2xs font-bold uppercase tracking-wider">Kontostand (gesamt)</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl font-black font-mono ${totalLiquidity < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {totalLiquidity.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <p className="text-2xs text-slate-500 mt-1.5">
            {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
          </p>
        </button>
      )}

      {mayAccess('calendar') && (
        <button
          type="button"
          onClick={() => onNavigateTab('calendar')}
          className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer active:bg-slate-50"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Nächste Termine</span>
            <CalendarDays className="w-4 h-4 text-indigo-500" />
          </div>
          {isLoadingEvents ? (
            <p className="text-xs text-slate-400">Lädt…</p>
          ) : upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map(evt => (
                <div key={evt.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate max-w-[65%]">{evt.title}</span>
                  <span className="text-slate-400 font-mono text-2xs shrink-0">
                    {new Date(evt.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Keine anstehenden Termine</p>
          )}
        </button>
      )}

      {mayAccess('meetings') && (
        <button
          type="button"
          onClick={() => onNavigateTab('meetings')}
          className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer active:bg-slate-50"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-2xs font-bold uppercase tracking-wider">Sitzungsdienst</span>
            <ScrollText className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {upcomingMeetings} <span className="text-xs font-medium text-slate-400">geplant</span>
          </div>
          <div className="mt-1.5 text-2xs">
            {openProtocols > 0 ? (
              <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {openProtocols} Protokoll-Entwürfe offen
              </span>
            ) : (
              <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Alle Protokolle genehmigt
              </span>
            )}
          </div>
        </button>
      )}

      {!hasAnyTile && (
        <div className="p-6 text-center text-sm text-slate-500">
          Für dieses Konto sind hier noch keine Bereiche freigegeben.
        </div>
      )}
    </div>
  );
}
