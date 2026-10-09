import React, { useState, useMemo, useRef } from 'react';
import { ClubContact, ContactType, ContactPersonType } from '../types';
import { CONTACT_TYPES_LIST, CONTACT_TYPE_MAP } from '../data/contactConstants';
import { ExportService } from '../services/exportService';
import { SortableResizableTh } from './SortableResizableTh';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { useResizableColumns, ColumnWidths } from '../hooks/useResizableColumns';
import { useSortableColumns } from '../hooks/useSortableColumns';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import {
  Search,
  Plus,
  FileDown,
  Download,
  Upload,
  Building2,
  User,
  Trash2,
  Edit2,
  Eye,
  Phone,
  Mail,
  CheckSquare,
  Square,
  Receipt,
  FileText,
  X
} from 'lucide-react';
import { TablePagination } from './TablePagination';
import { AuswahlLeiste } from './AuswahlLeiste';
import { usePagination } from '../hooks/usePagination';
import { ermittleSeitenStatus, wechsleSeite, waehleAlleGefilterten } from '../utils/tableSelection';

type ContactSortField =
  | 'number'
  | 'name'
  | 'types'
  | 'communication'
  | 'city'
  | 'iban'
  | 'dateOfBirth'
  | 'mobile'
  | 'website'
  | 'taxId'
  | 'commercialRegister'
  | 'creditorOrDebtorNumber'
  | 'notes'
  | 'bic'
  | 'accountHolder'
  | 'tags';

// Feste Breiten für Auswahl-Kästchen- und Aktionsspalte (letztere ist
// breiter als bei Mitgliedern/Buchungsjournal, weil hier bis zu fünf
// Knöpfe nebeneinander stehen können: +Buchung, +Rechnung, Details,
// Bearbeiten, Löschen). Die übrigen Breiten sind nur ein sinnvoller
// Startwert; nach dem ersten Ziehen bzw. Doppelklick merkt sich der
// Browser die eigene Wahl (siehe useResizableColumns).
const CHECKBOX_COL_WIDTH = 40;
const ACTION_COL_WIDTH = 380;
const DEFAULT_CONTACT_COLUMN_WIDTHS: ColumnWidths = {
  number: 100,
  name: 260,
  types: 170,
  communication: 200,
  city: 170,
  iban: 160,
  dateOfBirth: 120,
  mobile: 130,
  website: 170,
  taxId: 140,
  commercialRegister: 190,
  creditorOrDebtorNumber: 170,
  notes: 200,
  bic: 120,
  accountHolder: 170,
  tags: 170
};
const CONTACT_COLUMN_KEYS = Object.keys(DEFAULT_CONTACT_COLUMN_WIDTHS);

// Spalten, die es erst seit dem Ein-/Ausblenden-Menü gibt und die beim
// allerersten Aufruf ausgeblendet starten (siehe useColumnVisibility). BIC,
// Kontoinhaber und Tags hat Johannes ausdrücklich als eigene, sofort
// sichtbare Spalten gewünscht; der Rest ist Teil der allgemeinen Erweiterung
// und startet wie bei den Mitgliedern ausgeblendet.
const CONTACT_DEFAULT_HIDDEN_COLUMNS = [
  'dateOfBirth',
  'mobile',
  'website',
  'taxId',
  'commercialRegister',
  'creditorOrDebtorNumber',
  'notes'
];

// Beschriftungen für das Ein-/Ausblenden-Menü.
const CONTACT_COLUMN_LABELS: Record<string, string> = {
  number: 'Kontakt-Nr.',
  name: 'Name / Firma',
  types: 'Kontakttypen',
  communication: 'Kommunikation',
  city: 'Ort / Anschrift',
  iban: 'Bank / IBAN',
  dateOfBirth: 'Geburtsdatum',
  mobile: 'Mobiltelefon',
  website: 'Webseite',
  taxId: 'Steuernummer',
  commercialRegister: 'Handelsregister-Nr.',
  creditorOrDebtorNumber: 'Debitoren-/Kreditorennummer',
  notes: 'Notizen',
  bic: 'BIC',
  accountHolder: 'Kontoinhaber',
  tags: 'Tags'
};

