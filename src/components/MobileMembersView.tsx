/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Member } from '../types';
import {
  Search,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Wallet,
  ChevronRight,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';

/**
 * Mitglied nachschlagen (Mobil-Ansicht)
 * ---------------------------------------------------------------------------
 * Bewusst nur LESEND: Anlegen, Ändern und Löschen bleiben der Desktop-
 * Ansicht vorbehalten — das hier ist für die Frage "wie war noch die
 * Telefonnummer/Adresse von …", nicht für die Pflege der Stammdaten.
 *
 * Bewusst NICHT gezeigt: Bankverbindung (IBAN/BIC) und interne Notizen. Wer
 * unterwegs kurz nachschaut, braucht das in aller Regel nicht — und ein
 * Blick übers Handy-Display sollte nicht gleich eine Kontonummer zeigen.
 * Wer das doch braucht, findet es in der Desktop-Ansicht.
 *
 * Filter (Status, Abteilung, Mitgliedstyp) und Sortierung orientieren sich
 * an den Filtern der Desktop-MembersView.tsx — bewusst nur eine kleine,
 * mobil-taugliche Auswahl statt aller 26 sortierbaren Tabellenspalten dort:
 * Auf dem Handy gibt es keine Tabelle mit Spaltenköpfen zum Anklicken.
 * Standardmäßig eingeklappt, damit die Liste beim Öffnen nicht von Filtern
 * verstellt wird — die meisten werden hier ohnehin zuerst suchen.
 */

// Dieselbe Beschriftung wie in MembersView.tsx, damit unterwegs nicht
// versehentlich ein anderes Wort für denselben Wert auftaucht.
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

const FEE_PERIOD_LABELS: Record<string, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  half_yearly: 'halbjährlich',
  yearly: 'jährlich',
  none: 'beitragsfrei'
};

const STATUS_BADGE: Record<Member['status'], { label: string; className: string }> = {
  active: { label: 'AKTIV', className: 'bg-emerald-100 text-emerald-800' },
  passive: { label: 'PASSIV', className: 'bg-slate-100 text-slate-700' },
  honorary: { label: 'EHREN', className: 'bg-amber-100 text-amber-800' },
  suspended: { label: 'RUHEND', className: 'bg-yellow-100 text-yellow-800' },
  terminated: { label: 'GEKÜNDIGT', className: 'bg-rose-100 text-rose-800' }
};

const STATUS_FILTER_OPTIONS: { value: Member['status']; label: string }[] = [
  { value: 'active', label: 'Aktiv' },
  { value: 'passive', label: 'Passiv' },
  { value: 'honorary', label: 'Ehren' },
  { value: 'suspended', label: 'Ruhend' },
  { value: 'terminated', label: 'Gekündigt' }
];

type SortField = 'name' | 'number' | 'entryDate' | 'status';

const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  number: 'Mitgliedsnummer',
  entryDate: 'Eintrittsdatum',
  status: 'Status'
};

interface MobileMembersViewProps {
  members: Member[];
}

