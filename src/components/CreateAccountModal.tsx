import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Tag,
  Plus,
  X,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Trash2,
  Settings2
} from 'lucide-react';
import { TaxSphere, Skr42MainCategory, Skr42SubCategory } from '../types';
import { TAX_SPHERES, SKR42_STRUCTURE } from '../data/taxSpheres';
import { customCategoryService } from '../services/customCategoryService';

export interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'main' | 'sub';
  currentSphere: TaxSphere;
  currentType: 'income' | 'expense';
  currentMainCatIdOrCode?: string;
  initialQuery?: string;
  onCreatedMain?: (newMain: Skr42MainCategory) => void;
  onCreatedSub?: (newSub: Skr42SubCategory, parentMain: Skr42MainCategory) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  currentSphere,
  currentType,
  currentMainCatIdOrCode,
  initialQuery = '',
  onCreatedMain,
  onCreatedSub
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [mode, setMode] = useState<'main' | 'sub'>(initialMode);

  // Form State for Main Account
  const [mainSphere, setMainSphere] = useState<TaxSphere>(currentSphere);
  const [mainType, setMainType] = useState<'income' | 'expense'>(currentType);
  const [mainCode, setMainCode] = useState('');
  const [mainName, setMainName] = useState('');
  const [createInitialSub, setCreateInitialSub] = useState(true);
  const [subVatRate, setSubVatRate] = useState<0 | 7 | 19>(0);

  // Form State for Sub Account
  const [parentMainId, setParentMainId] = useState(currentMainCatIdOrCode || '');
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Stored custom accounts list for manage tab
  const [customData, setCustomData] = useState(() => customCategoryService.getCustomAccounts());

  const reloadCustomData = () => {
    setCustomData(customCategoryService.getCustomAccounts());
  };

  // Find parent main object
  const parentMainObj = useMemo(() => {
    return SKR42_STRUCTURE.find(m => m.id === parentMainId || m.code === parentMainId);
  }, [parentMainId]);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setActiveTab('create');
      setError(null);
      setMainSphere(currentSphere);
      setMainType(currentType);
      reloadCustomData();

      const initialText = initialQuery.trim();
      const isNumericQuery = /^\d+$/.test(initialText);

      if (initialMode === 'main') {
        const suggested = customCategoryService.suggestNextCode(currentSphere, currentType);
        setMainCode(isNumericQuery ? initialText : suggested);
        setMainName(isNumericQuery ? '' : initialText);
        setSubVatRate(currentSphere === 'wirtschaftlich' ? 19 : currentSphere === 'zweckbetrieb' ? 7 : 0);
      } else {
        const targetParent = currentMainCatIdOrCode || SKR42_STRUCTURE.find(m => m.sphere === currentSphere)?.code || '40000';
        setParentMainId(targetParent);
        const suggested = customCategoryService.suggestNextCode(currentSphere, currentType, targetParent);
        setSubCode(isNumericQuery ? initialText : suggested);
        setSubName(isNumericQuery ? '' : initialText);

        const parentSphere = SKR42_STRUCTURE.find(m => m.id === targetParent || m.code === targetParent)?.sphere || currentSphere;
        setSubVatRate(parentSphere === 'wirtschaftlich' ? 19 : parentSphere === 'zweckbetrieb' ? 7 : 0);
      }
    }
  }, [isOpen, initialMode, currentSphere, currentType, currentMainCatIdOrCode, initialQuery]);

  // Update suggested code and VAT rate when main sphere or type changes
  useEffect(() => {
    if (mode === 'main') {
      const suggested = customCategoryService.suggestNextCode(mainSphere, mainType);
      setMainCode(suggested);
      setSubVatRate(mainSphere === 'wirtschaftlich' ? 19 : mainSphere === 'zweckbetrieb' ? 7 : 0);
    }
  }, [mainSphere, mainType, mode]);

  // Update suggested code when parent main category changes in sub mode
  useEffect(() => {
    if (mode === 'sub' && parentMainId) {
      const targetMain = SKR42_STRUCTURE.find(m => m.id === parentMainId || m.code === parentMainId);
      if (targetMain) {
        const suggested = customCategoryService.suggestNextCode(targetMain.sphere, targetMain.type, targetMain.code);
        setSubCode(suggested);
        setSubVatRate(targetMain.sphere === 'wirtschaftlich' ? 19 : targetMain.sphere === 'zweckbetrieb' ? 7 : 0);
      }
    }
  }, [parentMainId, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === 'main') {
        const newMain = customCategoryService.addCustomMainCategory({
          code: mainCode,
          name: mainName,
          sphere: mainSphere,
          type: mainType,
          initialSubAccount: createInitialSub
            ? {
                code: mainCode,
                name: mainName,
                vatRateDefault: subVatRate
              }
            : undefined
        });

        reloadCustomData();
        if (onCreatedMain) {
          onCreatedMain(newMain);
        }
        onClose();
      } else {
        // Sub account
        const targetMain = SKR42_STRUCTURE.find(m => m.id === parentMainId || m.code === parentMainId);
        if (!targetMain) {
          setError('Bitte wählen Sie ein übergeordnetes Hauptkonto aus.');
          return;
        }

        const { sub, main } = customCategoryService.addCustomSubCategory({
          mainCatIdOrCode: targetMain.code,
          code: subCode,
          name: subName,
          vatRateDefault: subVatRate
        });

        reloadCustomData();
        if (onCreatedSub) {
          onCreatedSub(sub, main);
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern des Kontos.');
    }
  };

  const handleDeleteMain = (codeOrId: string) => {
    if (confirm('Möchten Sie dieses selbst angelegte Hauptkonto wirklich löschen?')) {
      customCategoryService.deleteCustomMainCategory(codeOrId);
      reloadCustomData();
    }
  };

  const handleDeleteSub = (mainCode: string, subCode: string) => {
    if (confirm('Möchten Sie dieses selbst angelegte Unterkonto wirklich löschen?')) {
      customCategoryService.deleteCustomSubCategory(mainCode, subCode);
      reloadCustomData();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {mode === 'main' ? <Layers className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {activeTab === 'manage'
                  ? 'Benutzerdefinierte Konten verwalten'
                  : mode === 'main'
                  ? 'Neues Hauptkonto (SKR 42) anlegen'
                  : 'Neues Nebenkonto / Unterkonto anlegen'}
              </h3>
              <p className="text-2xs text-slate-500">
                {activeTab === 'manage'
                  ? 'Übersicht aller selbst erstellten Haupt- und Unterkonten'
                  : mode === 'main'
                  ? 'Erstellen Sie eine neue Hauptkategorie mit steuerlicher Sphäre gem. §§ 51 ff. AO'
                  : 'Erstellen Sie ein neues Unterkonto für detaillierte Buchungen'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab(prev => (prev === 'create' ? 'manage' : 'create'))}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/80'
              }`}
              title={activeTab === 'manage' ? 'Zurück zum Anlegen' : 'Eigene Konten verwalten'}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="text-3xs hidden sm:inline">
                {activeTab === 'manage' ? 'Neues Konto' : 'Eigene Konten'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mode Switcher Buttons */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setMode('main')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'main'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>1. Hauptkonto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('sub')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'sub'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>2. Nebenkonto / Unterkonto</span>
                </button>
              </div>

              {/* Mode 1: Hauptkonto anlegen */}
              {mode === 'main' && (
                <div className="space-y-4">
                  {/* Sphere Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Steuerliche Sphäre gem. §§ 51 ff. AO *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'] as TaxSphere[]).map(sph => {
                        const isSel = mainSphere === sph;
                        const info = TAX_SPHERES[sph];
                        return (
                          <button
                            key={sph}
                            type="button"
                            onClick={() => setMainSphere(sph)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSel
                                ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {info.name}
                              </span>
                              {isSel && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </div>
                            <div className="text-3xs text-slate-500 truncate">
                              {info.subtitle.split('(')[0]?.trim()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Account Type Toggle: Einnahme vs Ausgabe */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kontoart *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMainType('income')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          mainType === 'income'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🟢 Einnahmen-Konto (Erträge / Erlöse)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMainType('expense')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          mainType === 'expense'
                            ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🔴 Ausgaben-Konto (Kosten / Aufwand)</span>
                      </button>
                    </div>
                  </div>

                  {/* Code and Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Kontonummer *
                        </label>
                        <button
                          type="button"
                          onClick={() => setMainCode(customCategoryService.suggestNextCode(mainSphere, mainType))}
                          className="text-3xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                          Vorschlag
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={mainCode}
                        onChange={e => setMainCode(e.target.value)}
                        placeholder="z.B. 40950"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                        maxLength={8}
                      />
                      <span className="text-3xs text-slate-400 mt-1 block">
                        5-stellig nach SKR 42
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bezeichnung des Hauptkontos *
                      </label>
                      <input
                        type="text"
                        required
                        value={mainName}
                        onChange={e => setMainName(e.target.value)}
                        placeholder="z.B. Stiftungsförderungen & Projektmittel"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"
                      />
                      <span className="text-3xs text-slate-400 mt-1 block">
                        Übergeordnete Kategorie im SKR 42
                      </span>
                    </div>
                  </div>

                  {/* Initial Subaccount checkbox */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createInitialSub}
                        onChange={e => setCreateInitialSub(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Sofort ein passendes 1. Unterkonto mit derselben Nummer erstellen
                      </span>
                    </label>

                    {createInitialSub && (
                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600">Standard-Umsatzsteuer:</span>
                        <select
                          value={subVatRate}
                          onChange={e => setSubVatRate(parseInt(e.target.value) as 0 | 7 | 19)}
                          className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                          <option value="0">0% (stfrei / ideell)</option>
                          <option value="7">7% (ermäßigt / Zweckbetrieb)</option>
                          <option value="19">19% (Regelsatz / wirtschaftlich)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode 2: Nebenkonto / Unterkonto anlegen */}
              {mode === 'sub' && (
                <div className="space-y-4">
                  {/* Parent Main Category Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Übergeordnetes Hauptkonto (SKR 42) *
                    </label>
                    <select
                      value={parentMainId}
                      onChange={e => setParentMainId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                    >
                      {SKR42_STRUCTURE.map(main => (
                        <option key={main.id} value={main.code}>
                          [{main.code}] {main.name} ({TAX_SPHERES[main.sphere]?.name || main.sphere} • {main.type === 'income' ? 'Einnahmen' : 'Ausgaben'})
                        </option>
                      ))}
                    </select>
                    {parentMainObj && (
                      <div className="text-2xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Sphäre: <strong>{TAX_SPHERES[parentMainObj.sphere]?.name || parentMainObj.sphere}</strong></span>
                        <span>•</span>
                        <span>{parentMainObj.subCategories.length} bestehende Unterkonten</span>
                      </div>
                    )}
                  </div>

                  {/* Code and Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Kontonummer *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (parentMainObj) {
                              setSubCode(customCategoryService.suggestNextCode(parentMainObj.sphere, parentMainObj.type, parentMainObj.code));
                            }
                          }}
                          className="text-3xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                          Vorschlag
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={subCode}
                        onChange={e => setSubCode(e.target.value)}
                        placeholder="z.B. 40015"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                        maxLength={8}
                      />
                      <span className="text-3xs text-slate-400 mt-1 block">
                        5-stellig (Unterkonto)
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bezeichnung des Unterkontos *
                      </label>
                      <input
                        type="text"
                        required
                        value={subName}
                        onChange={e => setSubName(e.target.value)}
                        placeholder="z.B. Schnupper-Mitgliedsbeiträge Jugendliche"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"
                      />
                      <span className="text-3xs text-slate-400 mt-1 block">
                        Eindeutiger Name für Buchungsauswertungen
                      </span>
                    </div>
                  </div>

                  {/* Standard VAT Rate */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Standard-Umsatzsteuersatz
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 7, 19].map(rate => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setSubVatRate(rate as 0 | 7 | 19)}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                            subVatRate === rate
                              ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {rate}% {rate === 0 ? '(stfrei)' : rate === 7 ? '(ermäßigt)' : '(Regelsatz)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {mode === 'main' ? 'Hauptkonto anlegen & auswählen' : 'Unterkonto anlegen & auswählen'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Manage Tab: List of custom accounts with delete option */
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Selbst angelegte Hauptkonten ({customData.customMainCategories.length})</span>
                </h4>
                {customData.customMainCategories.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-2xs text-center">
                    Bisher wurden keine eigenen Hauptkonten angelegt.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {customData.customMainCategories.map(main => (
                      <div key={main.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                              {main.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {main.name}
                            </span>
                          </div>
                          <div className="text-3xs text-slate-500 mt-0.5">
                            {TAX_SPHERES[main.sphere]?.name || main.sphere} • {main.type === 'income' ? 'Einnahmen' : 'Ausgaben'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMain(main.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Dieses Hauptkonto löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selbst angelegte Nebenkonten / Unterkonten ({customData.customSubCategories.length})</span>
                </h4>
                {customData.customSubCategories.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-2xs text-center">
                    Bisher wurden keine eigenen Unterkonten angelegt.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {customData.customSubCategories.map(item => (
                      <div key={`${item.mainCatIdOrCode}-${item.subCategory.code}`} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                              {item.subCategory.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {item.subCategory.name}
                            </span>
                          </div>
                          <div className="text-3xs text-slate-500 mt-0.5">
                            Hauptkonto: {item.mainCatIdOrCode} • USt: {item.subCategory.vatRateDefault}%
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSub(item.mainCatIdOrCode, item.subCategory.code)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Dieses Unterkonto löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Neues Konto anlegen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
