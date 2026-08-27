import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarEvent,
  CalendarEventCategory,
  CalendarViewMode,
  ClubSettings,
  Member,
  SpecialCalendarItem,
  UserPermissions
} from '../types';
import { CalendarService, ExpandedEventInstance } from '../services/calendarService';
import { StorageService } from '../services/storage';
import { CalendarEventModal } from './CalendarEventModal';
import { CalendarCategoryModal } from './CalendarCategoryModal';
import { CalendarImportModal } from './CalendarImportModal';
import { CalendarExportModal } from './CalendarExportModal';
import { CalendarInviteModal } from './CalendarInviteModal';
import { OpenStreetMapModal } from './OpenStreetMapModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  MapPin,
  Clock,
  Users,
  Repeat,
  Download,
  Upload,
  Palette,
  Gift,
  Award,
  Layers,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  List,
  Eye,
  Edit2,
  Trash2,
  Mail,
  Compass,
  X,
  Sparkles
} from 'lucide-react';

interface CalendarViewProps {
  members: Member[];
  settings: ClubSettings;
  userPermissions?: UserPermissions;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  members,
  settings,
  userPermissions
}) => {
  // Calendar Events & Categories State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<CalendarEventCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // View & Navigation State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [showBirthdays, setShowBirthdays] = useState<boolean>(true);
  const [showAnniversaries, setShowAnniversaries] = useState<boolean>(true);

  // Modal States
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>('');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const [inviteModalEvent, setInviteModalEvent] = useState<CalendarEvent | null>(null);

  const [osmModalData, setOsmModalData] = useState<{
    isOpen: boolean;
    title: string;
    location: string;
    lat?: number;
    lng?: number;
  }>({
    isOpen: false,
    title: '',
    location: ''
  });

  const [selectedDetailEvent, setSelectedDetailEvent] = useState<CalendarEvent | null>(null);

  // Load Data
  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const [storedEvents, storedCategories] = await Promise.all([
        StorageService.getCalendarEvents(),
        StorageService.getCalendarCategories()
      ]);
      setEvents(storedEvents);
      setCategories(storedCategories);
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  // Category Map for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, CalendarEventCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Available departments from settings and members
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>(settings.departments || []);
    members.forEach((m) => {
      if (m.department) depts.add(m.department);
    });
    return Array.from(depts).filter(Boolean).sort();
  }, [settings.departments, members]);

  // Calculate Date Range based on viewMode and currentDate
  const { rangeStart, rangeEnd, headerTitle } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === 'month') {
      // First day of month
      const firstOfMonth = new Date(y, m, 1);
      // Determine Monday of first week
      const firstDayOfWeek = (firstOfMonth.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const start = new Date(firstOfMonth);
      start.setDate(start.getDate() - firstDayOfWeek);

      // Last day of month
      const lastOfMonth = new Date(y, m + 1, 0);
      const lastDayOfWeek = (lastOfMonth.getDay() + 6) % 7;
      const end = new Date(lastOfMonth);
      end.setDate(end.getDate() + (6 - lastDayOfWeek));

      const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
      ];

      return {
        rangeStart: CalendarService.formatDate(start),
        rangeEnd: CalendarService.formatDate(end),
        headerTitle: `${monthNames[m]} ${y}`
      };
    } else if (viewMode === 'week') {
      const curDayOfWeek = (currentDate.getDay() + 6) % 7;
      const start = new Date(currentDate);
      start.setDate(start.getDate() - curDayOfWeek);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      // Week number (KW)
      const d = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

      const startDay = start.getDate();
      const startMonth = start.getMonth() + 1;
      const endDay = end.getDate();
      const endMonth = end.getMonth() + 1;

      return {
        rangeStart: CalendarService.formatDate(start),
        rangeEnd: CalendarService.formatDate(end),
        headerTitle: `KW ${weekNo} • ${startDay}.${startMonth}. – ${endDay}.${endMonth}.${y}`
      };
    } else if (viewMode === 'day') {
      const curStr = CalendarService.formatDate(currentDate);
      const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
      const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
      ];
      return {
        rangeStart: curStr,
        rangeEnd: curStr,
        headerTitle: `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()}. ${monthNames[m]} ${y}`
      };
    } else {
      // Agenda / List view: Next 60 days
      const start = new Date(currentDate);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 60);
      return {
        rangeStart: CalendarService.formatDate(start),
        rangeEnd: CalendarService.formatDate(end),
        headerTitle: `Terminübersicht ab ${start.toLocaleDateString('de-DE')}`
      };
    }
  }, [viewMode, currentDate]);

  // Expand Recurring and Single Events for the current view range
  const expandedEvents = useMemo(() => {
    return CalendarService.expandEventsForRange(events, rangeStart, rangeEnd);
  }, [events, rangeStart, rangeEnd]);

  // Compute Special Items (Birthdays & Anniversaries)
  const specialItems = useMemo(() => {
    const year = currentDate.getFullYear();
    const all = CalendarService.getSpecialItems(members, year);
    return all.filter((item) => item.date >= rangeStart && item.date <= rangeEnd);
  }, [members, currentDate, rangeStart, rangeEnd]);

  // Filter Expanded Events by Search, Category, and Department
  const filteredEventInstances = useMemo(() => {
    return expandedEvents.filter((inst) => {
      const e = inst.originalEvent;

      // Category filter
      if (selectedCategoryFilter !== 'all' && e.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // Department filter
      if (selectedDepartmentFilter !== 'all' && e.department !== 'all' && e.department !== selectedDepartmentFilter) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const cat = categoryMap.get(e.categoryId)?.name || '';
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchLoc = (e.location || '').toLowerCase().includes(q);
        const matchCat = cat.toLowerCase().includes(q);
        const matchDept = (e.department || '').toLowerCase().includes(q);
        const matchParticipants = (e.participants || []).some((p) => p.memberName.toLowerCase().includes(q));

        if (!matchTitle && !matchDesc && !matchLoc && !matchCat && !matchDept && !matchParticipants) {
          return false;
        }
      }

      return true;
    });
  }, [expandedEvents, selectedCategoryFilter, selectedDepartmentFilter, searchTerm, categoryMap]);

  // Navigation handlers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 30);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 30);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // CRUD Event handlers
  const handleSaveEvent = async (eventToSave: CalendarEvent) => {
    await StorageService.saveCalendarEvent(eventToSave);
    await loadCalendarData();
  };

  const handleDeleteEvent = async (id: string) => {
    await StorageService.deleteCalendarEvent(id);
    if (selectedDetailEvent?.id === id) {
      setSelectedDetailEvent(null);
    }
    await loadCalendarData();
  };

  const handleSaveCategory = async (catToSave: CalendarEventCategory) => {
    await StorageService.saveCalendarCategory(catToSave);
    await loadCalendarData();
  };

  const handleDeleteCategory = async (id: string) => {
    await StorageService.deleteCalendarCategory(id);
    await loadCalendarData();
  };

  const handleImportSuccess = async (importedEvents: CalendarEvent[]) => {
    await StorageService.batchSaveCalendarEvents(importedEvents);
    await loadCalendarData();
  };

  const handleOpenAddEventModal = (dateStr?: string) => {
    setEditingEvent(null);
    setModalInitialDate(dateStr || CalendarService.formatDate(currentDate));
    setIsEventModalOpen(true);
  };

  const handleOpenEditEventModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleOpenOpenStreetMap = (e: CalendarEvent) => {
    setOsmModalData({
      isOpen: true,
      title: e.title,
      location: e.location || '',
      lat: e.locationLat,
      lng: e.locationLng
    });
  };

  const todayStr = CalendarService.formatDate(new Date());

  // Generate calendar grid days for Month View
  const monthGridDays = useMemo(() => {
    if (viewMode !== 'month') return [];

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: ExpandedEventInstance[];
      birthdays: SpecialCalendarItem[];
      anniversaries: SpecialCalendarItem[];
    }[] = [];

    const start = CalendarService.parseLocalDate(rangeStart);
    const end = CalendarService.parseLocalDate(rangeEnd);
    const curMonth = currentDate.getMonth();

    let cur = new Date(start);
    while (cur <= end) {
      const dateStr = CalendarService.formatDate(cur);
      const isCurrentMonth = cur.getMonth() === curMonth;
      const isToday = dateStr === todayStr;

      const dayEvents = filteredEventInstances.filter((e) => e.date === dateStr);
      const dayBirthdays = showBirthdays ? specialItems.filter((s) => s.type === 'birthday' && s.date === dateStr) : [];
      const dayAnniversaries = showAnniversaries ? specialItems.filter((s) => s.type === 'anniversary' && s.date === dateStr) : [];

      days.push({
        dateStr,
        dayNumber: cur.getDate(),
        isCurrentMonth,
        isToday,
        events: dayEvents,
        birthdays: dayBirthdays,
        anniversaries: dayAnniversaries
      });

      cur.setDate(cur.getDate() + 1);
    }

    return days;
  }, [viewMode, rangeStart, rangeEnd, currentDate, todayStr, filteredEventInstances, showBirthdays, showAnniversaries, specialItems]);

  // Week Grid columns
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];

    const days: {
      dateStr: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      events: ExpandedEventInstance[];
      birthdays: SpecialCalendarItem[];
      anniversaries: SpecialCalendarItem[];
    }[] = [];

    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const start = CalendarService.parseLocalDate(rangeStart);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = CalendarService.formatDate(d);
      const isToday = dateStr === todayStr;

      const dayEvents = filteredEventInstances.filter((e) => e.date === dateStr);
      const dayBirthdays = showBirthdays ? specialItems.filter((s) => s.type === 'birthday' && s.date === dateStr) : [];
      const dayAnniversaries = showAnniversaries ? specialItems.filter((s) => s.type === 'anniversary' && s.date === dateStr) : [];

      days.push({
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday,
        events: dayEvents,
        birthdays: dayBirthdays,
        anniversaries: dayAnniversaries
      });
    }

    return days;
  }, [viewMode, rangeStart, todayStr, filteredEventInstances, showBirthdays, showAnniversaries, specialItems]);

  return (
    <div className="space-y-6">
      {/* Top Header & View Controls */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Vorheriger Zeitraum"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Nächster Zeitraum"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
              >
                Heute
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {headerTitle}
            </h2>
          </div>

          {/* View Modes & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Monat</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'week'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Woche</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'day'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'agenda'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>
            </div>

            {/* Actions: Categories, Import, Export, + Neuer Termin */}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-50 transition-colors"
              title="Terminarten und Farben verwalten"
            >
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Kategorien</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-50 transition-colors"
              title="iCal oder CSV importieren"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-50 transition-colors"
              title="Kalender als iCal / CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddEventModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              <span>Neuer Termin</span>
            </button>
          </div>
        </div>

        {/* Sub-Toolbar & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Search & Department */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Termine, Orte, Teilnehmer suchen..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Department dropdown */}
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="all">Alle Abteilungen</option>
              {availableDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Pills: Birthdays & Anniversaries */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBirthdays(!showBirthdays)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                showBirthdays
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
              title="Geburtstage der Mitglieder im Kalender anzeigen"
            >
              <Gift className="w-3.5 h-3.5 text-amber-500" />
              <span>Geburtstage</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAnniversaries(!showAnniversaries)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                showAnniversaries
                  ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
              title="Vereins-Jubiläen der Mitglieder anzeigen"
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Jubiläen</span>
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Alle ({events.length})
          </button>
          {categories.map((cat) => {
            const count = events.filter((e) => e.categoryId === cat.id).length;
            const isSelected = selectedCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'text-white shadow-xs scale-102'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={isSelected ? { backgroundColor: cat.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#ffffff' : cat.color }}
                />
                <span>{cat.name}</span>
                <span className="opacity-75 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. MONTH VIEW */}
      {/* ==================================================================== */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-2.5 text-xs font-bold text-slate-600">
            <div>Montag</div>
            <div>Dienstag</div>
            <div>Mittwoch</div>
            <div>Donnerstag</div>
            <div>Freitag</div>
            <div className="text-blue-700">Samstag</div>
            <div className="text-red-700">Sonntag</div>
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100/40">
            {monthGridDays.map((day) => {
              const hasSpecial = day.birthdays.length > 0 || day.anniversaries.length > 0;
              return (
                <div
                  key={day.dateStr}
                  onClick={(e) => {
                    // Clicking on empty area of cell opens new event modal
                    if ((e.target as HTMLElement).tagName === 'DIV' || (e.target as HTMLElement).tagName === 'SPAN') {
                      handleOpenAddEventModal(day.dateStr);
                    }
                  }}
                  className={`min-h-[110px] sm:min-h-[130px] p-1.5 sm:p-2 bg-white flex flex-col justify-between transition-colors hover:bg-blue-50/20 group relative cursor-pointer ${
                    !day.isCurrentMonth ? 'bg-slate-50/50 text-slate-300' : ''
                  } ${day.isToday ? 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/10' : ''}`}
                >
                  {/* Cell Day Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        day.isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : day.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Add button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddEventModal(day.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-opacity"
                      title="Termin an diesem Tag anlegen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Events Container */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {/* Birthdays & Anniversaries */}
                    {day.birthdays.map((b) => (
                      <div
                        key={b.id}
                        title={b.details}
                        className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold truncate flex items-center gap-1 shadow-2xs"
                      >
                        <Gift className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        <span className="truncate">{b.title}</span>
                      </div>
                    ))}

                    {day.anniversaries.map((a) => (
                      <div
                        key={a.id}
                        title={a.details}
                        className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold truncate flex items-center gap-1 shadow-2xs"
                      >
                        <Award className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                        <span className="truncate">{a.title}</span>
                      </div>
                    ))}

                    {/* Standard Calendar Events */}
                    {day.events.slice(0, 3).map((inst) => {
                      const e = inst.originalEvent;
                      const cat = categoryMap.get(e.categoryId);
                      const catColor = cat?.color || '#3b82f6';

                      return (
                        <div
                          key={inst.instanceId}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDetailEvent(e);
                          }}
                          className="px-1.5 py-1 rounded-md text-[11px] font-bold text-white truncate flex items-center justify-between gap-1 shadow-2xs hover:brightness-90 transition-all cursor-pointer"
                          style={{ backgroundColor: catColor }}
                          title={`${e.title}${e.startTime ? ` (${e.startTime} Uhr)` : ''}${e.location ? ` - ${e.location}` : ''}`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            {inst.isRecurrenceInstance && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                            {inst.startTime && <span className="font-mono text-[9px] opacity-90">{inst.startTime}</span>}
                            <span className="truncate">{e.title}</span>
                          </div>
                          {e.location && <MapPin className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                        </div>
                      );
                    })}

                    {day.events.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate(CalendarService.parseLocalDate(day.dateStr));
                          setViewMode('day');
                        }}
                        className="w-full text-center text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 py-0.5 rounded-sm"
                      >
                        +{day.events.length - 3} weitere
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. WEEK VIEW */}
      {/* ==================================================================== */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          {/* Week column headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 divide-x divide-slate-200 text-center py-3">
            {weekDays.map((d) => (
              <div
                key={d.dateStr}
                onClick={() => {
                  setCurrentDate(CalendarService.parseLocalDate(d.dateStr));
                  setViewMode('day');
                }}
                className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${
                  d.isToday ? 'bg-blue-50/80 font-black' : ''
                }`}
              >
                <div className="text-xs font-bold text-slate-500 uppercase">{d.dayName}</div>
                <div
                  className={`text-lg font-black mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full ${
                    d.isToday ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-800'
                  }`}
                >
                  {d.dayNumber}
                </div>
              </div>
            ))}
          </div>

          {/* Week Columns Grid */}
          <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[480px]">
            {weekDays.map((d) => (
              <div
                key={d.dateStr}
                className={`p-2 space-y-2 flex flex-col justify-start ${d.isToday ? 'bg-blue-50/15' : 'bg-white'}`}
              >
                {/* Special items */}
                {d.birthdays.map((b) => (
                  <div
                    key={b.id}
                    title={b.details}
                    className="p-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="line-clamp-2">{b.title}</span>
                  </div>
                ))}

                {d.anniversaries.map((a) => (
                  <div
                    key={a.id}
                    title={a.details}
                    className="p-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="line-clamp-2">{a.title}</span>
                  </div>
                ))}

                {/* Day events */}
                {d.events.map((inst) => {
                  const e = inst.originalEvent;
                  const cat = categoryMap.get(e.categoryId);
                  const catColor = cat?.color || '#3b82f6';

                  return (
                    <div
                      key={inst.instanceId}
                      onClick={() => setSelectedDetailEvent(e)}
                      className="p-2.5 rounded-xl text-white shadow-2xs hover:brightness-95 transition-all cursor-pointer space-y-1.5"
                      style={{ backgroundColor: catColor }}
                    >
                      <div className="flex items-center justify-between text-[11px] opacity-90">
                        <span className="font-mono font-bold">{inst.isAllDay ? 'Ganztägig' : `${inst.startTime || ''} Uhr`}</span>
                        {inst.isRecurrenceInstance && <Repeat className="w-3 h-3" />}
                      </div>

                      <div className="font-bold text-xs line-clamp-2 leading-tight">
                        {e.title}
                      </div>

                      {e.location && (
                        <div className="flex items-center gap-1 text-[10px] opacity-85 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </div>
                      )}

                      {e.participants && e.participants.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] opacity-85">
                          <Users className="w-2.5 h-2.5 shrink-0" />
                          <span>{e.participants.length} Teilnehmer</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {d.events.length === 0 && d.birthdays.length === 0 && d.anniversaries.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenAddEventModal(d.dateStr)}
                    className="w-full h-24 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl flex items-center justify-center text-slate-300 hover:text-blue-500 transition-colors"
                    title="Termin anlegen"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. DAY VIEW */}
      {/* ==================================================================== */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day Special Celebrations Banner */}
          {specialItems.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-50 via-amber-100/70 to-purple-50 rounded-2xl border border-amber-200 shadow-xs flex flex-wrap items-center gap-3">
              <Sparkles className="w-6 h-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Besondere Anlässe an diesem Tag ({specialItems.length})
                </h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {specialItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-amber-200 text-xs font-bold text-slate-900 shadow-2xs"
                    >
                      {item.type === 'birthday' ? <Gift className="w-3.5 h-3.5 text-amber-600" /> : <Award className="w-3.5 h-3.5 text-purple-600" />}
                      <span>{item.title}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Day Schedule Cards */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
            {filteredEventInstances.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">Keine Termine für diesen Tag geplant</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Klicken Sie auf den Button unten, um einen neuen Vereinstermin, ein Training oder ein Spiel anzulegen.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddEventModal(rangeStart)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Termin für diesen Tag anlegen</span>
                </button>
              </div>
            ) : (
              filteredEventInstances.map((inst) => {
                const e = inst.originalEvent;
                const cat = categoryMap.get(e.categoryId);
                const catColor = cat?.color || '#3b82f6';

                return (
                  <div
                    key={inst.instanceId}
                    className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Color strip & Time / Title */}
                    <div className="flex items-start space-x-4">
                      <div
                        className="w-3 h-14 rounded-full shrink-0 shadow-xs mt-0.5"
                        style={{ backgroundColor: catColor }}
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs"
                            style={{ backgroundColor: catColor }}
                          >
                            {cat?.name || 'Allgemein'}
                          </span>
                          {e.department && e.department !== 'all' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              Abteilung: {e.department}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {inst.isAllDay ? 'Ganztägig' : `${inst.startTime || ''} - ${inst.endTime || ''} Uhr`}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{e.title}</h3>

                        {e.description && (
                          <p className="text-xs text-slate-600 max-w-2xl">{e.description}</p>
                        )}

                        {/* Location with OpenStreetMap button */}
                        {e.location && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-medium">{e.location}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenOpenStreetMap(e)}
                              className="text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-0.5 ml-1"
                            >
                              <Compass className="w-3 h-3" />
                              <span>Karte anzeigen</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Participants & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 md:self-center">
                      <button
                        type="button"
                        onClick={() => setInviteModalEvent(e)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                        title="Teilnehmer einladen & RSVP verwalten"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Teilnehmer ({e.participants?.length || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditEventModal(e)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(e.id)}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. AGENDA / LIST VIEW */}
      {/* ==================================================================== */}
      {viewMode === 'agenda' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          {filteredEventInstances.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Keine anstehenden Termine gefunden</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Passen Sie die Filter an oder erstellen Sie neue Vereinstermine.
              </p>
            </div>
          ) : (
            filteredEventInstances.map((inst) => {
              const e = inst.originalEvent;
              const cat = categoryMap.get(e.categoryId);
              const catColor = cat?.color || '#3b82f6';
              const eventDateObj = CalendarService.parseLocalDate(inst.date);
              const dayStr = eventDateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <div
                  key={inst.instanceId}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    {/* Date Badge */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {eventDateObj.toLocaleDateString('de-DE', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black text-slate-900 leading-none">
                        {eventDateObj.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs"
                          style={{ backgroundColor: catColor }}
                        >
                          {cat?.name || 'Allgemein'}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {dayStr} {inst.isAllDay ? '• Ganztägig' : `• ${inst.startTime || ''} Uhr`}
                        </span>
                        {inst.isRecurrenceInstance && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            <Repeat className="w-2.5 h-2.5" />
                            Serie
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{e.title}</h3>

                      {e.location && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{e.location}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenOpenStreetMap(e)}
                            className="text-emerald-700 hover:underline font-semibold ml-1"
                          >
                            (Karte)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setInviteModalEvent(e)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{e.participants?.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailEvent(e)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditEventModal(e)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* Event Details Drawer / Modal */}
      {/* ==================================================================== */}
      {selectedDetailEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span
                  className="w-4 h-4 rounded-full shadow-xs"
                  style={{ backgroundColor: categoryMap.get(selectedDetailEvent.categoryId)?.color || '#3b82f6' }}
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedDetailEvent.title}</h3>
                  <p className="text-xs text-slate-500">
                    {categoryMap.get(selectedDetailEvent.categoryId)?.name || 'Termin'}
                    {selectedDetailEvent.department !== 'all' && ` • Sparte: ${selectedDetailEvent.department}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailEvent(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Date & Time info box */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-blue-950">
                    {selectedDetailEvent.startDate === selectedDetailEvent.endDate || !selectedDetailEvent.endDate
                      ? selectedDetailEvent.startDate
                      : `${selectedDetailEvent.startDate} bis ${selectedDetailEvent.endDate}`}
                  </div>
                  <div className="text-xs text-blue-800 font-medium">
                    {selectedDetailEvent.isAllDay
                      ? 'Ganztägige Veranstaltung'
                      : `${selectedDetailEvent.startTime || 'Beginn'} - ${selectedDetailEvent.endTime || 'Ende'} Uhr`}
                  </div>
                </div>
              </div>

              {/* Location with OSM Embed Card */}
              {selectedDetailEvent.location && (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Veranstaltungsort</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenOpenStreetMap(selectedDetailEvent)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Auf OpenStreetMap ansehen</span>
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-emerald-950">{selectedDetailEvent.location}</p>
                </div>
              )}

              {/* Description */}
              {selectedDetailEvent.description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Beschreibung</h4>
                  <p className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200 whitespace-pre-wrap">
                    {selectedDetailEvent.description}
                  </p>
                </div>
              )}

              {/* Participants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Teilnehmer ({selectedDetailEvent.participants?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteModalEvent(selectedDetailEvent);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                  >
                    + Einladungen / RSVP verwalten
                  </button>
                </div>

                {selectedDetailEvent.participants && selectedDetailEvent.participants.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetailEvent.participants.map((p) => (
                      <span
                        key={p.memberId}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${
                          p.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : p.status === 'declined'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        <span>{p.memberName}</span>
                        <span className="text-[10px] opacity-75">({p.role})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Noch keine Teilnehmer zugeordnet.</p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const ics = CalendarService.exportSingleEventIcs(selectedDetailEvent, categories);
                  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Termin_${selectedDetailEvent.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.ICS herunterladen</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const evt = selectedDetailEvent;
                    setSelectedDetailEvent(null);
                    handleOpenEditEventModal(evt);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Bearbeiten</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetailEvent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modals */}
      {/* ==================================================================== */}

      {/* Event Create / Edit Modal */}
      {isEventModalOpen && (
        <CalendarEventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          event={editingEvent}
          initialDate={modalInitialDate}
          categories={categories}
          members={members}
          departments={availableDepartments}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? handleDeleteEvent : undefined}
          onOpenCategoriesManager={() => {
            setIsEventModalOpen(false);
            setIsCategoryModalOpen(true);
          }}
          clubSettingsAddress={settings.address}
        />
      )}

      {/* Categories Manager Modal */}
      {isCategoryModalOpen && (
        <CalendarCategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categories}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <CalendarImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          categories={categories}
          onImportSuccess={handleImportSuccess}
        />
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <CalendarExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          events={events}
          categories={categories}
          departments={availableDepartments}
          clubName={settings.clubName}
        />
      )}

      {/* Invite Modal */}
      {inviteModalEvent && (
        <CalendarInviteModal
          isOpen={Boolean(inviteModalEvent)}
          onClose={() => setInviteModalEvent(null)}
          event={inviteModalEvent}
          categories={categories}
          members={members}
          onUpdateEvent={async (updated) => {
            await handleSaveEvent(updated);
            setInviteModalEvent(null);
            if (selectedDetailEvent?.id === updated.id) {
              setSelectedDetailEvent(updated);
            }
          }}
          clubName={settings.clubName}
        />
      )}

      {/* OpenStreetMap Modal */}
      {osmModalData.isOpen && (
        <OpenStreetMapModal
          isOpen={osmModalData.isOpen}
          onClose={() => setOsmModalData({ ...osmModalData, isOpen: false })}
          title={osmModalData.title}
          location={osmModalData.location}
          lat={osmModalData.lat}
          lng={osmModalData.lng}
        />
      )}
    </div>
  );
};
