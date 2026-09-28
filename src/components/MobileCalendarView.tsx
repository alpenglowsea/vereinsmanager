/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarEvent, CalendarEventCategory, CalendarViewMode, Member } from '../types';
import { StorageService } from '../services/storage';
import { CalendarService, ExpandedEventInstance } from '../services/calendarService';
import {
  CalendarDays,
  CalendarRange,
  Clock,
  List,
  MapPin,
  Users,
  ArrowLeft,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Gift,
  Award,
  Repeat
} from 'lucide-react';

/**
 * Termine (Mobil-Ansicht)
 * ---------------------------------------------------------------------------
 * Weiterhin bewusst nur LESEND: Termine anlegen, ändern, Einladungen
 * versenden bleibt der Desktop-Ansicht vorbehalten. Neu ist der Umschalter
 * zwischen vier Ansichten — Monat, Woche, Tag und Liste — genau wie am
 * Desktop (CalendarView.tsx), nur für den schmalen Bildschirm neu
 * zusammengesetzt statt 1:1 übernommen: Das dichte 7-Spalten-Gitter des
 * Desktops mit vollen Terminkacheln pro Zelle wäre auf einem Telefon
 * unlesbar klein. Monat und Woche zeigen deshalb nur einen Punkt pro
 * Termin; tippt man auf einen Tag, erscheint darunter dieselbe
 * ausführliche Terminliste wie in der Tagesansicht.
 *
 * Terminaufbereitung (Wiederholungen, Geburtstage/Jubiläen) läuft jetzt
 * über denselben CalendarService wie am Desktop, für alle vier Ansichten
 * einheitlich. Das behebt nebenbei einen Fehler der ursprünglichen
 * Agenda-Liste aus Schritt "Termine/Kalender": Sie filterte nur die
 * rohen Termin-Einträge, ohne Wiederholungen aufzulösen — ein
 * wöchentliches Training wäre dort nur an seinem ursprünglichen
 * Starttag aufgetaucht und danach aus "anstehend" verschwunden, obwohl
 * es sich ja jede Woche wiederholt. CalendarService.expandEventsForRange
 * löst das korrekt auf (siehe Desktop-Kalender). Die Liste bleibt dabei
 * wie am Desktop auf die nächsten 60 Tage begrenzt — nicht unbegrenzt,
 * damit sich ein jährlich wiederkehrender Termin nicht endlos weit in
 * die Zukunft auffächert.
 *
 * Geburtstage/Jubiläen (CalendarService.getSpecialItems) erscheinen nur
 * in Monat/Woche/Tag, nicht in der Liste — genau wie am Desktop, wo die
 * Listenansicht ebenfalls nur Termine zeigt.
 */

/** Heutiges Datum als YYYY-MM-DD in der LOKALEN Zeitzone. */
function todayKey(): string {
  return CalendarService.formatDate(new Date());
}

