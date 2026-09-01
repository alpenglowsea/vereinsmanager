import React, { useMemo, useState } from 'react';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  InventoryItem,
  ClubDocument,
  DonationReceipt,
  OnlineMembershipApplication
} from '../types';
import { UserDashboardConfig, WidgetColSpan } from '../types/dashboard';
import { AVAILABLE_DASHBOARD_WIDGETS } from '../data/defaultDashboard';
import { WidgetWrapper } from './DashboardWidgets/WidgetWrapper';
import {
  MembersKpiWidget,
  OnlineApplicationsWidget,
  DepartmentsWidget,
  BirthdaysWidget,
  RecentMembersWidget,
  DemographicsWidget
} from './DashboardWidgets/MemberWidgets';
import {
  LiquidityWidget,
  AnnualBalanceWidget,
  WgbLimitWidget,
  TaxSpheresWidget,
  SepaMonitorWidget,
  RecentTransactionsWidget,
  DonationsWidget,
  CashflowWidget
} from './DashboardWidgets/FinanceWidgets';
import {
  QuickActionsWidget,
  ClubHeaderWidget,
  UpcomingEventsWidget,
  InventoryWidget,
  DocumentsArchiveWidget
} from './DashboardWidgets/GeneralWidgets';
import {
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  Settings2,
  FileSignature,
  ArrowRight
} from 'lucide-react';

