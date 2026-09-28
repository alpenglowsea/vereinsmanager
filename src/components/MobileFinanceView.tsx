/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Transaction, FinancialAccount, ClubSettings, ReceiptAttachment, TaxSphere, Skr42MainCategory } from '../types';
import { useSkr42 } from '../hooks/useSkr42';
import { TAX_SPHERES, getAllSkr42MainCategories, getAllSkr42SubCategories } from '../data/taxSpheres';
import { SearchableAccountSelect, SearchableAccountOption } from './SearchableAccountSelect';
import { ReceiptCameraScannerModal } from './ReceiptCameraScannerModal';
import type { MobileTab } from './MobileShell';
import { Camera, CheckCircle2, ChevronRight, Lock, FileText, Trash2 } from 'lucide-react';

/**
 * Buchung erfassen (Mobil-Ansicht)
 * ---------------------------------------------------------------------------
 * Der Kern dieses Bildschirms: eine Buchung erfassen UND direkt den Beleg
 * dazu fotografieren — der Anwendungsfall "gerade eben eingekauft, Beleg
 * gleich digitalisieren, bevor er verloren geht".
 *
 * Die Kamera-Erfassung selbst ist NICHT neu gebaut: Sie verwendet
 * ReceiptCameraScannerModal unverändert wieder, dasselbe Bauteil wie am
 * Desktop (das mit "onAttachReceipt" ohnehin schon für genau diesen Fall
 * vorgesehen war — nur bisher nirgends von außerhalb der Desktop-Buchungs-
 * maske erreichbar). Gespeichert wird über denselben Weg wie am Desktop
 * (App.tsx: handleSaveTransaction) — keine zweite Speicherlogik.
 *
 * Nummernkreis & Konto (SKR 42) werden — genau wie am Desktop in
 * TransactionFormModal.tsx — als zwei zusammenhängende Felder erfasst statt
 * als eine einzelne "Kategorie": erst der Nummernkreis (Hauptkonto), dann
 * das Konto darin. Dafür wird sogar dasselbe Auswahl-Bauteil wiederverwendet
 * (SearchableAccountSelect) und dieselben Hilfsfunktionen aus
 * data/taxSpheres.ts (getAllSkr42MainCategories/-SubCategories), damit hier
 * niemals eine Auswahl entsteht, die es am Desktop nicht gibt. Wichtig,
 * exakt wie am Desktop: Der Nummernkreis ist NICHT auf den gewählten Typ
 * (Einnahme/Ausgabe) beschränkt — beide Kontenlisten stehen immer zur
 * Auswahl, gruppiert nach Einnahmen-/Ausgaben-Konten (siehe Hinweis bei
 * Skr42MainCategory in src/types.ts: Konto und Sphäre sind unabhängig).
 */

interface MobileFinanceViewProps {
  accounts: FinancialAccount[];
  settings: ClubSettings;
  existingTransactions: Transaction[];
  nextDocNumber: string;
  /** Darf die Person in "Buchungen & Kassenbuch" etwas anlegen? */
  canEdit: boolean;
  onSave: (tx: Transaction) => void | Promise<void>;
  onNavigateTab: (tab: MobileTab) => void;
}

interface Draft {
  type: 'income' | 'expense';
  amountText: string;
  date: string;
  accountId: string;
  sphere: TaxSphere;
  department: string; // '' = Gesamtverein (keine Sparte)
  mainCategoryId: string;
  mainCategory: string; // z.B. "40000 - Echte Mitgliedsbeiträge"
  subCategory: string; // z.B. "40010 - ..." (label)
  skrAccount: string; // z.B. "40010"
  vatRate: 0 | 7 | 19;
  partner: string;
  bookingText: string;
  receipt: ReceiptAttachment | null;
  documentNumber: string;
}

