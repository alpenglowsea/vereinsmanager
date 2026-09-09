import React from 'react';
import {
  Transaction,
  FinancialAccount,
  ClubSettings,
  ReceiptAttachment,
  ClubContact
} from '../types';
import { TAX_SPHERES } from '../data/taxSpheres';
import {
  X,
  Edit2,
  Trash2,
  Calendar,
  Building2,
  Coins,
  Paperclip,
  Download,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Tag,
  FileText,
  Camera,
  UserPlus,
  Info,
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  accounts: FinancialAccount[];
  settings: ClubSettings;
  contacts?: ClubContact[];
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onOpenReceiptViewer: (receipt: ReceiptAttachment, docNum: string, text: string) => void;
  onQuickScanReceipt?: (tx: Transaction) => void;
  onOpenCreateContactFromTx?: (partnerName: string, isIncome: boolean) => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  transaction,
  accounts,
  settings,
  contacts = [],
  onClose,
  onEdit,
  onDelete,
  onOpenReceiptViewer,
  onQuickScanReceipt,
  onOpenCreateContactFromTx
}) => {
  if (!isOpen || !transaction) return null;

  const isIncome = transaction.amount >= 0;
  const isTransfer = transaction.type === 'transfer';
  const sourceAccount = accounts.find(a => a.id === transaction.accountId);
  const targetAccount = transaction.targetAccountId
    ? accounts.find(a => a.id === transaction.targetAccountId)
    : undefined;

  const sphereInfo = TAX_SPHERES[transaction.sphere];

  // Check if partner is an existing contact
  const trimmedPartner = (transaction.partner || '').trim().toLowerCase();
  const matchedContact = trimmedPartner && !isTransfer
    ? contacts.find(
        c =>
          (c.displayName || '').trim().toLowerCase() === trimmedPartner ||
          (c.companyName || '').trim().toLowerCase() === trimmedPartner
      )
    : null;

  // Calculate tax breakdown
  const grossAmount = Math.abs(transaction.amount);
  const vatRate = transaction.vatRate || 0;
  const netAmount = vatRate > 0 ? grossAmount / (1 + vatRate / 100) : grossAmount;
  const vatAmount = grossAmount - netAmount;

  const handleDownloadReceipt = () => {
    if (!transaction.receipt) return;
    const link = document.createElement('a');
    link.href = transaction.receipt.dataUrl;
    link.download = transaction.receipt.name || `Beleg_${transaction.documentNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = () => {
    const confirmMsg = `Möchten Sie die Buchung ${transaction.documentNumber} (${transaction.bookingText}) über ${Math.abs(transaction.amount).toFixed(2)} € wirklich unwiderruflich löschen?`;
    if (window.confirm(confirmMsg)) {
      onDelete(transaction.id);
      onClose();
    }
  };

  const formattedDate = new Date(transaction.date).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shadow-2xs ${
                isTransfer
                  ? 'bg-blue-100 text-blue-700'
                  : isIncome
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {isTransfer ? (
                <RefreshCw className="w-5 h-5" />
              ) : isIncome ? (
                <ArrowDownRight className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  {transaction.documentNumber}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider ${
                    isTransfer
                      ? 'bg-blue-100 text-blue-800'
                      : isIncome
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isTransfer ? 'Umbuchung' : isIncome ? 'Einnahme' : 'Ausgabe'}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedDate}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Hero Banner: Amount & Booking Text */}
          <div
            className={`p-5 rounded-2xl border ${
              isTransfer
                ? 'bg-blue-50/60 border-blue-200'
                : isIncome
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-rose-50/60 border-rose-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Buchungsbetrag
                </span>
                <div
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    isTransfer
                      ? 'text-blue-700'
                      : isIncome
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {isIncome ? '+' : ''}
                  {transaction.amount.toLocaleString('de-DE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  €
                </div>
              </div>

              {vatRate > 0 && (
                <div className="text-right text-2xs text-slate-600 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/80 font-mono">
                  <div>Netto: {netAmount.toFixed(2)} €</div>
                  <div className="text-slate-500">
                    +{vatRate}% USt: {vatAmount.toFixed(2)} €
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
                Zahlungspartner / Empfänger / Einzahler
              </span>
              <div className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{transaction.partner || '–'}</span>
                {matchedContact && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold bg-orange-100 text-orange-800 rounded-md border border-orange-200">
                    <Building2 className="w-3 h-3" />
                    <span>Kontaktkartei ({matchedContact.displayName})</span>
                  </span>
                )}
                {!matchedContact && transaction.partner && !isTransfer && onOpenCreateContactFromTx && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCreateContactFromTx(transaction.partner, isIncome);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer"
                    title="Als neuen Kontakt anlegen"
                  >
                    <UserPlus className="w-3 h-3 text-amber-600" />
                    <span>+ Als Kontakt speichern</span>
                  </button>
                )}
              </div>

              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mt-2">
                Buchungstext / Verwendungszweck
              </span>
              <p className="text-sm text-slate-800 font-medium mt-0.5 bg-white/70 p-2.5 rounded-lg border border-slate-200/70">
                {transaction.bookingText || 'Kein Buchungstext vorhanden'}
              </p>
            </div>
          </div>

          {/* Grid of details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Konto & Zahlweg */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Finanzkonto & Buchungsweg</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">
                    {isTransfer ? 'Quellkonto' : 'Konto / Kasse'}:
                  </span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    {sourceAccount?.accountType === 'cash' ? (
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    {sourceAccount?.name || transaction.accountId}
                  </span>
                </div>

                {sourceAccount?.iban && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">IBAN:</span>
                    <span className="font-mono text-slate-700">{sourceAccount.iban}</span>
                  </div>
                )}

                {isTransfer && targetAccount && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Zielkonto:</span>
                    <span className="font-bold text-blue-700 flex items-center gap-1">
                      {targetAccount.accountType === 'cash' ? (
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      {targetAccount.name}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Buchungsart:</span>
                  <span className="font-semibold text-slate-800">
                    {isTransfer
                      ? 'Interne Umbuchung'
                      : isIncome
                      ? 'Einnahmebuchung'
                      : 'Ausgabenbuchung'}
                  </span>
                </div>
              </div>
            </div>

            {/* Steuerliche Zuordnung (4-Sphären-System) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Steuer-Sphäre & Kategorie</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Sphäre:</span>
                  <span className="font-bold text-slate-900">
                    {sphereInfo ? sphereInfo.name : transaction.sphere}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Kategorie:</span>
                  <span className="font-bold text-slate-900">{transaction.category}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Umsatzsteuersatz:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {transaction.vatRate || 0}%
                  </span>
                </div>

                {sphereInfo?.subtitle && (
                  <p className="text-3xs text-slate-500 italic pt-1 leading-relaxed">
                    {sphereInfo.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Beleg & digitaler Anhang */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Paperclip className="w-4 h-4 text-indigo-600" />
                <span>Digitaler Beleg & Quittung</span>
              </div>
              {transaction.receipt && (
                <span className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Beleg archiviert</span>
                </span>
              )}
            </div>

            {transaction.receipt ? (
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {transaction.receipt.name || `Beleg_${transaction.documentNumber}`}
                    </div>
                    <div className="text-2xs text-slate-500 flex items-center gap-2">
                      <span>{Math.round((transaction.receipt.size || 0) / 1024)} KB</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">
                        {transaction.receipt.type || 'Dokument'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenReceiptViewer(
                        transaction.receipt!,
                        transaction.documentNumber,
                        transaction.bookingText
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Beleg anzeigen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Beleg herunterladen"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <p className="text-xs text-amber-900 font-medium">
                    Kein digitaler Beleg hinterlegt. Für eine lückenlose Kassenprüfung empfiehlt sich das Anhängen einer Rechnung oder Quittung.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onQuickScanReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onQuickScanReceipt(transaction);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Mit Smartphone-Kamera scannen"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kamera-Scan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(transaction);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/70 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Datei anhängen</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notizen & Metadaten */}
          {transaction.notes && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
                Interne Notizen & Vermerke
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {transaction.notes}
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-3xs text-slate-400 font-mono">
            <span>Buchungs-ID: {transaction.id}</span>
            <span>Verein: {settings.clubName}</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Diese Buchung löschen"
          >
            <Trash2 className="w-4 h-4" />
            <span>Buchung löschen</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(transaction);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Buchung bearbeiten</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
