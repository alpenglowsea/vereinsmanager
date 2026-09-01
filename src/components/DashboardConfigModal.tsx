import React, { useState, useMemo } from 'react';
import {
  DashboardWidgetDefinition,
  DashboardWidgetConfig,
  UserDashboardConfig,
  WidgetColSpan,
  DashboardWidgetCategory,
  DashboardPreset
} from '../types/dashboard';
import {
  AVAILABLE_DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_CONFIG,
  getPresetConfig
} from '../data/defaultDashboard';
import {
  LayoutDashboard,
  X,
  Plus,
  Trash2,
  Check,
  ArrowUp,
  ArrowDown,
  Columns,
  Sparkles,
  Users,
  Wallet,
  CalendarDays,
  Package,
  FolderArchive,
  Layers,
  Search,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  HelpCircle,
  Eye,
  Grid,
  FileSignature,
  Gift,
  UserPlus,
  BarChart3,
  ShieldCheck,
  Percent,
  CreditCard,
  FileSpreadsheet,
  HeartHandshake,
  TrendingUp,
  Building2
} from 'lucide-react';

interface DashboardConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserDashboardConfig;
  onSaveConfig: (newConfig: UserDashboardConfig) => void;
  onResetToDefault: () => void;
}

const CATEGORY_TABS: { id: DashboardWidgetCategory | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'Alle Kacheln', icon: Grid },
  { id: 'members', label: 'Mitglieder', icon: Users },
  { id: 'finance', label: 'Finanzen & Steuern', icon: Wallet },
  { id: 'calendar', label: 'Kalender & Termine', icon: CalendarDays },
  { id: 'inventory', label: 'Inventar', icon: Package },
  { id: 'documents', label: 'Dokumente & Archiv', icon: FolderArchive },
  { id: 'overview', label: 'Aktionen & Stammdaten', icon: Sparkles }
];

