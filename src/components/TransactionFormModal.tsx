import React, { useState, useEffect, useMemo } from 'react';
import {
  Transaction,
  TransactionSplit,
  FinancialAccount,
  TaxSphere,
  ReceiptAttachment,
  ClubContact,
  Member,
  ContactType
} from '../types';
import { CONTACT_TYPE_MAP } from '../data/contactConstants';
import {
  TAX_SPHERES,
  SKR42_STRUCTURE,
  getAllSkr42MainCategories,
  getAllSkr42SubCategories,
  findSkr42Main,
  findSkr42MainForSub,
  DEFAULT_DEPARTMENTS
} from '../data/taxSpheres';
import { useSkr42 } from '../hooks/useSkr42';
import { SearchableAccountSelect, SearchableAccountOption } from './SearchableAccountSelect';
import { SplitBookingManager } from './SplitBookingManager';
import { CreateAccountModal } from './CreateAccountModal';
import {  } from '../services/customCategoryService';
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
  Camera,
  Building2,
  User,
  UserPlus,
  Plus,
  Split
} from 'lucide-react';
import { ReceiptCameraScannerModal } from './ReceiptCameraScannerModal';

interface TransactionFormModalProps {
  transaction: Transaction | null;
  accounts: FinancialAccount[];
  nextDocNumber: string;
  contacts?: ClubContact[];
  members?: Member[];
  initialPartner?: string;
  departments?: string[];
  onQuickCreateContact?: (initialName: string, initialType?: ContactType) => void;
  onSave: (tx: Transaction) => void;
  onClose: () => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  transaction,
  accounts,
  nextDocNumber,
  contacts = [],
  members = [],
  initialPartner,
  departments = DEFAULT_DEPARTMENTS,
  onQuickCreateContact,
  onSave,
  onClose
}) => {
  // Determine initial main and sub category from transaction or defaults
  const initialType: 'income' | 'expense' | 'transfer' = transaction?.type || 'expense';
  const effectiveInitialType: 'income' | 'expense' = initialType === 'transfer' ? 'expense' : initialType;

  // Detect main category across all SKR 42 structure
  const detectedMain = transaction?.mainCategory
    ? findSkr42Main(transaction.mainCategory)
    : transaction?.subCategory || transaction?.category
    ? findSkr42MainForSub(transaction.subCategory || transaction.category)
    : undefined;

  // Die Sphäre kommt seit der Entkopplung von Konto und Sphäre nur noch von
  // der Buchung selbst, nie vom gefundenen Konto (das hat gar keine Sphäre
  // mehr, siehe Hinweis bei Skr42MainCategory in src/types.ts).
  const initialSphere: TaxSphere = transaction?.sphere || 'ideell';
  const initialMainCats = getAllSkr42MainCategories(effectiveInitialType);
  const initialMainCatId = detectedMain?.id || initialMainCats[0]?.id || (effectiveInitialType === 'income' ? 'HK-40000' : 'HK-68000-IDE');
  const currentMainObj = SKR42_STRUCTURE.find(m => m.id === initialMainCatId) || initialMainCats[0];
  const initialSubCat = transaction?.subCategory || transaction?.category || currentMainObj?.subCategories[0]?.label || '';
  const initialSubObj = currentMainObj?.subCategories.find(
    s => s.label === initialSubCat || s.code === initialSubCat || s.name === initialSubCat
  ) || currentMainObj?.subCategories[0];

  const [selectedMainCatId, setSelectedMainCatId] = useState<string>(initialMainCatId);

  // Custom accounts management state
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
  const [createAccountMode, setCreateAccountMode] = useState<'main' | 'sub'>('main');
  const [createAccountInitialQuery, setCreateAccountInitialQuery] = useState('');
  const [accountCreatedToast, setAccountCreatedToast] = useState<string | null>(null);

  // Der Kontenrahmen als gewöhnlicher Wert. Legt der Kassenwart unten über
  // "Konto anlegen" ein eigenes Konto an, kommt hier der neue Stand an und
  // alle Auswahllisten rechnen neu — siehe src/data/skr42Store.ts.
  const skr42 = useSkr42();

  const [isSplitBooking, setIsSplitBooking] = useState<boolean>(
    Boolean(transaction?.isSplit && transaction?.splits && transaction.splits.length > 0)
  );

  const [splitLines, setSplitLines] = useState<TransactionSplit[]>(() => {
    if (transaction?.splits && transaction.splits.length > 0) {
      return transaction.splits;
    }
    const initAmt = transaction ? Math.abs(transaction.amount) : 0;
    return [
      {
        id: `split-${Date.now()}-1`,
        amount: initAmt,
        bookingText: transaction?.bookingText || '',
        sphere: initialSphere,
        department: transaction?.department,
        mainCategory: transaction?.mainCategory || (currentMainObj ? `${currentMainObj.code} - ${currentMainObj.name}` : ''),
        subCategory: initialSubCat,
        category: initialSubCat,
        skrAccount: transaction?.skrAccount || initialSubObj?.code || '',
        vatRate: transaction?.vatRate ?? initialSubObj?.vatRateDefault ?? 0
      },
      {
        id: `split-${Date.now()}-2`,
        amount: 0,
        bookingText: '',
        sphere: initialSphere,
        mainCategory: 'HK-68000-IDE',
        subCategory: '68100 - Nebenkosten des Geldverkehrs & Bankspesen',
        category: '68100 - Nebenkosten des Geldverkehrs & Bankspesen',
        skrAccount: '68100',
        vatRate: 0
      }
    ];
  });

  const [formData, setFormData] = useState<Transaction>({
    id: transaction?.id || `tx-${Date.now()}`,
    date: transaction?.date || new Date().toISOString().split('T')[0],
    amount: transaction ? Math.abs(transaction.amount) : 0,
    type: transaction?.type || 'expense',
    accountId: transaction?.accountId || accounts[0]?.id || 'acc-1',
    targetAccountId: transaction?.targetAccountId || '',
    documentNumber: transaction?.documentNumber || nextDocNumber,
    bookingText: transaction?.bookingText || '',
    partner: transaction?.partner || initialPartner || '',
    sphere: initialSphere,
    department: transaction?.department,
    mainCategory: transaction?.mainCategory || (currentMainObj ? `${currentMainObj.code} - ${currentMainObj.name}` : ''),
    subCategory: initialSubCat,
    category: initialSubCat,
    skrAccount: transaction?.skrAccount || initialSubObj?.code || '',
    vatRate: transaction?.vatRate ?? initialSubObj?.vatRateDefault ?? 0,
    notes: transaction?.notes || '',
    receipt: transaction?.receipt,
    createdAt: transaction?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [receiptFile, setReceiptFile] = useState<ReceiptAttachment | null>(transaction?.receipt || null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSphereHelp, setShowSphereHelp] = useState(false);

  useEffect(() => {
    if (initialPartner && !transaction) {
      setFormData(prev => ({ ...prev, partner: initialPartner }));
    }
  }, [initialPartner, transaction]);

  // Partner autocomplete & unknown contact detection
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const partnerQuery = formData.partner.trim().toLowerCase();

  const matchedSuggestions = React.useMemo(() => {
    if (formData.type === 'transfer' || !partnerQuery || partnerQuery.length < 1) {
      return [];
    }

    const list: Array<{
      id: string;
      source: 'contact' | 'member';
      name: string;
      subtitle: string;
      badge: string;
      badgeColor: string;
      contactRef?: ClubContact;
      memberRef?: Member;
    }> = [];

    // Search contacts
    for (const c of contacts) {
      const matchName = (c.displayName || '').toLowerCase().includes(partnerQuery);
      const matchCompany = (c.companyName || '').toLowerCase().includes(partnerQuery);
      const matchPerson =
        c.contactPerson &&
        `${c.contactPerson.firstName || ''} ${c.contactPerson.lastName || ''}`
          .toLowerCase()
          .includes(partnerQuery);

      if (matchName || matchCompany || matchPerson) {
        const typeNames = c.types
          .map(t => CONTACT_TYPE_MAP.get(t)?.label || t)
          .join(', ');
        list.push({
          id: c.id,
          source: 'contact',
          name: c.displayName,
          subtitle:
            c.personType === 'legal'
              ? `${c.legalForm || 'Firma'}${
                  c.contactPerson
                    ? ` • AP: ${c.contactPerson.firstName || ''} ${
                        c.contactPerson.lastName || ''
                      }`
                    : ''
                }`
              : `Natürliche Person${
                  c.address?.city ? ` (${c.address.city})` : ''
                }`,
          badge: typeNames || 'Kontakt',
          badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800/60',
          contactRef: c
        });
      }
    }

    // Search members
    for (const m of members) {
      const fullName = `${m.firstName} ${m.lastName}`.trim();
      const matchName = fullName.toLowerCase().includes(partnerQuery);
      const matchNum = (m.memberNumber || '').toLowerCase().includes(partnerQuery);

      if (matchName || matchNum) {
        list.push({
          id: m.id,
          source: 'member',
          name: fullName,
          subtitle: `Mitglied ${m.memberNumber} • Sparte: ${m.department}`,
          badge: 'Mitglied',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800/60',
          memberRef: m
        });
      }
    }

    return list.slice(0, 8);
  }, [contacts, members, partnerQuery, formData.type]);

  // Check whether entered partner is already in contacts or members
  const exactContactMatch = contacts.some(
    c =>
      (c.displayName || '').trim().toLowerCase() === partnerQuery ||
      (c.companyName || '').trim().toLowerCase() === partnerQuery
  );
  const exactMemberMatch = members.some(
    m => `${m.firstName} ${m.lastName}`.trim().toLowerCase() === partnerQuery
  );
  const isKnownPartner = exactContactMatch || exactMemberMatch;

  const handleSelectPartnerSuggestion = (s: {
    name: string;
    contactRef?: ClubContact;
    memberRef?: Member;
  }) => {
    setFormData(prev => {
      const updated = { ...prev, partner: s.name };
      if (s.contactRef) {
        const c = s.contactRef;
        if (prev.type === 'income') {
          if (c.types.includes('donor')) {
            updated.sphere = 'ideell';
            updated.mainCategory = 'Spenden und Zuwendungen';
            updated.subCategory = 'Spenden / Zuwendungen';
            updated.category = 'Spenden / Zuwendungen';
          } else if (c.types.includes('sponsor')) {
            updated.sphere = 'wirtschaftlich';
            updated.mainCategory = 'Werbung und Sponsoring';
            updated.subCategory = 'Sponsoring Einnahmen';
            updated.category = 'Sponsoring Einnahmen';
          }
        }
      }
      return updated;
    });
    setShowPartnerSuggestions(false);
  };

  // SKR-42-Konten: seit der Entkopplung von Konto und Sphäre unabhängig von
  // der gewählten Sphäre — jeder Nummernkreis steht für jede Sphäre zur
  // Verfügung (siehe Hinweis bei Skr42MainCategory in src/types.ts).
  const mainCategories = useMemo(() => {
    return getAllSkr42MainCategories(undefined, skr42);
  }, [skr42]);

  const subCategories = useMemo(() => {
    return getAllSkr42SubCategories(undefined, selectedMainCatId, skr42);
  }, [selectedMainCatId, skr42]);

  const mainCatOptions: SearchableAccountOption[] = useMemo(() => {
    return mainCategories.map(main => ({
      value: main.id,
      code: main.code,
      name: main.name,
      label: `${main.code} - ${main.name}`,
      group: main.type === 'income' ? 'Einnahmen-Konten (Erträge / Erlöse)' : 'Ausgaben-Konten (Kosten / Aufwand)',
      isCustom: main.isCustom
    }));
  }, [mainCategories]);

  const subCatOptions: SearchableAccountOption[] = useMemo(() => {
    return subCategories.map(sub => ({
      value: sub.label,
      code: sub.code,
      name: sub.name,
      label: sub.label,
      vatRateDefault: sub.vatRateDefault,
      isCustom: sub.isCustom
    }));
  }, [subCategories]);

  // Die Sphäre ist seit der Entkopplung unabhängig vom Konto: Ihre Änderung
  // rührt am gewählten Nummernkreis/Konto nicht mehr — nur noch am
  // Sphäre-Feld der Buchung selbst.
  const handleSphereChange = (sphere: TaxSphere) => {
    setFormData(prev => ({ ...prev, sphere }));
  };

  const handleDepartmentChange = (department: string) => {
    setFormData(prev => ({ ...prev, department: department || undefined }));
  };

  const handleTypeChange = (type: 'income' | 'expense' | 'transfer') => {
    setFormData(prev => ({
      ...prev,
      type
    }));
  };

  const handleMainCatChange = (mainCatId: string) => {
    setSelectedMainCatId(mainCatId);
    const main = SKR42_STRUCTURE.find(m => m.id === mainCatId || m.code === mainCatId);
    if (!main) return;
    const firstSub = main.subCategories[0];
    setFormData(prev => ({
      ...prev,
      // Die Sphäre bleibt unverändert — Konto und Sphäre sind seit der
      // Entkopplung unabhängige Felder (siehe Hinweis bei Skr42MainCategory
      // in src/types.ts).
      mainCategory: `${main.code} - ${main.name}`,
      subCategory: firstSub?.label || '',
      category: firstSub?.label || '',
      skrAccount: firstSub?.code || '',
      vatRate: firstSub?.vatRateDefault ?? 0
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

    if (isSplitBooking && formData.type !== 'transfer') {
      if (splitLines.length < 2) {
        newErrors.splits = 'Eine Splittbuchung muss aus mindestens 2 Teilbuchungen bestehen.';
      }
      const sumOfSplits = splitLines.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const diff = Number((formData.amount - sumOfSplits).toFixed(2));
      if (Math.abs(diff) > 0.009) {
        newErrors.splits = `Die Summe der Teilbeträge (${sumOfSplits.toFixed(2)} €) stimmt nicht mit der Buchungssumme (${formData.amount.toFixed(2)} €) überein. Differenz: ${diff.toFixed(2)} €.`;
      }
      const hasInvalidRow = splitLines.some(s => !s.amount || s.amount <= 0);
      if (hasInvalidRow) {
        newErrors.splits = 'Jede Teilbuchung muss einen Betrag größer als 0,00 € haben.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalAmount = formData.type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);
    
    if (isSplitBooking && formData.type !== 'transfer' && splitLines.length > 0) {
      const primarySplit = splitLines[0];
      onSave({
        ...formData,
        amount: finalAmount,
        isSplit: true,
        splits: splitLines.map(s => ({
          ...s,
          amount: Math.abs(s.amount)
        })),
        sphere: primarySplit.sphere,
        department: primarySplit.department,
        mainCategory: primarySplit.mainCategory,
        subCategory: primarySplit.subCategory,
        category: primarySplit.category,
        skrAccount: primarySplit.skrAccount,
        vatRate: primarySplit.vatRate,
        receipt: receiptFile || undefined
      });
    } else {
      onSave({
        ...formData,
        amount: finalAmount,
        isSplit: false,
        splits: undefined,
        receipt: receiptFile || undefined
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 my-8 dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl dark:bg-emerald-900/40 dark:text-emerald-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {transaction ? 'Buchung bearbeiten' : 'Neue Buchung erfassen'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zuordnung zu den 4 steuerlichen Sphären (§§ 51 ff. AO) & Belegarchiv
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
            {/* 1. Transaction Type Toggle (Einnahme vs Ausgabe vs Umbuchung) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 dark:text-slate-200">
                Buchungsart *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'income'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  🟢 Einnahme (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'expense'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  🔴 Ausgabe (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('transfer')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    formData.type === 'transfer'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  🔄 Umbuchung
                </button>
              </div>
            </div>

            {/* 2. Amount, Date, DocNumber, Account */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
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
                    className="w-full px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono dark:border-slate-700"
                    placeholder="0,00"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">EUR</span>
                </div>
                {errors.amount && <p className="text-xs text-rose-600 mt-1 dark:text-rose-400">{errors.amount}</p>}
                {formData.type !== 'transfer' && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !isSplitBooking;
                        setIsSplitBooking(nextVal);
                        if (nextVal && splitLines.length > 0 && splitLines[0].amount === 0 && formData.amount > 0) {
                          setSplitLines(prev => [
                            { ...prev[0], amount: formData.amount },
                            ...prev.slice(1)
                          ]);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-2xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer dark:text-indigo-400 dark:hover:text-indigo-200"
                      title="Buchungsbetrag auf mehrere Teilbuchungen mit jeweils eigener Sphäre und Konten aufteilen"
                    >
                      <Split className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{isSplitBooking ? 'Splittbuchung aktiv (beenden)' : 'Als Splittbuchung aufteilen'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Buchungsdatum *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  Belegnummer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.documentNumber}
                  onChange={e => setFormData({ ...formData, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
                  placeholder="BE-2025-001"
                />
              </div>
            </div>

            {/* 3. Account selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                  {formData.type === 'transfer' ? 'Quellkonto (Abgang) *' : 'Bankkonto / Barkasse *'}
                </label>
                <select
                  value={formData.accountId}
                  onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 font-medium dark:border-slate-700 dark:bg-slate-800"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Zielkonto (Zugang) *
                  </label>
                  <select
                    value={formData.targetAccountId}
                    onChange={e => setFormData({ ...formData, targetAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">– Bitte Zielkonto wählen –</option>
                    {accounts.filter(a => a.id !== formData.accountId).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountType === 'cash' ? 'Kasse' : 'Bank'})
                      </option>
                    ))}
                  </select>
                  {errors.targetAccountId && <p className="text-xs text-rose-600 mt-1 dark:text-rose-400">{errors.targetAccountId}</p>}
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {formData.type === 'income' ? 'Zahler / Absender *' : 'Zahlungsempfänger *'}
                    </label>
                    {onQuickCreateContact && (
                      <button
                        type="button"
                        onClick={() =>
                          onQuickCreateContact(
                            formData.partner.trim(),
                            formData.type === 'income' ? 'sponsor' : 'supplier'
                          )
                        }
                        className="text-xs text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 cursor-pointer dark:text-orange-400 dark:hover:text-orange-200"
                        title="Als neuen Kontakt anlegen"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Neuer Kontakt</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.partner}
                      onChange={e => {
                        setFormData({ ...formData, partner: e.target.value });
                        setShowPartnerSuggestions(true);
                      }}
                      onFocus={() => setShowPartnerSuggestions(true)}
                      onBlur={() => {
                        // Delay hide slightly so clicks on suggestions register
                        setTimeout(() => setShowPartnerSuggestions(false), 250);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
                      placeholder="z.B. Stadtwerke AG oder Max Mustermann"
                    />

                    {/* Autocomplete Dropdown */}
                    {showPartnerSuggestions && matchedSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                        <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between dark:bg-slate-800 dark:text-slate-400">
                          <span>Vorschläge aus Kontakten & Mitgliedern</span>
                          <span className="text-slate-400 font-normal">Klicken zum Übernehmen</span>
                        </div>
                        {matchedSuggestions.map(s => (
                          <div
                            key={`${s.source}-${s.id}`}
                            onMouseDown={e => {
                              e.preventDefault(); // Prevent input onBlur before click
                              handleSelectPartnerSuggestion(s);
                            }}
                            className="px-3 py-1.5 text-left hover:bg-orange-50/60 transition-colors flex items-center justify-between group cursor-pointer dark:hover:bg-orange-950/60"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`p-1 rounded-md shrink-0 ${
                                  s.source === 'contact'
                                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                }`}
                              >
                                {s.source === 'contact' ? (
                                  <Building2 className="w-3.5 h-3.5" />
                                ) : (
                                  <User className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 group-hover:text-orange-950 truncate dark:text-white">
                                  {s.name}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate dark:text-slate-400">
                                  {s.subtitle}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${s.badgeColor}`}
                            >
                              {s.badge}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.partner && <p className="text-xs text-rose-600 mt-1 dark:text-rose-400">{errors.partner}</p>}

                  {/* Suggestion prompt: if non-empty partner typed (>= 3 letters) that is not known */}
                  {formData.partner.trim().length >= 3 && !isKnownPartner && onQuickCreateContact && (
                    <div className="mt-1.5 px-3 py-2 bg-amber-50/90 border border-amber-200/80 rounded-lg flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150 dark:bg-amber-950/90 dark:border-amber-800/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs shrink-0">💡</span>
                        <div className="text-[11px] text-amber-900 leading-tight truncate dark:text-amber-100">
                          <span className="font-semibold">Noch kein Kontakt:</span> &bdquo;{formData.partner.trim()}&ldquo; ist noch nicht im Kontaktbuch.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onQuickCreateContact(
                            formData.partner.trim(),
                            formData.type === 'income' ? 'sponsor' : 'supplier'
                          )
                        }
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium shadow-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Als Kontakt anlegen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Booking text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Buchungstext / Verwendungszweck *
                </label>
              </div>
              <input
                type="text"
                required
                value={formData.bookingText}
                onChange={e => setFormData({ ...formData, bookingText: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
                placeholder="z.B. Neue Trainingsbälle Jugendfußball oder Mitgliedsbeitrag 2025"
              />
              {errors.bookingText && <p className="text-xs text-rose-600 mt-1 dark:text-rose-400">{errors.bookingText}</p>}
            </div>

            {/* 5. STEUERLICHE SPHÄRE & KATEGORIE (German Non-profit Law §§ 51 ff. AO) */}
            {formData.type !== 'transfer' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 dark:bg-slate-800 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 dark:text-white">
                    Steuerliche Sphäre gem. §§ 51 ff. AO *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSphereHelp(!showSphereHelp)}
                      className="text-2xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium cursor-pointer dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showSphereHelp ? 'Hilfe ausblenden' : 'Sphären-Hilfe'}
                    </button>
                  </div>
                </div>

                {showSphereHelp && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-2xs space-y-2 text-slate-700 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-slate-200">
                    <p className="font-semibold text-blue-900 dark:text-blue-100">Die 4 steuerlichen Bereiche eines gemeinnützigen Vereins:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>1. Ideeller Bereich:</strong> Mitgliedsbeiträge, Spenden, Zuschüsse, allgemeine Verwaltung. Steuerfrei.</li>
                      <li><strong>2. Vermögensverwaltung:</strong> Zinsen, Mieten, Pachten, langfristige Kapitalanlage. Ertragssteuerfrei.</li>
                      <li><strong>3. Zweckbetrieb:</strong> Unmittelbare Satzungsverwirklichung (z.B. Startgelder, Lehrgänge, Eintrittsgelder Sport). Steuerbegünstigt (oft 7% USt).</li>
                      <li><strong>4. Wirtschaftl. Geschäftsbetrieb:</strong> Vereinsgaststätte, Kiosk, Trikotwerbung, Feste mit Bewirtung. Steuerpflichtig ab 45.000 € Einnahmen/Jahr.</li>
                    </ul>
                  </div>
                )}

                {isSplitBooking ? (
                  <SplitBookingManager
                    totalAmount={formData.amount}
                    transactionType={formData.type}
                    splits={splitLines}
                    departments={departments}
                    onChange={setSplitLines}
                    onCancelSplit={() => setIsSplitBooking(false)}
                    error={errors.splits}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sph => {
                    const info = TAX_SPHERES[sph];
                    const isSelected = formData.sphere === sph;
                    return (
                      <button
                        key={sph}
                        type="button"
                        onClick={() => handleSphereChange(sph)}
                        className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all min-w-0 flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-xs dark:bg-slate-900'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        title={info.name}
                      >
                        <div className="min-w-0 w-full">
                          <div className="text-[10px] font-semibold text-slate-400 mb-0.5">
                            Sphäre {sph === 'ideell' ? '1' : sph === 'vermoegen' ? '2' : sph === 'zweckbetrieb' ? '3' : '4'}
                          </div>
                          <div
                            className={`text-[11px] sm:text-xs font-bold leading-tight break-words hyphens-auto ${
                              isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'
                            }`}
                            lang="de"
                          >
                            {sph === 'vermoegen'
                              ? 'Vermögens\u00ADverwaltung'
                              : sph === 'wirtschaftlich'
                              ? 'Wirtschaftl. Betrieb'
                              : info.name.split('.')[1]?.trim()}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-1 dark:text-slate-400">
                          {info.subtitle.split('(')[0]?.trim()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3 pt-2">
                  {accountCreatedToast && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 dark:text-emerald-400" />
                      <span>{accountCreatedToast}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                    <SearchableAccountSelect
                      label={
                        <>
                          <Layers className="w-3 h-3 text-blue-600 shrink-0 dark:text-blue-400" />
                          <span>Nummernkreis (SKR 42) *</span>
                        </>
                      }
                      headerRight={
                        <button
                          type="button"
                          onClick={() => {
                            setCreateAccountMode('main');
                            setCreateAccountInitialQuery('');
                            setCreateAccountModalOpen(true);
                          }}
                          className="text-3xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-0.5 dark:text-blue-400 dark:hover:text-blue-200"
                          title="Neuen Nummernkreis erstellen"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Neu</span>
                        </button>
                      }
                      value={selectedMainCatId}
                      onChange={handleMainCatChange}
                      options={mainCatOptions}
                      placeholder="Nummernkreis auswählen..."
                      searchPlaceholder="Nummer oder Nummernkreis tippen (z.B. 40000, Spenden)..."
                      onAddNew={(query) => {
                        setCreateAccountMode('main');
                        setCreateAccountInitialQuery(query || '');
                        setCreateAccountModalOpen(true);
                      }}
                      addNewLabel="Neuen Nummernkreis anlegen..."
                    />

                    <SearchableAccountSelect
                      label={
                        <>
                          <Tag className="w-3 h-3 text-emerald-600 shrink-0 dark:text-emerald-400" />
                          <span>Konto (SKR 42) *</span>
                        </>
                      }
                      headerRight={
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCreateAccountMode('sub');
                              setCreateAccountInitialQuery('');
                              setCreateAccountModalOpen(true);
                            }}
                            className="text-3xs text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer flex items-center gap-0.5 dark:text-emerald-400 dark:hover:text-emerald-200"
                            title="Neues Konto erstellen"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Neu</span>
                          </button>
                          <span className="text-slate-300">•</span>
                          <span className="text-3xs text-slate-400 font-normal">
                            {subCategories.length} {subCategories.length === 1 ? 'Konto' : 'Konten'}
                          </span>
                        </div>
                      }
                      value={formData.subCategory || formData.category}
                      onChange={handleSubCatChange}
                      options={subCatOptions}
                      placeholder="Konto auswählen..."
                      searchPlaceholder="Nummer oder Begriff tippen (z.B. 40000, 60040, Übungsleiter)..."
                      onAddNew={(query) => {
                        setCreateAccountMode('sub');
                        setCreateAccountInitialQuery(query || '');
                        setCreateAccountModalOpen(true);
                      }}
                      addNewLabel="Neues Konto anlegen..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 dark:text-slate-200">
                      Sparte / Abteilung
                    </label>
                    <select
                      value={formData.department || ''}
                      onChange={e => handleDepartmentChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Gesamtverein (keine Sparte)</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <span className="text-3xs text-slate-400 mt-1 block">
                      Optional — für die Auswertung nach Sparten in der Finanzübersicht
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-2xs text-slate-600 flex items-center gap-2 dark:text-slate-300">
                      <span className="font-mono bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800 font-bold dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-200">
                        SKR 42: {formData.skrAccount || 'Konto'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Sphäre: <strong className="text-slate-700 dark:text-slate-200">{TAX_SPHERES[formData.sphere]?.name || formData.sphere}</strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Sparte: <strong className="text-slate-700 dark:text-slate-200">{formData.department || 'Gesamtverein'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-2xs font-semibold text-slate-700 dark:text-slate-200">
                        Umsatzsteuer:
                      </label>
                      <select
                        value={formData.vatRate}
                        onChange={e => setFormData({ ...formData, vatRate: parseInt(e.target.value) as 0 | 7 | 19 })}
                        className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="0">0% (stfrei / ideell)</option>
                        <option value="7">7% (ermäßigt / Zweckbetrieb)</option>
                        <option value="19">19% (Regelsatz / wirtschaftlich)</option>
                      </select>
                    </div>
                  </div>

                  {/* Link to switch to Splittbuchung */}
                  <div className="pt-2 border-t border-slate-200/80 flex justify-end dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSplitBooking(true);
                        if (splitLines.length > 0 && splitLines[0].amount === 0 && formData.amount > 0) {
                          setSplitLines(prev => [
                            { ...prev[0], amount: formData.amount },
                            ...prev.slice(1)
                          ]);
                        }
                      }}
                      className="text-2xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded hover:bg-indigo-50/70 transition-colors dark:text-indigo-400 dark:hover:text-indigo-200 dark:hover:bg-indigo-950/70"
                    >
                      <Split className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Diesen Betrag auf mehrere Konten/Sphären aufteilen (Splittbuchung)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

            {/* 6. BELEG-UPLOAD & KAMERASCAN (PDF, JPEG, PNG) */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 dark:text-slate-100">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Beleg (Rechnung / Quittung) digitalisieren & anhängen
                </label>
                <span className="text-2xs text-slate-400">GoBD-konform lokal archiviert</span>
              </div>

              {receiptFile ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-950/40 dark:border-emerald-800/60">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 dark:text-emerald-400" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-800 truncate dark:text-slate-100">{receiptFile.name}</p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400">
                        {Math.round(receiptFile.size / 1024)} KB • {receiptFile.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors dark:hover:text-rose-400 dark:hover:bg-rose-950/40"
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
                      className="p-3.5 bg-white border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-left transition-all group flex flex-col justify-between shadow-2xs dark:bg-slate-900 dark:border-emerald-700/60 dark:hover:bg-emerald-950/50"
                    >
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs dark:text-emerald-300">
                        <div className="p-1.5 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg transition-colors dark:bg-emerald-900/40 dark:group-hover:bg-emerald-900/60">
                          <Camera className="w-4 h-4" />
                        </div>
                        <span>Kamera-Scan</span>
                      </div>
                      <p className="text-2xs text-slate-500 mt-2 dark:text-slate-400">
                        Papierrechnung mit Smartphone/Webcam abfotografieren & als PDF/Bild optimieren
                      </p>
                    </button>

                    <div className="relative border border-slate-300 hover:border-slate-400 rounded-xl p-3.5 bg-white flex flex-col justify-between cursor-pointer transition-colors group dark:border-slate-700 dark:bg-slate-800">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-2 text-slate-700 font-bold text-xs dark:text-slate-200">
                        <div className="p-1.5 bg-slate-100 group-hover:bg-slate-200 rounded-lg transition-colors dark:bg-slate-700 dark:group-hover:bg-slate-600">
                          <Upload className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <span>Datei-Upload</span>
                      </div>
                      <p className="text-2xs text-slate-500 mt-2 dark:text-slate-400">
                        Vorhandenes PDF oder Bild (JPG/PNG) vom Gerät auswählen (max. 8 MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                Interne Notizen / Bemerkungen
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 dark:border-slate-700"
                placeholder="z.B. Prüfvermerk Kassenprüfer, Rechnungsreferenz etc."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between dark:bg-slate-800 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {Object.keys(errors).length > 0 && (
                <span className="text-rose-600 font-medium flex items-center gap-1 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Bitte Eingaben prüfen
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
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

      {/* Modal for creating custom SKR42 Haupt- and Nebenkonten directly from Dropdowns */}
      <CreateAccountModal
        isOpen={createAccountModalOpen}
        onClose={() => setCreateAccountModalOpen(false)}
        mode={createAccountMode}
        currentType={formData.type === 'transfer' ? 'expense' : formData.type}
        currentMainCatIdOrCode={selectedMainCatId}
        initialQuery={createAccountInitialQuery}
        onCreatedMain={(newMain) => {
          setSelectedMainCatId(newMain.id);
          handleMainCatChange(newMain.id);
          setAccountCreatedToast(`Nummernkreis [${newMain.code}] ${newMain.name} erfolgreich angelegt und ausgewählt!`);
          setTimeout(() => setAccountCreatedToast(null), 5000);
        }}
        onCreatedSub={(newSub, parentMain) => {
          setSelectedMainCatId(parentMain.id);
          handleSubCatChange(newSub.label);
          setAccountCreatedToast(`Konto [${newSub.code}] ${newSub.name} erfolgreich angelegt und ausgewählt!`);
          setTimeout(() => setAccountCreatedToast(null), 5000);
        }}
      />
    </div>
  );
};
