import React, { useState } from 'react';
import {
  InventoryItem,
  InventoryCategory,
  ItemCondition,
  InventoryBulkUpdates
} from '../types';
import { INVENTORY_CATEGORIES, CONDITION_OPTIONS } from '../data/inventoryCategories';
import {
  X,
  SlidersHorizontal,
  Package,
  Building2,
  Tag,
  AlertTriangle,
  MapPin,
  User,
  Truck,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface InventoryBulkEditModalProps {
  selectedItems: InventoryItem[];
  departments: string[];
  onSave: (updates: InventoryBulkUpdates) => Promise<void>;
  onClose: () => void;
}

export const InventoryBulkEditModal: React.FC<InventoryBulkEditModalProps> = ({
  selectedItems,
  departments,
  onSave,
  onClose
}) => {
  // Field activation flags
  const [applyDepartment, setApplyDepartment] = useState(false);
  const [department, setDepartment] = useState<string>(departments[0] || 'Gesamtverein');

  const [applyCategory, setApplyCategory] = useState(false);
  const [category, setCategory] = useState<InventoryCategory>('sports_equipment');

  const [applyCondition, setApplyCondition] = useState(false);
  const [condition, setCondition] = useState<ItemCondition>('good');

  const [applyLocation, setApplyLocation] = useState(false);
  const [location, setLocation] = useState<string>('');

  const [applyResponsible, setApplyResponsible] = useState(false);
  const [responsiblePerson, setResponsiblePerson] = useState<string>('');

  const [applyAssignedTo, setApplyAssignedTo] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>('');

  const [applySupplier, setApplySupplier] = useState(false);
  const [supplier, setSupplier] = useState<string>('');

  const [applyLastChecked, setApplyLastChecked] = useState(false);
  const [lastCheckedDate, setLastCheckedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [applyNextInspection, setApplyNextInspection] = useState(false);
  const [nextInspectionDate, setNextInspectionDate] = useState<string>('');

  const [applyNotes, setApplyNotes] = useState(false);
  const [notesAction, setNotesAction] = useState<'append' | 'replace'>('append');
  const [notesValue, setNotesValue] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showItemList, setShowItemList] = useState(false);

  // Departments list including Gesamtverein
  const allDepartments = ['Gesamtverein', ...departments.filter(d => d !== 'Gesamtverein')];

  // Active modifications count
  const activeChangeCount = [
    applyDepartment,
    applyCategory,
    applyCondition,
    applyLocation,
    applyResponsible,
    applyAssignedTo,
    applySupplier,
    applyLastChecked,
    applyNextInspection,
    applyNotes
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChangeCount === 0) return;

    const updates: InventoryBulkUpdates = {};
    if (applyDepartment) updates.department = department;
    if (applyCategory) updates.category = category;
    if (applyCondition) updates.condition = condition;
    if (applyLocation && location.trim()) updates.location = location.trim();
    if (applyResponsible && responsiblePerson.trim()) updates.responsiblePerson = responsiblePerson.trim();
    if (applyAssignedTo) updates.assignedTo = assignedTo.trim();
    if (applySupplier) updates.supplier = supplier.trim();
    if (applyLastChecked) updates.lastCheckedDate = lastCheckedDate;
    if (applyNextInspection) updates.nextInspectionDate = nextInspectionDate;

    if (applyNotes && notesValue.trim()) {
      updates.notesAction = notesAction;
      updates.notesValue = notesValue.trim();
    }

    setIsSubmitting(true);
    try {
      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('Failed to bulk update inventory items:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Sammelbearbeitung: {selectedItems.length} Inventargegenstand/-stände
              </h2>
              <p className="text-xs text-slate-500">
                Aktivieren Sie die gewünschten Kontrollkästchen, um diese Eigenschaften für alle ausgewählten Gegenstände gemeinsam zu ändern.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Items Drawer */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs">
          <span className="text-blue-900 font-medium">
            Ausgewählt: <span className="font-bold">{selectedItems.length} Gegenstände</span>
          </span>
          <button
            type="button"
            onClick={() => setShowItemList(!showItemList)}
            className="text-blue-600 hover:text-blue-800 underline font-semibold"
          >
            {showItemList ? 'Details ausblenden' : 'Details einblenden'}
          </button>
        </div>

        {showItemList && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 max-h-44 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              {selectedItems.map(item => (
                <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-700">{item.itemNumber}</span>
                    <span className="text-slate-600 ml-1.5 truncate font-medium">{item.name}</span>
                    <span className="text-slate-400 ml-1 text-[11px]">({item.department})</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Hinweis zur Inventur:</span> Nur aktivierte Felder werden modifiziert. Individuelle Daten wie Inventarnummer, Bezeichnung, Menge und Anschaffungspreis bleiben unverändert.
            </div>
          </div>

          {/* 1. Sparte / Abteilung */}
          <div className={`p-4 rounded-xl border transition-all ${applyDepartment ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDepartment}
                  onChange={e => setApplyDepartment(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Sparte / Abteilung neu zuordnen
                </span>
              </label>
              {applyDepartment && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyDepartment && (
              <div className="mt-3 pl-6">
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  {allDepartments.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Kategorie */}
          <div className={`p-4 rounded-xl border transition-all ${applyCategory ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCategory}
                  onChange={e => setApplyCategory(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  Inventarkategorie anpassen
                </span>
              </label>
              {applyCategory && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyCategory && (
              <div className="mt-3 pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INVENTORY_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      category === cat.id
                        ? 'border-blue-600 bg-blue-100/70 text-blue-900 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold">{cat.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{cat.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Zustand */}
          <div className={`p-4 rounded-xl border transition-all ${applyCondition ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCondition}
                  onChange={e => setApplyCondition(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Zustand aktualisieren
                </span>
              </label>
              {applyCondition && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyCondition && (
              <div className="mt-3 pl-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONDITION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(opt.value)}
                    className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                      condition === opt.value
                        ? 'border-blue-600 bg-blue-100/70 text-blue-900 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Standort */}
          <div className={`p-4 rounded-xl border transition-all ${applyLocation ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyLocation}
                  onChange={e => setApplyLocation(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  Lagerort / Standort zuweisen
                </span>
              </label>
              {applyLocation && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyLocation && (
              <div className="mt-3 pl-6">
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="z.B. Geräteraum Platz 1, Keller Vereinsheim, Ballschrank..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 5. Verantwortlicher / Zeugwart */}
          <div className={`p-4 rounded-xl border transition-all ${applyResponsible ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyResponsible}
                  onChange={e => setApplyResponsible(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Zuständige Person / Zeugwart
                </span>
              </label>
              {applyResponsible && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyResponsible && (
              <div className="mt-3 pl-6">
                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={e => setResponsiblePerson(e.target.value)}
                  placeholder="z.B. Markus Meier (Zeugwart), Abteilungsleiter Tennis..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 6. Zugewiesen an / Verliehen */}
          <div className={`p-4 rounded-xl border transition-all ${applyAssignedTo ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAssignedTo}
                  onChange={e => setApplyAssignedTo(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" />
                  Im Einsatz bei / Verliehen an
                </span>
              </label>
              {applyAssignedTo && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyAssignedTo && (
              <div className="mt-3 pl-6">
                <input
                  type="text"
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  placeholder="z.B. 1. Herrenmannschaft, U15 Juniorinnen, Turngruppe..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 7. Lieferant / Hersteller */}
          <div className={`p-4 rounded-xl border transition-all ${applySupplier ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySupplier}
                  onChange={e => setApplySupplier(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-teal-600" />
                  Lieferant / Fachhändler
                </span>
              </label>
              {applySupplier && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applySupplier && (
              <div className="mt-3 pl-6">
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="z.B. Sport2000, Erima, Benz Sportgeräte..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* 8. Prüfdaten & Wartung */}
          <div className={`p-4 rounded-xl border transition-all ${(applyLastChecked || applyNextInspection) ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyLastChecked}
                    onChange={e => setApplyLastChecked(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Letzte Prüfung
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyNextInspection}
                    onChange={e => setApplyNextInspection(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Nächste Wartung
                  </span>
                </label>
              </div>
              {(applyLastChecked || applyNextInspection) && (
                <span className="text-xs font-bold text-blue-700">Wird geändert</span>
              )}
            </div>

            <div className="mt-3 pl-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {applyLastChecked && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Letzte Prüfung / Inventur
                  </label>
                  <input
                    type="date"
                    value={lastCheckedDate}
                    onChange={e => setLastCheckedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {applyNextInspection && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nächste Prüfung / TÜV
                  </label>
                  <input
                    type="date"
                    value={nextInspectionDate}
                    onChange={e => setNextInspectionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 9. Notizen */}
          <div className={`p-4 rounded-xl border transition-all ${applyNotes ? 'bg-blue-50/40 border-blue-300 shadow-xs' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyNotes}
                  onChange={e => setApplyNotes(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Notiz / Inventurvermerk
                </span>
              </label>
              {applyNotes && <span className="text-xs font-bold text-blue-700">Wird geändert</span>}
            </div>

            {applyNotes && (
              <div className="mt-3 pl-6 space-y-2">
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="invNotesAction"
                      value="append"
                      checked={notesAction === 'append'}
                      onChange={() => setNotesAction('append')}
                      className="text-blue-600"
                    />
                    An bestehende Notiz anfügen
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="invNotesAction"
                      value="replace"
                      checked={notesAction === 'replace'}
                      onChange={() => setNotesAction('replace')}
                      className="text-blue-600"
                    />
                    Notiz vollständig ersetzen
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="z.B. Inventur Frühjahr 2026 durchgeführt..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeChangeCount === 0 ? (
              <span className="text-amber-700 font-medium">
                Bitte aktivieren Sie mindestens ein Feld zur Sammelbearbeitung.
              </span>
            ) : (
              <span className="text-blue-800 font-semibold">
                {activeChangeCount} Feld(er) werden für {selectedItems.length} Inventargegenstände angepasst.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={activeChangeCount === 0 || isSubmitting}
              className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 ${
                activeChangeCount === 0 || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? (
                <>Speichern...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedItems.length} Gegenstände aktualisieren</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
