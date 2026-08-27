import React, { useState, useMemo } from 'react';
import { Member, ClubSettings, MembershipStatus, MembershipType, PaymentMethod, MemberBulkUpdates } from '../types';
import { ExportService } from '../services/exportService';
import { MemberBulkEditModal } from './MemberBulkEditModal';
import {
  Search,
  Plus,
  FileDown,
  Download,
  Upload,
  FileSpreadsheet,
  Filter,
  UserCheck,
  Building2,
  Trash2,
  Edit2,
  Eye,
  CreditCard,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
  CheckSquare,
  Square,
  AlertTriangle,
  X
} from 'lucide-react';

interface MembersViewProps {
  members: Member[];
  settings: ClubSettings;
  onOpenCreate: () => void;
  onOpenEdit: (member: Member) => void;
  onOpenDetails: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onBulkUpdateMembers?: (ids: string[], updates: MemberBulkUpdates) => Promise<void>;
  onBulkDeleteMembers?: (ids: string[]) => Promise<void>;
  onOpenImport: () => void;
  onNavigateToSepa?: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  settings,
  onOpenCreate,
  onOpenEdit,
  onOpenDetails,
  onDeleteMember,
  onBulkUpdateMembers,
  onBulkDeleteMembers,
  onOpenImport,
  onNavigateToSepa
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'entryDate' | 'fee'>('number');
  const [sortAsc, setSortAsc] = useState(true);

