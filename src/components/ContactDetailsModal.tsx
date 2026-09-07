import React from 'react';
import { ClubContact, Transaction } from '../types';
import { CONTACT_TYPE_MAP } from '../data/contactConstants';
import {
  X,
  Building2,
  User,
  MapPin,
  Mail,
  Phone,
  Globe,
  CreditCard,
  Tag,
  Edit2,
  Trash2,
  Receipt,
  Plus,
  ExternalLink,
  Calendar,
  Briefcase
} from 'lucide-react';

interface ContactDetailsModalProps {
  contact: ClubContact | null;
  transactions: Transaction[];
  isOpen?: boolean;
  onClose: () => void;
  onEdit: (contact: ClubContact) => void;
  onDelete: (contactId: string) => void;
  onCreateBookingForContact?: (contact: ClubContact) => void;
}

export const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({
  contact,
  transactions,
  isOpen = true,
  onClose,
  onEdit,
  onDelete,
  onCreateBookingForContact
}) => {
  if (isOpen === false || !contact) return null;

  // Find bookings associated with this contact
  const contactNameLower = (contact.displayName || '').toLowerCase().trim();
  const companyNameLower = (contact.companyName || '').toLowerCase().trim();
  const contactNumber = contact.contactNumber?.toLowerCase().trim();

  const relatedBookings = transactions.filter(t => {
    const p = (t.partner || '').toLowerCase().trim();
    const notes = (t.notes || '').toLowerCase();
    const bookingText = (t.bookingText || '').toLowerCase();

    if (!p && !bookingText) return false;

    // Direct match with partner name
    if (contactNameLower && (p === contactNameLower || p.includes(contactNameLower) || contactNameLower.includes(p))) {
      return true;
    }
    if (companyNameLower && (p === companyNameLower || p.includes(companyNameLower))) {
      return true;
    }
    // Match with contact number
    if (contactNumber && (notes.includes(contactNumber) || bookingText.includes(contactNumber))) {
      return true;
    }
    return false;
  }).slice(0, 10);

  const totalInflow = relatedBookings
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = relatedBookings
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {contact.personType === 'legal' ? (
                <Building2 className="w-6 h-6" />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-orange-300 font-mono text-xs font-semibold border border-slate-700">
                  {contact.contactNumber}
                </span>
                <span className="text-xs text-slate-400">
                  {contact.personType === 'legal'
                    ? `Juristische Person (${contact.legalForm || 'Firma'})`
                    : 'Natürliche Person (Privatperson)'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {contact.displayName}
              </h2>
              {contact.personType === 'legal' && contact.contactPerson && (
                <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Ansprechpartner:{' '}
                    {[
                      contact.contactPerson.salutation,
                      contact.contactPerson.firstName,
                      contact.contactPerson.lastName
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    {contact.contactPerson.roleOrPosition &&
                      ` (${contact.contactPerson.roleOrPosition})`}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(contact)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Bearbeiten</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Action Banner */}
          <div className="flex items-center justify-between p-3.5 bg-orange-50/80 rounded-xl border border-orange-200">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-5 h-5 text-orange-600" />
              <div>
                <div className="text-xs font-bold text-orange-950">
                  Buchung für diesen Kontakt erfassen
                </div>
                <div className="text-2xs text-orange-700">
                  Öffnet das Buchungsformular mit vorausgefülltem Partner & Bankdaten
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCreateBookingForContact?.(contact)}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Buchung</span>
            </button>
          </div>

          {/* Type Badges */}
          <div>
            <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Zugeordnete Kontakttypen
            </div>
            <div className="flex flex-wrap gap-2">
              {contact.types.map(type => {
                const meta = CONTACT_TYPE_MAP.get(type);
                return (
                  <span
                    key={type}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                      meta?.badgeBg || 'bg-slate-100'
                    } ${meta?.badgeText || 'text-slate-700'} ${
                      meta?.badgeBorder || 'border-slate-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: meta?.accentColor || '#64748b' }}
                    />
                    <span>{meta?.label || type}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Grid Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Details */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Kontakt & Kommunikation</span>
              </div>
              <div className="space-y-2 text-xs">
                {contact.email ? (
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-400 w-16">E-Mail:</span>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {contact.email}
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-16">E-Mail:</span>
                    <span>Keine Angabe</span>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-400 w-16">Telefon:</span>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-slate-800 hover:text-orange-600 font-medium"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.mobile && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-400 w-16">Mobil:</span>
                    <a
                      href={`tel:${contact.mobile}`}
                      className="text-slate-800 hover:text-orange-600 font-medium"
                    >
                      {contact.mobile}
                    </a>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-400 w-16">Website:</span>
                    <a
                      href={
                        contact.website.startsWith('http')
                          ? contact.website
                          : `https://${contact.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>{contact.website}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Anschrift</span>
              </div>
              <div className="text-xs text-slate-700 space-y-1">
                {contact.address.street ? (
                  <>
                    <div className="font-medium">
                      {contact.address.street} {contact.address.houseNumber}
                    </div>
                    <div>
                      {contact.address.zip} {contact.address.city}
                    </div>
                    <div className="text-slate-400">{contact.address.country}</div>
                  </>
                ) : (
                  <div className="text-slate-400">Keine Anschrift hinterlegt</div>
                )}
              </div>
            </div>

            {/* Bank & Accounting */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>Bank- & Buchhaltungsdaten</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {contact.bankDetails?.iban ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 w-24">IBAN:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {contact.bankDetails.iban}
                      </span>
                    </div>
                    {contact.bankDetails.bic && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-24">BIC:</span>
                        <span className="font-mono text-slate-700">
                          {contact.bankDetails.bic}
                        </span>
                      </div>
                    )}
                    {contact.bankDetails.bankName && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-24">Bank:</span>
                        <span className="text-slate-700">
                          {contact.bankDetails.bankName}
                        </span>
                      </div>
                    )}
                    {contact.bankDetails.accountHolder && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-24">Inhaber:</span>
                        <span className="text-slate-700">
                          {contact.bankDetails.accountHolder}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-400">Keine Bankverbindung erfasst</div>
                )}

                {contact.creditorOrDebtorNumber && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <span className="text-slate-400 w-24">Kreditor/Debitor:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {contact.creditorOrDebtorNumber}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Legal specifics or Notes */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                <span>Steuer- & Registerdaten</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {contact.taxId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24">Steuer-Nr./USt:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {contact.taxId}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-400">Keine Steuernummer erfasst</div>
                )}

                {contact.commercialRegister && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24">Register:</span>
                    <span className="text-slate-700">
                      {contact.commercialRegister}
                    </span>
                  </div>
                )}

                {contact.tags && contact.tags.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-2xs font-semibold text-slate-400 mb-1">
                      Tags:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map(t => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-2xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <div className="text-xs font-bold text-amber-900 mb-1">
                Notizen & Absprachen
              </div>
              <p className="text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">
                {contact.notes}
              </p>
            </div>
          )}

          {/* Associated Bookings */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Zugeordnete Buchungen ({relatedBookings.length})
                </h3>
              </div>
              {relatedBookings.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-700 font-semibold">
                    Einnahmen: +{totalInflow.toFixed(2)} €
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-rose-700 font-semibold">
                    Ausgaben: -{totalOutflow.toFixed(2)} €
                  </span>
                </div>
              )}
            </div>

            {relatedBookings.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {relatedBookings.map(t => (
                  <div
                    key={t.id}
                    className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-2xs w-18">
                        {new Date(t.date).toLocaleDateString('de-DE')}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {t.bookingText}
                        </div>
                        <div className="text-2xs text-slate-500">
                          Beleg: {t.documentNumber || '-'} • Kategorie:{' '}
                          {t.category || '-'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono font-bold ${
                        t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {t.amount.toFixed(2)} €
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                Bisher keine Buchungen für diesen Kontakt vorhanden.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Möchten Sie den Kontakt "${contact.displayName}" wirklich löschen?`
                )
              ) {
                onDelete(contact.id);
                onClose();
              }
            }}
            className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kontakt löschen</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
