import React, { useState } from 'react';
import {
  CalendarEvent,
  CalendarEventCategory,
  EventParticipant,
  Member,
  ParticipantRole,
  ParticipantStatus
} from '../types';
import { CalendarService } from '../services/calendarService';
import {
  Mail,
  Share2,
  Download,
  Copy,
  Check,
  UserPlus,
  Trash2,
  X,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  Search,
  MessageSquare
} from 'lucide-react';

interface CalendarInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent;
  categories: CalendarEventCategory[];
  members: Member[];
  onUpdateEvent: (updated: CalendarEvent) => Promise<void>;
  clubName?: string;
}

export const CalendarInviteModal: React.FC<CalendarInviteModalProps> = ({
  isOpen,
  onClose,
  event,
  categories,
  members,
  onUpdateEvent,
  clubName = 'TSV Musterstadt 1890 e.V.'
}) => {
  const [participants, setParticipants] = useState<EventParticipant[]>(event.participants || []);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<ParticipantRole>('participant');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentCategory = categories.find((c) => c.id === event.categoryId);

  const existingMemberIds = new Set(participants.map((p) => p.memberId));
  const availableMembers = members.filter(
    (m) => !existingMemberIds.has(m.id) && m.status !== 'terminated'
  );

  const filteredAvailableMembers = availableMembers.filter((m) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const full = `${m.firstName} ${m.lastName} ${m.department} ${m.memberNumber || ''} ${m.email || ''}`.toLowerCase();
    return full.includes(q);
  });

  const handleAddParticipant = (memberToAddId?: string) => {
    const targetId = memberToAddId || selectedMemberId;
    if (!targetId) return;
    const member = members.find((m) => m.id === targetId);
    if (!member) return;

    const newPart: EventParticipant = {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      memberEmail: member.email,
      memberPhone: member.phone,
      memberDepartment: member.department,
      role: selectedRole,
      status: 'invited'
    };

    const updated = [...participants, newPart];
    setParticipants(updated);
    setSelectedMemberId('');
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const handleAddAllDepartment = (dept: string) => {
    const deptMembers = members.filter(
      (m) => (dept === 'all' || m.department === dept) && !existingMemberIds.has(m.id) && m.status !== 'terminated'
    );

    const newParts: EventParticipant[] = deptMembers.map((m) => ({
      memberId: m.id,
      memberName: `${m.firstName} ${m.lastName}`.trim(),
      memberEmail: m.email,
      memberPhone: m.phone,
      memberDepartment: m.department,
      role: 'participant',
      status: 'invited'
    }));

    setParticipants([...participants, ...newParts]);
  };

  const handleRemoveParticipant = (memberId: string) => {
    setParticipants(participants.filter((p) => p.memberId !== memberId));
  };

  const handleChangeStatus = (memberId: string, status: ParticipantStatus) => {
    setParticipants(
      participants.map((p) => (p.memberId === memberId ? { ...p, status } : p))
    );
  };

  const handleChangeRole = (memberId: string, role: ParticipantRole) => {
    setParticipants(
      participants.map((p) => (p.memberId === memberId ? { ...p, role } : p))
    );
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      const updatedEvent: CalendarEvent = {
        ...event,
        participants
      };
      await onUpdateEvent(updatedEvent);
      onClose();
    } catch (err) {
      console.error('Error saving participants:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = () => {
    const mailto = CalendarService.generateMailtoLink(
      { ...event, participants },
      clubName
    );
    window.open(mailto, '_blank');
  };

  const handleCopyShareText = () => {
    const text = CalendarService.generateShareableText(
      { ...event, participants },
      clubName
    );
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadIcs = () => {
    const ics = CalendarService.exportSingleEventIcs({ ...event, participants }, categories);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Einladung_${event.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmedCount = participants.filter((p) => p.status === 'confirmed' || p.status === 'attended').length;
  const declinedCount = participants.filter((p) => p.status === 'declined').length;
  const invitedCount = participants.filter((p) => p.status === 'invited').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Teilnehmer & Einladungs-Zentrale</span>
                {currentCategory && (
                  <span
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: currentCategory.color }}
                  >
                    {currentCategory.name}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">{event.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar (Email, Share, iCal) */}
        <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs font-semibold text-blue-900">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {confirmedCount} Zugesagt
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-600" /> {invitedCount} Ausstehend
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-rose-600" /> {declinedCount} Abgesagt
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSendEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs transition-colors"
              title="E-Mail-Programm mit allen Teilnehmern im BCC und Einladungstext öffnen"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>E-Mail-Einladung senden</span>
            </button>
            <button
              onClick={handleCopyShareText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-100/50 shadow-xs transition-colors"
              title="Einladungstext für WhatsApp, Vereinsgruppe oder Notizen kopieren"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Kopiert!' : 'Text kopieren'}</span>
            </button>
            <button
              onClick={handleDownloadIcs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-100/50 shadow-xs transition-colors"
              title=".ics-Kalenderdatei herunterladen"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.ICS Datei</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Add member section */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Mitglied aus der Datenbank hinzufügen</span>
              </h4>

              {event.department && event.department !== 'all' && (
                <button
                  type="button"
                  onClick={() => handleAddAllDepartment(event.department!)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                >
                  + Alle aus Abteilung "{event.department}" einladen
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                {/* Searchable input */}
                <div className="sm:col-span-7 relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
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
                    {(searchTerm || selectedMemberId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
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

                  {/* Suggestions dropdown */}
                  {isSearchOpen && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="px-3 py-2 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                        <span>
                          {searchTerm.trim()
                            ? `${filteredAvailableMembers.length} Treffer gefunden`
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

                      {filteredAvailableMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Kein passendes Mitglied gefunden für &bdquo;
                          <span className="font-semibold text-slate-700">{searchTerm}</span>&ldquo;
                        </div>
                      ) : (
                        filteredAvailableMembers.slice(0, 15).map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setSearchTerm(`${m.firstName} ${m.lastName}`);
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
                    <option value="organizer">Organisator / Leitung</option>
                    <option value="helper">Helfer / Dienst</option>
                    <option value="trainer">Trainer / Übungsleiter</option>
                    <option value="referee">Schiedsrichter / Kampfgericht</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => handleAddParticipant()}
                    disabled={!selectedMemberId}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Hinzufügen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Participant Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Teilnehmerliste ({participants.length})
              </h4>
              {participants.length > 0 && (
                <span className="text-xs text-slate-400">
                  Rolle und Status können direkt in der Liste geändert werden
                </span>
              )}
            </div>

            {participants.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Noch keine Teilnehmer hinzugefügt</p>
                <p className="text-xs text-slate-500 mt-1">Wählen Sie oben Mitglieder aus, um sie diesem Termin zuzuordnen.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
                {participants.map((p) => {
                  return (
                    <div
                      key={p.memberId}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                          {p.memberName.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{p.memberName}</span>
                            {p.memberDepartment && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {p.memberDepartment}
                              </span>
                            )}
                          </div>
                          {p.memberEmail && (
                            <p className="text-xs text-slate-400">{p.memberEmail}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Role Selector */}
                        <select
                          value={p.role}
                          onChange={(e) => handleChangeRole(p.memberId, e.target.value as ParticipantRole)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-hidden"
                        >
                          <option value="participant">Teilnehmer</option>
                          <option value="organizer">Organisator</option>
                          <option value="helper">Helfer</option>
                          <option value="trainer">Trainer</option>
                          <option value="referee">Schiedsrichter</option>
                        </select>

                        {/* Status Selector */}
                        <select
                          value={p.status}
                          onChange={(e) => handleChangeStatus(p.memberId, e.target.value as ParticipantStatus)}
                          className={`px-2.5 py-1 border rounded-lg text-xs font-bold outline-hidden ${
                            p.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : p.status === 'declined'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : p.status === 'attended'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="invited">Eingeladen / Offen</option>
                          <option value="confirmed">Zugesagt</option>
                          <option value="declined">Abgesagt</option>
                          <option value="attended">Anwesend</option>
                        </select>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(p.memberId)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {participants.length} Personen erfasst
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Speichern...' : 'Änderungen speichern'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
