import React, { useState } from 'react';
import { FinancialAccount, Transaction, TaxSphere } from '../types';
import { BankImportService, ParsedBankRow } from '../services/bankImport';
import { TAX_SPHERES, SPHERE_CATEGORIES } from '../data/taxSpheres';
import {
  X,
  Upload,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface BankImportModalProps {
  accounts: FinancialAccount[];
  onImport: (transactions: Transaction[]) => void;
  onClose: () => void;
}

export const BankImportModal: React.FC<BankImportModalProps> = ({
  accounts,
  onImport,
  onClose
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [parsedRows, setParsedRows] = useState<ParsedBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const rows = await BankImportService.parseBankCSV(text);
      if (rows.length === 0) {
        setError('Keine gültigen Buchungszeilen im CSV-Kontoauszug gefunden.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError(`Fehler beim Einlesen der Bankdatei: ${err.message || 'Ungültiges CSV-Format'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  const toggleRowSelect = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const updateRowSphere = (id: string, sphere: TaxSphere) => {
    const defaultCat = SPHERE_CATEGORIES[sphere].income[0] || '';
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, suggestedSphere: sphere, suggestedCategory: defaultCat } : r));
  };

  const updateRowCategory = (id: string, category: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, suggestedCategory: category } : r));
  };

  const selectedCount = parsedRows.filter(r => r.selected).length;

  const handleExecuteImport = () => {
    if (selectedCount === 0) {
      alert('Bitte wählen Sie mindestens eine Buchung zum Importieren aus.');
      return;
    }
    const transactions = BankImportService.convertToTransactions(parsedRows, selectedAccountId);
    onImport(transactions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-slate-200 my-6 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bankumsätze & Kontoauszug importieren
              </h2>
              <p className="text-xs text-slate-500">
                Direkter CSV-Import (Sparkasse, Volksbank, Postbank, etc.) mit KI/Regel-basierter Sphärenzuordnung
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Target Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Zielkonto für den Import *
              </label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-slate-800"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.iban ? `IBAN: ${a.iban}` : a.accountType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bank-Kontoauszug (CSV / CAMT-Export)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-4 h-4" />
                  Bank-CSV-Datei auswählen
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 2: Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Gefundene Buchungen: {parsedRows.length}
                  </span>
                  <span className="text-2xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Automatisch kategorisiert
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Alle auswählen
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-slate-500 hover:underline"
                  >
                    Keine auswählen
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-semibold z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedRows.length}
                          onChange={e => toggleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                      </th>
                      <th className="p-3 w-24">Datum</th>
                      <th className="p-3">Partner & Verwendungszweck</th>
                      <th className="p-3 w-28 text-right">Betrag</th>
                      <th className="p-3 w-40">Steuerliche Sphäre</th>
                      <th className="p-3 w-44">Kategorie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 transition-colors ${row.selected ? 'bg-white' : 'bg-slate-50/50 opacity-60'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleRowSelect(row.id)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 truncate max-w-xs">{row.partner}</div>
                          <div className="text-2xs text-slate-500 truncate max-w-sm">{row.bookingText}</div>
                        </td>
                        <td className={`p-3 text-right font-bold font-mono whitespace-nowrap ${row.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="p-3">
                          <select
                            value={row.suggestedSphere}
                            onChange={e => updateRowSphere(row.id, e.target.value as TaxSphere)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-2xs bg-white font-medium"
                          >
                            <option value="ideell">1. Ideeller Bereich</option>
                            <option value="vermoegen">2. Vermögensverw.</option>
                            <option value="zweckbetrieb">3. Zweckbetrieb</option>
                            <option value="wirtschaftlich">4. Wirtschaftlich</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={row.suggestedCategory}
                            onChange={e => updateRowCategory(row.id, e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-2xs bg-white"
                          >
                            {(row.amount >= 0 ? SPHERE_CATEGORIES[row.suggestedSphere].income : SPHERE_CATEGORIES[row.suggestedSphere].expense).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsedRows.length === 0 && !loading && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl p-6">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-700 text-sm">Noch kein Bankauszug geladen</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Laden Sie die CSV-Umsatzdatei Ihres Vereinskontos hoch (z.B. aus dem Sparkassen-, VR-NetWorld- oder Online-Banking-Portal).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span><strong>{selectedCount}</strong> von {parsedRows.length} Buchungen ausgewählt</span>
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
              type="button"
              disabled={selectedCount === 0}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {selectedCount} Buchung(en) importieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
