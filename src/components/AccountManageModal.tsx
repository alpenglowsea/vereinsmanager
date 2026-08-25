import React, { useState } from 'react';
import { FinancialAccount, AccountType } from '../types';
import {
  X,
  Building2,
  Wallet,
  Coins,
  Plus,
  Trash2,
  Edit2,
  Check
} from 'lucide-react';

interface AccountManageModalProps {
  accounts: FinancialAccount[];
  onSaveAccount: (account: FinancialAccount) => void;
  onDeleteAccount: (id: string) => void;
  onClose: () => void;
}

export const AccountManageModal: React.FC<AccountManageModalProps> = ({
  accounts,
  onSaveAccount,
  onDeleteAccount,
  onClose
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<Partial<FinancialAccount>>({
    name: '',
    accountType: 'bank',
    iban: '',
    bic: '',
    initialBalance: 0,
    color: 'emerald',
    description: ''
  });

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      accountType: 'bank',
      iban: '',
      bic: '',
      initialBalance: 0,
      color: 'emerald',
      description: ''
    });
  };

  const startEdit = (acc: FinancialAccount) => {
    setIsCreating(false);
    setEditingId(acc.id);
    setFormData({ ...acc });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const account: FinancialAccount = {
      id: editingId || `acc-${Date.now()}`,
      name: formData.name.trim(),
      accountType: formData.accountType || 'bank',
      iban: formData.iban?.toUpperCase().replace(/\s/g, '') || '',
      bic: formData.bic?.toUpperCase().trim() || '',
      initialBalance: formData.initialBalance || 0,
      color: formData.color || 'blue',
      description: formData.description || '',
      createdAt: (formData as any).createdAt || new Date().toISOString()
    };

    onSaveAccount(account);
    setIsCreating(false);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bankkonten & Barkassen verwalten
              </h2>
              <p className="text-xs text-slate-500">
                Girokonten, Barkassen, Festgeld und PayPal für den Verein
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 max-h-[65vh]">
          {/* Account List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Bestehende Konten ({accounts.length})
              </span>
              {!isCreating && !editingId && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Neues Konto / Kasse
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                      {acc.accountType === 'cash' ? <Coins className="w-5 h-5 text-amber-600" /> : <Building2 className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{acc.name}</span>
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {acc.accountType === 'cash' ? 'Barkasse' : acc.accountType === 'paypal' ? 'PayPal' : 'Girokonto'}
                        </span>
                      </div>
                      {acc.iban && (
                        <p className="text-2xs font-mono text-slate-500 mt-0.5">IBAN: {acc.iban}</p>
                      )}
                      {acc.description && (
                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-sm">{acc.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-2xs text-slate-400 block">Anfangsbestand</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {acc.initialBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(acc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (accounts.length <= 1) {
                            alert('Es muss mindestens ein Konto existieren.');
                            return;
                          }
                          if (window.confirm(`Konto "${acc.name}" wirklich löschen?`)) {
                            onDeleteAccount(acc.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form for Create / Edit */}
          {(isCreating || editingId) && (
            <form onSubmit={handleSave} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in fade-in duration-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {isCreating ? 'Neues Konto anlegen' : 'Konto bearbeiten'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kontobezeichnung *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Sparkasse Hauptkonto oder Barkasse Kiosk"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konto-Typ *
                  </label>
                  <select
                    value={formData.accountType || 'bank'}
                    onChange={e => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bank">Bankkonto / Girokonto</option>
                    <option value="cash">Barkasse / Kassenbuch</option>
                    <option value="paypal">PayPal-Konto</option>
                    <option value="other">Sonstiges Konto / Festgeld</option>
                  </select>
                </div>
              </div>

              {formData.accountType === 'bank' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      IBAN
                    </label>
                    <input
                      type="text"
                      value={formData.iban || ''}
                      onChange={e => setFormData({ ...formData, iban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500"
                      placeholder="DE89 3705 0198 0000 1234 56"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      BIC (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.bic || ''}
                      onChange={e => setFormData({ ...formData, bic: e.target.value.toUpperCase().trim() })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500"
                      placeholder="SPKDMUSTXXX"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anfangsbestand / Startguthaben (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initialBalance || 0}
                    onChange={e => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Beschreibung / Verwendungszweck
                  </label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Für Mitgliedsbeiträge und Jugendförderung"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingId(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Konto speichern
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
