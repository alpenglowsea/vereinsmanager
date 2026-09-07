import React, { useState, useMemo } from 'react';
import {
  ClubInvoice,
  InvoiceStatus,
  TaxSphere,
  ClubSettings,
  InvoiceTemplateSettings
} from '../types';
import { formatCurrency, generateInvoicePdf } from '../services/invoicePdfService';
import {
  Search,
  Plus,
  FileDown,
  Download,
  Trash2,
  Edit2,
  Eye,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  Building2,
  User,
  Sliders,
  CheckSquare,
  Square,
  X,
  Calendar,
  Layers,
  Sparkles,
  QrCode,
  FolderArchive
} from 'lucide-react';

interface InvoicesViewProps {
  invoices: ClubInvoice[];
  clubSettings: ClubSettings;
  templateSettings: InvoiceTemplateSettings;
  onOpenCreate: () => void;
  onOpenEdit: (invoice: ClubInvoice) => void;
  onOpenDetails: (invoice: ClubInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  onBulkDeleteInvoices?: (ids: string[]) => Promise<void>;
  onOpenTemplateConfig: () => void;
  onToggleStatus: (invoice: ClubInvoice, newStatus: InvoiceStatus) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  clubSettings,
  templateSettings,
  onOpenCreate,
  onOpenEdit,
  onOpenDetails,
  onDeleteInvoice,
  onBulkDeleteInvoices,
  onOpenTemplateConfig,
  onToggleStatus
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus | 'overdue'>('all');
  const [taxSphereFilter, setTaxSphereFilter] = useState<'all' | TaxSphere>('all');
  const [sortBy, setSortBy] = useState<'date' | 'dueDate' | 'number' | 'recipient' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState(false); // Newest first by default

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Quick stats calculation
  const totalCount = invoices.length;
  const totalSumGross = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  const openInvoices = invoices.filter(i => i.status === 'open');
  const openSumGross = openInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const paidSumGross = paidInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  const now = new Date();
  const overdueInvoices = openInvoices.filter(i => new Date(i.dueDate) < now);
  const overdueSumGross = overdueInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNum = (inv.invoiceNumber || '').toLowerCase().includes(query);
        const matchRecipient = (inv.recipientName || '').toLowerCase().includes(query);
        const matchCompany = (inv.recipientCompany || '').toLowerCase().includes(query);
        const matchContactPerson = (inv.recipientContactPerson || '').toLowerCase().includes(query);
        const matchSubject = (inv.subject || '').toLowerCase().includes(query);
        const matchCity = (inv.recipientAddress?.city || '').toLowerCase().includes(query);
        const matchNotes = (inv.notes || '').toLowerCase().includes(query);
        const matchItems = (inv.items || []).some(it => (it.description || '').toLowerCase().includes(query));

        if (
          !matchNum &&
          !matchRecipient &&
          !matchCompany &&
          !matchContactPerson &&
          !matchSubject &&
          !matchCity &&
          !matchNotes &&
          !matchItems
        ) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === 'overdue') {
        if (!(inv.status === 'open' && new Date(inv.dueDate) < now)) {
          return false;
        }
      } else if (statusFilter !== 'all') {
        if (inv.status !== statusFilter) {
          return false;
        }
      }

