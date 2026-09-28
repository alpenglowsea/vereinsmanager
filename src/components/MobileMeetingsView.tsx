/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Meeting, MeetingType, MeetingStatus, MeetingAttendee } from '../types';
import { MeetingExtractedData } from '../services/meetingAiService';
import { MeetingAudioRecorderModal } from './MeetingAudioRecorderModal';
import { lockClass, lockTitle } from '../utils/uiLock';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  Mic,
  Lock,
  CalendarDays,
  MapPin,
  Users,
  FileText,
  ScrollText,
  Scale
} from 'lucide-react';

/**
 * Sitzungsdienst (Mobil-Ansicht)
 * ---------------------------------------------------------------------------
 * Zweck laut Vorgabe: eine bereits angelegte Sitzung unterwegs nachschlagen
 * UND ihr nachträglich eine Audioaufnahme hinzufügen ("sinnvollerweise kann
 * man dann auch die bereits angelegte Sitzung sehen und bearbeiten").
 *
 * Bewusst NICHT neu gebaut: die Aufnahme- und Auswertungslogik selbst. Es
 * wird exakt dasselbe Bauteil wiederverwendet, das auch die Desktop-
 * Sitzungsmaske für "Audio aufnehmen" einsetzt (MeetingAudioRecorderModal) —
 * inklusive der dort bereits vorhandenen Sperre für Mitgliederversammlungen
 * (§ 201 StGB) und der Gemini-Transkription. Dieser Bildschirm liefert dem
 * Bauteil nur den Kontext der ausgewählten Sitzung und übernimmt das
 * Ergebnis anschließend in genau derselben Weise, wie es die Desktop-
 * Sitzungsmaske tut (siehe MeetingFormModal.handleApplyExtractedData):
 * Titel/Datum/Ort/etc. werden überschrieben, wenn die Auswertung dazu etwas
 * erkannt hat, die Tagesordnung wird ERSETZT, wenn TOPs erkannt wurden,
 * Teilnehmer werden ergänzt (keine Duplikate nach Namen), und die
 * Transkript-Essenz wird an die Notizen angehängt.
 *
 * Anlegen und Löschen von Sitzungen bleiben der Desktop-Ansicht vorbehalten
 * — hier geht es nur um Nachschlagen und das nachträgliche Hinzufügen von
 * Audio zu einer bestehenden Sitzung.
 */

const STATUS_BADGE: Record<MeetingStatus, { label: string; className: string }> = {
  approved: { label: 'GENEHMIGT', className: 'bg-emerald-100 text-emerald-800' },
  review: { label: 'IN PRÜFUNG', className: 'bg-amber-100 text-amber-800' },
  draft: { label: 'ENTWURF', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'LÄUFT', className: 'bg-blue-100 text-blue-800' },
  scheduled: { label: 'GEPLANT', className: 'bg-indigo-100 text-indigo-800' },
  cancelled: { label: 'ABGESAGT', className: 'bg-rose-100 text-rose-800' }
};

// Dieselben Bezeichnungen wie in MeetingsView.tsx (Desktop), damit unterwegs
// nicht versehentlich ein anderes Wort für denselben Sitzungstyp auftaucht.
const TYPE_LABELS: Record<MeetingType, string> = {
  board: 'Vorstandssitzung',
  general_assembly: 'Mitgliederversammlung',
  extraordinary_assembly: 'Außerordentliche MV',
  committee: 'Ausschuss / Fachbereich',
  department: 'Abteilungsversammlung',
  other: 'Sonstige Sitzung'
};

function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function timeRangeLabel(meeting: Meeting): string {
  if (meeting.startTime && meeting.endTime) return `${meeting.startTime} - ${meeting.endTime} Uhr`;
  if (meeting.startTime) return `${meeting.startTime} Uhr`;
  return '';
}

/**
 * Übernimmt eine per Audio ausgewertete Sitzung in eine bestehende — exakt
 * dieselbe Zusammenführung wie MeetingFormModal.handleApplyExtractedData am
 * Desktop, nur auf einem fertigen Meeting-Objekt statt auf einzelnen
 * Formularfeldern angewendet.
 */
