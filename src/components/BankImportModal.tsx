import React, { useState } from 'react';
import { FinancialAccount, Transaction, TaxSphere } from '../types';
import { BankImportService, ParsedBankRow, pruefeBankZeile } from '../services/bankImport';
import { useSkr42 } from '../hooks/useSkr42';
import { kontoNachNummer } from '../utils/importRegeln';
import { SkrKontoAuswahl } from './SkrKontoAuswahl';
import {
  X,
  Upload,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { melde } from '../utils/dialoge';

interface BankImportModalProps {
  accounts: FinancialAccount[];
  /** Vorhandene Buchungen, damit die Belegnummern (BK-…) fortgezählt werden. */
  existingTransactions?: Transaction[];
  onImport: (transactions: Transaction[]) => void;
  onClose: () => void;
}

export const BankImportModal: React.FC<BankImportModalProps> = ({
  accounts,
  existingTransactions = [],
  onImport,
  onClose
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [parsedRows, setParsedRows] = useState<ParsedBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sammelKonto, setSammelKonto] = useState('');
  const [sammelHinweis, setSammelHinweis] = useState<string | null>(null);
  const skr = useSkr42();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const rows = await BankImportService.parseBankCSV(text, existingTransactions);
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

  const hatFehler = (r: ParsedBankRow) => !!r.fehler && r.fehler.length > 0;

  // Zeilen mit Fehler lassen sich erst nach der Berichtigung anhaken
  const toggleSelectAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: checked && !hatFehler(r) })));
  };

  const toggleRowSelect = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id && !hatFehler(r) ? { ...r, selected: !r.selected } : r));
  };

  // Datum in der Vorschau berichtigen (D-67); danach neu prüfen, auch auf Duplikat
  const updateRowDate = (id: string, date: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? pruefeBankZeile({ ...r, date }, existingTransactions, hatFehler(r)) : r));
  };

  // Konto des Kontenrahmens je Zeile (D-69)
  const updateRowKonto = (id: string, code: string) => {
    const k = kontoNachNummer(code, skr);
    setParsedRows(prev => prev.map(r => r.id === id
      ? { ...r, skrAccount: code, suggestedCategory: k ? k.sub.label : r.suggestedCategory, kontoVorschlag: false }
      : r));
  };

  // Ein Konto für alle angehakten Zeilen derselben Richtung
  const setzeSammelKonto = () => {
    const k = kontoNachNummer(sammelKonto, skr);
    if (!k) return;
    let gesetzt = 0;
    let andere = 0;
    const neu = parsedRows.map(r => {
      if (!r.selected) return r;
      if ((r.amount < 0 ? 'expense' : 'income') !== k.main.type) { andere++; return r; }
      gesetzt++;
      return { ...r, skrAccount: k.sub.code, suggestedCategory: k.sub.label, kontoVorschlag: false };
    });
    setParsedRows(neu);
    setSammelHinweis(
      `Konto ${k.sub.code} auf ${gesetzt} Zeile(n) gesetzt.` +
      (andere > 0 ? ` ${andere} angehakte Zeile(n) haben die andere Richtung (${k.main.type === 'income' ? 'Ausgabe' : 'Einnahme'}) und blieben unverändert.` : '')
    );
  };

  const fehlerAnzahl = parsedRows.filter(hatFehler).length;
  const duplikatAnzahl = parsedRows.filter(r => r.duplikat).length;

  // Sphäre und Kategorie sind seit der DATEV-SKR42-Umstellung unabhängig
  // voneinander (siehe Hinweis bei Skr42MainCategory in src/types.ts) — ein
  // Sphärenwechsel ändert die gewählte Kategorie darum nicht mehr mit.
  const updateRowSphere = (id: string, sphere: TaxSphere) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, suggestedSphere: sphere } : r));
  };

  const selectedCount = parsedRows.filter(r => r.selected).length;

  const handleExecuteImport = () => {
    if (selectedCount === 0) {
      void melde('Bitte wählen Sie mindestens eine Buchung zum Importieren aus.');
      return;
    }
    const transactions = BankImportService.convertToTransactions(
      parsedRows,
      selectedAccountId,
      existingTransactions.map(t => t.documentNumber),
      skr
    );
    onImport(transactions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-slate-200 my-6 max-h-[90vh] dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/40 dark:text-blue-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Bankumsätze & Kontoauszug importieren
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direkter CSV-Import (Sparkasse, Volksbank, Postbank, etc.) mit KI/Regel-basierter Sphärenzuordnung
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Target Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
                Zielkonto für den Import *
              </label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.iban ? `IBAN: ${a.iban}` : a.accountType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 dark:text-slate-200">
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
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 2: Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Gefundene Buchungen: {parsedRows.length}
                  </span>
                  <span className="text-2xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 dark:bg-blue-900/40 dark:text-blue-200">
                    <Sparkles className="w-3 h-3" />
                    Bereich geschätzt, Konto aus früheren Buchungen
                  </span>
                  {duplikatAnzahl > 0 && (
                    <span className="text-2xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-md dark:bg-amber-900/40 dark:text-amber-200">
                      {duplikatAnzahl} mögliche(s) Duplikat(e) abgewählt
                    </span>
                  )}
                  {fehlerAnzahl > 0 && (
                    <span className="text-2xs bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-md dark:bg-rose-900/40 dark:text-rose-200">
                      {fehlerAnzahl} Zeile(n) mit Fehler
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-blue-600 hover:underline font-medium dark:text-blue-400"
                  >
                    Alle auswählen
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-slate-500 hover:underline dark:text-slate-400"
                  >
                    Keine auswählen
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 dark:bg-slate-800 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Konto für alle angehakten Zeilen:</span>
                <SkrKontoAuswahl
                  value={sammelKonto}
                  skr={skr}
                  onChange={code => { setSammelKonto(code); setSammelHinweis(null); }}
                  leerText="– Konto wählen –"
                  className="px-2 py-1 border border-slate-300 rounded text-2xs bg-white max-w-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={!sammelKonto}
                  onClick={setzeSammelKonto}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-2xs font-semibold"
                >
                  Setzen
                </button>
                {sammelHinweis && <span className="text-slate-600 dark:text-slate-300">{sammelHinweis}</span>}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[380px] overflow-y-auto dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-semibold z-10 dark:bg-slate-700 dark:border-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === parsedRows.length - fehlerAnzahl}
                          onChange={e => toggleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 dark:text-blue-400"
                        />
                      </th>
                      <th className="p-3 w-36">Datum</th>
                      <th className="p-3">Partner & Verwendungszweck</th>
                      <th className="p-3 w-28 text-right">Betrag</th>
                      <th className="p-3 w-40">Steuerliche Sphäre</th>
                      <th className="p-3 w-56">Konto (SKR 42)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 transition-colors dark:hover:bg-slate-800 ${row.selected ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 opacity-60 dark:bg-slate-800/50'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={hatFehler(row)}
                            title={hatFehler(row) ? 'Erst den Fehler berichtigen' : undefined}
                            onChange={() => toggleRowSelect(row.id)}
                            className="w-4 h-4 rounded text-blue-600 disabled:opacity-40 dark:text-blue-400"
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateRowDate(row.id, e.target.value)}
                            className={`px-1.5 py-1 border rounded text-2xs font-mono bg-white dark:bg-slate-800 ${!row.date ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 truncate max-w-xs dark:text-white">{row.partner}</div>
                          <div className="text-2xs text-slate-500 truncate max-w-sm dark:text-slate-400">{row.bookingText}</div>
                          {row.fehler?.map(f => (
                            <div key={f} className="text-2xs text-rose-600 font-semibold dark:text-rose-400">{f}</div>
                          ))}
                          {row.duplikat && (
                            <div className="text-2xs text-amber-700 font-semibold dark:text-amber-300">Mögliches Duplikat: {row.duplikat}</div>
                          )}
                          {row.hinweise?.map(h => (
                            <div key={h} className="text-2xs text-slate-500 dark:text-slate-400">{h}</div>
                          ))}
                        </td>
                        <td className={`p-3 text-right font-bold font-mono whitespace-nowrap ${row.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="p-3">
                          <select
                            value={row.suggestedSphere}
                            onChange={e => updateRowSphere(row.id, e.target.value as TaxSphere)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-2xs bg-white font-medium dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="ideell">1. Ideeller Bereich</option>
                            <option value="vermoegen">2. Vermögensverw.</option>
                            <option value="zweckbetrieb">3. Zweckbetrieb</option>
                            <option value="wirtschaftlich">4. Wirtschaftlich</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <SkrKontoAuswahl
                            value={row.skrAccount || ''}
                            typ={row.amount < 0 ? 'expense' : 'income'}
                            skr={skr}
                            onChange={code => updateRowKonto(row.id, code)}
                            className={`w-full px-2 py-1 border rounded text-2xs bg-white dark:bg-slate-800 ${row.skrAccount ? 'border-slate-300 dark:border-slate-700' : 'border-amber-400'}`}
                            title={row.skrAccount ? undefined : 'Kein Konto gewählt – die Buchung erscheint in der EÜR ohne Konto.'}
                          />
                          {row.kontoVorschlag && (
                            <div className="text-2xs text-blue-600 mt-0.5 dark:text-blue-400">aus früherer Buchung</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsedRows.length === 0 && !loading && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl p-6 dark:border-slate-800">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-700 text-sm dark:text-slate-200">Noch kein Bankauszug geladen</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 dark:text-slate-400">
                Laden Sie die CSV-Umsatzdatei Ihres Vereinskontos hoch (z.B. aus dem Sparkassen-, VR-NetWorld- oder Online-Banking-Portal).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between dark:bg-slate-800 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsedRows.length > 0 && (
              <span>
                <strong>{selectedCount}</strong> von {parsedRows.length} Buchungen ausgewählt
                {fehlerAnzahl > 0 && <> · {fehlerAnzahl} mit Fehler werden nicht übernommen</>}
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
