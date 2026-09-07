import React, { useState, useEffect } from 'react';
import {
  ClubContact,
  ContactPersonType,
  ContactType,
  Address
} from '../types';
import {
  CONTACT_TYPES_LIST,
  computeContactDisplayName
} from '../data/contactConstants';
import {
  X,
  Building2,
  User,
  Check,
  Tag,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  Globe,
  FileText,
  AlertCircle,
  HelpCircle,
  Hash,
  Briefcase
} from 'lucide-react';

interface ContactFormModalProps {
  contact: ClubContact | null;
  isOpen: boolean;
  nextContactNumber: string;
  initialName?: string;
  initialType?: ContactType;
  initialIban?: string;
  onSave: (contact: ClubContact) => void;
  onClose: () => void;
}

const COMMON_LEGAL_FORMS = [
  'GmbH',
  'AG',
  'GmbH & Co. KG',
  'UG (haftungsbeschränkt)',
  'e.V.',
  'GbR',
  'OHG',
  'KG',
  'Einzelunternehmen',
  'Stiftung',
  'Körperschaft d.ö.R.',
  'Sonstige'
];

export const ContactFormModal: React.FC<ContactFormModalProps> = ({
  contact,
  isOpen,
  nextContactNumber,
  initialName,
  initialType,
  initialIban,
  onSave,
  onClose
}) => {
  if (!isOpen) return null;

  // Determine initial person type
  const isEditing = Boolean(contact);

  const [personType, setPersonType] = useState<ContactPersonType>(
    contact?.personType || 'legal'
  );

  // Form states
  const [contactNumber, setContactNumber] = useState(
    contact?.contactNumber || nextContactNumber
  );
  const [selectedTypes, setSelectedTypes] = useState<ContactType[]>(
    contact?.types && contact.types.length > 0
      ? contact.types
      : initialType
      ? [initialType]
      : ['sponsor']
  );

  // Legal entity fields
  const [companyName, setCompanyName] = useState(
    contact?.companyName || (personType === 'legal' ? initialName || '' : '')
  );
  const [legalForm, setLegalForm] = useState(contact?.legalForm || 'GmbH');
  const [customLegalForm, setCustomLegalForm] = useState('');
  const [taxId, setTaxId] = useState(contact?.taxId || '');
  const [commercialRegister, setCommercialRegister] = useState(
    contact?.commercialRegister || ''
  );

  // Contact person for legal entity
  const [cpSalutation, setCpSalutation] = useState(
    contact?.contactPerson?.salutation || 'Herr'
  );
  const [cpFirstName, setCpFirstName] = useState(
    contact?.contactPerson?.firstName || ''
  );
  const [cpLastName, setCpLastName] = useState(
    contact?.contactPerson?.lastName || ''
  );
  const [cpRole, setCpRole] = useState(
    contact?.contactPerson?.roleOrPosition || ''
  );
  const [cpEmail, setCpEmail] = useState(contact?.contactPerson?.email || '');
  const [cpPhone, setCpPhone] = useState(contact?.contactPerson?.phone || '');

  // Natural person fields
  const [natSalutation, setNatSalutation] = useState(
    contact?.salutation || 'Herr'
  );
  const [natFirstName, setNatFirstName] = useState(
    contact?.firstName || (personType === 'natural' ? initialName?.split(' ')[0] || '' : '')
  );
  const [natLastName, setNatLastName] = useState(
    contact?.lastName || (personType === 'natural' ? initialName?.split(' ').slice(1).join(' ') || '' : '')
  );
  const [natBirthDate, setNatBirthDate] = useState(contact?.dateOfBirth || '');

  // Common contact & address fields
  const [email, setEmail] = useState(contact?.email || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [mobile, setMobile] = useState(contact?.mobile || '');
  const [website, setWebsite] = useState(contact?.website || '');

  const [address, setAddress] = useState<Address>({
    street: contact?.address?.street || '',
    houseNumber: contact?.address?.houseNumber || '',
    zip: contact?.address?.zip || '12345',
    city: contact?.address?.city || 'Musterstadt',
    country: contact?.address?.country || 'Deutschland'
  });

  // Bank & Accounting details
  const [iban, setIban] = useState(contact?.bankDetails?.iban || initialIban || '');
  const [bic, setBic] = useState(contact?.bankDetails?.bic || '');
  const [bankName, setBankName] = useState(contact?.bankDetails?.bankName || '');
  const [accountHolder, setAccountHolder] = useState(
    contact?.bankDetails?.accountHolder || ''
  );
  const [creditorOrDebtorNumber, setCreditorOrDebtorNumber] = useState(
    contact?.creditorOrDebtorNumber || ''
  );

  // Notes & tags
  const [notes, setNotes] = useState(contact?.notes || '');
  const [tagsInput, setTagsInput] = useState(contact?.tags?.join(', ') || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync if initial values change
  useEffect(() => {
    if (!contact && initialName) {
      if (personType === 'legal' && !companyName) {
        setCompanyName(initialName);
      } else if (personType === 'natural' && !natLastName) {
        const parts = initialName.trim().split(' ');
        if (parts.length > 1) {
          setNatFirstName(parts[0]);
          setNatLastName(parts.slice(1).join(' '));
        } else {
          setNatLastName(parts[0]);
        }
      }
    }
  }, [initialName, personType]);

  const toggleType = (t: ContactType) => {
    setSelectedTypes(prev => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // Keep at least one type
        return prev.filter(x => x !== t);
      } else {
        return [...prev, t];
      }
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!contactNumber.trim()) {
      newErrors.contactNumber = 'Kontaktnummer ist erforderlich';
    }

    if (personType === 'legal') {
      if (!companyName.trim()) {
        newErrors.companyName = 'Firmenname / Organisationsname ist erforderlich';
      }
    } else {
      if (!natLastName.trim()) {
        newErrors.natLastName = 'Nachname ist erforderlich';
      }
    }

    if (selectedTypes.length === 0) {
      newErrors.types = 'Bitte mindestens einen Kontakttyp auswählen';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const actualLegalForm =
      legalForm === 'Sonstige' ? customLegalForm.trim() || 'Sonstige' : legalForm;

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let finalDisplayName = '';
    if (personType === 'legal') {
      finalDisplayName = companyName.trim();
    } else {
      finalDisplayName = [natSalutation, natFirstName, natLastName]
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    const newOrUpdated: ClubContact = {
      id: contact?.id || `cnt-${Date.now()}`,
      contactNumber: contactNumber.trim(),
      personType,
      types: selectedTypes,
      displayName: finalDisplayName,
      address: {
        street: address.street.trim(),
        houseNumber: address.houseNumber.trim(),
        zip: address.zip.trim(),
        city: address.city.trim(),
        country: address.country.trim() || 'Deutschland'
      },
      email: email.trim(),
      phone: phone.trim(),
      mobile: mobile.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      creditorOrDebtorNumber: creditorOrDebtorNumber.trim() || undefined,
      createdAt: contact?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (personType === 'legal') {
      newOrUpdated.companyName = companyName.trim();
      newOrUpdated.legalForm = actualLegalForm;
      newOrUpdated.taxId = taxId.trim() || undefined;
      newOrUpdated.commercialRegister = commercialRegister.trim() || undefined;
      if (cpLastName.trim() || cpFirstName.trim() || cpEmail.trim() || cpPhone.trim()) {
        newOrUpdated.contactPerson = {
          salutation: cpSalutation,
          firstName: cpFirstName.trim() || undefined,
          lastName: cpLastName.trim() || undefined,
          roleOrPosition: cpRole.trim() || undefined,
          email: cpEmail.trim() || undefined,
          phone: cpPhone.trim() || undefined
        };
      }
    } else {
      newOrUpdated.salutation = natSalutation;
      newOrUpdated.firstName = natFirstName.trim() || undefined;
      newOrUpdated.lastName = natLastName.trim();
      newOrUpdated.dateOfBirth = natBirthDate || undefined;
    }

    if (iban.trim() || bic.trim() || bankName.trim() || accountHolder.trim()) {
      newOrUpdated.bankDetails = {
        iban: iban.replace(/\s+/g, '').toUpperCase(),
        bic: bic.trim().toUpperCase() || undefined,
        bankName: bankName.trim() || undefined,
        accountHolder: accountHolder.trim() || finalDisplayName
      };
    }

    onSave(newOrUpdated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {personType === 'legal' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Kontakt bearbeiten' : 'Neuen Kontakt anlegen'}
              </h2>
              <p className="text-xs text-slate-400">
                {personType === 'legal'
                  ? 'Juristische Person / Firma / Organisation'
                  : 'Natürliche Person / Privatperson'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Auswahl: Juristische vs. Natürliche Person */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Personenart auswählen *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPersonType('legal')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  personType === 'legal'
                    ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200 text-orange-950'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    personType === 'legal'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">
                    Juristische Person (Firma)
                  </div>
                  <div className="text-2xs text-slate-500">
                    Unternehmen, Sponsor, Lieferant, Behörde, Verband
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPersonType('natural')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  personType === 'natural'
                    ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200 text-orange-950'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    personType === 'natural'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">
                    Natürliche Person
                  </div>
                  <div className="text-2xs text-slate-500">
                    Privatperson, Einzelspender, Förderer, Trainer
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Kontakttypen (Mehrfachauswahl) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kontakttypen / Rollen * (Mehrfachauswahl)
              </label>
              <span className="text-2xs text-slate-400">
                Klicken zum Aktivieren/Deaktivieren
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONTACT_TYPES_LIST.map(meta => {
                const isSelected = selectedTypes.includes(meta.id);
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => toggleType(meta.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? `${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder} ring-2 ring-orange-300 font-bold shadow-xs`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: meta.accentColor }}
                    />
                    <span>{meta.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                );
              })}
            </div>
            {errors.types && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.types}</span>
              </p>
            )}
          </div>

          {/* 3. Stammdaten je nach Personenart */}
          {personType === 'legal' ? (
            /* Juristische Person: Firma */
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-200">
                <Building2 className="w-4 h-4 text-orange-600" />
                <span>Unternehmens- / Organisationsdaten</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Firmenname / Organisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="z.B. Stadtwerke Musterstadt AG"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  {errors.companyName && (
                    <p className="text-xs text-rose-600 mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rechtsform
                  </label>
                  <select
                    value={legalForm}
                    onChange={e => setLegalForm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {COMMON_LEGAL_FORMS.map(rf => (
                      <option key={rf} value={rf}>
                        {rf}
                      </option>
                    ))}
                  </select>
                </div>

                {legalForm === 'Sonstige' && (
                  <div className="sm:col-span-12">
                    <input
                      type="text"
                      value={customLegalForm}
                      onChange={e => setCustomLegalForm(e.target.value)}
                      placeholder="Genaue Rechtsform eingeben..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Steuernummer / USt-IdNr.
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={e => setTaxId(e.target.value)}
                    placeholder="z.B. DE123456789 oder 112/5840/0199"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Handelsregister (HRB / HRA)
                  </label>
                  <input
                    type="text"
                    value={commercialRegister}
                    onChange={e => setCommercialRegister(e.target.value)}
                    placeholder="z.B. HRB 12345 (Amtsgericht Musterstadt)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Ansprechpartner im Unternehmen */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ansprechpartner / Kontaktperson im Unternehmen</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Anrede
                    </label>
                    <select
                      value={cpSalutation}
                      onChange={e => setCpSalutation(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    >
                      <option value="Herr">Herr</option>
                      <option value="Frau">Frau</option>
                      <option value="Divers">Divers</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Vorname
                    </label>
                    <input
                      type="text"
                      value={cpFirstName}
                      onChange={e => setCpFirstName(e.target.value)}
                      placeholder="Klaus"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Nachname
                    </label>
                    <input
                      type="text"
                      value={cpLastName}
                      onChange={e => setCpLastName(e.target.value)}
                      placeholder="Bergmann"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Position / Abteilung
                    </label>
                    <input
                      type="text"
                      value={cpRole}
                      onChange={e => setCpRole(e.target.value)}
                      placeholder="z.B. Marketingleiter"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Direkte E-Mail
                    </label>
                    <input
                      type="email"
                      value={cpEmail}
                      onChange={e => setCpEmail(e.target.value)}
                      placeholder="k.bergmann@firma.de"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-2xs font-semibold text-slate-600 mb-1">
                      Durchwahl / Mobil
                    </label>
                    <input
                      type="tel"
                      value={cpPhone}
                      onChange={e => setCpPhone(e.target.value)}
                      placeholder="01234 9876-140"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Natürliche Person */
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-200">
                <User className="w-4 h-4 text-orange-600" />
                <span>Persönliche Daten (Privatperson)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anrede
                  </label>
                  <select
                    value={natSalutation}
                    onChange={e => setNatSalutation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                    <option value="Divers">Divers</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vorname
                  </label>
                  <input
                    type="text"
                    value={natFirstName}
                    onChange={e => setNatFirstName(e.target.value)}
                    placeholder="Martin"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    required
                    value={natLastName}
                    onChange={e => setNatLastName(e.target.value)}
                    placeholder="Lindner"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  {errors.natLastName && (
                    <p className="text-xs text-rose-600 mt-1">
                      {errors.natLastName}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Geburtsdatum (optional)
                  </label>
                  <input
                    type="date"
                    value={natBirthDate}
                    onChange={e => setNatBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kontaktnummer *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactNumber}
                    onChange={e => setContactNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Wenn Legal: Kontaktnummer als Feld */}
          {personType === 'legal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kontaktnummer *
                </label>
                <input
                  type="text"
                  required
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                  placeholder="z.B. K-1008"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kreditoren- / Debitorennr. (Buchhaltung)
                </label>
                <input
                  type="text"
                  value={creditorOrDebtorNumber}
                  onChange={e => setCreditorOrDebtorNumber(e.target.value)}
                  placeholder="z.B. KRED-70004 oder DEB-10003"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          )}

          {/* 4. Kontaktdaten (Telefon, Mail, Web) */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Kommunikation & Online</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="kontakt@example.de"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefon (Festnetz / Zentrale)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="01234 56789"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobiltelefon
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="0171 1234567"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Website
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://www.example.de"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 5. Anschrift */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Anschrift & Standort</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-9">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Straße
                </label>
                <input
                  type="text"
                  value={address.street}
                  onChange={e =>
                    setAddress({ ...address, street: e.target.value })
                  }
                  placeholder="Hauptstraße"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hausnummer
                </label>
                <input
                  type="text"
                  value={address.houseNumber}
                  onChange={e =>
                    setAddress({ ...address, houseNumber: e.target.value })
                  }
                  placeholder="12a"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PLZ
                </label>
                <input
                  type="text"
                  value={address.zip}
                  onChange={e =>
                    setAddress({ ...address, zip: e.target.value })
                  }
                  placeholder="12345"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ort
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={e =>
                    setAddress({ ...address, city: e.target.value })
                  }
                  placeholder="Musterstadt"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Land
                </label>
                <input
                  type="text"
                  value={address.country}
                  onChange={e =>
                    setAddress({ ...address, country: e.target.value })
                  }
                  placeholder="Deutschland"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* 6. Bankverbindung (IBAN / BIC) */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span>Bankverbindung (für Überweisungen & Lastschriften)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                  placeholder="DE00 0000 0000 0000 0000 00"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  BIC
                </label>
                <input
                  type="text"
                  value={bic}
                  onChange={e => setBic(e.target.value)}
                  placeholder="SPKDMUSTXXX"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kreditinstitut (Bankname)
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="Sparkasse Musterstadt"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kontoinhaber
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value)}
                  placeholder="Falls abweichend vom Kontaktnamen"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* 7. Notizen & Schlagwörter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notizen & Vereinbarungen
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="z.B. Sponsoringvereinbarung 2026/27, Konditionen, Ansprechzeiten..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Schlagwörter / Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="Bandenwerbung, Großkunde, A-Jugend (kommagetrennt)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-2xs text-slate-400 mt-1">
                Mit Komma getrennt eingeben
              </p>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isEditing ? 'Änderungen speichern' : 'Kontakt anlegen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