function mergeAttendees(
  existing: MeetingAttendee[],
  extracted?: MeetingExtractedData['attendees']
): MeetingAttendee[] {
  if (!extracted || extracted.length === 0) return existing;
  const existingNames = new Set(existing.map(a => a.name.toLowerCase()));
  const toAdd: MeetingAttendee[] = extracted
    .filter(a => a.name && !existingNames.has(a.name.toLowerCase()))
    .map((a, idx) => ({
      id: `att-ai-${Date.now()}-${idx}`,
      name: a.name,
      role: a.role || 'Teilnehmer',
      present: a.present ?? true,
      hasVotingRight: a.hasVotingRight ?? true,
      isSignatory: Boolean(a.role?.toLowerCase().includes('vorsitz') || a.role?.toLowerCase().includes('leiter'))
    }));
  return toAdd.length > 0 ? [...existing, ...toAdd] : existing;
}

function mergeGeneralNotes(existing: string | undefined, data: MeetingExtractedData): string | undefined {
  const extraNotes = [
    data.generalNotes,
    data.transcriptSummary ? `Audio-Transkript Essenz:\n${data.transcriptSummary}` : null,
    data.extractedRawSummary ? `Notizen-Erfassung:\n${data.extractedRawSummary}` : null
  ]
    .filter(Boolean)
    .join('\n\n');
  if (!extraNotes) return existing;
  return existing ? `${existing}\n\n${extraNotes}` : extraNotes;
}

function applyExtractedToMeeting(meeting: Meeting, data: MeetingExtractedData): Meeting {
  return {
    ...meeting,
    title: data.title || meeting.title,
    type: data.type || meeting.type,
    date: data.date || meeting.date,
    startTime: data.startTime || meeting.startTime,
    endTime: data.endTime || meeting.endTime,
    location: data.location || meeting.location,
    chairperson: data.chairperson || meeting.chairperson,
    minuteKeeper: data.minuteKeeper || meeting.minuteKeeper,
    agenda: data.agenda && data.agenda.length > 0 ? data.agenda : meeting.agenda,
    attendees: mergeAttendees(meeting.attendees, data.attendees),
    generalNotes: mergeGeneralNotes(meeting.generalNotes, data)
  };
}

interface MobileMeetingsViewProps {
  meetings: Meeting[];
  /** Darf die Person im Bereich "Sitzungen" etwas ändern (hier: Audio hinzufügen)? */
  canEdit: boolean;
  onSave: (meeting: Meeting) => void | Promise<void>;
}