function emptyDraft(accounts: FinancialAccount[], docNumber: string, skr42: readonly Skr42MainCategory[]): Draft {
  // Vorbelegung mit dem ersten Ausgaben-Nummernkreis, weil der Typ auch mit
  // "Ausgabe" startet — dieselbe Fallback-Logik wie am Desktop
  // (TransactionFormModal.tsx). Die Wahl bleibt danach völlig frei.
  const initialMains = getAllSkr42MainCategories('expense', skr42);
  const firstMain = initialMains[0] || skr42[0];
  const firstSub = firstMain?.subCategories[0];
  return {
    type: 'expense',
    amountText: '',
    date: new Date().toISOString().split('T')[0],
    accountId: accounts[0]?.id || '',
    sphere: 'ideell',
    department: '',
    mainCategoryId: firstMain?.id || '',
    mainCategory: firstMain ? `${firstMain.code} - ${firstMain.name}` : '',
    subCategory: firstSub?.label || '',
    skrAccount: firstSub?.code || '',
    vatRate: firstSub?.vatRateDefault ?? 0,
    partner: '',
    bookingText: '',
    receipt: null,
    documentNumber: docNumber
  };
}

const SPHERE_ORDER: TaxSphere[] = ['ideell', 'vermoegen', 'zweckbetrieb', 'wirtschaftlich'];

