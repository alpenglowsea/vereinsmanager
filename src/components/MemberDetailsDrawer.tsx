import React, { useState, useEffect, useRef } from 'react';
import { Member, MemberAuditLog, ClubSettings, InventoryItem, MemberInventoryAssignment } from '../types';
import { ExportService } from '../services/exportService';
import { StorageService } from '../services/storage';
import { IssuedInventoryModal } from './IssuedInventoryModal';
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
  AlertCircle,
  Package,
  Plus,
  CheckCircle2,
  RotateCcw,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

interface MemberDetailsDrawerProps {
  member: Member | null;
  auditLogs?: MemberAuditLog[];
  settings: ClubSettings;
  inventory?: InventoryItem[];
  allMembers?: Member[];
  onEdit: (member: Member) => void;
  onDelete?: (id: string) => void;
  onSaveMember?: (member: Member) => void;
  onClose: () => void;
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
  member,
  auditLogs = [],
  settings,
  inventory,
  allMembers,
  onEdit,
  onDelete,
  onSaveMember,
  onClose
}) => {
  const [tab, setTab] = useState<'details' | 'history' | 'inventory'>('details');
  const [copiedIban, setCopiedIban] = useState(false);
  const [logs, setLogs] = useState<MemberAuditLog[]>(auditLogs || []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Material & Inventar Verknüpfung
  const [memberAssignments, setMemberAssignments] = useState<MemberInventoryAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<MemberInventoryAssignment[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(inventory || []);
  const [showAllIssuedModal, setShowAllIssuedModal] = useState(false);

  // Neue Kachel (Inline-Formular)
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [newAssignmentItem, setNewAssignmentItem] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newIssueDate, setNewIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newHasContribution, setNewHasContribution] = useState(false);
  const [newContributionAmount, setNewContributionAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Kachel bearbeiten
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editHasContribution, setEditHasContribution] = useState(false);
  const [editContributionAmount, setEditContributionAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadAssignments = async () => {
    if (!member) return;
    try {
      const all = await StorageService.getMemberInventoryAssignments();
      setAllAssignments(all);
      setMemberAssignments(all.filter(a => a.memberId === member.id));
    } catch (err) {
      console.warn('Fehler beim Laden der Materialzuweisungen:', err);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [member]);

  useEffect(() => {
    if (inventory && inventory.length > 0) {
      setInventoryList(inventory);
      if (!newAssignmentItem) setNewAssignmentItem(inventory[0].id);
    } else {
      StorageService.getInventory().then(items => {
        setInventoryList(items);
        if (items.length > 0 && !newAssignmentItem) {
          setNewAssignmentItem(items[0].id);
        }
      }).catch(() => {});
    }
  }, [inventory]);

  const handleSaveNewAssignment = async () => {
    if (!member || !newAssignmentItem) return;
    const inv = inventoryList.find(i => i.id === newAssignmentItem);
    const parsedContrib = newHasContribution
      ? parseFloat(String(newContributionAmount).replace(',', '.')) || 0
      : undefined;

    const assignment: MemberInventoryAssignment = {
      id: `mia_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      memberId: member.id,
      inventoryItemId: newAssignmentItem,
      itemName: inv?.name || 'Gegenstand',
      itemNumber: inv?.itemNumber || '',
      quantity: Math.max(1, Number(newQuantity) || 1),
      unit: inv?.unit || 'Stk.',
      hasContribution: Boolean(newHasContribution),
      contributionAmount: parsedContrib,
      issueDate: newIssueDate || new Date().toISOString().split('T')[0],
      status: 'issued',
      notes: newNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await StorageService.saveMemberInventoryAssignment(assignment);
    setIsAddingAssignment(false);
    setNewQuantity(1);
    setNewHasContribution(false);
    setNewContributionAmount('');
    setNewNotes('');
    await loadAssignments();
  };

  const handleUpdateAssignment = async (updated: MemberInventoryAssignment) => {
    await StorageService.saveMemberInventoryAssignment(updated);
    await loadAssignments();
  };

  const handleToggleReturn = async (item: MemberInventoryAssignment) => {
    const isNowReturned = item.status !== 'returned';
    const updated: MemberInventoryAssignment = {
      ...item,
      status: isNowReturned ? 'returned' : 'issued',
      returnDate: isNowReturned ? new Date().toISOString().split('T')[0] : undefined,
      updatedAt: new Date().toISOString()
    };
    await handleUpdateAssignment(updated);
  };

  const handleDeleteAssignment = async (id: string) => {
    if (window.confirm('Gegenstand-Verknüpfung wirklich entfernen?')) {
      await StorageService.deleteMemberInventoryAssignment(id);
      await loadAssignments();
    }
  };

  const handleStartEdit = (a: MemberInventoryAssignment) => {
    setEditingAssignmentId(a.id);
    setEditItem(a.inventoryItemId);
    setEditQuantity(a.quantity);
    setEditIssueDate(a.issueDate);
    setEditHasContribution(a.hasContribution);
    setEditContributionAmount(a.contributionAmount ? String(a.contributionAmount) : '');
    setEditNotes(a.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingAssignmentId || !member) return;
    const existing = memberAssignments.find(a => a.id === editingAssignmentId);
    if (!existing) return;
    const inv = inventoryList.find(i => i.id === editItem);
    const parsedContrib = editHasContribution
      ? parseFloat(String(editContributionAmount).replace(',', '.')) || 0
      : undefined;

    const updated: MemberInventoryAssignment = {
      ...existing,
      inventoryItemId: editItem,
      itemName: inv?.name || existing.itemName,
      itemNumber: inv?.itemNumber || existing.itemNumber,
      quantity: Math.max(1, Number(editQuantity) || 1),
      unit: inv?.unit || existing.unit,
      hasContribution: Boolean(editHasContribution),
      contributionAmount: parsedContrib,
      issueDate: editIssueDate || existing.issueDate,
      notes: editNotes.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    await StorageService.saveMemberInventoryAssignment(updated);
    setEditingAssignmentId(null);
    await loadAssignments();
  };

  const handleExportMemberAssignmentsCSV = () => {
    if (!member) return;
    ExportService.exportIssuedInventoryCSV(
      memberAssignments,
      [member],
      inventoryList,
      `material_${member.lastName}_${member.firstName}.csv`
    );
  };

  const handleExportMemberAssignmentsPDF = () => {
    if (!member) return;
    ExportService.exportIssuedInventoryPDF(
      memberAssignments,
      [member],
      inventoryList,
      settings,
      `material_${member.lastName}_${member.firstName}.pdf`
    );
  };

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
      case 'ausgetreten':
      case 'terminated':
        return 'Ausgetreten';
      default: return 'Mitglied';
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
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
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
            onClick={() => setTab('inventory')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            Inventar ({memberAssignments.length})
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

          {/* Tab 3: Inventar & Material */}
          {tab === 'inventory' && (
            <div className="space-y-4">
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Inventar & Material ({memberAssignments.length})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Dem Mitglied zur Nutzung überlassene Vereinsgegenstände
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllIssuedModal(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Alle ausgeteilten Gegenstände</span>
                  </button>

                  {!isAddingAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAssignment(true);
                        if (inventoryList.length > 0 && !newAssignmentItem) {
                          setNewAssignmentItem(inventoryList[0].id);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Gegenstand verknüpfen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* NEUE KACHEL (Inline-Formular bei Klick auf Button) */}
              {isAddingAssignment && (
                <div className="p-4 bg-blue-50/60 border-2 border-blue-300 rounded-xl space-y-3 animate-in fade-in duration-150 shadow-xs">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-blue-600" />
                      Gegenstand verknüpfen
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingAssignment(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="Abbrechen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {inventoryList.length === 0 ? (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      Kein Inventar vorhanden. Erfassen Sie zuerst Gegenstände in der Inventarverwaltung.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Gegenstand Dropdown */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Gegenstand</label>
                        <select
                          value={newAssignmentItem}
                          onChange={e => setNewAssignmentItem(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          {inventoryList.map(item => (
                            <option key={item.id} value={item.id}>
                              [{item.itemNumber}] {item.name} ({item.department} • Bestand: {item.quantity} {item.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Menge */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Menge</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={newQuantity}
                            onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Ausgabedatum */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Ausgabedatum</label>
                          <input
                            type="date"
                            value={newIssueDate}
                            onChange={e => setNewIssueDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Checkbox Eigenanteil */}
                      <div className="pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newHasContribution}
                            onChange={e => setNewHasContribution(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold text-slate-700">Eigenanteil geleistet</span>
                        </label>
                      </div>

                      {/* Betragsfeld bei bestätigter Checkbox */}
                      {newHasContribution && (
                        <div className="animate-in fade-in duration-150">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Betrag (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newContributionAmount}
                            onChange={e => setNewContributionAmount(e.target.value)}
                            placeholder="0,00"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      {/* Notiz */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Notiz</label>
                        <input
                          type="text"
                          value={newNotes}
                          onChange={e => setNewNotes(e.target.value)}
                          placeholder="z.B. Kennzeichnung, Zustand..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200/80">
                        <button
                          type="button"
                          onClick={() => setIsAddingAssignment(false)}
                          className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewAssignment}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LISTE DER BESTEHENDEN KACHELN */}
              {memberAssignments.length === 0 && !isAddingAssignment ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-xs text-slate-700">Keine Gegenstände verknüpft</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Klicken Sie auf "+ Gegenstand verknüpfen", um Material aus dem Inventar zuzuweisen.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {memberAssignments.map(a => {
                    const isEditing = editingAssignmentId === a.id;
                    const inv = inventoryList.find(i => i.id === a.inventoryItemId);
                    const itemName = a.itemName || inv?.name || 'Gegenstand';
                    const itemNumber = a.itemNumber || inv?.itemNumber;
                    const unit = a.unit || inv?.unit || 'Stk.';

                    if (isEditing) {
                      return (
                        <div key={a.id} className="p-4 bg-amber-50/60 border-2 border-amber-300 rounded-xl space-y-3">
                          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                            <span className="text-xs font-bold text-amber-900">Gegenstand bearbeiten</span>
                            <button
                              type="button"
                              onClick={() => setEditingAssignmentId(null)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title="Abbrechen"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Gegenstand</label>
                              <select
                                value={editItem}
                                onChange={e => setEditItem(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                              >
                                {inventoryList.map(item => (
                                  <option key={item.id} value={item.id}>
                                    [{item.itemNumber}] {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Menge</label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={editQuantity}
                                  onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Ausgabedatum</label>
                                <input
                                  type="date"
                                  value={editIssueDate}
                                  onChange={e => setEditIssueDate(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                                />
                              </div>
                            </div>

                            <div className="pt-1">
                              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={editHasContribution}
                                  onChange={e => setEditHasContribution(e.target.checked)}
                                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                                />
                                <span className="text-xs font-semibold text-slate-700">Eigenanteil geleistet</span>
                              </label>
                            </div>

                            {editHasContribution && (
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Betrag (€)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editContributionAmount}
                                  onChange={e => setEditContributionAmount(e.target.value)}
                                  placeholder="0,00"
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Notiz</label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                              <button
                                type="button"
                                onClick={() => setEditingAssignmentId(null)}
                                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                              >
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                              >
                                Speichern
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Kachel im Anzeige-Modus
                    return (
                      <div
                        key={a.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          a.status === 'returned'
                            ? 'bg-slate-50 border-slate-200 opacity-80'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-xs text-slate-900 truncate">{itemName}</h4>
                              {itemNumber && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {itemNumber}
                                </span>
                              )}
                              {a.status === 'returned' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" /> Zurück ({a.returnDate})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3" /> Ausgegeben
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                              <span>Menge: <strong className="text-slate-800 font-semibold">{a.quantity} {unit}</strong></span>
                              <span>•</span>
                              <span>Ausgabe: <strong className="text-slate-700">{a.issueDate || '–'}</strong></span>
                              <span>•</span>
                              <span>
                                {a.hasContribution && a.contributionAmount ? (
                                  <span className="font-bold text-blue-700">
                                    Eigenanteil: {a.contributionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Kein Eigenanteil</span>
                                )}
                              </span>
                            </div>

                            {a.notes && (
                              <p className="text-[11px] text-slate-600 italic mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                {a.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleReturn(a)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors text-xs flex items-center gap-1"
                              title={a.status === 'returned' ? 'Erneut ausgeben' : 'Rückgabe verbuchen'}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium hidden sm:inline">
                                {a.status === 'returned' ? 'Erneut ausgeben' : 'Rückgabe'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(a)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Export Buttons für dieses Mitglied */}
              {memberAssignments.length > 0 && (
                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200">
                  <span className="text-[11px] text-slate-500">
                    Export für {member.firstName} {member.lastName}:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportMemberAssignmentsCSV}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-[11px] font-medium flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                      <span>CSV-Export</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportMemberAssignmentsPDF}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-[11px] font-medium flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3 text-rose-600" />
                      <span>PDF-Export</span>
                    </button>
                  </div>
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
              onClick={() => {
                onClose();
                onEdit(member);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Edit2 className="w-4 h-4" />
              Bearbeiten
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Liste aller ausgeteilten Gegenstände mit CSV/PDF Export */}
      {showAllIssuedModal && (
        <IssuedInventoryModal
          isOpen={showAllIssuedModal}
          onClose={() => {
            setShowAllIssuedModal(false);
            loadAssignments();
          }}
          assignments={allAssignments}
          members={allMembers || (member ? [member] : [])}
          inventory={inventoryList}
          settings={settings}
          onUpdateAssignment={async (updated) => {
            await handleUpdateAssignment(updated);
          }}
          onDeleteAssignment={async (id) => {
            await handleDeleteAssignment(id);
          }}
        />
      )}
    </div>
  );
};
