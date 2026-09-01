import React, { useMemo } from 'react';
import {
  ClubSettings,
  InventoryItem,
  ClubDocument
} from '../../types';
import {
  Sparkles,
  Plus,
  Building2,
  CalendarDays,
  Package,
  FolderArchive,
  ArrowRight,
  MapPin,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

// 1. Quick Actions Widget
interface QuickActionsWidgetProps {
  onOpenCreateMember: () => void;
  onOpenCreateTx: () => void;
  onOpenCreateEvent?: () => void;
  onOpenCreateInventory: () => void;
  onOpenNewDocument?: () => void;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  onOpenCreateMember,
  onOpenCreateTx,
  onOpenCreateEvent,
  onOpenCreateInventory,
  onOpenNewDocument
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 h-full">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 text-2xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Schnellzugriff</span>
        </div>
        <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Was möchten Sie heute im Verein erfassen?
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Erstellen Sie Buchungen, neue Mitglieder, Termine oder Dokumente mit einem Klick.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenCreateMember}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-102 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Mitglied</span>
        </button>

        <button
          type="button"
          onClick={onOpenCreateTx}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-102 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Buchung</span>
        </button>

        {onOpenCreateEvent && (
          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-102 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Termin</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenCreateInventory}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-102 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Material</span>
        </button>

        {onOpenNewDocument && (
          <button
            type="button"
            onClick={onOpenNewDocument}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-102 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Dokument</span>
          </button>
        )}
      </div>
    </div>
  );
};

// 2. Club Header Widget
interface ClubHeaderWidgetProps {
  settings: ClubSettings;
  onNavigate: (tab: string) => void;
}

