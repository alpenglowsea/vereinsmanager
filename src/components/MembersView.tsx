import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Member, ClubSettings, MemberBulkUpdates } from '../types';
import { ExportService } from '../services/exportService';
import { lockClass, lockTitle } from '../utils/uiLock';
import { MemberBulkEditModal } from './MemberBulkEditModal';
import { TablePagination, PageSizeOption } from './TablePagination';
import { SortableResizableTh } from './SortableResizableTh';
import { useResizableColumns, ColumnWidths } from '../hooks/useResizableColumns';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import {
  Search,
  Plus,
  FileDown,
  Download,
  Upload,
  Building2,
  Trash2,
  Edit2,
  CreditCard,
  CheckCircle2,
  SlidersHorizontal,
  AlertTriangle,
  Lock,
  X
} from 'lucide-react';

export type MemberSortField =
  | 'number'
  | 'name'
  | 'status'
  | 'department'
  | 'entryDate'
  | 'city'
  | 'fee'
  | 'paymentMethod'
  | 'phone'
  | 'membershipType'
  | 'gender'
  | 'birthDate'
  | 'exitDate'
  | 'notes'
  | 'dataPrivacyConsent'
  | 'street'
  | 'country'
  | 'iban'
  | 'bic'
  | 'bankName'
  | 'accountHolder'
  | 'mandateDate'
  | 'mandateReference'
  | 'monthlyDueDay';

// Feste Breiten für die Auswahl-Kästchen- und die Aktionsspalte — die
// bleiben unverändert und sind nicht Teil der ziehbaren/gespeicherten
// Spalten. Die übrigen Breiten sind nur ein sinnvoller Startwert; nach dem
// ersten Ziehen bzw. Doppelklick merkt sich der Browser die eigene Wahl.
const CHECKBOX_COL_WIDTH = 40;
const ACTION_COL_WIDTH = 130;
const DEFAULT_MEMBER_COLUMN_WIDTHS: ColumnWidths = {
  number: 90,
  name: 240,
  status: 130,
  department: 150,
  entryDate: 100,
  city: 150,
  fee: 100,
  paymentMethod: 130,
  // Neu anbietbare Spalten (Stand: Wunsch von Johannes, alle bisher nur
  // versteckt oder gar nicht angezeigten Felder). Standardmäßig
  // ausgeblendet (siehe MEMBER_DEFAULT_HIDDEN_COLUMNS weiter unten), damit
  // sich am bisherigen Erscheinungsbild nichts ändert, bis man sie über das
  // Rechtsklick-Menü selbst einblendet.
  phone: 130,
  membershipType: 150,
  gender: 100,
  birthDate: 110,
  exitDate: 110,
  notes: 200,
  dataPrivacyConsent: 110,
  street: 200,
  country: 110,
  iban: 200,
  bic: 110,
  bankName: 160,
  accountHolder: 180,
  mandateDate: 120,
  mandateReference: 180,
  monthlyDueDay: 110
};
// Reihenfolge der Datenspalten, wie sie ohne eigene Anpassung erscheinen —
// aus DEFAULT_MEMBER_COLUMN_WIDTHS abgeleitet, damit beide nie
// auseinanderlaufen können.
const MEMBER_COLUMN_KEYS = Object.keys(DEFAULT_MEMBER_COLUMN_WIDTHS);

// Welche der oben neu hinzugekommenen Spalten sollen beim allerersten
// Aufruf (noch nichts über das Menü verändert) ausgeblendet bleiben, damit
// eine bestehende Tabelle nach diesem Update genauso aussieht wie vorher.
// "phone" ist bewusst NICHT dabei — die wurde ausdrücklich als sofort
// sichtbare neue Spalte gewünscht.
const MEMBER_DEFAULT_HIDDEN_COLUMNS = [
  'membershipType',
  'gender',
  'birthDate',
  'exitDate',
  'notes',
  'dataPrivacyConsent',
  'street',
  'country',
  'iban',
  'bic',
  'bankName',
  'accountHolder',
  'mandateDate',
  'mandateReference',
  'monthlyDueDay'
];

// Klartext-Beschriftungen aller wählbaren Spalten fürs Rechtsklick-Menü
// (dort werden reine Textlabels gebraucht, keine fertigen Tabellenköpfe).
const MEMBER_COLUMN_LABELS: Record<string, string> = {
  number: 'ID',
  name: 'Name',
  status: 'Status',
  department: 'Abteilung',
  entryDate: 'Eintritt',
  city: 'Wohnort',
  fee: 'Beitrag',
  paymentMethod: 'Zahlung',
  phone: 'Telefon',
  membershipType: 'Mitgliedstyp',
  gender: 'Geschlecht',
  birthDate: 'Geburtsdatum',
  exitDate: 'Austritt',
  notes: 'Notizen',
  dataPrivacyConsent: 'Datenschutz-Einwilligung',
  street: 'Straße',
  country: 'Land',
  iban: 'IBAN',
  bic: 'BIC',
  bankName: 'Bank',
  accountHolder: 'Kontoinhaber',
  mandateDate: 'Mandatsdatum',
  mandateReference: 'Mandatsreferenz',
  monthlyDueDay: 'Fälligkeitstag'
};

