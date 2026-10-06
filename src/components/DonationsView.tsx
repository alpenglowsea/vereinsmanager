import React, { useState, useMemo, useRef } from 'react';
import {
  DonationReceipt,
  ClubSettings,
  ClubDocument
} from '../types';
import { downloadDonationReceiptPdf } from '../services/donationService';
import { TablePagination } from './TablePagination';
import { AuswahlLeiste } from './AuswahlLeiste';
import { usePagination } from '../hooks/usePagination';
import { ermittleSeitenStatus, wechsleSeite, waehleAlleGefilterten } from '../utils/tableSelection';
import { SortableResizableTh } from './SortableResizableTh';
import { useResizableColumns, ColumnWidths } from '../hooks/useResizableColumns';
import { useSortableColumns } from '../hooks/useSortableColumns';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import {
  HeartHandshake,
  Plus,
  Search,
  Calendar,
  Download,
  Eye,
  Trash2,
  Edit2,
  FileCheck,
  Coins,
  Package,
  ShieldCheck,
  Info,
  CheckCircle2
} from 'lucide-react';

type DonationSortField =
  | 'date'
  | 'donor'
  | 'type'
  | 'purpose'
  | 'amount'
  | 'taxOffice'
  | 'taxNumber'
  | 'exemptionDate'
  | 'assessmentPeriod'
  | 'isDirectlyPromoted'
  | 'issuedBy'
  | 'goodsInfo';

// Reihenfolge, in der Geld- bzw. Sachspenden als "sortiert" gelten (passend
// zur Reihenfolge der Filter-Reiter oben: erst Geld, dann Sachspenden) —
// eine alphabetische Sortierung ("goods" vor "money") wäre hier nicht
// sinnvoll ablesbar.
const DONATION_TYPE_SORT_ORDER: Record<DonationReceipt['type'], number> = { money: 0, goods: 1 };

// Feste Breite für die Aktionsspalte (kein Auswahl-Kästchen in dieser
// Tabelle — Zuwendungsbestätigungen werden einzeln bearbeitet). Die
// übrigen Breiten sind nur ein sinnvoller Startwert; nach dem ersten
// Ziehen bzw. Doppelklick merkt sich der Browser die eigene Wahl (siehe
// useResizableColumns).
const ACTION_COL_WIDTH = 130;
const CHECKBOX_COL_WIDTH = 40;
const DEFAULT_DONATION_COLUMN_WIDTHS: ColumnWidths = {
  date: 130,
  donor: 240,
  type: 180,
  purpose: 220,
  amount: 130,
  status: 150,
  taxOffice: 160,
  taxNumber: 140,
  exemptionDate: 130,
  assessmentPeriod: 150,
  isDirectlyPromoted: 150,
  issuedBy: 160,
  goodsInfo: 220
};
const DONATION_COLUMN_KEYS = Object.keys(DEFAULT_DONATION_COLUMN_WIDTHS);

// Diese sieben Spalten hat Johannes ohne genauere Platzierungsangabe als
// "alles neu anbieten" gewünscht (anders als z.B. bei den Finanzen, wo er
// einzelne Felder ausdrücklich sichtbar haben wollte) — sie starten deshalb
// ausgeblendet, damit die Tabelle nicht plötzlich mit sieben zusätzlichen
// Spalten überrascht; über das Rechtsklick-Menü lassen sie sich jederzeit
// einblenden.
const DONATION_DEFAULT_HIDDEN_COLUMNS = [
  'taxOffice',
  'taxNumber',
  'exemptionDate',
  'assessmentPeriod',
  'isDirectlyPromoted',
  'issuedBy',
  'goodsInfo'
];

const DONATION_COLUMN_LABELS: Record<string, string> = {
  date: 'Nr. & Datum',
  donor: 'Zuwendender / Spender',
  type: 'Art & Muster',
  purpose: 'Zweck / Gegenstand',
  amount: 'Betrag / Wert',
  status: 'Status / Archiv',
  taxOffice: 'Finanzamt',
  taxNumber: 'Steuernummer',
  exemptionDate: 'Freistellungsdatum',
  assessmentPeriod: 'Veranlagungszeitraum',
  isDirectlyPromoted: 'Unmittelbar gefördert',
  issuedBy: 'Ausgestellt von',
  goodsInfo: 'Herkunft & Bewertungsgrundlage (Sachspende)'
};