export const ClubHeaderWidget: React.FC<ClubHeaderWidgetProps> = ({ settings, onNavigate }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-full">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
          <img
            src={settings.clubLogoUrl || '/logo_transparent.png'}
            alt="Vereinslogo"
            className="w-full h-full object-contain"
            onError={(e) => {
              if (e.currentTarget.src !== window.location.origin + '/logo_transparent.png') {
                e.currentTarget.src = '/logo_transparent.png';
              }
            }}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 rounded-full text-2xs font-bold uppercase tracking-wider">
              {settings.associationNumber || 'Eingetragener Verein (e.V.)'}
            </span>
            {settings.isTaxExempt && (
              <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 rounded-full text-2xs font-bold">
                Gemeinnützig
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            {settings.clubName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Vorstand: {settings.chairman || 'Unbekannt'} • Kassenwart: {settings.treasurer || 'Unbekannt'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate('settings')}
        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shrink-0 cursor-pointer"
      >
        Vereinsstammdaten bearbeiten
      </button>
    </div>
  );
};

// 3. Upcoming Events & Calendar Widget
interface UpcomingEventsWidgetProps {
  onNavigate: (tab: string) => void;
  onOpenCreateEvent?: () => void;
}

export const UpcomingEventsWidget: React.FC<UpcomingEventsWidgetProps> = ({
  onNavigate,
  onOpenCreateEvent
}) => {
  // Demo / local dynamic events
  const today = new Date();
  const sampleEvents = useMemo(() => {
    const d1 = new Date(today);
    d1.setDate(today.getDate() + 2);
    const d2 = new Date(today);
    d2.setDate(today.getDate() + 6);
    const d3 = new Date(today);
    d3.setDate(today.getDate() + 14);

    return [
      {
        id: '1',
        title: 'Vorstandssitzung & Kassenprüfung Q3',
        date: d1.toISOString().split('T')[0],
        time: '19:00 - 21:00 Uhr',
        location: 'Vereinsheim / Konferenzraum',
        category: 'Vorstand',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300'
      },
      {
        id: '2',
        title: 'Heimspiel & Jugend-Turnier 2026',
        date: d2.toISOString().split('T')[0],
        time: '10:00 - 16:30 Uhr',
        location: 'Sportplatz Hauptfeld',
        category: 'Wettkampf',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
      },
      {
        id: '3',
        title: 'Jahreshauptversammlung & Neuwahlen',
        date: d3.toISOString().split('T')[0],
        time: '18:30 Uhr',
        location: 'Bürgerhaus Stadthalle',
        category: 'Versammlung',
        badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
      }
    ];
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Nächste Vereinstermine
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Veranstaltungen & Fristen</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('calendar')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Kalender öffnen <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {sampleEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onNavigate('calendar')}
              className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${evt.badgeColor}`}>
                    {evt.category}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {evt.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-2xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {evt.time}
                  </span>
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {evt.location}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  {new Date(evt.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(evt.date).toLocaleDateString('de-DE', { weekday: 'short' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-400">
        <span>iCal / Google Kalender Sync aktiv</span>
        {onOpenCreateEvent && (
          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + Termin anlegen
          </button>
        )}
      </div>
    </div>
  );
};

// 4. Inventory Widget
interface InventoryWidgetProps {
  inventory: InventoryItem[];
  onNavigate: (tab: string) => void;
}

export const InventoryWidget: React.FC<InventoryWidgetProps> = ({ inventory, onNavigate }) => {
  const { totalValue, totalQuantity, needsRepair } = useMemo(() => {
    let val = 0;
    let qty = 0;
    let repair = 0;

    inventory.forEach((item) => {
      val += (item.purchasePrice || 0) * (item.quantity || 1);
      qty += item.quantity || 1;
      if (item.condition === 'defective' || item.condition === 'poor') repair++;
    });

    return { totalValue: val, totalQuantity: qty, needsRepair: repair };
  }, [inventory]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Inventar & Materialbestand
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Sachwerte des Vereins</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            Inventarliste
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <span className="text-2xs text-slate-400 block font-semibold uppercase">Materieller Gesamtwert</span>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-2xs text-slate-400 block">Positionen</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{inventory.length} Artikel</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-2xs text-slate-400 block">Gesamtstückzahl</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{totalQuantity} Stk.</span>
            </div>
          </div>

          {needsRepair > 0 && (
            <div className="flex items-center gap-1.5 text-2xs text-amber-600 dark:text-amber-400 font-semibold p-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{needsRepair} Gegenstand / Material wartungsbedürftig</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>Sportgeräte & Ausstattung</span>
        <span className="font-bold text-purple-600 dark:text-purple-400">QR-Code Etiketten</span>
      </div>
    </div>
  );
};

// 5. Documents Archive Widget
interface DocumentsArchiveWidgetProps {
  documents: ClubDocument[];
  onNavigate: (tab: string) => void;
}

export const DocumentsArchiveWidget: React.FC<DocumentsArchiveWidgetProps> = ({
  documents,
  onNavigate
}) => {
  const { receiptsCount, contractsCount, protocolsCount } = useMemo(() => {
    let r = 0, c = 0, p = 0;
    documents.forEach((d) => {
      if (d.category === 'beleg' || d.category === 'receipt') r++;
      else if (d.category === 'vertrag' || d.category === 'contract') c++;
      else if (d.category === 'protokoll' || d.category === 'protocol') p++;
    });
    return { receiptsCount: r, contractsCount: c, protocolsCount: p };
  }, [documents]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Dokumentenarchiv & Belege
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Digitale Vereinsablage</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Archiv
          </button>
        </div>

        <div className="space-y-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-2xs text-slate-400 block font-semibold uppercase">Gesamtdokumente</span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {documents.length}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-2xs font-bold">
              GoBD revisionssicher
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-3xs text-slate-400 block uppercase">Belege</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{receiptsCount}</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-3xs text-slate-400 block uppercase">Verträge</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{contractsCount}</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-3xs text-slate-400 block uppercase">Protokolle</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{protocolsCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-400 flex items-center justify-between">
        <span>Lokaler OCR-Scan & Volltextsuche</span>
        <span className="font-bold text-amber-600 dark:text-amber-400">PDF & Bilder</span>
      </div>
    </div>
  );
};