  // Multiple selection state
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Filter & Search logic
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // Text search in all meaningful fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          m.memberNumber.toLowerCase().includes(q) ||
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q) ||
          m.address.city.toLowerCase().includes(q) ||
          m.address.zip.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;

      // Department filter
      if (deptFilter !== 'all' && m.department !== deptFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && m.membershipType !== typeFilter) return false;

      // Payment filter
      if (paymentFilter !== 'all' && m.paymentMethod !== paymentFilter) return false;

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'number') {
        comparison = a.memberNumber.localeCompare(b.memberNumber, undefined, { numeric: true });
      } else if (sortBy === 'name') {
        comparison = a.lastName.localeCompare(b.lastName);
      } else if (sortBy === 'entryDate') {
        comparison = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
      } else if (sortBy === 'fee') {
        comparison = a.feeAmount - b.feeAmount;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [members, searchQuery, statusFilter, deptFilter, typeFilter, paymentFilter, sortBy, sortAsc]);

  // Selected members list
  const selectedMembers = useMemo(() => {
    return members.filter(m => selectedMemberIds.has(m.id));
  }, [members, selectedMemberIds]);

  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every(m => selectedMemberIds.has(m.id));
  const someFilteredSelected = filteredMembers.some(m => selectedMemberIds.has(m.id)) && !allFilteredSelected;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedMemberIds(prev => {
        const next = new Set(prev);
        filteredMembers.forEach(m => next.delete(m.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedMemberIds(prev => {
        const next = new Set(prev);
        filteredMembers.forEach(m => next.add(m.id));
        return next;
      });
    }
  };

  const handleToggleMember = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  const handleBulkUpdate = async (updates: MemberBulkUpdates) => {
    if (onBulkUpdateMembers && selectedMemberIds.size > 0) {
      await onBulkUpdateMembers(Array.from(selectedMemberIds), updates);
      setIsBulkEditOpen(false);
      handleClearSelection();
    }
  };

  const handleBulkDelete = async () => {
    if (onBulkDeleteMembers && selectedMemberIds.size > 0) {
      await onBulkDeleteMembers(Array.from(selectedMemberIds));
      setIsBulkDeleteConfirmOpen(false);
      handleClearSelection();
    }
  };

  const handleExportSelectedCSV = () => {
    const toExport = selectedMembers.length > 0 ? selectedMembers : filteredMembers;
    ExportService.exportMembersCSV(toExport, `mitglieder_${toExport.length}_ausgewaehlt.csv`);
  };

  const handleExportSelectedPDF = () => {
    const toExport = selectedMembers.length > 0 ? selectedMembers : filteredMembers;
    ExportService.exportMembersPDF(toExport, settings);
  };

  const activeCount = members.filter(m => m.status === 'active').length;
  const activePct = members.length > 0 ? Math.round((activeCount / members.length) * 100) : 0;
  const youthCount = members.filter(m => m.membershipType === 'youth').length;
  const passiveCount = members.filter(m => m.status === 'passive').length;

  // Department / Sparte statistics
  const departmentStats = useMemo(() => {
    const map = new Map<string, number>();

    // Pre-populate with all configured departments from club settings
    (settings.departments || []).forEach(dept => {
      if (dept && dept.trim()) {
        map.set(dept.trim(), 0);
      }
    });

    let unassignedCount = 0;
    members.forEach(m => {
      if (m.status === 'terminated') return; // only active/passive current members count
      const d = m.department?.trim();
      if (d) {
        map.set(d, (map.get(d) || 0) + 1);
      } else {
        unassignedCount++;
      }
    });

    if (unassignedCount > 0) {
      map.set('Ohne Sparte', unassignedCount);
    }

    const currentTotal = members.filter(m => m.status !== 'terminated').length || members.length;
    const list = Array.from(map.entries()).map(([department, count]) => {
      const percentage = currentTotal > 0 ? Math.round((count / currentTotal) * 100) : 0;
      return { department, count, percentage };
    });

    return list.sort((a, b) => b.count - a.count);
  }, [members, settings.departments]);

  const handleExportCSV = () => {
    ExportService.exportMembersCSV(filteredMembers, `mitglieder_${settings.clubName.replace(/\s/g, '_')}.csv`);
  };

  const handleExportPDF = () => {
    ExportService.exportMembersPDF(filteredMembers, settings);
  };

  const getStatusBadge = (status: Member['status']) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">AKTIV</span>;
      case 'passive':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">PASSIV</span>;
      case 'honorary':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">EHREN</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">RUHEND</span>;
      case 'terminated':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">GEKÜNDIGT</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 relative pb-16">
      {/* Metric Cards: Mitglieder Gesamt & Mitglieder je Sparte */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kachel 1: Mitglieder Gesamt */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mitglieder Gesamt
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                {activePct}% Aktiv
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-bold font-mono text-slate-900">{members.length}</h3>
              {(statusFilter !== 'all' || typeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1"
                  title="Filter für Status/Typ aufheben"
                >
                  <span>Filter aufheben</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            {/* Aktiv Filter Button */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/40'
                  : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200 text-slate-800'
              }`}
              title={statusFilter === 'active' ? 'Klicken, um Filter aufzuheben' : 'Klicken, um nach aktiven Mitgliedern zu filtern'}
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${statusFilter === 'active' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Aktiv
              </p>
              <p className={`text-sm font-bold font-mono ${statusFilter === 'active' ? 'text-white' : 'text-emerald-900'}`}>
                {activeCount}
              </p>
            </button>

            {/* Passiv Filter Button */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'passive' ? 'all' : 'passive')}
              className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                statusFilter === 'passive'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
              title={statusFilter === 'passive' ? 'Klicken, um Filter aufzuheben' : 'Klicken, um nach passiven Mitgliedern zu filtern'}
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${statusFilter === 'passive' ? 'text-slate-200' : 'text-slate-600'}`}>
                Passiv
              </p>
              <p className={`text-sm font-bold font-mono ${statusFilter === 'passive' ? 'text-white' : 'text-slate-800'}`}>
                {passiveCount}
              </p>
            </button>

            {/* Jugend Filter Button */}
            <button
              type="button"
              onClick={() => setTypeFilter(typeFilter === 'youth' ? 'all' : 'youth')}
              className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                typeFilter === 'youth'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/40'
                  : 'bg-blue-50/70 hover:bg-blue-100 border-blue-200 text-slate-800'
              }`}
              title={typeFilter === 'youth' ? 'Klicken, um Filter aufzuheben' : 'Klicken, um nach Jugend/Kindern zu filtern'}
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${typeFilter === 'youth' ? 'text-blue-100' : 'text-blue-700'}`}>
                Jugend
              </p>
              <p className={`text-sm font-bold font-mono ${typeFilter === 'youth' ? 'text-white' : 'text-blue-900'}`}>
                {youthCount}
              </p>
            </button>
          </div>
        </div>

        {/* Kachel 2: Mitglieder je Sparte */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mitglieder je Sparte
                </p>
                <p className="text-[11px] text-slate-400">
                  {departmentStats.length} Sparte{departmentStats.length === 1 ? '' : 'n'} im Verein
                </p>
              </div>
            </div>
            {deptFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setDeptFilter('all')}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <span>Filter &bdquo;{deptFilter}&ldquo; aufheben</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {departmentStats.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Keine Sparten hinterlegt</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {departmentStats.map((item) => {
                const isFiltered = deptFilter === item.department;
                return (
                  <button
                    key={item.department}
                    type="button"
                    onClick={() => setDeptFilter(deptFilter === item.department ? 'all' : item.department)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between group cursor-pointer ${
                      isFiltered
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 border-slate-200 text-slate-800'
                    }`}
                    title={`Klicken, um Tabelle nach Sparte „${item.department}“ zu filtern`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${isFiltered ? 'text-white' : 'text-slate-800 group-hover:text-indigo-900'}`}>
                        {item.department}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                          isFiltered ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold font-mono ${isFiltered ? 'text-white' : 'text-slate-900'}`}>
                        {item.count}
                      </span>
                      <span className={`text-[10px] ${isFiltered ? 'text-indigo-200' : 'text-slate-400'}`}>
                        Mitglieder
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedMemberIds.size > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {selectedMemberIds.size}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedMemberIds.size} Mitglied{selectedMemberIds.size > 1 ? 'er' : ''} ausgewählt</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Wählen Sie eine Sammelaktion für alle markierten Personen
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsBulkEditOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Stammdaten bearbeiten</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Ausgewählte löschen</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
              title="Nur ausgewählte Mitglieder als CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedPDF}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
              title="Nur ausgewählte Mitglieder als PDF exportieren"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-400" />
              <span>PDF</span>
            </button>

            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Auswahl aufheben"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card Container */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Table Top Header with Title and Action buttons */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">
              Aktuelle Mitgliederliste
            </h4>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {filteredMembers.length}
            </span>
            {selectedMemberIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                {selectedMemberIds.size} markiert
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToSepa && (
              <button
                type="button"
                onClick={onNavigateToSepa}
                className="text-xs bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs"
                title="Direkt zum SEPA-Lastschrifteinzug wechseln"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>SEPA-Beitragslauf</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenImport}
              className="text-xs bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs"
              title="Mitglieder aus Google Sheets oder CSV-Datei importieren"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV / Sheets Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              title="Gefilterte Liste als Excel-CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              title="Druckreife Mitgliederliste als PDF herunterladen"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF Liste</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neues Mitglied</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Suche nach Name, Nr., Ort, E-Mail..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Status</option>
            <option value="active">🟢 Aktiv</option>
            <option value="passive">⚪ Passiv</option>
            <option value="honorary">⭐ Ehrenmitglieder</option>
            <option value="suspended">🟡 Ruhend</option>
            <option value="terminated">🔴 Gekündigt</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Abteilungen</option>
            {settings.departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Membership Type */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Typen</option>
            <option value="full">Vollmitglied</option>
            <option value="youth">Jugend / Kinder</option>
            <option value="reduced">Ermäßigt</option>
            <option value="family">Familie</option>
            <option value="supporting">Förderer / Sponsor</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Zahlungsarten</option>
            <option value="sepa">SEPA-Lastschrift</option>
            <option value="transfer">Überweisung</option>
            <option value="cash">Bargeld</option>
            <option value="standing_order">Dauerauftrag</option>
          </select>

          {/* Reset Filter Button */}
          {(statusFilter !== 'all' || deptFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setDeptFilter('all');
                setTypeFilter('all');
                setPaymentFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                {/* Select All Checkbox Header */}
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={input => {
                      if (input) input.indeterminate = someFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    aria-label="Alle sichtbaren Mitglieder auswählen"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'number') setSortAsc(!sortAsc);
                    else { setSortBy('number'); setSortAsc(true); }
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-slate-800 w-24"
                >
                  ID {sortBy === 'number' && (sortAsc ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortBy === 'name') setSortAsc(!sortAsc);
                    else { setSortBy('name'); setSortAsc(true); }
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-slate-800"
                >
                  Name {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Abteilung</th>
                <th className="px-4 py-3">Eintritt</th>
                <th className="px-4 py-3">Wohnort</th>
                <th
                  onClick={() => {
                    if (sortBy === 'fee') setSortAsc(!sortAsc);
                    else { setSortBy('fee'); setSortAsc(true); }
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-slate-800 text-right"
                >
                  Beitrag {sortBy === 'fee' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-center">Zahlung</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.id);

                return (
                  <tr
                    key={member.id}
                    onClick={() => onOpenDetails(member)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50/70 hover:bg-blue-100/60'
                        : 'hover:bg-blue-50/40'
                    }`}
                  >
                    {/* Row Selection Checkbox */}
                    <td
                      className="w-10 px-3 py-3 text-center"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => handleToggleMember(member.id, e)}
                        aria-label={`Mitglied ${member.firstName} ${member.lastName} auswählen`}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-400 font-medium text-xs">
                      {member.memberNumber}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{member.firstName.charAt(0)}{member.lastName.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {member.lastName}, {member.firstName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {member.email || member.phone || 'Keine Kontaktdaten'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(member.status)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium text-xs">
                      {member.department}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {member.entryDate ? new Date(member.entryDate).toLocaleDateString('de-DE') : '–'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {member.address.zip} {member.address.city}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 text-xs">
                      {member.feeAmount.toFixed(2)} €
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {member.feePeriod === 'yearly' ? 'jährlich' : member.feePeriod === 'monthly' ? 'monatl.' : 'halbj.'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {member.paymentMethod.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenDetails(member)}
                          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded font-medium transition-colors"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(member)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Mitglied ${member.firstName} ${member.lastName} (${member.memberNumber}) wirklich löschen?`)) {
                              onDeleteMember(member.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 text-xs">
                    Keine Mitglieder für die aktuellen Filterkriterien gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400 flex items-center justify-between px-6">
          <span>Zeige {filteredMembers.length} von {members.length} Mitgliedern</span>
          {selectedMemberIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-blue-600 hover:underline font-semibold"
            >
              {selectedMemberIds.size} Auswahl aufheben
            </button>
          )}
        </div>
      </section>

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <MemberBulkEditModal
          selectedMembers={selectedMembers}
          departments={settings.departments}
          onSave={handleBulkUpdate}
          onClose={() => setIsBulkEditOpen(false)}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedMemberIds.size} Mitglied{selectedMemberIds.size > 1 ? 'er' : ''} wirklich löschen?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diese Aktion kann nicht rückgängig gemacht werden. Die Löschung wird revisionssicher im Audit-Log archiviert.
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-40 overflow-y-auto text-xs divide-y divide-rose-100">
              {selectedMembers.map(m => (
                <div key={m.id} className="py-1.5 flex items-center justify-between text-rose-950 font-medium">
                  <span>{m.lastName}, {m.firstName}</span>
                  <span className="font-mono text-rose-700 text-[11px]">{m.memberNumber} • {m.department}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ja, {selectedMemberIds.size} Mitglieder unwiderruflich löschen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