interface DashboardViewProps {
  members: Member[];
  transactions: Transaction[];
  accounts: FinancialAccount[];
  inventory: InventoryItem[];
  documents?: ClubDocument[];
  donations?: DonationReceipt[];
  applications?: OnlineMembershipApplication[];
  settings: ClubSettings;
  dashboardConfig: UserDashboardConfig;
  onUpdateDashboardConfig: (newConfig: UserDashboardConfig) => void;
  onOpenDashboardConfigModal: () => void;
  onNavigate: (tab: any) => void;
  onOpenCreateMember: () => void;
  onOpenCreateTx: () => void;
  onOpenCreateEvent?: () => void;
  onOpenCreateInventory: () => void;
  onOpenNewDocument?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  transactions,
  accounts,
  inventory,
  documents = [],
  donations = [],
  applications = [],
  settings,
  dashboardConfig,
  onUpdateDashboardConfig,
  onOpenDashboardConfigModal,
  onNavigate,
  onOpenCreateMember,
  onOpenCreateTx,
  onOpenCreateEvent,
  onOpenCreateInventory,
  onOpenNewDocument
}) => {
  // Widget definitions lookup
  const definitionsMap = useMemo(() => {
    const map = new Map();
    AVAILABLE_DASHBOARD_WIDGETS.forEach((def) => map.set(def.id, def));
    return map;
  }, []);

  // Pending online membership applications
  const pendingApplications = useMemo(() => {
    return (applications || []).filter((a) => a.status === 'pending');
  }, [applications]);

  // Sorted enabled widgets
  const enabledWidgets = useMemo(() => {
    return [...(dashboardConfig.widgets || [])]
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order);
  }, [dashboardConfig]);

  const hasClubHeader = useMemo(() => {
    return enabledWidgets.some((w) => w.id === 'club_header');
  }, [enabledWidgets]);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  // 1-Click Remove Widget
  const handleRemoveWidget = (widgetId: string) => {
    const updated = dashboardConfig.widgets.map((w) => {
      if (w.id === widgetId) {
        return { ...w, enabled: false };
      }
      return w;
    });
    onUpdateDashboardConfig({
      ...dashboardConfig,
      widgets: updated,
      updatedAt: new Date().toISOString()
    });
  };

  // Change ColSpan
  const handleChangeColSpan = (widgetId: string, colSpan: WidgetColSpan) => {
    const updated = dashboardConfig.widgets.map((w) => {
      if (w.id === widgetId) {
        return { ...w, colSpan };
      }
      return w;
    });
    onUpdateDashboardConfig({
      ...dashboardConfig,
      widgets: updated,
      updatedAt: new Date().toISOString()
    });
  };

  // Drag & Drop Reordering Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWidgetId(id);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const handleDragEnter = (_e: React.DragEvent, id: string) => {
    if (draggedWidgetId && draggedWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedWidgetId;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);

    if (!sourceId || sourceId === targetId) return;

    const list = [...enabledWidgets];
    const fromIndex = list.findIndex((w) => w.id === sourceId);
    const toIndex = list.findIndex((w) => w.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    // Re-assign normalized sequential order
    const orderMap = new Map(list.map((w, idx) => [w.id, (idx + 1) * 10]));
    const updated = dashboardConfig.widgets.map((w) => {
      if (orderMap.has(w.id)) {
        return { ...w, order: orderMap.get(w.id)! };
      }
      return w;
    });

    onUpdateDashboardConfig({
      ...dashboardConfig,
      widgets: updated,
      updatedAt: new Date().toISOString()
    });
  };

  // Render individual widget component
  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case 'quick_actions':
        return (
          <QuickActionsWidget
            onOpenCreateMember={onOpenCreateMember}
            onOpenCreateTx={onOpenCreateTx}
            onOpenCreateEvent={onOpenCreateEvent}
            onOpenCreateInventory={onOpenCreateInventory}
            onOpenNewDocument={onOpenNewDocument}
          />
        );
      case 'club_header':
        return <ClubHeaderWidget settings={settings} onNavigate={onNavigate} />;
      case 'members_kpi':
        return <MembersKpiWidget members={members} onNavigate={onNavigate} />;
      case 'online_applications_kpi':
        return <OnlineApplicationsWidget applications={applications} onNavigate={onNavigate} />;
      case 'departments_distribution':
        return <DepartmentsWidget members={members} onNavigate={onNavigate} />;
      case 'upcoming_birthdays':
        return <BirthdaysWidget members={members} onNavigate={onNavigate} />;
      case 'recent_members':
        return <RecentMembersWidget members={members} onNavigate={onNavigate} />;
      case 'demographics_distribution':
        return <DemographicsWidget members={members} onNavigate={onNavigate} />;
      case 'total_liquidity':
        return <LiquidityWidget accounts={accounts} transactions={transactions} onNavigate={onNavigate} />;
      case 'annual_balance':
        return <AnnualBalanceWidget transactions={transactions} onNavigate={onNavigate} />;
      case 'wgb_limit_monitor':
        return <WgbLimitWidget transactions={transactions} onNavigate={onNavigate} />;
      case 'tax_spheres_overview':
        return <TaxSpheresWidget transactions={transactions} onNavigate={onNavigate} />;
      case 'sepa_debit_monitor':
        return <SepaMonitorWidget members={members} settings={settings} onNavigate={onNavigate} />;
      case 'recent_journal_transactions':
        return <RecentTransactionsWidget transactions={transactions} onNavigate={onNavigate} />;
      case 'donations_summary':
        return <DonationsWidget donations={donations} onNavigate={onNavigate} />;
      case 'cashflow_chart':
        return <CashflowWidget transactions={transactions} onNavigate={onNavigate} />;
      case 'upcoming_events':
        return <UpcomingEventsWidget onNavigate={onNavigate} onOpenCreateEvent={onOpenCreateEvent} />;
      case 'inventory_overview':
        return <InventoryWidget inventory={inventory} onNavigate={onNavigate} />;
      case 'documents_archive_kpi':
        return <DocumentsArchiveWidget documents={documents} onNavigate={onNavigate} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Modular Widgets Grid with Dense Gap-Free Layout */}
      {enabledWidgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 [grid-auto-flow:dense]">
          {/* If club_header is not enabled, show pending applications banner at the top */}
          {!hasClubHeader && pendingApplications.length > 0 && (
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xs shrink-0 animate-bounce">
                  <FileSignature className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider bg-amber-500 text-white">
                      {pendingApplications.length === 1
                        ? '1 neuer Aufnahmeantrag'
                        : `${pendingApplications.length} neue Aufnahmeanträge`}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100">
                      {pendingApplications.length === 1
                        ? 'Neuer digitaler Mitgliedsantrag eingegangen'
                        : 'Neue digitale Mitgliedsanträge eingegangen'}
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1">
                    Es liegen neue Online-Mitgliedsanträge zur satzungsgemäßen Prüfung und Freigabe vor:{' '}
                    <span className="font-semibold">
                      {pendingApplications.slice(0, 3).map((a) => `${a.firstName || (a as any).formData?.firstName || 'Antragsteller'} ${a.lastName || (a as any).formData?.lastName || ''} (${a.department || (a as any).formData?.department || 'Allgemein'})`).join(', ')}
                      {pendingApplications.length > 3 && ` und ${pendingApplications.length - 3} weitere`}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('online_applications')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
              >
                <span>Antragsportal öffnen & prüfen ({pendingApplications.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {enabledWidgets.map((widget, index) => {
            const def = definitionsMap.get(widget.id);
            if (!def) return null;

            const isClubHeader = widget.id === 'club_header';

            return (
              <React.Fragment key={widget.id}>
                <WidgetWrapper
                  id={widget.id}
                  title={def.title}
                  categoryLabel={def.categoryLabel}
                  colSpan={widget.colSpan}
                  isDragging={draggedWidgetId === widget.id}
                  isDragOver={dragOverWidgetId === widget.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragEnter={handleDragEnter}
                  onDrop={handleDrop}
                  onRemove={() => handleRemoveWidget(widget.id)}
                  onChangeColSpan={(newSpan) => handleChangeColSpan(widget.id, newSpan)}
                  onNavigate={() => {}}
                >
                  {renderWidgetContent(widget.id)}
                </WidgetWrapper>

                {/* If this is the club_header widget and there are pending applications, render full-width alert directly under it */}
                {isClubHeader && pendingApplications.length > 0 && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xs shrink-0 animate-bounce">
                        <FileSignature className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider bg-amber-500 text-white">
                            {pendingApplications.length === 1
                              ? '1 neuer Aufnahmeantrag'
                              : `${pendingApplications.length} neue Aufnahmeanträge`}
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100">
                            {pendingApplications.length === 1
                              ? 'Neuer digitaler Mitgliedsantrag eingegangen'
                              : 'Neue digitale Mitgliedsanträge eingegangen'}
                          </h3>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1">
                          Es liegen neue Online-Mitgliedsanträge zur satzungsgemäßen Prüfung und Freigabe vor:{' '}
                          <span className="font-semibold">
                            {pendingApplications.slice(0, 3).map((a) => `${a.firstName || (a as any).formData?.firstName || 'Antragsteller'} ${a.lastName || (a as any).formData?.lastName || ''} (${a.department || (a as any).formData?.department || 'Allgemein'})`).join(', ')}
                            {pendingApplications.length > 3 && ` und ${pendingApplications.length - 3} weitere`}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('online_applications')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
                    >
                      <span>Antragsportal öffnen & prüfen ({pendingApplications.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl w-fit mx-auto">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Noch keine Kacheln ausgewählt
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Stellen Sie Ihr individuelles Dashboard aus Mitgliedern, Finanzen, Kalender, Inventar und Dokumenten zusammen.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDashboardConfigModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Kacheln hinzufügen</span>
          </button>
        </div>
      )}

      {/* Bottom Add Tile Bar */}
      <div className="pt-2 flex items-center justify-center">
        <button
          type="button"
          onClick={onOpenDashboardConfigModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer hover:border-blue-300"
        >
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Weitere Kacheln hinzufügen oder Layout konfigurieren</span>
        </button>
      </div>
    </div>
  );
};
