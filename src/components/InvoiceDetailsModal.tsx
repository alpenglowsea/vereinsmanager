import React from 'react';
import { ClubInvoice, ClubSettings, InvoiceTemplateSettings } from '../types';
import { formatCurrency } from '../services/invoicePdfService';
import {
  X,
  Download,
  Edit2,
  Trash2,
  Calendar,
  Building2,
  User,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  FolderArchive,
  QrCode
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ClubInvoice | null;
  clubSettings: ClubSettings;
  templateSettings: InvoiceTemplateSettings;
  onEdit: (invoice: ClubInvoice) => void;
  onDelete: (id: string) => void;
  onDownloadPdf: (invoice: ClubInvoice) => void;
  onToggleStatus?: (invoice: ClubInvoice, newStatus: ClubInvoice['status']) => void;
  onShowInDocuments?: (docId: string) => void;
}

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoice,
  clubSettings,
  templateSettings,
  onEdit,
  onDelete,
  onDownloadPdf,
  onToggleStatus,
  onShowInDocuments
}) => {
  if (!isOpen || !invoice) return null;

  const getStatusBadge = (status: ClubInvoice['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Bezahlt</span>
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5" />
            <span>Offen</span>
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <Clock className="w-3.5 h-3.5" />
            <span>Überfällig</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <Ban className="w-3.5 h-3.5" />
            <span>Storniert</span>
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <FileText className="w-3.5 h-3.5" />
            <span>Entwurf</span>
          </span>
        );
    }
  };

  const isOverdue = invoice.status === 'open' && new Date(invoice.dueDate) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shadow-2xs">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  {invoice.invoiceNumber}
                </h3>
                {isOverdue && invoice.status === 'open' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    <Clock className="w-3.5 h-3.5" /> Überfällig
                  </span>
                ) : (
                  getStatusBadge(invoice.status)
                )}
                {invoice.taxSphere && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {invoice.taxSphere === 'wirtschaftlich'
                      ? 'Wirtschaftl. Geschäftsbetrieb'
                      : invoice.taxSphere === 'zweckbetrieb'
                      ? 'Zweckbetrieb'
                      : invoice.taxSphere === 'vermoegen'
                      ? 'Vermögensverwaltung'
                      : 'Ideeller Bereich'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Erstellt am {new Date(invoice.date).toLocaleDateString('de-DE')} • Fällig am{' '}
                <strong className="text-slate-800">{new Date(invoice.dueDate).toLocaleDateString('de-DE')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadPdf(invoice)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF herunterladen</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Recipient & Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
            {/* Recipient Details */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Rechnungsempfänger
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900">
                    {invoice.recipientName}
                  </h4>
                  {invoice.recipientType === 'member' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      <User className="w-3 h-3" /> Mitglied
                    </span>
                  )}
                  {invoice.recipientType === 'contact' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      <Building2 className="w-3 h-3" /> Kontakt / Firma
                    </span>
                  )}
                </div>

                {invoice.recipientCompany && (
                  <p className="text-xs font-medium text-slate-700">{invoice.recipientCompany}</p>
                )}

                {invoice.recipientContactPerson && (
                  <p className="text-xs text-slate-600 italic">{invoice.recipientContactPerson}</p>
                )}

                {invoice.recipientAddress && (invoice.recipientAddress.street || invoice.recipientAddress.city) && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-600 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {invoice.recipientAddress.street} {invoice.recipientAddress.houseNumber}
                      <br />
                      {invoice.recipientAddress.zip} {invoice.recipientAddress.city}
                      {invoice.recipientAddress.country && invoice.recipientAddress.country !== 'Deutschland' && `, ${invoice.recipientAddress.country}`}
                    </span>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                  {invoice.recipientEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{invoice.recipientEmail}</span>
                    </div>
                  )}
                  {invoice.recipientPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{invoice.recipientPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Meta & Status Controls */}
            <div className="border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Konditionen & Belegstatus
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Rechnungsdatum:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(invoice.date).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fälligkeitsdatum:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(invoice.dueDate).toLocaleDateString('de-DE')} ({invoice.paymentTermsDays || 14} Tage)
                  </span>
                </div>
                {invoice.deliveryDate && (
                  <div>
                    <span className="text-slate-500 block">Lieferdatum:</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(invoice.deliveryDate).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                )}
                {invoice.documentId && (
                  <div>
                    <span className="text-slate-500 block">Archiv:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                      <FolderArchive className="w-3.5 h-3.5" /> Archiviert
                    </span>
                  </div>
                )}
              </div>

              {/* Status Quick Switch */}
              {onToggleStatus && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">Status ändern:</span>
                  <div className="flex items-center gap-2">
                    {invoice.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(invoice, 'paid')}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Als bezahlt markieren</span>
                      </button>
                    )}
                    {invoice.status !== 'open' && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(invoice, 'open')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Auf 'Offen' setzen</span>
                      </button>
                    )}
                    {invoice.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(invoice, 'cancelled')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Stornieren</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subject & Anschreiben */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900">
              {invoice.subject || 'Rechnung'}
            </h4>
            {invoice.introText && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                {invoice.introText}
              </p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="w-12 px-3 py-2 text-center">Pos.</th>
                  <th className="px-4 py-2">Beschreibung</th>
                  <th className="w-24 px-3 py-2 text-right">Menge</th>
                  <th className="w-24 px-3 py-2 text-right">Einzelpreis</th>
                  <th className="w-20 px-3 py-2 text-center">USt %</th>
                  <th className="w-28 px-4 py-2 text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {invoice.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                      {it.position || idx + 1}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 font-medium">
                      {it.description}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {it.quantity} {it.unit || 'Stk.'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {formatCurrency(it.unitPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                      {it.vatRate}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(it.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summenblock */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-xs text-slate-500">
                {invoice.outroText && (
                  <p className="italic text-slate-600">{invoice.outroText}</p>
                )}
              </div>

              <div className="w-full sm:w-72 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Nettobetrag:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.subtotalNet)}
                  </span>
                </div>
                {invoice.vatAmounts && Object.entries(invoice.vatAmounts).map(([rate, amt]) => (
                  <div key={rate} className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>zzgl. {rate}% USt:</span>
                    <span className="font-mono">{formatCurrency(Number(amt))}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
                  <span className="text-slate-900">Gesamtbetrag:</span>
                  <span className="font-mono text-blue-700">
                    {formatCurrency(invoice.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes if present */}
          {invoice.notes && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
              <span className="font-bold block mb-1">Interne Notiz:</span>
              <p>{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={() => onDelete(invoice.id)}
            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Rechnung löschen</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(invoice)}
              className="text-xs border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 px-3.5 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Bearbeiten</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
