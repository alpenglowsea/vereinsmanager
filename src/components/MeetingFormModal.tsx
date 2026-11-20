import { naechsteTopNummer, nummeriereTopsNeu } from '../utils/nummern';
import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  Scale,
  CheckCircle2,
  FileText,
  Download
} from 'lucide-react';
import {
  Meeting,
  MeetingType,
  MeetingStatus,
  MeetingProtocolType,
  MeetingAgendaItem,
  MeetingResolution,
  Member,
  MeetingAttendee,
  ClubSettings,
  MeetingTemplateSettings
} from '../types';
import { MeetingPdfService, Briefpapier } from '../services/meetingPdfService';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';
import { savePdfAs } from '../utils/fileExportHelper';
import { keepUnknownFields } from '../utils/keepUnknownFields';
import { melde } from '../utils/dialoge';
import {
  SITZUNGSARTEN,
  SITZUNGSSTATUS,
  STATUS_WAHL,
  GESPERRT,
  beschlussNummernAngleichen,
  einladungFehlt,
  ergebnisVorschlag,
  gesperrt,
  istStandardTagesordnung,
  neuerBeschluss,
  pruefeSitzung,
  standardTagesordnung,
  standardTitel,
  stimmenUngeprueft
} from '../utils/sitzungRegeln';

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingToEdit?: Meeting | null;
  members: Member[];
  clubSettings?: ClubSettings;
  templateSettings?: MeetingTemplateSettings;
  /** Gemeinsames Briefpapier (aus der Rechnungsvorlage, D-123). */
  briefpapier?: Briefpapier | null;
  onSave: (meeting: Meeting) => Promise<void>;
}

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  isOpen,
  onClose,
  meetingToEdit,
  members,
  clubSettings,
  templateSettings,
  briefpapier,
  onSave
}) => {
  const isEditing = Boolean(meetingToEdit);

  // Neue Sitzungen starten ohne Musterdaten (D-119): keine erfundenen Orte,
  // Personen, Uhrzeiten oder Stimmenzahlen, nichts vorangekreuzt (D-127).
  // Lokales Datum, nicht UTC (sonst kurz nach Mitternacht der Vortag).
  const heute = new Date();
  const heuteIso = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
  const [type, setType] = useState<MeetingType>(meetingToEdit?.type || 'board');
  const [title, setTitle] = useState(meetingToEdit?.title ?? standardTitel('board', heute.getFullYear()));
  // „Genehmigt“ ergibt sich nur aus beiden Unterschriften. Ältere, von Hand
  // auf „Genehmigt“ gesetzte Sitzungen ohne Unterschrift starten hier als
  // „In Vorprüfung“ (Hinweis am Feld).
  const statusVonHand = meetingToEdit?.status === 'approved' && !gesperrt(meetingToEdit);
  const [status, setStatus] = useState<MeetingStatus>(statusVonHand ? 'review' : meetingToEdit?.status || 'scheduled');
  const [protocolType, setProtocolType] = useState<MeetingProtocolType>(meetingToEdit?.protocolType || 'results');
  const [date, setDate] = useState(meetingToEdit?.date || heuteIso);
  const [startTime, setStartTime] = useState(meetingToEdit?.startTime || '');
  const [endTime, setEndTime] = useState(meetingToEdit?.endTime || '');
  const [location, setLocation] = useState(meetingToEdit?.location || '');
  const [chairperson, setChairperson] = useState(meetingToEdit?.chairperson || '');
  const [minuteKeeper, setMinuteKeeper] = useState(meetingToEdit?.minuteKeeper || '');

  // Compliance
  const [invitationDate, setInvitationDate] = useState(meetingToEdit?.invitationDate || '');
  const [invitationMethod, setInvitationMethod] = useState(meetingToEdit?.invitationMethod || '');
  const [invitationCompliant, setInvitationCompliant] = useState(meetingToEdit ? Boolean(meetingToEdit.invitationCompliant) : false);
  const [quorumConfirmed, setQuorumConfirmed] = useState(meetingToEdit ? Boolean(meetingToEdit.quorumConfirmed) : false);
  const [totalEligibleVoters, setTotalEligibleVoters] = useState<number | ''>(meetingToEdit?.totalEligibleVoters ?? '');

  // Agenda & TOPs
  const [agenda, setAgenda] = useState<MeetingAgendaItem[]>(meetingToEdit?.agenda || standardTagesordnung('board'));

  // Attendees & Mitgliedersuche
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(meetingToEdit?.attendees || []);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [generalNotes, setGeneralNotes] = useState(meetingToEdit?.generalNotes || '');
  // Fehler erst nach dem ersten Speicherversuch zeigen; danach laufend neu
  // berechnet, damit sie beim Korrigieren verschwinden.
  const [versucht, setVersucht] = useState(false);

  // Gefilterte Mitglieder für Autocomplete-Vorschläge
  const memberSuggestions = useMemo(() => {
    const q = attendeeSearchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return (members || [])
      .filter((m) => {
        const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
        const reverseName = `${m.lastName} ${m.firstName}`.toLowerCase();
        const num = (m.memberNumber || '').toLowerCase();
        return fullName.includes(q) || reverseName.includes(q) || num.includes(q);
      })
      .slice(0, 7);
  }, [members, attendeeSearchQuery]);

  const [activeTab, setActiveTab] = useState<'details' | 'agenda' | 'compliance' | 'attendees'>('details');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);


  if (!isOpen) return null;

  const handleDownloadInvitation = async () => {
    // Ohne Datum, Uhrzeit, Ort und Tagesordnung keine Einladung; es wird nichts ergänzt.
    const fehlt = einladungFehlt({ date, startTime, location, agenda });
    if (fehlt.length) {
      void melde(`Für die Einladung fehlt noch: ${fehlt.join(', ')}.`);
      return;
    }
    if (!clubSettings) return;
    setIsGeneratingInvitation(true);
    try {
      const doc = await MeetingPdfService.generateInvitationPdf(
        {
          title: title.trim(),
          type,
          date,
          startTime,
          endTime: endTime || undefined,
          location: location.trim(),
          chairperson: chairperson.trim(),
          minuteKeeper: minuteKeeper.trim(),
          invitationDate: invitationDate || undefined,
          agenda
        },
        clubSettings,
        templateSettings || DEFAULT_MEETING_TEMPLATE,
        { briefpapier }
      );
      void savePdfAs(doc, `Einladung_${date}_${(title || 'Versammlung').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate invitation PDF:', err);
      void melde('Fehler beim Erzeugen des Einladungs-PDFs.');
    } finally {
      setIsGeneratingInvitation(false);
    }
  };

  /**
   * Artwechsel bei einer neuen Sitzung: Titel und Tagesordnung folgen der
   * neuen Art nur, solange sie noch der Vorgabe der alten Art entsprechen;
   * Eigenes bleibt stehen. Keine erfundenen Stimmenzahlen mehr (D-131).
   */
  const handleTypeChange = (newType: MeetingType) => {
    if (!meetingToEdit) {
      if (title === standardTitel(type, heute.getFullYear())) setTitle(standardTitel(newType, heute.getFullYear()));
      if (istStandardTagesordnung(agenda, type)) setAgenda(standardTagesordnung(newType));
    }
    setType(newType);
  };

  const handleAddTop = () => {
    setAgenda([
      ...agenda,
      {
        id: `top-${Date.now()}`,
        // Höchste vorhandene TOP-Nummer plus eins (D-120)
        number: naechsteTopNummer(agenda.map(top => top.number)),
        title: '',
        discussionNotes: ''
      }
    ]);
  };

  const handleUpdateTop = (index: number, updated: Partial<MeetingAgendaItem>) => {
    const next = [...agenda];
    next[index] = { ...next[index], ...updated };
    setAgenda(next);
  };

  const handleRemoveTop = (index: number) => {
    // Nach dem Entfernen lückenlos durchzählen (TOP 1, TOP 2, …), damit
    // keine Nummer fehlt oder doppelt vergeben wird. Eigene Bezeichnungen
    // wie „TOP 3a“ bleiben unangetastet (siehe nummeriereTopsNeu).
    setAgenda(nummeriereTopsNeu(agenda.filter((_, i) => i !== index)));
  };

  const handleAddResolution = (topIndex: number) => {
    const top = agenda[topIndex];
    // Startet leer: keine vorbelegten Ja-Stimmen, kein vorgegebenes Ergebnis (D-118)
    const newResolution: MeetingResolution = neuerBeschluss(top.number);

    const nextTop = {
      ...top,
      resolutions: [...(top.resolutions || []), newResolution]
    };
    const nextAgenda = [...agenda];
    nextAgenda[topIndex] = nextTop;
    setAgenda(nextAgenda);
  };

  const handleUpdateResolution = (
    topIndex: number,
    resIndex: number,
    updated: Partial<MeetingResolution>
  ) => {
    const top = agenda[topIndex];
    const resolutions = [...(top.resolutions || [])];
    let neu = { ...resolutions[resIndex], ...updated };
    // Das Ergebnis folgt den Stimmen (einfache Mehrheit), solange es nicht
    // „Vertagt“ ist; es bleibt von Hand änderbar (wie Android).
    const stimmen = 'votesFor' in updated || 'votesAgainst' in updated || 'votesAbstain' in updated;
    if (stimmen && neu.result !== 'deferred' && (neu.votesFor || 0) + (neu.votesAgainst || 0) + (neu.votesAbstain || 0) > 0) {
      neu = { ...neu, result: ergebnisVorschlag(neu.votesFor || 0, neu.votesAgainst || 0) };
    }
    resolutions[resIndex] = neu;
    const nextAgenda = [...agenda];
    nextAgenda[topIndex] = { ...top, resolutions };
    setAgenda(nextAgenda);
  };

  const handleRemoveResolution = (topIndex: number, resIndex: number) => {
    const top = agenda[topIndex];
    const resolutions = (top.resolutions || []).filter((_, i) => i !== resIndex);
    const nextAgenda = [...agenda];
    nextAgenda[topIndex] = { ...top, resolutions };
    setAgenda(nextAgenda);
  };

  const handleAddAttendee = (name: string, role?: string, memberId?: string) => {
    if (!name.trim()) return;
    const defaultRole = role || (type === 'board' ? 'Vorstandsmitglied' : 'Mitglied');
    setAttendees((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        memberId,
        name: name.trim(),
        role: defaultRole,
        present: true,
        hasVotingRight: true,
        isSignatory: false
      }
    ]);
  };

  /** Die Sitzung, wie sie gespeichert würde (für Prüfung und Speichern). */
  const baueSitzung = (): Meeting => {
    const now = new Date().toISOString();
    return {
      id: meetingToEdit?.id || `meet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      type,
      status,
      protocolType,
      date,
      startTime,
      endTime: endTime || undefined,
      location: location.trim(),
      chairperson: chairperson.trim(),
      minuteKeeper: minuteKeeper.trim(),
      invitationDate: invitationDate || undefined,
      invitationMethod: invitationMethod.trim() || undefined,
      invitationCompliant,
      quorumConfirmed,
      // Leer bleibt leer; vorher wurde daraus die Zahl 1 (D-122).
      totalEligibleVoters: typeof totalEligibleVoters === 'number' ? totalEligibleVoters : undefined,
      agenda: beschlussNummernAngleichen(agenda),
      attendees,
      generalNotes: generalNotes.trim() || undefined,
      createdAt: meetingToEdit?.createdAt || now,
      updatedAt: now
    };
  };

  const fehler: Record<string, string> = versucht ? pruefeSitzung(baueSitzung()) : {};
  const fehlerListe = Object.keys(fehler);
  // Hinweis (kein Fehler): Stimmen eingetragen, aber nichts, woran sie sich prüfen lassen (T-192)
  const ohneStimmenPruefung = stimmenUngeprueft({
    agenda,
    attendees,
    totalEligibleVoters: typeof totalEligibleVoters === 'number' ? totalEligibleVoters : undefined
  });
  const stimmenHinweis = ohneStimmenPruefung ? (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-100">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <span>
        Es sind Stimmen eingetragen, aber weder Teilnehmer mit Stimmrecht (Reiter 4) noch die Zahl der anwesenden Stimmberechtigten (Reiter 3). Deshalb kann nicht geprüft werden, ob die Stimmen zu den Anwesenden passen. Speichern ist trotzdem möglich.
      </span>
    </div>
  ) : null;
  const tabVon = (k: string): 'details' | 'agenda' | 'compliance' | 'attendees' =>
    k.startsWith('top') || k.startsWith('beschluss')
      ? 'agenda'
      : k === 'einladungsDatum' || k === 'stimmberechtigte'
        ? 'compliance'
        : k.startsWith('teilnehmer')
          ? 'attendees'
          : 'details';
  const tabHatFehler = (t: string) => fehlerListe.some(k => tabVon(k) === t);
  const fehlerText = (k: string) =>
    fehler[k] ? <p className="text-[11px] font-semibold text-rose-600 mt-1 dark:text-rose-400">{fehler[k]}</p> : null;
  const rot = (k: string) => (fehler[k] ? ' border-rose-400 ring-1 ring-rose-300 dark:border-rose-500' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingToEdit && gesperrt(meetingToEdit)) {
      void melde(GESPERRT);
      return;
    }
    setVersucht(true);
    const meetingData = baueSitzung();
    const f = pruefeSitzung(meetingData);
    const erster = Object.keys(f)[0];
    if (erster) {
      setActiveTab(tabVon(erster));
      return;
    }

    setIsSaving(true);
    try {
      // keepUnknownFields: Unterschriften (signatures), das archivierte PDF
      // (documentId), customTemplateUsed, das Unterschriftsdatum (signedAt)
      // und alle weiteren Felder, die dieses Formular nicht kennt, bleiben
      // beim Bearbeiten erhalten (D-116).
      // Vorher verlor ein unterschriebenes Protokoll beim Speichern seine
      // Unterschriften.
      await onSave(keepUnknownFields(meetingToEdit, meetingData));
      onClose();
    } catch (err) {
      console.error('Failed to save meeting:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-6 flex flex-col max-h-[92vh] dark:bg-slate-900 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl dark:bg-rose-900/40 dark:text-rose-300">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Sitzung & Protokoll bearbeiten' : 'Neue Sitzung / Versammlung erfassen'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rechtssichere Dokumentation gem. BGB und Satzungsvorgaben mit Beschlussfassung und Beschlussfähigkeit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadInvitation}
              disabled={isGeneratingInvitation}
              className="px-3.5 py-1.5 text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer dark:bg-slate-900 dark:text-rose-300 dark:border-rose-800/60 dark:hover:bg-rose-950/40"
              title="Erzeugt das offizielle Einladungsschreiben mit Tagesordnung als PDF gem. § 32 BGB"
            >
              <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{isGeneratingInvitation ? 'Erzeuge...' : 'Einladung (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer dark:hover:text-slate-300 dark:hover:bg-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6 overflow-x-auto dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'details'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>1. Stammdaten & Leitung</span>
            {tabHatFehler('details') && <span className="w-2 h-2 rounded-full bg-rose-500" title="Hier fehlt etwas" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'agenda'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Tagesordnung & Einladung ({agenda.length} TOPs)</span>
            {tabHatFehler('agenda') && <span className="w-2 h-2 rounded-full bg-rose-500" title="Hier fehlt etwas" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'compliance'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Am Versammlungstag: Beschlussfähigkeit & Nachweise</span>
            {tabHatFehler('compliance') && <span className="w-2 h-2 rounded-full bg-rose-500" title="Hier fehlt etwas" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendees')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'attendees'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>4. Teilnehmer & Unterschriften ({attendees.length})</span>
            {tabHatFehler('attendees') && <span className="w-2 h-2 rounded-full bg-rose-500" title="Hier fehlt etwas" />}
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: STAMMDATEN */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Sitzungsart / Gremium *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as MeetingType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  >
                    {(Object.keys(SITZUNGSARTEN) as MeetingType[]).map((a) => (
                      <option key={a} value={a}>
                        {SITZUNGSARTEN[a]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Titel der Sitzung / Niederschrift *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z.B. Vorstandssitzung März oder Mitgliederversammlung"
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('titel')}`}
                  />
                  {fehlerText('titel')}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Datum der Sitzung *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('datum')}`}
                  />
                  {fehlerText('datum')}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Beginn (Uhrzeit)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('beginn')}`}
                  />
                  {fehlerText('beginn')}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Ende (Uhrzeit)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('ende')}`}
                  />
                  {fehlerText('ende')}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Status des Protokolls
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MeetingStatus)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  >
                    {STATUS_WAHL.map((st) => (
                      <option key={st} value={st}>
                        {SITZUNGSSTATUS[st]}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                    {statusVonHand
                      ? 'War „Genehmigt“ ohne Unterschriften; genehmigt wird ein Protokoll erst durch beide Unterschriften.'
                      : '„Genehmigt“ ergibt sich aus den beiden Unterschriften.'}
                  </p>
                  {fehlerText('status')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Ort der Sitzung
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="z.B. Vereinsheim, Sporthalle oder Online"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Versammlungsleiter (Vorsitz)
                  </label>
                  <input
                    type="text"
                    value={chairperson}
                    onChange={(e) => setChairperson(e.target.value)}
                    placeholder="Name der Versammlungsleitung"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Protokollführer / Schriftführer
                  </label>
                  <input
                    type="text"
                    value={minuteKeeper}
                    onChange={(e) => setMinuteKeeper(e.target.value)}
                    placeholder="Name der Protokollführung"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                  Protokollform
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                      protocolType === 'results' ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/40' : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="protocolType"
                      value="results"
                      checked={protocolType === 'results'}
                      onChange={() => setProtocolType('results')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Ergebnisprotokoll (Gesetzlicher Standard)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 dark:text-slate-400">
                        Konzentriert sich rechtssicher auf Anträge, exakte Stimmergebnisse, Wahlen und Beschlüsse gem. BGB.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                      protocolType === 'verbatim' ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/40' : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="protocolType"
                      value="verbatim"
                      checked={protocolType === 'verbatim'}
                      onChange={() => setProtocolType('verbatim')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Ausführliches Verlaufsprotokoll</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 dark:text-slate-400">
                        Dokumentiert neben Beschlüssen auch wesentliche Wortbeiträge, Meinungsbilder und Berichte im Detail.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPLIANCE & RECHTSICHERHEIT */}
          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 flex items-start gap-3 dark:bg-amber-950/60 dark:border-amber-800/60">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
                <div className="text-xs text-amber-900 space-y-1 dark:text-amber-100">
                  <p className="font-semibold">Rechtliche Vorgaben für die Gültigkeit von Beschlüssen</p>
                  <p className="text-amber-800 leading-relaxed dark:text-amber-200">
                    Sowohl das Vereinsregister (Amtsgericht) als auch das Finanzamt prüfen im Streit- oder Prüfungsfall,
                    ob die Einberufung satzungskonform erfolgte und die Versammlung beschlussfähig war. Fehlt dieser Nachweis,
                    können Beschlüsse (z.B. Vorstandswahlen, Satzungsänderungen, Ehrenamtspauschalen) anfechtbar oder nichtig sein.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Datum des Versands der Einladung
                  </label>
                  <input
                    type="date"
                    value={invitationDate}
                    onChange={(e) => setInvitationDate(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('einladungsDatum')}`}
                  />
                  {fehlerText('einladungsDatum')}
                  <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                    Dient dem Nachweis der Einhaltung der satzungsgemäßen Einladungsfrist (z.B. 2 oder 4 Wochen).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Art & Weg der Einberufung
                  </label>
                  <input
                    type="text"
                    value={invitationMethod}
                    onChange={(e) => setInvitationMethod(e.target.value)}
                    placeholder="z.B. Schriftlich per E-Mail gem. § 8 der Satzung"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 dark:bg-slate-800 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 dark:text-slate-100">
                  Feststellungen bei Versammlungsbeginn
                </h4>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitationCompliant}
                    onChange={(e) => setInvitationCompliant(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:text-rose-400 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Form- und fristgerechte Einladung wurde festgestellt und bestätigt
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Wird im Protokollkopf explizit bestätigt, wie von Registergerichten gefordert.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quorumConfirmed}
                    onChange={(e) => setQuorumConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:text-rose-400 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Beschlussfähigkeit ist gegeben und ordnungsgemäß festgestellt
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Gemäß Satzung (z.B. unabhängig von der Zahl der Erschienenen oder Mindestanzahl Vorstände).
                    </p>
                  </div>
                </label>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Anzahl anwesender stimmberechtigter Mitglieder
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={totalEligibleVoters === '' ? '' : totalEligibleVoters}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = Number(val);
                      setTotalEligibleVoters(val === '' || !Number.isFinite(parsed) ? '' : parsed);
                    }}
                    placeholder="leer = aus der Teilnehmerliste"
                    className={`w-56 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100${rot('stimmberechtigte')}`}
                  />
                  {fehlerText('stimmberechtigte')}
                  <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                    Leer gelassen zählt die App die anwesenden Stimmberechtigten der Teilnehmerliste. Die eingetragenen Stimmen eines Beschlusses dürfen diese Zahl nicht übersteigen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TAGESORDNUNG & EINLADUNGSSCHREIBEN (GEM. § 32 BGB) */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              {/* Einladungs- & BGB § 32 Vorbereitungskarte */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs dark:bg-rose-950/70 dark:border-rose-800/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
                      § 32 Abs. 1 Satz 2 BGB
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Einberufung & Bekanntgabe der Tagesordnung
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl dark:text-slate-300">
                    Die Tagesordnung muss den Mitgliedern bereits mit der Einberufung vollständig mitgeteilt werden.
                    Erzeugen Sie hier direkt das form- und fristgerechte Einladungsschreiben mit vorläufiger
                    Tagesordnung als druckfertiges PDF auf Ihrem Vereinsbriefpapier.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadInvitation}
                    disabled={isGeneratingInvitation}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Form- und fristgerechte Einladung mit Tagesordnung als PDF herunterladen"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isGeneratingInvitation ? 'Erzeuge...' : 'Einladung als PDF herunterladen'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-100">
                    Tagesordnungspunkte (TOPs) & Beratungen
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fügen Sie TOPs hinzu, erfassen Sie den Diskussionsverlauf und fassen Sie Beschlüsse mit exaktem Abstimmungsergebnis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddTop}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 dark:hover:bg-rose-900/40"
                    title="Neuen TOP hinzufügen"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>neuer TOP</span>
                  </button>
                </div>
              </div>

              {stimmenHinweis}

              <div className="space-y-4">
                {agenda.map((top, topIndex) => (
                  <div
                    key={top.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={top.number}
                          onChange={(e) => handleUpdateTop(topIndex, { number: e.target.value })}
                          className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                          placeholder="TOP 1"
                        />
                        <input
                          type="text"
                          value={top.title}
                          onChange={(e) => handleUpdateTop(topIndex, { title: e.target.value })}
                          className={`flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100${rot(`top${topIndex}`)}`}
                          placeholder="Titel des Tagesordnungspunkts"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={top.speaker || ''}
                          onChange={(e) => handleUpdateTop(topIndex, { speaker: e.target.value })}
                          className="w-36 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 placeholder:text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                          placeholder="Berichterstatter"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTop(topIndex)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer dark:hover:text-rose-400"
                          title="TOP entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {fehlerText(`top${topIndex}`)}

                    {/* Besprechung / Diskussionsnotizen */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Beratung, Aussprache & Diskussionsverlauf
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={top.discussionNotes || ''}
                        onChange={(e) => handleUpdateTop(topIndex, { discussionNotes: e.target.value })}
                        placeholder="Zusammenfassung der Beratung, wesentliche Argumente oder Berichtsinhalte..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                      />
                    </div>

                    {/* Beschlüsse unter diesem TOP */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 dark:text-slate-300">
                          <CheckCircle2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Beschlussfassungen & Anträge ({top.resolutions?.length || 0})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddResolution(topIndex)}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:text-rose-800 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-900/40 dark:border-rose-800/60"
                            title="Neuen Beschluss erfassen"
                          >
                            <Plus className="w-3 h-3" />
                            <span>neuer Beschluss</span>
                          </button>
                        </div>
                      </div>

                      {top.resolutions && top.resolutions.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {top.resolutions.map((res, resIndex) => (
                            <div
                              key={res.id}
                              className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-2xs space-y-3 dark:bg-slate-900 dark:border-rose-800/80"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px] dark:bg-rose-900/40 dark:text-rose-200">
                                    Beschluss
                                  </span>
                                  <input
                                    type="text"
                                    value={res.title}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { title: e.target.value })
                                    }
                                    placeholder="Kurztitel des Beschlusses"
                                    className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveResolution(topIndex, resIndex)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer dark:hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5 dark:text-slate-300">
                                  Exakter Beschluss- / Antragswortlaut *
                                </label>
                                <textarea
                                  rows={2}
                                  value={res.motionText}
                                  onChange={(e) =>
                                    handleUpdateResolution(topIndex, resIndex, { motionText: e.target.value })
                                  }
                                  placeholder="Wortlaut des Antrags"
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:ring-1 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                                />
                              </div>

                              {/* Abstimmungsergebnis */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-800">
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Ja-Stimmen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesFor}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesFor: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-emerald-700 dark:bg-slate-900 dark:border-slate-800 dark:text-emerald-300"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-rose-700 dark:text-rose-300">Nein-Stimmen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesAgainst}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesAgainst: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-rose-700 dark:bg-slate-900 dark:border-slate-800 dark:text-rose-300"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300">Enthaltungen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesAbstain}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesAbstain: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-200">Ergebnis</label>
                                  <select
                                    value={res.result}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, {
                                        result: e.target.value as 'accepted' | 'rejected' | 'deferred'
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                                  >
                                    <option value="accepted">Angenommen</option>
                                    <option value="rejected">Abgelehnt</option>
                                    <option value="deferred">Vertagt</option>
                                  </select>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Das Ergebnis folgt den Stimmen (einfache Mehrheit, Enthaltungen zählen nicht, Gleichstand = abgelehnt). Verlangt die Satzung mehr, bitte von Hand anpassen.
                              </p>
                              {fehlerText(`beschluss${topIndex}.${resIndex}`)}

                              {/* Relevanz-Flags */}
                              <div className="flex flex-wrap items-center gap-4 text-xs">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={res.isTaxRelevant}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { isTaxRelevant: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                                  />
                                  <span className="text-slate-700 text-[11px] font-medium dark:text-slate-200">
                                    Finanzamt-relevant (z.B. Ehrenamtspauschale, Rücklagen, Mittelverwendung)
                                  </span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={res.isRegisterRelevant}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { isRegisterRelevant: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                                  />
                                  <span className="text-slate-700 text-[11px] font-medium dark:text-slate-200">
                                    Vereinsregister / Notar (§ 26 BGB Vorstandswahlen / Satzungsänderung)
                                  </span>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TEILNEHMER & UNTERSCHRIFTEN */}
          {activeTab === 'attendees' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-100">
                    Anwesenheitsliste & Protokollunterzeichner
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Erfassen Sie anwesende Vorstände, Mitglieder oder Gäste sowie die satzungsgemäßen Unterzeichner.
                  </p>
                </div>
              </div>

              {/* Teilnehmer hinzufügen mit automatischer Mitglieder-Suche */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={attendeeSearchQuery}
                      onChange={(e) => {
                        setAttendeeSearchQuery(e.target.value);
                        setShowMemberSuggestions(true);
                      }}
                      onFocus={() => {
                        if (attendeeSearchQuery.trim()) {
                          setShowMemberSuggestions(true);
                        }
                      }}
                      placeholder="Name eingeben (durchsucht automatisch die Mitglieder-Datenbank)..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (attendeeSearchQuery.trim()) {
                            handleAddAttendee(attendeeSearchQuery.trim());
                            setAttendeeSearchQuery('');
                            setShowMemberSuggestions(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowMemberSuggestions(false);
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (attendeeSearchQuery.trim()) {
                        handleAddAttendee(attendeeSearchQuery.trim());
                        setAttendeeSearchQuery('');
                        setShowMemberSuggestions(false);
                      }
                    }}
                    disabled={!attendeeSearchQuery.trim()}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Hinzufügen
                  </button>
                </div>

                {/* Autocomplete-Vorschläge - harmonisch und kompakt */}
                {showMemberSuggestions && memberSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-28 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between dark:bg-slate-800 dark:text-slate-400">
                      <span>Mitglieder ({memberSuggestions.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">Klick übernimmt Mitglied</span>
                    </div>
                    {memberSuggestions.map((m) => {
                      const memberFullName = `${m.firstName} ${m.lastName}`;
                      const isAlreadyAdded = attendees.some((a) => a.name.toLowerCase() === memberFullName.toLowerCase());

                      return (
                        <div
                          key={m.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddAttendee(
                              memberFullName,
                              type === 'board' ? 'Vorstandsmitglied' : 'Mitglied',
                              m.id
                            );
                            setAttendeeSearchQuery('');
                            setShowMemberSuggestions(false);
                          }}
                          className={`px-3 py-1.5 hover:bg-rose-50/80 cursor-pointer flex items-center justify-between transition-colors dark:hover:bg-rose-950/80 ${
                            isAlreadyAdded ? 'bg-slate-50/70 dark:bg-slate-800/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5.5 h-5.5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-800">
                              {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 text-xs truncate block dark:text-slate-100">
                                {memberFullName}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {m.memberNumber ? `Nr. ${m.memberNumber}` : ''}
                                {m.department ? ` • ${m.department}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isAlreadyAdded ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                Bereits erfasst
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                                <Plus className="w-3 h-3" />
                                Hinzufügen
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Teilnehmer-Tabelle */}
              {attendees.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold dark:bg-slate-800 dark:border-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Funktion / Rolle</th>
                        <th className="px-3 py-2 text-center">Anwesend</th>
                        <th className="px-3 py-2 text-center">Stimmrecht</th>
                        <th className="px-3 py-2 text-center">Unterzeichnet</th>
                        <th className="px-3 py-2 text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {attendees.map((att, idx) => (
                        <tr key={att.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                            {att.name}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={att.role}
                              onChange={(e) => {
                                const next = [...attendees];
                                next[idx] = { ...next[idx], role: e.target.value };
                                setAttendees(next);
                              }}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={att.present}
                              onChange={(e) => {
                                const next = [...attendees];
                                next[idx] = { ...next[idx], present: e.target.checked };
                                setAttendees(next);
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={att.hasVotingRight}
                              onChange={(e) => {
                                const next = [...attendees];
                                next[idx] = { ...next[idx], hasVotingRight: e.target.checked };
                                setAttendees(next);
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={att.isSignatory}
                              onChange={(e) => {
                                const next = [...attendees];
                                next[idx] = { ...next[idx], isSignatory: e.target.checked };
                                setAttendees(next);
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 dark:text-rose-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setAttendees(attendees.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer dark:hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl dark:border-slate-800">
                  Noch keine Teilnehmer erfasst. Namen oben eingeben; Mitglieder werden dabei vorgeschlagen.
                </div>
              )}

              {/* Unterschriften & Abschluss */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 dark:bg-slate-800 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-100">
                  Unterzeichnung & Abschluss des Protokolls
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Unterschrieben wird in der Sitzungsliste über „Digital unterschreiben“. Mit beiden Unterschriften ist das Protokoll genehmigt und gesperrt; das Datum ergibt sich daraus.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                    Allgemeine Schlussbemerkungen
                  </label>
                  <textarea
                    rows={2}
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="z.B. Die Sitzung schloss um 21:15 Uhr. Einwendungen gegen die Tagesordnung wurden nicht erhoben..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-rose-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Abbrechen
            </button>

            <div className="flex items-center gap-3">
              {fehlerListe.length === 0 && ohneStimmenPruefung && (
                <span className="text-xs font-semibold text-amber-700 max-w-md text-right dark:text-amber-300">
                  Hinweis: Stimmen ohne Teilnehmer oder Anzahl der Stimmberechtigten (siehe Reiter 2)
                </span>
              )}
              {fehlerListe.length > 0 && (
                <span className="text-xs font-semibold text-rose-600 max-w-md text-right dark:text-rose-400">
                  {fehler[fehlerListe[0]]}
                  {fehlerListe.length > 1 ? ` (und ${fehlerListe.length - 1} weitere)` : ''}
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : isEditing ? 'Änderungen speichern' : 'Sitzung anlegen'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
