import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Building,
  CheckCircle2,
  HelpCircle,
  FileText,
  Download,
  Mail,
  Sparkles,
  Mic,
  Upload
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
import { MeetingPdfService } from '../services/meetingPdfService';
import { DEFAULT_MEETING_TEMPLATE } from '../data/initialMeetings';
import { MeetingNotesUploadModal } from './MeetingNotesUploadModal';
import { MeetingAudioRecorderModal } from './MeetingAudioRecorderModal';
import { MeetingAiAssistantModal } from './MeetingAiAssistantModal';
import { MeetingExtractedData } from '../services/meetingAiService';

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingToEdit?: Meeting | null;
  members: Member[];
  clubSettings?: ClubSettings;
  templateSettings?: MeetingTemplateSettings;
  onSave: (meeting: Meeting) => Promise<void>;
}

const DEFAULT_AGENDA_MV: MeetingAgendaItem[] = [
  { id: 'top-1', number: 'TOP 1', title: 'Begrüßung und Feststellung der ordnungsgemäßen Ladung und Beschlussfähigkeit' },
  { id: 'top-2', number: 'TOP 2', title: 'Bericht des Vorstands über das abgelaufene Geschäftsjahr' },
  { id: 'top-3', number: 'TOP 3', title: 'Finanzbericht des Schatzmeisters und Bericht der Kassenprüfer' },
  { id: 'top-4', number: 'TOP 4', title: 'Aussprache und Entlastung des Vorstands' },
  { id: 'top-5', number: 'TOP 5', title: 'Wahlen zum Vorstand und der Kassenprüfer' },
  { id: 'top-6', number: 'TOP 6', title: 'Anträge und Verschiedenes' }
];