export function MobileMeetingsView({ meetings, canEdit, onSave }: MobileMeetingsViewProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    [meetings]
  );

  const filteredMeetings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedMeetings;
    return sortedMeetings.filter(
      m =>
        m.title.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q) ||
        m.chairperson.toLowerCase().includes(q)
    );
  }, [sortedMeetings, query]);

  // Immer der aktuelle Stand aus der (von App.tsx geladenen) Liste, damit die
  // Ansicht nach dem Speichern automatisch die neuen Daten zeigt.
  const selectedMeeting = selectedId ? meetings.find(m => m.id === selectedId) ?? null : null;

  const handleApplyAudioData = async (data: MeetingExtractedData) => {
    if (!selectedMeeting) return;
    const merged = applyExtractedToMeeting(selectedMeeting, data);
    setIsAudioOpen(false);
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(merged);
      setJustUpdated(true);
    } catch (err) {
      console.error('Sitzung mit Audio-Auswertung konnte nicht gespeichert werden:', err);
      setSaveError('Die Sitzung konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setIsSaving(false);
    }
  };

  if (selectedMeeting) {
    const badge = STATUS_BADGE[selectedMeeting.status];
    const totalResolutions = selectedMeeting.agenda.reduce((acc, top) => acc + (top.resolutions?.length || 0), 0);

    return (
      <div className="p-4 space-y-4 pb-6">
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setJustUpdated(false);
            setSaveError(null);
          }}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Liste
        </button>

        {justUpdated && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3">
            <Mic className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-snug">
              <strong>Audio übernommen.</strong> Die Sitzung wurde mit der Auswertung aktualisiert.
            </p>
          </div>
        )}

        {!canEdit && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-snug">
              <strong>Nur Leserecht.</strong> Sie können diese Sitzung einsehen, aber keine Audioaufnahme hinzufügen.
            </p>
          </div>
        )}

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-bold text-slate-900 min-w-0">{selectedMeeting.title}</p>
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800">
            {TYPE_LABELS[selectedMeeting.type] || 'Sitzung'}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              {formatMeetingDate(selectedMeeting.date)}
              {timeRangeLabel(selectedMeeting) ? ` · ${timeRangeLabel(selectedMeeting)}` : ''}
            </span>
          </div>
          {selectedMeeting.location && (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{selectedMeeting.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Users className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              {selectedMeeting.chairperson} (Leitung) · {selectedMeeting.minuteKeeper} (Protokoll)
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
            Tagesordnung ({selectedMeeting.agenda.length} {selectedMeeting.agenda.length === 1 ? 'TOP' : 'TOPs'})
          </p>
          {selectedMeeting.agenda.length === 0 ? (
            <p className="text-xs text-slate-400">Noch keine Tagesordnungspunkte erfasst.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedMeeting.agenda.map(top => (
                <div key={top.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800 min-w-0 truncate">
                      <span className="text-purple-700 mr-1.5">{top.number}:</span>
                      {top.title}
                    </p>
                    {top.resolutions && top.resolutions.length > 0 && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        <Scale className="w-2.5 h-2.5" />
                        {top.resolutions.length}
                      </span>
                    )}
                  </div>
                  {top.discussionNotes && (
                    <p className="text-2xs text-slate-500 mt-1 line-clamp-2">{top.discussionNotes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {totalResolutions > 0 && (
            <p className="text-2xs text-slate-400 pt-1">
              {totalResolutions} {totalResolutions === 1 ? 'Beschluss' : 'Beschlüsse'} insgesamt
            </p>
          )}
        </div>

        {selectedMeeting.generalNotes && (
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Notizen
            </p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedMeeting.generalNotes}</p>
          </div>
        )}

        {saveError && <p className="text-xs text-rose-600 text-center">{saveError}</p>}

        <button
          type="button"
          disabled={isSaving}
          title={lockTitle(canEdit, 'Sitzungsaufnahme hinzufügen')}
          onClick={() => {
            if (!canEdit) return;
            setJustUpdated(false);
            setIsAudioOpen(true);
          }}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer bg-purple-600 text-white${lockClass(
            canEdit
          )}`}
        >
          <Mic className="w-4 h-4" />
          {isSaving ? 'Wird übernommen …' : 'Sitzungsaufnahme hinzufügen'}
        </button>

        {isAudioOpen && (
          <MeetingAudioRecorderModal
            isOpen={isAudioOpen}
            onClose={() => setIsAudioOpen(false)}
            meetingContext={{
              title: selectedMeeting.title,
              type: selectedMeeting.type,
              date: selectedMeeting.date,
              chairperson: selectedMeeting.chairperson
            }}
            onApplyData={handleApplyAudioData}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 pb-6">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Titel, Ort, Leitung …"
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="text-center py-12">
          <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Keine Sitzungen gefunden</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredMeetings.map(meeting => {
            const badge = STATUS_BADGE[meeting.status];
            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => {
                  setSelectedId(meeting.id);
                  setJustUpdated(false);
                  setSaveError(null);
                }}
                className="w-full flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{meeting.title}</p>
                  <p className="text-2xs text-slate-500 truncate">
                    {formatMeetingDate(meeting.date)} · {TYPE_LABELS[meeting.type] || 'Sitzung'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
