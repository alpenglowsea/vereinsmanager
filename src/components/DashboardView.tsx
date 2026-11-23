import React, { useMemo, useState } from 'react';
import {
  Member,
  Transaction,
  FinancialAccount,
  ClubSettings,
  InventoryItem,
  ClubDocument,
  DonationReceipt,
  ClubInvoice,
  ClubContact,
  Meeting
} from '../types';
import { UserDashboardConfig, WidgetColSpan } from '../types/dashboard';
import { AVAILABLE_DASHBOARD_WIDGETS } from '../data/defaultDashboard';
import { WidgetWrapper } from './DashboardWidgets/WidgetWrapper';
import {
  MembersKpiWidget,
  DepartmentsWidget,
  BirthdaysWidget,
  RecentMembersWidget,
  UnterlagenAblaufWidget,
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
  InvoicesOverviewWidget,
  InvoicesKpiWidget,
  ContactsSummaryWidget,
  ContactsKpiWidget,
  MeetingsSummaryWidget,
  MeetingsKpiWidget
} from './DashboardWidgets/OperationalWidgets';
import {
  SlidersHorizontal,
  Plus
} from 'lucide-react';

interface DashboardViewProps {
  members: Member[];
  transactions: Transaction[];
  accounts: FinancialAccount[];
  inventory: InventoryItem[];
  documents?: ClubDocument[];
  donations?: DonationReceipt[];
  invoices?: ClubInvoice[];
  contacts?: ClubContact[];
  meetings?: Meeting[];
  settings: ClubSettings;
  dashboardConfig: UserDashboardConfig;
  onUpdateDashboardConfig: (newConfig: UserDashboardConfig) => void;
  onOpenDashboardConfigModal: () => void;
  onNavigate: (tab: any) => void;
  onOpenCreateMember: () => void;
  onOpenCreateTx: () => void;
  onOpenCreateInvoice?: () => void;
  onOpenCreateContact?: () => void;
  onOpenCreateMeeting?: () => void;
  onOpenCreateEvent?: () => void;
  onOpenEvent?: (eventId: string, datum: string) => void;
  /** Mitglied im Detailfenster öffnen (Kachel „Unterlagen laufen ab“). */
  onOpenMember?: (memberId: string) => void;
  onOpenCreateInventory: () => void;
  onOpenNewDocument?: () => void;
  /** Wird hochgezählt, wenn ein Termin gespeichert wurde. */
  calendarRefreshKey?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  transactions,
  accounts,
  inventory,
  documents = [],
  donations = [],
  invoices = [],
  contacts = [],
  meetings = [],
  settings,
  dashboardConfig,
  onUpdateDashboardConfig,
  onOpenDashboardConfigModal,
  onNavigate,
  onOpenCreateMember,
  onOpenCreateTx,
  onOpenCreateInvoice,
  onOpenCreateContact,
  onOpenCreateMeeting,
  onOpenCreateEvent,
  onOpenEvent,
  onOpenMember,
  onOpenCreateInventory,
  onOpenNewDocument,
  calendarRefreshKey
}) => {
  // Widget definitions lookup
  const definitionsMap = useMemo(() => {
    const map = new Map();
    AVAILABLE_DASHBOARD_WIDGETS.forEach((def) => map.set(def.id, def));
    return map;
  }, []);


  // Sorted enabled widgets.
  const enabledWidgets = useMemo(() => {
    return [...(dashboardConfig.widgets || [])]
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order);
  }, [dashboardConfig]);

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
            onOpenCreateInvoice={onOpenCreateInvoice}
            onOpenCreateContact={onOpenCreateContact}
            onOpenCreateEvent={onOpenCreateEvent}
            onOpenCreateInventory={onOpenCreateInventory}
            onOpenNewDocument={onOpenNewDocument}
          />
        );
      case 'club_header':
        return <ClubHeaderWidget settings={settings} onNavigate={onNavigate} />;
      case 'members_kpi':
        return <MembersKpiWidget members={members} onNavigate={onNavigate} />;
      case 'departments_distribution':
        return <DepartmentsWidget members={members} onNavigate={onNavigate} />;
      case 'member_documents_expiry':
        return <UnterlagenAblaufWidget members={members} documents={documents || []} onOpenMember={onOpenMember} />;
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
      case 'invoices_overview':
        return (
          <InvoicesOverviewWidget
            invoices={invoices}
            onNavigate={onNavigate}
            onOpenCreateInvoice={onOpenCreateInvoice}
          />
        );
      case 'invoices_kpi':
        return <InvoicesKpiWidget invoices={invoices} onNavigate={onNavigate} />;
      case 'contacts_summary':
        return (
          <ContactsSummaryWidget
            contacts={contacts}
            onNavigate={onNavigate}
            onOpenCreateContact={onOpenCreateContact}
          />
        );
      case 'contacts_kpi':
        return <ContactsKpiWidget contacts={contacts} onNavigate={onNavigate} />;
      case 'meetings_summary':
        return (
          <MeetingsSummaryWidget
            meetings={meetings}
            onNavigate={onNavigate}
            onOpenCreateMeeting={onOpenCreateMeeting}
          />
        );
      case 'meetings_kpi':
        return <MeetingsKpiWidget meetings={meetings} onNavigate={onNavigate} />;
      case 'upcoming_events':
        return (
          <UpcomingEventsWidget
            onNavigate={onNavigate}
            onOpenCreateEvent={onOpenCreateEvent}
            onOpenEvent={onOpenEvent}
            refreshKey={calendarRefreshKey}
          />
        );
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
          {enabledWidgets.map((widget) => {
            const def = definitionsMap.get(widget.id);
            if (!def) return null;

            return (
              <React.Fragment key={widget.id}>
                <WidgetWrapper
                  id={widget.id}
                  colSpan={widget.colSpan}
                  isDragging={draggedWidgetId === widget.id}
                  isDragOver={dragOverWidgetId === widget.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragEnter={handleDragEnter}
                  onDrop={handleDrop}
                  onRemove={() => handleRemoveWidget(widget.id)}
                  onChangeColSpan={(newSpan) => handleChangeColSpan(widget.id, newSpan)}
                >
                  {renderWidgetContent(widget.id)}
                </WidgetWrapper>

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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer hover:border-blue-300 dark:hover:border-blue-700/60"
        >
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Weitere Kacheln hinzufügen oder Layout konfigurieren</span>
        </button>
      </div>
    </div>
  );
};