interface DonationsViewProps {
  donations: DonationReceipt[];
  settings: ClubSettings;
  documents: ClubDocument[];
  onOpenCreateModal: () => void;
  onEditReceipt: (receipt: DonationReceipt) => void;
  onDeleteReceipt: (id: string) => void;
  onViewDocument?: (doc: ClubDocument) => void;
}

export const DonationsView: React.FC<DonationsViewProps> = ({
  donations,
  settings,
  documents,
  onOpenCreateModal,
  onEditReceipt,
  onDeleteReceipt,
  onViewDocument,
}) => {
  /**
   * Klick auf einen ändernden Knopf. Ohne Schreibrecht wird nicht die
   * Aktion ausgeführt, sondern der Hinweis gezeigt.
   */
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'money' | 'goods'>('all');
  const { sortBy, sortDirection, handleSort } = useSortableColumns<DonationSortField>('date', 'desc'); // neueste zuerst

  // Ziehbare, gespeicherte Spaltenbreiten der Tabelle (siehe useResizableColumns).
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths: colWidths, startResize, autoFit } = useResizableColumns(
    'vereinsmanager:colwidths:donations',
    DEFAULT_DONATION_COLUMN_WIDTHS,
    tableRef
  );

  // Per Drag & Drop änderbare Spaltenreihenfolge (siehe useColumnOrder).
  const {
    order: columnOrder,
    draggedKey,
    dragOverKey,
    handleColDragStart,
    handleColDragOver,
    handleColDrop,
    handleColDragEnd
  } = useColumnOrder('vereinsmanager:colorder:donations', DONATION_COLUMN_KEYS);

  // Ein-/Ausblenden einzelner Spalten (unabhängig von Reihenfolge & Breite),
  // bedienbar per Rechtsklick auf einen beliebigen Spaltenkopf.
  const { hidden: hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    'vereinsmanager:colhidden:donations',
    DONATION_COLUMN_KEYS,
    DONATION_DEFAULT_HIDDEN_COLUMNS
  );
  const visibleColumnOrder = columnOrder.filter(key => !hiddenColumns.has(key));
  const [columnMenuPos, setColumnMenuPos] = useState<{ x: number; y: number } | null>(null);
  const openColumnMenu = (e: React.MouseEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    setColumnMenuPos({ x: e.clientX, y: e.clientY });
  };

  const dragProps = (key: string) => ({
    isDragging: draggedKey === key,
    isDragOver: dragOverKey === key,
    onColDragStart: handleColDragStart(key),
    onColDragOver: handleColDragOver(key),
    onColDrop: handleColDrop(key),
    onColDragEnd: handleColDragEnd,
    onContextMenu: openColumnMenu
  });

  // Spaltenkopf-Definitionen je Spaltenschlüssel — werden in der per Drag &
  // Drop gewählten Reihenfolge (columnOrder) gerendert statt in fester
  // Quelltext-Reihenfolge.
  const donationHeaderDefs: Record<string, React.ReactNode> = {
    date: (
      <SortableResizableTh
        key="date"
        label="Nr. & Datum"
        active={sortBy === 'date'}
        direction={sortDirection}
        onSort={() => handleSort('date')}
        sortTitle="Nach Datum sortieren"
        colKey="date"
        width={colWidths.date}
        onResizeStart={startResize('date')}
        onAutoFit={() => autoFit('date')}
        headerBg="bg-slate-50/80"
        {...dragProps('date')}
      />
    ),
    donor: (
      <SortableResizableTh
        key="donor"
        label="Zuwendender / Spender"
        active={sortBy === 'donor'}
        direction={sortDirection}
        onSort={() => handleSort('donor')}
        sortTitle="Nach Zuwendendem sortieren"
        colKey="donor"
        width={colWidths.donor}
        onResizeStart={startResize('donor')}
        onAutoFit={() => autoFit('donor')}
        headerBg="bg-slate-50/80"
        {...dragProps('donor')}
      />
    ),
    type: (
      <SortableResizableTh
        key="type"
        label="Art & Muster"
        active={sortBy === 'type'}
        direction={sortDirection}
        onSort={() => handleSort('type')}
        sortTitle="Nach Art (Geld-/Sachspende) sortieren"
        colKey="type"
        width={colWidths.type}
        onResizeStart={startResize('type')}
        onAutoFit={() => autoFit('type')}
        headerBg="bg-slate-50/80"
        {...dragProps('type')}
      />
    ),
    purpose: (
      <SortableResizableTh
        key="purpose"
        label="Zweck / Gegenstand"
        active={sortBy === 'purpose'}
        direction={sortDirection}
        onSort={() => handleSort('purpose')}
        sortTitle="Nach Zweck / Gegenstand sortieren"
        colKey="purpose"
        width={colWidths.purpose}
        onResizeStart={startResize('purpose')}
        onAutoFit={() => autoFit('purpose')}
        headerBg="bg-slate-50/80"
        {...dragProps('purpose')}
      />
    ),
    amount: (
      <SortableResizableTh
        key="amount"
        label="Betrag / Wert"
        align="right"
        active={sortBy === 'amount'}
        direction={sortDirection}
        onSort={() => handleSort('amount')}
        sortTitle="Nach Betrag / Wert sortieren"
        colKey="amount"
        width={colWidths.amount}
        onResizeStart={startResize('amount')}
        onAutoFit={() => autoFit('amount')}
        headerBg="bg-slate-50/80"
        {...dragProps('amount')}
      />
    ),
    status: (
      <SortableResizableTh
        key="status"
        label="Status / Archiv"
        align="center"
        sortable={false}
        active={false}
        direction="asc"
        onSort={() => {}}
        sortTitle=""
        colKey="status"
        width={colWidths.status}
        onResizeStart={startResize('status')}
        onAutoFit={() => autoFit('status')}
        headerBg="bg-slate-50/80"
        {...dragProps('status')}
      />
    ),
    taxOffice: (
      <SortableResizableTh
        key="taxOffice"
        label="Finanzamt"
        active={sortBy === 'taxOffice'}
        direction={sortDirection}
        onSort={() => handleSort('taxOffice')}
        sortTitle="Nach Finanzamt sortieren"
        colKey="taxOffice"
        width={colWidths.taxOffice}
        onResizeStart={startResize('taxOffice')}
        onAutoFit={() => autoFit('taxOffice')}
        headerBg="bg-slate-50/80"
        {...dragProps('taxOffice')}
      />
    ),
    taxNumber: (
      <SortableResizableTh
        key="taxNumber"
        label="Steuernummer"
        active={sortBy === 'taxNumber'}
        direction={sortDirection}
        onSort={() => handleSort('taxNumber')}
        sortTitle="Nach Steuernummer sortieren"
        colKey="taxNumber"
        width={colWidths.taxNumber}
        onResizeStart={startResize('taxNumber')}
        onAutoFit={() => autoFit('taxNumber')}
        headerBg="bg-slate-50/80"
        {...dragProps('taxNumber')}
      />
    ),
    exemptionDate: (
      <SortableResizableTh
        key="exemptionDate"
        label="Freistellungsdatum"
        active={sortBy === 'exemptionDate'}
        direction={sortDirection}
        onSort={() => handleSort('exemptionDate')}
        sortTitle="Nach Freistellungsdatum sortieren"
        colKey="exemptionDate"
        width={colWidths.exemptionDate}
        onResizeStart={startResize('exemptionDate')}
        onAutoFit={() => autoFit('exemptionDate')}
        headerBg="bg-slate-50/80"
        {...dragProps('exemptionDate')}
      />
    ),
    assessmentPeriod: (
      <SortableResizableTh
        key="assessmentPeriod"
        label="Veranlagungszeitraum"
        active={sortBy === 'assessmentPeriod'}
        direction={sortDirection}
        onSort={() => handleSort('assessmentPeriod')}
        sortTitle="Nach Veranlagungszeitraum sortieren"
        colKey="assessmentPeriod"
        width={colWidths.assessmentPeriod}
        onResizeStart={startResize('assessmentPeriod')}
        onAutoFit={() => autoFit('assessmentPeriod')}
        headerBg="bg-slate-50/80"
        {...dragProps('assessmentPeriod')}
      />
    ),
    isDirectlyPromoted: (
      <SortableResizableTh
        key="isDirectlyPromoted"
        label="Unmittelbar gefördert"
        align="center"
        active={sortBy === 'isDirectlyPromoted'}
        direction={sortDirection}
        onSort={() => handleSort('isDirectlyPromoted')}
        sortTitle="Nach unmittelbarer Förderung sortieren"
        colKey="isDirectlyPromoted"
        width={colWidths.isDirectlyPromoted}
        onResizeStart={startResize('isDirectlyPromoted')}
        onAutoFit={() => autoFit('isDirectlyPromoted')}
        headerBg="bg-slate-50/80"
        {...dragProps('isDirectlyPromoted')}
      />
    ),
    issuedBy: (
      <SortableResizableTh
        key="issuedBy"
        label="Ausgestellt von"
        active={sortBy === 'issuedBy'}
        direction={sortDirection}
        onSort={() => handleSort('issuedBy')}
        sortTitle="Nach Aussteller sortieren"
        colKey="issuedBy"
        width={colWidths.issuedBy}
        onResizeStart={startResize('issuedBy')}
        onAutoFit={() => autoFit('issuedBy')}
        headerBg="bg-slate-50/80"
        {...dragProps('issuedBy')}
      />
    ),
    goodsInfo: (
      <SortableResizableTh
        key="goodsInfo"
        label="Herkunft & Bewertungsgrundlage"
        active={sortBy === 'goodsInfo'}
        direction={sortDirection}
        onSort={() => handleSort('goodsInfo')}
        sortTitle="Nach Herkunft der Sachspende sortieren"
        colKey="goodsInfo"
        width={colWidths.goodsInfo}
        onResizeStart={startResize('goodsInfo')}
        onAutoFit={() => autoFit('goodsInfo')}
        headerBg="bg-slate-50/80"
        {...dragProps('goodsInfo')}
      />
    )
  };

  // Extract years
  const years = Array.from(
    new Set(donations.map(d => (d.date ? d.date.substring(0, 4) : '2025')))
  ).sort().reverse();
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Filtered & sorted donations
  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      // Year filter
      if (selectedYear !== 'all') {
        if (!d.date || !d.date.startsWith(selectedYear)) return false;
      }
      // Type filter
      if (selectedType !== 'all') {
        if (d.type !== selectedType) return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = d.donorName.toLowerCase().includes(q);
        const matchNum = d.receiptNumber.toLowerCase().includes(q);
        const matchCity = d.donorAddress?.city?.toLowerCase().includes(q);
        const matchNotes = d.notes?.toLowerCase().includes(q);
        const matchGoods = d.goodsDescription?.toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchCity && !matchNotes && !matchGoods) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      } else if (sortBy === 'donor') {
        comparison = (a.donorName || '').localeCompare(b.donorName || '', 'de');
      } else if (sortBy === 'type') {
        comparison = DONATION_TYPE_SORT_ORDER[a.type] - DONATION_TYPE_SORT_ORDER[b.type];
      } else if (sortBy === 'purpose') {
        const purposeA = a.type === 'goods' ? a.goodsDescription || '' : a.notes || a.promotedPurpose || '';
        const purposeB = b.type === 'goods' ? b.goodsDescription || '' : b.notes || b.promotedPurpose || '';
        comparison = purposeA.localeCompare(purposeB, 'de');
      } else if (sortBy === 'amount') {
        comparison = (a.amount || 0) - (b.amount || 0);
      } else if (sortBy === 'taxOffice') {
        comparison = (a.taxOffice || '').localeCompare(b.taxOffice || '', 'de');
      } else if (sortBy === 'taxNumber') {
        comparison = (a.taxNumber || '').localeCompare(b.taxNumber || '', 'de');
      } else if (sortBy === 'exemptionDate') {
        comparison = new Date(a.exemptionDate || 0).getTime() - new Date(b.exemptionDate || 0).getTime();
      } else if (sortBy === 'assessmentPeriod') {
        comparison = (a.assessmentPeriod || '').localeCompare(b.assessmentPeriod || '', 'de');
      } else if (sortBy === 'isDirectlyPromoted') {
        comparison = Number(a.isDirectlyPromoted) - Number(b.isDirectlyPromoted);
      } else if (sortBy === 'issuedBy') {
        comparison = (a.issuedBy || '').localeCompare(b.issuedBy || '', 'de');
      } else if (sortBy === 'goodsInfo') {
        const goodsA = (a.goodsOrigin || '') + (a.goodsValuationBasis || '');
        const goodsB = (b.goodsOrigin || '') + (b.goodsValuationBasis || '');
        comparison = goodsA.localeCompare(goodsB, 'de');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [donations, selectedYear, selectedType, searchTerm, sortBy, sortDirection]);

  // Seitenweise Darstellung und Auswahl (Kästchen = aktuelle Seite).
  const {
    pageItems: paginatedDonations,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
  } = usePagination(filteredDonations, [selectedYear, selectedType, searchTerm, sortBy, sortDirection].join('|'));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { seiteKomplett, seiteTeilweise, allesKomplett } = ermittleSeitenStatus(selectedIds, paginatedDonations, filteredDonations);
  const handleSelectPage = () => setSelectedIds(prev => wechsleSeite(prev, paginatedDonations));
  const handleSelectAllFiltered = () => setSelectedIds(prev => waehleAlleGefilterten(prev, filteredDonations));
  const handleClearSelection = () => setSelectedIds(new Set());
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calculate statistics
  const totalAmount = filteredDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const moneyDonations = filteredDonations.filter(d => d.type === 'money');
  const moneyTotal = moneyDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const goodsDonations = filteredDonations.filter(d => d.type === 'goods');
  const goodsTotal = goodsDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const waiverCount = filteredDonations.filter(d => d.isWaiverOfRefund).length;

  const handleDownload = (receipt: DonationReceipt) => {
    downloadDonationReceiptPdf(receipt, settings);
  };

  const handleViewDoc = (receipt: DonationReceipt) => {
    if (onViewDocument && receipt.documentId) {
      const foundDoc = documents.find(doc => doc.id === receipt.documentId);
      if (foundDoc) {
        onViewDocument(foundDoc);
        return;
      }
    }
    // Fallback: direct download
    handleDownload(receipt);
  };

  return (
    <div className="space-y-6">

      {/* Top Banner / Header */}
      <div className="bg-white rounded-2xl p-6 text-slate-900 border border-slate-200 shadow-2xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Amtliche Spendenverwaltung (BMF-Muster)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Geld- & Sachzuwendungen
            </h1>
            <p className="text-slate-500 text-xs mt-1 max-w-2xl">
              Erstellung, Verwaltung und revisionssichere Archivierung rechtskonformer Zuwendungsbestätigungen nach den amtlichen Mustern des Bundesministeriums der Finanzen (§ 50 Abs. 1 EStDV).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-2xs flex items-center gap-2 text-xs cursor-pointer"
              title="Neue Zuwendungsbestätigung ausstellen"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Zuwendungsbestätigung</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gesamtes Spendenvolumen</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {totalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {filteredDonations.length} Bestätigung{filteredDonations.length === 1 ? '' : 'en'} gesamt
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Geldzuwendungen (Muster 1)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700">
            {moneyTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {moneyDonations.length} Geldspende{moneyDonations.length === 1 ? '' : 'n'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sachzuwendungen (Muster 2)</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-700">
            {goodsTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {goodsDonations.length} Sachspende{goodsDonations.length === 1 ? '' : 'n'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Aufwandsspenden</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {waiverCount}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            Verzicht auf Erstattung
          </div>
        </div>
      </div>

      {/* Main List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Spender, Beleg-Nr., Zweck suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Type selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedType === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alle ({donations.length})
              </button>
              <button
                onClick={() => setSelectedType('money')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  selectedType === 'money'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3 h-3" />
                Geld ({donations.filter(d => d.type === 'money').length})
              </button>
              <button
                onClick={() => setSelectedType('goods')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  selectedType === 'goods'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3 h-3" />
                Sachspenden ({donations.filter(d => d.type === 'goods').length})
              </button>
            </div>

            {/* Year filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 focus:ring-0 p-0 pr-2"
              >
                <option value="all">Alle Jahre</option>
                {years.map(y => (
                  <option key={y} value={y}>Jahr {y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-2xs text-slate-500">
            Zeige <span className="font-bold text-slate-800">{filteredDonations.length}</span> von {donations.length} Bescheinigungen
          </div>
        </div>

        <AuswahlLeiste
          anzahlAusgewaehlt={selectedIds.size}
          anzahlAufSeite={paginatedDonations.length}
          anzahlGefiltert={filteredDonations.length}
          seiteKomplett={seiteKomplett}
          allesKomplett={allesKomplett}
          einzahl="Bescheinigung"
          mehrzahl="Bescheinigungen"
          onAlleAuswaehlen={handleSelectAllFiltered}
          onAuswahlAufheben={handleClearSelection}
        />

        {/* Table */}
        {filteredDonations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Keine Zuwendungsbestätigungen gefunden</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Für die gewählten Filter liegen noch keine Spendenbescheinigungen vor. Erstellen Sie eine neue Bestätigung mit dem BMF-Muster.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
              title="Neue Zuwendungsbestätigung ausstellen"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Zuwendungsbestätigung anlegen</span>
            </button>
          </div>
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            {/* Eigener, nach oben begrenzter Scroll-Bereich (Breite UND
                Höhe) — der seitliche Scrollbalken sitzt dadurch immer direkt
                unter den Zeilen, auch bei langen Seiten (siehe ausführlicher
                Kommentar in MembersView.tsx bzw. in App.tsx, warum der
                vorherige Versuch nicht funktioniert hat). */}
            <table
              ref={tableRef}
              className="text-left border-collapse text-xs"
              style={{
                tableLayout: 'fixed',
                width: CHECKBOX_COL_WIDTH + ACTION_COL_WIDTH + visibleColumnOrder.reduce((sum, key) => sum + (colWidths[key] || 0), 0)
              }}
            >
              {/* <colgroup> statt Breiten nur an den <th>-Elementen — macht
                  die Spaltenbreite unabhängig vom Tabellenkopf, damit sie
                  sich beim Ziehen auch in den Zeilen darunter ändert (siehe
                  ausführlicher Kommentar in MembersView.tsx, wo dasselbe
                  Problem in Firefox auftrat). Die erste Spalte
                  enthält die Auswahlkästchen. */}
              <colgroup>
                <col style={{ width: CHECKBOX_COL_WIDTH }} />
                {visibleColumnOrder.map(key => (
                  <col key={key} style={{ width: colWidths[key] || 0 }} />
                ))}
                <col style={{ width: ACTION_COL_WIDTH }} />
              </colgroup>
              <thead>
                <tr className="text-slate-600 font-semibold text-2xs uppercase tracking-wider">
                  <th
                    style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH }}
                    className="py-3 px-3 text-center sticky top-0 z-10 bg-slate-50/80 border-b border-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={seiteKomplett}
                      ref={input => {
                        if (input) input.indeterminate = seiteTeilweise;
                      }}
                      onChange={handleSelectPage}
                      aria-label="Alle Einträge dieser Seite auswählen"
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                  </th>
                  {visibleColumnOrder.map(key => donationHeaderDefs[key])}
                  <th
                    style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                    className="py-3 px-4 text-right sticky top-0 z-10 bg-slate-50/80 border-b border-slate-200"
                  >
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDonations.map(receipt => {
                  const isGoods = receipt.type === 'goods';

                  return (
                    <tr
                      key={receipt.id}
                      className={`transition-colors group ${
                        selectedIds.has(receipt.id) ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(receipt.id)}
                          onChange={() => handleToggleSelect(receipt.id)}
                          aria-label={`Zuwendungsbestätigung ${receipt.receiptNumber} auswählen`}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      {(() => {
                        const donationCellDefs: Record<string, React.ReactNode> = {
                          date: (
                            <td key="date" data-col-content="date" className="py-3 px-4 overflow-hidden">
                              <div className="font-mono font-bold text-slate-900">
                                {receipt.receiptNumber}
                              </div>
                              <div className="text-2xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{new Date(receipt.date).toLocaleDateString('de-DE')}</span>
                              </div>
                            </td>
                          ),
                          donor: (
                            <td key="donor" data-col-content="donor" className="py-3 px-4 overflow-hidden">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {receipt.donorType === 'member' ? (
                                  <span className="p-0.5 bg-emerald-100 text-emerald-800 rounded text-3xs font-semibold px-1">Mitglied</span>
                                ) : (
                                  <span className="p-0.5 bg-slate-100 text-slate-700 rounded text-3xs font-semibold px-1">Extern</span>
                                )}
                                <span>{receipt.donorName}</span>
                              </div>
                              <div className="text-2xs text-slate-500 mt-0.5">
                                {receipt.donorAddress.street} {receipt.donorAddress.houseNumber}, {receipt.donorAddress.zip} {receipt.donorAddress.city}
                              </div>
                            </td>
                          ),
                          type: (
                            <td key="type" data-col-content="type" className="py-3 px-4 overflow-hidden">
                              {isGoods ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Package className="w-3 h-3" />
                                  Sachspende (Muster 2)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Coins className="w-3 h-3" />
                                  Geldspende (Muster 1)
                                </span>
                              )}
                              {receipt.isWaiverOfRefund && (
                                <div className="mt-1 text-3xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                  Aufwandsspende
                                </div>
                              )}
                            </td>
                          ),
                          purpose: (
                            <td key="purpose" data-col-content="purpose" className="py-3 px-4 overflow-hidden">
                              {isGoods ? (
                                <div className="text-slate-800 font-medium truncate" title={receipt.goodsDescription}>
                                  {receipt.goodsDescription || 'Sachzuwendung'}
                                </div>
                              ) : (
                                <div className="text-slate-800 font-medium truncate" title={receipt.notes || receipt.promotedPurpose}>
                                  {receipt.notes || receipt.promotedPurpose || 'Förderung des Sports'}
                                </div>
                              )}
                              <div className="text-3xs text-slate-400 font-mono mt-0.5 truncate">
                                {receipt.amountInWords}
                              </div>
                            </td>
                          ),
                          amount: (
                            <td key="amount" data-col-content="amount" className="py-3 px-4 text-right overflow-hidden">
                              <div className="font-mono font-bold text-sm text-slate-900">
                                {receipt.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </div>
                              {receipt.transactionId && (
                                <div className="text-3xs text-emerald-600 font-semibold flex items-center justify-end gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Verbucht
                                </div>
                              )}
                            </td>
                          ),
                          status: (() => {
                            // "BMF-Archiviert" wurde früher immer angezeigt, egal ob
                            // tatsächlich ein PDF hinterlegt war (das hatte AI Studio
                            // seinerzeit fest eingebaut). Jetzt: nur noch "Archiviert",
                            // und nur, wenn receipt.documentId wirklich auf ein noch
                            // vorhandenes Dokument zeigt — derselbe Abgleich wie in
                            // handleViewDoc oben, damit beide Stellen übereinstimmen.
                            const hasArchivedPdf =
                              !!receipt.documentId && documents.some(doc => doc.id === receipt.documentId);
                            return (
                              <td key="status" data-col-content="status" className="py-3 px-4 text-center overflow-hidden">
                                {hasArchivedPdf ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-3xs font-semibold rounded-full border border-emerald-200">
                                    <FileCheck className="w-3 h-3 text-emerald-600" />
                                    Archiviert
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-2xs">–</span>
                                )}
                              </td>
                            );
                          })(),
                          taxOffice: (
                            <td key="taxOffice" data-col-content="taxOffice" className="py-3 px-4 text-slate-600 truncate overflow-hidden">
                              {receipt.taxOffice || '–'}
                            </td>
                          ),
                          taxNumber: (
                            <td key="taxNumber" data-col-content="taxNumber" className="py-3 px-4 text-slate-600 font-mono text-2xs truncate overflow-hidden">
                              {receipt.taxNumber || '–'}
                            </td>
                          ),
                          exemptionDate: (
                            <td key="exemptionDate" data-col-content="exemptionDate" className="py-3 px-4 text-slate-600 overflow-hidden">
                              {receipt.exemptionDate ? new Date(receipt.exemptionDate).toLocaleDateString('de-DE') : '–'}
                            </td>
                          ),
                          assessmentPeriod: (
                            <td key="assessmentPeriod" data-col-content="assessmentPeriod" className="py-3 px-4 text-slate-600 truncate overflow-hidden">
                              {receipt.assessmentPeriod || '–'}
                            </td>
                          ),
                          isDirectlyPromoted: (
                            <td key="isDirectlyPromoted" data-col-content="isDirectlyPromoted" className="py-3 px-4 text-center overflow-hidden">
                              {receipt.isDirectlyPromoted ? (
                                <span className="text-emerald-700 text-2xs font-semibold">Ja</span>
                              ) : (
                                <span className="text-slate-400 text-2xs">Nein</span>
                              )}
                            </td>
                          ),
                          issuedBy: (
                            <td key="issuedBy" data-col-content="issuedBy" className="py-3 px-4 text-slate-600 truncate overflow-hidden">
                              {receipt.issuedBy || '–'}
                            </td>
                          ),
                          goodsInfo: (
                            <td key="goodsInfo" data-col-content="goodsInfo" className="py-3 px-4 text-slate-600 overflow-hidden">
                              {isGoods && (receipt.goodsOrigin || receipt.goodsValuationBasis) ? (
                                <>
                                  {receipt.goodsOrigin && (
                                    <div className="text-2xs">
                                      {receipt.goodsOrigin === 'business' ? 'Betriebsvermögen' : 'Privatvermögen'}
                                    </div>
                                  )}
                                  {receipt.goodsValuationBasis && (
                                    <div className="text-3xs text-slate-400 truncate" title={receipt.goodsValuationBasis}>
                                      {receipt.goodsValuationBasis}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-300">–</span>
                              )}
                            </td>
                          )
                        };
                        return visibleColumnOrder.map(key => donationCellDefs[key]);
                      })()}

                      {/* Aktionen */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownload(receipt)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                            title="BMF Zuwendungsbestätigung als PDF herunterladen"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* View in Document Viewer */}
                          {onViewDocument && (
                            <button
                              type="button"
                              onClick={() => handleViewDoc(receipt)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="In Dokumentenablage ansehen"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onEditReceipt(receipt)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Möchten Sie die Zuwendungsbestätigung ${receipt.receiptNumber} wirklich löschen?`)) {
                                onDeleteReceipt(receipt.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredDonations.length > 0 && (
          <TablePagination
            totalItems={filteredDonations.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemName="Bescheinigungen"
          />
        )}
        {columnMenuPos && (
          <ColumnVisibilityMenu
            position={columnMenuPos}
            columns={columnOrder.map(key => ({ key, label: DONATION_COLUMN_LABELS[key] || key }))}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            onClose={() => setColumnMenuPos(null)}
          />
        )}
      </div>

      {/* Legal Information Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>Wichtige steuerliche Hinweise zu Zuwendungsbestätigungen</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-2xs leading-relaxed text-slate-600">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">§ 10b EStG Vereinfachter Spendennachweis</span>
            Für Spenden bis einschließlich <span className="font-bold">300,00 €</span> genügt dem Finanzamt in der Regel ein vereinfachter Nachweis (Kontoauszug oder Buchungsbestätigung) zusammen mit dem Freistellungsbescheid des Vereins. Dennoch kann auf Wunsch eine Bestätigung ausgestellt werden.
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Aufwandsspenden (§ 10b Abs. 3 EStG)</span>
            Wird auf den Ersatz von Aufwendungen (z.B. Fahrtkosten, Schiedsrichterauslagen) verzichtet, muss ein zuvor schriftlich vereinbarter Rechtsanspruch bestanden haben. Dies wird auf der Bestätigung separat angekreuzt.
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Revisionssichere Archivierung</span>
            Alle erstellten Bestätigungen werden automatisch im PDF-Format im Ordner <span className="font-bold">Dokumente & Belege</span> hinterlegt und können für die Betriebsprüfung oder EÜR jederzeit nachgewiesen werden.
          </div>
        </div>
      </div>
    </div>
  );
};
