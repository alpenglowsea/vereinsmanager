import React, { useMemo } from 'react';
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Tag,
  Calculator,
  CornerDownRight,
  Split
} from 'lucide-react';
import { TaxSphere, TransactionSplit } from '../types';
import { TAX_SPHERES, getSkr42MainCategories, getSkr42SubCategories, SKR42_STRUCTURE } from '../data/taxSpheres';
import { SearchableAccountSelect, SearchableAccountOption } from './SearchableAccountSelect';

interface SplitBookingManagerProps {
  totalAmount: number; // Gesamtbetrag der Buchung
  transactionType: 'income' | 'expense' | 'transfer';
  splits: TransactionSplit[];
  onChange: (splits: TransactionSplit[]) => void;
  onCancelSplit?: () => void;
  error?: string;
}

const formatEuro = (amount: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export const SplitBookingManager: React.FC<SplitBookingManagerProps> = ({
  totalAmount,
  transactionType: _transactionType,
  splits,
  onChange,
  onCancelSplit,
  error
}) => {
  // Rechnerische Summe aller Teilbeträge
  const sumOfSplits = useMemo(() => {
    return splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  }, [splits]);

  // Differenz zwischen Gesamtbuchungsbetrag und Summe der Teilbuchungen
  const difference = useMemo(() => {
    return Number((totalAmount - sumOfSplits).toFixed(2));
  }, [totalAmount, sumOfSplits]);

  const isBalanced = Math.abs(difference) < 0.009;

  // Helper to generate Main Category options for any sphere (showing both income & expense accounts)
  const getMainCatOptionsForSphere = (sphere: TaxSphere): SearchableAccountOption[] => {
    const mains = getSkr42MainCategories(sphere);
    return mains.map(main => ({
      value: main.id,
      code: main.code,
      name: main.name,
      label: `${main.code} - ${main.name}`,
      group: main.type === 'income' ? 'Einnahmen-Konten (Erträge / Erlöse)' : 'Ausgaben-Konten (Kosten / Aufwand)'
    }));
  };

  // Helper to generate Sub Category options for a given main category and sphere
  const getSubCatOptions = (sphere: TaxSphere, mainCatId?: string): SearchableAccountOption[] => {
    const subs = getSkr42SubCategories(sphere, undefined, mainCatId);
    return subs.map(sub => ({
      value: sub.label,
      code: sub.code,
      name: sub.name,
      label: sub.label,
      vatRateDefault: sub.vatRateDefault
    }));
  };

  const handleAddSplit = () => {
    const remainder = difference > 0 ? difference : 0;
    const lastSplit = splits[splits.length - 1];
    const defaultSphere = lastSplit?.sphere || 'ideell';
    const mains = getSkr42MainCategories(defaultSphere);
    const defaultMain = mains[0];
    const defaultSub = defaultMain?.subCategories[0];

    const newSplit: TransactionSplit = {
      id: `split-${Date.now()}-${splits.length + 1}`,
      amount: remainder > 0 ? remainder : 0,
      bookingText: '',
      sphere: defaultSphere,
      mainCategory: defaultMain ? `${defaultMain.code} - ${defaultMain.name}` : '',
      subCategory: defaultSub?.label || '',
      category: defaultSub?.label || '',
      skrAccount: defaultSub?.code || '',
      vatRate: defaultSub?.vatRateDefault ?? 0
    };

    onChange([...splits, newSplit]);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 2) return;
    const updated = splits.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleUpdateSplit = (index: number, updates: Partial<TransactionSplit>) => {
    const updated = [...splits];
    const current = updated[index];
    if (!current) return;

    const merged = { ...current, ...updates };

    // When sphere changes, ensure mainCategory & subCategory adapt to the new sphere
    if (updates.sphere && updates.sphere !== current.sphere) {
      const mains = getSkr42MainCategories(updates.sphere);
      const firstMain = mains[0];
      const firstSub = firstMain?.subCategories[0];
      merged.mainCategory = firstMain ? `${firstMain.code} - ${firstMain.name}` : '';
      merged.subCategory = firstSub?.label || '';
      merged.category = firstSub?.label || '';
      merged.skrAccount = firstSub?.code || '';
      merged.vatRate = firstSub?.vatRateDefault ?? (updates.sphere === 'wirtschaftlich' ? 19 : updates.sphere === 'zweckbetrieb' ? 7 : 0);
    }

    updated[index] = merged;
    onChange(updated);
  };

  const handleMainCategoryChange = (index: number, mainCatId: string) => {
    const mainObj = SKR42_STRUCTURE.find(m => m.id === mainCatId || m.code === mainCatId);
    if (!mainObj) return;
    const firstSub = mainObj.subCategories[0];

    handleUpdateSplit(index, {
      sphere: mainObj.sphere,
      mainCategory: `${mainObj.code} - ${mainObj.name}`,
      subCategory: firstSub?.label || '',
      category: firstSub?.label || '',
      skrAccount: firstSub?.code || '',
      vatRate: firstSub?.vatRateDefault ?? (mainObj.sphere === 'wirtschaftlich' ? 19 : mainObj.sphere === 'zweckbetrieb' ? 7 : 0)
    });
  };

  const handleSubCategoryChange = (index: number, subCatLabel: string) => {
    const current = splits[index];
    const subs = getSkr42SubCategories(current.sphere, undefined, current.mainCategory);
    const subObj = subs.find(s => s.label === subCatLabel || s.code === subCatLabel || s.name === subCatLabel);

    handleUpdateSplit(index, {
      subCategory: subCatLabel,
      category: subCatLabel,
      skrAccount: subObj?.code || '',
      vatRate: subObj?.vatRateDefault ?? current.vatRate
    });
  };

  const handleFillRemainderOnSplit = (index: number) => {
    const current = splits[index];
    if (!current) return;
    const newAmount = Number(((current.amount || 0) + difference).toFixed(2));
    if (newAmount >= 0) {
      handleUpdateSplit(index, { amount: newAmount });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <Split className="w-3.5 h-3.5 text-indigo-600" />
            <span>Aufteilung in Teilsummen (Splittbuchung)</span>
          </h4>
          <p className="text-3xs text-slate-500 mt-0.5">
            Jede Teilsumme kann einem eigenen Haupt- und Nebenkonto (§§ 51 ff. AO / SKR 42) zugewiesen werden.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onCancelSplit && (
            <button
              type="button"
              onClick={onCancelSplit}
              className="text-2xs font-semibold text-slate-500 hover:text-slate-800 underline transition-colors cursor-pointer"
              title="Splittbuchung beenden und als Einzelbuchung erfassen"
            >
              Zu Einzelbuchung wechseln
            </button>
          )}
          <div className="text-right">
            <span className="text-3xs text-slate-400 block font-semibold uppercase">Vorgabe Buchungsbetrag:</span>
            <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {formatEuro(totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Split Rows List */}
      <div className="space-y-3">
        {splits.map((split, index) => {
          const mainOptions = getMainCatOptionsForSphere(split.sphere);
          const subOptions = getSubCatOptions(split.sphere, split.mainCategory);

          // Find current main category ID
          const currentMain = SKR42_STRUCTURE.find(
            m => m.sphere === split.sphere && (`${m.code} - ${m.name}` === split.mainCategory || m.code === split.mainCategory || m.id === split.mainCategory)
          );
          const currentMainValue = currentMain?.id || mainOptions[0]?.value || split.mainCategory || '';

          return (
            <div
              key={split.id || `split-row-${index}`}
              className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl shadow-2xs space-y-3 transition-all hover:border-slate-300"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Teilbuchung #{index + 1}
                  </span>
                  {split.amount > 0 && totalAmount > 0 && (
                    <span className="text-3xs text-slate-500 font-mono">
                      ({Math.round(((split.amount || 0) / totalAmount) * 100)}% der Gesamtsumme)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {difference > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFillRemainderOnSplit(index)}
                      className="text-3xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer"
                      title={`Restbetrag von ${formatEuro(difference)} auf diesen Teilbetrag addieren`}
                    >
                      + Rest ({formatEuro(difference)}) aufschlagen
                    </button>
                  )}

                  {splits.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(index)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Diese Teilbuchung entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Row Inputs: Betrag & Teil-Buchungstext */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-2xs font-semibold text-slate-700 mb-1">
                    Teilbetrag (€) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={split.amount === 0 ? '' : split.amount}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        handleUpdateSplit(index, { amount: isNaN(val) ? 0 : Math.abs(val) });
                      }}
                      placeholder="0,00"
                      className="w-full pl-2.5 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs font-mono text-slate-400 pointer-events-none">
                      €
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-700 mb-1">
                    Teil-Zweck / Buchungstext (optional)
                  </label>
                  <input
                    type="text"
                    value={split.bookingText || ''}
                    onChange={e => handleUpdateSplit(index, { bookingText: e.target.value })}
                    placeholder={index === 0 ? 'z.B. Rücklastschrift Mitgliedsbeitrag' : 'z.B. Bankspesen & Bearbeitungsgebühren'}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Sphären-Auswahl für diesen Teilbetrag */}
              <div>
                <label className="block text-3xs font-semibold uppercase text-slate-500 mb-1">
                  Steuerliche Sphäre für Teil #{index + 1}:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sph => {
                    const isSelected = split.sphere === sph;
                    const sphInfo = TAX_SPHERES[sph];
                    return (
                      <button
                        key={sph}
                        type="button"
                        onClick={() => handleUpdateSplit(index, { sphere: sph })}
                        className={`px-2 py-1 text-2xs font-semibold rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-indigo-600 text-indigo-700 ring-1 ring-indigo-500 shadow-2xs font-bold'
                            : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <span className="text-3xs text-slate-400 mr-1">
                          {sph === 'ideell' ? '1.' : sph === 'vermoegen' ? '2.' : sph === 'zweckbetrieb' ? '3.' : '4.'}
                        </span>
                        {sph === 'ideell' ? 'Ideell' : sph === 'vermoegen' ? 'Vermögen' : sph === 'zweckbetrieb' ? 'Zweckbetr.' : 'Wirtschaftl.'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Konten-Auswahl für diesen Teilbetrag */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <SearchableAccountSelect
                  label={
                    <>
                      <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span>Hauptkonto (SKR 42) *</span>
                    </>
                  }
                  value={currentMainValue}
                  onChange={mainId => handleMainCategoryChange(index, mainId)}
                  options={mainOptions}
                  placeholder="Hauptkonto auswählen..."
                  searchPlaceholder="Hauptkonto oder Nummer suchen..."
                />

                <SearchableAccountSelect
                  label={
                    <>
                      <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Nebenkonto / Unterkonto *</span>
                    </>
                  }
                  value={split.subCategory || split.category || ''}
                  onChange={subLabel => handleSubCategoryChange(index, subLabel)}
                  options={subOptions}
                  placeholder="Unterkonto auswählen..."
                  searchPlaceholder="Unterkonto suchen..."
                />
              </div>

              {/* USt-Satz & SKR-Code Info */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-2xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 text-3xs font-semibold">
                    Konto: {split.skrAccount || '–'}
                  </span>
                  <span className="text-slate-400 text-3xs">
                    Sphäre: {TAX_SPHERES[split.sphere]?.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-3xs font-semibold text-slate-600">Umsatzsteuer:</label>
                  <select
                    value={split.vatRate}
                    onChange={e => handleUpdateSplit(index, { vatRate: parseInt(e.target.value) as 0 | 7 | 19 })}
                    className="px-2 py-0.5 text-2xs bg-white border border-slate-200 rounded font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="0">0% (stfrei)</option>
                    <option value="7">7% (ermäßigt)</option>
                    <option value="19">19% (Regelsatz)</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Button to add further split */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleAddSplit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Weitere Teilbuchung hinzufügen</span>
        </button>

        {difference > 0 && (
          <button
            type="button"
            onClick={handleAddSplit}
            className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer"
          >
            <CornerDownRight className="w-3 h-3 text-amber-600" />
            <span>Restbetrag von {formatEuro(difference)} als neue Zeile anfügen</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SCHRIFTLICHE ZUSAMMENRECHNUNG & RECHNERISCHE ÜBERPRÜFUNG                   */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-900">
                Rechnerische Überprüfung der Teilsummen
              </h5>
              <p className="text-3xs text-slate-500">
                Schriftlicher Kontrollabgleich zur Vermeidung von Rechen- & Tippfehlern
              </p>
            </div>
          </div>
          <div className="text-right">
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Aufgehend (0,00 € Differenz)</span>
              </span>
            ) : difference > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                <span>Noch {formatEuro(difference)} offen</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertCircle className="w-3 h-3" />
                <span>{formatEuro(Math.abs(difference))} Überschuss</span>
              </span>
            )}
          </div>
        </div>

        {/* Mathematical Breakdown Table */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-600">
            <span>Buchungsbetrag (Vorgabe oben):</span>
            <span className="font-bold text-slate-900">{formatEuro(totalAmount)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Summe aller {splits.length} Teilbuchungen:</span>
            <span className={`font-bold ${isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatEuro(sumOfSplits)}
            </span>
          </div>

          {/* Detailed sum formula */}
          <div className="text-3xs text-slate-500 font-mono pt-1 border-t border-slate-100 flex items-center gap-1 flex-wrap">
            <span className="font-sans text-slate-400 font-semibold">Formel:</span>
            {splits.map((s, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-400">+</span>}
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700" title={s.bookingText || `Teil #${idx + 1}`}>
                  {formatEuro(s.amount || 0)}
                </span>
              </React.Fragment>
            ))}
            <span className="text-slate-400">=</span>
            <span className="font-bold text-slate-800">{formatEuro(sumOfSplits)}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
            <span className={isBalanced ? 'text-emerald-800' : difference > 0 ? 'text-amber-800' : 'text-rose-800'}>
              Verbleibende Differenz:
            </span>
            <span className={isBalanced ? 'text-emerald-700' : difference > 0 ? 'text-amber-700' : 'text-rose-700'}>
              {formatEuro(difference)}
            </span>
          </div>
        </div>

        {/* Dynamic Status Feedback Banner */}
        {isBalanced ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                ✓ Buchungssumme geht exakt auf ({formatEuro(totalAmount)} = {formatEuro(sumOfSplits)})
              </p>
              <p className="text-2xs text-emerald-700 mt-0.5">
                Die Summe aller Teilbeträge stimmt centgenau mit der Buchungssumme überein. Die Splittbuchung kann gespeichert werden.
              </p>
            </div>
          </div>
        ) : difference > 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">
                ⚠️ Teilsummen unvollständig: Es fehlen noch {formatEuro(difference)} zur Buchungssumme
              </p>
              <p className="text-2xs text-amber-800 mt-0.5">
                Die Summe der Teilbeträge ({formatEuro(sumOfSplits)}) ist geringer als der Buchungsbetrag ({formatEuro(totalAmount)}). Bitte ergänzen Sie die fehlenden {formatEuro(difference)} in einer bestehenden Teilzeile oder legen Sie eine neue an.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">
                ⚠️ Teilsummen übersteigen Buchungsbetrag um {formatEuro(Math.abs(difference))}
              </p>
              <p className="text-2xs text-rose-800 mt-0.5">
                Die Summe der Teilbeträge ({formatEuro(sumOfSplits)}) ist höher als die vorgegebene Buchungssumme ({formatEuro(totalAmount)}). Bitte korrigieren Sie die Teilbeträge, um Tippfehler zu beheben.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