      // 3. Tax sphere filter
      if (taxSphereFilter !== 'all') {
        if (inv.taxSphere !== taxSphereFilter) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      } else if (sortBy === 'dueDate') {
        comparison = new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
      } else if (sortBy === 'number') {
        comparison = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '', 'de', { numeric: true });
      } else if (sortBy === 'recipient') {
        comparison = (a.recipientName || '').localeCompare(b.recipientName || '', 'de');
      } else if (sortBy === 'amount') {
        comparison = (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [invoices, searchQuery, statusFilter, taxSphereFilter, sortBy, sortAsc]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!onBulkDeleteInvoices || selectedIds.size === 0) return;
    if (
      window.confirm(
        `Möchten Sie die ${selectedIds.size} ausgewählten Rechnungen wirklich unwiderruflich löschen?`
      )
    ) {
      await onBulkDeleteInvoices(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Quick Export CSV
  const handleExportCSV = () => {
    const toExport =
      selectedIds.size > 0
        ? invoices.filter(i => selectedIds.has(i.id))
        : filteredInvoices;

    const headers = [
      'Rechnungsnummer',
      'Datum',
      'Faelligkeit',
      'Status',
      'Empfaenger',
      'Firma',
      'Strasse',
      'PLZ_Ort',
      'Betreff',
      'Netto_EUR',
      'Gesamt_EUR',
      'Steuersphaere'
    ];

    const rows = toExport.map(i => [
      `"${i.invoiceNumber}"`,
      `"${i.date}"`,
      `"${i.dueDate}"`,
      `"${i.status}"`,
      `"${i.recipientName || ''}"`,
      `"${i.recipientCompany || ''}"`,
      `"${(i.recipientAddress?.street || '') + ' ' + (i.recipientAddress?.houseNumber || '')}"`,
      `"${(i.recipientAddress?.zip || '') + ' ' + (i.recipientAddress?.city || '')}"`,
      `"${(i.subject || '').replace(/"/g, '""')}"`,
      (i.subtotalNet || 0).toFixed(2).replace('.', ','),
      (i.totalAmount || 0).toFixed(2).replace('.', ','),
      `"${i.taxSphere || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rechnungen_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const renderStatusBadge = (inv: ClubInvoice) => {
    const isOverdue = inv.status === 'open' && new Date(inv.dueDate) < now;

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
          <Clock className="w-3 h-3" />
          <span>Überfällig</span>
        </span>
      );
    }

    switch (inv.status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            <span>Bezahlt</span>
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" />
            <span>Offen</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
            <Ban className="w-3 h-3" />
            <span>Storniert</span>
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <FileText className="w-3 h-3" />
            <span>Entwurf</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 relative pb-16">
      {/* Metric Cards: Rechnungen Gesamt, Offen, Bezahlt & Überfällig */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kachel 1: Gesamt */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rechnungen Gesamt
              </p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {totalCount} Stk.
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 mt-1">
              {formatCurrency(totalSumGross)}
            </h3>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Volumen brutto</span>
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Kachel 2: Offen */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'open'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/40'
              : 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-semibold uppercase tracking-wider ${statusFilter === 'open' ? 'text-blue-100' : 'text-slate-500'}`}>
                Offene Forderungen
              </p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                statusFilter === 'open' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700'
              }`}>
                {openInvoices.length} offen
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 ${
              statusFilter === 'open' ? 'text-white' : 'text-blue-700'
            }`}>
              {formatCurrency(openSumGross)}
            </h3>
          </div>
          <div className={`mt-3 pt-2.5 border-t text-xs flex items-center justify-between ${
            statusFilter === 'open' ? 'border-blue-500 text-blue-100' : 'border-slate-100 text-slate-500'
          }`}>
            <span>Zahlungseingang ausstehend</span>
            <span>{statusFilter === 'open' ? 'Aktiv' : 'Filtern'}</span>
          </div>
        </div>

        {/* Kachel 3: Bezahlt */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
          className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'paid'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/40'
              : 'bg-white hover:bg-emerald-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-semibold uppercase tracking-wider ${statusFilter === 'paid' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Bezahlt
              </p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                statusFilter === 'paid' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800'
              }`}>
                {paidInvoices.length} bezahlt
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 ${
              statusFilter === 'paid' ? 'text-white' : 'text-emerald-700'
            }`}>
              {formatCurrency(paidSumGross)}
            </h3>
          </div>
          <div className={`mt-3 pt-2.5 border-t text-xs flex items-center justify-between ${
            statusFilter === 'paid' ? 'border-emerald-600 text-emerald-100' : 'border-slate-100 text-slate-500'
          }`}>
            <span>Beglichene Rechnungen</span>
            <span>{statusFilter === 'paid' ? 'Aktiv' : 'Filtern'}</span>
          </div>
        </div>

        {/* Kachel 4: Überfällig */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'overdue'
              ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-400/40'
              : 'bg-white hover:bg-red-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-semibold uppercase tracking-wider ${statusFilter === 'overdue' ? 'text-red-100' : 'text-slate-500'}`}>
                Mahnwesen / Überfällig
              </p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                statusFilter === 'overdue' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700'
              }`}>
                {overdueInvoices.length} fällig
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 ${
              statusFilter === 'overdue' ? 'text-white' : 'text-red-700'
            }`}>
              {formatCurrency(overdueSumGross)}
            </h3>
          </div>
          <div className={`mt-3 pt-2.5 border-t text-xs flex items-center justify-between ${
            statusFilter === 'overdue' ? 'border-red-500 text-red-100' : 'border-slate-100 text-slate-500'
          }`}>
            <span>Zahlungsfrist überschritten</span>
            <span>{statusFilter === 'overdue' ? 'Aktiv' : 'Filtern'}</span>
          </div>
        </div>
      </section>

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {selectedIds.size}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedIds.size} Rechnung{selectedIds.size > 1 ? 'en' : ''} ausgewählt</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Sammelaktion für alle ausgewählten Rechnungen ausführen
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {onBulkDeleteInvoices && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ausgewählte löschen</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Ausgewählte Rechnungen als CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV Export</span>
            </button>

            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Auswahl aufheben"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card Container (Exaktes Layout analog zur Mitglieder- und Kontakttabelle) */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Table Top Header with Title and Action buttons */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">
              Rechnungsübersicht
            </h4>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {filteredInvoices.length}
            </span>
            {selectedIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                {selectedIds.size} markiert
              </span>
            )}
            {templateSettings.customBlankoDataUrl && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Eigene Blanko-Vorlage aktiv</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Requirement 3: Blanko-Vorlage konfigurieren / hochladen */}
            <button
              type="button"
              onClick={onOpenTemplateConfig}
              className="text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Eigenes Vereins-Briefpapier (Blanko-Vorlage) hochladen oder DIN 5008 Vorlage anpassen"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span>Blanko-Vorlage konfigurieren</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
              title="Rechnungsliste als Excel-CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Export</span>
            </button>

            {/* Requirement 2: Button zum Anlegen einer neuen Rechnung */}
            <button
              type="button"
              onClick={onOpenCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Rechnung</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar directly inside table container */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Suche nach Rechnungsnr., Empfänger, Firma, Betreff, Posten..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="paid">Bezahlt</option>
            <option value="overdue">Überfällig</option>
            <option value="draft">Entwurf</option>
            <option value="cancelled">Storniert</option>
          </select>

          {/* Tax Sphere Filter */}
          <select
            value={taxSphereFilter}
            onChange={e => setTaxSphereFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Sphären</option>
            <option value="wirtschaftlich">Wirtschaftl. Geschäftsbetrieb</option>
            <option value="zweckbetrieb">Zweckbetrieb</option>
            <option value="vermoegen">Vermögensverwaltung</option>
            <option value="ideell">Ideeller Bereich</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sortieren: Rechnungsdatum</option>
            <option value="dueDate">Sortieren: Fälligkeit</option>
            <option value="number">Sortieren: Rechnungsnr.</option>
            <option value="recipient">Sortieren: Empfänger</option>
            <option value="amount">Sortieren: Gesamtbetrag</option>
          </select>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title={sortAsc ? 'Aufsteigend' : 'Absteigend'}
          >
            {sortAsc ? '↑ Aufsteigend' : '↓ Absteigend'}
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
              <tr>
                <th className="w-9 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                    onChange={handleSelectAll}
                    title="Alle auswählen"
                    className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="w-24 px-3 py-3">Status</th>
                <th className="w-32 px-3 py-3">Nr. & Datum</th>
                <th className="px-4 py-3">Empfänger</th>
                <th className="px-4 py-3">Betreff / Verwendung</th>
                <th className="w-32 px-3 py-3">Sphäre</th>
                <th className="w-28 px-3 py-3">Fälligkeit</th>
                <th className="w-28 px-4 py-3 text-right">Betrag (Brutto)</th>
                <th className="w-28 px-3 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700 text-sm">
                        Keine Rechnungen gefunden
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchQuery || statusFilter !== 'all' || taxSphereFilter !== 'all'
                          ? 'Passen Sie Ihre Such- oder Filterkriterien an.'
                          : 'Erstellen Sie Ihre erste Vereinsrechnung mit dem Button oben.'}
                      </p>
                      {(!searchQuery && statusFilter === 'all' && taxSphereFilter === 'all') && (
                        <button
                          type="button"
                          onClick={onOpenCreate}
                          className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Jetzt erste Rechnung erstellen</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const isSelected = selectedIds.has(inv.id);
                  const isOverdue = inv.status === 'open' && new Date(inv.dueDate) < now;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onOpenDetails(inv)}
                      className={`group transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70'
                          : isOverdue
                          ? 'bg-red-50/20 hover:bg-red-50/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td
                        className="px-3 py-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => handleToggleSelect(inv.id, e as any)}
                          className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {renderStatusBadge(inv)}
                      </td>

                      {/* Invoice Number & Date */}
                      <td className="px-3 py-3">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(inv.date).toLocaleDateString('de-DE')}
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            inv.recipientType === 'contact'
                              ? 'bg-indigo-100 text-indigo-700'
                              : inv.recipientType === 'member'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {inv.recipientType === 'contact' ? '🏢' : '👤'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {inv.recipientName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {inv.recipientCompany ? `${inv.recipientCompany} • ` : ''}
                              {inv.recipientAddress?.city || ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 truncate max-w-xs">
                          {inv.subject}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {inv.items.length} Posten: {inv.items.map(it => it.description).join(', ')}
                        </div>
                      </td>

                      {/* Tax Sphere */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {inv.taxSphere === 'wirtschaftlich'
                            ? 'Wirtschaftl.'
                            : inv.taxSphere === 'zweckbetrieb'
                            ? 'Zweckbetrieb'
                            : inv.taxSphere === 'vermoegen'
                            ? 'Vermögen'
                            : 'Ideell'}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-semibold ${
                          isOverdue ? 'text-red-700 font-bold' : 'text-slate-700'
                        }`}>
                          {new Date(inv.dueDate).toLocaleDateString('de-DE')}
                        </span>
                        {inv.documentId && (
                          <span className="block text-[10px] text-blue-600" title="Im Archiv abgelegt">
                            📁 archiviert
                          </span>
                        )}
                      </td>

                      {/* Gross Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          {formatCurrency(inv.totalAmount)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Netto: {formatCurrency(inv.subtotalNet)}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td
                        className="px-3 py-3 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Eye / View Details button */}
                          <button
                            type="button"
                            onClick={() => onOpenDetails(inv)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Rechnungsdetails anzeigen"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* PDF Download Button */}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const pdf = await generateInvoicePdf(inv, clubSettings, templateSettings);
                                pdf.save(`Rechnung_${inv.invoiceNumber}_${inv.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
                              } catch (err) {
                                console.error('Failed to export PDF:', err);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Rechnung als PDF herunterladen"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => onOpenEdit(inv)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Rechnung bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Rechnung ${inv.invoiceNumber} wirklich löschen?`)) {
                                onDeleteInvoice(inv.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Rechnung löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination / Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Zeige <strong className="text-slate-900">{filteredInvoices.length}</strong> von{' '}
            <strong className="text-slate-900">{invoices.length}</strong> Rechnungen
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Bezahlt: {paidInvoices.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Offen: {openInvoices.length}</span>
            </div>
            {overdueInvoices.length > 0 && (
              <div className="flex items-center gap-2 text-red-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Überfällig: {overdueInvoices.length}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
