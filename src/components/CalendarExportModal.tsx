import React, { useState } from 'react';
import {
  CalendarEvent,
  CalendarEventCategory
} from '../types';
import { CalendarService } from '../services/calendarService';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  FileCode,
  Check,
  X,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';

interface CalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  categories: CalendarEventCategory[];
  departments?: string[];
  clubName?: string;
}

export const CalendarExportModal: React.FC<CalendarExportModalProps> = ({
  isOpen,
  onClose,
  events,
  categories,
  departments = [],
  clubName = 'TSV Musterstadt 1890 e.V.'
}) => {
  const [format, setFormat] = useState<'ics' | 'csv'>('ics');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'upcoming' | 'current_year' | 'next_90_days'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categories.map((c) => c.id));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [isExported, setIsExported] = useState<boolean>(false);

  if (!isOpen) return null;

  const todayStr = CalendarService.formatDate(new Date());
  const currentYear = new Date().getFullYear();

  // Filter events based on selections
  const filteredEvents = events.filter((evt) => {
    // 1. Category
    if (!selectedCategoryIds.includes(evt.categoryId)) return false;

    // 2. Department
    if (selectedDepartment !== 'all' && evt.department !== 'all' && evt.department !== selectedDepartment) {
      return false;
    }

    // 3. Date Range
    if (dateRangeFilter === 'upcoming') {
      if ((evt.endDate || evt.startDate) < todayStr) return false;
    } else if (dateRangeFilter === 'current_year') {
      if (!evt.startDate.startsWith(String(currentYear))) return false;
    } else if (dateRangeFilter === 'next_90_days') {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      const maxStr = CalendarService.formatDate(maxDate);
      if (evt.startDate < todayStr || evt.startDate > maxStr) return false;
    }

    return true;
  });

  const handleToggleCategory = (catId: string) => {
    if (selectedCategoryIds.includes(catId)) {
      setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== catId));
    } else {
      setSelectedCategoryIds([...selectedCategoryIds, catId]);
    }
  };

  const handleSelectAllCategories = () => {
    if (selectedCategoryIds.length === categories.length) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(categories.map((c) => c.id));
    }
  };

  const handleDownload = () => {
    if (filteredEvents.length === 0) {
      alert('Keine Termine für die ausgewählten Filterkriterien vorhanden.');
      return;
    }

    if (format === 'ics') {
      const icsContent = CalendarService.exportToIcs(filteredEvents, categories, `${clubName} Terminkalender`);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vereinskalender_${clubName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${todayStr}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csvContent = CalendarService.exportToCsv(filteredEvents, categories);
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vereinskalender_${clubName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${todayStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setIsExported(true);
    setTimeout(() => {
      setIsExported(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Kalender exportieren</h3>
              <p className="text-xs text-slate-500">Termine als iCalendar (.ics) oder Excel/CSV-Tabelle herunterladen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Export-Format wählen
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('ics')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                  format === 'ics'
                    ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2 rounded-xl ${format === 'ics' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">iCalendar (.ics)</div>
                  <p className="text-xs text-slate-500 mt-0.5">Kompatibel mit Apple, Google Kalender, Outlook & Smartphones</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                  format === 'csv'
                    ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2 rounded-xl ${format === 'csv' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">CSV-Tabelle (.csv)</div>
                  <p className="text-xs text-slate-500 mt-0.5">Zur Weiterverarbeitung in Microsoft Excel, Google Tabellen & Druck</p>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Zeitraum eingrenzen
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'all', label: 'Alle Termine' },
                { id: 'upcoming', label: 'Nur Zukünftige' },
                { id: 'current_year', label: `Jahr ${currentYear}` },
                { id: 'next_90_days', label: 'Nächste 90 Tage' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateRangeFilter(item.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    dateRangeFilter === item.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                3. Abteilung
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-hidden"
              >
                <option value="all">Alle Abteilungen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                4. Terminarten ({selectedCategoryIds.length}/{categories.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAllCategories}
                className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
              >
                {selectedCategoryIds.length === categories.length ? 'Keine' : 'Alle auswählen'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {categories.map((cat) => {
                const isChecked = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat.id)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-left transition-colors text-xs"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate font-medium text-slate-800">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter summary card */}
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-purple-900">
              Gefilterte Termine: <strong>{filteredEvents.length}</strong> von {events.length}
            </span>
            <span className="text-purple-700 font-medium">
              Format: .{format.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Exportdatei wird direkt im Browser erzeugt.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDownload}
              disabled={filteredEvents.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExported ? <Check className="w-4 h-4 text-emerald-300" /> : <Download className="w-4 h-4" />}
              <span>{isExported ? 'Heruntergeladen!' : `${filteredEvents.length} Termine exportieren`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
