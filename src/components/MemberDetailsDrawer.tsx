import React, { useState, useEffect, useRef } from 'react';
import { Member, MemberAuditLog, ClubSettings } from '../types';
import { ExportService } from '../services/exportService';
import { StorageService } from '../services/storage';
import {
  X,
  Edit2,
  Trash2,
  FileDown,
  History,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Building2,
  Calendar,
  ShieldCheck,
  Tag,
  Clock,
  ArrowRight,
  Camera,
  User,
  Copy,
  Check,
  Upload,
  AlertCircle
} from 'lucide-react';

interface MemberDetailsDrawerProps {
  member: Member | null;
  auditLogs?: MemberAuditLog[];
  settings: ClubSettings;
  onEdit: (member: Member) => void;
  onDelete?: (id: string) => void;
  onSaveMember?: (member: Member) => void;
  onClose: () => void;
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
  member,
  auditLogs = [],
  settings,
  onEdit,
  onDelete,
  onSaveMember,
  onClose
}) => {
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [copiedIban, setCopiedIban] = useState(false);
  const [logs, setLogs] = useState<MemberAuditLog[]>(auditLogs || []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load audit logs if not passed in
  useEffect(() => {
    if (!member) return;
    if (auditLogs && auditLogs.length > 0) {
      setLogs(auditLogs.filter(l => l.memberId === member.id));
    } else {
      StorageService.getAuditLogs().then(allLogs => {
        setLogs(allLogs.filter(l => l.memberId === member.id));
      }).catch(() => {
        setLogs([]);
      });
    }
  }, [member, auditLogs]);

  if (!member) return null;

  // Calculate age if birthDate present
  const calculateAge = (dateStr?: string) => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate membership duration
  const calculateDuration = (entryStr: string) => {
    const entry = new Date(entryStr);
    if (isNaN(entry.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - entry.getFullYear();
    const m = today.getMonth() - entry.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < entry.getDate())) {
      years--;
    }
    if (years < 1) return 'Neu im Verein (< 1 Jahr)';
    return `${years} Jahr${years > 1 ? 'e' : ''} im Verein`;
  };

  const age = calculateAge(member.birthDate);
  const duration = calculateDuration(member.entryDate);

  const getStatusBadge = (status: Member['status']) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">🟢 Aktiv</span>;
      case 'passive':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">⚪ Passiv</span>;
      case 'honorary':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">⭐ Ehrenmitglied</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">🟡 Ruhend</span>;
      case 'terminated':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">🔴 Gekündigt</span>;
    }
  };

  const getMembershipTypeLabel = (type: Member['membershipType']) => {
    switch (type) {
      case 'full': return 'Vollmitglied';
      case 'youth': return 'Jugend / Kind';
      case 'reduced': return 'Ermäßigt';
      case 'family': return 'Familienbeitrag';
      case 'supporting': return 'Fördermitglied / Sponsor';
      case 'honorary': return 'Ehrenmitglied';
    }
  };

  const handleExportStammblatt = () => {
    ExportService.exportMemberStammblattPDF(member, settings);
  };

  const handleCopyIban = () => {
    if (member.bankDetails?.iban) {
      navigator.clipboard.writeText(member.bankDetails.iban);
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  // Avatar file upload handler with downscaling
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const updatedMember: Member = {
            ...member,
            avatarUrl: dataUrl,
            updatedAt: new Date().toISOString()
          };
          if (onSaveMember) {
            onSaveMember(updatedMember);
          } else {
            StorageService.saveMember(updatedMember, 'Profilbild aktualisiert');
          }
        }
        setIsUploadingPhoto(false);
      };
      img.onerror = () => setIsUploadingPhoto(false);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setIsUploadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Profilbild entfernen?')) {
      const updatedMember: Member = {
        ...member,
        avatarUrl: undefined,
        updatedAt: new Date().toISOString()
      };
      if (onSaveMember) {
        onSaveMember(updatedMember);
      } else {
        StorageService.saveMember(updatedMember, 'Profilbild entfernt');
      }
    }
  };

  // Initials for avatar placeholder
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200">
        
        {/* Top Header with Avatar & Key Identity Info */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            {/* Avatar & Member Main Name */}
            <div className="flex items-center gap-4">
              {/* Profile Image / Avatar with upload action */}
              <div className="relative group shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-slate-200 bg-white shadow-xs overflow-hidden flex items-center justify-center cursor-pointer relative transition-all group-hover:border-blue-500"
                  title="Klicken zum Ändern des Profilbildes"
                >
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-600 font-bold">
                      <span className="text-xl tracking-wider">{initials}</span>
                      <span className="text-[9px] text-slate-400 font-medium mt-0.5 flex items-center gap-0.5">
                        <Camera className="w-2.5 h-2.5" /> Foto
                      </span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl text-[10px] font-semibold text-center p-1">
                    <Camera className="w-4 h-4 mb-0.5" />
                    <span>{member.avatarUrl ? 'Ändern' : 'Hochladen'}</span>
                  </div>
                </div>

                {/* Hidden File Input for Avatar */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Remove photo button if exists */}
                {member.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 bg-white text-slate-400 hover:text-rose-600 border border-slate-200 rounded-full p-1 shadow-xs transition-colors"
                    title="Foto entfernen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Identity details */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                    {member.memberNumber}
                  </span>
                  {getStatusBadge(member.status)}
                  <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-md flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-600" />
                    {member.department}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900">
                  {member.firstName} {member.lastName}
                </h2>

                <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                  <span>{getMembershipTypeLabel(member.membershipType)}</span>
                  {duration && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{duration}</span>
                    </>
                  )}
                  {age !== null && (
                    <>
                      <span>•</span>
                      <span>{age} Jahre alt</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(member)}
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Mitglied bearbeiten"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Möchten Sie das Mitglied ${member.firstName} ${member.lastName} (${member.memberNumber}) wirklich unwiderruflich löschen?`)) {
                      onDelete(member.id);
                      onClose();
                    }
                  }}
                  className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Mitglied löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setTab('details')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Tag className="w-4 h-4" />
            Mitglieder-Stammdaten & Info
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            Änderungshistorie ({logs.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'details' ? (
            <div className="space-y-6">
              
              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    DSGVO-Auskunftsbogen & SEPA-Stammblatt
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Formatiertes Datenblatt für das Vereinsarchiv oder zur Mitgliederübergabe
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportStammblatt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Stammblatt (PDF)
                </button>
              </div>

              {/* 1. Persönliche Angaben & Kontaktdaten */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Persönliche Angaben & Anschrift
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Vollständiger Name</span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {member.firstName} {member.lastName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Geburtsdatum & Alter</span>
                    <span className="font-medium text-slate-800">
                      {member.birthDate ? `${new Date(member.birthDate).toLocaleDateString('de-DE')} (${age} Jahre)` : '–'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Geschlecht</span>
                    <span className="font-medium text-slate-800">
                      {member.gender === 'm' ? 'Männlich' : member.gender === 'w' ? 'Weiblich' : member.gender === 'd' ? 'Divers' : 'Keine Angabe'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Wohnanschrift</span>
                    <span className="font-medium text-slate-800 leading-relaxed block">
                      <MapPin className="w-3 h-3 text-slate-400 inline mr-1" />
                      {member.address.street} {member.address.houseNumber}<br />
                      {member.address.zip} {member.address.city}
                      {member.address.country && member.address.country !== 'Deutschland' && ` (${member.address.country})`}
                    </span>
                  </div>

                  <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-400 text-[11px] block mb-1">Erreichbarkeit & Kontakt</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        {member.phone ? (
                          <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline font-medium">
                            {member.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Keine Telefonnummer</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        {member.email ? (
                          <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline font-medium truncate">
                            {member.email}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Keine E-Mail-Adresse</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Mitgliedschaft & Vereinsdaten */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Vereinszugehörigkeit & Sparte
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Sparte / Abteilung</span>
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded inline-block">
                      {member.department}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Mitgliedschaftsform</span>
                    <span className="font-medium text-slate-800">{getMembershipTypeLabel(member.membershipType)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Eintrittsdatum</span>
                    <span className="font-medium text-slate-800">
                      {new Date(member.entryDate).toLocaleDateString('de-DE')}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block mb-0.5">Austrittsdatum</span>
                    <span className="font-medium text-slate-800">
                      {member.exitDate ? new Date(member.exitDate).toLocaleDateString('de-DE') : 'Keines (Aktiv)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Beitrags- & Zahlungsdaten */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Beitrag & Bankverbindung</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-700">
                    {member.feeAmount.toFixed(2)} € / {member.feePeriod === 'yearly' ? 'Jahr' : member.feePeriod === 'monthly' ? 'Monat' : member.feePeriod === 'half_yearly' ? 'Halbjahr' : 'Quartal'}
                  </span>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-slate-500">Zahlungsweise:</span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 block">
                        {member.paymentMethod === 'sepa' ? 'SEPA-Basislastschrift' : member.paymentMethod === 'transfer' ? 'Selbstzahler (Überweisung)' : member.paymentMethod === 'cash' ? 'Barzahlung' : 'Dauerauftrag'}
                      </span>
                      {member.feePeriod === 'monthly' && (
                        <span className="text-[11px] text-blue-700 font-semibold inline-flex items-center gap-1 mt-0.5">
                          Fälligkeit: {member.bankDetails?.monthlyDueDay === 15 ? '15. des Monats (Monatsmitte)' : '1. des Monats (Monatsanfang)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {member.paymentMethod === 'sepa' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-slate-400 text-[11px] block mb-0.5">Kontoinhaber</span>
                        <span className="font-medium text-slate-800">{member.bankDetails.accountHolder || '–'}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block mb-0.5">Kreditinstitut</span>
                        <span className="font-medium text-slate-800">{member.bankDetails.bankName || '–'}</span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-slate-400 text-[11px] block mb-0.5">IBAN</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block text-xs tracking-wider">
                            {member.bankDetails.iban || '–'}
                          </span>
                          {member.bankDetails.iban && (
                            <button
                              type="button"
                              onClick={handleCopyIban}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                              title="IBAN kopieren"
                            >
                              {copiedIban ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block mb-0.5">BIC</span>
                        <span className="font-mono font-medium text-slate-800">{member.bankDetails.bic || '–'}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block mb-0.5">Mandatsdatum</span>
                        <span className="font-medium text-slate-800">
                          {member.bankDetails.mandateDate ? new Date(member.bankDetails.mandateDate).toLocaleDateString('de-DE') : '–'}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-slate-400 text-[11px] block mb-0.5">Mandatsreferenz</span>
                        <span className="font-mono text-slate-700 font-medium">{member.bankDetails.mandateReference || '–'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-xs">
                      Kein Lastschriftmandat hinterlegt. Mitglied zahlt eigenständig per {member.paymentMethod === 'transfer' ? 'Überweisung' : member.paymentMethod === 'cash' ? 'Bargeld' : 'Dauerauftrag'}.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Notizen & Datenschutz */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block mb-1">Notizen & Bemerkungen</span>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200">
                    {member.notes || 'Keine internen Notizen hinterlegt.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    DSGVO-Datenschutzerklärung ({member.dataPrivacyConsent ? 'Einwilligung erteilt' : 'Nicht erteilt'})
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {member.id}
                  </span>
                </div>
              </div>

            </div>
          ) : (
            /* HISTORIE (AUDIT LOG TAB) */
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                Lückenlose Revisions- und Änderungshistorie nach DSGVO- und Steuerrecht-Grundsätzen (GoBD).
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Keine bisherigen Änderungsprotokolle für dieses Mitglied erfasst.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {logs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-3 pl-2">
                      <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-xs mt-1 z-10 shrink-0" />
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-800">{log.summary}</span>
                          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleString('de-DE')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Bearbeitet durch: <span className="font-semibold text-slate-700">{log.author}</span>
                        </p>

                        {log.changes && log.changes.length > 0 && (
                          <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-100">
                            {log.changes.map((ch, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700 min-w-28 text-[11px]">{ch.label}:</span>
                                <span className="line-through text-rose-500 truncate max-w-[120px] text-[11px]">{String(ch.oldValue || '–')}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-medium text-emerald-600 truncate max-w-[120px] text-[11px]">{String(ch.newValue || '–')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Schließen
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportStammblatt}
              className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <FileDown className="w-4 h-4 text-blue-600" />
              Stammblatt PDF
            </button>
            <button
              type="button"
              onClick={() => onEdit(member)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Edit2 className="w-4 h-4" />
              Bearbeiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
