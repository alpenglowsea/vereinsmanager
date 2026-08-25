import React, { useState } from 'react';
import {
  Member,
  PaymentMethod,
  FeePeriod,
  MembershipStatus,
  MembershipType,
  MemberBulkUpdates
} from '../types';
import {
  X,
  SlidersHorizontal,
  CreditCard,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Tag,
  DollarSign,
  Clock
} from 'lucide-react';

interface MemberBulkEditModalProps {
  selectedMembers: Member[];
  departments: string[];
  onSave: (updates: MemberBulkUpdates) => Promise<void>;
  onClose: () => void;
}

export const MemberBulkEditModal: React.FC<MemberBulkEditModalProps> = ({
  selectedMembers,
  departments,
  onSave,
  onClose
}) => {
  // Field activation flags (only checked fields will be applied)
  const [applyPaymentMethod, setApplyPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepa');

  const [applyFeePeriod, setApplyFeePeriod] = useState(false);
  const [feePeriod, setFeePeriod] = useState<FeePeriod>('yearly');

  const [applyMonthlyDueDay, setApplyMonthlyDueDay] = useState(false);
  const [monthlyDueDay, setMonthlyDueDay] = useState<1 | 15>(1);

  const [applyStatus, setApplyStatus] = useState(false);
  const [status, setStatus] = useState<MembershipStatus>('active');

  const [applyMembershipType, setApplyMembershipType] = useState(false);
  const [membershipType, setMembershipType] = useState<MembershipType>('full');

  const [applyDepartment, setApplyDepartment] = useState(false);
  const [department, setDepartment] = useState<string>(departments[0] || 'Gesamtverein');

  const [applyFeeAmount, setApplyFeeAmount] = useState(false);
  const [feeAmount, setFeeAmount] = useState<number>(120);

  const [applyEntryDate, setApplyEntryDate] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [applyExitDate, setApplyExitDate] = useState(false);
  const [exitDate, setExitDate] = useState<string>('');

  const [applyDataPrivacy, setApplyDataPrivacy] = useState(false);
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState<boolean>(true);

  const [applyNotes, setApplyNotes] = useState(false);
  const [notesAction, setNotesAction] = useState<'append' | 'replace'>('append');
  const [notesValue, setNotesValue] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);

  // Count active modifications
  const activeChangeCount = [
    applyPaymentMethod,
    applyFeePeriod,
    applyMonthlyDueDay,
    applyStatus,
    applyMembershipType,
    applyDepartment,
    applyFeeAmount,
    applyEntryDate,
    applyExitDate,
    applyDataPrivacy,
    applyNotes
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChangeCount === 0) return;

    const updates: MemberBulkUpdates = {};
    if (applyPaymentMethod) updates.paymentMethod = paymentMethod;
    if (applyFeePeriod) updates.feePeriod = feePeriod;
    if (applyMonthlyDueDay) updates.monthlyDueDay = monthlyDueDay;
    if (applyStatus) updates.status = status;
    if (applyMembershipType) updates.membershipType = membershipType;
    if (applyDepartment) updates.department = department;
    if (applyFeeAmount) updates.feeAmount = Number(feeAmount);
    if (applyEntryDate) updates.entryDate = entryDate;
    if (applyExitDate) updates.exitDate = exitDate;
    if (applyDataPrivacy) updates.dataPrivacyConsent = dataPrivacyConsent;
    if (applyNotes && notesValue.trim()) {
      updates.notesAction = notesAction;
      updates.notesValue = notesValue.trim();
    }

    try {
      setIsSubmitting(true);
      await onSave(updates);
    } catch (err) {
      console.error('Failed to apply bulk updates:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Stammdaten-Sammelbearbeitung
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {selectedMembers.length} Mitglieder ausgewählt
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ändern Sie gemeinsame Stammdaten für alle markierten Personen in einem Schritt.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Members Banner */}
        <div className="px-6 py-2.5 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Betroffene Mitglieder: <strong>{selectedMembers.slice(0, 3).map(m => `${m.firstName} ${m.lastName}`).join(', ')}</strong>
              {selectedMembers.length > 3 ? ` und ${selectedMembers.length - 3} weitere` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowMemberList(!showMemberList)}
            className="text-[11px] font-bold text-blue-700 hover:underline shrink-0"
          >
            {showMemberList ? 'Ausblenden' : 'Alle anzeigen'}
          </button>
        </div>

        {/* Collapsible Member List Preview */}
        {showMemberList && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 max-h-36 overflow-y-auto text-xs divide-y divide-slate-100">
            {selectedMembers.map(m => (
              <div key={m.id} className="py-1.5 flex items-center justify-between">
                <span className="font-semibold text-slate-800">{m.lastName}, {m.firstName}</span>
                <span className="text-slate-400 font-mono text-[11px]">{m.memberNumber} • {m.department} • {m.paymentMethod.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Hinweis zur Datensicherheit:</span> Nur die Felder, bei denen Sie das Häkchen setzen, werden für alle {selectedMembers.length} Mitglieder aktualisiert. Alle nicht aktivierten Daten bleiben unangetastet. Jede Änderung wird revisionssicher im Audit-Log dokumentiert.
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. Zahlungsmethode */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyPaymentMethod ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyPaymentMethod}
                    onChange={e => setApplyPaymentMethod(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Zahlungsmethode anpassen</span>
                </label>
                {applyPaymentMethod && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyPaymentMethod && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 animate-in fade-in duration-100">
                  {[
                    { val: 'sepa', label: 'SEPA-Lastschrift' },
                    { val: 'transfer', label: 'Überweisung' },
                    { val: 'cash', label: 'Bargeld' },
                    { val: 'standing_order', label: 'Dauerauftrag' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setPaymentMethod(opt.val as PaymentMethod)}
                      className={`p-2 rounded-lg border text-left font-medium transition-all ${
                        paymentMethod === opt.val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Zahlungsintervall / Periode */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyFeePeriod ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyFeePeriod}
                    onChange={e => setApplyFeePeriod(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Zahlungsweise / Intervall anpassen</span>
                </label>
                {applyFeePeriod && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyFeePeriod && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 animate-in fade-in duration-100">
                  {[
                    { val: 'monthly', label: 'Monatlich' },
                    { val: 'quarterly', label: 'Vierteljährlich' },
                    { val: 'half_yearly', label: 'Halbjährlich' },
                    { val: 'yearly', label: 'Jährlich' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setFeePeriod(opt.val as FeePeriod)}
                      className={`p-2 rounded-lg border text-left font-medium transition-all ${
                        feePeriod === opt.val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2b. Fälligkeitstag bei monatlichem Einzug */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyMonthlyDueDay ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyMonthlyDueDay}
                    onChange={e => setApplyMonthlyDueDay(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Fälligkeitstag bei monatlichem Einzug (1. vs. 15.)</span>
                </label>
                {applyMonthlyDueDay && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyMonthlyDueDay && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => setMonthlyDueDay(1)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      monthlyDueDay === 1
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs">🔘 1. des Monats</div>
                    <div className={`text-[11px] mt-0.5 ${monthlyDueDay === 1 ? 'text-blue-100' : 'text-slate-500'}`}>
                      Einzug jeweils zum Monatsanfang
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMonthlyDueDay(15)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      monthlyDueDay === 15
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs">🔘 15. des Monats</div>
                    <div className={`text-[11px] mt-0.5 ${monthlyDueDay === 15 ? 'text-blue-100' : 'text-slate-500'}`}>
                      Einzug jeweils zur Monatsmitte
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Mitgliedsstatus */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyStatus ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyStatus}
                    onChange={e => setApplyStatus(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Mitgliedsstatus anpassen</span>
                </label>
                {applyStatus && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyStatus && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 animate-in fade-in duration-100">
                  {[
                    { val: 'active', label: '🟢 Aktiv' },
                    { val: 'passive', label: '⚪ Passiv' },
                    { val: 'honorary', label: '⭐ Ehrenmitglied' },
                    { val: 'suspended', label: '🟡 Ruhend' },
                    { val: 'terminated', label: '🔴 Gekündigt' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setStatus(opt.val as MembershipStatus)}
                      className={`p-2 rounded-lg border text-center font-medium transition-all ${
                        status === opt.val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Abteilung / Sparte */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyDepartment ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyDepartment}
                    onChange={e => setApplyDepartment(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Sparte / Abteilung neu zuweisen</span>
                </label>
                {applyDepartment && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyDepartment && (
                <div className="pt-2 animate-in fade-in duration-100">
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 5. Mitgliedschaftstyp & Beitragssatz */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                applyMembershipType ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyMembershipType}
                      onChange={e => setApplyMembershipType(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span>Mitgliedsart</span>
                  </label>
                  {applyMembershipType && (
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                {applyMembershipType && (
                  <div className="pt-2 animate-in fade-in duration-100">
                    <select
                      value={membershipType}
                      onChange={e => setMembershipType(e.target.value as MembershipType)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="full">Vollmitglied</option>
                      <option value="youth">Jugend / Kinder</option>
                      <option value="reduced">Ermäßigt (Schüler/Student)</option>
                      <option value="family">Familienbeitrag</option>
                      <option value="supporting">Förderer / Sponsor</option>
                      <option value="honorary">Ehrenmitglied</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Fee Amount */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                applyFeeAmount ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyFeeAmount}
                      onChange={e => setApplyFeeAmount(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span>Beitragshöhe (€)</span>
                  </label>
                  {applyFeeAmount && (
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                {applyFeeAmount && (
                  <div className="pt-2 animate-in fade-in duration-100 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={feeAmount}
                      onChange={e => setFeeAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <span className="font-bold text-slate-600">€</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Eintrittsdatum & Austrittsdatum */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Entry Date */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                applyEntryDate ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyEntryDate}
                      onChange={e => setApplyEntryDate(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Eintrittsdatum</span>
                  </label>
                  {applyEntryDate && (
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                {applyEntryDate && (
                  <div className="pt-2 animate-in fade-in duration-100">
                    <input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Exit Date */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                applyExitDate ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyExitDate}
                      onChange={e => setApplyExitDate(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <Calendar className="w-4 h-4 text-rose-500" />
                    <span>Austrittsdatum</span>
                  </label>
                  {applyExitDate && (
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                {applyExitDate && (
                  <div className="pt-2 animate-in fade-in duration-100">
                    <input
                      type="date"
                      value={exitDate}
                      onChange={e => setExitDate(e.target.value)}
                      placeholder="Leer lassen für Austritt löschen"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 7. DSGVO Datenschutz-Zustimmung */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyDataPrivacy ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyDataPrivacy}
                    onChange={e => setApplyDataPrivacy(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>DSGVO / Datenschutz-Einwilligung</span>
                </label>
                {applyDataPrivacy && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyDataPrivacy && (
                <div className="grid grid-cols-2 gap-2 pt-2 animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => setDataPrivacyConsent(true)}
                    className={`p-2 rounded-lg border text-center font-medium transition-all ${
                      dataPrivacyConsent
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ✓ Einwilligung erteilt (Ja)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataPrivacyConsent(false)}
                    className={`p-2 rounded-lg border text-center font-medium transition-all ${
                      !dataPrivacyConsent
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ✕ Keine Einwilligung (Nein)
                  </button>
                </div>
              )}
            </div>

            {/* 8. Notizen / Vermerk */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              applyNotes ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-200' : 'bg-slate-50/50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={applyNotes}
                    onChange={e => setApplyNotes(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Notiz / Vermerk ergänzen oder überschreiben</span>
                </label>
                {applyNotes && (
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>

              {applyNotes && (
                <div className="space-y-2 pt-2 animate-in fade-in duration-100">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="notesAction"
                        value="append"
                        checked={notesAction === 'append'}
                        onChange={() => setNotesAction('append')}
                        className="text-blue-600"
                      />
                      <span>An bestehende Notizen anhängen</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="notesAction"
                        value="replace"
                        checked={notesAction === 'replace'}
                        onChange={() => setNotesAction('replace')}
                        className="text-blue-600"
                      />
                      <span>Bestehende Notiz überschreiben</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={notesValue}
                    onChange={e => setNotesValue(e.target.value)}
                    placeholder="z.B. Beitragsumstellung beschlossen auf JHV 2026..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeChangeCount === 0 ? (
              <span className="text-amber-700 font-medium">
                Bitte aktivieren Sie mindestens ein Feld zur Bearbeitung.
              </span>
            ) : (
              <span className="text-blue-800 font-semibold">
                {activeChangeCount} Feld(er) werden für {selectedMembers.length} Mitglieder angepasst.
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
                  <span>{selectedMembers.length} Mitglieder aktualisieren</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
