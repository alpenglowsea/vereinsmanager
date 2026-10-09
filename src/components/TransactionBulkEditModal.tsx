import React, { useState, useMemo } from 'react';
import {
  Transaction,
  FinancialAccount,
  TaxSphere,
  TransactionBulkUpdates
} from '../types';
import { TAX_SPHERES, SKR42_STRUCTURE, DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import { SearchableAccountSelect, SearchableAccountOption } from './SearchableAccountSelect';
import {
  X,
  SlidersHorizontal,
  Wallet,
  Building2,
  Tag,
  Percent,
  User,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';

interface TransactionBulkEditModalProps {
  selectedTransactions: Transaction[];
  accounts: FinancialAccount[];
  onSave: (updates: TransactionBulkUpdates) => Promise<void>;
  onClose: () => void;
  departments?: string[];
}

export const TransactionBulkEditModal: React.FC<TransactionBulkEditModalProps> = ({
  selectedTransactions,
  accounts,
  onSave,
  onClose,
  departments = DEFAULT_DEPARTMENTS
}) => {
  // Activation flags
  const [applyAccount, setApplyAccount] = useState(false);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');

  const [applySphere, setApplySphere] = useState(false);
  const [sphere, setSphere] = useState<TaxSphere>('ideell');

  const [applySkr, setApplySkr] = useState(false);
  const [selectedMainCode, setSelectedMainCode] = useState<string>('');
  const [selectedSubCode, setSelectedSubCode] = useState<string>('');

  const [applyVatRate, setApplyVatRate] = useState(false);
  const [vatRate, setVatRate] = useState<0 | 7 | 19>(0);

  const [applyPartner, setApplyPartner] = useState(false);
  const [partner, setPartner] = useState<string>('');

  const [applyDate, setApplyDate] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [applyNotes, setApplyNotes] = useState(false);
  const [notesAction, setNotesAction] = useState<'append' | 'replace'>('append');
  const [notesValue, setNotesValue] = useState<string>('');

  const [applyDepartment, setApplyDepartment] = useState(false);
  const [department, setDepartment] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTxList, setShowTxList] = useState(false);

  // Nummernkreise sind seit der DATEV-SKR42-Umstellung unabhängig von der
  // Sphäre (die Sphäre wird je Buchung über KOST1 vergeben, nicht über das
  // Konto) — die Liste wird darum nicht mehr nach Sphäre gefiltert.
  const availableMainCategories = SKR42_STRUCTURE;

  // Options for Nummernkreis
  const mainAccountOptions: SearchableAccountOption[] = useMemo(() => {
    return availableMainCategories.map(m => ({
      value: m.code,
      code: m.code,
      name: m.name,
      label: `${m.code} - ${m.name}`
    }));
  }, [availableMainCategories]);

  // Options for Konto
  const subAccountOptions: SearchableAccountOption[] = useMemo(() => {
    if (selectedMainCode) {
      const parent = SKR42_STRUCTURE.find(m => m.code === selectedMainCode);
      if (parent) {
        return parent.subCategories.map(s => ({
          value: s.code,
          code: s.code,
          name: s.name,
          label: `${s.code} - ${s.name}`,
          vatRateDefault: s.vatRateDefault
        }));
      }
    }
    // Fallback: alle Unterkonten aller Nummernkreise
    const allSubs: SearchableAccountOption[] = [];
    availableMainCategories.forEach(m => {
      m.subCategories.forEach(s => {
        allSubs.push({
          value: s.code,
          code: s.code,
          name: s.name,
          label: `${s.code} - ${s.name} (${m.name})`,
          group: `${m.code} - ${m.name}`,
          vatRateDefault: s.vatRateDefault
        });
      });
    });
    return allSubs;
  }, [selectedMainCode, availableMainCategories]);

  // Handle main account selection
  const handleMainCodeChange = (code: string) => {
    setSelectedMainCode(code);
    const parent = SKR42_STRUCTURE.find(m => m.code === code);
    if (parent && parent.subCategories.length > 0) {
      setSelectedSubCode(parent.subCategories[0].code);
      if (applyVatRate && parent.subCategories[0].vatRateDefault !== undefined) {
        setVatRate(parent.subCategories[0].vatRateDefault);
      }
    } else {
      setSelectedSubCode('');
    }
  };

  // Count active modifications
  const activeChangeCount = [
    applyAccount,
    applySphere,
    applySkr,
    applyVatRate,
    applyPartner,
    applyDate,
    applyNotes,
    applyDepartment
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChangeCount === 0) return;

    const updates: TransactionBulkUpdates = {};
    if (applyAccount) updates.accountId = accountId;
    if (applySphere) updates.sphere = sphere;
    if (applyVatRate) updates.vatRate = vatRate;
    if (applyPartner && partner.trim()) updates.partner = partner.trim();
    if (applyDate) updates.date = date;
    if (applyDepartment) updates.department = department;

    if (applySkr) {
      const mainCat = SKR42_STRUCTURE.find(m => m.code === selectedMainCode);
      let subCat = mainCat?.subCategories.find(s => s.code === selectedSubCode);
      if (!subCat && selectedSubCode) {
        // Search across all
        for (const m of SKR42_STRUCTURE) {
          const s = m.subCategories.find(sc => sc.code === selectedSubCode);
          if (s) {
            subCat = s;
            break;
          }
        }
      }
      if (mainCat) {
        updates.mainCategory = `${mainCat.code} - ${mainCat.name}`;
      }
      if (subCat) {
        updates.subCategory = `${subCat.code} - ${subCat.name}`;
        updates.skrAccount = subCat.code;
        updates.category = subCat.name;
      } else if (mainCat) {
        updates.category = mainCat.name;
      }
    }

    if (applyNotes && notesValue.trim()) {
      updates.notesAction = notesAction;
      updates.notesValue = notesValue.trim();
    }

    setIsSubmitting(true);
    try {
      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('Failed to bulk update transactions:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8 dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold dark:bg-blue-900/40 dark:text-blue-300">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Sammelbearbeitung: {selectedTransactions.length} Buchung(en)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aktivieren Sie die gewünschten Kontrollkästchen, um diese Werte für alle ausgewählten Buchungen zeitgleich anzupassen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200/50 rounded-lg transition-colors dark:hover:text-slate-300 dark:hover:bg-slate-600/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Transactions Drawer / Dropdown */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs dark:bg-blue-950/60 dark:border-blue-900/50">
          <span className="text-blue-900 font-medium dark:text-blue-100">
            Ausgewählt: <span className="font-bold">{selectedTransactions.length} Buchungen</span>
          </span>
          <button
            type="button"
            onClick={() => setShowTxList(!showTxList)}
            className="text-blue-600 hover:text-blue-800 underline font-semibold dark:text-blue-400 dark:hover:text-blue-200"
          >
            {showTxList ? 'Details ausblenden' : 'Details einblenden'}
          </button>
        </div>

        {showTxList && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 max-h-44 overflow-y-auto dark:bg-slate-800 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
              {selectedTransactions.map(t => (
                <div key={t.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t.documentNumber || t.date}</span>
                    <span className="text-slate-500 ml-1.5 truncate dark:text-slate-400">
                      {t.bookingText || t.partner}
                    </span>
                  </div>
                  <span className={`font-mono font-bold whitespace-nowrap ${t.amount >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    {t.amount.toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div>
              <span className="font-bold">Hinweis zur GoBD-Konformität:</span> Nur die angekreuzten Felder werden überschrieben. Nicht markierte Buchungsattribute (z.B. Betrag, Belegnummer) bleiben unberührt.
            </div>
          </div>

          {/* 1. Finanzkonto */}
          <div className={`p-4 rounded-xl border transition-all ${applyAccount ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAccount}
                  onChange={e => setApplyAccount(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Finanzkonto zuordnen
                </span>
              </label>
              {applyAccount && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyAccount && (
              <div className="mt-3 pl-6">
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountType === 'cash' ? 'Bargeld / Kasse' : 'Bankkonto'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Steuerliche Sphäre */}
          <div className={`p-4 rounded-xl border transition-all ${applySphere ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySphere}
                  onChange={e => setApplySphere(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Steuerliche Sphäre festlegen
                </span>
              </label>
              {applySphere && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applySphere && (
              <div className="mt-3 pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sp => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSphere(sp)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      sphere === sp
                        ? 'border-blue-600 bg-blue-100/70 text-blue-900 font-bold ring-1 ring-blue-500 dark:bg-blue-900/70 dark:text-blue-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold">{TAX_SPHERES[sp].name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate dark:text-slate-400">{TAX_SPHERES[sp].subtitle}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. SKR 42 Kontierung / Kategorie */}
          <div className={`p-4 rounded-xl border transition-all ${applySkr ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySkr}
                  onChange={e => setApplySkr(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  DATEV SKR 42 Kontierung (Nummernkreis & Konto)
                </span>
              </label>
              {applySkr && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applySkr && (
              <div className="mt-3 pl-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="flex flex-col">
                    <SearchableAccountSelect
                      label="1. Nummernkreis"
                      value={selectedMainCode}
                      options={mainAccountOptions}
                      onChange={handleMainCodeChange}
                      placeholder="Nummernkreis auswählen..."
                      searchPlaceholder="Ziffer oder Text suchen..."
                    />
                  </div>

                  <div className="flex flex-col">
                    <SearchableAccountSelect
                      label="2. Konto"
                      value={selectedSubCode}
                      options={subAccountOptions}
                      onChange={code => {
                        setSelectedSubCode(code);
                        const parent = SKR42_STRUCTURE.find(m => m.subCategories.some(s => s.code === code));
                        if (parent && !selectedMainCode) {
                          setSelectedMainCode(parent.code);
                        }
                      }}
                      placeholder="Konto auswählen..."
                      searchPlaceholder="Konto oder Nummer tippen..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Umsatzsteuersatz */}
          <div className={`p-4 rounded-xl border transition-all ${applyVatRate ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyVatRate}
                  onChange={e => setApplyVatRate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Umsatzsteuersatz (USt.)
                </span>
              </label>
              {applyVatRate && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyVatRate && (
              <div className="mt-3 pl-6 flex items-center gap-3">
                {[0, 7, 19].map(rate => (
                  <label
                    key={rate}
                    className={`flex-1 py-2 px-3 rounded-lg border text-center text-xs font-bold cursor-pointer transition-all ${
                      vatRate === rate
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="vatRateBulk"
                      checked={vatRate === rate}
                      onChange={() => setVatRate(rate as 0 | 7 | 19)}
                      className="sr-only"
                    />
                    {rate}% USt.
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 5. Zahlungspartner / Empfänger */}
          <div className={`p-4 rounded-xl border transition-all ${applyPartner ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyPartner}
                  onChange={e => setApplyPartner(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Zahlungsempfänger / Einzahler vereinheitlichen
                </span>
              </label>
              {applyPartner && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyPartner && (
              <div className="mt-3 pl-6">
                <input
                  type="text"
                  value={partner}
                  onChange={e => setPartner(e.target.value)}
                  placeholder="z.B. Stadtwerke Musterstadt, Landessportbund..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* 6. Buchungsdatum */}
          <div className={`p-4 rounded-xl border transition-all ${applyDate ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDate}
                  onChange={e => setApplyDate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Buchungsdatum ändern
                </span>
              </label>
              {applyDate && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyDate && (
              <div className="mt-3 pl-6">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* 7. Notizen */}
          <div className={`p-4 rounded-xl border transition-all ${applyNotes ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyNotes}
                  onChange={e => setApplyNotes(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Notiz / Buchungsvermerk
                </span>
              </label>
              {applyNotes && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyNotes && (
              <div className="mt-3 pl-6 space-y-2">
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="notesAction"
                      value="append"
                      checked={notesAction === 'append'}
                      onChange={() => setNotesAction('append')}
                      className="text-blue-600 dark:text-blue-400"
                    />
                    An bestehende Notiz anfügen
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="notesAction"
                      value="replace"
                      checked={notesAction === 'replace'}
                      onChange={() => setNotesAction('replace')}
                      className="text-blue-600 dark:text-blue-400"
                    />
                    Notiz vollständig ersetzen
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="z.B. Geprüft durch Kassenprüfer am 15.03.2026..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-800 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* 8. Sparte */}
          <div className={`p-4 rounded-xl border transition-all ${applyDepartment ? 'bg-blue-50/40 border-blue-300 shadow-xs dark:bg-blue-950/40 dark:border-blue-700/60' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDepartment}
                  onChange={e => setApplyDepartment(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 dark:text-blue-400 dark:border-slate-700"
                />
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                  <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Sparte zuordnen
                </span>
              </label>
              {applyDepartment && <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Wird geändert</span>}
            </div>

            {applyDepartment && (
              <div className="mt-3 pl-6">
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  <option value="">Gesamtverein (keine Sparte)</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/80">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeChangeCount === 0 ? (
              <span className="text-amber-700 font-medium dark:text-amber-300">
                Bitte aktivieren Sie mindestens ein Feld zur Sammelbearbeitung.
              </span>
            ) : (
              <span className="text-blue-800 font-semibold dark:text-blue-200">
                {activeChangeCount} Feld(er) werden für {selectedTransactions.length} Buchungen angepasst.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={activeChangeCount === 0 || isSubmitting}
              className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 ${
                activeChangeCount === 0 || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500 dark:bg-slate-500 dark:text-slate-400'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? (
                <>Speichern...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedTransactions.length} Buchungen aktualisieren</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
