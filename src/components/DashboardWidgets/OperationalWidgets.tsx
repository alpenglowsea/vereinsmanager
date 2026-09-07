import React, { useMemo } from 'react';
import {
  Receipt,
  Contact,
  ScrollText,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Phone,
  Mail,
  Building2,
  FileText,
  Check,
  CalendarClock
} from 'lucide-react';
import {
  ClubInvoice,
  ClubContact,
  Meeting,
  InvoiceStatus,
  ContactType,
  MeetingType
} from '../../types';

// ==========================================
// 1. INVOICES OVERVIEW WIDGET
// ==========================================
interface InvoicesOverviewWidgetProps {
  invoices?: ClubInvoice[];
  onNavigate: (tab: string) => void;
  onOpenCreateInvoice?: () => void;
}

export const InvoicesOverviewWidget: React.FC<InvoicesOverviewWidgetProps> = ({
  invoices = [],
  onNavigate,
  onOpenCreateInvoice
}) => {
  const stats = useMemo(() => {
    let totalBilled = 0;
    let openAmount = 0;
    let overdueCount = 0;
    let paidCount = 0;

    const today = new Date().toISOString().split('T')[0];

    invoices.forEach((inv) => {
      totalBilled += inv.total || 0;
      if (inv.status === 'paid') {
        paidCount++;
      } else if (inv.status !== 'cancelled') {
        openAmount += inv.total || 0;
        if (inv.dueDate && inv.dueDate < today && inv.status !== 'paid') {
          overdueCount++;
        }
      }
    });

    // Latest 4 invoices sorted by date/creation descending
    const sorted = [...invoices].sort((a, b) => {
      const dateA = a.date || a.createdAt || '';
      const dateB = b.date || b.createdAt || '';
      return dateB.localeCompare(dateA);
    }).slice(0, 4);

    return { totalBilled, openAmount, overdueCount, paidCount, recent: sorted };
  }, [invoices]);

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Bezahlt
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertTriangle className="w-3 h-3" /> Überfällig
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="w-3 h-3" /> Offen
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Entwurf
          </span>
        );
      case 'cancelled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Storniert
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Rechnungen & Faktura (DIN 5008)
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Forderungen & Status ausgestellter Belege
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCreateInvoice && (
              <button
                type="button"
                onClick={onOpenCreateInvoice}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Neue Rechnung erstellen"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Alle Rechnungen <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Top Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <span className="text-2xs text-slate-400 block font-semibold uppercase tracking-wider">Offener Betrag</span>
            <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
              {stats.openAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <span className="text-2xs text-slate-400 block font-semibold uppercase tracking-wider">Überfällig</span>
            <span className={`text-lg font-black font-mono ${stats.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {stats.overdueCount} {stats.overdueCount === 1 ? 'Beleg' : 'Belege'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <span className="text-2xs text-slate-400 block font-semibold uppercase tracking-wider">Gesamtvolumen</span>
            <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {stats.totalBilled.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </div>

        {/* Recent Invoices List */}
        <div className="space-y-1.5">
          {stats.recent.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Receipt className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Noch keine Rechnungen erstellt</p>
              {onOpenCreateInvoice && (
                <button
                  type="button"
                  onClick={onOpenCreateInvoice}
                  className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Erste Rechnung anlegen
                </button>
              )}
            </div>
          ) : (
            stats.recent.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onNavigate('invoices')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {inv.recipientName || 'Unbenannter Empfänger'}
                    </p>
                    <p className="text-2xs text-slate-400 font-mono">
                      {inv.invoiceNumber} • {inv.date ? new Date(inv.date).toLocaleDateString('de-DE') : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-slate-900 dark:text-white block">
                      {(inv.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  {getStatusBadge(inv.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>{invoices.length} Rechnungen insgesamt</span>
        <span>{stats.paidCount} erfolgreich beglichen</span>
      </div>
    </div>
  );
};

// ==========================================
// 2. INVOICES KPI WIDGET
// ==========================================
interface InvoicesKpiWidgetProps {
  invoices?: ClubInvoice[];
  onNavigate: (tab: string) => void;
}

export const InvoicesKpiWidget: React.FC<InvoicesKpiWidgetProps> = ({
  invoices = [],
  onNavigate
}) => {
  const { openSum, openCount, overdueCount } = useMemo(() => {
    let openSum = 0;
    let openCount = 0;
    let overdueCount = 0;
    const today = new Date().toISOString().split('T')[0];

    invoices.forEach((inv) => {
      if (inv.status !== 'paid' && inv.status !== 'cancelled') {
        openSum += inv.total || 0;
        openCount++;
        if (inv.dueDate && inv.dueDate < today) {
          overdueCount++;
        }
      }
    });

    return { openSum, openCount, overdueCount };
  }, [invoices]);

  return (
    <div
      onClick={() => onNavigate('invoices')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Offene Forderungen</span>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
          {openSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{openCount} offene {openCount === 1 ? 'Rechnung' : 'Rechnungen'}</span>
        {overdueCount > 0 ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold">{overdueCount} überfällig</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Alle fristgerecht</span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. CONTACTS SUMMARY WIDGET
// ==========================================
interface ContactsSummaryWidgetProps {
  contacts?: ClubContact[];
  onNavigate: (tab: string) => void;
  onOpenCreateContact?: () => void;
}

export const ContactsSummaryWidget: React.FC<ContactsSummaryWidgetProps> = ({
  contacts = [],
  onNavigate,
  onOpenCreateContact
}) => {
  const { categories, recentContacts } = useMemo(() => {
    const cats: Record<string, number> = {
      sponsor: 0,
      partner: 0,
      supplier: 0,
      authority: 0,
      donor: 0,
      other: 0
    };

    contacts.forEach((c) => {
      const types = c.types && c.types.length > 0 ? c.types : ['other'];
      types.forEach((t) => {
        cats[t] = (cats[t] || 0) + 1;
      });
    });

    const recent = [...contacts].sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt || '';
      const dateB = b.updatedAt || b.createdAt || '';
      return dateB.localeCompare(dateA);
    }).slice(0, 4);

    return { categories: cats, recentContacts: recent };
  }, [contacts]);

  const getContactPrimaryTypeBadge = (types?: ContactType[]) => {
    const firstType = types && types.length > 0 ? types[0] : 'other';
    switch (firstType) {
      case 'sponsor':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">Sponsor</span>;
      case 'partner':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">Partner</span>;
      case 'supplier':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">Lieferant</span>;
      case 'authority':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Behörde</span>;
      case 'donor':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">Spender</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Kontakt</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 rounded-xl">
              <Contact className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Kontakt- & Partnerverzeichnis
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Sponsoren, Lieferanten, Förderer & Behörden
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCreateContact && (
              <button
                type="button"
                onClick={onOpenCreateContact}
                className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
                title="Neuen Kontakt anlegen"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('contacts')}
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              Alle Kontakte <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Category breakdown pills */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
            <span className="text-2xs text-slate-400 block">Sponsoren</span>
            <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">{categories.sponsor || 0}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
            <span className="text-2xs text-slate-400 block">Partner</span>
            <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-400">{categories.partner || 0}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
            <span className="text-2xs text-slate-400 block">Lieferanten</span>
            <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">{categories.supplier || 0}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
            <span className="text-2xs text-slate-400 block">Behörden</span>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{categories.authority || 0}</span>
          </div>
        </div>

        {/* Recent Contacts List */}
        <div className="space-y-1.5">
          {recentContacts.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Building2 className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Keine externen Kontakte erfasst</p>
              {onOpenCreateContact && (
                <button
                  type="button"
                  onClick={onOpenCreateContact}
                  className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 font-semibold hover:underline"
                >
                  Ersten Kontakt anlegen
                </button>
              )}
            </div>
          ) : (
            recentContacts.map((c) => (
              <div
                key={c.id}
                onClick={() => onNavigate('contacts')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {c.displayName || c.companyName || 'Unbenannter Kontakt'}
                    </p>
                    <p className="text-2xs text-slate-400 truncate">
                      {c.contactPerson ? `${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''} • ` : ''}
                      {c.address?.city || c.email || c.contactNumber || ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {c.phone && <Phone className="w-3 h-3 text-slate-400 hidden sm:inline" />}
                  {c.email && <Mail className="w-3 h-3 text-slate-400 hidden sm:inline" />}
                  {getContactPrimaryTypeBadge(c.types)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>{contacts.length} Externe Kontakte insgesamt</span>
        <button
          type="button"
          onClick={() => onNavigate('contacts')}
          className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
        >
          Partnerliste verwalten
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 4. CONTACTS KPI WIDGET
// ==========================================
interface ContactsKpiWidgetProps {
  contacts?: ClubContact[];
  onNavigate: (tab: string) => void;
}

export const ContactsKpiWidget: React.FC<ContactsKpiWidgetProps> = ({
  contacts = [],
  onNavigate
}) => {
  const { total, sponsors, partners } = useMemo(() => {
    let sponsors = 0;
    let partners = 0;
    contacts.forEach((c) => {
      if (c.types?.includes('sponsor')) sponsors++;
      if (c.types?.includes('partner')) partners++;
    });
    return { total: contacts.length, sponsors, partners };
  }, [contacts]);

  return (
    <div
      onClick={() => onNavigate('contacts')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-cyan-300 dark:hover:border-cyan-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Partner & Kontakte</span>
          <div className="p-2 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 rounded-xl group-hover:bg-cyan-600 group-hover:text-white transition-colors">
            <Contact className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
          {total}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-amber-600 dark:text-amber-400 font-semibold">{sponsors} Sponsoren</span>
        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{partners} Partner</span>
      </div>
    </div>
  );
};

// ==========================================
// 5. MEETINGS SUMMARY WIDGET
// ==========================================
interface MeetingsSummaryWidgetProps {
  meetings?: Meeting[];
  onNavigate: (tab: string) => void;
  onOpenCreateMeeting?: () => void;
}

export const MeetingsSummaryWidget: React.FC<MeetingsSummaryWidgetProps> = ({
  meetings = [],
  onNavigate,
  onOpenCreateMeeting
}) => {
  const { nextMeeting, openProtocolsCount, upcomingMeetings } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    let openProtocols = 0;
    const upcoming: Meeting[] = [];

    meetings.forEach((m) => {
      if (m.status === 'draft' || m.status === 'review') {
        openProtocols++;
      }
      if (m.date >= today && m.status !== 'cancelled') {
        upcoming.push(m);
      }
    });

    upcoming.sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      if (diff !== 0) return diff;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    return {
      nextMeeting: upcoming[0] || null,
      openProtocolsCount: openProtocols,
      upcomingMeetings: upcoming.slice(0, 3)
    };
  }, [meetings]);

  const getTypeBadge = (type: MeetingType) => {
    switch (type) {
      case 'board':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">Vorstand</span>;
      case 'general_assembly':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">Jahreshauptversammlung</span>;
      case 'extraordinary_assembly':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">Außerordentl. Versammlung</span>;
      case 'committee':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">Ausschuss</span>;
      case 'department':
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Abteilung</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Sitzung</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-full flex flex-col justify-between space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sitzungs- & Protokolldienst
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Vorstandssitzungen, Versammlungen & Beschlüsse
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCreateMeeting && (
              <button
                type="button"
                onClick={onOpenCreateMeeting}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Neue Sitzung planen"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('meetings')}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              Zum Sitzungsdienst <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Next Meeting Banner */}
        {nextMeeting ? (
          <div
            onClick={() => onNavigate('meetings')}
            className="p-3.5 mb-3 rounded-xl bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/20 border border-rose-100 dark:border-rose-900/30 cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Nächste anstehende Sitzung
              </span>
              {getTypeBadge(nextMeeting.type)}
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {nextMeeting.title}
            </h4>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(nextMeeting.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
              {nextMeeting.startTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {nextMeeting.startTime} Uhr
                </span>
              )}
              {nextMeeting.location && (
                <span className="truncate max-w-[150px]">
                  📍 {nextMeeting.location}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Derzeit keine Sitzungen terminiert</p>
          </div>
        )}

        {/* Upcoming Meetings or Protocols */}
        <div className="space-y-1.5">
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((m) => (
              <div
                key={m.id}
                onClick={() => onNavigate('meetings')}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{m.title}</p>
                  <p className="text-2xs text-slate-400">
                    {new Date(m.date).toLocaleDateString('de-DE')} {m.startTime ? `• ${m.startTime} Uhr` : ''} • {m.agenda?.length || 0} Tagesordnungspunkte
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {getTypeBadge(m.type)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <ScrollText className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Keine weiteren Termine geplant</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>{meetings.length} Sitzungen im Archiv</span>
        {openProtocolsCount > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {openProtocolsCount} Protokoll-Entwürfe offen
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> Alle Protokolle genehmigt
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. MEETINGS KPI WIDGET
// ==========================================
interface MeetingsKpiWidgetProps {
  meetings?: Meeting[];
  onNavigate: (tab: string) => void;
}

export const MeetingsKpiWidget: React.FC<MeetingsKpiWidgetProps> = ({
  meetings = [],
  onNavigate
}) => {
  const { upcomingCount, openProtocols } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let upcoming = 0;
    let openProtocols = 0;

    meetings.forEach((m) => {
      if (m.date >= today && m.status !== 'cancelled') upcoming++;
      if (m.status === 'draft' || m.status === 'review') openProtocols++;
    });

    return { upcomingCount: upcoming, openProtocols };
  }, [meetings]);

  return (
    <div
      onClick={() => onNavigate('meetings')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition-all cursor-pointer group h-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider">Sitzungsdienst</span>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <ScrollText className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
          {upcomingCount} <span className="text-sm font-medium text-slate-400">geplant</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-slate-600 dark:text-slate-300">{meetings.length} gesamt</span>
        {openProtocols > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">{openProtocols} offene Protokolle</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Protokolle aktuell</span>
        )}
      </div>
    </div>
  );
};