const DEFAULT_AGENDA_VS: MeetingAgendaItem[] = [
  { id: 'top-1', number: 'TOP 1', title: 'Begrüßung und Genehmigung des Protokolls der letzten Vorstandssitzung' },
  { id: 'top-2', number: 'TOP 2', title: 'Berichte der Vorstandsmitglieder (Finanzen, Sport, Jugend)' },
  { id: 'top-3', number: 'TOP 3', title: 'Laufende Projekte, Investitionsanträge & Beschlussfassung' },
  { id: 'top-4', number: 'TOP 4', title: 'Termine, Veranstaltungen & Verschiedenes' }
];

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  isOpen,
  onClose,
  meetingToEdit,
  members,
  clubSettings,
  templateSettings,
  onSave
}) => {
  const isEditing = Boolean(meetingToEdit);

  const [type, setType] = useState<MeetingType>(meetingToEdit?.type || 'board');
  const [title, setTitle] = useState(meetingToEdit?.title || (meetingToEdit?.type === 'general_assembly' ? 'Ordentliche Mitgliederversammlung 2026' : 'Vorstandssitzung'));
  const [status, setStatus] = useState<MeetingStatus>(meetingToEdit?.status || 'scheduled');
  const [protocolType, setProtocolType] = useState<MeetingProtocolType>(meetingToEdit?.protocolType || 'results');
  const [date, setDate] = useState(meetingToEdit?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(meetingToEdit?.startTime || '19:00');
  const [endTime, setEndTime] = useState(meetingToEdit?.endTime || '21:00');
  const [location, setLocation] = useState(meetingToEdit?.location || 'Vereinsheim TSV Musterstadt');
  const [chairperson, setChairperson] = useState(meetingToEdit?.chairperson || 'Dr. Michael Sommer');
  const [minuteKeeper, setMinuteKeeper] = useState(meetingToEdit?.minuteKeeper || 'Sabine Weber');

  // Compliance
  const [invitationDate, setInvitationDate] = useState(meetingToEdit?.invitationDate || '');
  const [invitationMethod, setInvitationMethod] = useState(meetingToEdit?.invitationMethod || 'Per E-Mail mit Tagesordnung gem. Satzung');
  const [invitationCompliant, setInvitationCompliant] = useState(meetingToEdit ? meetingToEdit.invitationCompliant : true);
  const [quorumConfirmed, setQuorumConfirmed] = useState(meetingToEdit ? meetingToEdit.quorumConfirmed : true);
  const [totalEligibleVoters, setTotalEligibleVoters] = useState<number | ''>(meetingToEdit?.totalEligibleVoters ?? 5);

  // Agenda & TOPs
  const [agenda, setAgenda] = useState<MeetingAgendaItem[]>(
    meetingToEdit?.agenda || (type === 'general_assembly' ? DEFAULT_AGENDA_MV : DEFAULT_AGENDA_VS)
  );

  // Attendees & Mitgliedersuche
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(meetingToEdit?.attendees || []);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [generalNotes, setGeneralNotes] = useState(meetingToEdit?.generalNotes || '');
  const [signedAt, setSignedAt] = useState(meetingToEdit?.signedAt || '');

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

  // AI & Media Modals State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiAssistantConfig, setAiAssistantConfig] = useState<{
    mode: 'resolution' | 'discussion' | 'agenda';
    topIndex?: number;
    initialInput?: string;
  }>({ mode: 'resolution' });

  // Handle data extracted from notes upload or audio transcription
  const handleApplyExtractedData = (extracted: MeetingExtractedData) => {
    if (extracted.title) setTitle(extracted.title);
    if (extracted.type) setType(extracted.type);
    if (extracted.date) setDate(extracted.date);
    if (extracted.startTime) setStartTime(extracted.startTime);
    if (extracted.endTime) setEndTime(extracted.endTime);
    if (extracted.location) setLocation(extracted.location);
    if (extracted.chairperson) setChairperson(extracted.chairperson);
    if (extracted.minuteKeeper) setMinuteKeeper(extracted.minuteKeeper);

    if (extracted.agenda && extracted.agenda.length > 0) {
      setAgenda(extracted.agenda);
    }

    if (extracted.attendees && extracted.attendees.length > 0) {
      const newAtts: MeetingAttendee[] = extracted.attendees.map((a, idx) => ({
        id: `att-ai-${Date.now()}-${idx}`,
        name: a.name,
        role: a.role || 'Teilnehmer',
        present: a.present ?? true,
        hasVotingRight: a.hasVotingRight ?? true,
        isSignatory: idx === 0 || a.role?.toLowerCase().includes('vorsitz') || a.role?.toLowerCase().includes('leiter') || false,
      }));
      setAttendees((prev) => {
        if (prev.length === 0) return newAtts;
        const existingNames = new Set(prev.map((p) => p.name.toLowerCase()));
        const toAdd = newAtts.filter((na) => !existingNames.has(na.name.toLowerCase()));
        return [...prev, ...toAdd];
      });
    }

    if (extracted.generalNotes || extracted.transcriptSummary || extracted.extractedRawSummary) {
      const extraNotes = [
        extracted.generalNotes,
        extracted.transcriptSummary ? `Audio-Transkript Essenz:\n${extracted.transcriptSummary}` : null,
        extracted.extractedRawSummary ? `Notizen-Erfassung:\n${extracted.extractedRawSummary}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (extraNotes) {
        setGeneralNotes((prev) => (prev ? `${prev}\n\n${extraNotes}` : extraNotes));
      }
    }

    // Automatically switch to Agenda tab so user immediately sees and can edit the extracted items
    setActiveTab('agenda');
  };

  const handleOpenAiResolutionAssistant = (topIndex: number) => {
    setAiAssistantConfig({
      mode: 'resolution',
      topIndex,
      initialInput: '',
    });
    setIsAiAssistantOpen(true);
  };

  const handleOpenAiDiscussionAssistant = (topIndex: number) => {
    setAiAssistantConfig({
      mode: 'discussion',
      topIndex,
      initialInput: agenda[topIndex]?.discussionNotes || '',
    });
    setIsAiAssistantOpen(true);
  };

  const handleOpenAiAgendaAssistant = () => {
    setAiAssistantConfig({
      mode: 'agenda',
      initialInput: title,
    });
    setIsAiAssistantOpen(true);
  };

  const handleApplyAiResolution = (res: Partial<MeetingResolution>) => {
    if (aiAssistantConfig.topIndex === undefined) return;
    const topIndex = aiAssistantConfig.topIndex;
    const top = agenda[topIndex];
    if (!top) return;

    const newRes: MeetingResolution = {
      id: `res-${Date.now()}`,
      agendaItemNumber: top.number,
      title: res.title || 'Beschlussantrag',
      motionText: res.motionText || '',
      proposer: res.proposer || chairperson,
      votesFor: typeof totalEligibleVoters === 'number' ? totalEligibleVoters : 5,
      votesAgainst: 0,
      votesAbstain: 0,
      result: res.result || 'accepted',
      isTaxRelevant: Boolean(res.isTaxRelevant),
      isRegisterRelevant: Boolean(res.isRegisterRelevant),
      responsiblePerson: res.responsiblePerson || '',
      notes: res.notes || '',
    };

    const nextTop = {
      ...top,
      resolutions: [...(top.resolutions || []), newRes],
    };
    const nextAgenda = [...agenda];
    nextAgenda[topIndex] = nextTop;
    setAgenda(nextAgenda);
  };

  const handleApplyAiDiscussion = (text: string) => {
    if (aiAssistantConfig.topIndex === undefined) return;
    handleUpdateTop(aiAssistantConfig.topIndex, { discussionNotes: text });
  };

  const handleApplyAiAgenda = (items: { number: string; title: string; description?: string }[]) => {
    if (!items || items.length === 0) return;
    const newTops: MeetingAgendaItem[] = items.map((it, idx) => ({
      id: `top-${Date.now()}-${idx + 1}`,
      number: it.number || `TOP ${idx + 1}`,
      title: it.title || `Tagesordnungspunkt ${idx + 1}`,
      discussionNotes: it.description || '',
    }));
    setAgenda(newTops);
  };

  if (!isOpen) return null;

  const handleDownloadInvitation = async () => {
    setIsGeneratingInvitation(true);
    try {
      const doc = await MeetingPdfService.generateInvitationPdf(
        {
          title: title.trim() || 'Mitgliederversammlung',
          type,
          date: date || new Date().toISOString().split('T')[0],
          startTime: startTime || '19:00',
          endTime: endTime || undefined,
          location: location.trim() || 'Vereinsheim',
          chairperson: chairperson.trim() || '1. Vorsitzender',
          minuteKeeper: minuteKeeper.trim() || 'Schriftführer',
          invitationDate: invitationDate || undefined,
          agenda
        },
        clubSettings || ({ clubName: 'Sportverein Musterstadt e.V.' } as any),
        templateSettings || DEFAULT_MEETING_TEMPLATE
      );
      doc.save(`Einladung_${date}_${(title || 'Versammlung').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate invitation PDF:', err);
      alert('Fehler beim Erzeugen des Einladungs-PDFs.');
    } finally {
      setIsGeneratingInvitation(false);
    }
  };

  const handleTypeChange = (newType: MeetingType) => {
    setType(newType);
    if (!meetingToEdit) {
      if (newType === 'general_assembly') {
        setTitle('Ordentliche Mitgliederversammlung (Jahreshauptversammlung) 2026');
        setAgenda(DEFAULT_AGENDA_MV);
        setTotalEligibleVoters(35);
      } else if (newType === 'board') {
        setTitle('Vorstandssitzung');
        setAgenda(DEFAULT_AGENDA_VS);
        setTotalEligibleVoters(5);
      }
    }
  };

  const handleAddTop = () => {
    const nextNumber = agenda.length + 1;
    setAgenda([
      ...agenda,
      {
        id: `top-${Date.now()}`,
        number: `TOP ${nextNumber}`,
        title: 'Neuer Tagesordnungspunkt',
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
    setAgenda(agenda.filter((_, i) => i !== index));
  };

  const handleAddResolution = (topIndex: number) => {
    const top = agenda[topIndex];
    const newResolution: MeetingResolution = {
      id: `res-${Date.now()}`,
      agendaItemNumber: top.number,
      title: 'Beschlussantrag',
      motionText: 'Der Vorstand / die Versammlung beschließt...',
      proposer: chairperson,
      votesFor: totalEligibleVoters,
      votesAgainst: 0,
      votesAbstain: 0,
      result: 'accepted',
      isTaxRelevant: false,
      isRegisterRelevant: false
    };

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
    resolutions[resIndex] = { ...resolutions[resIndex], ...updated };
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

  const handleImportBoardAttendees = () => {
    const boardAttendees: MeetingAttendee[] = [
      { id: 'att-sommer', name: 'Dr. Michael Sommer', role: '1. Vorsitzender (Versammlungsleiter)', present: true, hasVotingRight: true, isSignatory: true },
      { id: 'att-schneider', name: 'Thomas Schneider', role: '2. Vorsitzender', present: true, hasVotingRight: true, isSignatory: false },
      { id: 'att-weber', name: 'Sabine Weber', role: 'Kassenwartin / Schatzmeisterin', present: true, hasVotingRight: true, isSignatory: true },
      { id: 'att-franke', name: 'Claudia Franke', role: 'Jugendleiterin', present: true, hasVotingRight: true, isSignatory: false },
      { id: 'att-bauer', name: 'Marcus Bauer', role: 'Schriftführer & Presse', present: true, hasVotingRight: true, isSignatory: false }
    ];
    setAttendees(boardAttendees);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Bitte geben Sie einen Titel und ein Datum für die Sitzung an.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const meetingData: Meeting = {
        id: meetingToEdit?.id || `meet-${Date.now()}`,
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
        invitationMethod: invitationMethod || undefined,
        invitationCompliant,
        quorumConfirmed,
        totalEligibleVoters: typeof totalEligibleVoters === 'number' ? totalEligibleVoters : (parseInt(totalEligibleVoters || '0', 10) || 1),
        agenda,
        attendees,
        generalNotes: generalNotes.trim() || undefined,
        signedAt: signedAt || undefined,
        createdAt: meetingToEdit?.createdAt || now,
        updatedAt: now
      };

      await onSave(meetingData);
      onClose();
    } catch (err) {
      console.error('Failed to save meeting:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? 'Sitzung & Protokoll bearbeiten' : 'Neue Sitzung / Versammlung erfassen'}
              </h3>
              <p className="text-xs text-slate-500">
                Rechtssichere Dokumentation gem. BGB und Satzungsvorgaben mit Beschlussfassung und Beschlussfähigkeit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadInvitation}
              disabled={isGeneratingInvitation}
              className="px-3.5 py-1.5 text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Erzeugt das offizielle Einladungsschreiben mit Tagesordnung als PDF gem. § 32 BGB"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>{isGeneratingInvitation ? 'Erzeuge...' : 'Einladung (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Smart AI Actions Toolbar */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-rose-50/80 via-purple-50/50 to-amber-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-rose-200 rounded-lg text-rose-700 font-bold text-[11px] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span>KI-Protokolldienst</span>
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              Protokollentwurf aus Dokumenten, Audio oder Beschlussideen generieren & anpassen
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsNotesModalOpen(true)}
              className="px-3 py-1.5 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Handschriftliche Notizen, Whiteboard-Fotos oder PDF-Scans hochladen"
            >
              <Upload className="w-3.5 h-3.5 text-rose-600" />
              <span>Notizen importieren (PDF/Foto)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAudioModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${
                type === 'general_assembly' || type === 'extraordinary_assembly'
                  ? 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                  : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
              }`}
              title={
                type === 'general_assembly' || type === 'extraordinary_assembly'
                  ? 'Audio-Erfassung ist für Mitgliederversammlungen aus Datenschutzgründen (DSGVO) gesperrt'
                  : 'Vorstandssitzung oder Gremium per Mikrofon aufnehmen oder Audiodatei hochladen'
              }
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio-Erfassung</span>
              {(type === 'general_assembly' || type === 'extraordinary_assembly') && (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-200 text-amber-900 font-bold">
                  Für MV gesperrt
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAiAssistantConfig({ mode: 'resolution' });
                setIsAiAssistantOpen(true);
              }}
              className="px-3 py-1.5 bg-white text-amber-800 border border-amber-200 hover:bg-amber-50 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Rechtssichere Beschlüsse formulieren oder Tagesordnung vorschlagen lassen"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>KI-Formulierungshilfe</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'details'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>1. Stammdaten & Leitung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'agenda'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Tagesordnung & Einladung ({agenda.length} TOPs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'compliance'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Am Versammlungstag: Beschlussfähigkeit & Nachweise</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendees')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'attendees'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>4. Teilnehmer & Unterschriften ({attendees.length})</span>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: STAMMDATEN */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sitzungsart / Gremium *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as MeetingType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="board">Vorstandssitzung (§ 26 BGB)</option>
                    <option value="general_assembly">Ordentliche Mitgliederversammlung (Jahreshauptversammlung)</option>
                    <option value="extraordinary_assembly">Außerordentliche Mitgliederversammlung</option>
                    <option value="committee">Ausschuss / Fachbereich / Beirat</option>
                    <option value="department">Abteilungsversammlung</option>
                    <option value="other">Sonstige Sitzung</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Titel der Sitzung / Niederschrift *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z.B. Vorstandssitzung Q3/2026 oder Jahreshauptversammlung 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Datum der Sitzung *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Beginn (Uhrzeit) *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ende (Uhrzeit)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status des Protokolls
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MeetingStatus)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="scheduled">Geplant / Einberufen</option>
                    <option value="in_progress">In Durchführung</option>
                    <option value="draft">Entwurf des Protokolls</option>
                    <option value="review">In Vorprüfung</option>
                    <option value="approved">Rechtskräftig genehmigt</option>
                    <option value="cancelled">Abgesagt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ort der Sitzung
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="z.B. Vereinsheim, Sporthalle oder Online"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Versammlungsleiter (Vorsitz)
                  </label>
                  <input
                    type="text"
                    value={chairperson}
                    onChange={(e) => setChairperson(e.target.value)}
                    placeholder="z.B. Dr. Michael Sommer (1. Vorsitzender)"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Protokollführer / Schriftführer
                  </label>
                  <input
                    type="text"
                    value={minuteKeeper}
                    onChange={(e) => setMinuteKeeper(e.target.value)}
                    placeholder="z.B. Sabine Weber oder Marcus Bauer"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Protokollform
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                      protocolType === 'results' ? 'border-rose-500 bg-rose-50/40' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="protocolType"
                      value="results"
                      checked={protocolType === 'results'}
                      onChange={() => setProtocolType('results')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Ergebnisprotokoll (Gesetzlicher Standard)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Konzentriert sich rechtssicher auf Anträge, exakte Stimmergebnisse, Wahlen und Beschlüsse gem. BGB.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                      protocolType === 'verbatim' ? 'border-rose-500 bg-rose-50/40' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="protocolType"
                      value="verbatim"
                      checked={protocolType === 'verbatim'}
                      onChange={() => setProtocolType('verbatim')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Ausführliches Verlaufsprotokoll</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
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
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">Rechtliche Vorgaben für die Gültigkeit von Beschlüssen</p>
                  <p className="text-amber-800 leading-relaxed">
                    Sowohl das Vereinsregister (Amtsgericht) als auch das Finanzamt prüfen im Streit- oder Prüfungsfall,
                    ob die Einberufung satzungskonform erfolgte und die Versammlung beschlussfähig war. Fehlt dieser Nachweis,
                    können Beschlüsse (z.B. Vorstandswahlen, Satzungsänderungen, Ehrenamtspauschalen) anfechtbar oder nichtig sein.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Datum des Versands der Einladung
                  </label>
                  <input
                    type="date"
                    value={invitationDate}
                    onChange={(e) => setInvitationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dient dem Nachweis der Einhaltung der satzungsgemäßen Einladungsfrist (z.B. 2 oder 4 Wochen).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Art & Weg der Einberufung
                  </label>
                  <input
                    type="text"
                    value={invitationMethod}
                    onChange={(e) => setInvitationMethod(e.target.value)}
                    placeholder="z.B. Schriftlich per E-Mail gem. § 8 der Satzung"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Feststellungen bei Versammlungsbeginn
                </h4>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitationCompliant}
                    onChange={(e) => setInvitationCompliant(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Form- und fristgerechte Einladung wurde festgestellt und bestätigt
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Wird im Protokollkopf explizit bestätigt, wie von Registergerichten gefordert.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quorumConfirmed}
                    onChange={(e) => setQuorumConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Beschlussfähigkeit ist gegeben und ordnungsgemäß festgestellt
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Gemäß Satzung (z.B. unabhängig von der Zahl der Erschienenen oder Mindestanzahl Vorstände).
                    </p>
                  </div>
                </label>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Anzahl anwesender stimmberechtigter Mitglieder *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalEligibleVoters === '' ? '' : totalEligibleVoters}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setTotalEligibleVoters('');
                      } else {
                        const parsed = parseInt(val, 10);
                        setTotalEligibleVoters(isNaN(parsed) ? '' : Math.max(1, parsed));
                      }
                    }}
                    onBlur={() => {
                      if (totalEligibleVoters === '' || totalEligibleVoters < 1) {
                        setTotalEligibleVoters(1);
                      }
                    }}
                    placeholder="z.B. 5"
                    className="w-48 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Wichtig für Quorum- und Mehrheitsberechnungen (z.B. einfache Mehrheit, 2/3- oder 3/4-Mehrheit).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TAGESORDNUNG & EINLADUNGSSCHREIBEN (GEM. § 32 BGB) */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              {/* Einladungs- & BGB § 32 Vorbereitungskarte */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
                      § 32 Abs. 1 Satz 2 BGB
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">
                      Einberufung & Bekanntgabe der Tagesordnung
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
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
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Tagesordnungspunkte (TOPs) & Beratungen
                  </h4>
                  <p className="text-xs text-slate-500">
                    Fügen Sie TOPs hinzu, erfassen Sie den Diskussionsverlauf und fassen Sie Beschlüsse mit exaktem Abstimmungsergebnis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAiAgendaAssistant}
                    className="px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                    title="Tagesordnungsvorschläge passend zum Sitzungszweck generieren"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tagesordnung vorschlagen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTop}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                    title="Neuen TOP hinzufügen"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>neuer TOP</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {agenda.map((top, topIndex) => (
                  <div
                    key={top.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={top.number}
                          onChange={(e) => handleUpdateTop(topIndex, { number: e.target.value })}
                          className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          placeholder="TOP 1"
                        />
                        <input
                          type="text"
                          value={top.title}
                          onChange={(e) => handleUpdateTop(topIndex, { title: e.target.value })}
                          className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                          placeholder="Titel des Tagesordnungspunkts"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={top.speaker || ''}
                          onChange={(e) => handleUpdateTop(topIndex, { speaker: e.target.value })}
                          className="w-36 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 placeholder:text-slate-400"
                          placeholder="Berichterstatter"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTop(topIndex)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          title="TOP entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Besprechung / Diskussionsnotizen */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-600">
                          Beratung, Aussprache & Diskussionsverlauf
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenAiDiscussionAssistant(topIndex)}
                          className="px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Notizen durch KI in sachlichen Protokolltext umwandeln"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Notizen glätten</span>
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={top.discussionNotes || ''}
                        onChange={(e) => handleUpdateTop(topIndex, { discussionNotes: e.target.value })}
                        placeholder="Zusammenfassung der Beratung, wesentliche Argumente oder Berichtsinhalte..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    {/* Beschlüsse unter diesem TOP */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-rose-600" />
                          Beschlussfassungen & Anträge ({top.resolutions?.length || 0})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAiResolutionAssistant(topIndex)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                            title="Beschlussentwurf mit rechtssicherem Antragswortlaut formulieren lassen"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Beschluss formulieren</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddResolution(topIndex)}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:text-rose-800 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
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
                              className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-2xs space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                                    Beschluss
                                  </span>
                                  <input
                                    type="text"
                                    value={res.title}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { title: e.target.value })
                                    }
                                    placeholder="Kurztitel des Beschlusses"
                                    className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveResolution(topIndex, resIndex)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                                  Exakter Beschluss- / Antragswortlaut *
                                </label>
                                <textarea
                                  rows={2}
                                  value={res.motionText}
                                  onChange={(e) =>
                                    handleUpdateResolution(topIndex, resIndex, { motionText: e.target.value })
                                  }
                                  placeholder="Der Vorstand / die Versammlung beschließt, dass..."
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:ring-1 focus:ring-rose-500"
                                />
                              </div>

                              {/* Abstimmungsergebnis */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-700">Ja-Stimmen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesFor}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesFor: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-emerald-700"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-rose-700">Nein-Stimmen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesAgainst}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesAgainst: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-rose-700"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600">Enthaltungen</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={res.votesAbstain}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { votesAbstain: Number(e.target.value) })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700">Ergebnis</label>
                                  <select
                                    value={res.result}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, {
                                        result: e.target.value as 'accepted' | 'rejected' | 'deferred'
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800"
                                  >
                                    <option value="accepted">Angenommen</option>
                                    <option value="rejected">Abgelehnt</option>
                                    <option value="deferred">Vertagt</option>
                                  </select>
                                </div>
                              </div>

                              {/* Relevanz-Flags */}
                              <div className="flex flex-wrap items-center gap-4 text-xs">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={res.isTaxRelevant}
                                    onChange={(e) =>
                                      handleUpdateResolution(topIndex, resIndex, { isTaxRelevant: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500"
                                  />
                                  <span className="text-slate-700 text-[11px] font-medium">
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
                                    className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500"
                                  />
                                  <span className="text-slate-700 text-[11px] font-medium">
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
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Anwesenheitsliste & Protokollunterzeichner
                  </h4>
                  <p className="text-xs text-slate-500">
                    Erfassen Sie anwesende Vorstände, Mitglieder oder Gäste sowie die satzungsgemäßen Unterzeichner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImportBoardAttendees}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Standard-Vorstand laden
                </button>
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
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400"
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
                  <div className="absolute top-full left-0 right-28 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
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
                          className={`px-3 py-1.5 hover:bg-rose-50/80 cursor-pointer flex items-center justify-between transition-colors ${
                            isAlreadyAdded ? 'bg-slate-50/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5.5 h-5.5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200">
                              {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 text-xs truncate block">
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Bereits erfasst
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">
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
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Funktion / Rolle</th>
                        <th className="px-3 py-2 text-center">Anwesend</th>
                        <th className="px-3 py-2 text-center">Stimmrecht</th>
                        <th className="px-3 py-2 text-center">Unterzeichnet</th>
                        <th className="px-3 py-2 text-right">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {attendees.map((att, idx) => (
                        <tr key={att.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-semibold text-slate-800">
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
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700"
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
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
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
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
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
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setAttendees(attendees.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
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
                <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Noch keine Teilnehmer erfasst. Nutzen Sie "Standard-Vorstand laden" oder fügen Sie Mitglieder hinzu.
                </div>
              )}

              {/* Unterschriften & Abschluss */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Unterzeichnung & Abschluss des Protokolls
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Datum der Genehmigung / Unterzeichnung
                    </label>
                    <input
                      type="date"
                      value={signedAt}
                      onChange={(e) => setSignedAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Allgemeine Schlussbemerkungen
                  </label>
                  <textarea
                    rows={2}
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="z.B. Die Sitzung schloss um 21:15 Uhr. Einwendungen gegen die Tagesordnung wurden nicht erhoben..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Abbrechen
            </button>

            <div className="flex items-center gap-2">
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

        {/* Modals for AI Assistants & Media Analysis */}
        <MeetingNotesUploadModal
          isOpen={isNotesModalOpen}
          onClose={() => setIsNotesModalOpen(false)}
          meetingContext={{
            title,
            type,
            date,
            chairperson,
          }}
          onApplyData={handleApplyExtractedData}
        />

        <MeetingAudioRecorderModal
          isOpen={isAudioModalOpen}
          onClose={() => setIsAudioModalOpen(false)}
          meetingContext={{
            title,
            type,
            date,
            chairperson,
          }}
          onApplyData={handleApplyExtractedData}
        />

        <MeetingAiAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          mode={aiAssistantConfig.mode}
          initialInput={aiAssistantConfig.initialInput}
          context={{
            meetingTitle: title,
            meetingType: type,
            topTitle:
              aiAssistantConfig.topIndex !== undefined
                ? agenda[aiAssistantConfig.topIndex]?.title
                : undefined,
            agendaCount: agenda.length,
          }}
          onApplyResolution={handleApplyAiResolution}
          onApplyDiscussion={handleApplyAiDiscussion}
          onApplyAgenda={handleApplyAiAgenda}
        />
      </div>
    </div>
  );
};
