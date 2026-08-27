import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryCategory, ItemCondition, ClubSettings } from '../types';
import { INVENTORY_CATEGORIES, CONDITION_OPTIONS } from '../data/inventoryCategories';
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
  FileSpreadsheet
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  departments: string[];
  settings: ClubSettings;
  onOpenCreate: () => void;
  onOpenEdit: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  departments,
  settings,
  onOpenCreate,
  onOpenEdit,
  onDeleteItem
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [showNeedsInspectionOnly, setShowNeedsInspectionOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
                {filteredInventory.map((item) => {
                  const catMeta = getCategoryMeta(item.category);
                  const conditionMeta = CONDITION_OPTIONS.find(c => c.value === item.condition) || CONDITION_OPTIONS[1];

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
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

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Zeige <span className="font-bold text-slate-800">{filteredInventory.length}</span> von <span className="font-bold text-slate-800">{inventory.length}</span> Inventargegenständen
            </div>
            <div className="font-medium">
              Gesamtwert der gefilterten Liste:{' '}
              <span className="font-bold text-emerald-700">
                {filteredInventory.reduce((sum, item) => sum + (item.currentValue || item.purchasePrice || 0), 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const catMeta = getCategoryMeta(item.category);
            const conditionMeta = CONDITION_OPTIONS.find(c => c.value === item.condition) || CONDITION_OPTIONS[1];

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Category & Sparte */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${catMeta.badgeBg} ${catMeta.badgeText}`}>
                      {renderCategoryIcon(item.category, 'w-3 h-3')}
                      <span>{catMeta.shortLabel}</span>
                    </span>

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
    </div>
  );
};
