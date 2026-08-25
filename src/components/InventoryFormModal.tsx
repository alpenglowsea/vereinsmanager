import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryCategory, ItemCondition, ClubSettings } from '../types';
import { INVENTORY_CATEGORIES, CONDITION_OPTIONS, INVENTORY_UNITS } from '../data/inventoryCategories';
import {
  X,
  Package,
  Trophy,
  Shirt,
  Boxes,
  Wrench,
  Radio,
  HeartPulse,
  Armchair,
  CheckCircle2,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Hash,
  FileText,
  AlertCircle,
  Tag,
  Layers,
  Sparkles
} from 'lucide-react';

interface InventoryFormModalProps {
  item: InventoryItem | null; // null = neu anlegen
  departments: string[];
  settings: ClubSettings;
  onSave: (item: InventoryItem) => void;
  onClose: () => void;
}

export const InventoryFormModal: React.FC<InventoryFormModalProps> = ({
  item,
  departments,
  settings,
  onSave,
  onClose
}) => {
  const isEdit = !!item;

  // Form State
  const [name, setName] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('sports_equipment');
  const [department, setDepartment] = useState<string>('Fußball');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Stk.');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('good');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [supplier, setSupplier] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lastCheckedDate, setLastCheckedDate] = useState('');
  const [nextInspectionDate, setNextInspectionDate] = useState('');

  const [activeTab, setActiveTab] = useState<'general' | 'assignment' | 'financial' | 'inspection'>('general');
  const [errorMsg, setErrorMsg] = useState('');

  // Sparte Options
  const departmentOptions = ['Gesamtverein', ...departments.filter(d => d !== 'Gesamtverein')];

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setItemNumber(item.itemNumber || '');
      setCategory(item.category || 'sports_equipment');
      setDepartment(item.department || 'Gesamtverein');
      setQuantity(item.quantity ?? 1);
      setUnit(item.unit || 'Stk.');
      setLocation(item.location || '');
      setCondition(item.condition || 'good');
      setPurchaseDate(item.purchaseDate || '');
      setPurchasePrice(item.purchasePrice !== undefined ? item.purchasePrice.toString() : '');
      setCurrentValue(item.currentValue !== undefined ? item.currentValue.toString() : '');
      setSupplier(item.supplier || '');
      setResponsiblePerson(item.responsiblePerson || '');
      setAssignedTo(item.assignedTo || '');
      setSerialNumber(item.serialNumber || '');
      setNotes(item.notes || '');
      setLastCheckedDate(item.lastCheckedDate || '');
      setNextInspectionDate(item.nextInspectionDate || '');
    } else {
      // Auto-generate next item number
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setItemNumber(`INV-${new Date().getFullYear()}-${randomSuffix}`);
      setDepartment(departments[0] || 'Gesamtverein');
      setLocation('Geräteraum / Zentrallager');
    }
  }, [item, departments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Bitte geben Sie eine Bezeichnung für den Gegenstand ein.');
      setActiveTab('general');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Die Menge muss mindestens 1 betragen.');
      setActiveTab('general');
      return;
    }

    const priceNum = purchasePrice ? parseFloat(purchasePrice.replace(',', '.')) : undefined;
    const valueNum = currentValue ? parseFloat(currentValue.replace(',', '.')) : undefined;

    const newItem: InventoryItem = {
      id: item ? item.id : `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemNumber: itemNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      department: department || 'Gesamtverein',
      quantity: Number(quantity),
      unit: unit || 'Stk.',
      location: location.trim() || 'Vereinsgelände',
      condition,
      purchaseDate: purchaseDate || undefined,
      purchasePrice: isNaN(priceNum as number) ? undefined : priceNum,
      currentValue: isNaN(valueNum as number) ? undefined : valueNum,
      supplier: supplier.trim() || undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      assignedTo: assignedTo.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      lastCheckedDate: lastCheckedDate || undefined,
      nextInspectionDate: nextInspectionDate || undefined,
      createdAt: item ? item.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(newItem);
  };

  const getCategoryIcon = (catId: InventoryCategory) => {
    switch (catId) {
      case 'sports_equipment': return <Trophy className="w-4 h-4" />;
      case 'apparel': return <Shirt className="w-4 h-4" />;
      case 'accessories': return <Boxes className="w-4 h-4" />;
      case 'facility': return <Wrench className="w-4 h-4" />;
      case 'electronics': return <Radio className="w-4 h-4" />;
      case 'medical': return <HeartPulse className="w-4 h-4" />;
      case 'furniture': return <Armchair className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {isEdit ? 'Inventargegenstand bearbeiten' : 'Neuen Gegenstand erfassen'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? `${item?.itemNumber} • ${item?.name}` : 'Material, Sportgerät oder Vereinsausstattung anlegen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Basisdaten & Art</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignment')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'assignment'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Ort, Sparte & Zuständigkeit</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'financial'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Kaufwert & Lieferant</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inspection')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'inspection'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Wartung & Notizen</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form id="inventoryForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Basisdaten & Art */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Category Selector Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Art des Materials / Kategorie *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {INVENTORY_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-900 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {getCategoryIcon(cat.id)}
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight">{cat.shortLabel}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{cat.examples}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Inventory ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Gegenstandsbezeichnung *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Derbystar Spielball-Set 10er oder Trikotsatz ERIMA"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Inventar-Nr. / Code
                  </label>
                  <input
                    type="text"
                    value={itemNumber}
                    onChange={(e) => setItemNumber(e.target.value)}
                    placeholder="z.B. INV-FB-001"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quantity, Unit & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Menge / Anzahl *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Einheit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {INVENTORY_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Zustand
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ItemCondition)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                  >
                    {CONDITION_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Ort, Sparte & Zuständigkeit */}
          {activeTab === 'assignment' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Zugeordnete Sparte / Abteilung *</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                  >
                    {departmentOptions.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Spartenspezifisch (z.B. Fußball, Tennis) oder Gesamtverein für alle Abteilungen
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Lagerort / Standort *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Geräteraum Platz 1, Kabine 3, Vereinsheim Keller"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Genauer Raum, Schrank oder Kiste für schnelles Auffinden
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Verantwortlicher / Zeugwart</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Markus Meier (Zeugwart) oder Trainer"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Im Einsatz bei / Verliehen an Mannschaft</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. 1. Herrenmannschaft, D-Jugend oder Clubheim"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Seriennummer / Herstellercode
                </label>
                <input
                  type="text"
                  placeholder="z.B. SER-983192-A oder Fahrgestellnummer"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Kaufwert & Lieferant */}
          {activeTab === 'financial' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Kaufdatum / Anschaffung</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Anschaffungspreis (€)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <span>Aktueller Zeitwert (€)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Lieferant / Fachhändler / Hersteller
                </label>
                <input
                  type="text"
                  placeholder="z.B. Sport-Thieme, Erima Sportbekleidung, Schäper Sportgeräte"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Tipp für die Vereinsbuchhaltung:</span> Größere Anschaffungen (ab 800 € netto) können in der EÜR / Bilanz als Anlagevermögen geführt werden.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Wartung & Notizen */}
          {activeTab === 'inspection' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Letzte Inventur / Sichtprüfung</span>
                  </label>
                  <input
                    type="date"
                    value={lastCheckedDate}
                    onChange={(e) => setLastCheckedDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nächste UVV- / Sicherheitsprüfung (TÜV)</span>
                  </label>
                  <input
                    type="date"
                    value={nextInspectionDate}
                    onChange={(e) => setNextInspectionDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Wichtig für ortsfeste Tore, Turngeräte, Rasenmäher & Defibrillatoren
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Bemerkungen, Zubehör & Besonderheiten</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="z.B. Enthaltene Trikotnummern, Akkuzustand, Passwörter, Reparaturhistorie oder Spendenherkunft..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              form="inventoryForm"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEdit ? 'Änderungen speichern' : 'Gegenstand speichern'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