const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
  full: 'Vollmitglied',
  reduced: 'Ermäßigt',
  youth: 'Jugend / Kinder',
  family: 'Familie',
  supporting: 'Förderer / Sponsor',
  honorary: 'Ehrenmitglied',
  ausgetreten: 'Ausgetreten',
  terminated: 'Gekündigt'
};

const GENDER_LABELS: Record<string, string> = {
  m: 'männlich',
  w: 'weiblich',
  d: 'divers',
  none: '–'
};

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
  /** Darf der Benutzer hier etwas ändern? Fehlt die Angabe, gilt ja. */
  canEdit?: boolean;
  /** Wird gerufen, wenn jemand einen gesperrten Knopf betätigt. */
  onLocked?: () => void;
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
  onNavigateToSepa,
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

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<MemberSortField>('number');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination state (25, 50, 100, or 'all')
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, deptFilter, typeFilter, paymentFilter, sortBy, sortAsc]);

  // Export notification state
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleSort = (field: MemberSortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  // Ziehbare, gespeicherte Spaltenbreiten der Tabelle (siehe useResizableColumns).
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths: colWidths, startResize, autoFit } = useResizableColumns(
    'vereinsmanager:colwidths:members',
    DEFAULT_MEMBER_COLUMN_WIDTHS,
    tableRef
  );

  // Per Drag & Drop änderbare, gespeicherte Reihenfolge der Datenspalten
  // (Auswahl-Kästchen und Aktion bleiben fest am Anfang/Ende).
  const {
    order: columnOrder,
    draggedKey,
    dragOverKey,
    handleColDragStart,
    handleColDragOver,
    handleColDrop,
    handleColDragEnd
  } = useColumnOrder('vereinsmanager:colorder:members', MEMBER_COLUMN_KEYS);

  // Ein-/Ausblenden einzelner Spalten (unabhängig von Reihenfolge & Breite),
  // bedienbar per Rechtsklick auf einen beliebigen Spaltenkopf.
  const { hidden: hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    'vereinsmanager:colhidden:members',
    MEMBER_COLUMN_KEYS,
    MEMBER_DEFAULT_HIDDEN_COLUMNS
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

  // Spaltenköpfe je Schlüssel — werden weiter unten in der per Drag & Drop
  // gewählten Reihenfolge (columnOrder) gerendert statt in fester
  // Quelltext-Reihenfolge.
  const memberHeaderDefs: Record<string, React.ReactNode> = {
    number: (
      <SortableResizableTh
        key="number"
        label="ID"
        active={sortBy === 'number'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('number')}
        sortTitle="Nach Mitgliedsnummer sortieren"
        colKey="number"
        width={colWidths.number}
        onResizeStart={startResize('number')}
        onAutoFit={() => autoFit('number')}
        {...dragProps('number')}
      />
    ),
    name: (
      <SortableResizableTh
        key="name"
        label="Name"
        active={sortBy === 'name'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('name')}
        sortTitle="Nach Name sortieren"
        colKey="name"
        width={colWidths.name}
        onResizeStart={startResize('name')}
        onAutoFit={() => autoFit('name')}
        {...dragProps('name')}
      />
    ),
    status: (
      <SortableResizableTh
        key="status"
        label="Status"
        active={sortBy === 'status'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('status')}
        sortTitle="Nach Status sortieren"
        colKey="status"
        width={colWidths.status}
        onResizeStart={startResize('status')}
        onAutoFit={() => autoFit('status')}
        {...dragProps('status')}
      />
    ),
    department: (
      <SortableResizableTh
        key="department"
        label="Abteilung"
        active={sortBy === 'department'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('department')}
        sortTitle="Nach Sparte / Abteilung sortieren"
        colKey="department"
        width={colWidths.department}
        onResizeStart={startResize('department')}
        onAutoFit={() => autoFit('department')}
        {...dragProps('department')}
      />
    ),
    entryDate: (
      <SortableResizableTh
        key="entryDate"
        label="Eintritt"
        active={sortBy === 'entryDate'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('entryDate')}
        sortTitle="Nach Eintrittsdatum sortieren"
        colKey="entryDate"
        width={colWidths.entryDate}
        onResizeStart={startResize('entryDate')}
        onAutoFit={() => autoFit('entryDate')}
        {...dragProps('entryDate')}
      />
    ),
    city: (
      <SortableResizableTh
        key="city"
        label="Wohnort"
        active={sortBy === 'city'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('city')}
        sortTitle="Nach Wohnort / PLZ sortieren"
        colKey="city"
        width={colWidths.city}
        onResizeStart={startResize('city')}
        onAutoFit={() => autoFit('city')}
        {...dragProps('city')}
      />
    ),
    fee: (
      <SortableResizableTh
        key="fee"
        label="Beitrag"
        align="right"
        active={sortBy === 'fee'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('fee')}
        sortTitle="Nach Beitragshöhe sortieren"
        colKey="fee"
        width={colWidths.fee}
        onResizeStart={startResize('fee')}
        onAutoFit={() => autoFit('fee')}
        {...dragProps('fee')}
      />
    ),
    paymentMethod: (
      <SortableResizableTh
        key="paymentMethod"
        label="Zahlung"
        align="center"
        active={sortBy === 'paymentMethod'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('paymentMethod')}
        sortTitle="Nach Zahlungsmethode sortieren"
        colKey="paymentMethod"
        width={colWidths.paymentMethod}
        onResizeStart={startResize('paymentMethod')}
        onAutoFit={() => autoFit('paymentMethod')}
        {...dragProps('paymentMethod')}
      />
    ),
    phone: (
      <SortableResizableTh
        key="phone"
        label="Telefon"
        active={sortBy === 'phone'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('phone')}
        sortTitle="Nach Telefonnummer sortieren"
        colKey="phone"
        width={colWidths.phone}
        onResizeStart={startResize('phone')}
        onAutoFit={() => autoFit('phone')}
        {...dragProps('phone')}
      />
    ),
    membershipType: (
      <SortableResizableTh
        key="membershipType"
        label="Mitgliedstyp"
        active={sortBy === 'membershipType'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('membershipType')}
        sortTitle="Nach Mitgliedstyp sortieren"
        colKey="membershipType"
        width={colWidths.membershipType}
        onResizeStart={startResize('membershipType')}
        onAutoFit={() => autoFit('membershipType')}
        {...dragProps('membershipType')}
      />
    ),
    gender: (
      <SortableResizableTh
        key="gender"
        label="Geschlecht"
        active={sortBy === 'gender'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('gender')}
        sortTitle="Nach Geschlecht sortieren"
        colKey="gender"
        width={colWidths.gender}
        onResizeStart={startResize('gender')}
        onAutoFit={() => autoFit('gender')}
        {...dragProps('gender')}
      />
    ),
    birthDate: (
      <SortableResizableTh
        key="birthDate"
        label="Geburtsdatum"
        active={sortBy === 'birthDate'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('birthDate')}
        sortTitle="Nach Geburtsdatum sortieren"
        colKey="birthDate"
        width={colWidths.birthDate}
        onResizeStart={startResize('birthDate')}
        onAutoFit={() => autoFit('birthDate')}
        {...dragProps('birthDate')}
      />
    ),
    exitDate: (
      <SortableResizableTh
        key="exitDate"
        label="Austritt"
        active={sortBy === 'exitDate'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('exitDate')}
        sortTitle="Nach Austrittsdatum sortieren"
        colKey="exitDate"
        width={colWidths.exitDate}
        onResizeStart={startResize('exitDate')}
        onAutoFit={() => autoFit('exitDate')}
        {...dragProps('exitDate')}
      />
    ),
    notes: (
      <SortableResizableTh
        key="notes"
        label="Notizen"
        active={sortBy === 'notes'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('notes')}
        sortTitle="Nach Notizen sortieren"
        colKey="notes"
        width={colWidths.notes}
        onResizeStart={startResize('notes')}
        onAutoFit={() => autoFit('notes')}
        {...dragProps('notes')}
      />
    ),
    dataPrivacyConsent: (
      <SortableResizableTh
        key="dataPrivacyConsent"
        label="Datenschutz"
        align="center"
        active={sortBy === 'dataPrivacyConsent'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('dataPrivacyConsent')}
        sortTitle="Nach Datenschutz-Einwilligung sortieren"
        colKey="dataPrivacyConsent"
        width={colWidths.dataPrivacyConsent}
        onResizeStart={startResize('dataPrivacyConsent')}
        onAutoFit={() => autoFit('dataPrivacyConsent')}
        {...dragProps('dataPrivacyConsent')}
      />
    ),
    street: (
      <SortableResizableTh
        key="street"
        label="Straße"
        active={sortBy === 'street'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('street')}
        sortTitle="Nach Straße sortieren"
        colKey="street"
        width={colWidths.street}
        onResizeStart={startResize('street')}
        onAutoFit={() => autoFit('street')}
        {...dragProps('street')}
      />
    ),
    country: (
      <SortableResizableTh
        key="country"
        label="Land"
        active={sortBy === 'country'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('country')}
        sortTitle="Nach Land sortieren"
        colKey="country"
        width={colWidths.country}
        onResizeStart={startResize('country')}
        onAutoFit={() => autoFit('country')}
        {...dragProps('country')}
      />
    ),
    iban: (
      <SortableResizableTh
        key="iban"
        label="IBAN"
        active={sortBy === 'iban'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('iban')}
        sortTitle="Nach IBAN sortieren"
        colKey="iban"
        width={colWidths.iban}
        onResizeStart={startResize('iban')}
        onAutoFit={() => autoFit('iban')}
        {...dragProps('iban')}
      />
    ),
    bic: (
      <SortableResizableTh
        key="bic"
        label="BIC"
        active={sortBy === 'bic'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('bic')}
        sortTitle="Nach BIC sortieren"
        colKey="bic"
        width={colWidths.bic}
        onResizeStart={startResize('bic')}
        onAutoFit={() => autoFit('bic')}
        {...dragProps('bic')}
      />
    ),
    bankName: (
      <SortableResizableTh
        key="bankName"
        label="Bank"
        active={sortBy === 'bankName'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('bankName')}
        sortTitle="Nach Bank sortieren"
        colKey="bankName"
        width={colWidths.bankName}
        onResizeStart={startResize('bankName')}
        onAutoFit={() => autoFit('bankName')}
        {...dragProps('bankName')}
      />
    ),
    accountHolder: (
      <SortableResizableTh
        key="accountHolder"
        label="Kontoinhaber"
        active={sortBy === 'accountHolder'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('accountHolder')}
        sortTitle="Nach Kontoinhaber sortieren"
        colKey="accountHolder"
        width={colWidths.accountHolder}
        onResizeStart={startResize('accountHolder')}
        onAutoFit={() => autoFit('accountHolder')}
        {...dragProps('accountHolder')}
      />
    ),
    mandateDate: (
      <SortableResizableTh
        key="mandateDate"
        label="Mandatsdatum"
        active={sortBy === 'mandateDate'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('mandateDate')}
        sortTitle="Nach Mandatsdatum sortieren"
        colKey="mandateDate"
        width={colWidths.mandateDate}
        onResizeStart={startResize('mandateDate')}
        onAutoFit={() => autoFit('mandateDate')}
        {...dragProps('mandateDate')}
      />
    ),
    mandateReference: (
      <SortableResizableTh
        key="mandateReference"
        label="Mandatsreferenz"
        active={sortBy === 'mandateReference'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('mandateReference')}
        sortTitle="Nach Mandatsreferenz sortieren"
        colKey="mandateReference"
        width={colWidths.mandateReference}
        onResizeStart={startResize('mandateReference')}
        onAutoFit={() => autoFit('mandateReference')}
        {...dragProps('mandateReference')}
      />
    ),
    monthlyDueDay: (
      <SortableResizableTh
        key="monthlyDueDay"
        label="Fälligkeitstag"
        align="center"
        active={sortBy === 'monthlyDueDay'}
        direction={sortAsc ? 'asc' : 'desc'}
        onSort={() => handleSort('monthlyDueDay')}
        sortTitle="Nach Fälligkeitstag sortieren"
        colKey="monthlyDueDay"
        width={colWidths.monthlyDueDay}
        onResizeStart={startResize('monthlyDueDay')}
        onAutoFit={() => autoFit('monthlyDueDay')}
        {...dragProps('monthlyDueDay')}
      />
    )
  };

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
        comparison = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortBy === 'department') {
        comparison = (a.department || '').localeCompare(b.department || '');
      } else if (sortBy === 'entryDate') {
        comparison = new Date(a.entryDate || 0).getTime() - new Date(b.entryDate || 0).getTime();
      } else if (sortBy === 'city') {
        const cityA = `${a.address?.city || ''} ${a.address?.zip || ''}`;
        const cityB = `${b.address?.city || ''} ${b.address?.zip || ''}`;
        comparison = cityA.localeCompare(cityB);
      } else if (sortBy === 'fee') {
        comparison = a.feeAmount - b.feeAmount;
      } else if (sortBy === 'paymentMethod') {
        comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
      } else if (sortBy === 'phone') {
        comparison = (a.phone || '').localeCompare(b.phone || '');
      } else if (sortBy === 'membershipType') {
        comparison = (MEMBERSHIP_TYPE_LABELS[a.membershipType] || '').localeCompare(MEMBERSHIP_TYPE_LABELS[b.membershipType] || '');
      } else if (sortBy === 'gender') {
        comparison = (a.gender || '').localeCompare(b.gender || '');
      } else if (sortBy === 'birthDate') {
        comparison = new Date(a.birthDate || 0).getTime() - new Date(b.birthDate || 0).getTime();
      } else if (sortBy === 'exitDate') {
        comparison = new Date(a.exitDate || 0).getTime() - new Date(b.exitDate || 0).getTime();
      } else if (sortBy === 'notes') {
        comparison = (a.notes || '').localeCompare(b.notes || '');
      } else if (sortBy === 'dataPrivacyConsent') {
        comparison = Number(a.dataPrivacyConsent) - Number(b.dataPrivacyConsent);
      } else if (sortBy === 'street') {
        comparison = `${a.address?.street || ''} ${a.address?.houseNumber || ''}`.localeCompare(`${b.address?.street || ''} ${b.address?.houseNumber || ''}`);
      } else if (sortBy === 'country') {
        comparison = (a.address?.country || '').localeCompare(b.address?.country || '');
      } else if (sortBy === 'iban') {
        comparison = (a.bankDetails?.iban || '').localeCompare(b.bankDetails?.iban || '');
      } else if (sortBy === 'bic') {
        comparison = (a.bankDetails?.bic || '').localeCompare(b.bankDetails?.bic || '');
      } else if (sortBy === 'bankName') {
        comparison = (a.bankDetails?.bankName || '').localeCompare(b.bankDetails?.bankName || '');
      } else if (sortBy === 'accountHolder') {
        comparison = (a.bankDetails?.accountHolder || '').localeCompare(b.bankDetails?.accountHolder || '');
      } else if (sortBy === 'mandateDate') {
        comparison = new Date(a.bankDetails?.mandateDate || 0).getTime() - new Date(b.bankDetails?.mandateDate || 0).getTime();
      } else if (sortBy === 'mandateReference') {
        comparison = (a.bankDetails?.mandateReference || '').localeCompare(b.bankDetails?.mandateReference || '');
      } else if (sortBy === 'monthlyDueDay') {
        comparison = (a.bankDetails?.monthlyDueDay || 0) - (b.bankDetails?.monthlyDueDay || 0);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [members, searchQuery, statusFilter, deptFilter, typeFilter, paymentFilter, sortBy, sortAsc]);

  // Paginated members for display
  const paginatedMembers = useMemo(() => {
    if (pageSize === 'all') return filteredMembers;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

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

  const handleToggleMember = (id: string, e?: React.SyntheticEvent) => {
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

  const activeMembers = members.filter(m => m.status === 'active');
  const passiveMembers = members.filter(m => m.status === 'passive');
  // Current active/passive/honorary/suspended members (excluding terminated/ausgetreten)
  const currentMembers = members.filter(m => m.status !== 'terminated' && m.membershipType !== 'ausgetreten' && m.membershipType !== 'terminated');
  const currentTotalCount = currentMembers.length;

  const activeCount = activeMembers.length;
  const passiveCount = passiveMembers.length;
  const activePct = currentTotalCount > 0 ? Math.round((activeCount / currentTotalCount) * 100) : 0;

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

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const safeClub = (settings.clubName || 'Verein').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const filename = `mitglieder_${safeClub}_${new Date().toISOString().split('T')[0]}.csv`;
      const result = await ExportService.exportMembersCSV(filteredMembers, filename);
      if (result.cancelled) {
        setExportStatus({
          type: 'info',
          message: 'CSV-Export abgebrochen (kein Zielordner gewählt).'
        });
      } else if (result.success) {
        setExportStatus({
          type: 'success',
          message: result.method === 'picker'
            ? `CSV-Tabelle erfolgreich gespeichert als: "${result.fileName}"`
            : `CSV-Tabelle "${result.fileName}" erfolgreich im gewählten Verzeichnis / Download abgelegt.`
        });
      } else {
        setExportStatus({
          type: 'error',
          message: result.error || 'Fehler beim CSV-Export.'
        });
      }
    } catch (err: any) {
      // Der Anwender bekommt unten eine verständliche Meldung. Die Ursache
      // gehört trotzdem in die Konsole: Ohne sie ist "Export geht nicht"
      // eine Fehlermeldung, mit der niemand etwas anfangen kann.
      console.error('CSV-Export der Mitgliederliste fehlgeschlagen:', err);
      setExportStatus({
        type: 'error',
        message: 'Fehler beim Exportieren der CSV-Tabelle.'
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const safeClub = (settings.clubName || 'Verein').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      const filename = `mitgliederliste_${safeClub}_${new Date().toISOString().split('T')[0]}.pdf`;
      const result = await ExportService.exportMembersPDF(filteredMembers, settings, 'Mitgliederliste', filename);
      if (result.cancelled) {
        setExportStatus({
          type: 'info',
          message: 'PDF-Export abgebrochen (kein Zielordner gewählt).'
        });
      } else if (result.success) {
        setExportStatus({
          type: 'success',
          message: result.method === 'picker'
            ? `PDF-Mitgliederliste erfolgreich gespeichert als: "${result.fileName}"`
            : `PDF-Mitgliederliste "${result.fileName}" erfolgreich im gewählten Verzeichnis / Download abgelegt.`
        });
      } else {
        setExportStatus({
          type: 'error',
          message: result.error || 'Fehler beim PDF-Export.'
        });
      }
    } catch (err: any) {
      console.error('PDF-Mitgliederliste konnte nicht erzeugt werden:', err);
      setExportStatus({
        type: 'error',
        message: 'Fehler beim Generieren der PDF-Mitgliederliste.'
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(null), 5000);
    }
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
      {/* Hinweis auf reines Leserecht — damit niemand erst durch Probieren
          herausfindet, warum die Knöpfe grau sind. */}
      {!canEdit && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-snug">
            <strong>Nur Leserecht.</strong> Sie können die Mitgliederdaten einsehen,
            auswerten und exportieren. Anlegen, Ändern und Löschen sind für Ihre
            Rolle gesperrt — die betreffenden Knöpfe sind ausgegraut.
          </p>
        </div>
      )}

      {/* Metric Cards: Mitglieder Gesamt & Mitglieder je Sparte */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kachel 1: Mitglieder Gesamt */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mitglieder Gesamt
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                {activePct}% Aktiv
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 leading-none">
                {currentTotalCount}
              </h3>
              {(statusFilter !== 'all' || typeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Filter für Status/Typ aufheben"
                >
                  <span>Filter aufheben</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
            {/* Aktiv Filter Button */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              className={`py-2.5 px-3 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/40'
                  : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200 text-slate-800'
              }`}
              title={statusFilter === 'active' ? 'Klicken, um Filter aufzuheben' : 'Klicken, um nach aktiven Mitgliedern zu filtern'}
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${statusFilter === 'active' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Aktiv
              </p>
              <p className={`text-base font-bold font-mono ${statusFilter === 'active' ? 'text-white' : 'text-emerald-900'}`}>
                {activeCount}
              </p>
            </button>

            {/* Passiv Filter Button */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'passive' ? 'all' : 'passive')}
              className={`py-2.5 px-3 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                statusFilter === 'passive'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
              title={statusFilter === 'passive' ? 'Klicken, um Filter aufzuheben' : 'Klicken, um nach passiven Mitgliedern zu filtern'}
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${statusFilter === 'passive' ? 'text-slate-200' : 'text-slate-600'}`}>
                Passiv
              </p>
              <p className={`text-base font-bold font-mono ${statusFilter === 'passive' ? 'text-white' : 'text-slate-800'}`}>
                {passiveCount}
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
              onClick={guard(() => setIsBulkEditOpen(true))}
              className={`bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Stammdaten aller markierten Mitglieder ändern')}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Stammdaten bearbeiten</span>
            </button>

            <button
              type="button"
              onClick={guard(() => setIsBulkDeleteConfirmOpen(true))}
              className={`bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Alle markierten Mitglieder löschen')}
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
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
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
              onClick={guard(onOpenImport)}
              className={`text-xs bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Mitglieder aus Google Sheets oder CSV-Datei importieren')}
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV / Sheets Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
              title="Gefilterte Liste als Excel-CSV exportieren (Speicherort wählbar)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
              title="Druckreife Mitgliederliste als PDF herunterladen (Speicherort wählbar)"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF Liste</span>
            </button>

            <button
              type="button"
              onClick={guard(onOpenCreate)}
              className={`bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs${lockClass(canEdit)}`}
              title={lockTitle(canEdit, 'Neues Mitglied anlegen')}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neues Mitglied</span>
            </button>
          </div>
        </div>

        {/* Export Notification / Feedback Banner */}
        {exportStatus && (
          <div
            className={`px-4 py-2.5 text-xs font-medium border-b flex items-center justify-between transition-all ${
              exportStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : exportStatus.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                exportStatus.type === 'success' ? 'text-emerald-600' : exportStatus.type === 'info' ? 'text-blue-600' : 'text-rose-600'
              }`} />
              <span>{exportStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportStatus(null)}
              className="text-slate-400 hover:text-slate-700 ml-4 font-bold text-sm"
              title="Schließen"
            >
              ✕
            </button>
          </div>
        )}

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
        {/* Jede Tabelle bekommt jetzt ihren EIGENEN, nach oben begrenzten
            Scroll-Bereich (Breite UND Höhe), statt das seitliche Scrollen an
            die ganze Seite abzugeben (das war der vorherige Versuch — siehe
            Kommentar in App.tsx, warum der nicht funktioniert hat: Bei langen
            Seiten landete der seitliche Scrollbalken ganz unten an der
            Kante der GESAMTEN Seite, oft weit außerhalb des Bildschirms).
            Jetzt gilt: Passen alle Zeilen in die Höchsthöhe, verhält sich die
            Tabelle wie gewohnt (kein eigener Scrollbalken sichtbar, nur bei
            Bedarf seitlich). Passen mehr Zeilen hinein, als Platz ist,
            entsteht INNERHALB dieses Kastens ein eigener, senkrechter
            Scrollbalken — der mitscrollende Kopf bezieht sich dann auf
            diesen Kasten (nicht mehr auf die ganze Seite), bleibt darin aber
            genauso sichtbar. Der Vorteil: Der seitliche Scrollbalken sitzt
            dadurch IMMER direkt unter den Tabellenzeilen, unabhängig davon,
            wie lang der Rest der Seite ist. */}
        <div className="overflow-auto max-h-[65vh]">
          <table
            ref={tableRef}
            className="text-left text-sm"
            style={{
              tableLayout: 'fixed',
              width:
                CHECKBOX_COL_WIDTH +
                ACTION_COL_WIDTH +
                visibleColumnOrder.reduce((sum, key) => sum + (colWidths[key] || 0), 0)
            }}
          >
            {/* <colgroup> statt Breiten nur an den <th>-Elementen: Bei
                table-layout:fixed übernehmen Browser die Spaltenbreiten aus
                der ersten Zeile der Tabelle, also dem Tabellenkopf — das hat
                für den Kopf selbst zuverlässig funktioniert, aber Firefox
                hat sich beim Ziehen (eine reine Style-Änderung ohne neue
                Zeilen) nicht immer dazu durchgerungen, diese einmal
                ermittelten Spaltenbreiten auch für die Zellen der bereits
                vorhandenen Tabellenzeilen im <tbody> neu zu berechnen — der
                Kopf wurde breiter, die Zeilen darunter blieben auf der alten
                Breite stehen und schnitten den Text weiter ab. Ein
                <colgroup> mit einem <col> pro Spalte macht die Breite jeder
                Spalte explizit und unabhängig vom Tabellenkopf, sodass sie
                bei jeder Änderung für die ganze Spalte gilt — Kopf UND alle
                Zeilen gleichzeitig. */}
            <colgroup>
              <col style={{ width: CHECKBOX_COL_WIDTH }} />
              {visibleColumnOrder.map(key => (
                <col key={key} style={{ width: colWidths[key] || 0 }} />
              ))}
              <col style={{ width: ACTION_COL_WIDTH }} />
            </colgroup>
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                {/* Select All Checkbox Header */}
                <th
                  style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH }}
                  className="px-3 py-3 text-center sticky top-0 z-10 bg-slate-50 border-b border-slate-200"
                >
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
                {/* Datenspalten in der per Drag & Drop gewählten Reihenfolge,
                    ausgeblendete Spalten (siehe Rechtsklick-Menü) werden
                    hier übersprungen. */}
                {visibleColumnOrder.map(key => memberHeaderDefs[key])}
                <th
                  style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                  className="px-4 py-3 text-right sticky top-0 z-10 bg-slate-50 border-b border-slate-200"
                >
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.id);

                // Zellinhalte je Schlüssel — werden weiter unten in der
                // per Drag & Drop gewählten Reihenfolge gerendert.
                const memberCellDefs: Record<string, React.ReactNode> = {
                  number: (
                    <td key="number" data-col-content="number" className="px-4 py-3 font-mono text-slate-400 font-medium text-xs overflow-hidden">
                      {member.memberNumber}
                    </td>
                  ),
                  name: (
                    <td key="name" data-col-content="name" className="px-4 py-3 font-semibold text-slate-900 overflow-hidden">
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
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {member.lastName}, {member.firstName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal truncate">
                            {member.email || member.phone || 'Keine Kontaktdaten'}
                          </div>
                        </div>
                      </div>
                    </td>
                  ),
                  status: (
                    <td key="status" data-col-content="status" className="px-4 py-3 whitespace-nowrap overflow-hidden">
                      {getStatusBadge(member.status)}
                    </td>
                  ),
                  department: (
                    <td key="department" data-col-content="department" className="px-4 py-3 text-slate-600 font-medium text-xs truncate">
                      {member.department}
                    </td>
                  ),
                  entryDate: (
                    <td key="entryDate" data-col-content="entryDate" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.entryDate ? new Date(member.entryDate).toLocaleDateString('de-DE') : '–'}
                    </td>
                  ),
                  city: (
                    <td key="city" data-col-content="city" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.address.zip} {member.address.city}
                    </td>
                  ),
                  fee: (
                    <td key="fee" data-col-content="fee" className="px-4 py-3 text-right font-mono font-bold text-slate-800 text-xs overflow-hidden">
                      {member.paymentMethod === 'exempt' || member.feePeriod === 'none' || member.feeAmount === 0 ? (
                        <span className="text-emerald-700 font-bold">0,00 €</span>
                      ) : (
                        `${member.feeAmount.toFixed(2)} €`
                      )}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {member.feePeriod === 'none' || member.paymentMethod === 'exempt'
                          ? 'beitragsfrei'
                          : member.feePeriod === 'yearly'
                          ? 'jährlich'
                          : member.feePeriod === 'monthly'
                          ? 'monatl.'
                          : 'halbj.'}
                      </span>
                    </td>
                  ),
                  paymentMethod: (
                    <td key="paymentMethod" data-col-content="paymentMethod" className="px-4 py-3 text-center overflow-hidden">
                      {member.paymentMethod === 'exempt' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          BEITRAGSFREI
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {member.paymentMethod.toUpperCase()}
                        </span>
                      )}
                    </td>
                  ),
                  phone: (
                    <td key="phone" data-col-content="phone" className="px-4 py-3 text-slate-600 text-xs truncate">
                      {member.phone || '–'}
                    </td>
                  ),
                  membershipType: (
                    <td key="membershipType" data-col-content="membershipType" className="px-4 py-3 text-slate-600 text-xs truncate">
                      {MEMBERSHIP_TYPE_LABELS[member.membershipType] || member.membershipType}
                    </td>
                  ),
                  gender: (
                    <td key="gender" data-col-content="gender" className="px-4 py-3 text-slate-600 text-xs truncate">
                      {GENDER_LABELS[member.gender] || '–'}
                    </td>
                  ),
                  birthDate: (
                    <td key="birthDate" data-col-content="birthDate" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.birthDate ? new Date(member.birthDate).toLocaleDateString('de-DE') : '–'}
                    </td>
                  ),
                  exitDate: (
                    <td key="exitDate" data-col-content="exitDate" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.exitDate ? new Date(member.exitDate).toLocaleDateString('de-DE') : '–'}
                    </td>
                  ),
                  notes: (
                    <td key="notes" data-col-content="notes" className="px-4 py-3 text-slate-500 text-xs truncate" title={member.notes || undefined}>
                      {member.notes || '–'}
                    </td>
                  ),
                  dataPrivacyConsent: (
                    <td key="dataPrivacyConsent" data-col-content="dataPrivacyConsent" className="px-4 py-3 text-center overflow-hidden">
                      {member.dataPrivacyConsent ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">JA</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">NEIN</span>
                      )}
                    </td>
                  ),
                  street: (
                    <td key="street" data-col-content="street" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.address?.street || member.address?.houseNumber
                        ? `${member.address?.street || ''} ${member.address?.houseNumber || ''}`.trim()
                        : '–'}
                    </td>
                  ),
                  country: (
                    <td key="country" data-col-content="country" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.address?.country || '–'}
                    </td>
                  ),
                  iban: (
                    <td key="iban" data-col-content="iban" className="px-4 py-3 font-mono text-slate-600 text-2xs truncate">
                      {member.bankDetails?.iban || '–'}
                    </td>
                  ),
                  bic: (
                    <td key="bic" data-col-content="bic" className="px-4 py-3 font-mono text-slate-600 text-2xs truncate">
                      {member.bankDetails?.bic || '–'}
                    </td>
                  ),
                  bankName: (
                    <td key="bankName" data-col-content="bankName" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.bankDetails?.bankName || '–'}
                    </td>
                  ),
                  accountHolder: (
                    <td key="accountHolder" data-col-content="accountHolder" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.bankDetails?.accountHolder || '–'}
                    </td>
                  ),
                  mandateDate: (
                    <td key="mandateDate" data-col-content="mandateDate" className="px-4 py-3 text-slate-500 text-xs truncate">
                      {member.bankDetails?.mandateDate ? new Date(member.bankDetails.mandateDate).toLocaleDateString('de-DE') : '–'}
                    </td>
                  ),
                  mandateReference: (
                    <td key="mandateReference" data-col-content="mandateReference" className="px-4 py-3 font-mono text-slate-500 text-2xs truncate">
                      {member.bankDetails?.mandateReference || '–'}
                    </td>
                  ),
                  monthlyDueDay: (
                    <td key="monthlyDueDay" data-col-content="monthlyDueDay" className="px-4 py-3 text-center text-slate-500 text-xs truncate">
                      {member.bankDetails?.monthlyDueDay ? `${member.bankDetails.monthlyDueDay}.` : '–'}
                    </td>
                  )
                };

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

                    {/* Datenspalten in der per Drag & Drop gewählten Reihenfolge,
                        ausgeblendete Spalten werden übersprungen. */}
                    {visibleColumnOrder.map(key => memberCellDefs[key])}

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
                          onClick={guard(() => onOpenEdit(member))}
                          className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors${lockClass(canEdit)}`}
                          title={lockTitle(canEdit, 'Bearbeiten')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={guard(() => {
                            if (window.confirm(`Mitglied ${member.firstName} ${member.lastName} (${member.memberNumber}) wirklich löschen?`)) {
                              onDeleteMember(member.id);
                            }
                          })}
                          className={`p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors${lockClass(canEdit)}`}
                          title={lockTitle(canEdit, 'Löschen')}
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
                  <td colSpan={visibleColumnOrder.length + 2} className="p-8 text-center text-slate-400 text-xs">
                    Keine Mitglieder für die aktuellen Filterkriterien gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {columnMenuPos && (
          <ColumnVisibilityMenu
            position={columnMenuPos}
            columns={columnOrder.map(key => ({ key, label: MEMBER_COLUMN_LABELS[key] || key }))}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            onClose={() => setColumnMenuPos(null)}
          />
        )}

        {/* Table Bottom Footer & Pagination */}
        <div className="overflow-hidden rounded-b-xl">
          {selectedMemberIds.size > 0 && (
            <div className="px-6 py-2 bg-blue-50/60 border-t border-blue-100 text-xs text-blue-700 flex items-center justify-between">
              <span className="font-semibold">{selectedMemberIds.size} {selectedMemberIds.size === 1 ? 'Mitglied' : 'Mitglieder'} ausgewählt</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer text-xs"
              >
                Auswahl aufheben
              </button>
            </div>
          )}
          <TablePagination
            totalItems={filteredMembers.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemName="Mitgliedern"
          />
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