export function MobileMembersView({ members }: MobileMembersViewProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Member['status'] | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [members]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => set.add(m.membershipType));
    return Array.from(set);
  }, [members]);

  const activeFilterCount = [statusFilter !== 'all', deptFilter !== 'all', typeFilter !== 'all'].filter(
    Boolean
  ).length;

  const resetFilters = () => {
    setStatusFilter('all');
    setDeptFilter('all');
    setTypeFilter('all');
  };

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (deptFilter !== 'all' && m.department !== deptFilter) return false;
      if (typeFilter !== 'all' && m.membershipType !== typeFilter) return false;
      if (!q) return true;
      return (
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'de');
      } else if (sortBy === 'number') {
        cmp = a.memberNumber.localeCompare(b.memberNumber, 'de', { numeric: true });
      } else if (sortBy === 'entryDate') {
        cmp = a.entryDate.localeCompare(b.entryDate);
      } else if (sortBy === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [members, query, statusFilter, deptFilter, typeFilter, sortBy, sortAsc]);

  const selectedMember = selectedId ? members.find(m => m.id === selectedId) ?? null : null;

  if (selectedMember) {
    const badge = STATUS_BADGE[selectedMember.status];
    const fullAddress = [
      `${selectedMember.address.street} ${selectedMember.address.houseNumber}`.trim(),
      `${selectedMember.address.zip} ${selectedMember.address.city}`.trim()
    ]
      .filter(part => part.trim().length > 0)
      .join(', ');

    return (
      <div className="p-4 space-y-4 pb-6">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Liste
        </button>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 truncate">
                {selectedMember.firstName} {selectedMember.lastName}
              </p>
              <p className="text-2xs text-slate-500 font-mono">Mitglieds-Nr. {selectedMember.memberNumber}</p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
              {MEMBERSHIP_TYPE_LABELS[selectedMember.membershipType] || selectedMember.membershipType}
            </span>
            {selectedMember.department && (
              <>
                <span className="text-slate-400">•</span>
                <span>{selectedMember.department}</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Kontakt</p>
          {selectedMember.phone && (
            <a href={`tel:${selectedMember.phone}`} className="flex items-center gap-3 text-sm text-slate-700">
              <Phone className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="underline">{selectedMember.phone}</span>
            </a>
          )}
          {selectedMember.email && (
            <a href={`mailto:${selectedMember.email}`} className="flex items-center gap-3 text-sm text-slate-700">
              <Mail className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="underline truncate">{selectedMember.email}</span>
            </a>
          )}
          {fullAddress && (
            <div className="flex items-start gap-3 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>{fullAddress}</span>
            </div>
          )}
          {!selectedMember.phone && !selectedMember.email && !fullAddress && (
            <p className="text-xs text-slate-400">Keine Kontaktdaten hinterlegt</p>
          )}
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Mitgliedschaft & Beitrag</p>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <CalendarDays className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Eintritt: {new Date(selectedMember.entryDate).toLocaleDateString('de-DE')}
              {selectedMember.exitDate &&
                ` · Austritt: ${new Date(selectedMember.exitDate).toLocaleDateString('de-DE')}`}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Wallet className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              {selectedMember.feeAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              € ({FEE_PERIOD_LABELS[selectedMember.feePeriod] || selectedMember.feePeriod})
            </span>
          </div>
        </div>

        <p className="text-2xs text-slate-400 text-center px-4">
          Nur zum Nachschlagen. Bankverbindung und interne Notizen sind hier bewusst nicht sichtbar — dafür bitte die
          Desktop-Ansicht öffnen.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 pb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, Mitgliedsnummer, Sparte …"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          className={`relative shrink-0 px-3 rounded-xl border cursor-pointer flex items-center justify-center ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-500'
          }`}
          title="Filter & Sortierung"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTER_OPTIONS.map(opt => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusFilter(isActive ? 'all' : opt.value)}
                    className={`px-2.5 py-1 rounded-full text-2xs font-bold cursor-pointer transition-colors ${
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Abteilung</p>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Alle</option>
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Mitgliedstyp</p>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Alle</option>
                {typeOptions.map(type => (
                  <option key={type} value={type}>
                    {MEMBERSHIP_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 shrink-0">Sortieren</p>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortField)}
              className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {(Object.keys(SORT_LABELS) as SortField[]).map(field => (
                <option key={field} value={field}>
                  {SORT_LABELS[field]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(a => !a)}
              title={sortAsc ? 'Aufsteigend' : 'Absteigend'}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 cursor-pointer shrink-0"
            >
              {sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-2xs font-semibold text-blue-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Keine Mitglieder gefunden.</p>
      ) : (
        <div className="space-y-1.5">
          {filteredMembers.map(member => {
            const badge = STATUS_BADGE[member.status];
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedId(member.id)}
                className="w-full flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left cursor-pointer active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-2xs text-slate-500 truncate">
                    {member.department || 'Ohne Abteilung'} · Nr. {member.memberNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