interface ContactsViewProps {
  contacts: ClubContact[];
  clubName?: string;
  onOpenCreate: () => void;
  onOpenEdit: (contact: ClubContact) => void;
  onOpenDetails: (contact: ClubContact) => void;
  onDeleteContact: (id: string) => void;
  onBulkDeleteContacts?: (ids: string[]) => Promise<void>;
  onCreateBookingForContact: (contact: ClubContact) => void;
  onCreateInvoiceForContact?: (contact: ClubContact) => void;
  onOpenImport?: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  clubName = 'Verein',
  onOpenCreate,
  onOpenEdit,
  onOpenDetails,
  onDeleteContact,
  onBulkDeleteContacts,
  onCreateBookingForContact,
  onCreateInvoiceForContact,
  onOpenImport,
}) => {
  /**
   * Klick auf einen ändernden Knopf. Ohne Schreibrecht wird nicht die
   * Aktion ausgeführt, sondern der Hinweis gezeigt.
   */
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState<'all' | ContactPersonType>('all');
  const [contactTypeFilter, setContactTypeFilter] = useState<string>('all');
  const { sortBy, sortDirection, handleSort } = useSortableColumns<ContactSortField>('name');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Ziehbare, gespeicherte Spaltenbreiten der Tabelle (siehe useResizableColumns).
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths: colWidths, startResize, autoFit } = useResizableColumns(
    'vereinsmanager:colwidths:contacts',
    DEFAULT_CONTACT_COLUMN_WIDTHS,
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
  } = useColumnOrder('vereinsmanager:colorder:contacts', CONTACT_COLUMN_KEYS);

  // Ein-/Ausblenden einzelner Spalten (unabhängig von Reihenfolge & Breite),
  // bedienbar per Rechtsklick auf einen beliebigen Spaltenkopf.
  const { hidden: hiddenColumns, toggle: toggleColumn } = useColumnVisibility(
    'vereinsmanager:colhidden:contacts',
    CONTACT_COLUMN_KEYS,
    CONTACT_DEFAULT_HIDDEN_COLUMNS
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
  const contactHeaderDefs: Record<string, React.ReactNode> = {
    number: (
      <SortableResizableTh
        key="number"
        label="Kontakt-Nr."
        active={sortBy === 'number'}
        direction={sortDirection}
        onSort={() => handleSort('number')}
        sortTitle="Nach Kontaktnummer sortieren"
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
        label="Name / Firma"
        active={sortBy === 'name'}
        direction={sortDirection}
        onSort={() => handleSort('name')}
        sortTitle="Nach Name / Firma sortieren"
        colKey="name"
        width={colWidths.name}
        onResizeStart={startResize('name')}
        onAutoFit={() => autoFit('name')}
        {...dragProps('name')}
      />
    ),
    types: (
      <SortableResizableTh
        key="types"
        label="Kontakttypen"
        active={sortBy === 'types'}
        direction={sortDirection}
        onSort={() => handleSort('types')}
        sortTitle="Nach Kontakttypen sortieren"
        colKey="types"
        width={colWidths.types}
        onResizeStart={startResize('types')}
        onAutoFit={() => autoFit('types')}
        {...dragProps('types')}
      />
    ),
    communication: (
      <SortableResizableTh
        key="communication"
        label="Kommunikation"
        active={sortBy === 'communication'}
        direction={sortDirection}
        onSort={() => handleSort('communication')}
        sortTitle="Nach E-Mail / Telefon sortieren"
        colKey="communication"
        width={colWidths.communication}
        onResizeStart={startResize('communication')}
        onAutoFit={() => autoFit('communication')}
        {...dragProps('communication')}
      />
    ),
    city: (
      <SortableResizableTh
        key="city"
        label="Ort / Anschrift"
        active={sortBy === 'city'}
        direction={sortDirection}
        onSort={() => handleSort('city')}
        sortTitle="Nach Ort sortieren"
        colKey="city"
        width={colWidths.city}
        onResizeStart={startResize('city')}
        onAutoFit={() => autoFit('city')}
        {...dragProps('city')}
      />
    ),
    iban: (
      <SortableResizableTh
        key="iban"
        label="Bank / IBAN"
        active={sortBy === 'iban'}
        direction={sortDirection}
        onSort={() => handleSort('iban')}
        sortTitle="Nach IBAN sortieren"
        colKey="iban"
        width={colWidths.iban}
        onResizeStart={startResize('iban')}
        onAutoFit={() => autoFit('iban')}
        {...dragProps('iban')}
      />
    ),
    dateOfBirth: (
      <SortableResizableTh
        key="dateOfBirth"
        label="Geburtsdatum"
        active={sortBy === 'dateOfBirth'}
        direction={sortDirection}
        onSort={() => handleSort('dateOfBirth')}
        sortTitle="Nach Geburtsdatum sortieren"
        colKey="dateOfBirth"
        width={colWidths.dateOfBirth}
        onResizeStart={startResize('dateOfBirth')}
        onAutoFit={() => autoFit('dateOfBirth')}
        {...dragProps('dateOfBirth')}
      />
    ),
    mobile: (
      <SortableResizableTh
        key="mobile"
        label="Mobiltelefon"
        active={sortBy === 'mobile'}
        direction={sortDirection}
        onSort={() => handleSort('mobile')}
        sortTitle="Nach Mobiltelefon sortieren"
        colKey="mobile"
        width={colWidths.mobile}
        onResizeStart={startResize('mobile')}
        onAutoFit={() => autoFit('mobile')}
        {...dragProps('mobile')}
      />
    ),
    website: (
      <SortableResizableTh
        key="website"
        label="Webseite"
        active={sortBy === 'website'}
        direction={sortDirection}
        onSort={() => handleSort('website')}
        sortTitle="Nach Webseite sortieren"
        colKey="website"
        width={colWidths.website}
        onResizeStart={startResize('website')}
        onAutoFit={() => autoFit('website')}
        {...dragProps('website')}
      />
    ),
    taxId: (
      <SortableResizableTh
        key="taxId"
        label="Steuernummer"
        active={sortBy === 'taxId'}
        direction={sortDirection}
        onSort={() => handleSort('taxId')}
        sortTitle="Nach Steuernummer sortieren"
        colKey="taxId"
        width={colWidths.taxId}
        onResizeStart={startResize('taxId')}
        onAutoFit={() => autoFit('taxId')}
        {...dragProps('taxId')}
      />
    ),
    commercialRegister: (
      <SortableResizableTh
        key="commercialRegister"
        label="Handelsregister-Nr."
        active={sortBy === 'commercialRegister'}
        direction={sortDirection}
        onSort={() => handleSort('commercialRegister')}
        sortTitle="Nach Handelsregister-Nr. sortieren"
        colKey="commercialRegister"
        width={colWidths.commercialRegister}
        onResizeStart={startResize('commercialRegister')}
        onAutoFit={() => autoFit('commercialRegister')}
        {...dragProps('commercialRegister')}
      />
    ),
    creditorOrDebtorNumber: (
      <SortableResizableTh
        key="creditorOrDebtorNumber"
        label="Debitoren-/Kreditorennummer"
        active={sortBy === 'creditorOrDebtorNumber'}
        direction={sortDirection}
        onSort={() => handleSort('creditorOrDebtorNumber')}
        sortTitle="Nach Debitoren-/Kreditorennummer sortieren"
        colKey="creditorOrDebtorNumber"
        width={colWidths.creditorOrDebtorNumber}
        onResizeStart={startResize('creditorOrDebtorNumber')}
        onAutoFit={() => autoFit('creditorOrDebtorNumber')}
        {...dragProps('creditorOrDebtorNumber')}
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
        {...dragProps('notes')}
      />
    ),
    bic: (
      <SortableResizableTh
        key="bic"
        label="BIC"
        active={sortBy === 'bic'}
        direction={sortDirection}
        onSort={() => handleSort('bic')}
        sortTitle="Nach BIC sortieren"
        colKey="bic"
        width={colWidths.bic}
        onResizeStart={startResize('bic')}
        onAutoFit={() => autoFit('bic')}
        {...dragProps('bic')}
      />
    ),
    accountHolder: (
      <SortableResizableTh
        key="accountHolder"
        label="Kontoinhaber"
        active={sortBy === 'accountHolder'}
        direction={sortDirection}
        onSort={() => handleSort('accountHolder')}
        sortTitle="Nach Kontoinhaber sortieren"
        colKey="accountHolder"
        width={colWidths.accountHolder}
        onResizeStart={startResize('accountHolder')}
        onAutoFit={() => autoFit('accountHolder')}
        {...dragProps('accountHolder')}
      />
    ),
    tags: (
      <SortableResizableTh
        key="tags"
        label="Tags"
        active={sortBy === 'tags'}
        direction={sortDirection}
        onSort={() => handleSort('tags')}
        sortTitle="Nach Tags sortieren"
        colKey="tags"
        width={colWidths.tags}
        onResizeStart={startResize('tags')}
        onAutoFit={() => autoFit('tags')}
        {...dragProps('tags')}
      />
    )
  };

  // Quick stats
  const totalCount = contacts.length;
  const legalCount = contacts.filter(c => c.personType === 'legal').length;
  const naturalCount = contacts.filter(c => c.personType === 'natural').length;
  const legalPct = totalCount > 0 ? Math.round((legalCount / totalCount) * 100) : 0;

  const supplierCount = contacts.filter(c => c.types.includes('supplier')).length;
  const serviceCount = contacts.filter(c => c.types.includes('service')).length;
  const sponsorCount = contacts.filter(c => c.types.includes('sponsor')).length;
  const donorCount = contacts.filter(c => c.types.includes('donor')).length;
  const authorityCount = contacts.filter(c => c.types.includes('authority')).length;
  const associationCount = contacts.filter(c => c.types.includes('association')).length;
  const cooperationCount = contacts.filter(c => c.types.includes('partner')).length;
  const otherCount = contacts.filter(c => c.types.includes('other')).length;

  // Filtered & Sorted Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = (c.displayName || '').toLowerCase().includes(query);
        const matchCompany = (c.companyName || '').toLowerCase().includes(query);
        const matchNumber = (c.contactNumber || '').toLowerCase().includes(query);
        const matchEmail = (c.email || '').toLowerCase().includes(query);
        const matchPhone = (c.phone || '').toLowerCase().includes(query);
        const matchCity = (c.address?.city || '').toLowerCase().includes(query);
        const matchZip = (c.address?.zip || '').toLowerCase().includes(query);
        const matchNotes = (c.notes || '').toLowerCase().includes(query);
        const matchTags = (c.tags || []).some(t => t.toLowerCase().includes(query));
        const matchContactPerson =
          c.contactPerson &&
          `${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''} ${c.contactPerson.roleOrPosition || ''}`
            .toLowerCase()
            .includes(query);

        if (
          !matchName &&
          !matchCompany &&
          !matchNumber &&
          !matchEmail &&
          !matchPhone &&
          !matchCity &&
          !matchZip &&
          !matchNotes &&
          !matchTags &&
          !matchContactPerson
        ) {
          return false;
        }
      }

      // 2. Person type filter
      if (personTypeFilter !== 'all' && c.personType !== personTypeFilter) {
        return false;
      }

      // 3. Contact type filter
      if (contactTypeFilter !== 'all') {
        if (!c.types.includes(contactTypeFilter as ContactType)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.displayName || '').localeCompare(b.displayName || '', 'de');
      } else if (sortBy === 'number') {
        comparison = (a.contactNumber || '').localeCompare(b.contactNumber || '', 'de', { numeric: true });
      } else if (sortBy === 'city') {
        comparison = (a.address?.city || '').localeCompare(b.address?.city || '', 'de');
      } else if (sortBy === 'types') {
        const labelsA = a.types.map(t => CONTACT_TYPE_MAP.get(t)?.label || t).join(', ');
        const labelsB = b.types.map(t => CONTACT_TYPE_MAP.get(t)?.label || t).join(', ');
        comparison = labelsA.localeCompare(labelsB, 'de');
      } else if (sortBy === 'communication') {
        comparison = (a.email || a.phone || '').localeCompare(b.email || b.phone || '', 'de');
      } else if (sortBy === 'iban') {
        comparison = (a.bankDetails?.iban || '').localeCompare(b.bankDetails?.iban || '', 'de');
      } else if (sortBy === 'dateOfBirth') {
        comparison = (a.dateOfBirth || '').localeCompare(b.dateOfBirth || '', 'de');
      } else if (sortBy === 'mobile') {
        comparison = (a.mobile || '').localeCompare(b.mobile || '', 'de');
      } else if (sortBy === 'website') {
        comparison = (a.website || '').localeCompare(b.website || '', 'de');
      } else if (sortBy === 'taxId') {
        comparison = (a.taxId || '').localeCompare(b.taxId || '', 'de');
      } else if (sortBy === 'commercialRegister') {
        comparison = (a.commercialRegister || '').localeCompare(b.commercialRegister || '', 'de');
      } else if (sortBy === 'creditorOrDebtorNumber') {
        comparison = (a.creditorOrDebtorNumber || '').localeCompare(b.creditorOrDebtorNumber || '', 'de');
      } else if (sortBy === 'notes') {
        comparison = (a.notes || '').localeCompare(b.notes || '', 'de');
      } else if (sortBy === 'bic') {
        comparison = (a.bankDetails?.bic || '').localeCompare(b.bankDetails?.bic || '', 'de');
      } else if (sortBy === 'accountHolder') {
        comparison = (a.bankDetails?.accountHolder || '').localeCompare(b.bankDetails?.accountHolder || '', 'de');
      } else if (sortBy === 'tags') {
        comparison = (a.tags || []).join(', ').localeCompare((b.tags || []).join(', '), 'de');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contacts, searchQuery, personTypeFilter, contactTypeFilter, sortBy, sortDirection]);

  // Bulk actions handlers
  const {
    pageItems: paginatedContacts,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
  } = usePagination(filteredContacts, [searchQuery, personTypeFilter, contactTypeFilter, sortBy, sortDirection].join('|'));

  const { seiteKomplett, seiteTeilweise, allesKomplett } = ermittleSeitenStatus(selectedIds, paginatedContacts, filteredContacts);

  const handleSelectAll = () => {
    setSelectedIds(prev => wechsleSeite(prev, paginatedContacts));
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(prev => waehleAlleGefilterten(prev, filteredContacts));
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

  const handleExportCSV = () => {
    const toExport =
      selectedIds.size > 0
        ? contacts.filter(c => selectedIds.has(c.id))
        : filteredContacts;
    ExportService.exportContactsCSV(
      toExport,
      `kontakte_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const toExport =
      selectedIds.size > 0
        ? contacts.filter(c => selectedIds.has(c.id))
        : filteredContacts;
    ExportService.exportContactsPDF(
      toExport,
      clubName,
      selectedIds.size > 0 ? 'Ausgewählte Kontakte' : 'Aktuelle Kontaktliste'
    );
  };

  const handleBulkDelete = async () => {
    if (!onBulkDeleteContacts || selectedIds.size === 0) return;
    if (
      window.confirm(
        `Möchten Sie ${selectedIds.size} ausgewählte Kontakte wirklich unwiderruflich löschen?`
      )
    ) {
      await onBulkDeleteContacts(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 relative pb-16">

      {/* Metric Cards: Kontakte Gesamt & Kontakte nach Kategorie/Rolle */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kachel 1: Kontakte Gesamt */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kontakte Gesamt
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                {legalPct}% Firmen
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 leading-none">
                {totalCount}
              </h3>
              {(personTypeFilter !== 'all' || contactTypeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPersonTypeFilter('all');
                    setContactTypeFilter('all');
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Filter aufheben"
                >
                  <span>Filter aufheben</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
            {/* Firmen Filter Button */}
            <button
              type="button"
              onClick={() => setPersonTypeFilter(personTypeFilter === 'legal' ? 'all' : 'legal')}
              className={`py-2.5 px-3 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                personTypeFilter === 'legal'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/40'
                  : 'bg-blue-50/70 hover:bg-blue-100 border-blue-200 text-slate-800'
              }`}
              title="Nach juristischen Personen (Firmen) filtern"
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${personTypeFilter === 'legal' ? 'text-blue-100' : 'text-blue-700'}`}>
                🏢 Firmen
              </p>
              <p className={`text-base font-bold font-mono ${personTypeFilter === 'legal' ? 'text-white' : 'text-blue-900'}`}>
                {legalCount}
              </p>
            </button>

            {/* Privat Filter Button */}
            <button
              type="button"
              onClick={() => setPersonTypeFilter(personTypeFilter === 'natural' ? 'all' : 'natural')}
              className={`py-2.5 px-3 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center group ${
                personTypeFilter === 'natural'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
              title="Nach natürlichen Personen (Privat) filtern"
            >
              <p className={`text-[10px] uppercase font-bold tracking-wider ${personTypeFilter === 'natural' ? 'text-slate-200' : 'text-slate-600'}`}>
                👤 Privat
              </p>
              <p className={`text-base font-bold font-mono ${personTypeFilter === 'natural' ? 'text-white' : 'text-slate-800'}`}>
                {naturalCount}
              </p>
            </button>
          </div>
        </div>

        {/* Kachel 2: Kontakte je Rolle / Typ */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kontakte je Rolle / Typ
                </p>
                <p className="text-[11px] text-slate-400">
                  Geschäftspartner, Förderer & Institutionen
                </p>
              </div>
            </div>
            {contactTypeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setContactTypeFilter('all')}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Filter aufheben</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'supplier', label: 'Lieferanten', count: supplierCount, desc: 'Waren & Handel' },
              { id: 'service', label: 'Dienstleister', count: serviceCount, desc: 'Handwerk & Service' },
              { id: 'sponsor', label: 'Sponsoren', count: sponsorCount, desc: 'Werbepartner' },
              { id: 'donor', label: 'Spender', count: donorCount, desc: 'Zuwendungen' },
              { id: 'authority', label: 'Behörden / Ämter', count: authorityCount, desc: 'Stadt, Finanzen' },
              { id: 'association', label: 'Verbände', count: associationCount, desc: 'LSB, Fachverbände' },
              { id: 'partner', label: 'Partner', count: cooperationCount, desc: 'Schulen, Kooperation' },
              { id: 'other', label: 'Sonstige', count: otherCount, desc: 'Weitere Kontakte' }
            ].map(item => {
              const isFiltered = contactTypeFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setContactTypeFilter(isFiltered ? 'all' : item.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between group cursor-pointer ${
                    isFiltered
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 border-slate-200 text-slate-800'
                  }`}
                  title={`Nach ${item.label} filtern`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold truncate ${isFiltered ? 'text-white' : 'text-slate-800 group-hover:text-indigo-900'}`}>
                      {item.label}
                    </span>
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.2 rounded-full ${
                      isFiltered ? 'bg-indigo-700 text-white' : 'bg-slate-200/70 text-slate-700'
                    }`}>
                      {item.count}
                    </span>
                  </div>
                  <span className={`text-[10px] truncate ${isFiltered ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {item.desc}
                  </span>
                </button>
              );
            })}
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
                <span>{selectedIds.size} Kontakt{selectedIds.size > 1 ? 'e' : ''} ausgewählt</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Wählen Sie eine Sammelaktion für alle markierten Kontakte
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {onBulkDeleteContacts && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Alle markierten Kontakte löschen"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ausgewählte löschen</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Nur ausgewählte Kontakte als CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Nur ausgewählte Kontakte als PDF exportieren"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-400" />
              <span>PDF</span>
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

      {/* Main Table Card Container (genau wie in der Mitgliederverwaltung) */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
        {/* Table Top Header with Title and Action buttons in their own row */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest">
              Aktuelle Kontaktliste
            </h4>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {filteredContacts.length}
            </span>
            {selectedIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                {selectedIds.size} markiert
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="text-xs bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Kontakte aus Google Sheets oder CSV-Datei importieren"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>CSV / Sheets Import</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
              title="Gefilterte Kontakte als Excel-CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
              title="Druckreife Kontaktliste als PDF herunterladen"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF Liste</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Neuen Kontakt anlegen"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neuer Kontakt</span>
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
              placeholder="Suche nach Name, Firma, Ansprechpartner, Ort, E-Mail..."
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

          {/* Person Type Filter */}
          <select
            value={personTypeFilter}
            onChange={e => setPersonTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Personenarten</option>
            <option value="legal">🏢 Juristische Personen (Firmen)</option>
            <option value="natural">👤 Natürliche Personen (Privat)</option>
          </select>

          {/* Contact Type Filter */}
          <select
            value={contactTypeFilter}
            onChange={e => setContactTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Kontakttypen</option>
            {CONTACT_TYPES_LIST.map(meta => (
              <option key={meta.id} value={meta.id}>
                {meta.label}
              </option>
            ))}
          </select>

          {/* Reset Filter Button */}
          {(personTypeFilter !== 'all' || contactTypeFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPersonTypeFilter('all');
                setContactTypeFilter('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 ml-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filter zurücksetzen</span>
            </button>
          )}
        </div>

        {/* Tabular Contacts List */}
        {/* Eigener, nach oben begrenzter Scroll-Bereich (Breite UND Höhe) —
            der seitliche Scrollbalken sitzt dadurch immer direkt unter den
            Zeilen, auch bei langen Seiten (siehe ausführlicher Kommentar in
            MembersView.tsx bzw. in App.tsx, warum der vorherige Versuch
            nicht funktioniert hat). */}
        <AuswahlLeiste
          anzahlAusgewaehlt={selectedIds.size}
          anzahlAufSeite={paginatedContacts.length}
          anzahlGefiltert={filteredContacts.length}
          seiteKomplett={seiteKomplett}
          allesKomplett={allesKomplett}
          einzahl="Kontakt"
          mehrzahl="Kontakte"
          onAlleAuswaehlen={handleSelectAllFiltered}
          onAuswahlAufheben={handleClearSelection}
        />
        <div className="overflow-auto max-h-[65vh]">
          <table
            ref={tableRef}
            className="text-left border-collapse text-sm"
            style={{
              tableLayout: 'fixed',
              minWidth: '100%',
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
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th
                  style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH }}
                  className="px-3 py-3 text-center sticky top-0 z-10 bg-slate-50 border-b border-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={seiteKomplett}
                    ref={input => {
                      if (input) input.indeterminate = seiteTeilweise;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Alle Einträge dieser Seite auswählen"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                {visibleColumnOrder.map(key => contactHeaderDefs[key])}
                <th
                  style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                  className="px-4 py-3 text-right whitespace-nowrap sticky top-0 z-10 bg-slate-50 border-b border-slate-200"
                >
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredContacts.length > 0 ? (
                paginatedContacts.map(contact => {
                  const isSelected = selectedIds.has(contact.id);
                  const isCompany = contact.personType === 'legal';

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => onOpenDetails(contact)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-blue-50/70 hover:bg-blue-100/60'
                          : 'hover:bg-blue-50/40'
                      }`}
                      title="Klicken für Kontaktdetails"
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-4"
                        onClick={e => handleToggleSelect(contact.id, e)}
                      >
                        <button
                          type="button"
                          className="text-slate-300 group-hover:text-slate-500 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {(() => {
                        const contactCellDefs: Record<string, React.ReactNode> = {
                          number: (
                            <td key="number" data-col-content="number" className="py-3.5 px-3 font-mono font-semibold text-slate-700 truncate">
                              {contact.contactNumber}
                            </td>
                          ),
                          name: (
                            <td key="name" data-col-content="name" className="py-3.5 px-4 overflow-hidden">
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                    isCompany
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isCompany ? (
                                    <Building2 className="w-4 h-4" />
                                  ) : (
                                    <User className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{contact.displayName}</span>
                                    {contact.legalForm && (
                                      <span className="text-2xs font-normal text-slate-400">
                                        ({contact.legalForm})
                                      </span>
                                    )}
                                  </div>

                                  {/* Ansprechpartner if company */}
                                  {isCompany && contact.contactPerson && (
                                    <div className="text-2xs text-slate-500 flex items-center gap-1 mt-0.5">
                                      <span className="text-slate-400">AP:</span>
                                      <span>
                                        {[
                                          contact.contactPerson.firstName,
                                          contact.contactPerson.lastName
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                        {contact.contactPerson.roleOrPosition &&
                                          ` • ${contact.contactPerson.roleOrPosition}`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Tags */}
                                  {contact.tags && contact.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {contact.tags.slice(0, 2).map(tag => (
                                        <span
                                          key={tag}
                                          className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-3xs font-medium"
                                        >
                                          #{tag}
                                        </span>
                                      ))}
                                      {contact.tags.length > 2 && (
                                        <span className="text-3xs text-slate-400">
                                          +{contact.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          ),
                          types: (
                            <td key="types" data-col-content="types" className="py-3.5 px-3 overflow-hidden">
                              <div className="flex flex-wrap gap-1">
                                {contact.types.map(t => {
                                  const meta = CONTACT_TYPE_MAP.get(t);
                                  return (
                                    <span
                                      key={t}
                                      className={`px-2 py-0.5 rounded-full text-2xs font-semibold border ${
                                        meta?.badgeBg || 'bg-slate-100'
                                      } ${meta?.badgeText || 'text-slate-700'} ${
                                        meta?.badgeBorder || 'border-slate-200'
                                      }`}
                                    >
                                      {meta?.label || t}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          ),
                          communication: (
                            <td key="communication" data-col-content="communication" className="py-3.5 px-3 overflow-hidden">
                              <div className="space-y-1">
                                {contact.email ? (
                                  <a
                                    href={`mailto:${contact.email}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    title={contact.email}
                                  >
                                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    <span className="truncate">
                                      {contact.email}
                                    </span>
                                  </a>
                                ) : (
                                  <span className="text-slate-300 text-2xs">Keine Mail</span>
                                )}

                                {contact.phone && (
                                  <a
                                    href={`tel:${contact.phone}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-2xs text-slate-600 hover:text-blue-600 flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                                    <span>{contact.phone}</span>
                                  </a>
                                )}
                              </div>
                            </td>
                          ),
                          city: (
                            <td key="city" data-col-content="city" className="py-3.5 px-3 text-slate-700 overflow-hidden">
                              {contact.address?.city ? (
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {contact.address.zip} {contact.address.city}
                                  </div>
                                  {contact.address.street && (
                                    <div className="text-2xs text-slate-400">
                                      {contact.address.street}{' '}
                                      {contact.address.houseNumber}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-2xs">-</span>
                              )}
                            </td>
                          ),
                          iban: (
                            <td key="iban" data-col-content="iban" className="py-3.5 px-3 overflow-hidden">
                              {contact.bankDetails?.iban ? (
                                <div className="font-mono text-2xs text-slate-700">
                                  <span>
                                    {contact.bankDetails.iban.slice(0, 4)} ...{' '}
                                    {contact.bankDetails.iban.slice(-4)}
                                  </span>
                                  {contact.bankDetails.bankName && (
                                    <div className="text-3xs text-slate-400 truncate">
                                      {contact.bankDetails.bankName}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-2xs">-</span>
                              )}
                            </td>
                          ),
                          dateOfBirth: (
                            <td key="dateOfBirth" data-col-content="dateOfBirth" className="py-3.5 px-3 text-slate-600 whitespace-nowrap overflow-hidden">
                              {contact.dateOfBirth
                                ? new Date(contact.dateOfBirth).toLocaleDateString('de-DE')
                                : <span className="text-slate-300 text-2xs">-</span>}
                            </td>
                          ),
                          mobile: (
                            <td key="mobile" data-col-content="mobile" className="py-3.5 px-3 overflow-hidden">
                              {contact.mobile ? (
                                <a
                                  href={`tel:${contact.mobile}`}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs text-slate-700 hover:text-blue-600 truncate"
                                >
                                  {contact.mobile}
                                </a>
                              ) : (
                                <span className="text-slate-300 text-2xs">-</span>
                              )}
                            </td>
                          ),
                          website: (
                            <td key="website" data-col-content="website" className="py-3.5 px-3 overflow-hidden">
                              {contact.website ? (
                                <a
                                  href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs text-blue-600 hover:underline truncate block"
                                  title={contact.website}
                                >
                                  {contact.website}
                                </a>
                              ) : (
                                <span className="text-slate-300 text-2xs">-</span>
                              )}
                            </td>
                          ),
                          taxId: (
                            <td key="taxId" data-col-content="taxId" className="py-3.5 px-3 font-mono text-xs text-slate-600 truncate overflow-hidden">
                              {contact.taxId || <span className="text-slate-300 font-sans text-2xs">-</span>}
                            </td>
                          ),
                          commercialRegister: (
                            <td key="commercialRegister" data-col-content="commercialRegister" className="py-3.5 px-3 text-xs text-slate-600 truncate overflow-hidden">
                              {contact.commercialRegister || <span className="text-slate-300 text-2xs">-</span>}
                            </td>
                          ),
                          creditorOrDebtorNumber: (
                            <td key="creditorOrDebtorNumber" data-col-content="creditorOrDebtorNumber" className="py-3.5 px-3 font-mono text-xs text-slate-600 truncate overflow-hidden">
                              {contact.creditorOrDebtorNumber || <span className="text-slate-300 font-sans text-2xs">-</span>}
                            </td>
                          ),
                          notes: (
                            <td
                              key="notes"
                              data-col-content="notes"
                              className="py-3.5 px-3 text-slate-500 text-xs truncate overflow-hidden"
                              title={contact.notes || undefined}
                            >
                              {contact.notes || <span className="text-slate-300 text-2xs">-</span>}
                            </td>
                          ),
                          bic: (
                            <td key="bic" data-col-content="bic" className="py-3.5 px-3 font-mono text-xs text-slate-600 truncate overflow-hidden">
                              {contact.bankDetails?.bic || <span className="text-slate-300 font-sans text-2xs">-</span>}
                            </td>
                          ),
                          accountHolder: (
                            <td key="accountHolder" data-col-content="accountHolder" className="py-3.5 px-3 text-xs text-slate-600 truncate overflow-hidden">
                              {contact.bankDetails?.accountHolder || <span className="text-slate-300 text-2xs">-</span>}
                            </td>
                          ),
                          tags: (
                            <td key="tags" data-col-content="tags" className="py-3.5 px-3 overflow-hidden">
                              {contact.tags && contact.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {contact.tags.map(tag => (
                                    <span
                                      key={tag}
                                      className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-3xs font-medium"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-2xs">-</span>
                              )}
                            </td>
                          )
                        };
                        return visibleColumnOrder.map(key => contactCellDefs[key]);
                      })()}

                      {/* Aktionen */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Quick Action: Create Booking */}
                          <button
                            type="button"
                            onClick={() => onCreateBookingForContact(contact)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            title="Buchung für diesen Kontakt erfassen"
                          >
                            <Receipt className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">+ Buchung</span>
                          </button>

                          {/* Quick Action: Create Invoice */}
                          {onCreateInvoiceForContact && (
                            <button
                              type="button"
                              onClick={() => onCreateInvoiceForContact(contact)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              title="Rechnung für diesen Kontakt schreiben"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">+ Rechnung</span>
                            </button>
                          )}

                          {/* Details */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetails(contact);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Details ansehen"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onOpenEdit(contact)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Kontakt bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Möchten Sie den Kontakt "${contact.displayName}" wirklich löschen?`
                                )
                              ) {
                                onDeleteContact(contact.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Kontakt löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={visibleColumnOrder.length + 2} className="py-12 text-center text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm text-slate-700">
                      Keine Kontakte gefunden
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery ||
                      contactTypeFilter !== 'all' ||
                      personTypeFilter !== 'all'
                        ? 'Versuchen Sie, die Such- und Filtereinstellungen zurückzusetzen.'
                        : 'Legen Sie Ihren ersten Kontakt an (z.B. Sponsor, Lieferant oder Spender).'}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenCreate}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      title="Neuen Kontakt anlegen"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ersten Kontakt anlegen</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {columnMenuPos && (
          <ColumnVisibilityMenu
            position={columnMenuPos}
            columns={columnOrder.map(key => ({ key, label: CONTACT_COLUMN_LABELS[key] || key }))}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            onClose={() => setColumnMenuPos(null)}
          />
        )}

        {<TablePagination
          totalItems={filteredContacts.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemName="Kontakten"
        />}

        {/* Footer pagination / stats */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500 rounded-b-xl overflow-hidden">
          <span>
            Zeige {filteredContacts.length} von {contacts.length} Kontakten
          </span>
          <span className="font-mono">
            {legalCount} Firmen • {naturalCount} Privatpersonen
          </span>
        </div>
      </section>
    </div>
  );
};