function formatDateHeading(dateKey: string): string {
  const today = todayKey();
  const tomorrow = CalendarService.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  if (dateKey === today) return 'Heute';
  if (dateKey === tomorrow) return 'Morgen';
  return CalendarService.parseLocalDate(dateKey).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/** Zeitangabe für Termin oder Terminvorkommen — beide haben dieselben drei Felder. */
function timeLabel(evt: { isAllDay: boolean; startTime?: string; endTime?: string }): string {
  if (evt.isAllDay) return 'Ganztägig';
  if (evt.startTime && evt.endTime) return `${evt.startTime} - ${evt.endTime} Uhr`;
  if (evt.startTime) return `${evt.startTime} Uhr`;
  return 'Ohne Uhrzeit';
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
const DAY_NAMES_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_NAMES_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const VIEW_MODES: { mode: CalendarViewMode; label: string; icon: typeof CalendarDays }[] = [
  { mode: 'month', label: 'Monat', icon: CalendarDays },
  { mode: 'week', label: 'Woche', icon: CalendarRange },
  { mode: 'day', label: 'Tag', icon: Clock },
  { mode: 'agenda', label: 'Liste', icon: List }
];

interface MobileCalendarViewProps {
  /** Wird von App.tsx hochgezählt, sobald ein Termin gespeichert wurde. */
  calendarRefreshKey?: number;
  /** Für Geburtstage/Jubiläen in Monat, Woche und Tag — wie am Desktop. */
  members: Member[];
}

export function MobileCalendarView({ calendarRefreshKey, members }: MobileCalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<CalendarEventCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => todayKey());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([StorageService.getCalendarEvents(), StorageService.getCalendarCategories()])
      .then(([loadedEvents, loadedCategories]) => {
        if (cancelled) return;
        setEvents(loadedEvents || []);
        setCategories(loadedCategories || []);
      })
      .catch(err => {
        console.warn('Termine für die mobile Ansicht konnten nicht geladen werden:', err);
        if (!cancelled) {
          setEvents([]);
          setCategories([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarRefreshKey]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CalendarEventCategory>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const todayStr = todayKey();

  // Sichtbarer Zeitraum je Ansicht — dieselbe Berechnung wie am Desktop
  // (CalendarView.tsx), damit Monat/Woche/Tag exakt dieselben Grenzen
  // (Montag als Wochenanfang usw.) verwenden.
  const { rangeStart, rangeEnd, headerTitle } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstOfMonth = new Date(y, m, 1);
      const firstDayOfWeek = (firstOfMonth.getDay() + 6) % 7; // 0 = Mo
      const start = new Date(firstOfMonth);
      start.setDate(start.getDate() - firstDayOfWeek);

      const lastOfMonth = new Date(y, m + 1, 0);
      const lastDayOfWeek = (lastOfMonth.getDay() + 6) % 7;
      const end = new Date(lastOfMonth);
      end.setDate(end.getDate() + (6 - lastDayOfWeek));

      return {
        rangeStart: CalendarService.formatDate(start),
        rangeEnd: CalendarService.formatDate(end),
        headerTitle: `${MONTH_NAMES[m]} ${y}`
      };
    }

    if (viewMode === 'week') {
      const curDayOfWeek = (currentDate.getDay() + 6) % 7;
      const start = new Date(currentDate);
      start.setDate(start.getDate() - curDayOfWeek);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const d = new Date(Date.UTC(y, m, currentDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

      return {
        rangeStart: CalendarService.formatDate(start),
        rangeEnd: CalendarService.formatDate(end),
        headerTitle: `KW ${weekNo} · ${start.getDate()}.${start.getMonth() + 1}.–${end.getDate()}.${end.getMonth() + 1}.`
      };
    }

    if (viewMode === 'day') {
      const curStr = CalendarService.formatDate(currentDate);
      return {
        rangeStart: curStr,
        rangeEnd: curStr,
        headerTitle: `${DAY_NAMES_FULL[currentDate.getDay()]}, ${currentDate.getDate()}. ${MONTH_NAMES[m]} ${y}`
      };
    }

    // Liste: nächste 60 Tage ab heute — wie die Desktop-Agenda-Ansicht.
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 60);
    return {
      rangeStart: CalendarService.formatDate(start),
      rangeEnd: CalendarService.formatDate(end),
      headerTitle: ''
    };
  }, [viewMode, currentDate]);

  // Wiederholungen korrekt auflösen (siehe Erklärung oben) — für alle vier
  // Ansichten aus derselben Quelle.
  const expandedEvents = useMemo(
    () => CalendarService.expandEventsForRange(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd]
  );

  const specialItems = useMemo(() => {
    const all = CalendarService.getSpecialItems(members, currentDate.getFullYear());
    return all.filter(item => item.date >= rangeStart && item.date <= rangeEnd);
  }, [members, currentDate, rangeStart, rangeEnd]);

  const eventsForDay = (dateStr: string) => expandedEvents.filter(e => e.date === dateStr);
  const specialsForDay = (dateStr: string) => specialItems.filter(s => s.date === dateStr);

  // Liste: nach Starttag gruppiert.
  const groupedByDate = useMemo(() => {
    if (viewMode !== 'agenda') return [];
    const groups: { dateKey: string; items: ExpandedEventInstance[] }[] = [];
    expandedEvents.forEach(evt => {
      const last = groups[groups.length - 1];
      if (last && last.dateKey === evt.date) {
        last.items.push(evt);
      } else {
        groups.push({ dateKey: evt.date, items: [evt] });
      }
    });
    return groups;
  }, [viewMode, expandedEvents]);

  // Monatsgitter: 42 Zellen inkl. Rand-Tage des Vor-/Folgemonats, je nur ein
  // Punkt pro Termin statt der vollen Kachel des Desktops.
  const monthGridDays = useMemo(() => {
    if (viewMode !== 'month') return [];
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dotColors: string[];
      hasMore: boolean;
      hasSpecial: boolean;
    }[] = [];

    const start = CalendarService.parseLocalDate(rangeStart);
    const end = CalendarService.parseLocalDate(rangeEnd);
    const curMonth = currentDate.getMonth();
    const cur = new Date(start);

    while (cur <= end) {
      const dateStr = CalendarService.formatDate(cur);
      const dayEvents = eventsForDay(dateStr);
      const daySpecials = specialsForDay(dateStr);
      days.push({
        dateStr,
        dayNumber: cur.getDate(),
        isCurrentMonth: cur.getMonth() === curMonth,
        isToday: dateStr === todayStr,
        dotColors: dayEvents.slice(0, 3).map(e => categoryMap.get(e.originalEvent.categoryId)?.color || '#3b82f6'),
        hasMore: dayEvents.length > 3,
        hasSpecial: daySpecials.length > 0
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, rangeStart, rangeEnd, currentDate, todayStr, expandedEvents, specialItems, categoryMap]);

  // Wochenstreifen: 7 Tage, ebenfalls nur Punkte statt voller Kacheln.
  const weekStripDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const days: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; eventCount: number; hasSpecial: boolean }[] = [];
    const start = CalendarService.parseLocalDate(rangeStart);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = CalendarService.formatDate(d);
      days.push({
        dateStr,
        dayName: DAY_NAMES_SHORT[i],
        dayNumber: d.getDate(),
        isToday: dateStr === todayStr,
        eventCount: eventsForDay(dateStr).length,
        hasSpecial: specialsForDay(dateStr).length > 0
      });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, rangeStart, todayStr, expandedEvents, specialItems]);

  const selectedDayInRange = selectedDayKey >= rangeStart && selectedDayKey <= rangeEnd ? selectedDayKey : null;

  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDayKey(CalendarService.formatDate(now));
  };

  const selectedEvent = selectedId ? events.find(e => e.id === selectedId) ?? null : null;

  if (selectedEvent) {
    const cat = categoryMap.get(selectedEvent.categoryId);
    const mapsUrl =
      selectedEvent.locationLat !== undefined && selectedEvent.locationLng !== undefined
        ? `https://www.google.com/maps/search/?api=1&query=${selectedEvent.locationLat},${selectedEvent.locationLng}`
        : null;

    return (
      <div className="p-4 space-y-4 pb-6">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </button>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          {cat && (
            <span className={`inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${cat.badgeBg} ${cat.badgeText}`}>
              {cat.name}
            </span>
          )}
          <p className="text-lg font-bold text-slate-900">{selectedEvent.title}</p>
          {selectedEvent.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedEvent.description}</p>
          )}
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{formatDateHeading(selectedEvent.startDate)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{timeLabel(selectedEvent)}</span>
          </div>
          {selectedEvent.location && (
            <div className="flex items-start gap-3 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span>{selectedEvent.location}</span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 text-xs font-semibold mt-1 underline"
                  >
                    In Karten öffnen <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
          {selectedEvent.participants.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Users className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                {selectedEvent.participants.length}{' '}
                {selectedEvent.participants.length === 1 ? 'Teilnehmer' : 'Teilnehmer/innen'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ausführliche Terminliste für genau einen Tag — von Monat, Woche und Tag
  // gemeinsam genutzt, damit ein angetippter Tag überall gleich aussieht.
  const renderDayDetailList = (dateStr: string) => {
    const dayEvents = eventsForDay(dateStr);
    const daySpecials = specialsForDay(dateStr);

    if (dayEvents.length === 0 && daySpecials.length === 0) {
      return <p className="text-center text-xs text-slate-400 py-6">Keine Termine an diesem Tag</p>;
    }

    return (
      <div className="space-y-1.5">
        {daySpecials.map(item => (
          <div
            key={item.id}
            title={item.details}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              item.type === 'birthday'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
          >
            {item.type === 'birthday' ? (
              <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            )}
            <span className="truncate">{item.title}</span>
          </div>
        ))}

        {dayEvents.map(inst => {
          const e = inst.originalEvent;
          const cat = categoryMap.get(e.categoryId);
          return (
            <button
              key={inst.instanceId}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className="w-full flex items-start justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer active:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  {inst.isRecurrenceInstance && <Repeat className="w-3 h-3 text-slate-400 shrink-0" />}
                  <span className="truncate">{e.title}</span>
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">{timeLabel(inst)}</p>
                {e.location && <p className="text-2xs text-slate-400 truncate mt-0.5">{e.location}</p>}
              </div>
              {cat && (
                <span className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${cat.badgeBg} ${cat.badgeText}`}>
                  {cat.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Umschalter Monat / Woche / Tag / Liste */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
        {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              viewMode === mode ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-slate-400 py-8">Lädt…</p>
      ) : viewMode === 'agenda' ? (
        groupedByDate.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Keine anstehenden Termine in den nächsten 60 Tagen</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(group => (
              <div key={group.dateKey}>
                <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  {formatDateHeading(group.dateKey)}
                </p>
                <div className="space-y-1.5">
                  {group.items.map(inst => {
                    const e = inst.originalEvent;
                    const cat = categoryMap.get(e.categoryId);
                    return (
                      <button
                        key={inst.instanceId}
                        type="button"
                        onClick={() => setSelectedId(e.id)}
                        className="w-full flex items-start justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer active:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            {inst.isRecurrenceInstance && <Repeat className="w-3 h-3 text-slate-400 shrink-0" />}
                            <span className="truncate">{e.title}</span>
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5">{timeLabel(inst)}</p>
                          {e.location && <p className="text-2xs text-slate-400 truncate mt-0.5">{e.location}</p>}
                        </div>
                        {cat && (
                          <span
                            className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${cat.badgeBg} ${cat.badgeText}`}
                          >
                            {cat.name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {/* Vor/Zurück-Navigation samt "Heute"-Sprung — für Monat, Woche, Tag */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goPrev}
              className="p-2 rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 cursor-pointer"
              title="Zurück"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-slate-900 text-center">{headerTitle}</span>
              <button
                type="button"
                onClick={goToday}
                className="text-2xs font-bold text-blue-600 cursor-pointer"
              >
                Heute
              </button>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="p-2 rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 cursor-pointer"
              title="Weiter"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {viewMode === 'month' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center py-1.5">
                {DAY_NAMES_SHORT.map(d => (
                  <div key={d} className="text-[10px] font-bold text-slate-500">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {monthGridDays.map(day => (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => setSelectedDayKey(day.dateStr)}
                    className={`aspect-square flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      day.dateStr === selectedDayKey ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        day.isToday ? 'bg-blue-600 text-white' : day.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    <div className="flex items-center gap-0.5 h-1.5">
                      {day.dotColors.map((c, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                      {day.hasMore && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                      {day.hasSpecial && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div className="grid grid-cols-7 gap-1">
              {weekStripDays.map(d => (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDayKey(d.dateStr)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border cursor-pointer ${
                    d.dateStr === selectedDayKey ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{d.dayName}</span>
                  <span
                    className={`text-sm font-black w-7 h-7 rounded-full flex items-center justify-center ${
                      d.isToday ? 'bg-blue-600 text-white' : 'text-slate-800'
                    }`}
                  >
                    {d.dayNumber}
                  </span>
                  <span className="flex items-center gap-0.5 h-1.5">
                    {d.eventCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {d.hasSpecial && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Tagesliste: für Monat/Woche der angetippte Tag, für Tag immer der angezeigte Tag */}
          {viewMode === 'day' ? (
            renderDayDetailList(rangeStart)
          ) : (
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                {selectedDayInRange ? formatDateHeading(selectedDayInRange) : 'Termine'}
              </p>
              {selectedDayInRange ? (
                renderDayDetailList(selectedDayInRange)
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">Tippen Sie auf einen Tag, um seine Termine zu sehen.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
