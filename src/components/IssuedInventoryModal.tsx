import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Search,
  Package,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Member, InventoryItem, MemberInventoryAssignment, ClubSettings } from '../types';
import { ExportService } from '../services/exportService';

interface IssuedInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: MemberInventoryAssignment[];
  members: Member[];
  inventory: InventoryItem[];
  settings: ClubSettings;
  onUpdateAssignment?: (assignment: MemberInventoryAssignment) => void;
  onDeleteAssignment?: (id: string) => void;
}

export const IssuedInventoryModal: React.FC<IssuedInventoryModalProps> = ({
  isOpen,
  onClose,
  assignments,
  members,
  inventory,
  settings,
  onUpdateAssignment,
  onDeleteAssignment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'returned'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const inventoryMap = useMemo(() => new Map(inventory.map(i => [i.id, i])), [inventory]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      // Status filter
      if (statusFilter === 'issued' && item.status === 'returned') return false;
      if (statusFilter === 'returned' && item.status !== 'returned') return false;

      // Search filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const member = memberMap.get(item.memberId);
      const inv = inventoryMap.get(item.inventoryItemId);

      const memberName = member ? `${member.firstName} ${member.lastName} ${member.memberNumber}`.toLowerCase() : '';
      const itemName = (item.itemName || inv?.name || '').toLowerCase();
      const itemNum = (item.itemNumber || inv?.itemNumber || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();

      return (
        memberName.includes(term) ||
        itemName.includes(term) ||
        itemNum.includes(term) ||
        notes.includes(term)
      );
    });
  }, [assignments, statusFilter, searchTerm, memberMap, inventoryMap]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = assignments.length;
    const activeCount = assignments.filter(a => a.status !== 'returned').length;
    const returnedCount = assignments.filter(a => a.status === 'returned').length;
    const totalContribution = assignments
      .filter(a => a.hasContribution && a.contributionAmount)
      .reduce((s, a) => s + (a.contributionAmount || 0), 0);

    return { totalCount, activeCount, returnedCount, totalContribution };
  }, [assignments]);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      await ExportService.exportIssuedInventoryCSV(filteredAssignments, members, inventory);
    } catch (e) {
      console.error('CSV Export fehlgeschlagen', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await ExportService.exportIssuedInventoryPDF(filteredAssignments, members, inventory, settings);
    } catch (e) {
      console.error('PDF Export fehlgeschlagen', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleReturn = (item: MemberInventoryAssignment) => {
    if (!onUpdateAssignment) return;
    const isNowReturned = item.status !== 'returned';
    const updated: MemberInventoryAssignment = {
      ...item,
      status: isNowReturned ? 'returned' : 'issued',
      returnDate: isNowReturned ? new Date().toISOString().split('T')[0] : undefined,
      updatedAt: new Date().toISOString()
    };
    onUpdateAssignment(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/40 dark:text-blue-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ausgeteilte Gegenstände</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Übersicht aller an Mitglieder ausgegebenen Vereinsgegenstände</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting || filteredAssignments.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>CSV-Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || filteredAssignments.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200"
            >
              <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>PDF-Export</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors ml-2 dark:hover:text-slate-200 dark:hover:bg-slate-600/70"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">Gesamt</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalCount}</div>
          </div>
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100 dark:bg-amber-950/70 dark:border-amber-900/50">
            <div className="text-[11px] font-semibold text-amber-700 uppercase dark:text-amber-300">Aktuell ausgegeben</div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">{stats.activeCount}</div>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 dark:bg-emerald-950/70 dark:border-emerald-900/50">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase dark:text-emerald-300">Zurückgegeben</div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{stats.returnedCount}</div>
          </div>
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 dark:bg-blue-950/70 dark:border-blue-900/50">
            <div className="text-[11px] font-semibold text-blue-700 uppercase dark:text-blue-300">Eigenanteil gesamt</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {stats.totalContribution.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-800/50 dark:border-slate-800">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Suchen nach Mitglied, Gegenstand, Nummer..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs dark:bg-slate-900 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Alle ({assignments.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('issued')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'issued' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Ausgegeben ({stats.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('returned')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === 'returned' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Zurückgegeben ({stats.returnedCount})
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">Keine Einträge gefunden</p>
              <p className="text-xs text-slate-400 mt-1">Es wurden noch keine Gegenstände ausgegeben oder die Suche ergab keine Treffer.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 uppercase font-semibold sticky top-0 dark:bg-slate-700/75 dark:border-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Mitglied</th>
                  <th className="py-2.5 px-4">Gegenstand</th>
                  <th className="py-2.5 px-4 text-center">Menge</th>
                  <th className="py-2.5 px-4">Ausgabe</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Eigenanteil</th>
                  {onUpdateAssignment && <th className="py-2.5 px-4 text-center">Aktionen</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssignments.map(item => {
                  const member = memberMap.get(item.memberId);
                  const inv = inventoryMap.get(item.inventoryItemId);
                  const itemName = item.itemName || inv?.name || 'Gegenstand';
                  const itemNumber = item.itemNumber || inv?.itemNumber;
                  const unit = item.unit || inv?.unit || 'Stk.';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/80">
                      <td className="py-3 px-4">
                        {member ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Nr. {member.memberNumber} • {member.department}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unbekanntes Mitglied</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{itemName}</div>
                        {itemNumber && (
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{itemNumber}</div>
                        )}
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 dark:text-slate-400">{item.notes}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-100">
                        {item.quantity} {unit}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {item.issueDate || '–'}
                      </td>

                      <td className="py-3 px-4">
                        {item.status === 'returned' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Zurück ({item.returnDate || ''})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            <Clock className="w-3 h-3" /> Ausgegeben
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {item.hasContribution && item.contributionAmount ? (
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.contributionAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </span>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>

                      {onUpdateAssignment && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleReturn(item)}
                              className="px-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors dark:border-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                              title={item.status === 'returned' ? 'Erneut als ausgegeben markieren' : 'Als zurückgegeben markieren'}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>

                            {onDeleteAssignment && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Diese Materialzuweisung wirklich löschen?')) {
                                    onDeleteAssignment(item.id);
                                  }
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors dark:hover:text-rose-400 dark:hover:bg-rose-950/40"
                                title="Löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
          <span>{filteredAssignments.length} von {assignments.length} Gegenständen angezeigt</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
};
