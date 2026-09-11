import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryCategory, ItemCondition, ClubSettings, InventoryBulkUpdates } from '../types';
import { INVENTORY_CATEGORIES, CONDITION_OPTIONS } from '../data/inventoryCategories';
import { StorageService } from '../services/storage';
import { ExportService } from '../services/exportService';
import { TablePagination } from './TablePagination';
import { InventoryBulkEditModal } from './InventoryBulkEditModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Trophy,
  Shirt,
  Boxes,
  Wrench,
  Radio,
  HeartPulse,
  Armchair,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Tag,
  Edit2,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  FileDown,
  X
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  departments: string[];
  settings: ClubSettings;
  onOpenCreate: () => void;
  onOpenEdit: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onBulkUpdateItems?: (ids: string[], updates: InventoryBulkUpdates) => Promise<void>;
  onBulkDeleteItems?: (ids: string[]) => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  departments,
  settings,
  onOpenCreate,
  onOpenEdit,
  onDeleteItem,
  onBulkUpdateItems,
  onBulkDeleteItems
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [showNeedsInspectionOnly, setShowNeedsInspectionOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Pagination state (25, 50, 100, or 'all')
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartment, selectedCategory, selectedCondition, showNeedsInspectionOnly]);

  // Departments list including Gesamtverein
  const allDepartments = useMemo(() => {
    const list = ['Gesamtverein', ...departments.filter(d => d !== 'Gesamtverein')];
    return Array.from(new Set(list));
  }, [departments]);

  // Filtered & Searched Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = item.itemNumber.toLowerCase().includes(q);
        const matchesLoc = item.location.toLowerCase().includes(q);
        const matchesResp = (item.responsiblePerson || '').toLowerCase().includes(q);
        const matchesAssigned = (item.assignedTo || '').toLowerCase().includes(q);
        const matchesSupplier = (item.supplier || '').toLowerCase().includes(q);
        const matchesSerial = (item.serialNumber || '').toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);

        if (!matchesName && !matchesCode && !matchesLoc && !matchesResp && !matchesAssigned && !matchesSupplier && !matchesSerial && !matchesNotes) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartment !== 'all' && item.department !== selectedDepartment) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Condition filter
      if (selectedCondition !== 'all' && item.condition !== selectedCondition) {
        return false;
      }

      // Needs inspection / overdue filter
      if (showNeedsInspectionOnly) {
        if (!item.nextInspectionDate) return false;
        const now = new Date().toISOString().split('T')[0];
        const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        // Overdue or within next 30 days
        if (item.nextInspectionDate > nextMonth) return false;
      }

      return true;
    });
  }, [inventory, searchQuery, selectedDepartment, selectedCategory, selectedCondition, showNeedsInspectionOnly]);

  // Paginated Inventory slice
  const paginatedInventory = useMemo(() => {
    if (pageSize === 'all') return filteredInventory;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredInventory.slice(startIndex, startIndex + pageSize);
  }, [filteredInventory, currentPage, pageSize]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCount = inventory.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const totalOriginalValue = inventory.reduce((acc, curr) => acc + (curr.purchasePrice || 0), 0);
    const totalCurrentValue = inventory.reduce((acc, curr) => acc + (curr.currentValue || curr.purchasePrice || 0), 0);
    
    // Check overdue inspections
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = inventory.filter(i => i.nextInspectionDate && i.nextInspectionDate < today).length;
    const damagedCount = inventory.filter(i => i.condition === 'damaged' || i.condition === 'in_repair').length;

    return {
      totalItems: inventory.length,
      totalCount,
      totalOriginalValue,
      totalCurrentValue,
      overdueCount,
      damagedCount
    };
  }, [inventory]);

  // Category Icon Resolver
  const getCategoryMeta = (catId: InventoryCategory) => {
    return INVENTORY_CATEGORIES.find(c => c.id === catId) || {
      id: 'other' as InventoryCategory,
      label: 'Sonstiges',
      shortLabel: 'Sonstiges',
      description: '',
      color: 'slate',
      badgeBg: 'bg-slate-100 border-slate-200',
      badgeText: 'text-slate-700',
      iconName: 'Package',
      examples: ''
    };
  };

  const renderCategoryIcon = (catId: InventoryCategory, className = 'w-4 h-4') => {
    switch (catId) {
      case 'sports_equipment': return <Trophy className={className} />;
      case 'apparel': return <Shirt className={className} />;
      case 'accessories': return <Boxes className={className} />;
      case 'facility': return <Wrench className={className} />;
      case 'electronics': return <Radio className={className} />;
      case 'medical': return <HeartPulse className={className} />;
      case 'furniture': return <Armchair className={className} />;
      default: return <Package className={className} />;
    }
  };

  // CSV Export for Excel
  const handleExportCSV = () => {
    const headers = [
      'Inventarnummer',
      'Bezeichnung',
      'Kategorie',
      'Sparte',
      'Menge',
      'Einheit',
      'Standort',
      'Zustand',
      'Kaufdatum',
      'Anschaffungspreis_EUR',
      'Zeitwert_EUR',
      'Lieferant',
      'Verantwortlicher',
      'Im_Einsatz_bei',
      'Seriennummer',
      'Letzte_Prüfung',
      'Nächste_Prüfung',
      'Bemerkungen'
    ];

    const rows = filteredInventory.map(item => {
      const cat = getCategoryMeta(item.category);
      const cond = CONDITION_OPTIONS.find(c => c.value === item.condition)?.label || item.condition;
      return [
        `"${item.itemNumber}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${cat.label}"`,
        `"${item.department}"`,
        item.quantity,
        `"${item.unit}"`,
        `"${(item.location || '').replace(/"/g, '""')}"`,
        `"${cond}"`,
        `"${item.purchaseDate || ''}"`,
        item.purchasePrice !== undefined ? item.purchasePrice.toFixed(2).replace('.', ',') : '',
        item.currentValue !== undefined ? item.currentValue.toFixed(2).replace('.', ',') : '',
        `"${(item.supplier || '').replace(/"/g, '""')}"`,
        `"${(item.responsiblePerson || '').replace(/"/g, '""')}"`,
        `"${(item.assignedTo || '').replace(/"/g, '""')}"`,
        `"${(item.serialNumber || '').replace(/"/g, '""')}"`,
        `"${item.lastCheckedDate || ''}"`,
        `"${item.nextInspectionDate || ''}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventarliste_${settings.clubName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Selected items objects
  const selectedItems = useMemo(() => {
    return inventory.filter(item => selectedItemIds.has(item.id));
  }, [inventory, selectedItemIds]);

  const allFilteredSelected =
    filteredInventory.length > 0 &&
    filteredInventory.every(item => selectedItemIds.has(item.id));

  const someFilteredSelected =
    filteredInventory.some(item => selectedItemIds.has(item.id)) && !allFilteredSelected;

  const handleToggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        filteredInventory.forEach(item => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        filteredInventory.forEach(item => next.add(item.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  const handleBulkUpdate = async (updates: InventoryBulkUpdates) => {
    const ids = Array.from(selectedItemIds) as string[];
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      if (onBulkUpdateItems) {
        await onBulkUpdateItems(ids, updates);
      } else {
        await StorageService.bulkUpdateInventoryItems(ids, updates);
      }
      setIsBulkEditOpen(false);
      handleClearSelection();
    } catch (err) {
      console.error('Failed to bulk update inventory items:', err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedItemIds) as string[];
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      if (onBulkDeleteItems) {
        await onBulkDeleteItems(ids);
      } else {
        await StorageService.deleteMultipleInventoryItems(ids);
      }
      setIsBulkDeleteConfirmOpen(false);
      handleClearSelection();
    } catch (err) {
      console.error('Failed to bulk delete inventory items:', err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExportSelectedCSV = () => {
    const toExport = selectedItems.length > 0 ? selectedItems : filteredInventory;
    ExportService.exportInventoryCSV(toExport, `inventar_${toExport.length}_ausgewaehlt.csv`);
  };

  const handleExportSelectedPDF = () => {
    const toExport = selectedItems.length > 0 ? selectedItems : filteredInventory;
    ExportService.exportInventoryPDF(
      toExport,
      settings,
      `inventar_${toExport.length}_ausgewaehlt.pdf`,
      `Inventarliste (${toExport.length} ausgewählt)`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Inventar- & Materialverwaltung
              </h1>
              <p className="text-xs text-slate-500">
                Vollständige Übersicht aller Sportgeräte, Trikotsätze, Vereinsausstattungen & Maschinen nach Sparte
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Inventarliste als CSV/Excel exportieren"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Excel / CSV Export</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Neuen Gegenstand erfassen</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span>Inventarpositionen</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {stats.totalItems} <span className="text-xs font-normal text-slate-500 font-sans">({stats.totalCount} Einheiten)</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Geschätzter Zeitwert</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {stats.totalCurrentValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Sparten & Abteilungen</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            {allDepartments.length} <span className="text-xs font-normal text-slate-500 font-sans">Bereiche</span>
          </div>
        </div>

        <div className={`rounded-xl p-4 border shadow-2xs ${
          stats.damagedCount > 0 || stats.overdueCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${stats.damagedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Wartung & Zustand</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {stats.damagedCount + stats.overdueCount > 0 ? (
              <span className="text-amber-700 font-bold font-mono">
                {stats.damagedCount} Reparatur{stats.overdueCount > 0 ? ` • ${stats.overdueCount} fällig` : ''}
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold text-lg flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Alles in Ordnung
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs by Department (Sparten-Tabs) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs flex items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setSelectedDepartment('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedDepartment === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Alle Sparten</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedDepartment === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {inventory.length}
            </span>
          </button>

          {allDepartments.map((dept) => {
            const count = inventory.filter(i => i.department === dept).length;
            const isSelected = selectedDepartment === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{dept}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar: Search, Category, Condition */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Inventar durchsuchen nach Name, Nummer, Standort, Zeugwart, Notizen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700"
            >
              <option value="all">Alle Material-Arten ({INVENTORY_CATEGORIES.length})</option>
              {INVENTORY_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Dropdown */}
          <div className="w-full md:w-52">
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700"
            >
              <option value="all">Alle Zustände</option>
              {CONDITION_OPTIONS.map(cond => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-2xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabelle
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow-2xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Karten
            </button>
          </div>
        </div>

        {/* Filter Pills Quick Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Schnellfilter:</span>
          {INVENTORY_CATEGORIES.slice(0, 5).map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {renderCategoryIcon(cat.id, 'w-3 h-3 text-slate-500')}
                <span>{cat.shortLabel}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowNeedsInspectionOnly(!showNeedsInspectionOnly)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
              showNeedsInspectionOnly
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Prüfung fällig (30 Tage)</span>
          </button>

          {(searchQuery || selectedDepartment !== 'all' || selectedCategory !== 'all' || selectedCondition !== 'all' || showNeedsInspectionOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDepartment('all');
                setSelectedCategory('all');
                setSelectedCondition('all');
                setShowNeedsInspectionOnly(false);
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline ml-auto"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedItemIds.size > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {selectedItemIds.size}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedItemIds.size} Gegenstand{selectedItemIds.size > 1 ? 'e' : ''} ausgewählt</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Wählen Sie eine Sammelaktion für alle markierten Inventargegenstände
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsBulkEditOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Sammelbearbeitung</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-rose-600/90 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Ausgewählte löschen</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Nur ausgewählte Gegenstände als CSV exportieren"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedPDF}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Nur ausgewählte Gegenstände als PDF exportieren"
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

      {/* Main Content: Table or Cards */}
      {filteredInventory.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Keine Inventargegenstände gefunden</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            Es wurden keine Gegenstände gefunden, die den aktuellen Filterkriterien entsprechen.
          </p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Ersten Gegenstand anlegen</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="w-10 py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={input => {
                        if (input) input.indeterminate = someFilteredSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      aria-label="Alle sichtbaren Inventargegenstände auswählen"
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">Inventar-Nr. & Gegenstand</th>
                  <th className="py-3.5 px-4">Art des Materials</th>
                  <th className="py-3.5 px-4">Sparte / Abteilung</th>
                  <th className="py-3.5 px-4">Menge</th>
                  <th className="py-3.5 px-4">Standort / Aufbewahrung</th>
                  <th className="py-3.5 px-4">Zustand</th>
                  <th className="py-3.5 px-4">Zeitwert / Anschaffung</th>
                  <th className="py-3.5 px-4">Zuständig / Einsatz</th>
                  <th className="py-3.5 px-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedInventory.map((item) => {
                  const catMeta = getCategoryMeta(item.category);
                  const conditionMeta = CONDITION_OPTIONS.find(c => c.value === item.condition) || CONDITION_OPTIONS[1];

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors group ${
                        selectedItemIds.has(item.id) ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td
                        className="w-10 py-3 px-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={(e) => handleToggleSelectItem(item.id, e)}
                          aria-label={`Gegenstand ${item.name} auswählen`}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                          <span>{item.itemNumber}</span>
                          {item.serialNumber && (
                            <span className="text-slate-400">• SN: {item.serialNumber}</span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${catMeta.badgeBg} ${catMeta.badgeText}`}>
                          {renderCategoryIcon(item.category, 'w-3 h-3')}
                          <span>{catMeta.shortLabel}</span>
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                          {item.department}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-xs">
                          {item.quantity} {item.unit}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={item.location}>{item.location}</span>
                        </div>
                      </td>

                      {/* Condition */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${conditionMeta.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${conditionMeta.dotColor}`} />
                          <span>{conditionMeta.label}</span>
                        </span>
                        {item.nextInspectionDate && (
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1" title="Nächste Sicherheitsprüfung">
                            <Clock className="w-2.5 h-2.5 text-amber-500" />
                            <span>Prüfung: {item.nextInspectionDate}</span>
                          </div>
                        )}
                      </td>

                      {/* Financial Value */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {item.currentValue !== undefined ? (
                          <div className="font-bold text-slate-900">
                            {item.currentValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                          </div>
                        ) : item.purchasePrice !== undefined ? (
                          <div className="font-bold text-slate-900">
                            {item.purchasePrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                          </div>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                        {item.purchasePrice !== undefined && item.currentValue !== undefined && item.purchasePrice !== item.currentValue && (
                          <div className="text-[10px] text-slate-400">
                            Kauf: {item.purchasePrice.toFixed(2)} €
                          </div>
                        )}
                      </td>

                      {/* Responsible / Assigned */}
                      <td className="py-3 px-4 text-xs">
                        {item.responsiblePerson ? (
                          <div className="font-medium text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="truncate max-w-[140px]" title={item.responsiblePerson}>{item.responsiblePerson}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">–</span>
                        )}
                        {item.assignedTo && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span className="truncate max-w-[140px]" title={item.assignedTo}>{item.assignedTo}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Gegenstand bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Gegenstand löschen"
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

          {/* Table Bottom Summary & Pagination */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Gesamtwert der gefilterten Liste:{' '}
              <span className="font-bold text-emerald-700">
                {filteredInventory.reduce((sum, item) => sum + (item.currentValue || item.purchasePrice || 0), 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            {stats.overdueCount > 0 && (
              <div className="text-amber-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>{stats.overdueCount} Prüfung(en) fällig</span>
              </div>
            )}
          </div>
          <TablePagination
            totalItems={filteredInventory.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemName="Inventargegenständen"
          />
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedInventory.map((item) => {
            const catMeta = getCategoryMeta(item.category);
            const conditionMeta = CONDITION_OPTIONS.find(c => c.value === item.condition) || CONDITION_OPTIONS[1];

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border ${
                  selectedItemIds.has(item.id)
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                    : 'border-slate-200/80'
                } p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between`}
              >
                <div>
                  {/* Card Header: Category & Sparte */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={(e) => handleToggleSelectItem(item.id, e)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        aria-label={`Gegenstand ${item.name} auswählen`}
                      />
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${catMeta.badgeBg} ${catMeta.badgeText}`}>
                        {renderCategoryIcon(item.category, 'w-3 h-3')}
                        <span>{catMeta.shortLabel}</span>
                      </span>
                    </div>

                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                      {item.department}
                    </span>
                  </div>

                  {/* Title & Item Number */}
                  <h3 className="font-bold text-slate-900 text-base leading-snug mb-1">
                    {item.name}
                  </h3>
                  <div className="text-xs font-mono text-slate-400 mb-3">
                    {item.itemNumber}
                  </div>

                  {/* Metadata List */}
                  <div className="space-y-2 text-xs py-3 border-y border-slate-100 text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Bestand:</span>
                      <span className="font-bold text-slate-900">{item.quantity} {item.unit}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Standort:</span>
                      <span className="font-medium text-slate-800 text-right truncate max-w-[180px]" title={item.location}>{item.location}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Zustand:</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${conditionMeta.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${conditionMeta.dotColor}`} />
                        <span>{conditionMeta.label}</span>
                      </span>
                    </div>

                    {(item.currentValue !== undefined || item.purchasePrice !== undefined) && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Zeitwert:</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          {(item.currentValue ?? item.purchasePrice ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </span>
                      </div>
                    )}

                    {item.responsiblePerson && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Zeugwart / Kontakt:</span>
                        <span className="font-medium text-slate-800 text-right truncate max-w-[160px]">{item.responsiblePerson}</span>
                      </div>
                    )}

                    {item.assignedTo && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Im Einsatz bei:</span>
                        <span className="font-medium text-blue-700 text-right truncate max-w-[160px]">{item.assignedTo}</span>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-500 mt-3 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400">
                    {item.lastCheckedDate ? `Geprüft: ${item.lastCheckedDate}` : 'Keine Prüfung erfasst'}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(item)}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Bearbeiten</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <TablePagination
              totalItems={filteredInventory.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemName="Inventargegenständen"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Gegenstand unwiderruflich löschen?</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Möchten Sie diese Inventarposition wirklich aus der Vereinsdatenbank entfernen? Dieser Schritt kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmId) {
                    onDeleteItem(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Bulk Edit Modal */}
      {isBulkEditOpen && (
        <InventoryBulkEditModal
          selectedItems={selectedItems}
          departments={allDepartments}
          onSave={handleBulkUpdate}
          onClose={() => setIsBulkEditOpen(false)}
        />
      )}

      {/* Inventory Bulk Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedItemIds.size} Gegenstand{selectedItemIds.size > 1 ? 'e' : ''} wirklich löschen?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diese Aktion kann nicht rückgängig gemacht werden. Die Löschungen werden im Revisionsprotokoll archiviert.
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-48 overflow-y-auto text-xs divide-y divide-rose-100">
              {selectedItems.map(item => (
                <div key={item.id} className="py-1.5 flex items-center justify-between text-rose-950 font-medium">
                  <div className="truncate max-w-[280px]">
                    <span className="font-mono text-rose-700 font-bold mr-2">{item.itemNumber}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-rose-800">
                    {item.quantity} {item.unit} • {item.department}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                disabled={isBulkProcessing}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkProcessing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBulkProcessing ? 'Wird gelöscht...' : `${selectedItemIds.size} Gegenstand${selectedItemIds.size > 1 ? 'e' : ''} endgültig löschen`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
