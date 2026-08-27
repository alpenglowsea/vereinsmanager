import React, { useState } from 'react';
import {
  CalendarEvent,
  CalendarEventCategory,
  EventParticipant,
  EventRecurrence,
  Member,
  ParticipantRole,
  RecurrenceFrequency
} from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Repeat,
  Tag,
  Trash2,
  Check,
  X,
  UserPlus,
  Compass,
  AlertCircle,
  Building,
  Sparkles,
  Search
} from 'lucide-react';
import { OpenStreetMapModal } from './OpenStreetMapModal';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null; // null for new event
  initialDate?: string; // YYYY-MM-DD
  categories: CalendarEventCategory[];
  members: Member[];
  departments?: string[];
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onOpenCategoriesManager?: () => void;
  clubSettingsAddress?: string;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  event,
  initialDate,
  categories,
  members,
  departments = [],
  onSave,
  onDelete,
  onOpenCategoriesManager,
  clubSettingsAddress
}) => {
  const isEditing = Boolean(event && event.id);

  const defaultDate = initialDate || new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState<string>(event?.title || '');
  const [description, setDescription] = useState<string>(event?.description || '');
  const [categoryId, setCategoryId] = useState<string>(event?.categoryId || categories[0]?.id || 'cat-general');
  const [department, setDepartment] = useState<string>(event?.department || 'all');
  const [startDate, setStartDate] = useState<string>(event?.startDate || defaultDate);
  const [startTime, setStartTime] = useState<string>(event?.startTime || '18:00');
  const [endDate, setEndDate] = useState<string>(event?.endDate || defaultDate);
  const [endTime, setEndTime] = useState<string>(event?.endTime || '19:30');
  const [isAllDay, setIsAllDay] = useState<boolean>(event?.isAllDay || false);
  const [location, setLocation] = useState<string>(event?.location || '');
  const [locationLat, setLocationLat] = useState<number | undefined>(event?.locationLat);
  const [locationLng, setLocationLng] = useState<number | undefined>(event?.locationLng);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState<boolean>(
    Boolean(event?.recurrence && event.recurrence.frequency !== 'none')
  );
  const [recFrequency, setRecFrequency] = useState<RecurrenceFrequency>(
    event?.recurrence?.frequency || 'weekly'
  );
  const [recInterval, setRecInterval] = useState<number>(event?.recurrence?.interval || 1);
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>(
    event?.recurrence?.daysOfWeek || [1]
  );
  const [recEndType, setRecEndType] = useState<'never' | 'until_date' | 'count'>(
    event?.recurrence?.endType || 'never'
  );
  const [recUntilDate, setRecUntilDate] = useState<string>(event?.recurrence?.untilDate || '');
  const [recCount, setRecCount] = useState<number>(event?.recurrence?.count || 10);

  // Participants
  const [participants, setParticipants] = useState<EventParticipant[]>(event?.participants || []);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<ParticipantRole>('participant');

  // Map modal preview
  const [showMapPreview, setShowMapPreview] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const existingMemberIds = new Set(participants.map((p) => p.memberId));
  const availableMembers = members.filter((m) => !existingMemberIds.has(m.id) && m.status !== 'terminated');

  const searchedMembers = availableMembers.filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase().trim();
    const name = `${m.firstName} ${m.lastName}`.toLowerCase();
    const num = (m.memberNumber || '').toLowerCase();
    const dept = (m.department || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return name.includes(q) || num.includes(q) || dept.includes(q) || email.includes(q);
  });

  const handleAddParticipant = (memberToAddId?: string) => {
    const targetId = memberToAddId || selectedMemberId;
    if (!targetId) return;
    const mem = members.find((m) => m.id === targetId);
    if (!mem) return;

    const newP: EventParticipant = {
      memberId: mem.id,
      memberName: `${mem.firstName} ${mem.lastName}`.trim(),
      memberEmail: mem.email,
      memberPhone: mem.phone,
      memberDepartment: mem.department,
      role: selectedRole,
      status: 'invited'
    };

    setParticipants([...participants, newP]);
    setSelectedMemberId('');
    setMemberSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleRemoveParticipant = (memberId: string) => {
    setParticipants(participants.filter((p) => p.memberId !== memberId));
  };

  const handleToggleDayOfWeek = (dayNum: number) => {
    if (recDaysOfWeek.includes(dayNum)) {
      if (recDaysOfWeek.length > 1) {
        setRecDaysOfWeek(recDaysOfWeek.filter((d) => d !== dayNum));
      }
    } else {
      setRecDaysOfWeek([...recDaysOfWeek, dayNum].sort());
    }
  };

  const handleGeocodeLocation = async () => {
    if (!location.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'de',
            'User-Agent': 'VereinsManagerLokal/1.0'
          }
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setLocationLat(parseFloat(data[0].lat));
        setLocationLng(parseFloat(data[0].lon));
        setShowMapPreview(true);
      } else {
        alert('Keine Geodaten für diesen Ort gefunden. Sie können den Karteneintrag dennoch manuell ansehen.');
        setShowMapPreview(true);
      }
    } catch (e) {
      console.warn('Geocoding failed:', e);
      setShowMapPreview(true);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Bitte geben Sie einen Termintitel ein.');
      return;
    }
    if (!startDate) {
      setError('Bitte geben Sie ein Startdatum ein.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let recurrence: EventRecurrence | undefined;
      if (isRecurring && recFrequency !== 'none') {
        recurrence = {
          frequency: recFrequency,
          interval: recInterval || 1,
          daysOfWeek: recFrequency === 'weekly' || recFrequency === 'biweekly' ? recDaysOfWeek : undefined,
          endType: recEndType,
          untilDate: recEndType === 'until_date' ? recUntilDate : undefined,
          count: recEndType === 'count' ? recCount : undefined
        };
      }

      const eventData: CalendarEvent = {
        id: event?.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || 'cat-general',
        department: department || 'all',
        startDate,
        startTime: isAllDay ? undefined : startTime,
        endDate: endDate || startDate,
        endTime: isAllDay ? undefined : endTime,
        isAllDay,
        location: location.trim() || undefined,
        locationLat,
        locationLng,
        recurrence,
        participants,
        createdAt: event?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(eventData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern des Termins.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;
    if (confirm(`Möchten Sie den Termin "${event.title}" wirklich löschen?`)) {
      await onDelete(event.id);
      onClose();
    }
  };

  const dayLabels = [
    { num: 1, label: 'Mo' },
    { num: 2, label: 'Di' },
    { num: 3, label: 'Mi' },
    { num: 4, label: 'Do' },
    { num: 5, label: 'Fr' },
    { num: 6, label: 'Sa' },
    { num: 0, label: 'So' }
  ];

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs text-white"
                style={{ backgroundColor: selectedCategory?.color || '#3b82f6' }}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isEditing ? 'Termin bearbeiten' : 'Neuen Termin erstellen'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEditing ? 'Termindetails, Teilnehmer und Wiederholungen anpassen' : 'Neuen Vereins-, Spiel- oder Trainingstermin anlegen'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Titel des Termins *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Jahreshauptversammlung, Heimspiel 1. Herren, Jugendtraining..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden shadow-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Terminart / Kategorie *
                    </label>
                    {onOpenCategoriesManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoriesManager}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                      >
                        + Arten anpassen
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sparte / Abteilung
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="all">Gesamter Verein (Alle Abteilungen)</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        Abteilung: {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Date & Time Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Datum & Uhrzeit</span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <span>Ganztägiger Termin</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Beginn *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate < e.target.value) setEndDate(e.target.value);
                      }}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                      required
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    )}
                  </div>
                </div>

                {/* End */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Ende</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                    {!isAllDay && (
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recurrence (Serientermin) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-purple-600" />
                  <span>Serientermin / Wiederholung</span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm border-slate-300 focus:ring-purple-500"
                  />
                  <span>Regelmäßig wiederholen</span>
                </label>
              </div>

              {isRecurring && (
                <div className="space-y-3 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Intervall</label>
                      <select
                        value={recFrequency}
                        onChange={(e) => setRecFrequency(e.target.value as RecurrenceFrequency)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-hidden"
                      >
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                        <option value="biweekly">Alle 2 Wochen</option>
                        <option value="monthly">Monatlich</option>
                        <option value="yearly">Jährlich</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Ende der Serie</label>
                      <select
                        value={recEndType}
                        onChange={(e) => setRecEndType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-hidden"
                      >
                        <option value="never">Nie (Fortlaufend)</option>
                        <option value="until_date">Bis zu einem festen Datum</option>
                        <option value="count">Nach bestimmter Anzahl Termine</option>
                      </select>
                    </div>
                  </div>

                  {/* Weekdays selector for weekly */}
                  {(recFrequency === 'weekly' || recFrequency === 'biweekly') && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">Wochentage:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {dayLabels.map((d) => {
                          const isSel = recDaysOfWeek.includes(d.num);
                          return (
                            <button
                              key={d.num}
                              type="button"
                              onClick={() => handleToggleDayOfWeek(d.num)}
                              className={`w-9 h-8 rounded-lg text-xs font-bold transition-colors ${
                                isSel
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {recEndType === 'until_date' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Enddatum der Serie</label>
                      <input
                        type="date"
                        value={recUntilDate}
                        onChange={(e) => setRecUntilDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-hidden"
                      />
                    </div>
                  )}

                  {recEndType === 'count' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Anzahl Wiederholungen</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={recCount}
                        onChange={(e) => setRecCount(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-hidden"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location & OpenStreetMap Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Veranstaltungsort & OpenStreetMap</span>
                </span>
                {clubSettingsAddress && (
                  <button
                    type="button"
                    onClick={() => setLocation(`Vereinsgelände, ${clubSettingsAddress}`)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Building className="w-3 h-3" />
                    <span>Vereinsadresse einfügen</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="z.B. Sportplatzweg 12, 12345 Musterstadt oder Sporthalle Nord"
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleGeocodeLocation}
                  disabled={!location.trim() || isGeocoding}
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-40"
                  title="Standort auf OpenStreetMap anzeigen"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isGeocoding ? 'Suche...' : 'Karte'}</span>
                </button>
              </div>

              {/* Quick Facility presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">Schnellwahl:</span>
                {['Vereinsheim', 'Hauptplatz', 'Kunstrasen', 'Sporthalle', 'Tennisplätze'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const prefix = clubSettingsAddress ? `${preset}, ${clubSettingsAddress}` : preset;
                      setLocation(prefix);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants / Members */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Teilnehmer & Mitglieder ({participants.length})</span>
                </span>
                {department !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      const deptMems = members.filter(
                        (m) => m.department === department && !existingMemberIds.has(m.id) && m.status !== 'terminated'
                      );
                      const newParts: EventParticipant[] = deptMems.map((m) => ({
                        memberId: m.id,
                        memberName: `${m.firstName} ${m.lastName}`.trim(),
                        memberEmail: m.email,
                        memberPhone: m.phone,
                        memberDepartment: m.department,
                        role: 'participant',
                        status: 'invited'
                      }));
                      setParticipants([...participants, ...newParts]);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    + Alle aus Sparte "{department}" hinzufügen
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* Searchable member input */}
                  <div className="sm:col-span-7 relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => {
                          setMemberSearchQuery(e.target.value);
                          setIsSearchOpen(true);
                          if (selectedMemberId) setSelectedMemberId('');
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder={
                          selectedMemberId
                            ? `${members.find((m) => m.id === selectedMemberId)?.firstName} ${
                                members.find((m) => m.id === selectedMemberId)?.lastName
                              } (Ausgewählt)`
                            : `Mitglied suchen... (Name, Sparte, Nr., E-Mail)`
                        }
                        className={`w-full pl-9 pr-8 py-2 bg-white border rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden transition-all ${
                          selectedMemberId
                            ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-semibold'
                            : 'border-slate-300'
                        }`}
                      />
                      {(memberSearchQuery || selectedMemberId) && (
                        <button
                          type="button"
                          onClick={() => {
                            setMemberSearchQuery('');
                            setSelectedMemberId('');
                            setIsSearchOpen(false);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                          title="Eingabe löschen"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Live search suggestions */}
                    {isSearchOpen && (
                      <div
                        className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div className="px-3 py-2 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                          <span>
                            {memberSearchQuery.trim()
                              ? `${searchedMembers.length} Treffer gefunden`
                              : `Vorschläge aus Datenbank (${Math.min(availableMembers.length, 8)} von ${
                                  availableMembers.length
                                })`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsSearchOpen(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {searchedMembers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Kein passendes Mitglied gefunden für &bdquo;
                            <span className="font-semibold text-slate-700">{memberSearchQuery}</span>&ldquo;
                          </div>
                        ) : (
                          searchedMembers.slice(0, 15).map((m) => (
                            <div
                              key={m.id}
                              onClick={() => {
                                setSelectedMemberId(m.id);
                                setMemberSearchQuery(`${m.firstName} ${m.lastName}`);
                                setIsSearchOpen(false);
                              }}
                              className={`p-2.5 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors ${
                                selectedMemberId === m.id ? 'bg-blue-50/80 font-medium' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {m.firstName.charAt(0)}
                                  {m.lastName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {m.firstName} {m.lastName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                                    <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-medium">
                                      {m.department || 'Keine Sparte'}
                                    </span>
                                    {m.memberNumber && <span>#{m.memberNumber}</span>}
                                    {m.email && <span className="truncate">{m.email}</span>}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddParticipant(m.id);
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                                title="Direkt mit gewählter Rolle hinzufügen"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Hinzufügen</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as ParticipantRole)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    >
                      <option value="participant">Teilnehmer</option>
                      <option value="organizer">Organisator</option>
                      <option value="helper">Helfer</option>
                      <option value="trainer">Trainer</option>
                      <option value="referee">Schiedsrichter</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => handleAddParticipant()}
                      disabled={!selectedMemberId}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Hinzufügen</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Participant chips */}
              {participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {participants.map((p) => (
                    <span
                      key={p.memberId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs"
                    >
                      <span className="font-bold">{p.memberName}</span>
                      <span className="text-[10px] text-slate-400">({p.role})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.memberId)}
                        className="text-slate-400 hover:text-red-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Beschreibung & Notizen
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tagesordnung, Treffpunkt, mitzubringende Ausrüstung, Verpflegungshinweise..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-normal focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-red-700 bg-red-50 hover:bg-red-100 text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Termin löschen</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Speichern...' : isEditing ? 'Änderungen speichern' : 'Termin anlegen'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OpenStreetMap Modal Preview */}
      {showMapPreview && (
        <OpenStreetMapModal
          isOpen={showMapPreview}
          onClose={() => setShowMapPreview(false)}
          title={title || 'Terminort'}
          location={location}
          lat={locationLat}
          lng={locationLng}
        />
      )}
    </>
  );
};
