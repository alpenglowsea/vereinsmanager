import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  ExternalLink,
  Download,
  Users,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Loader2,
  Check,
  Filter
} from 'lucide-react';
import { Meeting, Member, ClubSettings, MeetingTemplateSettings } from '../types';
import { MeetingPdfService } from '../services/meetingPdfService';

interface MeetingEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting;
  mode: 'invitation' | 'protocol';
  members: Member[];
  clubSettings?: ClubSettings;
  templateSettings?: MeetingTemplateSettings;
}

interface RecipientOption {
  id: string;
  name: string;
  email: string;
  role: string;
  source: 'attendee' | 'member';
  selected: boolean;
}

export const MeetingEmailModal: React.FC<MeetingEmailModalProps> = ({
  isOpen,
  onClose,
  meeting,
  mode,
  members,
  clubSettings,
  templateSettings
}) => {
  const isInvitation = mode === 'invitation';

  // Build default recipient list
  const initialRecipients = useMemo<RecipientOption[]>(() => {
    const list: RecipientOption[] = [];
    const seenEmails = new Set<string>();

    // 1. From Meeting Attendees
    meeting.attendees.forEach(a => {
      // Find matching member by name or id if attendee has no email
      let email = a.email;
      if (!email && a.memberId) {
        const found = members.find(m => m.id === a.memberId);
        email = found?.email;
      }
      if (!email) {
        const foundByName = members.find(m => `${m.firstName} ${m.lastName}`.toLowerCase() === a.name.toLowerCase());
        email = foundByName?.email;
      }

      const cleanEmail = email?.trim().toLowerCase();
      if (cleanEmail && !seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        list.push({
          id: a.id,
          name: a.name,
          email: cleanEmail,
          role: a.role || 'Teilnehmer',
          source: 'attendee',
          selected: true
        });
      }
    });

    // 2. If it's a general assembly, suggest all active members with email
    if (meeting.type === 'general_assembly' || meeting.type === 'extraordinary_assembly') {
      members.forEach(m => {
        const cleanEmail = m.email?.trim().toLowerCase();
        if (cleanEmail && !seenEmails.has(cleanEmail) && m.status === 'active') {
          seenEmails.add(cleanEmail);
          list.push({
            id: m.id,
            name: `${m.firstName} ${m.lastName}`,
            email: cleanEmail,
            role: m.membershipType || 'Mitglied',
            source: 'member',
            selected: true
          });
        }
      });
    }

    return list;
  }, [meeting, members]);

  const [recipients, setRecipients] = useState<RecipientOption[]>(initialRecipients);
  const [searchFilter, setSearchFilter] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  // Generate initial subject & body template
  useEffect(() => {
    if (!isOpen) return;

    setRecipients(initialRecipients);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    const formattedDate = new Date(meeting.date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const clubName = clubSettings?.clubName || 'Unser Verein';

    if (isInvitation) {
      setSubject(`Einladung: ${meeting.title} am ${formattedDate}`);
      const agendaPreview = meeting.agenda.map(top => `- ${top.number}: ${top.title}`).join('\n');

      setBodyText(
`Liebe Vereinsmitglieder, liebe Vorstandskollegen,

hiermit laden wir Sie/Euch herzlich zur kommenden Sitzung ein:

Sitzung: ${meeting.title}
Datum: ${formattedDate}
Uhrzeit: ${meeting.startTime || '19:00'} Uhr${meeting.endTime ? ` bis ca. ${meeting.endTime} Uhr` : ''}
Ort: ${meeting.location || 'Vereinsheim'}

VORLÄUFIGE TAGESORDNUNG:
${agendaPreview || '- Tagesordnungspunkte werden vor Ort bekanntgegeben.'}

Die vollständige, form- und fristgerechte Einladung mit allen Details finden Sie als PDF im Anhang dieses Schreibens.

Mit sportlichen Grüßen
${meeting.chairperson || clubSettings?.firstChairman || 'Der Vorstand'}
${clubName}`
      );
    } else {
      setSubject(`Protokoll: ${meeting.title} vom ${formattedDate}`);
      setBodyText(
`Liebe Vereinsmitglieder, liebe Teilnehmer,

anbei erhalten Sie das genehmigte Protokoll zur Sitzung:

Sitzung: ${meeting.title}
Datum: ${formattedDate}
Versammlungsleitung: ${meeting.chairperson || '1. Vorsitzender'}
Protokollführung: ${meeting.minuteKeeper || 'Schriftführer'}

Das vollständige Ergebnisprotokoll mit allen gefassten Beschlüssen und Beratungsverläufen ist als PDF beigefügt.

Bei Rückfragen steht der Vorstand jederzeit gern zur Verfügung.

Mit freundlichen Grüßen
${meeting.chairperson || clubSettings?.firstChairman || 'Der Vorstand'}
${clubName}`
      );
    }
  }, [isOpen, isInvitation, meeting, clubSettings, initialRecipients]);

  // Pre-generate PDF for attachment
  useEffect(() => {
    if (!isOpen || !clubSettings) return;

    let isMounted = true;
    setIsGeneratingPdf(true);

    const generateAttachment = async () => {
      try {
        let doc;
        if (isInvitation) {
          doc = await MeetingPdfService.generateInvitationPdf(meeting, clubSettings, templateSettings);
        } else {
          doc = await MeetingPdfService.generateProtocolPdf(meeting, clubSettings, templateSettings, {
            includeDigitalSignatures: Boolean(meeting.signatures && meeting.signatures.length > 0)
          });
        }
        if (isMounted) {
          const dataUrl = doc.output('datauristring');
          setPdfBase64(dataUrl);
        }
      } catch (err) {
        console.error('Failed to pre-generate PDF attachment:', err);
      } finally {
        if (isMounted) {
          setIsGeneratingPdf(false);
        }
      }
    };

    generateAttachment();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isInvitation, meeting, clubSettings, templateSettings]);

  // Toggle recipient selection
  const handleToggleRecipient = (id: string) => {
    setRecipients(prev =>
      prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setRecipients(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const handleSelectOnlyAttendees = () => {
    setRecipients(prev =>
      prev.map(r => ({ ...r, selected: r.source === 'attendee' }))
    );
  };

  const selectedRecipients = useMemo(() => {
    return recipients.filter(r => r.selected);
  }, [recipients]);

  const filteredRecipients = useMemo(() => {
    if (!searchFilter.trim()) return recipients;
    const q = searchFilter.toLowerCase();
    return recipients.filter(
      r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
    );
  }, [recipients, searchFilter]);

  // Download PDF directly
  const handleDownloadPdf = async () => {
    if (!clubSettings) return;
    try {
      let doc;
      if (isInvitation) {
        doc = await MeetingPdfService.generateInvitationPdf(meeting, clubSettings, templateSettings);
      } else {
        doc = await MeetingPdfService.generateProtocolPdf(meeting, clubSettings, templateSettings, {
          includeDigitalSignatures: Boolean(meeting.signatures && meeting.signatures.length > 0)
        });
      }
      const prefix = isInvitation ? 'Einladung' : 'Protokoll';
      const safeTitle = (meeting.title || 'Sitzung').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      doc.save(`${prefix}_${safeTitle}.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  // 1. In Local Mail Client (Thunderbird / Outlook / Apple Mail) via mailto
  const handleOpenLocalMailClient = () => {
    if (selectedRecipients.length === 0) {
      setSendErrorMessage('Bitte wählen Sie mindestens einen Empfänger aus.');
      return;
    }

    // Trigger PDF download first so the user can easily attach it
    handleDownloadPdf();

    // Build mailto URI with BCC for GDPR compliance
    const bccList = selectedRecipients.map(r => r.email).join(',');
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(bodyText);

    const mailtoUri = `mailto:?bcc=${bccList}&subject=${encodedSubject}&body=${encodedBody}`;

    // Open local mail client
    window.location.href = mailtoUri;

    setSendSuccessMessage(
      `E-Mail-Programm (Thunderbird/Outlook) wurde aufgerufen. Die PDF-Datei wurde heruntergeladen – bitte hängen Sie diese vor dem Absenden als Anhang an.`
    );
  };

  // 2. Direct Sending via Server / Cloud Relay
  const handleSendDirectlyFromApp = async () => {
    if (selectedRecipients.length === 0) {
      setSendErrorMessage('Bitte wählen Sie mindestens einen Empfänger aus.');
      return;
    }

    setIsSendingDirect(true);
    setSendErrorMessage(null);
    setSendSuccessMessage(null);

    try {
      const filename = `${isInvitation ? 'Einladung' : 'Protokoll'}_${meeting.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      const response = await fetch('/api/meetings/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selectedRecipients.map(r => ({ email: r.email, name: r.name })),
          subject,
          bodyText,
          senderName: clubSettings?.smtpFromName || clubSettings?.clubName || 'VereinsManager',
          senderEmail: clubSettings?.smtpFromEmail || clubSettings?.email || 'vorstand@tsv-musterstadt1890.de',
          smtpConfig: {
            host: clubSettings?.smtpHost,
            port: clubSettings?.smtpPort,
            secure: clubSettings?.smtpSecure,
            user: clubSettings?.smtpUser,
            password: clubSettings?.smtpPassword,
            fromEmail: clubSettings?.smtpFromEmail || clubSettings?.email,
            fromName: clubSettings?.smtpFromName || clubSettings?.clubName
          },
          meetingTitle: meeting.title,
          meetingDate: meeting.date,
          dispatchType: mode,
          attachment: pdfBase64
            ? {
                filename,
                contentType: 'application/pdf',
                base64Data: pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
              }
            : undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server-Versand fehlgeschlagen.');
      }

      setSendSuccessMessage(
        data.message || `E-Mail erfolgreich direkt aus der App an ${data.sentCount} Empfänger versendet (DSGVO-Blindkopie BCC).`
      );
    } catch (err: any) {
      console.error('Error during direct send:', err);
      setSendErrorMessage(err.message || 'Der direkte E-Mail-Versand ist fehlgeschlagen.');
    } finally {
      setIsSendingDirect(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${
              isInvitation ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
            }`}>
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isInvitation ? 'Sitzungseinladung per E-Mail versenden' : 'Genehmigtes Protokoll per E-Mail versenden'}
              </h3>
              <p className="text-xs text-slate-500">
                {meeting.title} • DSGVO-konformer Versand (BCC)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance / Privacy Card */}
        <div className="px-6 py-2.5 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-800">
              <strong>DSGVO-Datenschutz:</strong> Alle Empfänger werden automatisch als Blindkopie (BCC) adressiert, um private E-Mail-Adressen zu schützen.
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
            {selectedRecipients.length} Empfänger aktiv
          </span>
        </div>

        {/* SMTP Status Sub-bar */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Ausgangsserver:{' '}
              {clubSettings?.smtpHost ? (
                <span className="font-semibold text-slate-800">
                  {clubSettings.smtpHost}:{clubSettings.smtpPort || (clubSettings.smtpSecure ? 465 : 587)} ({clubSettings.smtpUser || clubSettings.smtpFromEmail || clubSettings.email})
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  Standard-Relay (Eigener SMTP-Server in Vereinsstammdaten konfigurierbar)
                </span>
              )}
            </span>
          </div>
          {clubSettings?.smtpHost && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
              SMTP aktiv
            </span>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Status Feedback */}
          {sendSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Versand verarbeitet:</span>
                <span>{sendSuccessMessage}</span>
              </div>
            </div>
          )}

          {sendErrorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Fehler:</span>
                <span>{sendErrorMessage}</span>
              </div>
            </div>
          )}

          {/* Recipient Selection Section */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Empfängerkreis auswählen ({selectedRecipients.length} von {recipients.length})</span>
              </label>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Keine
                </button>
                <button
                  type="button"
                  onClick={handleSelectOnlyAttendees}
                  className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  Nur Sitzungsteilnehmer
                </button>
              </div>
            </div>

            {/* Recipient List Box */}
            <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-2 max-h-40 overflow-y-auto space-y-1">
              {filteredRecipients.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Keine Empfänger mit hinterlegter E-Mail-Adresse gefunden.
                </div>
              ) : (
                filteredRecipients.map(r => (
                  <label
                    key={r.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      r.selected ? 'bg-white shadow-2xs border border-slate-200' : 'hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() => handleToggleRecipient(r.id)}
                        className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800 truncate">{r.name}</span>
                      <span className="text-slate-400 text-[11px] truncate">&lt;{r.email}&gt;</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 shrink-0 ml-2">
                      {r.role}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Email Subject Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              E-Mail Betreff
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
            />
          </div>

          {/* Email Body Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Nachrichtentext
            </label>
            <textarea
              rows={6}
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white font-sans"
            />
          </div>

          {/* Attachment Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {isInvitation ? `Einladung_${meeting.title.slice(0, 30)}.pdf` : `Protokoll_${meeting.title.slice(0, 30)}.pdf`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isGeneratingPdf ? 'PDF wird vorbereitet...' : 'Offizielles DIN A4 Dokument liegt bei'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Herunterladen</span>
            </button>
          </div>
        </div>

        {/* Modal Footer with Dual Dispatch Options */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer order-3 sm:order-1"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2 flex-wrap">
            {/* Local Client Option */}
            <button
              type="button"
              onClick={handleOpenLocalMailClient}
              disabled={selectedRecipients.length === 0}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Öffnet Thunderbird oder Outlook mit vorbereitetem Text und BCC-Empfängern"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Im Mail-Client öffnen (Thunderbird/Outlook)</span>
            </button>

            {/* Direct Send from App Option */}
            <button
              type="button"
              onClick={handleSendDirectlyFromApp}
              disabled={selectedRecipients.length === 0 || isSendingDirect}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Versendet die E-Mail mit PDF-Anhang direkt über den integrierten Vereins-Mailserver"
            >
              {isSendingDirect ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Wird versendet...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Direkt aus der App versenden</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
