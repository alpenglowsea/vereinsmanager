/**
 * „Als bezahlt markieren“ (D-01, D-46, wie Android): Zahldatum, Zahlart und
 * auf Wunsch die Einnahmebuchung mit Konto und Einnahmekonto.
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import type { ClubInvoice, FinancialAccount, PaymentMethod } from '../types';
import { BezahltAngaben, einnahmeKonten, kontoVorschlag, pruefeBezahlt } from '../services/rechnungsRegeln';
import { formatCurrency } from '../services/invoicePdfService';

const heute = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const ZAHLARTEN: { wert: PaymentMethod; text: string }[] = [
  { wert: 'transfer', text: 'Überweisung' },
  { wert: 'cash', text: 'Bar' },
  { wert: 'sepa', text: 'Lastschrift' },
  { wert: 'standing_order', text: 'Dauerauftrag' }
];

export const RechnungBezahltDialog: React.FC<{
  rechnung: ClubInvoice;
  konten: FinancialAccount[];
  /** Gibt es die verknüpfte Buchung schon? Dann wird keine zweite angelegt. */
  hatBuchung: boolean;
  onAbbrechen: () => void;
  onBestaetigen: (a: BezahltAngaben) => Promise<void>;
}> = ({ rechnung, konten, hatBuchung, onAbbrechen, onBestaetigen }) => {
  const alleKonten = useMemo(() => einnahmeKonten(), []);
  const [datum, setDatum] = useState(heute());
  const [zahlart, setZahlart] = useState<PaymentMethod>('transfer');
  const [buchungAnlegen, setBuchungAnlegen] = useState(!hatBuchung);
  const [kontoId, setKontoId] = useState(konten[0]?.id || '');
  const [skr, setSkr] = useState(kontoVorschlag(rechnung.taxSphere)?.skrAccount || alleKonten[0]?.skrAccount || '');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const bestaetigen = async () => {
    const a: BezahltAngaben = {
      datum,
      zahlart,
      buchungAnlegen: buchungAnlegen && !hatBuchung,
      kontoId,
      konto: alleKonten.find(k => k.skrAccount === skr) ?? null
    };
    const f = pruefeBezahlt(rechnung, a);
    if (f) {
      setFehler(f);
      return;
    }
    setLaeuft(true);
    try {
      await onBestaetigen(a);
    } catch (err: any) {
      setFehler(err?.message || 'Die Rechnung konnte nicht als bezahlt markiert werden.');
      setLaeuft(false);
    }
  };

  const feld = 'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Rechnung {rechnung.invoiceNumber} als bezahlt markieren</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Betrag: {formatCurrency(rechnung.totalAmount)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Zahldatum</span>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={feld} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Zahlart</span>
            <select value={zahlart} onChange={e => setZahlart(e.target.value as PaymentMethod)} className={feld}>
              {ZAHLARTEN.map(z => (
                <option key={z.wert} value={z.wert}>{z.text}</option>
              ))}
            </select>
          </label>
        </div>

        {hatBuchung ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            Zu dieser Rechnung gibt es schon eine Buchung; es wird keine zweite angelegt.
          </p>
        ) : (
          <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={buchungAnlegen} onChange={e => setBuchungAnlegen(e.target.checked)} className="rounded border-slate-300" />
              Einnahmebuchung anlegen
            </label>
            {buchungAnlegen && (
              <>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Eingegangen auf Konto</span>
                  <select value={kontoId} onChange={e => setKontoId(e.target.value)} className={feld}>
                    {konten.length === 0 && <option value="">(kein Konto angelegt)</option>}
                    {konten.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Einnahmekonto (Kontenrahmen)</span>
                  <select value={skr} onChange={e => setSkr(e.target.value)} className={feld}>
                    {alleKonten.map(k => (
                      <option key={k.skrAccount} value={k.skrAccount}>{k.subCategory}</option>
                    ))}
                  </select>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Vorschlag nach der steuerlichen Sphäre der Rechnung. Bei mehreren Steuersätzen wird die Buchung je Satz aufgeteilt.
                  </span>
                </label>
              </>
            )}
          </div>
        )}

        {fehler && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{fehler}</p>}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
          <button
            type="button"
            onClick={onAbbrechen}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={bestaetigen}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
          >
            Als bezahlt markieren
          </button>
        </div>
      </div>
    </div>
  );
};
