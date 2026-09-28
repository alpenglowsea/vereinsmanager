import React, { useState, useMemo, useRef } from 'react';
import {
  ClubInvoice,
  InvoiceStatus,
  TaxSphere,
  ClubSettings,
  InvoiceTemplateSettings
} from '../types';
import { formatCurrency, generateInvoicePdf } from '../services/invoicePdfService';
import { SortableResizableTh } from './SortableResizableTh';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { useResizableColumns, ColumnWidths } from '../hooks/useResizableColumns';
import { useSortableColumns } from '../hooks/useSortableColumns';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import {
  Search,
  Plus,
  Download,
  Trash2,
  Edit2,
  Eye,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  Sliders,
  X,
  Sparkles,
  Lock
} from 'lucide-react';
import { lockClass, lockTitle } from '../utils/uiLock';

type InvoiceSortField =
  | 'status'
  | 'date'
  | 'recipient'
  | 'subject'
  | 'sphere'
  | 'dueDate'
  | 'amount'
  | 'deliveryDate'
  | 'paymentTermsDays'
  | 'paidAt'
  | 'paymentMethod'
  | 'totalVat'
  | 'notes'
  | 'recipientContact';

// Beschriftungen der Zahlungsart — dieselben deutschen Begriffe wie an den
// anderen Stellen der App (siehe services/storage.ts), nur "exempt" heißt
// hier "Befreit" statt "Beitragsfrei" — das Wort "Beitrag" passt nur bei
// Mitgliedsbeiträgen, nicht bei einer Rechnung.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  sepa: 'SEPA-Lastschrift',
  transfer: 'Überweisung',
  cash: 'Bargeld',
  standing_order: 'Dauerauftrag',
  exempt: 'Befreit'
};

// Reihenfolge, in der Status bzw. Steuer-Sphäre als "sortiert" gelten —
// eine alphabetische Sortierung wäre hier (anders als bei Text- oder
// Zahlenspalten) nicht sinnvoll ablesbar. "overdue" kommt im Typ InvoiceStatus
// vor, wird von dieser Ansicht aber nie als gespeicherter Status vergeben —
// sie berechnet "überfällig" live aus offen + Fälligkeitsdatum (siehe
// renderStatusBadge). Trotzdem muss die Zuordnung hier vollständig sein,
// sonst meckert TypeScript (Record<InvoiceStatus, number> verlangt alle
// fünf Werte) — daher hier mit aufgenommen, eingeordnet zwischen "offen"
// und "bezahlt".
const STATUS_SORT_ORDER: Record<InvoiceStatus, number> = { draft: 0, open: 1, overdue: 2, paid: 3, cancelled: 4 };
const SPHERE_SORT_ORDER: Record<TaxSphere, number> = { ideell: 0, vermoegen: 1, zweckbetrieb: 2, wirtschaftlich: 3 };

// Feste Breiten für Auswahl-Kästchen- und Aktionsspalte. Die übrigen
// Breiten sind nur ein sinnvoller Startwert; nach dem ersten Ziehen bzw.
// Doppelklick merkt sich der Browser die eigene Wahl (siehe
// useResizableColumns).
const CHECKBOX_COL_WIDTH = 40;
const ACTION_COL_WIDTH = 150;
const DEFAULT_INVOICE_COLUMN_WIDTHS: ColumnWidths = {
  status: 110,
  date: 140,
  recipient: 220,
  subject: 220,
  sphere: 140,
  dueDate: 120,
  amount: 130,
  deliveryDate: 140,
  paymentTermsDays: 110,
  paidAt: 120,
  paymentMethod: 150,
  totalVat: 110,
  notes: 200,
  recipientContact: 200
};
const INVOICE_COLUMN_KEYS = Object.keys(DEFAULT_INVOICE_COLUMN_WIDTHS);

// Alle neuen Spalten sind Teil der allgemeinen Erweiterung ("alles neu
// anbieten") ohne besondere Vorgabe zur Standard-Sichtbarkeit — sie starten
// deshalb wie bei den Mitgliedern ausgeblendet (siehe useColumnVisibility).
const INVOICE_DEFAULT_HIDDEN_COLUMNS = [
  'deliveryDate',
  'paymentTermsDays',
  'paidAt',
  'paymentMethod',
  'totalVat',
  'notes',
  'recipientContact'
];

