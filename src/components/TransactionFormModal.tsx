import React, { useState, useEffect } from 'react';
import {
  Transaction,
  FinancialAccount,
  TaxSphere,
  ReceiptAttachment
} from '../types';
import {
  TAX_SPHERES,
  getSkr42MainCategories,
  getSkr42SubCategories,
  findSkr42MainForSub
} from '../data/taxSpheres';
import {
  X,
  FileText,
  Upload,
  AlertCircle,
  HelpCircle,
  Paperclip,
  CheckCircle2,
  Trash2,
  Tag,
  Layers,
  Camera
} from 'lucide-react';
import { ReceiptCameraScannerModal } from './ReceiptCameraScannerModal';

interface TransactionFormModalProps {
  transaction: Transaction | null;
  accounts: FinancialAccount[];
  nextDocNumber: string;
  onSave: (tx: Transaction) => void;
  onClose: () => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  transaction,
  accounts,
  nextDocNumber,
  onSave,
  onClose
}) => {
  // Determine initial main and sub category
  const initialSphere: TaxSphere = transaction?.sphere || 'ideell';
  const initialType: 'income' | 'expense' | 'transfer' = transaction?.type || 'expense';
  
  const initialMainCats = getSkr42MainCategories(
    initialSphere,
    initialType === 'transfer' ? 'expense' : initialType
  );
  
  let initialMainCatId = initialMainCats[0]?.id || 'HK-3100';
  let initialSubCat = initialMainCats[0]?.subCategories[0]?.label || '';

  if (transaction) {
    if (transaction.mainCategory) {
      const match = initialMainCats.find(m => m.name === transaction.mainCategory || m.id === transaction.mainCategory);
      if (match) initialMainCatId = match.id;
    } else if (transaction.category) {
      const detectedMain = findSkr42MainForSub(transaction.category);
      if (detectedMain) initialMainCatId = detectedMain.id;
    }
    initialSubCat = transaction.subCategory || transaction.category || initialSubCat;
  }

  const [selectedMainCatId, setSelectedMainCatId] = useState<string>(initialMainCatId);

  const [formData, setFormData] = useState<Transaction>({
    id: transaction?.id || `tx-${Date.now()}`,
    date: transaction?.date || new Date().toISOString().split('T')[0],
    amount: transaction ? Math.abs(transaction.amount) : 0,
    type: transaction?.type || 'expense',
    accountId: transaction?.accountId || accounts[0]?.id || 'acc-1',
    targetAccountId: transaction?.targetAccountId || '',
    documentNumber: transaction?.documentNumber || nextDocNumber,
    bookingText: transaction?.bookingText || '',
    partner: transaction?.partner || '',
    sphere: initialSphere,
    mainCategory: transaction?.mainCategory || initialMainCats.find(m => m.id === initialMainCatId)?.name || '',
    subCategory: initialSubCat,
    category: initialSubCat,
    vatRate: transaction?.vatRate ?? 0,
    notes: transaction?.notes || '',
    receipt: transaction?.receipt,
    createdAt: transaction?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [receiptFile, setReceiptFile] = useState<ReceiptAttachment | null>(transaction?.receipt || null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSphereHelp, setShowSphereHelp] = useState(false);

  // Available SKR 42 categories for current sphere and type
  const activeType = formData.type === 'transfer' ? 'expense' : formData.type;
  const mainCategories = getSkr42MainCategories(formData.sphere, activeType);
  const subCategories = getSkr42SubCategories(formData.sphere, activeType, selectedMainCatId);

  const handleSphereChange = (sphere: TaxSphere) => {
    const mains = getSkr42MainCategories(sphere, activeType);
    const newMain = mains[0];
    const newSub = newMain?.subCategories[0];
    setSelectedMainCatId(newMain?.id || '');
    setFormData(prev => ({
      ...prev,
      sphere,
      mainCategory: newMain ? `${newMain.code} - ${newMain.name}` : '',
      subCategory: newSub?.label || '',
      category: newSub?.label || '',
      skrAccount: newSub?.code || '',
      vatRate: newSub?.vatRateDefault ?? (sphere === 'wirtschaftlich' ? 19 : sphere === 'zweckbetrieb' ? 7 : 0)
    }));
  };

  const handleTypeChange = (type: 'income' | 'expense' | 'transfer') => {
    const effectiveType = type === 'transfer' ? 'expense' : type;
    const mains = getSkr42MainCategories(formData.sphere, effectiveType);
    const newMain = mains[0];
    const newSub = newMain?.subCategories[0];
    setSelectedMainCatId(newMain?.id || '');
    setFormData(prev => ({
      ...prev,
      type,
      mainCategory: newMain ? `${newMain.code} - ${newMain.name}` : '',
      subCategory: newSub?.label || '',
      category: newSub?.label || '',
      skrAccount: newSub?.code || '',
      vatRate: newSub?.vatRateDefault ?? prev.vatRate
    }));
  };

  const handleMainCatChange = (mainCatId: string) => {
    setSelectedMainCatId(mainCatId);
    const main = mainCategories.find(m => m.id === mainCatId);
    const firstSub = main?.subCategories[0];
    setFormData(prev => ({
      ...prev,
      mainCategory: main ? `${main.code} - ${main.name}` : '',
      subCategory: firstSub?.label || '',
      category: firstSub?.label || '',
      skrAccount: firstSub?.code || '',
      vatRate: firstSub?.vatRateDefault ?? prev.vatRate
    }));
  };

  const handleSubCatChange = (subCatLabel: string) => {
    const sub = subCategories.find(s => s.label === subCatLabel || s.code === subCatLabel || s.name === subCatLabel);
    setFormData(prev => ({
      ...prev,
      subCategory: subCatLabel,
      category: subCatLabel,
      skrAccount: sub?.code || '',
      vatRate: sub ? sub.vatRateDefault : prev.vatRate
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit 8MB
    if (file.size > 8 * 1024 * 1024) {
      alert('Die Datei ist zu groß. Maximale Größe für lokale Belegarchivierung ist 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const receipt: ReceiptAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString()
      };
      setReceiptFile(receipt);
      setFormData(prev => ({ ...prev, receipt }));
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.bookingText.trim()) newErrors.bookingText = 'Buchungstext ist erforderlich.';
    if (!formData.partner.trim() && formData.type !== 'transfer') newErrors.partner = 'Zahlungspartner ist erforderlich.';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Betrag muss größer als 0 sein.';
    if (!formData.documentNumber.trim()) newErrors.documentNumber = 'Belegnummer ist erforderlich.';
    if (formData.type === 'transfer' && formData.accountId === formData.targetAccountId) {
      newErrors.targetAccountId = 'Zielkonto muss sich vom Quellkonto unterscheiden.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalAmount = formData.type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);
    onSave({
      ...formData,
      amount: finalAmount,
      receipt: receiptFile || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {transaction ? 'Buchung bearbeiten' : 'Neue Buchung erfassen'}
              </h2>
              <p className="text-xs text-slate-500">
                Zuordnung zu den 4 steuerlichen Sphären (§§ 51 ff. AO) & Belegarchiv
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
            {/* 1. Transaction Type Toggle (Einnahme vs Ausgabe vs Umbuchung) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Buchungsart *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'income'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🟢 Einnahme (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'expense'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🔴 Ausgabe (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('transfer')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'transfer'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🔄 Umbuchung
                </button>
              </div>
            </div>

            {/* 2. Amount, Date, DocNumber, Account */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Betrag (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount || ''}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="0,00"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">EUR</span>
                </div>
                {errors.amount && <p className="text-xs text-rose-600 mt-1">{errors.amount}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buchungsdatum *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Belegnummer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.documentNumber}
                  onChange={e => setFormData({ ...formData, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                  placeholder="BE-2025-001"
                />
              </div>
            </div>

            {/* 3. Account selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {formData.type === 'transfer' ? 'Quellkonto (Abgang) *' : 'Bankkonto / Barkasse *'}
                </label>
                <select
                  value={formData.accountId}
                  onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountType === 'cash' ? 'Kasse' : 'Bank'})
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === 'transfer' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Zielkonto (Zugang) *
                  </label>
                  <select
                    value={formData.targetAccountId}
                    onChange={e => setFormData({ ...formData, targetAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">– Bitte Zielkonto wählen –</option>
                    {accounts.filter(a => a.id !== formData.accountId).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountType === 'cash' ? 'Kasse' : 'Bank'})
                      </option>
                    ))}
                  </select>
                  {errors.targetAccountId && <p className="text-xs text-rose-600 mt-1">{errors.targetAccountId}</p>}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formData.type === 'income' ? 'Zahler / Absender *' : 'Zahlungsempfänger *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.partner}
                    onChange={e => setFormData({ ...formData, partner: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="z.B. Stadtwerke AG oder Max Mustermann"
                  />
                  {errors.partner && <p className="text-xs text-rose-600 mt-1">{errors.partner}</p>}
                </div>
              )}
            </div>

            {/* 4. Booking text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Buchungstext / Verwendungszweck *
              </label>
              <input
                type="text"
                required
                value={formData.bookingText}
                onChange={e => setFormData({ ...formData, bookingText: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="z.B. Neue Trainingsbälle Jugendfußball oder Mitgliedsbeitrag 2025"
              />
              {errors.bookingText && <p className="text-xs text-rose-600 mt-1">{errors.bookingText}</p>}
            </div>

            {/* 5. STEUERLICHE SPHÄRE & KATEGORIE (German Non-profit Law §§ 51 ff. AO) */}
            {formData.type !== 'transfer' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Steuerliche Sphäre gem. §§ 51 ff. AO *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSphereHelp(!showSphereHelp)}
                    className="text-2xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showSphereHelp ? 'Sphärenhilfe ausblenden' : 'Sphären-Erklärung anzeigen'}
                  </button>
                </div>

                {showSphereHelp && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-2xs space-y-2 text-slate-700">
                    <p className="font-semibold text-blue-900">Die 4 steuerlichen Bereiche eines gemeinnützigen Vereins:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>1. Ideeller Bereich:</strong> Mitgliedsbeiträge, Spenden, Zuschüsse, allgemeine Verwaltung. Steuerfrei.</li>
                      <li><strong>2. Vermögensverwaltung:</strong> Zinsen, Mieten, Pachten, langfristige Kapitalanlage. Ertragssteuerfrei.</li>
                      <li><strong>3. Zweckbetrieb:</strong> Unmittelbare Satzungsverwirklichung (z.B. Startgelder, Lehrgänge, Eintrittsgelder Sport). Steuerbegünstigt (oft 7% USt).</li>
                      <li><strong>4. Wirtschaftl. Geschäftsbetrieb:</strong> Vereinsgaststätte, Kiosk, Trikotwerbung, Feste mit Bewirtung. Steuerpflichtig ab 45.000 € Einnahmen/Jahr.</li>
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sph => {
                    const info = TAX_SPHERES[sph];
                    const isSelected = formData.sphere === sph;
                    return (
                      <button
                        key={sph}
                        type="button"
                        onClick={() => handleSphereChange(sph)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <div className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                          {info.name.split('.')[1]}
                        </div>
                        <div className="text-2xs text-slate-500 truncate mt-0.5">
                          {info.subtitle.split('(')[0]}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-blue-600" />
                        Hauptkategorie (SKR 42) *
                      </label>
                      <select
                        value={selectedMainCatId}
                        onChange={e => handleMainCatChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                      >
                        {mainCategories.map(main => (
                          <option key={main.id} value={main.id}>
                            {main.code} - {main.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        Nebenkategorie / SKR 42-Konto *
                      </label>
                      <select
                        value={formData.subCategory || formData.category}
                        onChange={e => handleSubCatChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                      >
                        {subCategories.map(sub => (
                          <option key={sub.code} value={sub.label}>
                            {sub.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <div className="text-2xs text-slate-500 flex items-center gap-1.5">
                      <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                        SKR 42: {formData.skrAccount || 'Konto'}
                      </span>
                      <span>DATEV Standardkontenrahmen für Vereine</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-2xs font-semibold text-slate-700">
                        Umsatzsteuer:
                      </label>
                      <select
                        value={formData.vatRate}
                        onChange={e => setFormData({ ...formData, vatRate: parseInt(e.target.value) as 0 | 7 | 19 })}
                        className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="0">0% (stfrei / ideell)</option>
                        <option value="7">7% (ermäßigt / Zweckbetrieb)</option>
                        <option value="19">19% (Regelsatz / wirtschaftlich)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. BELEG-UPLOAD & KAMERASCAN (PDF, JPEG, PNG) */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  Beleg (Rechnung / Quittung) digitalisieren & anhängen
                </label>
                <span className="text-2xs text-slate-400">GoBD-konform lokal archiviert</span>
              </div>

              {receiptFile ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-800 truncate">{receiptFile.name}</p>
                      <p className="text-2xs text-slate-500">
                        {Math.round(receiptFile.size / 1024)} KB • {receiptFile.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      title="Neu mit Kamera scannen"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Neu scannen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptFile(null);
                        setFormData(prev => ({ ...prev, receipt: undefined }));
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Beleg entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Camera Scanner Action Primary Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="p-3.5 bg-white border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-left transition-all group flex flex-col justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                        <div className="p-1.5 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg transition-colors">
                          <Camera className="w-4 h-4" />
                        </div>
                        <span>Kamera-Scan</span>
                      </div>
                      <p className="text-2xs text-slate-500 mt-2">
                        Papierrechnung mit Smartphone/Webcam abfotografieren & als PDF/Bild optimieren
                      </p>
                    </button>

                    <div className="relative border border-slate-300 hover:border-slate-400 rounded-xl p-3.5 bg-white flex flex-col justify-between cursor-pointer transition-colors group">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                        <div className="p-1.5 bg-slate-100 group-hover:bg-slate-200 rounded-lg transition-colors">
                          <Upload className="w-4 h-4 text-slate-600" />
                        </div>
                        <span>Datei-Upload</span>
                      </div>
                      <p className="text-2xs text-slate-500 mt-2">
                        Vorhandenes PDF oder Bild (JPG/PNG) vom Gerät auswählen (max. 8 MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interne Notizen / Bemerkungen
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                placeholder="z.B. Prüfvermerk Kassenprüfer, Rechnungsreferenz etc."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {Object.keys(errors).length > 0 && (
                <span className="text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Bitte Eingaben prüfen
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {transaction ? 'Änderungen speichern' : 'Buchung speichern'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Camera Scanner Modal for Receipt Digitization */}
      {scannerOpen && (
        <ReceiptCameraScannerModal
          prefillDocumentNumber={formData.documentNumber}
          prefillPartner={formData.partner}
          prefillBookingText={formData.bookingText}
          accounts={accounts}
          onAttachReceipt={(receipt) => {
            setReceiptFile(receipt);
            setFormData(prev => ({ ...prev, receipt }));
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
};
