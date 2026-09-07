import React, { useState, useMemo } from 'react';
import {
  ScrollText,
  Plus,
  Search,
  FileText,
  Download,
  Sliders,
  CheckCircle2,
  Clock,
  Calendar,
  Building,
  Scale,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Trash2,
  Edit,
  ExternalLink,
  Users,
  Check,
  Award,
  BookOpen,
  Mail,
  Upload,
  Mic,
  Sparkles,
  PenTool,
  Send,
  X
} from 'lucide-react';
import {
  Meeting,
  MeetingType,
  MeetingStatus,
  MeetingTemplateSettings,
  ClubSettings,
  Member
} from '../types';
import { MeetingPdfService } from '../services/meetingPdfService';
import { MeetingFormModal } from './MeetingFormModal';
import { MeetingTemplateModal } from './MeetingTemplateModal';
import { MeetingNotesUploadModal } from './MeetingNotesUploadModal';
import { MeetingAudioRecorderModal } from './MeetingAudioRecorderModal';
import { MeetingSignatureModal } from './MeetingSignatureModal';
import { MeetingEmailModal } from './MeetingEmailModal';
import { MeetingExtractedData } from '../services/meetingAiService';

interface MeetingsViewProps {
  meetings: Meeting[];
  members: Member[];
  clubSettings: ClubSettings;
  templateSettings: MeetingTemplateSettings;
  onSaveMeeting: (meeting: Meeting) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onSaveTemplate: (settings: MeetingTemplateSettings) => Promise<void>;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings,
  members,
  clubSettings,
  templateSettings,
  onSaveMeeting,
  onDeleteMeeting,
  onSaveTemplate
}) => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'resolutions' | 'template'>('meetings');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [generatingInvitationId, setGeneratingInvitationId] = useState<string | null>(null);
  const [isOverviewNotesModalOpen, setIsOverviewNotesModalOpen] = useState(false);
  const [isOverviewAudioModalOpen, setIsOverviewAudioModalOpen] = useState(false);
  const [signatureModalMeeting, setSignatureModalMeeting] = useState<Meeting | null>(null);
  const [emailModalConfig, setEmailModalConfig] = useState<{
    isOpen: boolean;
    meeting: Meeting;
    mode: 'invitation' | 'protocol';
  } | null>(null);
  const [downloadChoice, setDownloadChoice] = useState<{
    meeting: Meeting;
    isExtract: boolean;
  } | null>(null);

  // Apply extracted data from overview AI shortcuts into a new draft meeting
  const handleApplyExtractedFromOverview = (data: MeetingExtractedData) => {
    const newMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      title: data.title || (data.type === 'board' ? 'Vorstandssitzung' : 'Mitgliederversammlung'),
      type: data.type || 'board',
      status: 'draft',
      protocolType: 'results',
      date: data.date || new Date().toISOString().split('T')[0],
      startTime: data.startTime || '19:00',
      endTime: data.endTime || '21:00',
      location: data.location || 'Vereinsheim',
      chairperson: data.chairperson || '1. Vorsitzender',
      minuteKeeper: data.minuteKeeper || 'Schriftführer',
      invitationCompliant: true,
      quorumConfirmed: true,
      totalEligibleVoters: 5,
      agenda: data.agenda && data.agenda.length > 0 ? data.agenda : [],
      attendees: (data.attendees || []).map((a, idx) => ({
        id: `att-ai-${Date.now()}-${idx}`,
        name: a.name,
        role: a.role || 'Teilnehmer',
        present: a.present ?? true,
        hasVotingRight: a.hasVotingRight ?? true,
        isSignatory: idx === 0 || a.role?.toLowerCase().includes('vorsitz') || false,
      })),
      generalNotes: [
        data.generalNotes,
        data.transcriptSummary ? `Audio-Transkript Essenz:\n${data.transcriptSummary}` : null,
        data.extractedRawSummary ? `Notizen-Erfassung:\n${data.extractedRawSummary}` : null,
      ]
        .filter(Boolean)
        .join('\n\n') || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMeetingToEdit(newMeeting);
    setIsOverviewNotesModalOpen(false);
    setIsOverviewAudioModalOpen(false);
    setIsFormModalOpen(true);
  };

  // Statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const generalAssemblies = meetings.filter(m => m.type === 'general_assembly' || m.type === 'extraordinary_assembly').length;
    const boardMeetings = meetings.filter(m => m.type === 'board').length;

    let totalResolutions = 0;
    let taxResolutions = 0;
    let registerResolutions = 0;

    meetings.forEach(m => {
      m.agenda.forEach(top => {
        (top.resolutions || []).forEach(res => {
          totalResolutions++;
          if (res.isTaxRelevant) taxResolutions++;
          if (res.isRegisterRelevant) registerResolutions++;
        });
      });
    });

    return {
      total,
      generalAssemblies,
      boardMeetings,
      totalResolutions,
      taxResolutions,
      registerResolutions
    };
  }, [meetings]);

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (selectedType !== 'all' && m.type !== selectedType) return false;
      if (selectedStatus !== 'all' && m.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesLocation = m.location?.toLowerCase().includes(q);
        const matchesChair = m.chairperson?.toLowerCase().includes(q);
        const matchesTop = m.agenda.some(top =>
          top.title.toLowerCase().includes(q) ||
          top.discussionNotes?.toLowerCase().includes(q) ||
          (top.resolutions || []).some(r => r.title.toLowerCase().includes(q) || r.motionText.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesLocation && !matchesChair && !matchesTop) return false;
      }
      return true;
    });
  }, [meetings, selectedType, selectedStatus, searchQuery]);

  // All resolutions flattened for the Beschlussbuch
  const allResolutions = useMemo(() => {
    const list: Array<{
      meeting: Meeting;
      agendaNumber: string;
      agendaTitle: string;
      resolution: import('../types').MeetingResolution;
    }> = [];

    meetings.forEach(m => {
      m.agenda.forEach(top => {
        (top.resolutions || []).forEach(res => {
          list.push({
            meeting: m,
            agendaNumber: top.number,
            agendaTitle: top.title,
            resolution: res
          });
        });
      });
    });

    return list.sort((a, b) => new Date(b.meeting.date).getTime() - new Date(a.meeting.date).getTime());
  }, [meetings]);

  const [resolutionFilter, setResolutionFilter] = useState<'all' | 'tax' | 'register'>('all');

  const filteredResolutions = useMemo(() => {
    return allResolutions.filter(item => {
      if (resolutionFilter === 'tax' && !item.resolution.isTaxRelevant) return false;
      if (resolutionFilter === 'register' && !item.resolution.isRegisterRelevant) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.resolution.title.toLowerCase().includes(q) ||
          item.resolution.motionText.toLowerCase().includes(q) ||
          item.meeting.title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allResolutions, resolutionFilter, searchQuery]);

  const handleCreateMeeting = () => {
    setMeetingToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleEditMeeting = (m: Meeting) => {
    setMeetingToEdit(m);
    setIsFormModalOpen(true);
  };

  const handleInitiateDownloadPdf = (m: Meeting, isExtract: boolean = false) => {
    // If the meeting has digital signatures, offer choice between digital signature and blank signature line
    if (m.signatures && m.signatures.length > 0) {
      setDownloadChoice({ meeting: m, isExtract });
    } else {
      handleExecuteDownloadPdf(m, isExtract, false);
    }
  };

  const handleExecuteDownloadPdf = async (m: Meeting, isExtract: boolean, withDigitalSignatures: boolean) => {
    setGeneratingPdfId(m.id);
    try {
      let doc;
      const suffix = withDigitalSignatures ? 'digital_signiert' : 'blanko_ausdruck';
      const safeTitle = (m.title || 'Sitzung').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');

      if (isExtract) {
        doc = await MeetingPdfService.generateRegisterExtractPdf(m, clubSettings, templateSettings, {
          includeDigitalSignatures: withDigitalSignatures
        });
        doc.save(`Registerauszug_${m.date}_${safeTitle}_${suffix}.pdf`);
      } else {
        doc = await MeetingPdfService.generateProtocolPdf(m, clubSettings, templateSettings, {
          includeDigitalSignatures: withDigitalSignatures
        });
        doc.save(`Protokoll_${m.date}_${safeTitle}_${suffix}.pdf`);
      }
    } catch (err) {
      console.error('Failed to generate meeting PDF:', err);
      alert('Fehler beim Erzeugen des Protokoll-PDFs.');
    } finally {
      setGeneratingPdfId(null);
      setDownloadChoice(null);
    }
  };

  const handleDownloadInvitationPdf = async (m: Meeting) => {
    setGeneratingInvitationId(m.id);
    try {
      const doc = await MeetingPdfService.generateInvitationPdf(
        {
          title: m.title,
          type: m.type,
          date: m.date,
          startTime: m.startTime,
          endTime: m.endTime,
          location: m.location,
          chairperson: m.chairperson,
          minuteKeeper: m.minuteKeeper,
          invitationDate: m.invitationDate,
          agenda: m.agenda
        },
        clubSettings,
        templateSettings
      );
      doc.save(`Einladung_${m.date}_${m.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate invitation PDF:', err);
      alert('Fehler beim Erzeugen des Einladungs-PDFs.');
    } finally {
      setGeneratingInvitationId(null);
    }
  };

  const getStatusBadge = (status: MeetingStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3" /> Genehmigt & Gültig
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> In Vorprüfung
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="w-3 h-3" /> Protokoll-Entwurf
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> In Durchführung
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Calendar className="w-3 h-3" /> Einberufen / Geplant
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: MeetingType) => {
    switch (type) {
      case 'board':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800">
            Vorstandssitzung
          </span>
        );
      case 'general_assembly':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800">
            Mitgliederversammlung
          </span>
        );
      case 'extraordinary_assembly':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-100 text-orange-800">
            Außerordentliche MV
          </span>
        );
      case 'committee':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-800">
            Ausschuss / Fachbereich
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
            Sitzung
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Sitzungs- & Protokolldienst
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Vorstandssitzungen & Mitgliederversammlungen rechtssicher protokollieren.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsOverviewNotesModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Handschriftliche Notizen oder Scan als PDF/Foto hochladen und Protokoll erzeugen lassen"
          >
            <Upload className="w-4 h-4 text-rose-600" />
            <span>Notizen hochladen</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOverviewAudioModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Sitzungs-Audio aufnehmen oder Audiodatei hochladen (für Vorstand & Ausschüsse, nicht für MV)"
          >
            <Mic className="w-4 h-4 text-purple-600" />
            <span>Audio-Diktat / Aufnahme</span>
          </button>

          <button
            type="button"
            onClick={handleCreateMeeting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Sitzung erfassen</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Sitzungen gesamt</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats.boardMeetings} Vorstandssitzungen • {stats.generalAssemblies} Versammlungen
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Beschlüsse gefasst</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.totalResolutions}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rechtskräftig in Protokollen protokolliert
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Finanzamt-relevant</span>
            <Building className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600">{stats.taxResolutions}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            z.B. Ehrenamtspauschalen, Mittel & Rücklagen
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Vereinsregister / Notar</span>
            <Scale className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{stats.registerResolutions}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Wahlen gem. § 26 BGB & Satzungsbeschlüsse
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('meetings')}
          className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'meetings'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ScrollText className="w-4 h-4 shrink-0" />
          <span>Sitzungen & Protokolle ({meetings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolutions')}
          className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'resolutions'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Beschlussbuch / Beschlussregister ({allResolutions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('template')}
          className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'template'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Vorlagen & Vereinsbriefpapier</span>
        </button>
      </div>

      {/* TAB 1: SITZUNGEN & PROTOKOLLE */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Sitzung, TOP, Beschluss suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">Alle Sitzungsarten</option>
                <option value="board">Vorstandssitzungen</option>
                <option value="general_assembly">Mitgliederversammlungen</option>
                <option value="extraordinary_assembly">Außerordentliche MV</option>
                <option value="committee">Ausschüsse & Abteilungen</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">Alle Status</option>
                <option value="scheduled">Geplant / Einberufen</option>
                <option value="draft">Entwurf</option>
                <option value="review">In Prüfung</option>
                <option value="approved">Genehmigt</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              {filteredMeetings.length} von {meetings.length} Sitzungen
            </div>
          </div>

          {/* Meeting Cards List */}
          {filteredMeetings.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
              <ScrollText className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Keine Sitzungen gefunden</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Legen Sie eine neue Vorstandssitzung oder Mitgliederversammlung an, um die Tagesordnung und Beschlüsse rechtssicher zu dokumentieren.
              </p>
              <button
                type="button"
                onClick={handleCreateMeeting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Neue Sitzung anlegen</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredMeetings.map((m) => {
                const totalResolutionsInMeeting = m.agenda.reduce(
                  (acc, top) => acc + (top.resolutions?.length || 0),
                  0
                );
                const isGeneral = m.type === 'general_assembly' || m.type === 'extraordinary_assembly';
                const needsRegisterExtract =
                  isGeneral || m.agenda.some((top) => top.resolutions?.some((r) => r.isRegisterRelevant));

                return (
                  <div
                    key={m.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all space-y-4"
                  >
                    {/* Obere Leiste: Status-Badges & Aktions-Buttons */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTypeBadge(m.type)}
                        {getStatusBadge(m.status)}
                        {m.quorumConfirmed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Beschlussfähig
                          </span>
                        )}
                        {m.invitationCompliant && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <Check className="w-3 h-3 text-emerald-600" /> Fristgerecht geladen
                          </span>
                        )}

                        {/* Digital Signature Badge / Button */}
                        {m.signatures && m.signatures.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSignatureModalMeeting(m)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                            title="Digitale Signaturen einsehen oder aktualisieren"
                          >
                            <PenTool className="w-3 h-3 text-emerald-600" />
                            <span>{m.signatures.length}/2 digital signiert</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSignatureModalMeeting(m)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer shadow-2xs"
                            title="Protokoll am PC mit Maus oder am Smartphone mit Finger digital unterzeichnen"
                          >
                            <PenTool className="w-3 h-3 text-rose-500" />
                            <span>Digital unterschreiben</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* E-Mail Versand Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setEmailModalConfig({
                              isOpen: true,
                              meeting: m,
                              mode: m.status === 'approved' ? 'protocol' : 'invitation'
                            })
                          }
                          className="h-7 px-2.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                          title="Einladung oder Protokoll per E-Mail an Mitglieder/Teilnehmer versenden (DSGVO-konform mit BCC)"
                        >
                          <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>E-Mail versenden</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Möchten Sie die Sitzung "${m.title}" wirklich löschen?`)) {
                              onDeleteMeeting(m.id);
                            }
                          }}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                          title="Sitzung löschen"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 mt-0.5 break-words">
                          {m.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {new Date(m.date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {m.startTime} Uhr{m.endTime ? ` – ${m.endTime} Uhr` : ''}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{m.location || 'Vereinsheim'}</span>
                          </span>
                          <span className="flex items-center gap-1 flex-wrap">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Leitung: {m.chairperson} • Protokoll: {m.minuteKeeper}</span>
                          </span>
                        </div>
                      </div>

                      {/* Quick Action Buttons: 2 Zeilen harmonisch ausgerichtet (1. Zeile: Einladung, Protokoll; 2. Zeile: Register-Auszug, Bearbeiten) */}
                      <div className="flex flex-col gap-2 shrink-0 self-stretch sm:self-start lg:self-center pt-2 lg:pt-0 w-full sm:w-[310px]">
                        {/* 1. Zeile: Einladung, Protokoll */}
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleDownloadInvitationPdf(m)}
                            disabled={generatingInvitationId === m.id}
                            className="h-8.5 px-3 text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-w-0"
                            title="Form- und fristgerechtes Einladungsschreiben mit Tagesordnung gem. § 32 BGB als PDF herunterladen"
                          >
                            <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="truncate">{generatingInvitationId === m.id ? 'Erzeuge...' : 'Einladung'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInitiateDownloadPdf(m, false)}
                            disabled={generatingPdfId === m.id}
                            className="h-8.5 px-3 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-w-0"
                            title="Vollständiges Sitzungsprotokoll als PDF herunterladen"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                            <span className="truncate">{generatingPdfId === m.id ? 'Erzeuge...' : 'Protokoll'}</span>
                          </button>
                        </div>

                        {/* 2. Zeile: Register-Auszug (nur wenn relevant) & Bearbeiten */}
                        <div className="grid grid-cols-2 gap-2 w-full">
                          {needsRegisterExtract ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleInitiateDownloadPdf(m, true)}
                                disabled={generatingPdfId === m.id}
                                className="h-8.5 px-2.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
                                title="Auszug für Notar / Amtsgericht (Vereinsregister)"
                              >
                                <Scale className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span className="truncate">{generatingPdfId === m.id ? 'Erzeuge...' : 'Register-Auszug'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditMeeting(m)}
                                className="h-8.5 px-3 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-w-0"
                                title="Sitzung und Protokolldaten bearbeiten"
                              >
                                <Edit className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                <span className="truncate">Bearbeiten</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEditMeeting(m)}
                              className="col-span-2 h-8.5 px-3 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-w-0"
                              title="Sitzung und Protokolldaten bearbeiten"
                            >
                              <Edit className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span className="truncate">Bearbeiten</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* TOPs & Resolutions Preview */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Tagesordnung ({m.agenda.length} Punkte)</span>
                        <span className="text-slate-500 font-normal">
                          {totalResolutionsInMeeting} {totalResolutionsInMeeting === 1 ? 'Beschluss' : 'Beschlüsse'} gefasst
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {m.agenda.map((top) => {
                          const resCount = top.resolutions?.length || 0;
                          return (
                            <div
                              key={top.id}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 text-slate-700"
                            >
                              <span className="font-bold text-slate-900">{top.number}</span>
                              <span className="truncate max-w-[220px]">{top.title}</span>
                              {resCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  {resCount} Beschl.
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BESCHLUSSBUCH / REGISTER */}
      {activeTab === 'resolutions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Beschlüsse & Anträge filtern..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setResolutionFilter('all')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    resolutionFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Alle ({allResolutions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionFilter('tax')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    resolutionFilter === 'tax' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Finanzamt ({stats.taxResolutions})
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionFilter('register')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    resolutionFilter === 'register' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vereinsregister ({stats.registerResolutions})
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {filteredResolutions.length} gefasste Beschlüsse im Archiv
            </div>
          </div>

          {/* Resolutions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Datum & Sitzung</th>
                    <th className="px-4 py-3">TOP</th>
                    <th className="px-4 py-3">Beschlusstitel & Antragswortlaut</th>
                    <th className="px-4 py-3 text-center">Stimmen (J/N/E)</th>
                    <th className="px-4 py-3 text-center">Ergebnis</th>
                    <th className="px-4 py-3">Relevanz</th>
                    <th className="px-4 py-3">Verantwortlich</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredResolutions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {new Date(item.meeting.date).toLocaleDateString('de-DE')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.meeting.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {item.agendaNumber}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-bold text-slate-900">{item.resolution.title}</div>
                        <div className="text-slate-600 italic text-[11px] line-clamp-2 mt-0.5">
                          "{item.resolution.motionText}"
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className="text-emerald-700 font-bold">{item.resolution.votesFor}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-rose-700 font-bold">{item.resolution.votesAgainst}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500">{item.resolution.votesAbstain}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.resolution.result === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.resolution.result === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.resolution.result === 'accepted'
                            ? 'Angenommen'
                            : item.resolution.result === 'rejected'
                            ? 'Abgelehnt'
                            : 'Vertagt'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {item.resolution.isTaxRelevant && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Finanzamt / EÜR
                            </span>
                          )}
                          {item.resolution.isRegisterRelevant && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              Vereinsregister § 26
                            </span>
                          )}
                          {!item.resolution.isTaxRelevant && !item.resolution.isRegisterRelevant && (
                            <span className="text-[11px] text-slate-400">Intern</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {item.resolution.responsiblePerson || '–'}
                        {item.resolution.dueDate && (
                          <div className="text-slate-400 text-[10px]">
                            Frist: {item.resolution.dueDate}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VORLAGEN & BRIEFPAPIER */}
      {activeTab === 'template' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Briefpapier- & Layoutkonfiguration für Vereinsprotokolle
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Laden Sie Ihr offizielles Vereins-Briefpapier hoch oder passen Sie Ränder und Kopfzeilen an.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              <span>Briefpapier konfigurieren</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <span className="text-xs font-bold text-slate-800">Aktueller Status der Vorlage:</span>
                <div className="flex items-center gap-3">
                  {templateSettings.customBlankoDataUrl ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                      <Check className="w-4 h-4" />
                      Eigenes Briefpapier aktiv ({templateSettings.customBlankoFileName || 'Briefpapier.png'})
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1.5 rounded-lg">
                      <Building className="w-4 h-4 text-slate-600" />
                      Standard-Vereinsbriefkopf aktiv (Kein Briefpapier hochgeladen)
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Druckränder & Layout-Parameter
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Oberer Rand (Header)</span>
                    <span className="font-bold text-slate-900">{templateSettings.marginTop} mm</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Unterer Rand (Footer)</span>
                    <span className="font-bold text-slate-900">{templateSettings.marginBottom} mm</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Linker Rand</span>
                    <span className="font-bold text-slate-900">{templateSettings.marginLeft} mm</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">Rechter Rand</span>
                    <span className="font-bold text-slate-900">{templateSettings.marginRight} mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Mini Preview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-44 h-60 bg-white border border-slate-300 rounded-lg shadow-md p-3 relative overflow-hidden flex flex-col justify-between">
                {templateSettings.customBlankoDataUrl ? (
                  <img
                    src={templateSettings.customBlankoDataUrl}
                    alt="Briefpapier Vorschau"
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="border-b border-slate-200 pb-1 text-left">
                    <div className="w-12 h-1.5 bg-slate-300 rounded mb-1"></div>
                    <div className="w-24 h-1 bg-slate-200 rounded"></div>
                  </div>
                )}
                <div className="relative z-10 text-left space-y-1.5">
                  <div className="w-20 h-2 bg-rose-200 rounded"></div>
                  <div className="w-32 h-1 bg-slate-300 rounded"></div>
                  <div className="w-28 h-1 bg-slate-300 rounded"></div>
                  <div className="w-36 h-1 bg-slate-200 rounded"></div>
                </div>
                <div className="relative z-10 border-t border-slate-200 pt-1 flex justify-between">
                  <div className="w-8 h-1 bg-slate-300 rounded"></div>
                  <div className="w-8 h-1 bg-slate-300 rounded"></div>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 mt-3">
                DIN A4 Vorschau ({templateSettings.customBlankoDataUrl ? 'Mit eigenem Briefpapier' : 'Standard-Layout'})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <MeetingFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        meetingToEdit={meetingToEdit}
        members={members}
        clubSettings={clubSettings}
        templateSettings={templateSettings}
        onSave={onSaveMeeting}
      />

      <MeetingTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templateSettings={templateSettings}
        clubSettings={clubSettings}
        onSaveTemplate={onSaveTemplate}
      />

      {/* Overview AI Short-cuts */}
      <MeetingNotesUploadModal
        isOpen={isOverviewNotesModalOpen}
        onClose={() => setIsOverviewNotesModalOpen(false)}
        meetingContext={{
          type: 'board',
          chairperson: clubSettings.firstChairman || '1. Vorsitzender',
        }}
        onApplyData={handleApplyExtractedFromOverview}
      />

      <MeetingAudioRecorderModal
        isOpen={isOverviewAudioModalOpen}
        onClose={() => setIsOverviewAudioModalOpen(false)}
        meetingContext={{
          type: 'board',
          chairperson: clubSettings.firstChairman || '1. Vorsitzender',
        }}
        onApplyData={handleApplyExtractedFromOverview}
      />

      {/* PDF Download Choice Modal (if meeting has digital signatures) */}
      {downloadChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    PDF-Download Optionen
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">
                    {downloadChoice.isExtract ? 'Registerauszug' : 'Protokoll'}: {downloadChoice.meeting.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDownloadChoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Für diese Sitzung liegen <strong>{downloadChoice.meeting.signatures?.length || 0} digitale Unterschriften</strong> vor. Wie möchten Sie das Dokument exportieren?
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleExecuteDownloadPdf(downloadChoice.meeting, downloadChoice.isExtract, true)}
                className="w-full p-3 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl text-left transition-colors flex items-center justify-between gap-3 cursor-pointer shadow-2xs group"
              >
                <div>
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5 group-hover:text-rose-950">
                    <PenTool className="w-3.5 h-3.5 text-rose-600" />
                    Mit digitaler Unterschrift (PDF)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Fügt die Unterschrift(en) und den amtlichen Zeitstempel direkt in das Dokument ein.
                  </p>
                </div>
                <Download className="w-4 h-4 text-rose-600 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleExecuteDownloadPdf(downloadChoice.meeting, downloadChoice.isExtract, false)}
                className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-colors flex items-center justify-between gap-3 cursor-pointer shadow-2xs group"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-slate-900">
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    Ohne Unterschrift (Blanko-Signaturzeile)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Erzeugt freie Linien zum klassischen Ausdrucken und handschriftlichen Unterzeichnen.
                  </p>
                </div>
                <Download className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDownloadChoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {signatureModalMeeting && (
        <MeetingSignatureModal
          isOpen={Boolean(signatureModalMeeting)}
          onClose={() => setSignatureModalMeeting(null)}
          meeting={signatureModalMeeting}
          clubSettings={clubSettings}
          templateSettings={templateSettings}
          onSaveMeeting={async (updatedMeeting) => {
            await onSaveMeeting(updatedMeeting);
            setSignatureModalMeeting(updatedMeeting);
          }}
        />
      )}

      {/* Email Dispatch Modal */}
      {emailModalConfig && (
        <MeetingEmailModal
          isOpen={emailModalConfig.isOpen}
          onClose={() => setEmailModalConfig(null)}
          meeting={emailModalConfig.meeting}
          mode={emailModalConfig.mode}
          members={members}
          clubSettings={clubSettings}
          templateSettings={templateSettings}
        />
      )}
    </div>
  );
};