export const DashboardConfigModal: React.FC<DashboardConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetToDefault
}) => {
  const [activeCategory, setActiveCategory] = useState<DashboardWidgetCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [localWidgets, setLocalWidgets] = useState<DashboardWidgetConfig[]>(() => {
    return [...config.widgets];
  });
  const [selectedPreset, setSelectedPreset] = useState<DashboardPreset | null>(null);

  // Sync if config changes
  React.useEffect(() => {
    setLocalWidgets([...config.widgets]);
  }, [config, isOpen]);

  if (!isOpen) return null;

  // Map of widget definitions for quick lookup
  const definitionsMap = useMemo(() => {
    const map = new Map<string, DashboardWidgetDefinition>();
    AVAILABLE_DASHBOARD_WIDGETS.forEach((def) => map.set(def.id, def));
    return map;
  }, []);

  // Filtered definitions based on category & search
  const filteredDefinitions = useMemo(() => {
    return AVAILABLE_DASHBOARD_WIDGETS.filter((w) => {
      const matchCategory = activeCategory === 'all' || w.category === activeCategory;
      const matchSearch =
        searchTerm === '' ||
        w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchTerm]);

  // Active enabled widgets sorted by order
  const activeWidgets = useMemo(() => {
    return [...localWidgets]
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order);
  }, [localWidgets]);

  const activeCount = activeWidgets.length;

  // Toggle widget enabled state (1-Click Add/Remove)
  const handleToggleWidget = (id: string) => {
    setLocalWidgets((prev) => {
      const existing = prev.find((w) => w.id === id);
      const def = definitionsMap.get(id);
      if (existing) {
        return prev.map((w) => {
          if (w.id === id) {
            const willEnable = !w.enabled;
            // If enabling, set order to max order + 1
            const maxOrder = Math.max(0, ...prev.filter((p) => p.enabled).map((p) => p.order));
            return {
              ...w,
              enabled: willEnable,
              order: willEnable ? maxOrder + 1 : w.order
            };
          }
          return w;
        });
      } else if (def) {
        const maxOrder = Math.max(0, ...prev.filter((p) => p.enabled).map((p) => p.order));
        return [
          ...prev,
          {
            id: def.id,
            enabled: true,
            order: maxOrder + 1,
            colSpan: def.defaultColSpan
          }
        ];
      }
      return prev;
    });
  };

  // Change ColSpan for a widget
  const handleChangeColSpan = (id: string, colSpan: WidgetColSpan) => {
    setLocalWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, colSpan } : w))
    );
  };

  // Move widget up in order
  const handleMoveUp = (id: string) => {
    const sorted = [...activeWidgets];
    const index = sorted.findIndex((w) => w.id === id);
    if (index <= 0) return;

    const current = sorted[index];
    const prev = sorted[index - 1];

    setLocalWidgets((all) =>
      all.map((w) => {
        if (w.id === current.id) return { ...w, order: prev.order };
        if (w.id === prev.id) return { ...w, order: current.order };
        return w;
      })
    );
  };

  // Move widget down in order
  const handleMoveDown = (id: string) => {
    const sorted = [...activeWidgets];
    const index = sorted.findIndex((w) => w.id === id);
    if (index === -1 || index >= sorted.length - 1) return;

    const current = sorted[index];
    const next = sorted[index + 1];

    setLocalWidgets((all) =>
      all.map((w) => {
        if (w.id === current.id) return { ...w, order: next.order };
        if (w.id === next.id) return { ...w, order: current.order };
        return w;
      })
    );
  };

  // Apply a Preset
  const handleApplyPreset = (preset: DashboardPreset) => {
    setSelectedPreset(preset);
    const newConfig = getPresetConfig(preset);
    setLocalWidgets(newConfig.widgets);
  };

  // Save changes
  const handleSave = () => {
    onSaveConfig({
      version: 1,
      widgets: localWidgets,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  // Get icon component by name
  const renderIcon = (iconName: string, className = 'w-5 h-5') => {
    switch (iconName) {
      case 'Users': return <Users className={className} />;
      case 'FileSignature': return <FileSignature className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Gift': return <Gift className={className} />;
      case 'UserPlus': return <UserPlus className={className} />;
      case 'BarChart3': return <BarChart3 className={className} />;
      case 'Wallet': return <Wallet className={className} />;
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'Percent': return <Percent className={className} />;
      case 'CreditCard': return <CreditCard className={className} />;
      case 'FileSpreadsheet': return <FileSpreadsheet className={className} />;
      case 'HeartHandshake': return <HeartHandshake className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'CalendarDays': return <CalendarDays className={className} />;
      case 'Package': return <Package className={className} />;
      case 'FolderArchive': return <FolderArchive className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Building2': return <Building2 className={className} />;
      default: return <Grid className={className} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-config-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 id="dashboard-config-title" className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Modulares Dashboard anpassen
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wählen Sie Kacheln aus allen Vereinsbereichen, passen Sie Reihenfolge und Spaltenbreiten an.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Layout-Vorlagen:</span>
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset('default')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedPreset === 'default'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Standard (Empfohlen)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('finance')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedPreset === 'finance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Finanz- & Kassenfokus
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('members')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedPreset === 'members'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Mitglieder & Sportbetrieb
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('compact')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedPreset === 'compact'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Kompakt
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedPreset === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Alle Kacheln
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold text-2xs">
              {activeCount} von {AVAILABLE_DASHBOARD_WIDGETS.length} Kacheln aktiv
            </span>
          </div>
        </div>

        {/* Category Navigation & Search */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              const count =
                tab.id === 'all'
                  ? AVAILABLE_DASHBOARD_WIDGETS.length
                  : AVAILABLE_DASHBOARD_WIDGETS.filter((w) => w.category === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Kacheln durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-blue-500 rounded-xl outline-hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body: Available Widgets Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDefinitions.map((def) => {
              const widgetConfig = localWidgets.find((w) => w.id === def.id);
              const isEnabled = widgetConfig?.enabled ?? false;
              const currentColSpan = widgetConfig?.colSpan ?? def.defaultColSpan;

              return (
                <div
                  key={def.id}
                  className={`p-4.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isEnabled
                      ? 'bg-white dark:bg-slate-800/90 border-blue-500/60 dark:border-blue-500 shadow-xs ring-2 ring-blue-500/10'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 opacity-80 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isEnabled
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {renderIcon(def.iconName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {def.title}
                          </h3>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {def.categoryLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {def.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Size Controls */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    {/* Size Selector if enabled */}
                    {isEnabled ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Breite:</span>
                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
                          {([1, 2, 4] as WidgetColSpan[]).map((span) => (
                            <button
                              key={span}
                              type="button"
                              onClick={() => handleChangeColSpan(def.id, span)}
                              className={`px-2 py-0.5 text-2xs font-bold rounded-md transition-colors cursor-pointer ${
                                currentColSpan === span
                                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {span === 1 ? '1 Spalte' : span === 2 ? '2 Spalten' : 'Vollbreite'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Standardbreite: {def.defaultColSpan === 4 ? 'Vollbreite' : `${def.defaultColSpan} Spalte(n)`}
                      </span>
                    )}

                    {/* 1-Click Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleWidget(def.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        isEnabled
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-sm'
                      }`}
                    >
                      {isEnabled ? (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Entfernen</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Hinzufügen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDefinitions.length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Keine Kacheln für diesen Suchbegriff gefunden.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('all');
                }}
                className="mt-2 text-xs text-blue-600 hover:underline font-bold"
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Dashboard-Layout wirklich auf das Standard-Layout zurücksetzen?')) {
                onResetToDefault();
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Auf Standard zurücksetzen</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Layout speichern & anwenden</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