// Beschriftungen für das Ein-/Ausblenden-Menü.
const INVOICE_COLUMN_LABELS: Record<string, string> = {
  status: 'Status',
  date: 'Nr. & Datum',
  recipient: 'Empfänger',
  subject: 'Betreff / Verwendung',
  sphere: 'Sphäre',
  dueDate: 'Fälligkeit',
  amount: 'Betrag (Brutto)',
  deliveryDate: 'Liefer-/Leistungsdatum',
  paymentTermsDays: 'Zahlungsziel',
  paidAt: 'Bezahlt am',
  paymentMethod: 'Zahlungsart',
  totalVat: 'Gesamt-USt',
  notes: 'Notizen',
  recipientContact: 'Empfänger-E-Mail/Telefon'
};

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
  /** Darf der Benutzer hier etwas ändern? Fehlt die Angabe, gilt ja. */
  canEdit?: boolean;
  /** Wird gerufen, wenn jemand einen gesperrten Knopf betätigt. */
  onLocked?: () => void;
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
  canEdit = true,
  onLocked
}) => {
  /**
   * Klick auf einen ändernden Knopf. Ohne Schreibrecht wird nicht die
   * Aktion ausgeführt, sondern der Hinweis gezeigt.
   */
  const guard = (action: () => void) => () => {
    if (canEdit) action();
    else if (onLocked) onLocked();
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus | 'overdue'>('all');
  const [taxSphereFilter, setTaxSphereFilter] = useState<'all' | TaxSphere>('all');
  const { sortBy, sortDirection, handleSort } = useSortableColumns<InvoiceSortField>('date', 'desc'); // neueste zuerst

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Ziehbare, gespeicherte Spaltenbreiten der Tabelle (siehe useResizableColumns).
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths: colWidths, startResize, autoFit } = useResizableColumns(
    'vereinsmanager:colwidths:invoices',
    DEFAULT_INVOICE_COLUMN_WIDTHS,
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
  } = useColumnOrder('vereinsmanager:colorder:invoices', INVOICE_COLUMN_KEYS);

  // Ein-/Ausblenden einzelner Spalten (unabhängig von Reihenfolge & Breite),
  // bedienbar per Rechtsklick auf einen beliebigen Spaltenkopf.
  const { hidden: hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    'vereinsmanager:colhidden:invoices',
    INVOICE_COLUMN_KEYS,
    INVOICE_DEFAULT_HIDDEN_COLUMNS
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
  const invoiceHeaderDefs: Record<string, React.ReactNode> = {
    status: (
      <SortableResizableTh
        key="status"
        label="Status"
        active={sortBy === 'status'}
        direction={sortDirection}
        onSort={() => handleSort('status')}
        sortTitle="Nach Status sortieren"
        colKey="status"
        width={colWidths.status}
        onResizeStart={startResize('status')}
        onAutoFit={() => autoFit('status')}
        headerBg="bg-slate-100"
        {...dragProps('status')}
      />
    ),
    date: (
      <SortableResizableTh
        key="date"
        label="Nr. & Datum"
        active={sortBy === 'date'}
        direction={sortDirection}
        onSort={() => handleSort('date')}
        sortTitle="Nach Rechnungsdatum sortieren"
        colKey="date"
        width={colWidths.date}
        onResizeStart={startResize('date')}
        onAutoFit={() => autoFit('date')}
        headerBg="bg-slate-100"
        {...dragProps('date')}
      />
    ),
    recipient: (
      <SortableResizableTh
        key="recipient"
        label="Empfänger"
        active={sortBy === 'recipient'}
        direction={sortDirection}
        onSort={() => handleSort('recipient')}
        sortTitle="Nach Empfänger sortieren"
        colKey="recipient"
        width={colWidths.recipient}
        onResizeStart={startResize('recipient')}
        onAutoFit={() => autoFit('recipient')}
        headerBg="bg-slate-100"
        {...dragProps('recipient')}
      />
    ),
    subject: (
      <SortableResizableTh
        key="subject"
        label="Betreff / Verwendung"
        active={sortBy === 'subject'}
        direction={sortDirection}
        onSort={() => handleSort('subject')}
        sortTitle="Nach Betreff sortieren"
        colKey="subject"
        width={colWidths.subject}
        onResizeStart={startResize('subject')}
        onAutoFit={() => autoFit('subject')}
        headerBg="bg-slate-100"
        {...dragProps('subject')}
      />
    ),
    sphere: (
      <SortableResizableTh
        key="sphere"
        label="Sphäre"
        active={sortBy === 'sphere'}
        direction={sortDirection}
        onSort={() => handleSort('sphere')}
        sortTitle="Nach Steuer-Sphäre sortieren"
        colKey="sphere"
        width={colWidths.sphere}
        onResizeStart={startResize('sphere')}
        onAutoFit={() => autoFit('sphere')}
        headerBg="bg-slate-100"
        {...dragProps('sphere')}
      />
    ),
    dueDate: (
      <SortableResizableTh
        key="dueDate"
        label="Fälligkeit"
        active={sortBy === 'dueDate'}
        direction={sortDirection}
        onSort={() => handleSort('dueDate')}
        sortTitle="Nach Fälligkeit sortieren"
        colKey="dueDate"
        width={colWidths.dueDate}
        onResizeStart={startResize('dueDate')}
        onAutoFit={() => autoFit('dueDate')}
        headerBg="bg-slate-100"
        {...dragProps('dueDate')}
      />
    ),
    amount: (
      <SortableResizableTh
        key="amount"
        label="Betrag (Brutto)"
        align="right"
        active={sortBy === 'amount'}
        direction={sortDirection}
        onSort={() => handleSort('amount')}
        sortTitle="Nach Bruttobetrag sortieren"
        colKey="amount"
        width={colWidths.amount}
        onResizeStart={startResize('amount')}
        onAutoFit={() => autoFit('amount')}
        headerBg="bg-slate-100"
        {...dragProps('amount')}
      />
    ),
    deliveryDate: (
      <SortableResizableTh
        key="deliveryDate"
        label="Liefer-/Leistungsdatum"
        active={sortBy === 'deliveryDate'}
        direction={sortDirection}
        onSort={() => handleSort('deliveryDate')}
        sortTitle="Nach Liefer-/Leistungsdatum sortieren"
        colKey="deliveryDate"
        width={colWidths.deliveryDate}
        onResizeStart={startResize('deliveryDate')}
        onAutoFit={() => autoFit('deliveryDate')}
        headerBg="bg-slate-100"
        {...dragProps('deliveryDate')}
      />
    ),
    paymentTermsDays: (
      <SortableResizableTh
        key="paymentTermsDays"
        label="Zahlungsziel"
        align="right"
        active={sortBy === 'paymentTermsDays'}
        direction={sortDirection}
        onSort={() => handleSort('paymentTermsDays')}
        sortTitle="Nach Zahlungsziel sortieren"
        colKey="paymentTermsDays"
        width={colWidths.paymentTermsDays}
        onResizeStart={startResize('paymentTermsDays')}
        onAutoFit={() => autoFit('paymentTermsDays')}
        headerBg="bg-slate-100"
        {...dragProps('paymentTermsDays')}
      />
    ),
    paidAt: (
      <SortableResizableTh
        key="paidAt"
        label="Bezahlt am"
        active={sortBy === 'paidAt'}
        direction={sortDirection}
        onSort={() => handleSort('paidAt')}
        sortTitle="Nach Bezahldatum sortieren"
        colKey="paidAt"
        width={colWidths.paidAt}
        onResizeStart={startResize('paidAt')}
        onAutoFit={() => autoFit('paidAt')}
        headerBg="bg-slate-100"
        {...dragProps('paidAt')}
      />
    ),
    paymentMethod: (
      <SortableResizableTh
        key="paymentMethod"
        label="Zahlungsart"
        active={sortBy === 'paymentMethod'}
        direction={sortDirection}
        onSort={() => handleSort('paymentMethod')}
        sortTitle="Nach Zahlungsart sortieren"
        colKey="paymentMethod"
        width={colWidths.paymentMethod}
        onResizeStart={startResize('paymentMethod')}
        onAutoFit={() => autoFit('paymentMethod')}
        headerBg="bg-slate-100"
        {...dragProps('paymentMethod')}
      />
    ),
    totalVat: (
      <SortableResizableTh
        key="totalVat"
        label="Gesamt-USt"
        align="right"
        active={sortBy === 'totalVat'}
        direction={sortDirection}
        onSort={() => handleSort('totalVat')}
        sortTitle="Nach Gesamt-USt sortieren"
        colKey="totalVat"
        width={colWidths.totalVat}
        onResizeStart={startResize('totalVat')}
        onAutoFit={() => autoFit('totalVat')}
        headerBg="bg-slate-100"
        {...dragProps('totalVat')}
      />
    ),
    notes: (
      <SortableResizableTh
        key="notes"
        label="Notizen"
        active={sortBy === 'notes'}
        direction={sortDirection}
        onSort={() => handleSort('notes')}
        sortTitle="Nach Notizen sortieren"
        colKey="notes"
        width={colWidths.notes}
        onResizeStart={startResize('notes')}
        onAutoFit={() => autoFit('notes')}
        headerBg="bg-slate-100"
        {...dragProps('notes')}
      />
    ),
    recipientContact: (
      <SortableResizableTh
        key="recipientContact"
        label="Empfänger-E-Mail/Telefon"
        active={sortBy === 'recipientContact'}
        direction={sortDirection}
        onSort={() => handleSort('recipientContact')}
        sortTitle="Nach Empfänger-E-Mail/Telefon sortieren"
        colKey="recipientContact"
        width={colWidths.recipientContact}
        onResizeStart={startResize('recipientContact')}
        onAutoFit={() => autoFit('recipientContact')}
        headerBg="bg-slate-100"
        {...dragProps('recipientContact')}
      />
    )
  };

  // Quick stats calculation
  const totalCount = invoices.length;
  const totalSumGross = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  const openInvoices = invoices.filter(i => i.status === 'open');
  const openSumGross = openInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const paidSumGross = paidInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  // Ein fester Zeitpunkt für den gesamten Besuch dieser Ansicht, statt bei
  // jedem Zeichnen ein neuer. Zwei Gründe: Die Liste unten rechnet in einem
  // useMemo damit, und ein bei jedem Rendern frisch erzeugtes Datum wäre
  // jedes Mal ein anderer Wert — die Berechnung liefe dann immer neu und das
  // useMemo wäre wirkungslos. Ausserdem sähen die Kennzahlen oben und die
  // Kennzeichnung "überfällig" in der Liste sonst unter Umständen
  // unterschiedliche Zeitpunkte. Wer die Ansicht über Mitternacht hinaus
  // offen lässt, muss sie einmal neu laden — das ist der Preis dafür.
  const now = useMemo(() => new Date(), []);
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
      } else if (sortBy === 'recipient') {
        comparison = (a.recipientName || '').localeCompare(b.recipientName || '', 'de');
      } else if (sortBy === 'subject') {
        comparison = (a.subject || '').localeCompare(b.subject || '', 'de');
      } else if (sortBy === 'status') {
        comparison = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
      } else if (sortBy === 'sphere') {
        comparison = SPHERE_SORT_ORDER[a.taxSphere] - SPHERE_SORT_ORDER[b.taxSphere];
      } else if (sortBy === 'amount') {
        comparison = (a.totalAmount || 0) - (b.totalAmount || 0);
      } else if (sortBy === 'deliveryDate') {
        comparison = new Date(a.deliveryDate || 0).getTime() - new Date(b.deliveryDate || 0).getTime();
      } else if (sortBy === 'paymentTermsDays') {
        comparison = (a.paymentTermsDays || 0) - (b.paymentTermsDays || 0);
      } else if (sortBy === 'paidAt') {
        comparison = new Date(a.paidAt || 0).getTime() - new Date(b.paidAt || 0).getTime();
      } else if (sortBy === 'paymentMethod') {
        comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '', 'de');
      } else if (sortBy === 'totalVat') {
        comparison = (a.totalVat || 0) - (b.totalVat || 0);
      } else if (sortBy === 'notes') {
        comparison = (a.notes || '').localeCompare(b.notes || '', 'de');
      } else if (sortBy === 'recipientContact') {
        comparison = (a.recipientEmail || a.recipientPhone || '').localeCompare(
          b.recipientEmail || b.recipientPhone || '',
          'de'
        );
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [invoices, searchQuery, statusFilter, taxSphereFilter, sortBy, sortDirection, now]);

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
    if (!canEdit) { if (onLocked) onLocked(); return; }
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
      {/* Hinweis auf reines Leserecht */}
      {!canEdit && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-snug">
            <strong>Nur Leserecht.</strong> Sie können Rechnungen einsehen, als PDF herunterladen und exportieren. Erstellen, Ändern und Löschen sind für Ihre Rolle gesperrt — die betreffenden Knöpfe sind ausgegraut.
          </p>
        </div>
      )}

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
                className={`bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer${lockClass(canEdit)}`}
                title={lockTitle(canEdit, 'Alle markierten Rechnungen löschen')}
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
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
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
              onClick={guard(onOpenTemplateConfig)}
              className={`text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Eigenes Vereins-Briefpapier (Blanko-Vorlage) hochladen oder DIN 5008 Vorlage anpassen')}
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
              onClick={guard(onOpenCreate)}
              className={`bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Neue Rechnung anlegen')}
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
        </div>

        {/* Data Table */}
        {/* Eigener, nach oben begrenzter Scroll-Bereich (Breite UND Höhe) —
            der seitliche Scrollbalken sitzt dadurch immer direkt unter den
            Zeilen, auch bei langen Seiten (siehe ausführlicher Kommentar in
            MembersView.tsx bzw. in App.tsx, warum der vorherige Versuch
            nicht funktioniert hat). */}
        <div className="overflow-auto max-h-[65vh]">
          <table
            ref={tableRef}
            className="text-xs text-left border-collapse"
            style={{
              tableLayout: 'fixed',
              width:
                CHECKBOX_COL_WIDTH +
                ACTION_COL_WIDTH +
                visibleColumnOrder.reduce((sum, key) => sum + (colWidths[key] || 0), 0)
            }}
          >
            {/* <colgroup> statt Breiten nur an den <th>-Elementen — macht
                die Spaltenbreite unabhängig vom Tabellenkopf, damit sie sich
                beim Ziehen auch in den Zeilen darunter ändert (siehe
                ausführlicher Kommentar in MembersView.tsx, wo dasselbe
                Problem in Firefox auftrat). */}
            <colgroup>
              <col style={{ width: CHECKBOX_COL_WIDTH }} />
              {visibleColumnOrder.map(key => (
                <col key={key} style={{ width: colWidths[key] || 0 }} />
              ))}
              <col style={{ width: ACTION_COL_WIDTH }} />
            </colgroup>
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th
                  style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH }}
                  className="px-3 py-3 text-center sticky top-0 z-10 bg-slate-100 border-b border-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                    onChange={handleSelectAll}
                    title="Alle auswählen"
                    className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                {visibleColumnOrder.map(key => invoiceHeaderDefs[key])}
                <th
                  style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                  className="px-3 py-3 text-right sticky top-0 z-10 bg-slate-100 border-b border-slate-200"
                >
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnOrder.length + 2} className="py-12 text-center text-slate-500">
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
                          onClick={guard(onOpenCreate)}
                          className={`mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer${lockClass(canEdit)}`}
                          title={lockTitle(canEdit, 'Neue Rechnung anlegen')}
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

                      {(() => {
                        const invoiceCellDefs: Record<string, React.ReactNode> = {
                          status: (
                            <td key="status" data-col-content="status" className="px-3 py-3 whitespace-nowrap overflow-hidden">
                              {renderStatusBadge(inv)}
                            </td>
                          ),
                          date: (
                            <td key="date" data-col-content="date" className="px-3 py-3 overflow-hidden">
                              <div className="font-mono font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {inv.invoiceNumber}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(inv.date).toLocaleDateString('de-DE')}
                              </div>
                            </td>
                          ),
                          recipient: (
                            <td key="recipient" data-col-content="recipient" className="px-4 py-3 overflow-hidden">
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
                          ),
                          subject: (
                            <td key="subject" data-col-content="subject" className="px-4 py-3 overflow-hidden">
                              <div className="font-medium text-slate-900 truncate">
                                {inv.subject}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {inv.items.length} Posten: {inv.items.map(it => it.description).join(', ')}
                              </div>
                            </td>
                          ),
                          sphere: (
                            <td key="sphere" data-col-content="sphere" className="px-3 py-3 whitespace-nowrap overflow-hidden">
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
                          ),
                          dueDate: (
                            <td key="dueDate" data-col-content="dueDate" className="px-3 py-3 whitespace-nowrap overflow-hidden">
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
                          ),
                          amount: (
                            <td key="amount" data-col-content="amount" className="px-4 py-3 text-right whitespace-nowrap overflow-hidden">
                              <div className="font-mono font-bold text-sm text-slate-900">
                                {formatCurrency(inv.totalAmount)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Netto: {formatCurrency(inv.subtotalNet)}
                              </div>
                            </td>
                          ),
                          deliveryDate: (
                            <td key="deliveryDate" data-col-content="deliveryDate" className="px-3 py-3 whitespace-nowrap overflow-hidden text-slate-600">
                              {inv.deliveryDate ? new Date(inv.deliveryDate).toLocaleDateString('de-DE') : <span className="text-slate-300">-</span>}
                            </td>
                          ),
                          paymentTermsDays: (
                            <td key="paymentTermsDays" data-col-content="paymentTermsDays" className="px-3 py-3 text-right whitespace-nowrap overflow-hidden text-slate-600 font-mono">
                              {inv.paymentTermsDays} Tage
                            </td>
                          ),
                          paidAt: (
                            <td key="paidAt" data-col-content="paidAt" className="px-3 py-3 whitespace-nowrap overflow-hidden text-slate-600">
                              {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('de-DE') : <span className="text-slate-300">-</span>}
                            </td>
                          ),
                          paymentMethod: (
                            <td key="paymentMethod" data-col-content="paymentMethod" className="px-3 py-3 whitespace-nowrap overflow-hidden text-slate-600">
                              {inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod : <span className="text-slate-300">-</span>}
                            </td>
                          ),
                          totalVat: (
                            <td key="totalVat" data-col-content="totalVat" className="px-4 py-3 text-right whitespace-nowrap overflow-hidden font-mono text-slate-600">
                              {formatCurrency(inv.totalVat)}
                            </td>
                          ),
                          notes: (
                            <td
                              key="notes"
                              data-col-content="notes"
                              className="px-4 py-3 text-slate-500 truncate overflow-hidden"
                              title={inv.notes || undefined}
                            >
                              {inv.notes || <span className="text-slate-300">-</span>}
                            </td>
                          ),
                          recipientContact: (
                            <td key="recipientContact" data-col-content="recipientContact" className="px-3 py-3 overflow-hidden">
                              <div className="space-y-0.5">
                                {inv.recipientEmail && (
                                  <a
                                    href={`mailto:${inv.recipientEmail}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-[11px] text-blue-600 hover:underline truncate block"
                                  >
                                    {inv.recipientEmail}
                                  </a>
                                )}
                                {inv.recipientPhone && (
                                  <a
                                    href={`tel:${inv.recipientPhone}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-[11px] text-slate-500 hover:text-blue-600 block"
                                  >
                                    {inv.recipientPhone}
                                  </a>
                                )}
                                {!inv.recipientEmail && !inv.recipientPhone && (
                                  <span className="text-slate-300 text-[11px]">-</span>
                                )}
                              </div>
                            </td>
                          )
                        };
                        return visibleColumnOrder.map(key => invoiceCellDefs[key]);
                      })()}

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
                            onClick={guard(() => onOpenEdit(inv))}
                            className={`p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer${lockClass(canEdit)}`}
                            title={lockTitle(canEdit, 'Rechnung bearbeiten')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={guard(() => {
                              if (window.confirm(`Rechnung ${inv.invoiceNumber} wirklich löschen?`)) {
                                onDeleteInvoice(inv.id);
                              }
                            })}
                            className={`p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer${lockClass(canEdit)}`}
                            title={lockTitle(canEdit, 'Rechnung löschen')}
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
        {columnMenuPos && (
          <ColumnVisibilityMenu
            position={columnMenuPos}
            columns={columnOrder.map(key => ({ key, label: INVOICE_COLUMN_LABELS[key] || key }))}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            onClose={() => setColumnMenuPos(null)}
          />
        )}

        {/* Table Pagination / Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 rounded-b-xl overflow-hidden">
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
