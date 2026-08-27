import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Eye,
  ShieldCheck,
  Building2,
  Users,
  PenTool,
  Phone,
  Mail,
  AlertTriangle,
  FolderArchive,
  ArrowRight
} from 'lucide-react';
import {
  OnlineMembershipApplication,
  Member,
  ClubSettings,
  Gender,
  MembershipType,
  PaymentMethod,
  FeePeriod
} from '../types';
import {
  generateMembershipApplicationPdf,
  calculateAge,
  getMembershipTypeLabel,
  getGenderLabel,
  getPaymentMethodLabel,
  getFeePeriodLabel
} from '../services/membershipPdfService';

interface ApplicationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: OnlineMembershipApplication;
  existingMembers: Member[];
  settings: ClubSettings;
  onApprove: (
    appId: string,
    memberData: Partial<Member>,
    author: string
  ) => Promise<{ member: Member; documentId: string }>;
  onReject: (appId: string, reason: string, author: string) => Promise<void>;
  currentUser?: string;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  isOpen,
  onClose,
  application,
  existingMembers = [],
  settings,
  onApprove,
  onReject,
  currentUser = 'Vorstand / Administrator'
}) => {
  if (!isOpen || !application) return null;

  const safeMembers = existingMembers || [];
  const safeDepartments = settings?.departments?.length ? settings.departments : ['Hauptverein', 'Fußball', 'Tennis', 'Turnen'];

  // Next suggested member number
  const suggestedMemberNumber = useMemo(() => {
    const numbers = safeMembers
      .map(m => {
        const numStr = m.memberNumber || '';
        const match = numStr.match(/MG-(\d+)/i) || numStr.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n) && n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `MG-${(maxNum + 1).toString().padStart(3, '0')}`;
  }, [safeMembers]);

  // Editable fields before accepting
  const [memberNumber, setMemberNumber] = useState(suggestedMemberNumber);
  const [department, setDepartment] = useState(application.department || safeDepartments[0] || 'Hauptverein');
  const [membershipType, setMembershipType] = useState<MembershipType>(application.membershipType || 'full');
  const [feeAmount, setFeeAmount] = useState<number>(application.feeAmount !== undefined ? application.feeAmount : 15.0);
  const [feePeriod, setFeePeriod] = useState<FeePeriod>(application.feePeriod || 'monthly');
  const [entryDate, setEntryDate] = useState(application.entryDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(application.notes || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Plausibility & Duplicate check
  const age = useMemo(() => calculateAge(application.birthDate), [application.birthDate]);

  const duplicates = useMemo(() => {
    const fn = (application.firstName || '').toLowerCase().trim();
    const ln = (application.lastName || '').toLowerCase().trim();
    const em = (application.email || '').toLowerCase().trim();

    return safeMembers.filter(m => {
      const matchName = fn && ln && (m.firstName || '').toLowerCase().trim() === fn && (m.lastName || '').toLowerCase().trim() === ln;
      const matchEmail = em && (m.email || '').toLowerCase().trim() === em;
      return Boolean(matchName || matchEmail);
    });
  }, [safeMembers, application]);

  // Handlers
  const handleApprove = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const memberData: Partial<Member> = {
        memberNumber: memberNumber.trim(),
        department,
        membershipType,
        feeAmount: Number(feeAmount),
        feePeriod,
        entryDate,
        notes: notes.trim()
      };
      await onApprove(application.id, memberData, currentUser);
      onClose();
    } catch (err: any) {
      console.error('Fehler beim Bestätigen:', err);
      setErrorMsg(err.message || 'Fehler beim Anlegen des Mitglieds.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg('Bitte geben Sie einen Grund für die Ablehnung an.');
      return;
    }
    setIsProcessing(true);
    try {
      await onReject(application.id, rejectReason.trim(), currentUser);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Ablehnen des Antrags.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviewPdf = () => {
    try {
      if (application.pdfDataUrl) {
        const win = window.open();
        if (win) {
          win.document.write(
            `<iframe src="${application.pdfDataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
          );
          return;
        }
      }
      const doc = generateMembershipApplicationPdf(application, settings);
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error('PDF Preview failed:', e);
    }
  };

  const handleDownloadPdf = () => {
    if (application.pdfDataUrl) {
      const link = document.createElement('a');
      link.href = application.pdfDataUrl;
      link.download = `Aufnahmeantrag_${application.lastName || 'Antrag'}_${application.firstName || ''}_${application.applicationNumber || ''}.pdf`;
      link.click();
      return;
    }
    const doc = generateMembershipApplicationPdf(application, settings);
    doc.save(`Aufnahmeantrag_${application.lastName || 'Antrag'}_${application.firstName || ''}_${application.applicationNumber || ''}.pdf`);
  };

  const addr = application.address || {
    street: '',
    houseNumber: '',
    zip: '',
    city: '',
    country: 'Deutschland'
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/20 font-bold">
                  {application.applicationNumber}
                </span>
                {application.status === 'pending' && (
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Offen zur Prüfung
                  </span>
                )}
                {application.status === 'approved' && (
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    Bereits als Mitglied aufgenommen ({application.createdMemberNumber})
                  </span>
                )}
                {application.status === 'rejected' && (
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/30">
                    Abgelehnt
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Aufnahmeantrag: {application.firstName} {application.lastName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreviewPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>PDF ansehen</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Plausibility / Warnings Bar */}
          {duplicates.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Möglicher Doppelantrag oder Bestandsmitglied:</strong>
                <span>
                  Es existiert bereits ein Mitglied mit ähnlichem Namen oder identischer E-Mail:{' '}
                  <strong>
                    {duplicates.map(d => `${d.firstName} ${d.lastName} (${d.memberNumber})`).join(', ')}
                  </strong>
                  . Bitte vor der Aufnahme prüfen.
                </span>
              </div>
            </div>
          )}

          {/* 1. Persönliche Daten & Anschrift */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Person Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Antragsteller / Person</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-500 block text-2xs">Name, Vorname</span>
                  <strong className="text-slate-900 text-sm">
                    {application.lastName}, {application.firstName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-2xs">Geburtsdatum & Alter</span>
                  <span className="text-slate-900 font-medium">
                    {application.birthDate} ({age !== null ? `${age} Jahre` : '–'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-2xs">Geschlecht & Nationalität</span>
                  <span className="text-slate-800">
                    {getGenderLabel(application.gender)} • {application.nationality || 'Deutsch'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-2xs">Eingang / Eingereicht</span>
                  <span className="text-slate-800">
                    {new Date(application.submittedAt).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${application.email}`} className="text-blue-600 hover:underline">
                    {application.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{application.phone || 'Keine Telefonnummer angegeben'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {addr.street} {addr.houseNumber}
                    {addr.zip || addr.city ? `, ${addr.zip} ${addr.city}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Guardian or Special Details */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Rechtliche Vertretung & Zustimmungen</span>
              </h4>

              {application.isMinor ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-2xs text-amber-900">
                  <strong className="block text-amber-950">Minderjähriger Antragsteller:</strong>
                  <div>Gesetzl. Vertreter: <strong>{application.guardianName}</strong> ({application.guardianRelation || 'Erziehungsberechtigte/r'})</div>
                  <div>Kontakt: {application.guardianPhone || application.guardianEmail || '–'}</div>
                </div>
              ) : (
                <div className="text-slate-600 text-2xs">
                  Volljähriges Mitglied (Eigenverantwortliche Erklärung)
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 space-y-1.5 text-2xs text-slate-600">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>DSGVO-Datenschutzhinweis bestätigt</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Satzung & Beitragsordnung anerkannt</span>
                </div>
                {application.photoConsent && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Einwilligung Foto-/Medienveröffentlichung erteilt</span>
                  </div>
                )}
                {application.healthConfirmation && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Sportgesundheit bestätigt</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Zahlungsweise & SEPA */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span>Zahlungsweise & Bankverbindung</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-2xs">Zahlungsart</span>
                <strong className="text-slate-900">
                  {getPaymentMethodLabel(application.paymentMethod)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-2xs">Zahlungsintervall</span>
                <span className="text-slate-900 font-medium">
                  {getFeePeriodLabel(application.feePeriod)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-2xs">Kontoinhaber</span>
                <span className="text-slate-900 font-medium">
                  {application.bankDetails?.accountHolder || '–'}
                </span>
              </div>
            </div>

            {application.paymentMethod === 'sepa' && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block text-2xs">IBAN</span>
                  <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                    {application.bankDetails?.iban || '–'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-2xs">BIC & Institut</span>
                  <span className="font-mono text-xs text-slate-800">
                    {application.bankDetails?.bic || '–'} {application.bankDetails?.bankName ? `(${application.bankDetails.bankName})` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Digitale Signaturen Vorschau */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-blue-600" />
              <span>Digitale Unterschriften</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Unterschrift Antragsteller */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
                  <span>Unterschrift Antragsteller</span>
                  <span className="text-emerald-600 font-semibold">Digital erfasst</span>
                </div>
                <div className="h-20 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {application.applicantSignature ? (
                    <img
                      src={application.applicantSignature}
                      alt="Unterschrift Antragsteller"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-2xs text-slate-400 italic">Keine Signatur vorhanden</span>
                  )}
                </div>
                <div className="text-2xs text-slate-400 mt-1 flex justify-between">
                  <span>{application.firstName || ''} {application.lastName || ''}</span>
                  <span>{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString('de-DE') : '–'}</span>
                </div>
              </div>

              {/* Unterschrift Gesetzlicher Vertreter oder SEPA */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
                  <span>
                    {application.isMinor
                      ? 'Unterschrift gesetzl. Vertreter'
                      : 'Unterschrift Kontoinhaber (SEPA)'}
                  </span>
                  <span className="text-emerald-600 font-semibold">Digital erfasst</span>
                </div>
                <div className="h-20 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {application.isMinor ? (
                    application.guardianSignature ? (
                      <img
                        src={application.guardianSignature}
                        alt="Unterschrift gesetzlicher Vertreter"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-2xs text-amber-600 italic">Unterschrift Vertreter fehlt!</span>
                    )
                  ) : application.sepaSignature || application.applicantSignature ? (
                    <img
                      src={application.sepaSignature || application.applicantSignature}
                      alt="Unterschrift Kontoinhaber"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-2xs text-slate-400 italic">Keine Signatur</span>
                  )}
                </div>
                <div className="text-2xs text-slate-400 mt-1 flex justify-between">
                  <span>{application.isMinor ? (application.guardianName || 'Vertreter') : (application.bankDetails?.accountHolder || `${application.firstName || ''} ${application.lastName || ''}`)}</span>
                  <span>{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString('de-DE') : '–'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Anpassungsfelder vor Aufnahme (Mitgliedsnummer, Sparte, Beitrag) */}
          {application.status === 'pending' && !rejectMode && (
            <div className="p-5 bg-blue-50/60 border-2 border-blue-200 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700 shrink-0" />
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Mitgliedsdaten bei Aufnahme festlegen
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Mitgliedsnummer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={memberNumber}
                    onChange={e => setMemberNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Abteilung / Sparte <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {safeDepartments.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Mitgliedsart
                  </label>
                  <select
                    value={membershipType}
                    onChange={e => setMembershipType(e.target.value as MembershipType)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="full">Vollmitglied</option>
                    <option value="reduced">Ermäßigt</option>
                    <option value="youth">Jugend</option>
                    <option value="family">Familie</option>
                    <option value="supporting">Fördermitglied</option>
                    <option value="honorary">Ehrenmitglied</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Beitragshöhe (EUR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={feeAmount}
                    onChange={e => setFeeAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Zahlungsweise
                  </label>
                  <select
                    value={feePeriod}
                    onChange={e => setFeePeriod(e.target.value as FeePeriod)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Vierteljährlich</option>
                    <option value="half_yearly">Halbjährlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Eintrittsdatum
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Interne Notiz für Mitgliedsakte
                </label>
                <input
                  type="text"
                  placeholder="z.B. Spielerpass beantragt, Online-Aufnahmeantrag geprüft..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Ablehnungs-Formular falls aktiv */}
          {rejectMode && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Aufnahmeantrag ablehnen</span>
              </h4>
              <p className="text-2xs text-rose-800">
                Geben Sie einen Grund für die Ablehnung an. Der Antrag wird als &quot;Abgelehnt&quot; archiviert.
              </p>
              <textarea
                required
                rows={3}
                placeholder="Begründung (z.B. Aufnahmestopp in Sparte Fußball Jugend, unvollständige Unterlagen...)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-2.5 text-xs border border-rose-300 rounded-lg bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectMode(false)}
                  className="px-3 py-1.5 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleReject}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  {isProcessing ? 'Wird abgelehnt...' : 'Verbindlich ablehnen'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {application.status === 'pending' && !rejectMode && (
              <button
                type="button"
                onClick={() => setRejectMode(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Antrag ablehnen</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              Schließen
            </button>

            {application.status === 'pending' && !rejectMode && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleApprove}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isProcessing ? 'Wird aufgenommen...' : 'Bestätigen & als Mitglied aufnehmen'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