export function MobileFinanceView({
  accounts,
  settings,
  existingTransactions,
  nextDocNumber,
  canEdit,
  onSave,
  onNavigateTab
}: MobileFinanceViewProps) {
  const skr42 = useSkr42();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(accounts, nextDocNumber, skr42));
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Alle Nummernkreise, unabhängig vom gewählten Typ (Einnahme/Ausgabe) —
  // siehe Erklärung oben. Gruppiert nach Einnahmen/Ausgaben, damit man sich
  // in der Liste trotzdem zurechtfindet.
  const mainCategories = useMemo(() => getAllSkr42MainCategories(undefined, skr42), [skr42]);
  const mainCatOptions: SearchableAccountOption[] = useMemo(
    () =>
      mainCategories.map(main => ({
        value: main.id,
        code: main.code,
        name: main.name,
        label: `${main.code} - ${main.name}`,
        group: main.type === 'income' ? 'Einnahmen-Konten (Erträge / Erlöse)' : 'Ausgaben-Konten (Kosten / Aufwand)',
        isCustom: main.isCustom
      })),
    [mainCategories]
  );

  const subCategories = useMemo(
    () => getAllSkr42SubCategories(undefined, draft.mainCategoryId, skr42),
    [draft.mainCategoryId, skr42]
  );
  const subCatOptions: SearchableAccountOption[] = useMemo(
    () =>
      subCategories.map(sub => ({
        value: sub.label,
        code: sub.code,
        name: sub.name,
        label: sub.label,
        vatRateDefault: sub.vatRateDefault,
        isCustom: sub.isCustom
      })),
    [subCategories]
  );

  const handleMainCatChange = (mainCatId: string) => {
    const main = mainCategories.find(m => m.id === mainCatId || m.code === mainCatId);
    if (!main) return;
    const firstSub = main.subCategories[0];
    setDraft(d => ({
      ...d,
      mainCategoryId: main.id,
      mainCategory: `${main.code} - ${main.name}`,
      subCategory: firstSub?.label || '',
      skrAccount: firstSub?.code || '',
      vatRate: firstSub?.vatRateDefault ?? 0
    }));
  };

  const handleSubCatChange = (subCatLabel: string) => {
    const sub = subCategories.find(s => s.label === subCatLabel || s.code === subCatLabel || s.name === subCatLabel);
    setDraft(d => ({
      ...d,
      subCategory: subCatLabel,
      skrAccount: sub?.code || '',
      vatRate: sub ? sub.vatRateDefault : d.vatRate
    }));
  };

  // ---------------------------------------------------------------------
  // Nur Leserecht: keine Eingabemaske, sondern derselbe Hinweis wie in den
  // anderen Bereichen der App. Wichtig, damit ein Sichern nicht lautlos
  // ins Leere läuft — die zentrale Rechtesperre in App.tsx zeigt ihren
  // Hinweis nur im Desktop-Baum, den die Mobil-Ansicht nicht rendert.
  // ---------------------------------------------------------------------
  if (!canEdit) {
    return (
      <div className="p-4">
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-snug">
            <strong>Nur Leserecht.</strong> Ihre Rolle darf Buchungen einsehen, aber keine neuen anlegen. Wenden Sie
            sich an den Vorstand, wenn Sie hier Buchungen erfassen müssen.
          </p>
        </div>
      </div>
    );
  }

  if (justSaved) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-3 mt-16">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="text-sm font-bold text-slate-800">Buchung gespeichert</p>
        <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft(accounts, nextDocNumber, skr42));
              setJustSaved(false);
            }}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Weitere Buchung erfassen
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  const amountValid = /^\d+([.,]\d{1,2})?$/.test(draft.amountText.trim());
  const canSubmit =
    amountValid &&
    !!draft.accountId &&
    !!draft.mainCategoryId &&
    !!draft.subCategory &&
    draft.documentNumber.trim().length > 0 &&
    draft.partner.trim().length > 0 &&
    !isSaving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const parsedAmount = Number.parseFloat(draft.amountText.trim().replace(',', '.'));
      const signedAmount = draft.type === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
      const now = new Date().toISOString();
      const tx: Transaction = {
        id: `tx-${Date.now()}`,
        date: draft.date,
        amount: signedAmount,
        type: draft.type,
        accountId: draft.accountId,
        documentNumber: draft.documentNumber.trim(),
        bookingText: draft.bookingText.trim() || draft.subCategory,
        partner: draft.partner.trim(),
        sphere: draft.sphere,
        department: draft.department || undefined,
        mainCategory: draft.mainCategory,
        subCategory: draft.subCategory,
        skrAccount: draft.skrAccount,
        category: draft.subCategory,
        vatRate: draft.vatRate,
        receipt: draft.receipt || undefined,
        createdAt: now,
        updatedAt: now
      };
      await onSave(tx);
      setJustSaved(true);
    } catch (err) {
      console.error('Buchung konnte nicht gespeichert werden:', err);
      setSaveError('Die Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Beleg — bewusst zuerst, weil das Fotografieren "bevor der Zettel verloren geht" der Auslöser für diesen Bildschirm ist. */}
      {draft.receipt ? (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 flex items-center justify-center overflow-hidden shrink-0">
            {draft.receipt.type.startsWith('image/') ? (
              <img src={draft.receipt.dataUrl} alt="Beleg" className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-800 truncate">{draft.receipt.name}</p>
            <p className="text-2xs text-emerald-600">Beleg digitalisiert</p>
          </div>
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, receipt: null }))}
            title="Beleg entfernen"
            className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 cursor-pointer active:bg-blue-100"
        >
          <div className="p-2.5 bg-blue-500 text-white rounded-xl shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-blue-900">Beleg fotografieren</p>
            <p className="text-2xs text-blue-600">Optional, aber empfohlen</p>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-400" />
        </button>
      )}

      {/* Typ, Betrag, Datum & Belegnummer */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, type: 'expense' }))}
            className={`py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              draft.type === 'expense' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Ausgabe
          </button>
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, type: 'income' }))}
            className={`py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              draft.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Einnahme
          </button>
        </div>
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Betrag</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={draft.amountText}
              onChange={e => setDraft(d => ({ ...d, amountText: e.target.value }))}
              placeholder="0,00"
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">€</span>
          </div>
          {draft.amountText.trim().length > 0 && !amountValid && (
            <p className="text-2xs text-rose-600 mt-1">Bitte einen gültigen Betrag eingeben, z. B. 24,90</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">Datum</label>
            <input
              type="date"
              value={draft.date}
              onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Belegnummer
            </label>
            <input
              type="text"
              value={draft.documentNumber}
              onChange={e => setDraft(d => ({ ...d, documentNumber: e.target.value }))}
              placeholder="BE-2025-001"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {draft.documentNumber.trim().length === 0 && (
              <p className="text-2xs text-rose-600 mt-1">Belegnummer ist erforderlich</p>
            )}
          </div>
        </div>
      </div>

      {/* Bankkonto / Barkasse */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Bankkonto / Barkasse
          </label>
          <select
            value={draft.accountId}
            onChange={e => setDraft(d => ({ ...d, accountId: e.target.value }))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {accounts.length === 0 && <option value="">Kein Konto angelegt</option>}
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nummernkreis, Konto (SKR 42), Sparte & Umsatzsteuer */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <SearchableAccountSelect
          label="Nummernkreis (SKR 42)"
          value={draft.mainCategoryId}
          onChange={handleMainCatChange}
          options={mainCatOptions}
          placeholder="Nummernkreis auswählen …"
          searchPlaceholder="Nummer oder Nummernkreis tippen …"
        />
        <SearchableAccountSelect
          label="Konto (SKR 42)"
          value={draft.subCategory}
          onChange={handleSubCatChange}
          options={subCatOptions}
          placeholder="Konto auswählen …"
          searchPlaceholder="Nummer oder Begriff tippen …"
        />
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Sparte / Abteilung
          </label>
          <select
            value={draft.department}
            onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">Gesamtverein (keine Sparte)</option>
            {settings.departments.map(dept => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span className="font-mono text-2xs font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800">
            SKR 42: {draft.skrAccount || '–'}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Umsatzsteuer</label>
            <select
              value={draft.vatRate}
              onChange={e => setDraft(d => ({ ...d, vatRate: Number.parseInt(e.target.value, 10) as 0 | 7 | 19 }))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value={0}>0% (stfrei / ideell)</option>
              <option value={7}>7% (ermäßigt / Zweckbetrieb)</option>
              <option value={19}>19% (Regelsatz / wirtschaftlich)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Steuerliche Sphäre */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400">Steuerliche Sphäre</label>
        <div className="grid grid-cols-2 gap-2">
          {SPHERE_ORDER.map(sphereId => {
            const info = TAX_SPHERES[sphereId];
            const isActive = draft.sphere === sphereId;
            return (
              <button
                key={sphereId}
                type="button"
                onClick={() => setDraft(d => ({ ...d, sphere: sphereId }))}
                className={`px-2.5 py-2 rounded-xl text-2xs font-bold transition-colors cursor-pointer text-left ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {info.name}
              </button>
            );
          })}
        </div>
        <p className="text-2xs text-slate-400">{TAX_SPHERES[draft.sphere].subtitle}</p>
      </div>

      {/* Partner & Verwendungszweck */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            {draft.type === 'expense' ? 'Zahlungsempfänger' : 'Einzahler'}
          </label>
          <input
            type="text"
            value={draft.partner}
            onChange={e => setDraft(d => ({ ...d, partner: e.target.value }))}
            placeholder="z. B. Sportgeschäft Meyer"
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Verwendungszweck (optional)
          </label>
          <input
            type="text"
            value={draft.bookingText}
            onChange={e => setDraft(d => ({ ...d, bookingText: e.target.value }))}
            placeholder={draft.subCategory || 'z. B. Trikots 2. Mannschaft'}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {saveError && <p className="text-xs text-rose-600 text-center">{saveError}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer ${
          canSubmit ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Speichert …' : 'Buchung speichern'}
      </button>

      {scannerOpen && (
        <ReceiptCameraScannerModal
          prefillDocumentNumber={draft.documentNumber}
          prefillPartner={draft.partner}
          prefillBookingText={draft.bookingText}
          existingTransactions={existingTransactions}
          accounts={accounts}
          settings={settings}
          onAttachReceipt={receipt => setDraft(d => ({ ...d, receipt }))}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
