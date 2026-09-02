import React, { useState, useEffect } from 'react';
import {
  Member,
  Gender,
  MembershipStatus,
  MembershipType,
  PaymentMethod,
  FeePeriod
} from '../types';
import { DEFAULT_DEPARTMENTS } from '../data/taxSpheres';
import { SepaService } from '../services/sepaService';
import {
  X,
  User,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  Camera,
  Trash2,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface MemberFormModalProps {
  member: Member | null;
  departments: string[];
  nextMemberNumber: string;
  onSave: (member: Member) => void;
  onClose: () => void;
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  member,
  departments = DEFAULT_DEPARTMENTS,
  nextMemberNumber,
  onSave,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'base' | 'contact' | 'membership' | 'payment' | 'notes'>('base');

  const [formData, setFormData] = useState<Member>({
    id: member?.id || `mem-${Date.now()}`,
    memberNumber: member?.memberNumber || nextMemberNumber,
    firstName: member?.firstName || '',
    lastName: member?.lastName || '',
    gender: member?.gender || 'none',
    birthDate: member?.birthDate || '',
    address: {
      street: member?.address?.street || '',
      houseNumber: member?.address?.houseNumber || '',
      zip: member?.address?.zip || '',
      city: member?.address?.city || '',
      country: member?.address?.country || 'Deutschland'
    },
    phone: member?.phone || '',
    email: member?.email || '',
    entryDate: member?.entryDate || new Date().toISOString().split('T')[0],
    exitDate: member?.exitDate || '',
    status: member?.status || 'active',
    department: member?.department || departments[0] || 'Fußball',
    membershipType: member?.membershipType || 'full',
    feeAmount: member?.feeAmount ?? 120.00,
    feePeriod: member?.feePeriod || 'yearly',
    paymentMethod: member?.paymentMethod || 'sepa',
    bankDetails: {
      iban: member?.bankDetails?.iban || '',
      bic: member?.bankDetails?.bic || '',
      bankName: member?.bankDetails?.bankName || '',
      accountHolder: member?.bankDetails?.accountHolder || '',
      mandateDate: member?.bankDetails?.mandateDate || (member?.paymentMethod === 'sepa' ? new Date().toISOString().split('T')[0] : ''),
      mandateReference: member?.bankDetails?.mandateReference || `MANDAT-${nextMemberNumber}-${new Date().getFullYear()}`
    },
    notes: member?.notes || '',
    dataPrivacyConsent: member?.dataPrivacyConsent ?? true,
    createdAt: member?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const handleStatusChange = (newStatus: MembershipStatus) => {
    if (newStatus === 'terminated') {
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        membershipType: 'ausgetreten',
        feeAmount: 0,
        feePeriod: 'none',
        exitDate: prev.exitDate || new Date().toISOString().split('T')[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        membershipType: prev.membershipType === 'ausgetreten' || prev.membershipType === 'terminated' ? 'full' : prev.membershipType
      }));
    }
  };

  const handleMembershipTypeChange = (newType: MembershipType) => {
    if (newType === 'ausgetreten' || newType === 'terminated') {
      setFormData(prev => ({
        ...prev,
        membershipType: newType,
        status: 'terminated',
        feeAmount: 0,
        feePeriod: 'none',
        exitDate: prev.exitDate || new Date().toISOString().split('T')[0]
      }));
    } else if (newType === 'honorary') {
      setFormData(prev => ({
        ...prev,
        membershipType: newType,
        feeAmount: 0,
        feePeriod: 'none'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        membershipType: newType,
        status: prev.status === 'terminated' ? 'active' : prev.status
      }));
    }
  };

  const handleFeePeriodChange = (newPeriod: FeePeriod) => {
    if (newPeriod === 'none') {
      setFormData(prev => ({
        ...prev,
        feePeriod: newPeriod,
        feeAmount: 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        feePeriod: newPeriod
      }));
    }
  };

  const isFeeLocked = formData.status === 'terminated' || formData.membershipType === 'ausgetreten' || formData.feePeriod === 'none';
  const isPeriodLocked = formData.status === 'terminated' || formData.membershipType === 'ausgetreten';

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Keep account holder in sync with name if empty
    if (!formData.bankDetails.accountHolder && (formData.firstName || formData.lastName)) {
      setFormData(prev => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          accountHolder: `${prev.firstName} ${prev.lastName}`.trim()
        }
      }));
    }
  }, [formData.firstName, formData.lastName]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.memberNumber.trim()) newErrors.memberNumber = 'Mitgliedsnummer ist erforderlich.';
    if (!formData.firstName.trim()) newErrors.firstName = 'Vorname ist erforderlich.';
    if (!formData.lastName.trim()) newErrors.lastName = 'Nachname ist erforderlich.';
    if (!formData.entryDate) newErrors.entryDate = 'Eintrittsdatum ist erforderlich.';

    if (formData.paymentMethod === 'sepa') {
      if (!formData.bankDetails.iban.trim()) {
        newErrors.iban = 'Für SEPA-Lastschrift ist die IBAN erforderlich.';
      }
      if (!formData.bankDetails.accountHolder.trim()) {
        newErrors.accountHolder = 'Kontoinhaber ist erforderlich.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // Switch to tab with error
      if (errors.firstName || errors.lastName || errors.memberNumber) setActiveTab('base');
      else if (errors.iban || errors.accountHolder) setActiveTab('payment');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {member ? `Mitglied bearbeiten: ${member.firstName} ${member.lastName}` : 'Neues Mitglied anlegen'}
              </h2>
              <p className="text-xs text-slate-500">
                Vollständige Stammdaten, SEPA-Bankverbindung und Beitragsverwaltung
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-2 pt-2 overflow-x-auto text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('base')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'base'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            1. Stammdaten
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'contact'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            2. Adresse & Kontakt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('membership')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'membership'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            3. Mitgliedschaft & Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            4. Bank & SEPA-Lastschrift
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            5. Notizen & DSGVO
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            {/* TAB 1: STAMMDATEN */}
            {activeTab === 'base' && (
              <div className="space-y-5 animate-in fade-in duration-100">
                {/* Avatar / Profilbild Widget */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-white shadow-xs overflow-hidden flex items-center justify-center">
                      {formData.avatarUrl ? (
                        <img
                          src={formData.avatarUrl}
                          alt="Profilbild"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 font-bold text-sm">
                          <User className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900 mb-0.5">
                      Profilbild / Mitgliedsfoto
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Optionales Foto für Mitgliedsausweis & Stammblatt (JPG, PNG oder WebP).
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors">
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>{formData.avatarUrl ? 'Foto ändern' : 'Foto auswählen'}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const maxSize = 320;
                                let width = img.width;
                                let height = img.height;
                                if (width > height) {
                                  if (width > maxSize) {
                                    height = Math.round((height * maxSize) / width);
                                    width = maxSize;
                                  }
                                } else {
                                  if (height > maxSize) {
                                    width = Math.round((width * maxSize) / height);
                                    height = maxSize;
                                  }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, width, height);
                                  setFormData(prev => ({
                                    ...prev,
                                    avatarUrl: canvas.toDataURL('image/jpeg', 0.85)
                                  }));
                                }
                              };
                              img.src = event.target?.result as string;
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>

                      {formData.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, avatarUrl: undefined }))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Entfernen</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mitgliedsnummer *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.memberNumber}
                      onChange={e => setFormData({ ...formData, memberNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      placeholder="z.B. MG-001"
                    />
                    {errors.memberNumber && <p className="text-xs text-rose-600 mt-1">{errors.memberNumber}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Geschlecht
                    </label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="none">Keine Angabe</option>
                      <option value="m">Männlich</option>
                      <option value="w">Weiblich</option>
                      <option value="d">Divers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Geburtsdatum
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate || ''}
                      onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vorname *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. Maximilian"
                    />
                    {errors.firstName && <p className="text-xs text-rose-600 mt-1">{errors.firstName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nachname *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. Müller"
                    />
                    {errors.lastName && <p className="text-xs text-rose-600 mt-1">{errors.lastName}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ADRESSE & KONTAKT */}
            {activeTab === 'contact' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Straße
                    </label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={e => setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. Hauptstraße"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hausnummer
                    </label>
                    <input
                      type="text"
                      value={formData.address.houseNumber}
                      onChange={e => setFormData({
                        ...formData,
                        address: { ...formData.address, houseNumber: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. 42a"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Postleitzahl (PLZ)
                    </label>
                    <input
                      type="text"
                      value={formData.address.zip}
                      onChange={e => setFormData({
                        ...formData,
                        address: { ...formData.address, zip: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. 12345"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Wohnort
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={e => setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. Musterstadt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Land
                    </label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={e => setFormData({
                        ...formData,
                        address: { ...formData.address, country: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Deutschland"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      Telefonnummer / Mobil
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. 0171 1234567"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-Mail-Adresse
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="z.B. max.mueller@example.de"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MITGLIEDSCHAFT & STATUS */}
            {activeTab === 'membership' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Abteilung / Sparte *
                    </label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mitgliedschaftsstatus *
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => handleStatusChange(e.target.value as MembershipStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                    >
                      <option value="active">🟢 Aktiv</option>
                      <option value="passive">⚪ Passiv</option>
                      <option value="honorary">⭐ Ehrenmitglied</option>
                      <option value="suspended">🟡 Ruhend</option>
                      <option value="terminated">🔴 Gekündigt / Ausgetreten</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mitgliedschaftstyp *
                    </label>
                    <select
                      value={formData.membershipType}
                      onChange={e => handleMembershipTypeChange(e.target.value as MembershipType)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="full">Vollmitglied (Erwachsene)</option>
                      <option value="youth">Jugend / Kind</option>
                      <option value="reduced">Ermäßigt (Student/Rentner)</option>
                      <option value="family">Familienbeitrag</option>
                      <option value="supporting">Fördermitglied / Sponsor</option>
                      <option value="honorary">Ehrenmitglied (beitragsfrei)</option>
                      <option value="ausgetreten">Ausgetreten</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Eintrittsdatum *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.entryDate}
                      onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Austrittsdatum {formData.status === 'terminated' ? '(Wirksam zum)' : '(optional)'}
                    </label>
                    <input
                      type="date"
                      value={formData.exitDate || ''}
                      onChange={e => setFormData({ ...formData, exitDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Beitragshöhe (€)
                      </label>
                      {isFeeLocked && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Gesperrt (0,00 €)
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      disabled={isFeeLocked}
                      value={formData.feeAmount}
                      onChange={e => setFormData({ ...formData, feeAmount: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold transition-colors ${
                        isFeeLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Zahlungsrhythmus
                      </label>
                      {isPeriodLocked && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Gesperrt
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.feePeriod}
                      disabled={isPeriodLocked}
                      onChange={e => handleFeePeriodChange(e.target.value as FeePeriod)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                        isPeriodLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900'
                      }`}
                    >
                      <option value="monthly">Monatlich</option>
                      <option value="quarterly">Vierteljährlich (Quartal)</option>
                      <option value="half_yearly">Halbjährlich</option>
                      <option value="yearly">Jährlich</option>
                      <option value="none">Beitragsfrei (0,00 €)</option>
                    </select>
                  </div>

                  {formData.feePeriod === 'monthly' && (
                    <div className="col-span-1 md:col-span-2 pt-3 border-t border-slate-200">
                      <label className="block text-xs font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Fälligkeitstag bei monatlichem Einzug *
                      </label>
                      <p className="text-xs text-slate-500 mb-2.5">
                        Mitglieder können bei monatlicher Zahlung zwischen dem 1. und dem 15. des Monats wählen:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                            (formData.bankDetails?.monthlyDueDay || 1) === 1
                              ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="monthlyDueDay"
                            value={1}
                            checked={(formData.bankDetails?.monthlyDueDay || 1) === 1}
                            onChange={() => setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, monthlyDueDay: 1 }
                            })}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm block">1. eines Monats</span>
                            <span className="text-[11px] text-slate-500 font-normal">Einzug zu Monatsbeginn</span>
                          </div>
                        </label>

                        <label
                          className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                            formData.bankDetails?.monthlyDueDay === 15
                              ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="monthlyDueDay"
                            value={15}
                            checked={formData.bankDetails?.monthlyDueDay === 15}
                            onChange={() => setFormData({
                              ...formData,
                              bankDetails: { ...formData.bankDetails, monthlyDueDay: 15 }
                            })}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm block">15. eines Monats</span>
                            <span className="text-[11px] text-slate-500 font-normal">Einzug zur Monatsmitte</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: BANKDATEN & SEPA */}
            {activeTab === 'payment' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Zahlungsmethode *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'sepa', label: 'SEPA-Lastschrift' },
                      { id: 'transfer', label: 'Überweisung' },
                      { id: 'standing_order', label: 'Dauerauftrag' },
                      { id: 'cash', label: 'Bargeld' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: opt.id as PaymentMethod })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                          formData.paymentMethod === opt.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.paymentMethod === 'sepa' && (
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      SEPA-Basislastschriftmandat gem. EPC-Standard
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kontoinhaber *
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.accountHolder}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, accountHolder: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="z.B. Maximilian Müller"
                        />
                        {errors.accountHolder && <p className="text-xs text-rose-600 mt-1">{errors.accountHolder}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kreditinstitut / Bankname
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.bankName}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, bankName: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="z.B. Sparkasse Musterstadt"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          IBAN *
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.iban}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, iban: e.target.value.toUpperCase().replace(/\s/g, '') }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="DE89 3705 0198 0000 1234 56"
                        />
                        {formData.bankDetails.iban ? (
                          (() => {
                            const check = SepaService.validateIban(formData.bankDetails.iban);
                            return check.isValid ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Gültige {check.country}-IBAN ({check.formatted})</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{check.error || 'Prüfziffer ungültig'}</span>
                              </div>
                            );
                          })()
                        ) : errors.iban ? (
                          <p className="text-xs text-rose-600 mt-1">{errors.iban}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          BIC (optional bei SEPA)
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.bic}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, bic: e.target.value.toUpperCase().trim() }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="SPKDMUSTXXX"
                        />
                      </div>
                    </div>

                    {/* Monthly Due Day Selection in SEPA View */}
                    {formData.feePeriod === 'monthly' && (
                      <div className="p-3 bg-white border border-blue-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          SEPA-Einzugstag beim monatlichen Beitrag:
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              type="radio"
                              name="sepaMonthlyDueDay"
                              value={1}
                              checked={(formData.bankDetails?.monthlyDueDay || 1) === 1}
                              onChange={() => setFormData({
                                ...formData,
                                bankDetails: { ...formData.bankDetails, monthlyDueDay: 1 }
                              })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>🔘 1. des Monats (Monatsanfang)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                            <input
                              type="radio"
                              name="sepaMonthlyDueDay"
                              value={15}
                              checked={formData.bankDetails?.monthlyDueDay === 15}
                              onChange={() => setFormData({
                                ...formData,
                                bankDetails: { ...formData.bankDetails, monthlyDueDay: 15 }
                              })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>🔘 15. des Monats (Monatsmitte)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-blue-100">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Datum der Lastschriftermächtigung / Mandat
                        </label>
                        <input
                          type="date"
                          value={formData.bankDetails.mandateDate}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, mandateDate: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mandatsreferenz (eindeutige ID)
                        </label>
                        <input
                          type="text"
                          value={formData.bankDetails.mandateReference}
                          onChange={e => setFormData({
                            ...formData,
                            bankDetails: { ...formData.bankDetails, mandateReference: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="z.B. MANDAT-MG001-2025"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: NOTIZEN & DSGVO */}
            {activeTab === 'notes' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Interne Notizen & Bemerkungen (Lizenzen, Funktionen, Ehrungen, etc.)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. Jugendtrainer C-Lizenz, Schiedsrichterausweis, Allergien bei Trainingslagern, etc."
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.dataPrivacyConsent}
                      onChange={e => setFormData({ ...formData, dataPrivacyConsent: e.target.checked })}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        DSGVO-Datenschutzeinwilligung liegt vor
                      </span>
                      <p className="text-xs text-slate-500">
                        Das Mitglied hat der Erhebung, Verarbeitung und Speicherung personenbezogener Daten für vereinsinterne Zwecke gem. Art. 6 Abs. 1 lit. b/c DSGVO zugestimmt.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {Object.keys(errors).length > 0 && (
                <span className="text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Bitte Pflichtfelder prüfen
                </span>
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
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {member ? 'Änderungen speichern' : 'Mitglied anlegen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
